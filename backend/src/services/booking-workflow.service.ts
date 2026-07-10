import mongoose from 'mongoose';
import { Server as SocketIOServer } from 'socket.io';
import Booking, { BookingDispatchStatus, BookingStatus, IBooking } from '../models/booking.model';
import { normalizeUserRole, UserRole } from '../models/user.model';
import { bookingWorkflowConfig } from '../config/booking-workflow.config';
import { distanceMetersBetween } from '../modules/routing/routing.geo';

export type BookingWorkflowActor = {
  id?: string;
  _id?: string;
  role?: string;
};

export type BookingWorkflowAction =
  | 'ACCEPT_BOOKING'
  | 'CANCEL_BOOKING'
  | 'START_ROUTE'
  | 'CONFIRM_ARRIVAL'
  | 'START_JOB'
  | 'COMPLETE_JOB'
  | 'SUPPORT_CANCEL';

export interface ArrivalReadingInput {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  recordedAt: Date;
}

export class BookingWorkflowError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'BookingWorkflowError';
  }
}

const VALID_TRANSITIONS: Partial<Record<BookingStatus, BookingStatus[]>> = {
  [BookingStatus.PENDING]: [BookingStatus.SCHEDULED, BookingStatus.ACCEPTED, BookingStatus.CANCELLED],
  [BookingStatus.SCHEDULED]: [BookingStatus.ACCEPTED, BookingStatus.CANCELLED],
  [BookingStatus.ACCEPTED]: [BookingStatus.IN_ROUTE, BookingStatus.CANCELLED],
  [BookingStatus.IN_ROUTE]: [BookingStatus.ARRIVED, BookingStatus.CANCELLED],
  [BookingStatus.ARRIVED]: [BookingStatus.IN_PROGRESS, BookingStatus.CANCELLED],
  [BookingStatus.IN_PROGRESS]: [BookingStatus.COMPLETED, BookingStatus.CANCELLED],
  [BookingStatus.DIAGNOSTIC_DONE]: [BookingStatus.COMPLETED, BookingStatus.CANCELLED],
  [BookingStatus.COMPLETED]: [],
  [BookingStatus.CANCELLED]: [],
};

export const getValidBookingTransitions = (): Partial<Record<BookingStatus, BookingStatus[]>> => VALID_TRANSITIONS;

const toUserId = (actor?: BookingWorkflowActor): string => String(actor?.id ?? actor?._id ?? '').trim();

const isAssignedTechnician = (booking: IBooking, userId: string): boolean =>
  Boolean(userId && String(booking.technicianId || '') === userId);

const isCustomer = (booking: IBooking, userId: string): boolean =>
  Boolean(userId && String(booking.customerId || '') === userId);

const assertValidObjectId = (value: string, label: string): void => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new BookingWorkflowError(400, `Invalid ${label}.`, 'INVALID_ID');
  }
};

const assertTransition = (from: BookingStatus, to: BookingStatus): void => {
  if (!(VALID_TRANSITIONS[from] || []).includes(to)) {
    throw new BookingWorkflowError(409, `Cannot move booking from ${from} to ${to}.`, 'INVALID_STATUS_TRANSITION');
  }
};

const assertAuthorizedTransition = (
  booking: IBooking,
  actor: BookingWorkflowActor | undefined,
  to: BookingStatus,
  action: BookingWorkflowAction
): void => {
  const userId = toUserId(actor);
  const role = normalizeUserRole(actor?.role);
  const admin = role === UserRole.ADMIN;
  const technician = isAssignedTechnician(booking, userId);
  const customer = isCustomer(booking, userId);

  if (admin) return;

  if (to === BookingStatus.CANCELLED) {
    if (customer && booking.status !== BookingStatus.IN_PROGRESS) return;
    if (technician && booking.status !== BookingStatus.IN_PROGRESS) return;
    throw new BookingWorkflowError(403, 'This cancellation requires support review.', 'SUPPORT_REQUIRED');
  }

  if (action === 'START_ROUTE' || action === 'CONFIRM_ARRIVAL' || action === 'START_JOB' || action === 'COMPLETE_JOB') {
    if (technician) return;
  }

  throw new BookingWorkflowError(403, 'This account cannot update this booking status.', 'BOOKING_STATUS_FORBIDDEN');
};

