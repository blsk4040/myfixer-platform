import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Booking, { BookingStatus } from '../models/booking.model';
import JobQuote from '../models/quote.model';
import Technician, { TechnicianApprovalStatus, VerificationStatus } from '../models/technician.model';
import TechnicianCapability, { CapabilityStatus } from '../models/technician-capability.model';
import { serializeBookingForAssignedTechnician } from '../services/booking-privacy.service';
import { logAuditEvent } from '../services/audit.service';
import matchingService from '../services/matching.service';
import User from '../models/user.model';
import { EmailService } from '../services/email/email.service';
import { uploadImageToCloudinary } from '../services/media-storage.service';
import { countryScopeFilter, getAdminMarketScope, handleAdminMarketScopeError } from '../services/admin-market-scope.service';
import { getProviderReputation } from '../services/provider-reputation.service';
import { parseImageDataUri } from '../utils/image-data-uri';

const MAX_TECHNICIAN_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024;

interface ReviewTechnicianRequestBody {
  status?: unknown;
  rejectionReason?: unknown;
}

interface ReviewTechnicianPhotoRequestBody {
  status?: unknown;
  rejectionReason?: unknown;
}

const isApprovalStatus = (value: unknown): value is TechnicianApprovalStatus =>
  typeof value === 'string' &&
  Object.values(TechnicianApprovalStatus).includes(value as TechnicianApprovalStatus);

const isPhotoReviewStatus = (value: unknown): value is VerificationStatus =>
  value === VerificationStatus.VERIFIED || value === VerificationStatus.REJECTED;

const capabilityStatusForTechnicianReview = (status: TechnicianApprovalStatus): CapabilityStatus => {
  if (status === TechnicianApprovalStatus.APPROVED) return CapabilityStatus.APPROVED;
  if (status === TechnicianApprovalStatus.REJECTED || status === TechnicianApprovalStatus.SUSPENDED) {
    return CapabilityStatus.REJECTED;
  }
  return CapabilityStatus.PENDING;
};

export const listTechnicianApplications = async (req: Request, res: Response): Promise<void> => {
  try {
    const scopeFilter = countryScopeFilter(await getAdminMarketScope(req));
    const technicians = await Technician.find(scopeFilter)
      .populate('userId', 'name email phone countryCode currency location')
      .sort({ createdAt: -1 })
      .lean();

    const technicianIds = technicians.map((technician) => technician._id);
    const capabilities = await TechnicianCapability.find({ technicianId: { $in: technicianIds } })
      .sort({ categorySlug: 1 })
      .lean();
    const capabilitiesByTechnician = capabilities.reduce<Record<string, typeof capabilities>>((map, capability) => {
      const key = String(capability.technicianId);
      map[key] = map[key] || [];
      map[key].push(capability);
      return map;
    }, {});

    res.status(200).json({
      success: true,
      technicians: technicians.map((technician) => ({
        ...technician,
        capabilities: capabilitiesByTechnician[String(technician._id)] || [],
      })),
    });
  } catch (error) {
    if (handleAdminMarketScopeError(res, error)) return;
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

    const acceptedFutureJobs = await Booking.find({
      technicianId: new mongoose.Types.ObjectId(technicianId),
      status: { $in: [BookingStatus.ACCEPTED, BookingStatus.IN_ROUTE, BookingStatus.ARRIVED, BookingStatus.IN_PROGRESS, BookingStatus.DIAGNOSTIC_DONE] },
      'appointmentWindow.isPreBook': true,
      'appointmentWindow.scheduledStartTime': { $gte: new Date() },
    })
      .select('applianceType faultDescription fullAddress complexDetails generalArea priceMinor currency countryCode appointmentWindow status customerName')
      .sort({ 'appointmentWindow.scheduledStartTime': 1 })
      .limit(100)
      .lean();

    res.status(200).json({
      success: true,
      jobs,
      acceptedFutureJobs: acceptedFutureJobs.map((job) => ({
        bookingId: job._id.toString(),
        customerName: job.customerName,
        applianceType: job.applianceType,
        faultDescription: job.faultDescription,
        fullAddress: job.fullAddress,
        complexDetails: job.complexDetails,
        generalArea: job.generalArea,
        priceMinor: job.priceMinor,
        currency: job.currency,
        countryCode: job.countryCode,
        appointmentWindow: job.appointmentWindow,
        status: job.status,
      })),
    });
  } catch (error) {
    console.error('Failed to fetch available jobs for technician:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch nearby jobs.' });
  }
};

