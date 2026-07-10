"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.persistWorkStartEligibility = exports.evaluateWorkStartEligibility = exports.completeInspectionForBooking = exports.startInspectionForBooking = exports.validateInspectionGpsReading = exports.InspectionWorkflowError = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const booking_model_1 = __importStar(require("../models/booking.model"));
const job_media_model_1 = __importDefault(require("../models/job-media.model"));
const quote_model_1 = __importStar(require("../models/quote.model"));
const user_model_1 = require("../models/user.model");
class InspectionWorkflowError extends Error {
    code;
    statusCode;
    constructor(message, code, statusCode = 400) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
    }
}
exports.InspectionWorkflowError = InspectionWorkflowError;
const MAX_GPS_ACCURACY_METERS = Number(process.env.ARRIVAL_MAX_GPS_ACCURACY_METERS ?? 50);
const MAX_READING_AGE_SECONDS = Number(process.env.ARRIVAL_MAX_READING_AGE_SECONDS ?? 30);
const MAX_FUTURE_SECONDS = 60;
const MAX_PARTS = 30;
const actorId = (actor) => String(actor?.id ?? actor?._id ?? '').trim();
const isAdmin = (actor) => (0, user_model_1.normalizeUserRole)(actor?.role) === user_model_1.UserRole.ADMIN;
const isAssignedTechnician = (booking, actor) => {
    const id = actorId(actor);
    return !!id && String(booking.technicianId || '') === id;
};
const validateInspectionGpsReading = (reading) => {
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
exports.validateInspectionGpsReading = validateInspectionGpsReading;
const normalizeParts = (parts = []) => {
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
const buildPoint = (reading) => ({
    type: 'Point',
    coordinates: [reading.longitude, reading.latitude],
    accuracyMeters: reading.accuracyMeters,
});
const loadBooking = async (bookingId) => {
    if (!mongoose_1.default.Types.ObjectId.isValid(bookingId)) {
        throw new InspectionWorkflowError('Invalid booking id.', 'INVALID_BOOKING_ID', 400);
    }
    const booking = await booking_model_1.default.findById(bookingId);
    if (!booking) {
        throw new InspectionWorkflowError('Booking not found.', 'BOOKING_NOT_FOUND', 404);
    }
    return booking;
};
const startInspectionForBooking = async (bookingId, actor, reading, acknowledgePlatformRules) => {
    (0, exports.validateInspectionGpsReading)(reading);
    const booking = await loadBooking(bookingId);
    if (!isAssignedTechnician(booking, actor) && !isAdmin(actor)) {
        throw new InspectionWorkflowError('Only the assigned technician can start inspection.', 'UNAUTHORIZED_TECHNICIAN', 403);
    }
    if (booking.status !== booking_model_1.BookingStatus.ARRIVED || !booking.arrivedAt) {
        throw new InspectionWorkflowError('Inspection can start only after backend-confirmed arrival.', 'BOOKING_NOT_ARRIVED', 409);
    }
    if (booking.inspection?.status === booking_model_1.InspectionStatus.COMPLETED) {
        throw new InspectionWorkflowError('Inspection is already completed.', 'INSPECTION_ALREADY_COMPLETED', 409);
    }
    if (booking.inspection?.status === booking_model_1.InspectionStatus.IN_PROGRESS) {
        return booking;
    }
    if (!acknowledgePlatformRules) {
        throw new InspectionWorkflowError('The platform payment and approval reminder must be acknowledged.', 'INSPECTION_ACK_REQUIRED', 400);
    }
    const now = new Date();
    const updated = await booking_model_1.default.findOneAndUpdate({
        _id: booking._id,
        technicianId: booking.technicianId,
        status: booking_model_1.BookingStatus.ARRIVED,
        $or: [
            { inspection: { $exists: false } },
            { 'inspection.status': { $exists: false } },
            { 'inspection.status': booking_model_1.InspectionStatus.NOT_STARTED },
        ],
    }, {
        $set: {
            'inspection.status': booking_model_1.InspectionStatus.IN_PROGRESS,
            'inspection.startedAt': now,
            'inspection.startedBy': new mongoose_1.default.Types.ObjectId(actorId(actor)),
            'inspection.reminderAcknowledgedAt': now,
            'inspection.reminderAcknowledgedBy': new mongoose_1.default.Types.ObjectId(actorId(actor)),
            'inspection.startLocation': buildPoint(reading),
            'workAuthorization.status': booking_model_1.WorkAuthorizationStatus.AWAITING_INSPECTION,
            'workAuthorization.reasonCode': 'INSPECTION_NOT_COMPLETED',
            'workAuthorization.evaluatedAt': now,
        },
    }, { new: true });
    if (!updated) {
        const current = await loadBooking(bookingId);
        if (current.inspection?.status === booking_model_1.InspectionStatus.IN_PROGRESS)
            return current;
        throw new InspectionWorkflowError('Inspection could not be started because booking state changed.', 'INSPECTION_START_CONFLICT', 409);
    }
    return updated;
};
exports.startInspectionForBooking = startInspectionForBooking;
const completeInspectionForBooking = async (bookingId, actor, input) => {
    (0, exports.validateInspectionGpsReading)(input);
    const booking = await loadBooking(bookingId);
    if (!isAssignedTechnician(booking, actor) && !isAdmin(actor)) {
        throw new InspectionWorkflowError('Only the assigned technician can complete inspection.', 'UNAUTHORIZED_TECHNICIAN', 403);
    }
    if (booking.status !== booking_model_1.BookingStatus.ARRIVED) {
        throw new InspectionWorkflowError('Inspection can be completed only while the booking is arrived.', 'BOOKING_NOT_ARRIVED', 409);
    }
    if (booking.inspection?.status === booking_model_1.InspectionStatus.COMPLETED) {
        return booking;
    }
    if (booking.inspection?.status !== booking_model_1.InspectionStatus.IN_PROGRESS) {
        throw new InspectionWorkflowError('Inspection must be started before it can be completed.', 'INSPECTION_NOT_STARTED', 409);
    }
    const diagnosisNotes = typeof input.diagnosisNotes === 'string' ? input.diagnosisNotes.trim() : '';
    if (!diagnosisNotes || diagnosisNotes.length > 4000) {
        throw new InspectionWorkflowError('Diagnosis notes are required and must be shorter than 4000 characters.', 'INVALID_DIAGNOSIS_NOTES');
    }
    if (typeof input.quoteRequired !== 'boolean') {
        throw new InspectionWorkflowError('quoteRequired must be true or false.', 'INVALID_QUOTE_REQUIRED');
    }
    const mediaIds = (input.evidenceMediaIds || []).filter((id) => mongoose_1.default.Types.ObjectId.isValid(id));
    if ((input.evidenceMediaIds || []).length !== mediaIds.length) {
        throw new InspectionWorkflowError('Invalid inspection media id.', 'INVALID_MEDIA_ID');
    }
    if (mediaIds.length) {
        const count = await job_media_model_1.default.countDocuments({
            _id: { $in: mediaIds.map((id) => new mongoose_1.default.Types.ObjectId(id)) },
            bookingId: booking._id,
            uploadedByUserId: new mongoose_1.default.Types.ObjectId(actorId(actor)),
        });
        if (count !== mediaIds.length) {
            throw new InspectionWorkflowError('One or more inspection images are not authorized for this booking.', 'MEDIA_OWNERSHIP_INVALID', 403);
        }
    }
    const partsRequired = normalizeParts(input.partsRequired);
    const now = new Date();
    const nextAuthorization = input.quoteRequired
        ? booking_model_1.WorkAuthorizationStatus.AWAITING_QUOTE
        : booking_model_1.WorkAuthorizationStatus.AWAITING_PAYMENT;
    const nextReason = input.quoteRequired ? 'QUOTE_REQUIRED' : 'PAYMENT_NOT_SECURED';
    const updated = await booking_model_1.default.findOneAndUpdate({
        _id: booking._id,
        technicianId: booking.technicianId,
        status: booking_model_1.BookingStatus.ARRIVED,
        'inspection.status': booking_model_1.InspectionStatus.IN_PROGRESS,
    }, {
        $set: {
            'inspection.status': booking_model_1.InspectionStatus.COMPLETED,
            'inspection.completedAt': now,
            'inspection.completedBy': new mongoose_1.default.Types.ObjectId(actorId(actor)),
            'inspection.completionLocation': buildPoint(input),
            'inspection.diagnosisNotes': diagnosisNotes,
            'inspection.technicalObservations': typeof input.technicalObservations === 'string' ? input.technicalObservations.trim().slice(0, 4000) : '',
            'inspection.partsRequired': partsRequired,
            'inspection.quoteRequired': input.quoteRequired,
            'inspection.evidenceMediaIds': mediaIds.map((id) => new mongoose_1.default.Types.ObjectId(id)),
            'workAuthorization.status': nextAuthorization,
            'workAuthorization.reasonCode': nextReason,
            'workAuthorization.evaluatedAt': now,
        },
    }, { new: true });
    if (!updated) {
        const current = await loadBooking(bookingId);
        if (current.inspection?.status === booking_model_1.InspectionStatus.COMPLETED)
            return current;
        throw new InspectionWorkflowError('Inspection could not be completed because booking state changed.', 'INSPECTION_COMPLETE_CONFLICT', 409);
    }
    return updated;
};
exports.completeInspectionForBooking = completeInspectionForBooking;
const evaluateWorkStartEligibility = async (bookingOrId, actor) => {
    const booking = typeof bookingOrId === 'string' ? await loadBooking(bookingOrId) : bookingOrId;
    const roleAllows = isAssignedTechnician(booking, actor) || isAdmin(actor) || !actor;
    const inspectionStatus = booking.inspection?.status ?? booking_model_1.InspectionStatus.NOT_STARTED;
    const pricingMode = booking.pricingMode ?? booking_model_1.PricingMode.INSPECTION_AND_QUOTE;
    const inspectionRequired = pricingMode === booking_model_1.PricingMode.INSPECTION_AND_QUOTE || inspectionStatus !== booking_model_1.InspectionStatus.NOT_REQUIRED;
    const quoteRequired = Boolean(booking.inspection?.quoteRequired ?? pricingMode === booking_model_1.PricingMode.INSPECTION_AND_QUOTE);
    const latestQuote = quoteRequired
        ? await quote_model_1.default.findOne({
            bookingId: booking._id,
            status: { $nin: [quote_model_1.QuoteStatus.CANCELLED, quote_model_1.QuoteStatus.SUPERSEDED] },
        }).sort({ version: -1, createdAt: -1 }).lean()
        : null;
    const quoteSubmitted = !!latestQuote && [quote_model_1.QuoteStatus.SUBMITTED, quote_model_1.QuoteStatus.SENT_TO_CLIENT, quote_model_1.QuoteStatus.APPROVED].includes(latestQuote.status);
    const quoteExpired = !!latestQuote?.expiresAt && new Date(latestQuote.expiresAt).getTime() < Date.now();
    const quoteApproved = !!latestQuote && latestQuote.status === quote_model_1.QuoteStatus.APPROVED && !quoteExpired;
    const paymentRequired = booking.paymentStatus !== booking_model_1.BookingPaymentStatus.NOT_REQUIRED;
    const paymentSecured = booking.paymentStatus === booking_model_1.BookingPaymentStatus.SECURED;
    const requirements = {
        arrived: booking.status === booking_model_1.BookingStatus.ARRIVED,
        inspectionRequired,
        inspectionStarted: inspectionStatus === booking_model_1.InspectionStatus.IN_PROGRESS || inspectionStatus === booking_model_1.InspectionStatus.COMPLETED || inspectionStatus === booking_model_1.InspectionStatus.NOT_REQUIRED,
        inspectionComplete: !inspectionRequired || inspectionStatus === booking_model_1.InspectionStatus.COMPLETED || inspectionStatus === booking_model_1.InspectionStatus.NOT_REQUIRED,
        quoteRequired,
        quoteSubmitted,
        quoteApproved,
        quoteExpired,
        paymentRequired,
        paymentSecured,
    };
    const blocked = (reasonCode) => ({
        allowed: false,
        reasonCode,
        requirements,
    });
    if (!roleAllows)
        return blocked('UNAUTHORIZED_TECHNICIAN');
    if ([booking_model_1.BookingStatus.COMPLETED, booking_model_1.BookingStatus.CANCELLED].includes(booking.status))
        return blocked('BOOKING_TERMINAL');
    if (booking.status === booking_model_1.BookingStatus.IN_PROGRESS || booking.status === booking_model_1.BookingStatus.DIAGNOSTIC_DONE)
        return blocked('BOOKING_ALREADY_IN_PROGRESS');
    if (booking.status !== booking_model_1.BookingStatus.ARRIVED)
        return blocked('BOOKING_NOT_ARRIVED');
    if (inspectionRequired && inspectionStatus === booking_model_1.InspectionStatus.NOT_STARTED)
        return blocked('INSPECTION_NOT_STARTED');
    if (inspectionRequired && inspectionStatus !== booking_model_1.InspectionStatus.COMPLETED)
        return blocked('INSPECTION_NOT_COMPLETED');
    if (quoteRequired && !latestQuote)
        return blocked('QUOTE_REQUIRED');
    if (quoteRequired && !quoteSubmitted)
        return blocked('QUOTE_NOT_SUBMITTED');
    if (quoteRequired && quoteExpired)
        return blocked('QUOTE_EXPIRED');
    if (quoteRequired && !quoteApproved)
        return blocked('QUOTE_NOT_APPROVED');
    if (paymentRequired && !paymentSecured)
        return blocked('PAYMENT_NOT_SECURED');
    return { allowed: true, requirements };
};
exports.evaluateWorkStartEligibility = evaluateWorkStartEligibility;
const persistWorkStartEligibility = async (booking, eligibility) => {
    await booking_model_1.default.updateOne({ _id: booking._id }, {
        $set: {
            'workAuthorization.status': eligibility.allowed ? booking_model_1.WorkAuthorizationStatus.AUTHORIZED : mapReasonToAuthorizationStatus(eligibility.reasonCode),
            'workAuthorization.reasonCode': eligibility.reasonCode || '',
            'workAuthorization.requirements': eligibility.requirements,
            'workAuthorization.evaluatedAt': new Date(),
        },
    });
};
exports.persistWorkStartEligibility = persistWorkStartEligibility;
const mapReasonToAuthorizationStatus = (reasonCode) => {
    switch (reasonCode) {
        case 'INSPECTION_NOT_STARTED':
        case 'INSPECTION_NOT_COMPLETED':
            return booking_model_1.WorkAuthorizationStatus.AWAITING_INSPECTION;
        case 'QUOTE_REQUIRED':
        case 'QUOTE_NOT_SUBMITTED':
            return booking_model_1.WorkAuthorizationStatus.AWAITING_QUOTE;
        case 'QUOTE_NOT_APPROVED':
        case 'QUOTE_EXPIRED':
            return booking_model_1.WorkAuthorizationStatus.AWAITING_QUOTE_APPROVAL;
        case 'PAYMENT_REQUIRED':
        case 'PAYMENT_NOT_SECURED':
            return booking_model_1.WorkAuthorizationStatus.AWAITING_PAYMENT;
        default:
            return booking_model_1.WorkAuthorizationStatus.BLOCKED;
    }
};
//# sourceMappingURL=inspection-workflow.service.js.map