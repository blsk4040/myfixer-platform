"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTechnicianHandlers = void 0;
// src/sockets/tech.socket.ts
const mongoose_1 = __importDefault(require("mongoose"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const redis_1 = require("../config/redis");
const technician_model_1 = __importDefault(require("../models/technician.model"));
const technician_telemetry_model_1 = __importDefault(require("../models/technician-telemetry.model"));
const user_model_1 = require("../models/user.model");
const matching_service_1 = __importDefault(require("../services/matching.service"));
const TECHNICIAN_LOCATIONS_KEY = 'technicians:locations';
const isSocketDebugEnabled = () => process.env.NODE_ENV !== 'production' || process.env.SOCKET_DEBUG === 'true';
const logSocketDebug = (message, metadata) => {
    if (!isSocketDebugEnabled())
        return;
    console.info(`[tech-socket-debug] ${message}`, metadata ?? '');
};
const isValidObjectId = (value) => mongoose_1.default.Types.ObjectId.isValid(value);
const getHeaderValue = (value) => {
    if (Array.isArray(value))
        return value[0] ?? '';
    return value ?? '';
};
const getBearerToken = (socket) => {
    const header = getHeaderValue(socket.handshake.headers.authorization);
    const authToken = typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token : '';
    const token = header || authToken;
    const [scheme, value] = token.split(' ');
    if (scheme === 'Bearer' && value)
        return value;
    return authToken && !authToken.includes(' ') ? authToken : '';
};
const resolveAuthenticatedTechnicianId = (socket) => {
    const secret = process.env.JWT_SECRET;
    const token = getBearerToken(socket);
    if (secret && token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, secret);
            if (decoded && typeof decoded === 'object') {
                const payload = decoded;
                if ((0, user_model_1.normalizeUserRole)(payload.role) === user_model_1.UserRole.TECHNICIAN) {
                    return String(payload._id ?? payload.id ?? '').trim() || null;
                }
            }
        }
        catch {
            return null;
        }
    }
    const queryTechnicianId = socket.handshake.query.technicianId;
    const fallbackTechnicianId = Array.isArray(queryTechnicianId) ? queryTechnicianId[0] : queryTechnicianId;
    return typeof fallbackTechnicianId === 'string' && fallbackTechnicianId.trim()
        ? fallbackTechnicianId.trim()
        : null;
};
const isSocketTechnician = (socket, technicianId) => typeof socket.data.technicianId === 'string' && socket.data.technicianId === technicianId;
const updateTechnicianOnlineState = async (technicianId, isOnline, latitude, longitude) => {
    if (!isValidObjectId(technicianId))
        return;
    const location = typeof latitude === 'number' &&
        Number.isFinite(latitude) &&
        typeof longitude === 'number' &&
        Number.isFinite(longitude)
        ? {
            type: 'Point',
            coordinates: [longitude, latitude],
        }
        : null;
    const update = {
        'availability.isOnline': isOnline,
        'availability.lastSeenAt': new Date(),
        updatedAt: new Date(),
    };
    if (location) {
        update.lastLocation = location;
    }
    const technician = await technician_model_1.default.findOneAndUpdate({ userId: new mongoose_1.default.Types.ObjectId(technicianId) }, { $set: update }, { new: true }).select('_id lastLocation');
    if (!technician)
        return;
    const telemetryLocation = location ?? technician.lastLocation ?? null;
    const telemetryUpdate = {
        isOnDuty: isOnline,
        connectionStatus: isOnline ? 'CONNECTED' : 'DISCONNECTED',
    };
    if (telemetryLocation) {
        telemetryUpdate.location = telemetryLocation;
    }
    await technician_telemetry_model_1.default.findOneAndUpdate({ technicianId: technician._id }, {
        $set: telemetryUpdate,
        $setOnInsert: { technicianId: technician._id },
    }, { upsert: true, new: true, setDefaultsOnInsert: true });
};
const isUpdateLocationPayload = (payload) => {
    const p = payload;
    return (!!p &&
        typeof p === 'object' &&
        typeof p.technicianId === 'string' &&
        p.technicianId.trim().length > 0 &&
        typeof p.bookingId === 'string' &&
        p.bookingId.trim().length > 0 &&
        typeof p.latitude === 'number' &&
        Number.isFinite(p.latitude) &&
        typeof p.longitude === 'number' &&
        Number.isFinite(p.longitude));
};
const emitAvailableJobs = async (io, targetTechnicianId) => {
    const jobs = await matching_service_1.default.findNearbyPendingBookingsForTechnician(targetTechnicianId);
    await matching_service_1.default.markBookingsSentToTechnician(targetTechnicianId, jobs.map((job) => job.id));
    const payload = jobs.map((job) => ({
        bookingId: job.id,
        applianceType: job.applianceType,
        faultDescription: job.faultDescription,
        fullAddress: job.fullAddress,
        complexDetails: job.complexDetails,
        generalArea: job.generalArea,
        priceMinor: job.priceMinor,
        currency: job.currency,
        countryCode: job.countryCode,
        latitude: job.latitude,
        longitude: job.longitude,
        distanceKm: job.distanceKm,
        distanceText: `${job.distanceKm.toFixed(1)} km`,
        categoryMatch: job.categoryMatch,
    }));
    io.to(`technician:${targetTechnicianId}`).emit('available_jobs', payload);
};
const registerTechnicianHandlers = (io, socket) => {
    const technicianId = resolveAuthenticatedTechnicianId(socket);
    if (technicianId) {
        const authenticatedTechnicianId = technicianId;
        socket.data.technicianId = authenticatedTechnicianId;
        void socket.join(`technician:${authenticatedTechnicianId}`);
        void updateTechnicianOnlineState(authenticatedTechnicianId, true)
            .then(() => emitAvailableJobs(io, authenticatedTechnicianId))
            .catch((error) => {
            console.error(`Failed to prime technician telemetry for ${authenticatedTechnicianId}:`, error);
        });
        logSocketDebug('backend technician socket registered', {
            socketId: socket.id,
            technicianId: authenticatedTechnicianId,
            room: `technician:${authenticatedTechnicianId}`,
        });
    }
    socket.on('join_booking_room', async (payload) => {
        if (!payload?.bookingId)
            return;
        await socket.join(`booking:${payload.bookingId}`);
        console.info(`👨‍🔧 Specialist locked into active job map loop: booking:${payload.bookingId}`);
    });
    socket.on('join_chat_room', async (payload) => {
        if (!payload?.bookingId)
            return;
        await socket.join(`chat:${payload.bookingId}`);
    });
    socket.on('technician_status_change', async (payload) => {
        const targetTechnicianId = socket.data.technicianId;
        if (!targetTechnicianId) {
            socket.emit('technician_status_error', { message: 'Missing technicianId' });
            return;
        }
        if (payload?.technicianId && payload.technicianId.trim() !== targetTechnicianId) {
            socket.emit('technician_status_error', { message: 'Technician identity mismatch' });
            return;
        }
        const isOnline = payload.status === 'ONLINE';
        try {
            await socket.join(`technician:${targetTechnicianId}`);
            socket.data.technicianId = targetTechnicianId;
            await updateTechnicianOnlineState(targetTechnicianId, isOnline);
            logSocketDebug('backend technician status registered', {
                socketId: socket.id,
                technicianId: targetTechnicianId,
                status: isOnline ? 'ONLINE' : 'OFFLINE',
                room: `technician:${targetTechnicianId}`,
            });
            socket.emit('technician_status_ack', {
                technicianId: targetTechnicianId,
                status: isOnline ? 'ONLINE' : 'OFFLINE',
                updatedAt: new Date().toISOString(),
            });
            if (isOnline) {
                await emitAvailableJobs(io, targetTechnicianId);
            }
            else {
                io.to(`technician:${targetTechnicianId}`).emit('available_jobs', []);
            }
        }
        catch (error) {
            console.error(`❌ Failed to update technician status for ${targetTechnicianId}:`, error);
            socket.emit('technician_status_error', { message: 'Unable to update technician status' });
        }
    });
    socket.on('technician_ping', async (payload = {}) => {
        const targetTechnicianId = socket.data.technicianId;
        if (!targetTechnicianId) {
            socket.emit('technician_ping_error', { message: 'Missing technicianId' });
            return;
        }
        if (payload?.technicianId && payload.technicianId.trim() !== targetTechnicianId) {
            socket.emit('technician_ping_error', { message: 'Technician identity mismatch' });
            return;
        }
        try {
            await updateTechnicianOnlineState(targetTechnicianId, true, payload.latitude, payload.longitude);
            await emitAvailableJobs(io, targetTechnicianId);
            socket.emit('technician_ping_ack', {
                technicianId: targetTechnicianId,
                connectionStatus: 'CONNECTED',
                isOnDuty: true,
                updatedAt: new Date().toISOString(),
            });
        }
        catch (error) {
            console.error(`Failed to refresh technician ping for ${targetTechnicianId}:`, error);
            socket.emit('technician_ping_error', { message: 'Unable to refresh technician telemetry' });
        }
    });
    socket.on('update_location', async (payload) => {
        if (!isUpdateLocationPayload(payload)) {
            socket.emit('location_update_error', { message: 'Invalid location telemetry parameters' });
            return;
        }
        const { technicianId, bookingId, latitude, longitude, heading, speed } = payload;
        if (!isSocketTechnician(socket, technicianId)) {
            socket.emit('location_update_error', { message: 'Technician identity mismatch' });
            return;
        }
        try {
            const redisClient = await (0, redis_1.connectRedis)();
            if (redisClient) {
                await redisClient.geoadd(TECHNICIAN_LOCATIONS_KEY, longitude, latitude, technicianId);
            }
            await updateTechnicianOnlineState(technicianId, true, latitude, longitude);
            await emitAvailableJobs(io, technicianId);
            const broadcastPayload = {
                latitude,
                longitude,
                heading: heading ?? 0,
                speed: speed ?? 0,
                updatedAt: new Date().toISOString(),
            };
            socket.to(`booking:${bookingId}`).emit('job_location_changed', broadcastPayload);
            socket.emit('location_update_ack', {
                technicianId,
                latitude,
                longitude,
                trackingStore: redisClient ? 'redis' : 'mongo',
            });
        }
        catch (error) {
            console.error(`❌ Failed to process telemetry pipe frame for ${technicianId}:`, error);
            socket.emit('location_update_error', { message: 'Unable to track coordinates stream' });
        }
    });
    socket.on('technician_location_update', async (payload) => {
        const targetTechnicianId = payload?.technicianId?.trim();
        const { latitude, longitude } = payload;
        if (!targetTechnicianId ||
            typeof latitude !== 'number' ||
            !Number.isFinite(latitude) ||
            typeof longitude !== 'number' ||
            !Number.isFinite(longitude)) {
            socket.emit('location_update_error', { message: 'Invalid technician location payload' });
            return;
        }
        if (!isSocketTechnician(socket, targetTechnicianId)) {
            socket.emit('location_update_error', { message: 'Technician identity mismatch' });
            return;
        }
        try {
            const redisClient = await (0, redis_1.connectRedis)();
            if (redisClient) {
                await redisClient.geoadd(TECHNICIAN_LOCATIONS_KEY, longitude, latitude, targetTechnicianId);
            }
            await updateTechnicianOnlineState(targetTechnicianId, true, latitude, longitude);
            await emitAvailableJobs(io, targetTechnicianId);
            logSocketDebug('backend technician location registered', {
                socketId: socket.id,
                technicianId: targetTechnicianId,
                trackingStore: redisClient ? 'redis' : 'mongo',
            });
            socket.emit('location_update_ack', {
                technicianId: targetTechnicianId,
                latitude,
                longitude,
                recordedAt: payload.recordedAt ?? new Date().toISOString(),
                trackingStore: redisClient ? 'redis' : 'mongo',
            });
        }
        catch (error) {
            console.error(`❌ Failed to process technician availability location for ${targetTechnicianId}:`, error);
            socket.emit('location_update_error', { message: 'Unable to store technician coordinates' });
        }
    });
    socket.on('send_chat_msg', (payload) => {
        if (!payload?.bookingId)
            return;
        socket.to(`chat:${payload.bookingId}`).emit('incoming_chat_msg', payload.message);
    });
    socket.on('disconnect', (reason) => {
        const disconnectedTechnicianId = typeof socket.data.technicianId === 'string' ? socket.data.technicianId : '';
        if (disconnectedTechnicianId) {
            logSocketDebug('technician socket disconnected without clearing duty state', {
                technicianId: disconnectedTechnicianId,
                reason,
            });
        }
        console.info(`🛑 Technician connection severed: ${socket.id} (${reason})`);
    });
};
exports.registerTechnicianHandlers = registerTechnicianHandlers;
exports.default = exports.registerTechnicianHandlers;
//# sourceMappingURL=tech.socket.js.map