export const getMyTechnicianJobs = async (req: Request, res: Response): Promise<void> => {
  const authUser = (req as any).user as { id?: string; _id?: string } | undefined;
  const technicianId = String(authUser?.id ?? authUser?._id ?? '').trim();

  if (!technicianId || !mongoose.Types.ObjectId.isValid(technicianId)) {
    res.status(401).json({ message: 'Unauthorized. Technician identity missing.' });
    return;
  }

  try {
    const technicianObjectId = new mongoose.Types.ObjectId(technicianId);
    const now = new Date();
    const activeStatuses = [
      BookingStatus.ACCEPTED,
      BookingStatus.IN_ROUTE,
      BookingStatus.ARRIVED,
      BookingStatus.IN_PROGRESS,
      BookingStatus.DIAGNOSTIC_DONE,
    ];

    const [activeJobs, scheduledJobs, completedJobs, technicianProfile] = await Promise.all([
      Booking.find({
        technicianId: technicianObjectId,
        status: { $in: activeStatuses },
        $or: [
          { 'appointmentWindow.isPreBook': { $ne: true } },
          { 'appointmentWindow.scheduledStartTime': { $lte: now } },
          { 'appointmentWindow.scheduledStartTime': null },
        ],
      })
        .sort({ acceptedAt: -1, updatedAt: -1 })
        .limit(100),
      Booking.find({
        technicianId: technicianObjectId,
        $or: [
          { status: BookingStatus.SCHEDULED },
          {
            status: { $in: activeStatuses },
            'appointmentWindow.isPreBook': true,
            'appointmentWindow.scheduledStartTime': { $gt: now },
          },
        ],
      })
        .sort({ 'appointmentWindow.scheduledStartTime': 1, scheduledAt: 1, updatedAt: -1 })
        .limit(100),
      Booking.find({
        technicianId: technicianObjectId,
        status: BookingStatus.COMPLETED,
      })
        .sort({ completedAt: -1, updatedAt: -1 })
        .limit(50),
      Technician.findOne({ userId: technicianObjectId }).select('approvalStatus stats').lean(),
    ]);

    const allJobs = [...activeJobs, ...scheduledJobs, ...completedJobs];
    const bookingIds = allJobs.map((job) => job._id);
    const currentQuotes = await JobQuote.find({ bookingId: { $in: bookingIds }, isCurrent: true })
      .select('bookingId status')
      .lean();
    const quoteStatusByBookingId = new Map(
      currentQuotes.map((quote) => [String(quote.bookingId), quote.status])
    );
    const serializeWithQuoteStatus = (booking: any) => ({
      ...serializeBookingForAssignedTechnician(booking),
      quoteStatus: quoteStatusByBookingId.get(String(booking._id)) ?? 'NOT_REQUIRED',
    });

    res.status(200).json({
      success: true,
      activeJobs: activeJobs.map(serializeWithQuoteStatus),
      scheduledJobs: scheduledJobs.map(serializeWithQuoteStatus),
      completedJobs: completedJobs.map(serializeWithQuoteStatus),
      reputation: getProviderReputation(technicianProfile),
    });
  } catch (error) {
    console.error('Failed to fetch technician jobs:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch technician jobs.' });
  }
};

export const uploadMyTechnicianProfilePhoto = async (req: Request, res: Response): Promise<void> => {
  const authUser = (req as any).user as { id?: string; _id?: string } | undefined;
  const technicianUserId = String(authUser?.id ?? authUser?._id ?? '').trim();

  if (!technicianUserId || !mongoose.Types.ObjectId.isValid(technicianUserId)) {
    res.status(401).json({ message: 'Unauthorized. Technician identity missing.' });
    return;
  }

  try {
    const { dataUri } = parseImageDataUri(req.body?.dataUri, {
      maxBytes: MAX_TECHNICIAN_PROFILE_PHOTO_BYTES,
      invalidMessage: 'Please upload a JPG, PNG, or WebP profile photo.',
      tooLargeMessage: 'Profile photos must be 5 MB or smaller.',
    });

    const technician = await Technician.findOne({ userId: new mongoose.Types.ObjectId(technicianUserId) });
    if (!technician) {
      res.status(404).json({ message: 'Technician profile not found.' });
      return;
    }

    const uploaded = await uploadImageToCloudinary({
      dataUri,
      folder: `myfixer/technicians/${technicianUserId}/profile`,
      publicId: `profile-photo-${Date.now()}`,
    });

    const before = {
      profilePhotoUrl: technician.documents.profilePhotoUrl,
      profilePhotoStatus: technician.documents.profilePhotoStatus,
      approvalStatus: technician.approvalStatus,
    };

    technician.documents.profilePhotoUrl = uploaded.url;
    technician.documents.profilePhotoStatus = VerificationStatus.SUBMITTED;
    if (technician.approvalStatus === TechnicianApprovalStatus.REJECTED) {
      technician.approvalStatus = TechnicianApprovalStatus.PENDING_REVIEW;
      technician.review.rejectionReason = '';
    }

    await technician.save();

    await logAuditEvent(req, {
      action: 'technician.profile_photo.submit',
      module: 'TECHNICIANS',
      resourceType: 'Technician',
      resourceId: technician._id.toString(),
      changes: {
        before,
        after: {
          profilePhotoUrl: technician.documents.profilePhotoUrl,
          profilePhotoStatus: technician.documents.profilePhotoStatus,
          approvalStatus: technician.approvalStatus,
        },
      },
    });

    res.status(200).json({
      success: true,
      technician: {
        id: technician._id,
        approvalStatus: technician.approvalStatus,
        profilePhotoUrl: technician.documents.profilePhotoUrl,
        profilePhotoStatus: technician.documents.profilePhotoStatus,
      },
    });
  } catch (error) {
    console.error('Failed to upload technician profile photo:', error);
    res.status(500).json({ message: 'Unable to upload technician profile photo.' });
  }
};