const buildTimestampUpdate = (nextStatus: BookingStatus, now = new Date()): Record<string, unknown> => {
  const update: Record<string, unknown> = { status: nextStatus };
  if (nextStatus === BookingStatus.SCHEDULED) update.scheduledAt = now;
  if (nextStatus === BookingStatus.ACCEPTED) update.acceptedAt = now;
  if (nextStatus === BookingStatus.IN_ROUTE) {
    update.inRouteAt = now;
    update.routeStartedAt = now;
  }
  if (nextStatus === BookingStatus.ARRIVED) update.arrivedAt = now;
  if (nextStatus === BookingStatus.IN_PROGRESS) {
    update.inProgressAt = now;
    update.workStartedAt = now;
  }
  if (nextStatus === BookingStatus.COMPLETED) update.completedAt = now;
  if (nextStatus === BookingStatus.CANCELLED) {
    update.cancelledAt = now;
    update['dispatch.status'] = BookingDispatchStatus.CANCELLED;
  }
  return update;
};

const applyStatusTimestamps = (booking: IBooking, nextStatus: BookingStatus): void => {
  const now = new Date();
  if (nextStatus === BookingStatus.SCHEDULED) booking.scheduledAt = booking.scheduledAt ?? now;
  if (nextStatus === BookingStatus.ACCEPTED) booking.acceptedAt = booking.acceptedAt ?? now;
  if (nextStatus === BookingStatus.IN_ROUTE) {
    booking.inRouteAt = booking.inRouteAt ?? now;
    booking.routeStartedAt = booking.routeStartedAt ?? now;
  }
  if (nextStatus === BookingStatus.ARRIVED) booking.arrivedAt = booking.arrivedAt ?? now;
  if (nextStatus === BookingStatus.IN_PROGRESS) {
    booking.inProgressAt = booking.inProgressAt ?? now;
    booking.workStartedAt = booking.workStartedAt ?? now;
  }
  if (nextStatus === BookingStatus.COMPLETED) booking.completedAt = booking.completedAt ?? now;
  if (nextStatus === BookingStatus.CANCELLED) {
    booking.cancelledAt = booking.cancelledAt ?? now;
    booking.dispatch = {
      ...(booking.dispatch ?? {
        status: BookingDispatchStatus.CANCELLED,
        sentToTechnicians: [],
        declinedByTechnicians: [],
      }),
      status: BookingDispatchStatus.CANCELLED,
    };
  }
};

const buildActorFilter = (
  booking: IBooking,
  actor: BookingWorkflowActor | undefined,
  nextStatus: BookingStatus,
  action: BookingWorkflowAction
): Record<string, unknown> => {
  const userId = toUserId(actor);
  const role = normalizeUserRole(actor?.role);
  if (role === UserRole.ADMIN) return {};

  if (action === 'START_ROUTE' || action === 'CONFIRM_ARRIVAL' || action === 'START_JOB' || action === 'COMPLETE_JOB') {
    return { technicianId: new mongoose.Types.ObjectId(userId) };
  }

  if (nextStatus === BookingStatus.CANCELLED && isCustomer(booking, userId)) {
    return { customerId: new mongoose.Types.ObjectId(userId) };
  }
  if (nextStatus === BookingStatus.CANCELLED && isAssignedTechnician(booking, userId)) {
    return { technicianId: new mongoose.Types.ObjectId(userId) };
  }

  return {};
};

export const transitionBookingStatus = async (input: {
  booking: IBooking;
  actor?: BookingWorkflowActor;
  nextStatus: BookingStatus;
  action: BookingWorkflowAction;
}): Promise<IBooking> => {
  const currentStatus = input.booking.status;
  assertTransition(currentStatus, input.nextStatus);
  assertAuthorizedTransition(input.booking, input.actor, input.nextStatus, input.action);

  const updated = await Booking.findOneAndUpdate(
    {
      _id: input.booking._id,
      status: currentStatus,
      ...buildActorFilter(input.booking, input.actor, input.nextStatus, input.action),
    },
    {
      $set: buildTimestampUpdate(input.nextStatus),
    },
    { new: true }
  );

  if (!updated) {
    throw new BookingWorkflowError(409, 'Booking status changed before this action could complete.', 'STATUS_TRANSITION_CONFLICT');
  }

  return updated;
};

