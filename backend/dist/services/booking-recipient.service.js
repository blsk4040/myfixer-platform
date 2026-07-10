"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCompatibleServiceRecipient = exports.normalizeServiceRecipient = exports.BookingRecipientValidationError = void 0;
const booking_model_1 = require("../models/booking.model");
class BookingRecipientValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'BookingRecipientValidationError';
    }
}
exports.BookingRecipientValidationError = BookingRecipientValidationError;
const trimString = (value, maxLength) => {
    const text = typeof value === 'string' ? value.trim() : '';
    return text.length > maxLength ? text.slice(0, maxLength) : text;
};
const requireText = (value, fieldName) => {
    if (!value.trim()) {
        throw new BookingRecipientValidationError(`${fieldName} is required.`);
    }
};
const assertMaxLength = (value, maxLength, fieldName) => {
    if (value.length > maxLength) {
        throw new BookingRecipientValidationError(`${fieldName} is too long.`);
    }
};
const isSafeEmail = (value) => !value || (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254);
const resolveInput = (body) => {
    const direct = body.service_recipient ??
        body.serviceRecipient ??
        body.recipient;
    if (direct && typeof direct === 'object')
        return direct;
    const isForSomeoneElse = body.is_for_someone_else === true || body.isForSomeoneElse === true;
    return {
        type: isForSomeoneElse ? booking_model_1.BookingRecipientType.OTHER : booking_model_1.BookingRecipientType.SELF,
        fullName: body.onsite_contact_name ?? body.contactName,
        phoneNumber: body.onsite_contact_phone ?? body.contactPhone,
    };
};
const normalizeType = (value) => {
    const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
    if (!normalized)
        return booking_model_1.BookingRecipientType.SELF;
    if (normalized === booking_model_1.BookingRecipientType.SELF || normalized === booking_model_1.BookingRecipientType.OTHER) {
        return normalized;
    }
    throw new BookingRecipientValidationError('Recipient type must be SELF or OTHER.');
};
const normalizeServiceRecipient = (body, context) => {
    const input = resolveInput(body);
    const type = normalizeType(input.type);
    const fallbackAddress = trimString(context.streetAddress || context.fullAddress, 240);
    const fallbackCity = trimString(context.city || context.customer.location?.city, 120);
    const fallbackCountry = trimString(context.customer.location?.country || context.countryCode, 120);
    if (type === booking_model_1.BookingRecipientType.SELF) {
        const fullName = trimString(input.fullName ?? input.name ?? context.customer.name, 120);
        const phoneNumber = trimString(input.phoneNumber ?? input.phone ?? context.customer.phone, 40);
        requireText(fullName, 'Recipient name');
        requireText(phoneNumber, 'Recipient phone number');
        return {
            type,
            fullName,
            phoneNumber,
            countryCode: trimString(input.countryCode ?? context.countryCode, 10),
            country: trimString(input.country ?? fallbackCountry, 120),
            city: fallbackCity,
            streetAddress: fallbackAddress,
            notes: trimString(input.notes, 1000),
            email: trimString(input.email, 254),
        };
    }
    if (!context.hasServiceCoordinates) {
        throw new BookingRecipientValidationError('Service coordinates are required for another recipient.');
    }
    const recipient = {
        type,
        fullName: trimString(input.fullName ?? input.name, 120),
        phoneNumber: trimString(input.phoneNumber ?? input.phone, 40),
        relationship: trimString(input.relationship, 80),
        email: trimString(input.email, 254),
        countryCode: trimString(input.countryCode, 10),
        country: trimString(input.country, 120),
        city: trimString(input.city, 120),
        streetAddress: trimString(input.streetAddress ?? input.address ?? fallbackAddress, 240),
        notes: trimString(input.notes, 1000),
    };
    requireText(recipient.fullName, 'Recipient name');
    requireText(recipient.phoneNumber, 'Recipient phone number');
    requireText(recipient.relationship || '', 'Recipient relationship');
    requireText(recipient.country || recipient.countryCode || '', 'Recipient country');
    requireText(recipient.city || '', 'Recipient city');
    requireText(recipient.streetAddress || '', 'Recipient street address');
    assertMaxLength(recipient.notes || '', 1000, 'Recipient notes');
    if (!isSafeEmail(recipient.email || '')) {
        throw new BookingRecipientValidationError('Recipient email is invalid.');
    }
    return recipient;
};
exports.normalizeServiceRecipient = normalizeServiceRecipient;
const getCompatibleServiceRecipient = (booking, fallbackPhone = '') => {
    if (booking.serviceRecipient?.type)
        return booking.serviceRecipient;
    return {
        type: booking_model_1.BookingRecipientType.SELF,
        fullName: booking.customerName || 'Client',
        phoneNumber: fallbackPhone,
        countryCode: booking.countryCode || '',
        city: booking.generalArea || '',
        streetAddress: booking.fullAddress || '',
    };
};
exports.getCompatibleServiceRecipient = getCompatibleServiceRecipient;
//# sourceMappingURL=booking-recipient.service.js.map