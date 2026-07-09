import mongoose from 'mongoose';
import { Server as SocketIOServer } from 'socket.io';
import Booking, { BookingDispatchStatus, BookingStatus } from '../models/booking.model';
import Technician, { TechnicianApprovalStatus } from '../models/technician.model';
import { NotificationChannel } from '../models/notification.model';
import matchingService from './matching.service';
import { createNotifications } from './notification.service';

const LATE_CANCELLATION_FEE_MINOR = 15000;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export interface TechnicianCancellationPenaltyResult {
  tier: 1 | 2 | 3;
  penaltyMinor: number;
  bookingId: string;
  technicianId: string;
  rematchTechnicianIds: string[];
  suspended: boolean;
}

export const handleTechnicianCancellation = async (
  bookingId: string,
  technicianId: string,
  io?: SocketIOServer
): Promise<TechnicianCancellationPenaltyResult> => {
  if (!mongoose.Types.ObjectId.isValid(bookingId) || !mongoose.Types.ObjectId.isValid(technicianId)) {
    throw new Error('Valid bookingId and technicianId are required.');
  }

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new Error('Booking not found.');
  }

  const technician = await Technician.findOne({ userId: new mongoose.Types.ObjectId(technicianId) });
  if (!technician) {
    throw new Error('Technician profile not found.');
  }

  const scheduledStart = booking.appointmentWindow?.scheduledStartTime
    ? new Date(booking.appointmentWindow.scheduledStartTime)
    : null;
  const noticeMs = scheduledStart && !Number.isNaN(scheduledStart.getTime())
    ? scheduledStart.getTime() - Date.now()
    : 0;

  const tier: 1 | 2 | 3 =
    noticeMs > TWENTY_FOUR_HOURS_MS ? 1 : noticeMs >= TWO_HOURS_MS ? 2 : 3;
  const penaltyMinor =
    tier === 1 ? 0 : tier === 2 ? LATE_CANCELLATION_FEE_MINOR : Math.max(booking.priceMinor, LATE_CANCELLATION_FEE_MINOR);

  if (penaltyMinor > 0) {
    technician.walletBalance -= penaltyMinor;
  }

  if (tier === 3) {
    technician.strikesCount += 1;
    technician.reliabilityScore = Math.max(technician.reliabilityScore - 15, 0);
  }

  let suspended = false;
  if (technician.strikesCount >= 3) {
    technician.approvalStatus = TechnicianApprovalStatus.SUSPENDED;
    technician.availability.isOnline = false;
    technician.review.suspensionReason = 'Automatic suspension after repeated late cancellations or no-shows.';
    suspended = true;
  }

  await technician.save();

  booking.technicianId = null;
  booking.technicianName = '';
  booking.status = BookingStatus.PENDING;
  booking.dispatch = {
    ...(booking.dispatch ?? {
      sentToTechnicians: [],
      declinedByTechnicians: [],
    }),
    status: tier === 1 ? BookingDispatchStatus.STANDBY : BookingDispatchStatus.STANDBY,
    expiresAt: tier === 1 ? null : matchingService.getDispatchExpiry({ createdAt: new Date() }),
    sentToTechnicians: [],
    declinedByTechnicians: booking.dispatch?.declinedByTechnicians ?? [],
    acceptedByTechnician: null,
  };
  booking.metadata = {
    ...(booking.metadata ?? {}),
    lastTechnicianCancellation: {
      technicianId,
      tier,
      penaltyMinor,
      cancelledAt: new Date(),
      scheduledStartTime: scheduledStart,
    },
  };
  await booking.save();

  const rematchTechnicianIds =
    tier === 1 ? [] : await matchingService.findEligibleOnlineTechniciansForBooking(booking.id);

  if (tier >= 2 && rematchTechnicianIds.length) {
    booking.dispatch.sentToTechnicians = rematchTechnicianIds.map((id) => new mongoose.Types.ObjectId(id));
    await booking.save();

    const payload = {
      bookingId: booking.id,
      serviceKey: booking.serviceKey,
      applianceType: booking.applianceType,
      faultDescription: booking.faultDescription,
      fullAddress: booking.fullAddress,
      generalArea: booking.generalArea,
      priceMinor: booking.priceMinor,
      countryCode: booking.countryCode,
      currency: booking.currency,
      emergencyReplacement: true,
    };

    rematchTechnicianIds.forEach((targetTechnicianId) => {
      io?.to(`technician:${targetTechnicianId}`).emit('emergency_standby_request', payload);
      io?.to(`technician:${targetTechnicianId}`).emit('incoming_request', payload);
    });

    await Promise.all(
      rematchTechnicianIds.map((targetTechnicianId) =>
        createNotifications({
          userId: targetTechnicianId,
          channels: [NotificationChannel.PUSH],
          type: 'EMERGENCY_JOB_REQUEST',
          title: 'Urgent replacement job',
          message: `${booking.applianceType || 'Service request'} needs a replacement technician in ${booking.generalArea || 'your area'}.`,
          metadata: {
            bookingId: booking.id,
            applianceType: booking.applianceType,
            emergencyReplacement: true,
          },
        })
      )
    );
  }

  return {
    tier,
    penaltyMinor,
    bookingId: booking.id,
    technicianId,
    rematchTechnicianIds,
    suspended,
  };
};

export default {
  handleTechnicianCancellation,
};
