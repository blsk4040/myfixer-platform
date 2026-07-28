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
exports.processStandbyDispatchRetry = exports.scheduleStandbyDispatchRetry = exports.recordDispatchWave = exports.nextDispatchWave = exports.notifyTechniciansForBooking = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const booking_model_1 = __importStar(require("../models/booking.model"));
const notification_model_1 = require("../models/notification.model");
const redis_1 = require("../config/redis");
const booking_privacy_service_1 = require("./booking-privacy.service");
const matching_service_1 = __importStar(require("./matching.service"));
const notification_service_1 = require("./notification.service");
const metrics_service_1 = require("./metrics.service");
const worker_queue_service_1 = require("./worker-queue.service");
const redis_emitter_1 = require("../sockets/redis-emitter");
const STANDBY_RETRY_INTERVAL_MS = 60 * 1000;
const STANDBY_RETRY_WINDOW_MS = 15 * 60 * 1000;
const DISPATCH_WAVE_SIZE = 3;
const DISPATCH_RETRY_LOCK_TTL_MS = 45 * 1000;
const getSocketIdentity = (socket) => {
    const query = socket.handshake.query;
    const candidate = query.technicianId ??
        query.technician_id ??
        query.userId ??
        query.user_id ??
        socket.handshake.auth?.technicianId ??
        socket.data?.technicianId;
    if (Array.isArray(candidate)) {
        return candidate[0] ?? null;
    }
    return typeof candidate === 'string' ? candidate : null;
};
const isSocketDebugEnabled = () => process.env.NODE_ENV !== 'production' || process.env.SOCKET_DEBUG === 'true';
const logSocketDebug = (message, metadata) => {
    if (!isSocketDebugEnabled())
        return;
    console.info(`[tech-socket-debug] ${message}`, metadata ?? '');
};
const stripScheduleMarker = (value) => {
    const text = typeof value === 'string' ? value.trim() : '';
    return text.replace(/\s*\((ASAP|Urgent \/ Right Now|[^)]*\d{1,2}:\d{2}[^)]*)\)\s*$/i, '').trim() || text || 'service';
};
const providerRoleForService = (serviceKey) => {
    const key = (0, matching_service_1.normalizeDispatchServiceKey)(serviceKey);
    if (key === 'cleaning')
        return 'cleaner';
    if (key === 'plumbing')
        return 'plumber';
    if (key === 'electrical')
        return 'electrician';
    if (key === 'gardening')
        return 'gardener';
    if (key === 'painting')
        return 'painter';
    if (key === 'automotive')
        return 'mechanic';
    return 'technician';
};
const serviceLabelForNotification = (booking) => stripScheduleMarker(booking.applianceType || booking.metadata?.serviceKey || booking.serviceKey || 'service');
const buildIncomingRequestPayload = (booking) => (0, booking_privacy_service_1.serializeBookingForUnassignedTechnician)(booking, { categoryMatch: true });
const createCustomerBookingNotification = async (booking, eventType, title, message, metadata = {}) => {
    const customerId = String(booking.customerId || '').trim();
    if (!mongoose_1.default.Types.ObjectId.isValid(customerId))
        return [];
    return (0, notification_service_1.createNotifications)({
        userId: customerId,
        email: booking.customerEmail || '',
        name: booking.customerName || 'Client',
        channels: [notification_model_1.NotificationChannel.IN_APP, notification_model_1.NotificationChannel.PUSH],
        type: eventType,
        title,
        message,
        metadata: {
            bookingId: typeof booking.id === 'string' ? booking.id : String(booking._id || ''),
            applianceType: booking.applianceType || '',
            status: booking.status || '',
            ...metadata,
        },
    });
};
const createTechnicianJobNotification = async (technicianId, booking) => {
    if (!mongoose_1.default.Types.ObjectId.isValid(technicianId))
        return [];
    return (0, notification_service_1.createNotifications)({
        userId: technicianId,
        channels: [notification_model_1.NotificationChannel.PUSH],
        type: 'NEW_JOB_REQUEST',
        title: 'New job request',
        message: `${booking.applianceType || 'Service request'} in ${booking.generalArea || 'your area'}.`,
        metadata: {
            bookingId: typeof booking.id === 'string' ? booking.id : String(booking._id || ''),
            applianceType: booking.applianceType || '',
            priceMinor: booking.priceMinor,
            currency: booking.currency,
        },
    });
};
const emitIncomingRequest = async (io, technicianId, payload) => {
    const room = `technician:${technicianId}`;
    if (!io) {
        await (0, redis_emitter_1.emitSocketRoomEvent)(room, 'incoming_request', payload);
        return;
    }
    io.to(room).emit('incoming_request', payload);
    const sockets = await io.fetchSockets();
    const matchingSockets = sockets.filter((socket) => getSocketIdentity(socket) === technicianId);
    logSocketDebug('booking broadcast targeting technician', {
        technicianId,
        matchingSocketCount: matchingSockets.length,
        room,
    });
    matchingSockets.forEach((socket) => {
        socket.emit('incoming_request', payload);
    });
};
const notifyTechniciansForBooking = async (io, booking, technicianIds) => {
    if (!technicianIds.length)
        return;
    const incomingRequestPayload = buildIncomingRequestPayload(booking);
    await Promise.all(technicianIds.map((technicianId) => emitIncomingRequest(io, technicianId, incomingRequestPayload)));
    await Promise.all(technicianIds.map(async (technicianId) => {
        const jobs = await matching_service_1.default.findNearbyPendingBookingsForTechnician(technicianId);
        const room = `technician:${technicianId}`;
        if (io) {
            io.to(room).emit('available_jobs', jobs);
        }
        else {
            await (0, redis_emitter_1.emitSocketRoomEvent)(room, 'available_jobs', jobs);
        }
    }));
    await Promise.all(technicianIds.map((technicianId) => createTechnicianJobNotification(technicianId, booking)));
};
exports.notifyTechniciansForBooking = notifyTechniciansForBooking;
const nextDispatchWave = (booking, candidates, waveSize = DISPATCH_WAVE_SIZE) => {
    const alreadyInvited = new Set((booking.dispatch?.sentToTechnicians || []).map((id) => id.toString()));
    const alreadyAttempted = new Set((booking.dispatch?.attempts || []).map((attempt) => attempt.technicianId.toString()));
    const declined = new Set((booking.dispatch?.declinedByTechnicians || []).map((id) => id.toString()));
    const wave = Number(booking.dispatch?.currentWave || 0) + 1;
    return {
        wave,
        candidates: candidates
            .filter((candidate) => !alreadyInvited.has(candidate.technicianId) &&
            !alreadyAttempted.has(candidate.technicianId) &&
            !declined.has(candidate.technicianId))
            .slice(0, waveSize),
    };
};
exports.nextDispatchWave = nextDispatchWave;
const recordDispatchWave = (booking, candidates, wave, status, expiresAt) => {
    const technicianIds = candidates.map((candidate) => candidate.technicianId);
    const sentToTechnicians = [
        ...(booking.dispatch?.sentToTechnicians || []),
        ...technicianIds.map((technicianId) => new mongoose_1.default.Types.ObjectId(technicianId)),
    ];
    const attempts = [
        ...(booking.dispatch?.attempts || []),
        ...candidates.map((candidate) => ({
            technicianId: new mongoose_1.default.Types.ObjectId(candidate.technicianId),
            wave,
            status: 'SENT',
            distanceKm: candidate.distanceKm,
            score: candidate.score,
            reason: 'ranked_dispatch_wave',
            sentAt: new Date(),
            respondedAt: null,
        })),
    ];
    booking.dispatch = {
        ...(booking.dispatch ?? {
            declinedByTechnicians: [],
            preferredTechnicianId: null,
        }),
        status,
        expiresAt: expiresAt ?? booking.dispatch?.expiresAt ?? matching_service_1.default.getDispatchExpiry(booking),
        sentToTechnicians,
        declinedByTechnicians: booking.dispatch?.declinedByTechnicians || [],
        acceptedByTechnician: booking.dispatch?.acceptedByTechnician ?? null,
        preferredTechnicianId: booking.dispatch?.preferredTechnicianId ?? null,
        currentWave: wave,
        nextRetryAt: [booking_model_1.BookingDispatchStatus.BROADCASTING, booking_model_1.BookingDispatchStatus.STANDBY].includes(status)
            ? new Date(Date.now() + STANDBY_RETRY_INTERVAL_MS)
            : null,
        attempts,
    };
    booking.set('metadata.dispatchEngine', 'RANKED_PROGRESSIVE_WAVES_V1');
    booking.set('metadata.lastDispatchWave', wave);
    return technicianIds;
};
exports.recordDispatchWave = recordDispatchWave;
const acquireDispatchRetryLock = async (bookingId) => {
    const redis = await (0, redis_1.connectRedis)();
    if (!redis)
        return `local-${process.pid}-${Date.now()}`;
    const token = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const result = await redis.set(`padi:dispatch-retry-lock:${bookingId}`, token, 'PX', DISPATCH_RETRY_LOCK_TTL_MS, 'NX');
    return result === 'OK' ? token : null;
};
const releaseDispatchRetryLock = async (bookingId, token) => {
    if (token.startsWith('local-'))
        return;
    const redis = await (0, redis_1.connectRedis)();
    if (!redis)
        return;
    const key = `padi:dispatch-retry-lock:${bookingId}`;
    const currentToken = await redis.get(key);
    if (currentToken === token) {
        await redis.del(key);
    }
};
const scheduleStandbyDispatchRetry = async (input) => {
    const retryUntil = input.retryUntil ?? new Date(Date.now() + STANDBY_RETRY_WINDOW_MS);
    if (!mongoose_1.default.Types.ObjectId.isValid(input.bookingId))
        return;
    if ((0, worker_queue_service_1.isWorkerQueueEnabled)()) {
        const queued = await (0, worker_queue_service_1.enqueueWorkerTask)({
            name: worker_queue_service_1.WorkerQueueName.DISPATCH_RETRY,
            id: input.bookingId,
            payload: {
                retryUntil: retryUntil.toISOString(),
            },
            runAt: new Date(Date.now() + STANDBY_RETRY_INTERVAL_MS).toISOString(),
        });
        if (queued) {
            (0, metrics_service_1.incrementMetric)('dispatch_retry_scheduled_total', { mode: 'worker' });
            return;
        }
    }
    const timer = setTimeout(() => {
        (0, exports.processStandbyDispatchRetry)({
            bookingId: input.bookingId,
            io: input.io,
            retryUntil,
        }).catch((error) => {
            console.error('Failed to retry standby dispatch:', error);
        });
    }, STANDBY_RETRY_INTERVAL_MS);
    timer.unref?.();
    (0, metrics_service_1.incrementMetric)('dispatch_retry_scheduled_total', { mode: 'local_timer' });
};
exports.scheduleStandbyDispatchRetry = scheduleStandbyDispatchRetry;
const processStandbyDispatchRetry = async (input) => {
    const bookingId = input.bookingId;
    if (!mongoose_1.default.Types.ObjectId.isValid(bookingId))
        return;
    const lockToken = await acquireDispatchRetryLock(bookingId);
    if (!lockToken) {
        (0, metrics_service_1.incrementMetric)('dispatch_retry_skipped_total', { reason: 'locked' });
        return;
    }
    try {
        const retryUntil = input.retryUntil ?? new Date(Date.now() + STANDBY_RETRY_WINDOW_MS);
        const booking = await booking_model_1.default.findById(bookingId);
        if (!booking)
            return;
        if (booking.status !== booking_model_1.BookingStatus.PENDING ||
            ![booking_model_1.BookingDispatchStatus.BROADCASTING, booking_model_1.BookingDispatchStatus.STANDBY].includes(booking.dispatch?.status))
            return;
        const dispatchExpiry = booking.dispatch?.expiresAt ? new Date(booking.dispatch.expiresAt) : retryUntil;
        const now = new Date();
        const stopAt = dispatchExpiry < retryUntil ? dispatchExpiry : retryUntil;
        if (stopAt.getTime() <= now.getTime()) {
            (0, metrics_service_1.incrementMetric)('dispatch_retry_finished_total', { reason: 'expired' });
            return;
        }
        const rankedCandidates = await matching_service_1.default.rankEligibleOnlineTechniciansForBooking(bookingId);
        const nextWave = (0, exports.nextDispatchWave)(booking, rankedCandidates);
        if (nextWave.candidates.length) {
            const nextTechnicianIds = (0, exports.recordDispatchWave)(booking, nextWave.candidates, nextWave.wave, booking_model_1.BookingDispatchStatus.BROADCASTING, dispatchExpiry);
            booking.set('metadata.standbyProviderFoundAt', now);
            await booking.save();
            await (0, exports.notifyTechniciansForBooking)(input.io, booking, nextTechnicianIds);
            await createCustomerBookingNotification(booking, 'PROVIDER_SEARCH_UPDATED', 'Provider search updated', `We found nearby ${providerRoleForService(booking.serviceKey)} options for your ${serviceLabelForNotification(booking)} request.`, {
                dispatchStatus: booking_model_1.BookingDispatchStatus.BROADCASTING,
                matchedCount: nextTechnicianIds.length,
            });
            (0, metrics_service_1.incrementMetric)('dispatch_retry_matched_total', { mode: input.io ? 'socket_server' : 'worker' });
            return;
        }
        await (0, exports.scheduleStandbyDispatchRetry)({ bookingId, io: input.io, retryUntil: stopAt });
        (0, metrics_service_1.incrementMetric)('dispatch_retry_no_match_total');
    }
    finally {
        await releaseDispatchRetryLock(bookingId, lockToken);
    }
};
exports.processStandbyDispatchRetry = processStandbyDispatchRetry;
//# sourceMappingURL=dispatch-retry.service.js.map