const isCoordinate = (latitude: number, longitude: number): boolean =>
  Number.isFinite(latitude) &&
  latitude >= -90 &&
  latitude <= 90 &&
  Number.isFinite(longitude) &&
  longitude >= -180 &&
  longitude <= 180;

const getArrivalConfirmation = (booking: IBooking): {
  readings: Array<{ latitude: number; longitude: number; accuracyMeters: number; recordedAt: string; distanceMeters: number }>;
  confirmedAt?: string;
} => {
  const metadata = (booking.metadata ?? {}) as Record<string, unknown>;
  const existing = metadata.arrivalConfirmation;
  if (!existing || typeof existing !== 'object') return { readings: [] };
  const record = existing as { readings?: unknown; confirmedAt?: unknown };
  return {
    readings: Array.isArray(record.readings)
      ? record.readings.filter((item): item is { latitude: number; longitude: number; accuracyMeters: number; recordedAt: string; distanceMeters: number } => {
          const reading = item as Record<string, unknown>;
          return (
            typeof reading.latitude === 'number' &&
            typeof reading.longitude === 'number' &&
            typeof reading.accuracyMeters === 'number' &&
            typeof reading.recordedAt === 'string' &&
            typeof reading.distanceMeters === 'number'
          );
        })
      : [],
    ...(typeof record.confirmedAt === 'string' ? { confirmedAt: record.confirmedAt } : {}),
  };
};

