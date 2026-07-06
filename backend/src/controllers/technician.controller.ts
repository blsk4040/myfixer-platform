import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Technician, { TechnicianApprovalStatus } from '../models/technician.model';
import { logAuditEvent } from '../services/audit.service';
import matchingService from '../services/matching.service';

interface ReviewTechnicianRequestBody {
  status?: unknown;
  rejectionReason?: unknown;
}

const isApprovalStatus = (value: unknown): value is TechnicianApprovalStatus =>
  typeof value === 'string' &&
  Object.values(TechnicianApprovalStatus).includes(value as TechnicianApprovalStatus);

export const listTechnicianApplications = async (_req: Request, res: Response): Promise<void> => {
  try {
    const technicians = await Technician.find()
      .populate('userId', 'name email phone countryCode currency location')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, technicians });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch technician applications.' });
  }
};

export const getAvailableJobsForTechnician = async (req: Request, res: Response): Promise<void> => {
  const authUser = (req as any).user as { id?: string; _id?: string; role?: string } | undefined;
  const technicianId = String(authUser?.id ?? authUser?._id ?? '').trim();

  if (!technicianId) {
    res.status(401).json({ message: 'Unauthorized. Technician identity missing.' });
    return;
  }

  try {
    const jobs = await matchingService.findNearbyPendingBookingsForTechnician(technicianId);
    await matchingService.markBookingsSentToTechnician(
      technicianId,
      jobs.map((job) => job.id)
    );

    res.status(200).json({
      success: true,
      jobs: jobs.map((job) => ({
        bookingId: job.id,
        applianceType: job.applianceType,
        faultDescription: job.faultDescription,
        fullAddress: job.fullAddress,
        complexDetails: job.complexDetails,
        generalArea: job.generalArea,
        priceMinor: job.priceMinor,
        currency: job.currency,
        countryCode: job.countryCode,
        latitude: job.latitude,
        longitude: job.longitude,
        distanceKm: job.distanceKm,
        distanceText: `${job.distanceKm.toFixed(1)} km`,
        categoryMatch: job.categoryMatch,
      }))
    });
  } catch (error) {
    console.error('Failed to fetch available jobs for technician:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch nearby jobs.' });
  }
};

export const reviewTechnicianApplication = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const body = req.body as ReviewTechnicianRequestBody;
  const reviewerId = (req as any).user?.id;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: 'Invalid technician id.' });
    return;
  }

  if (!isApprovalStatus(body.status)) {
    res.status(400).json({ message: 'Invalid technician review status.' });
    return;
  }

  try {
    const technician = await Technician.findById(id);
    if (!technician) {
      res.status(404).json({ message: 'Technician application not found.' });
      return;
    }

    const before = {
      approvalStatus: technician.approvalStatus,
      review: technician.review,
    };

    technician.approvalStatus = body.status;
    technician.review.reviewedAt = new Date();
    technician.review.reviewedBy = mongoose.Types.ObjectId.isValid(reviewerId)
      ? new mongoose.Types.ObjectId(reviewerId)
      : null;
    const reviewReason = typeof body.rejectionReason === 'string' ? body.rejectionReason.trim() : '';
    technician.review.rejectionReason = body.status === TechnicianApprovalStatus.REJECTED ? reviewReason : '';
    technician.review.suspensionReason = body.status === TechnicianApprovalStatus.SUSPENDED ? reviewReason : '';

    await technician.save();

    await logAuditEvent(req, {
      action: 'technician.review',
      module: 'TECHNICIANS',
      resourceType: 'Technician',
      resourceId: technician._id.toString(),
      changes: {
        before,
        after: {
          approvalStatus: technician.approvalStatus,
          review: technician.review,
        },
      },
      metadata: {
        status: body.status,
      },
    });

    res.status(200).json({ success: true, technician });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to review technician application.' });
  }
};