export const reviewTechnicianProfilePhoto = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const body = req.body as ReviewTechnicianPhotoRequestBody;
  const reviewerId = (req as any).user?.id;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: 'Invalid technician id.' });
    return;
  }

  if (!isPhotoReviewStatus(body.status)) {
    res.status(400).json({ message: 'Invalid profile photo review status.' });
    return;
  }

  try {
    const technician = await Technician.findById(id);
    if (!technician) {
      res.status(404).json({ message: 'Technician application not found.' });
      return;
    }

    if (!technician.documents.profilePhotoUrl) {
      res.status(400).json({ message: 'Technician has not uploaded a profile photo.' });
      return;
    }

    const before = {
      profilePhotoStatus: technician.documents.profilePhotoStatus,
      profilePhotoUrl: technician.documents.profilePhotoUrl,
      approvalStatus: technician.approvalStatus,
      review: technician.review,
    };

    technician.documents.profilePhotoStatus = body.status;
    technician.review.reviewedAt = new Date();
    technician.review.reviewedBy = mongoose.Types.ObjectId.isValid(reviewerId)
      ? new mongoose.Types.ObjectId(reviewerId)
      : null;

    const reviewReason = typeof body.rejectionReason === 'string' ? body.rejectionReason.trim() : '';
    if (body.status === VerificationStatus.REJECTED) {
      technician.approvalStatus = TechnicianApprovalStatus.PENDING_REVIEW;
      technician.review.rejectionReason = reviewReason || 'Profile photo was rejected. Please upload a clear headshot.';
      await User.findByIdAndUpdate(technician.userId, { $set: { profilePhotoUrl: '' } });
    } else {
      technician.review.rejectionReason = '';
      await User.findByIdAndUpdate(technician.userId, { $set: { profilePhotoUrl: technician.documents.profilePhotoUrl } });
    }

    await technician.save();

    await logAuditEvent(req, {
      action: 'technician.profile_photo.review',
      module: 'TECHNICIANS',
      resourceType: 'Technician',
      resourceId: technician._id.toString(),
      changes: {
        before,
        after: {
          profilePhotoStatus: technician.documents.profilePhotoStatus,
          profilePhotoUrl: technician.documents.profilePhotoUrl,
          approvalStatus: technician.approvalStatus,
          review: technician.review,
        },
      },
      metadata: { status: body.status },
    });

    res.status(200).json({ success: true, technician });
  } catch (error) {
    console.error('Failed to review technician profile photo:', error);
    res.status(500).json({ message: 'Failed to review technician profile photo.' });
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

    if (
      body.status === TechnicianApprovalStatus.APPROVED &&
      technician.documents.profilePhotoStatus !== VerificationStatus.VERIFIED
    ) {
      res.status(409).json({ message: 'Approve the technician profile photo before approving this application.' });
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

    await TechnicianCapability.updateMany(
      { technicianId: technician._id },
      {
        $set: {
          verificationStatus: capabilityStatusForTechnicianReview(technician.approvalStatus),
          rejectionReason:
            technician.approvalStatus === TechnicianApprovalStatus.REJECTED ||
            technician.approvalStatus === TechnicianApprovalStatus.SUSPENDED
              ? reviewReason
              : null,
        },
      }
    );

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

    let reviewEmailSent = false;
    if (before.approvalStatus !== technician.approvalStatus) {
      const technicianUser = await User.findById(technician.userId).select('name email').lean();
      if (technicianUser?.email) {
        reviewEmailSent = await EmailService.sendTechnicianReviewEmail({
          recipientEmail: technicianUser.email,
          technicianName: technicianUser.name || 'there',
          status: technician.approvalStatus,
          rejectionReason: reviewReason,
        });
      }
    }

    res.status(200).json({ success: true, technician, reviewEmailSent });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to review technician application.' });
  }
};
