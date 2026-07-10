import mongoose from 'mongoose';
import Booking, {
  BookingPaymentStatus,
  BookingStatus,
  IBooking,
  InspectionStatus,
  PricingMode,
  WorkAuthorizationStatus,
} from '../models/booking.model';
import JobMedia from '../models/job-media.model';
import JobQuote, { QuoteStatus } from '../models/quote.model';
import { UserRole, normalizeUserRole } from '../models/user.model';

export type WorkStartReasonCode =
  | 'BOOKING_NOT_ARRIVED'
  | 'INSPECTION_NOT_STARTED'
  | 'INSPECTION_NOT_COMPLETED'
  | 'QUOTE_REQUIRED'
  | 'QUOTE_NOT_SUBMITTED'
  | 'QUOTE_NOT_APPROVED'
  | 'QUOTE_EXPIRED'
  | 'PAYMENT_REQUIRED'
  | 'PAYMENT_NOT_SECURED'
  | 'UNAUTHORIZED_TECHNICIAN'
  | 'BOOKING_ALREADY_IN_PROGRESS'
  | 'BOOKING_TERMINAL';

export interface WorkflowActor {
  id?: string;
  _id?: string;
  role?: string;
}

export interface GpsReadingInput {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  recordedAt: Date;
}

export interface InspectionPartInput {
  name: string;
  quantity?: number;
  notes?: string;
}

export interface CompleteInspectionInput extends GpsReadingInput {
  diagnosisNotes: string;
  technicalObservations?: string;
  quoteRequired: boolean;
  partsRequired?: InspectionPartInput[];
  evidenceMediaIds?: string[];
}

export interface WorkStartEligibility {
  allowed: boolean;
  reasonCode?: WorkStartReasonCode;
  requirements: {
    arrived: boolean;
    inspectionRequired: boolean;
    inspectionStarted: boolean;
    inspectionComplete: boolean;
    quoteRequired: boolean;
    quoteSubmitted: boolean;
    quoteApproved: boolean;
    quoteExpired: boolean;
    paymentRequired: boolean;
    paymentSecured: boolean;
  };
}

export class InspectionWorkflowError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode = 400
  ) {
    super(message);
  }
}

const MAX_GPS_ACCURACY_METERS = Number(process.env.ARRIVAL_MAX_GPS_ACCURACY_METERS ?? 50);
const MAX_READING_AGE_SECONDS = Number(process.env.ARRIVAL_MAX_READING_AGE_SECONDS ?? 30);
const MAX_FUTURE_SECONDS = 60;
const MAX_PARTS = 30;

const actorId = (actor: WorkflowActor | undefined): string =>
  String(actor?.id ?? actor?._id ?? '').trim();

const isAdmin = (actor: WorkflowActor | undefined): boolean =>
  normalizeUserRole(actor?.role) === UserRole.ADMIN;

const isAssignedTechnician = (booking: Pick<IBooking, 'technicianId'>, actor: WorkflowActor | undefined): boolean => {
  const id = actorId(actor);
  return !!id && String(booking.technicianId || '') === id;
};

export const validateInspectionGpsReading = (reading: GpsReadingInput): void => {
  if (!Number.isFinite(reading.latitude) || reading.latitude < -90 || reading.latitude > 90) {
    throw new InspectionWorkflowError('Valid latitude is required.', 'INVALID_LATITUDE');
  }
  if (!Number.isFinite(reading.longitude) || reading.longitude < -180 || reading.longitude > 180) {
    throw new InspectionWorkflowError('Valid longitude is required.', 'INVALID_LONGITUDE');
  }
  if (!Number.isFinite(reading.accuracyMeters) || reading.accuracyMeters <= 0) {
    throw new InspectionWorkflowError('Valid GPS accuracy is required.', 'INVALID_GPS_ACCURACY');
  }
  if (reading.accuracyMeters > MAX_GPS_ACCURACY_METERS) {
    throw new InspectionWorkflowError('GPS accuracy is not sufficient for this action.', 'POOR_GPS_ACCURACY');
  }
  if (!(reading.recordedAt instanceof Date) || Number.isNaN(reading.recordedAt.getTime())) {
    throw new InspectionWorkflowError('Valid recordedAt timestamp is required.', 'INVALID_RECORDED_AT');
  }

  const ageSeconds = (Date.now() - reading.recordedAt.getTime()) / 1000;
  if (ageSeconds > MAX_READING_AGE_SECONDS) {
    throw new InspectionWorkflowError('GPS reading is too old.', 'STALE_GPS_READING');
  }
  if (ageSeconds < -MAX_FUTURE_SECONDS) {
    throw new InspectionWorkflowError('GPS reading timestamp is too far in the future.', 'FUTURE_GPS_READING');
  }
};

