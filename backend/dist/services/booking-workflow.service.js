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
exports.findBookingForWorkflow = exports.confirmBookingArrival = exports.transitionBookingStatus = exports.getValidBookingTransitions = exports.BookingWorkflowError = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const booking_model_1 = __importStar(require("../models/booking.model"));
const user_model_1 = require("../models/user.model");
const booking_workflow_config_1 = require("../config/booking-workflow.config");
const routing_geo_1 = require("../modules/routing/routing.geo");
class BookingWorkflowError extends Error {
    statusCode;
    code;
    constructor(statusCode, message, code) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.name = 'BookingWorkflowError';
    }
}
exports.BookingWorkflowError = BookingWorkflowError;
const VALID_TRANSITIONS = {
    [booking_model_1.BookingStatus.PENDING]: [booking_model_1.BookingStatus.SCHEDULED, booking_model_1.BookingStatus.ACCEPTED, booking_model_1.BookingStatus.CANCELLED],
    [booking_model_1.BookingStatus.SCHEDULED]: [booking_model_1.BookingStatus.ACCEPTED, booking_model_1.BookingStatus.CANCELLED],
    [booking_model_1.BookingStatus.ACCEPTED]: [booking_model_1.BookingStatus.IN_ROUTE, booking_model_1.BookingStatus.CANCELLED],
    [booking_model_1.BookingStatus.IN_ROUTE]: [booking_model_1.BookingStatus.ARRIVED, booking_model_1.BookingStatus.CANCELLED],
    [booking_model_1.BookingStatus.ARRIVED]: [booking_model_1.BookingStatus.IN_PROGRESS, booking_model_1.BookingStatus.CANCELLED],
    [booking_model_1.BookingStatus.IN_PROGRESS]: [booking_model_1.BookingStatus.COMPLETED, booking_model_1.BookingStatus.CANCELLED],
    [booking_model_1.BookingStatus.DIAGNOSTIC_DONE]: [booking_model_1.BookingStatus.COMPLETED, booking_model_1.BookingStatus.CANCELLED],
    [booking_model_1.BookingStatus.COMPLETED]: [],
    [booking_model_1.BookingStatus.CANCELLED]: [],
};
const getValidBookingTransitions = () => VALID_TRANSITIONS;
exports.getValidBookingTransitions = getValidBookingTransitions;
const toUserId = (actor) => String(actor?.id ?? actor?._id ?? '').trim();
const isAssignedTechnician = (booking, userId) => Boolean(userId && String(booking.technicianId || '') === userId);
const isCustomer = (booking, userId) => Boolean(userId && String(booking.customerId || '') === userId);
const assertValidObjectId = (value, label) => {
    if (!mongoose_1.default.Types.ObjectId.isValid(value)) {
        throw new BookingWorkflowError(400, `Invalid ${label}.`, 'INVALID_ID');
    }
};
const assertTransition = (from, to) => {
    if (!(VALID_TRANSITIONS[from] || []).includes(to)) {
        throw new BookingWorkflowError(409, `Cannot move booking from ${from} to ${to}.`, 'INVALID_STATUS_TRANSITION');
    }
};
const assertAuthorizedTransition = (booking, actor, to, action) => {
    const userId = toUserId(actor);
    const role = (0, user_model_1.normalizeUserRole)(actor?.role);
    const admin = role === user_model_1.UserRole.ADMIN;
    const technician = isAssignedTechnician(booking, userId);
    const customer = isCustomer(booking, userId);
    if (admin)
        return;
    if (to === booking_model_1.BookingStatus.CANCELLED) {
        if (customer && booking.status !== booking_model_1.BookingStatus.IN_PROGRESS)
            return;
        if (technician && booking.status !== booking_model_1.BookingStatus.IN_PROGRESS)
            return;
        throw new BookingWorkflowError(403, 'This cancellation requires support review.', 'SUPPORT_REQUIRED');
    }
    if (action === 'START_ROUTE' || action === 'CONFIRM_ARRIVAL' || action === 'START_JOB' || action === 'COMPLETE_JOB') {
        if (technician)
            return;
    }
    throw new BookingWorkflowError(403, 'This account cannot update this booking status.', 'BOOKING_STATUS_FORBIDDEN');
};
const buildTimestampUpdate = (nextStatus, now = new Date()) => {
    const update = { status: nextStatus };
    if (nextStatus === booking_model_1.BookingStatus.SCHEDULED)
        update.scheduledAt = now;
    if (nextStatus === booking_model_1.BookingStatus.ACCEPTED)
        update.acceptedAt = now;
    if (nextStatus === booking_model_1.BookingStatus.IN_ROUTE) {
        update.inRouteAt = now;
        update.routeStartedAt = now;
    }
    if (nextStatus === booking_model_1.BookingStatus.ARRIVED)
        update.arrivedAt = now;
    if (nextStatus === booking_model_1.BookingStatus.IN_PROGRESS) {
        update.inProgressAt = now;
        update.workStartedAt = now;
    }
    if (nextStatus === booking_model_1.BookingStatus.COMPLETED)
        update.completedAt = now;
    if (nextStatus === booking_model_1.BookingStatus.CANCELLED) {
        update.cancelledAt = now;
        update['dispatch.status'] = booking_model_1.BookingDispatchStatus.CANCELLED;
    }
    return update;
};
const applyStatusTimestamps = (booking, nextStatus) => {
    const now = new Date();
    if (nextStatus === booking_model_1.BookingStatus.SCHEDULED)
        booking.scheduledAt = booking.scheduledAt ?? now;
    if (nextStatus === booking_model_1.BookingStatus.ACCEPTED)
        booking.acceptedAt = booking.acceptedAt ?? now;
    if (nextStatus === booking_model_1.BookingStatus.IN_ROUTE) {
        booking.inRouteAt = booking.inRouteAt ?? now;
        booking.routeStartedAt = booking.routeStartedAt ?? now;
    }
    if (nextStatus === booking_model_1.BookingStatus.ARRIVED)
        booking.arrivedAt = booking.arrivedAt ?? now;
    if (nextStatus === booking_model_1.BookingStatus.IN_PROGRESS) {
        booking.inProgressAt = booking.inProgressAt ?? now;
        booking.workStartedAt = booking.workStartedAt ?? now;
    }
    if (nextStatus === booking_model_1.BookingStatus.COMPLETED)
        booking.completedAt = booking.completedAt ?? now;
    if (nextStatus === booking_model_1.BookingStatus.CANCELLED) {
        booking.cancelledAt = booking.cancelledAt ?? now;
        booking.dispatch = {
            ...(booking.dispatch ?? {
                status: booking_model_1.BookingDispatchStatus.CANCELLED,
                sentToTechnicians: [],
                declinedByTechnicians: [],
            }),
            status: booking_model_1.BookingDispatchStatus.CANCELLED,
        };
    }
};
const buildActorFilter = (booking, actor, nextStatus, action) => {
    const userId = toUserId(actor);
    const role = (0, user_model_1.normalizeUserRole)(actor?.role);
    if (role === user_model_1.UserRole.ADMIN)
        return {};
    if (action === 'START_ROUTE' || action === 'CONFIRM_ARRIVAL' || action === 'START_JOB' || action === 'COMPLETE_JOB') {
        return { technicianId: new mongoose_1.default.Types.ObjectId(userId) };
    }
    if (nextStatus === booking_model_1.BookingStatus.CANCELLED && isCustomer(booking, userId)) {
        return { customerId: new mongoose_1.default.Types.ObjectId(userId) };
    }
    if (nextStatus === booking_model_1.BookingStatus.CANCELLED && isAssignedTechnician(booking, userId)) {
        return { technicianId: new mongoose_1.default.Types.ObjectId(userId) };
    }
    return {};
};
const transitionBookingStatus = async (input) => {
    const currentStatus = input.booking.status;
    assertTransition(currentStatus, input.nextStatus);
    assertAuthorizedTransition(input.booking, input.actor, input.nextStatus, input.action);
    const updated = await booking_model_1.default.findOneAndUpdate({
        _id: input.booking._id,
        status: currentStatus,
        ...buildActorFilter(input.booking, input.actor, input.nextStatus, input.action),
    }, {
        $set: buildTimestampUpdate(input.nextStatus),
    }, { new: true });
    if (!updated) {
        throw new BookingWorkflowError(409, 'Booking status changed before this action could complete.', 'STATUS_TRANSITION_CONFLICT');
    }
    return updated;
};
exports.transitionBookingStatus = transitionBookingStatus;
const isCoordinate = (latitude, longitude) => Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180;
const getArrivalConfirmation = (booking) => {
    const metadata = (booking.metadata ?? {});
    const existing = metadata.arrivalConfirmation;
    if (!existing || typeof existing !== 'object')
        return { readings: [] };
    const record = existing;
    return {
        readings: Array.isArray(record.readings)
            ? record.readings.filter((item) => {
                const reading = item;
                return (typeof reading.latitude === 'number' &&
                    typeof reading.longitude === 'number' &&
                    typeof reading.accuracyMeters === 'number' &&
                    typeof reading.recordedAt === 'string' &&
                    typeof reading.distanceMeters === 'number');
            })
            : [],
        ...(typeof record.confirmedAt === 'string' ? { confirmedAt: record.confirmedAt } : {}),
    };
};
const confirmBookingArrival = async (input) => {
    assertValidObjectId(input.bookingId, 'booking id');
    let booking = await booking_model_1.default.findById(input.bookingId);
    if (!booking)
        throw new BookingWorkflowError(404, 'Booking not found.', 'BOOKING_NOT_FOUND');
    const userId = toUserId(input.actor);
    if (!isAssignedTechnician(booking, userId) && (0, user_model_1.normalizeUserRole)(input.actor?.role) !== user_model_1.UserRole.ADMIN) {
        throw new BookingWorkflowError(403, 'Only the assigned technician can confirm arrival.', 'ARRIVAL_FORBIDDEN');
    }
    if (booking.status === booking_model_1.BookingStatus.ARRIVED) {
        return booking;
    }
    if (booking.status !== booking_model_1.BookingStatus.IN_ROUTE) {
        throw new BookingWorkflowError(409, 'Arrival can only be confirmed while the technician is in route.', 'ARRIVAL_INVALID_STATUS');
    }
    const { latitude, longitude, accuracyMeters, recordedAt } = input.reading;
    if (!isCoordinate(latitude, longitude)) {
        throw new BookingWorkflowError(400, 'Invalid GPS coordinates.', 'INVALID_COORDINATES');
    }
    if (!Number.isFinite(accuracyMeters) || accuracyMeters <= 0 || accuracyMeters > booking_workflow_config_1.bookingWorkflowConfig.arrivalMaxGpsAccuracyMeters) {
        throw new BookingWorkflowError(400, 'GPS accuracy is too low for arrival confirmation.', 'POOR_GPS_ACCURACY');
    }
    const now = Date.now();
    const recordedAtMs = recordedAt.getTime();
    if (!Number.isFinite(recordedAtMs)) {
        throw new BookingWorkflowError(400, 'Invalid GPS reading timestamp.', 'INVALID_RECORDED_AT');
    }
    if (recordedAtMs > now + booking_workflow_config_1.bookingWorkflowConfig.arrivalMaxFutureSkewSeconds * 1000) {
        throw new BookingWorkflowError(400, 'GPS reading timestamp is in the future.', 'GPS_READING_FUTURE');
    }
    if (now - recordedAtMs > booking_workflow_config_1.bookingWorkflowConfig.arrivalMaxReadingAgeSeconds * 1000) {
        throw new BookingWorkflowError(400, 'GPS reading is too old.', 'GPS_READING_STALE');
    }
    const [destinationLongitude, destinationLatitude] = booking.customerLocation.coordinates;
    if (!isCoordinate(destinationLatitude, destinationLongitude)) {
        throw new BookingWorkflowError(409, 'Booking service location is invalid.', 'INVALID_SERVICE_LOCATION');
    }
    const distanceMeters = (0, routing_geo_1.distanceMetersBetween)({ latitude, longitude }, { latitude: destinationLatitude, longitude: destinationLongitude });
    if (distanceMeters > booking_workflow_config_1.bookingWorkflowConfig.arrivalRadiusMeters) {
        throw new BookingWorkflowError(409, 'You are not within the service-location arrival radius.', 'OUTSIDE_ARRIVAL_RADIUS');
    }
    const confirmation = getArrivalConfirmation(booking);
    if (confirmation.readings.some((reading) => reading.recordedAt === recordedAt.toISOString())) {
        throw new BookingWorkflowError(409, 'This GPS reading has already been submitted.', 'ARRIVAL_REPLAYED_READING');
    }
    const previous = confirmation.readings[confirmation.readings.length - 1];
    if (previous) {
        const elapsedSeconds = Math.max(1, Math.abs(recordedAtMs - new Date(previous.recordedAt).getTime()) / 1000);
        const movedMeters = (0, routing_geo_1.distanceMetersBetween)({ latitude, longitude }, { latitude: previous.latitude, longitude: previous.longitude });
        if (movedMeters / elapsedSeconds > booking_workflow_config_1.bookingWorkflowConfig.arrivalImpossibleSpeedMetersPerSecond) {
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
    if (nextReadings.length < booking_workflow_config_1.bookingWorkflowConfig.arrivalRequiredReadings ||
        spanSeconds < booking_workflow_config_1.bookingWorkflowConfig.arrivalConfirmationSeconds) {
        await booking.save();
        throw new BookingWorkflowError(202, 'Arrival reading accepted. Please confirm again after a short moment.', 'ARRIVAL_MORE_READINGS_REQUIRED');
    }
    booking.metadata = {
        ...(booking.metadata ?? {}),
        arrivalConfirmation: {
            readings: nextReadings,
            updatedAt: new Date().toISOString(),
            confirmedAt: new Date().toISOString(),
        },
    };
    booking = await (0, exports.transitionBookingStatus)({
        booking,
        actor: input.actor,
        nextStatus: booking_model_1.BookingStatus.ARRIVED,
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
exports.confirmBookingArrival = confirmBookingArrival;
const findBookingForWorkflow = async (bookingId) => {
    assertValidObjectId(bookingId, 'booking id');
    const booking = await booking_model_1.default.findById(bookingId);
    if (!booking)
        throw new BookingWorkflowError(404, 'Booking not found.', 'BOOKING_NOT_FOUND');
    return booking;
};
exports.findBookingForWorkflow = findBookingForWorkflow;
//# sourceMappingURL=booking-workflow.service.js.map