export const confirmBookingArrival = async (input: {
  bookingId: string;
  actor?: BookingWorkflowActor;
  reading: ArrivalReadingInput;
  io?: SocketIOServer;
}): Promise<IBooking> => {
  assertValidObjectId(input.bookingId, 'booking id');

  let booking: IBooking | null = await Booking.findById(input.bookingId);
  if (!booking) throw new BookingWorkflowError(404, 'Booking not found.', 'BOOKING_NOT_FOUND');

  const userId = toUserId(input.actor);
  if (!isAssignedTechnician(booking, userId) && normalizeUserRole(input.actor?.role) !== UserRole.ADMIN) {
    throw new BookingWorkflowError(403, 'Only the assigned technician can confirm arrival.', 'ARRIVAL_FORBIDDEN');
  }

  if (booking.status === BookingStatus.ARRIVED) {
    return booking;
  }
  if (booking.status !== BookingStatus.IN_ROUTE) {
    throw new BookingWorkflowError(409, 'Arrival can only be confirmed while the technician is in route.', 'ARRIVAL_INVALID_STATUS');
  }

  const { latitude, longitude, accuracyMeters, recordedAt } = input.reading;
  if (!isCoordinate(latitude, longitude)) {
    throw new BookingWorkflowError(400, 'Invalid GPS coordinates.', 'INVALID_COORDINATES');
  }
  if (!Number.isFinite(accuracyMeters) || accuracyMeters <= 0 || accuracyMeters > bookingWorkflowConfig.arrivalMaxGpsAccuracyMeters) {
    throw new BookingWorkflowError(400, 'GPS accuracy is too low for arrival confirmation.', 'POOR_GPS_ACCURACY');
  }

  const now = Date.now();
  const recordedAtMs = recordedAt.getTime();
  if (!Number.isFinite(recordedAtMs)) {
    throw new BookingWorkflowError(400, 'Invalid GPS reading timestamp.', 'INVALID_RECORDED_AT');
  }
  if (recordedAtMs > now + bookingWorkflowConfig.arrivalMaxFutureSkewSeconds * 1000) {
    throw new BookingWorkflowError(400, 'GPS reading timestamp is in the future.', 'GPS_READING_FUTURE');
  }
  if (now - recordedAtMs > bookingWorkflowConfig.arrivalMaxReadingAgeSeconds * 1000) {
    throw new BookingWorkflowError(400, 'GPS reading is too old.', 'GPS_READING_STALE');
  }

  const [destinationLongitude, destinationLatitude] = booking.customerLocation.coordinates;
  if (!isCoordinate(destinationLatitude, destinationLongitude)) {
    throw new BookingWorkflowError(409, 'Booking service location is invalid.', 'INVALID_SERVICE_LOCATION');
  }

  const distanceMeters = distanceMetersBetween(
    { latitude, longitude },
    { latitude: destinationLatitude, longitude: destinationLongitude }
  );
  if (distanceMeters > bookingWorkflowConfig.arrivalRadiusMeters) {
    throw new BookingWorkflowError(409, 'You are not within the service-location arrival radius.', 'OUTSIDE_ARRIVAL_RADIUS');
  }

  const confirmation = getArrivalConfirmation(booking);
  if (confirmation.readings.some((reading) => reading.recordedAt === recordedAt.toISOString())) {
    throw new BookingWorkflowError(409, 'This GPS reading has already been submitted.', 'ARRIVAL_REPLAYED_READING');
  }

  const previous = confirmation.readings[confirmation.readings.length - 1];
  if (previous) {
    const elapsedSeconds = Math.max(1, Math.abs(recordedAtMs - new Date(previous.recordedAt).getTime()) / 1000);
    const movedMeters = distanceMetersBetween({ latitude, longitude }, { latitude: previous.latitude, longitude: previous.longitude });
    if (movedMeters / elapsedSeconds > bookingWorkflowConfig.arrivalImpossibleSpeedMetersPerSecond) {
      throw new BookingWorkflowError(400, 'GPS reading is inconsistent with recent movement.', 'GPS_READING_IMPOSSIBLE');
    }
  }

  const nextReadings = [
    ...confirmation.readings,
    {
      latitude,
      longitude,
      accuracyMeters,
      recordedAt: recordedAt.toISOString(),
      distanceMeters,
    },
  ].slice(-5);
  const first = nextReadings[0];
  const last = nextReadings[nextReadings.length - 1];
  const spanSeconds = first && last
    ? (new Date(last.recordedAt).getTime() - new Date(first.recordedAt).getTime()) / 1000
    : 0;

  booking.metadata = {
    ...(booking.metadata ?? {}),
    arrivalConfirmation: {
      readings: nextReadings,
      updatedAt: new Date().toISOString(),
    },
  };

  if (
    nextReadings.length < bookingWorkflowConfig.arrivalRequiredReadings ||
    spanSeconds < bookingWorkflowConfig.arrivalConfirmationSeconds
  ) {
    await booking.save();
    throw new BookingWorkflowError(
      202,
      'Arrival reading accepted. Please confirm again after a short moment.',
      'ARRIVAL_MORE_READINGS_REQUIRED'
    );
  }

  booking.metadata = {
    ...(booking.metadata ?? {}),
    arrivalConfirmation: {
      readings: nextReadings,
      updatedAt: new Date().toISOString(),
      confirmedAt: new Date().toISOString(),
    },
  };

  booking = await transitionBookingStatus({
    booking,
    actor: input.actor,
    nextStatus: BookingStatus.ARRIVED,
    action: 'CONFIRM_ARRIVAL',
  });

  input.io?.to(`booking:${booking.id}`).emit('booking_status_changed', {
    bookingId: booking.id,
    status: booking.status,
    updatedAt: booking.updatedAt,
  });
  input.io?.to(`booking:${booking.id}`).emit('technician_arrived', {
    bookingId: booking.id,
    status: booking.status,
    arrivedAt: booking.arrivedAt,
    message: 'Keep all job communication, approvals and payments inside MyFixer.',
  });
  if (booking.technicianId) {
    input.io?.to(`technician:${booking.technicianId.toString()}`).emit('technician_arrived', {
      bookingId: booking.id,
      status: booking.status,
    });
  }

  return booking;
};

export const findBookingForWorkflow = async (bookingId: string): Promise<IBooking> => {
  assertValidObjectId(bookingId, 'booking id');
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new BookingWorkflowError(404, 'Booking not found.', 'BOOKING_NOT_FOUND');
  return booking;
};