const normalizeParts = (parts: InspectionPartInput[] = []): InspectionPartInput[] => {
  if (parts.length > MAX_PARTS) {
    throw new InspectionWorkflowError('Too many parts were supplied.', 'TOO_MANY_PARTS');
  }
  return parts.map((part) => {
    const name = typeof part.name === 'string' ? part.name.trim() : '';
    if (!name) {
      throw new InspectionWorkflowError('Each part must have a name.', 'INVALID_PART_NAME');
    }
    if (name.length > 120) {
      throw new InspectionWorkflowError('Part names must be shorter than 120 characters.', 'INVALID_PART_NAME');
    }
    const quantity = part.quantity === undefined ? undefined : Number(part.quantity);
    if (quantity !== undefined && (!Number.isFinite(quantity) || quantity < 0 || quantity > 999)) {
      throw new InspectionWorkflowError('Part quantity is invalid.', 'INVALID_PART_QUANTITY');
    }
    const notes = typeof part.notes === 'string' ? part.notes.trim().slice(0, 500) : '';
    return { name, quantity, notes };
  });
};

const buildPoint = (reading: GpsReadingInput) => ({
  type: 'Point' as const,
  coordinates: [reading.longitude, reading.latitude] as [number, number],
  accuracyMeters: reading.accuracyMeters,
});

const loadBooking = async (bookingId: string): Promise<IBooking> => {
  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    throw new InspectionWorkflowError('Invalid booking id.', 'INVALID_BOOKING_ID', 400);
  }
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new InspectionWorkflowError('Booking not found.', 'BOOKING_NOT_FOUND', 404);
  }
  return booking;
};

export const startInspectionForBooking = async (
  bookingId: string,
  actor: WorkflowActor | undefined,
  reading: GpsReadingInput,
  acknowledgePlatformRules: boolean
): Promise<IBooking> => {
  validateInspectionGpsReading(reading);
  const booking = await loadBooking(bookingId);

  if (!isAssignedTechnician(booking, actor) && !isAdmin(actor)) {
    throw new InspectionWorkflowError('Only the assigned technician can start inspection.', 'UNAUTHORIZED_TECHNICIAN', 403);
  }
  if (booking.status !== BookingStatus.ARRIVED || !booking.arrivedAt) {
    throw new InspectionWorkflowError('Inspection can start only after backend-confirmed arrival.', 'BOOKING_NOT_ARRIVED', 409);
  }
  if (booking.inspection?.status === InspectionStatus.COMPLETED) {
    throw new InspectionWorkflowError('Inspection is already completed.', 'INSPECTION_ALREADY_COMPLETED', 409);
  }
  if (booking.inspection?.status === InspectionStatus.IN_PROGRESS) {
    return booking;
  }
  if (!acknowledgePlatformRules) {
    throw new InspectionWorkflowError('The platform payment and approval reminder must be acknowledged.', 'INSPECTION_ACK_REQUIRED', 400);
  }

  const now = new Date();
  const updated = await Booking.findOneAndUpdate(
    {
      _id: booking._id,
      technicianId: booking.technicianId,
      status: BookingStatus.ARRIVED,
      $or: [
        { inspection: { $exists: false } },
        { 'inspection.status': { $exists: false } },
        { 'inspection.status': InspectionStatus.NOT_STARTED },
      ],
    },
    {
      $set: {
        'inspection.status': InspectionStatus.IN_PROGRESS,
        'inspection.startedAt': now,
        'inspection.startedBy': new mongoose.Types.ObjectId(actorId(actor)),
        'inspection.reminderAcknowledgedAt': now,
        'inspection.reminderAcknowledgedBy': new mongoose.Types.ObjectId(actorId(actor)),
        'inspection.startLocation': buildPoint(reading),
        'workAuthorization.status': WorkAuthorizationStatus.AWAITING_INSPECTION,
        'workAuthorization.reasonCode': 'INSPECTION_NOT_COMPLETED',
        'workAuthorization.evaluatedAt': now,
      },
    },
    { new: true }
  );

  if (!updated) {
    const current = await loadBooking(bookingId);
    if (current.inspection?.status === InspectionStatus.IN_PROGRESS) return current;
    throw new InspectionWorkflowError('Inspection could not be started because booking state changed.', 'INSPECTION_START_CONFLICT', 409);
  }

  return updated;
};

