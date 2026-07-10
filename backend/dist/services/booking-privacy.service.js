"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingRecipientType = exports.toObjectId = exports.canJoinPrivateBookingRoom = exports.isBookingOwner = exports.isAssignedTechnicianWithPreciseAccess = exports.serializeBookingForAdmin = exports.serializeBookingForOwner = exports.serializeBookingForAssignedTechnician = exports.serializeBookingForUnassignedTechnician = exports.POST_ASSIGNMENT_PRECISE_STATUSES = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const booking_model_1 = require("../models/booking.model");
Object.defineProperty(exports, "BookingRecipientType", { enumerable: true, get: function () { return booking_model_1.BookingRecipientType; } });
const booking_recipient_service_1 = require("./booking-recipient.service");
exports.POST_ASSIGNMENT_PRECISE_STATUSES = new Set([
    booking_model_1.BookingStatus.ACCEPTED,
    booking_model_1.BookingStatus.IN_ROUTE,
    booking_model_1.BookingStatus.ARRIVED,
    booking_model_1.BookingStatus.IN_PROGRESS,
    booking_model_1.BookingStatus.DIAGNOSTIC_DONE,
    booking_model_1.BookingStatus.COMPLETED,
]);
const bookingId = (booking) => typeof booking.id === 'string' && booking.id ? booking.id : String(booking._id ?? '');
const asMinor = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
const problemSummary = (value) => {
    const text = typeof value === 'string' ? value.trim() : '';
    const firstLine = text.split(/\r?\n/)[0]?.trim() || 'No description provided.';
    return firstLine.length > 180 ? `${firstLine.slice(0, 177)}...` : firstLine;
};
const coordinatesFromBooking = (booking) => {
    const coordinates = booking.customerLocation?.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length !== 2)
        return null;
    const [longitude, latitude] = coordinates;
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude))
        return null;
    return { latitude: Number(latitude), longitude: Number(longitude) };
};
const serializeBookingForUnassignedTechnician = (booking, context = {}) => {
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
exports.serializeBookingForUnassignedTechnician = serializeBookingForUnassignedTechnician;
const serializeBookingForAssignedTechnician = (booking) => {
    const location = coordinatesFromBooking(booking);
    const recipient = (0, booking_recipient_service_1.getCompatibleServiceRecipient)(booking);
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
        scheduledAt: booking.scheduledAt ?? null,
        status: booking.status,
        technicianId: booking.technicianId ? String(booking.technicianId) : null,
        hasPreciseLocation: true,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
    };
};
exports.serializeBookingForAssignedTechnician = serializeBookingForAssignedTechnician;
const serializeBookingForOwner = (booking) => {
    const assigned = (0, exports.serializeBookingForAssignedTechnician)(booking);
    return {
        ...assigned,
        serviceRecipient: (0, booking_recipient_service_1.getCompatibleServiceRecipient)(booking),
        acceptedAt: booking.acceptedAt,
        arrivedAt: booking.arrivedAt,
        workStartedAt: booking.workStartedAt,
        completedAt: booking.completedAt,
        cancelledAt: booking.cancelledAt,
    };
};
exports.serializeBookingForOwner = serializeBookingForOwner;
const serializeBookingForAdmin = (booking) => ({
    ...(0, exports.serializeBookingForOwner)(booking),
    customerEmail: booking.customerEmail,
    metadata: booking.metadata,
});
exports.serializeBookingForAdmin = serializeBookingForAdmin;
const isAssignedTechnicianWithPreciseAccess = (booking, technicianId) => {
    if (!technicianId || !booking.technicianId)
        return false;
    if (String(booking.technicianId) !== technicianId)
        return false;
    return exports.POST_ASSIGNMENT_PRECISE_STATUSES.has(String(booking.status || ''));
};
exports.isAssignedTechnicianWithPreciseAccess = isAssignedTechnicianWithPreciseAccess;
const isBookingOwner = (booking, userId) => Boolean(userId && booking.customerId && String(booking.customerId) === userId);
exports.isBookingOwner = isBookingOwner;
const canJoinPrivateBookingRoom = (booking, actorId, actorRole) => {
    if (!actorId)
        return false;
    if (actorRole === 'ADMIN')
        return true;
    if (actorRole === 'CUSTOMER')
        return (0, exports.isBookingOwner)(booking, actorId);
    if (actorRole === 'TECHNICIAN')
        return (0, exports.isAssignedTechnicianWithPreciseAccess)(booking, actorId);
    return false;
};
exports.canJoinPrivateBookingRoom = canJoinPrivateBookingRoom;
const toObjectId = (value) => mongoose_1.default.Types.ObjectId.isValid(value) ? new mongoose_1.default.Types.ObjectId(value) : null;
exports.toObjectId = toObjectId;
//# sourceMappingURL=booking-privacy.service.js.map