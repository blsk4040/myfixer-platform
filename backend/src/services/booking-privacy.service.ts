import mongoose from 'mongoose';
import { BookingRecipientType, BookingStatus, IBooking } from '../models/booking.model';
import { getCompatibleServiceRecipient } from './booking-recipient.service';

export const POST_ASSIGNMENT_PRECISE_STATUSES = new Set<string>([
  BookingStatus.ACCEPTED,
  BookingStatus.IN_ROUTE,
  BookingStatus.ARRIVED,
  BookingStatus.IN_PROGRESS,
  BookingStatus.DIAGNOSTIC_DONE,
  BookingStatus.COMPLETED,
]);

interface BookingLike {
  id?: string;
  _id?: unknown;
  customerId?: unknown;
  customerName?: string;
  customerEmail?: string;
  technicianId?: unknown;
  serviceKey?: string;
  applianceType?: string;
  faultDescription?: string;
  fullAddress?: string;
  complexDetails?: string;
  generalArea?: string;
  customerLocation?: { coordinates?: [number, number] | number[] };
  priceMinor?: number;
  countryCode?: string;
  currency?: string;
  status?: string;
  paymentStatus?: string;
  inspection?: {
    status?: string;
    quoteRequired?: boolean;
  };
  workAuthorization?: {
    status?: string;
    reasonCode?: string;
  };
  scheduledAt?: Date | string | null;
  appointmentWindow?: {
    isPreBook?: boolean;
    scheduledStartTime?: Date | string | null;
    scheduledEndTime?: Date | string | null;
  };
  acceptedAt?: Date | string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  serviceRecipient?: any;
}

interface DistanceContext {
  distanceKm?: number;
  categoryMatch?: boolean;
}

const bookingId = (booking: BookingLike): string =>
  typeof booking.id === 'string' && booking.id ? booking.id : String(booking._id ?? '');

const asMinor = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

const problemSummary = (value: unknown): string => {
  const text = typeof value === 'string' ? value.trim() : '';
  const firstLine = text.split(/\r?\n/)[0]?.trim() || 'No description provided.';
  return firstLine.length > 180 ? `${firstLine.slice(0, 177)}...` : firstLine;
};

const coordinatesFromBooking = (booking: BookingLike): { latitude: number; longitude: number } | null => {
  const coordinates = booking.customerLocation?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length !== 2) return null;
  const [longitude, latitude] = coordinates;
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  return { latitude: Number(latitude), longitude: Number(longitude) };
};

export const serializeBookingForUnassignedTechnician = (
  booking: BookingLike,
  context: DistanceContext = {}
) => {
  const distanceKm = typeof context.distanceKm === 'number' && Number.isFinite(context.distanceKm)
    ? Math.round(context.distanceKm * 10) / 10
    : undefined;

  return {
    bookingId: bookingId(booking),
    id: bookingId(booking),
    serviceKey: booking.serviceKey,
    applianceType: booking.applianceType || 'Unknown Service',
    faultDescription: problemSummary(booking.faultDescription),
    problemSummary: problemSummary(booking.faultDescription),
    generalArea: booking.generalArea || 'Local Area',
    approximateArea: booking.generalArea || 'Local Area',
    priceMinor: asMinor(booking.priceMinor),
    callOutFee: asMinor(booking.priceMinor) / 100,
    countryCode: booking.countryCode || '',
    currency: booking.currency || 'ZAR',
    scheduledAt: booking.scheduledAt ?? null,
    distanceKm,
    distanceText: typeof distanceKm === 'number' ? `${distanceKm.toFixed(1)} km` : 'Nearby',
    categoryMatch: context.categoryMatch ?? true,
    hasPreciseLocation: false,
  };
};

export const serializeBookingForAssignedTechnician = (booking: BookingLike) => {
  const location = coordinatesFromBooking(booking);
  const recipient = getCompatibleServiceRecipient(booking);

  return {
    bookingId: bookingId(booking),
    id: bookingId(booking),
    customerId: String(booking.customerId || ''),
    customerName: booking.customerName || 'Client',
    serviceKey: booking.serviceKey,
    applianceType: booking.applianceType || 'Unknown Service',
    faultDescription: booking.faultDescription || 'No description provided.',
    fullAddress: booking.fullAddress || '',
    complexDetails: booking.complexDetails || '',
    generalArea: booking.generalArea || 'Local Area',
    priceMinor: asMinor(booking.priceMinor),
    callOutFee: asMinor(booking.priceMinor) / 100,
    countryCode: booking.countryCode || '',
    currency: booking.currency || 'ZAR',
    latitude: location?.latitude,
    longitude: location?.longitude,
    customerLocation: location,
    serviceLocation: location,
    serviceRecipient: recipient,
    customerPhone: recipient.phoneNumber || '',
    recipientPhone: recipient.phoneNumber || '',
    scheduledAt: booking.scheduledAt ?? booking.appointmentWindow?.scheduledStartTime ?? null,
    appointmentWindow: booking.appointmentWindow,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    inspectionStatus: booking.inspection?.status,
    quoteRequired: booking.inspection?.quoteRequired,
    workAuthorizationStatus: booking.workAuthorization?.status,
    workAuthorizationReason: booking.workAuthorization?.reasonCode,
    technicianId: booking.technicianId ? String(booking.technicianId) : null,
    hasPreciseLocation: true,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
  };
};

export const serializeBookingForOwner = (booking: IBooking) => {
  const assigned = serializeBookingForAssignedTechnician(booking);
  return {
    ...assigned,
    serviceRecipient: getCompatibleServiceRecipient(booking),
    acceptedAt: booking.acceptedAt,
    arrivedAt: booking.arrivedAt,
    workStartedAt: booking.workStartedAt,
    completedAt: booking.completedAt,
    cancelledAt: booking.cancelledAt,
  };
};

export const serializeBookingForAdmin = (booking: IBooking) => ({
  ...serializeBookingForOwner(booking),
  customerEmail: booking.customerEmail,
  metadata: booking.metadata,
});

export const isAssignedTechnicianWithPreciseAccess = (booking: BookingLike, technicianId: string): boolean => {
  if (!technicianId || !booking.technicianId) return false;
  if (String(booking.technicianId) !== technicianId) return false;
  return POST_ASSIGNMENT_PRECISE_STATUSES.has(String(booking.status || ''));
};

export const isBookingOwner = (booking: BookingLike, userId: string): boolean =>
  Boolean(userId && booking.customerId && String(booking.customerId) === userId);

export const canJoinPrivateBookingRoom = (
  booking: BookingLike,
  actorId: string,
  actorRole: string
): boolean => {
  if (!actorId) return false;
  if (actorRole === 'ADMIN') return true;
  if (actorRole === 'CUSTOMER') return isBookingOwner(booking, actorId);
  if (actorRole === 'TECHNICIAN') return isAssignedTechnicianWithPreciseAccess(booking, actorId);
  return false;
};

export const toObjectId = (value: string): mongoose.Types.ObjectId | null =>
  mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null;

export { BookingRecipientType };