export const completeInspectionForBooking = async (
  bookingId: string,
  actor: WorkflowActor | undefined,
  input: CompleteInspectionInput
): Promise<IBooking> => {
  validateInspectionGpsReading(input);
  const booking = await loadBooking(bookingId);

  if (!isAssignedTechnician(booking, actor) && !isAdmin(actor)) {
    throw new InspectionWorkflowError('Only the assigned technician can complete inspection.', 'UNAUTHORIZED_TECHNICIAN', 403);
  }
  if (booking.status !== BookingStatus.ARRIVED) {
    throw new InspectionWorkflowError('Inspection can be completed only while the booking is arrived.', 'BOOKING_NOT_ARRIVED', 409);
  }
  if (booking.inspection?.status === InspectionStatus.COMPLETED) {
    return booking;
  }
  if (booking.inspection?.status !== InspectionStatus.IN_PROGRESS) {
    throw new InspectionWorkflowError('Inspection must be started before it can be completed.', 'INSPECTION_NOT_STARTED', 409);
  }

  const diagnosisNotes = typeof input.diagnosisNotes === 'string' ? input.diagnosisNotes.trim() : '';
  if (!diagnosisNotes || diagnosisNotes.length > 4000) {
    throw new InspectionWorkflowError('Diagnosis notes are required and must be shorter than 4000 characters.', 'INVALID_DIAGNOSIS_NOTES');
  }
  if (typeof input.quoteRequired !== 'boolean') {
    throw new InspectionWorkflowError('quoteRequired must be true or false.', 'INVALID_QUOTE_REQUIRED');
  }

  const mediaIds = (input.evidenceMediaIds || []).filter((id) => mongoose.Types.ObjectId.isValid(id));
  if ((input.evidenceMediaIds || []).length !== mediaIds.length) {
    throw new InspectionWorkflowError('Invalid inspection media id.', 'INVALID_MEDIA_ID');
  }
  if (mediaIds.length) {
    const count = await JobMedia.countDocuments({
      _id: { $in: mediaIds.map((id) => new mongoose.Types.ObjectId(id)) },
      bookingId: booking._id,
      uploadedByUserId: new mongoose.Types.ObjectId(actorId(actor)),
    });
    if (count !== mediaIds.length) {
      throw new InspectionWorkflowError('One or more inspection images are not authorized for this booking.', 'MEDIA_OWNERSHIP_INVALID', 403);
    }
  }

  const partsRequired = normalizeParts(input.partsRequired);
  const now = new Date();
  const nextAuthorization = input.quoteRequired
    ? WorkAuthorizationStatus.AWAITING_QUOTE
    : WorkAuthorizationStatus.AWAITING_PAYMENT;
  const nextReason = input.quoteRequired ? 'QUOTE_REQUIRED' : 'PAYMENT_NOT_SECURED';

  const updated = await Booking.findOneAndUpdate(
    {
      _id: booking._id,
      technicianId: booking.technicianId,
      status: BookingStatus.ARRIVED,
      'inspection.status': InspectionStatus.IN_PROGRESS,
    },
    {
      $set: {
        'inspection.status': InspectionStatus.COMPLETED,
        'inspection.completedAt': now,
        'inspection.completedBy': new mongoose.Types.ObjectId(actorId(actor)),
        'inspection.completionLocation': buildPoint(input),
        'inspection.diagnosisNotes': diagnosisNotes,
        'inspection.technicalObservations': typeof input.technicalObservations === 'string' ? input.technicalObservations.trim().slice(0, 4000) : '',
        'inspection.partsRequired': partsRequired,
        'inspection.quoteRequired': input.quoteRequired,
        'inspection.evidenceMediaIds': mediaIds.map((id) => new mongoose.Types.ObjectId(id)),
        'workAuthorization.status': nextAuthorization,
        'workAuthorization.reasonCode': nextReason,
        'workAuthorization.evaluatedAt': now,
      },
    },
    { new: true }
  );

  if (!updated) {
    const current = await loadBooking(bookingId);
    if (current.inspection?.status === InspectionStatus.COMPLETED) return current;
    throw new InspectionWorkflowError('Inspection could not be completed because booking state changed.', 'INSPECTION_COMPLETE_CONFLICT', 409);
  }

  return updated;
};

export const evaluateWorkStartEligibility = async (
  bookingOrId: string | IBooking,
  actor?: WorkflowActor
): Promise<WorkStartEligibility> => {
  const booking = typeof bookingOrId === 'string' ? await loadBooking(bookingOrId) : bookingOrId;
  const roleAllows = isAssignedTechnician(booking, actor) || isAdmin(actor) || !actor;
  const inspectionStatus = booking.inspection?.status ?? InspectionStatus.NOT_STARTED;
  const pricingMode = booking.pricingMode ?? PricingMode.INSPECTION_AND_QUOTE;
  const inspectionRequired = pricingMode === PricingMode.INSPECTION_AND_QUOTE || inspectionStatus !== InspectionStatus.NOT_REQUIRED;
  const quoteRequired = Boolean(booking.inspection?.quoteRequired ?? pricingMode === PricingMode.INSPECTION_AND_QUOTE);
  const latestQuote = quoteRequired
    ? await JobQuote.findOne({
        bookingId: booking._id,
        status: { $nin: [QuoteStatus.CANCELLED, QuoteStatus.SUPERSEDED] },
      }).sort({ version: -1, createdAt: -1 }).lean()
    : null;

  const quoteSubmitted = !!latestQuote && [QuoteStatus.SUBMITTED, QuoteStatus.SENT_TO_CLIENT, QuoteStatus.APPROVED].includes(latestQuote.status);
  const quoteExpired = !!latestQuote?.expiresAt && new Date(latestQuote.expiresAt).getTime() < Date.now();
  const quoteApproved = !!latestQuote && latestQuote.status === QuoteStatus.APPROVED && !quoteExpired;
  const paymentRequired = booking.paymentStatus !== BookingPaymentStatus.NOT_REQUIRED;
  const paymentSecured = booking.paymentStatus === BookingPaymentStatus.SECURED;

  const requirements = {
    arrived: booking.status === BookingStatus.ARRIVED,
    inspectionRequired,
    inspectionStarted: inspectionStatus === InspectionStatus.IN_PROGRESS || inspectionStatus === InspectionStatus.COMPLETED || inspectionStatus === InspectionStatus.NOT_REQUIRED,
    inspectionComplete: !inspectionRequired || inspectionStatus === InspectionStatus.COMPLETED || inspectionStatus === InspectionStatus.NOT_REQUIRED,
    quoteRequired,
    quoteSubmitted,
    quoteApproved,
    quoteExpired,
    paymentRequired,
    paymentSecured,
  };

  const blocked = (reasonCode: WorkStartReasonCode): WorkStartEligibility => ({
    allowed: false,
    reasonCode,
    requirements,
  });

  if (!roleAllows) return blocked('UNAUTHORIZED_TECHNICIAN');
  if ([BookingStatus.COMPLETED, BookingStatus.CANCELLED].includes(booking.status)) return blocked('BOOKING_TERMINAL');
  if (booking.status === BookingStatus.IN_PROGRESS || booking.status === BookingStatus.DIAGNOSTIC_DONE) return blocked('BOOKING_ALREADY_IN_PROGRESS');
  if (booking.status !== BookingStatus.ARRIVED) return blocked('BOOKING_NOT_ARRIVED');
  if (inspectionRequired && inspectionStatus === InspectionStatus.NOT_STARTED) return blocked('INSPECTION_NOT_STARTED');
  if (inspectionRequired && inspectionStatus !== InspectionStatus.COMPLETED) return blocked('INSPECTION_NOT_COMPLETED');
  if (quoteRequired && !latestQuote) return blocked('QUOTE_REQUIRED');
  if (quoteRequired && !quoteSubmitted) return blocked('QUOTE_NOT_SUBMITTED');
  if (quoteRequired && quoteExpired) return blocked('QUOTE_EXPIRED');
  if (quoteRequired && !quoteApproved) return blocked('QUOTE_NOT_APPROVED');
  if (paymentRequired && !paymentSecured) return blocked('PAYMENT_NOT_SECURED');

  return { allowed: true, requirements };
};

export const persistWorkStartEligibility = async (
  booking: IBooking,
  eligibility: WorkStartEligibility
): Promise<void> => {
  await Booking.updateOne(
    { _id: booking._id },
    {
      $set: {
        'workAuthorization.status': eligibility.allowed ? WorkAuthorizationStatus.AUTHORIZED : mapReasonToAuthorizationStatus(eligibility.reasonCode),
        'workAuthorization.reasonCode': eligibility.reasonCode || '',
        'workAuthorization.requirements': eligibility.requirements,
        'workAuthorization.evaluatedAt': new Date(),
      },
    }
  );
};

const mapReasonToAuthorizationStatus = (reasonCode?: WorkStartReasonCode): WorkAuthorizationStatus => {
  switch (reasonCode) {
    case 'INSPECTION_NOT_STARTED':
    case 'INSPECTION_NOT_COMPLETED':
      return WorkAuthorizationStatus.AWAITING_INSPECTION;
    case 'QUOTE_REQUIRED':
    case 'QUOTE_NOT_SUBMITTED':
      return WorkAuthorizationStatus.AWAITING_QUOTE;
    case 'QUOTE_NOT_APPROVED':
    case 'QUOTE_EXPIRED':
      return WorkAuthorizationStatus.AWAITING_QUOTE_APPROVAL;
    case 'PAYMENT_REQUIRED':
    case 'PAYMENT_NOT_SECURED':
      return WorkAuthorizationStatus.AWAITING_PAYMENT;
    default:
      return WorkAuthorizationStatus.BLOCKED;
  }
};
