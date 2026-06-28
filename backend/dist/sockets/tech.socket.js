"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTechnicianHandlers = void 0;
const redis_1 = __importDefault(require("../config/redis"));
const TECHNICIAN_LOCATIONS_KEY = 'technicians:locations';
const isUpdateLocationPayload = (payload) => {
    const p = payload;
    return (!!p && typeof p === 'object' &&
        typeof p.technicianId === 'string' && p.technicianId.trim().length > 0 &&
        typeof p.bookingId === 'string' && p.bookingId.trim().length > 0 &&
        typeof p.latitude === 'number' && Number.isFinite(p.latitude) &&
        typeof p.longitude === 'number' && Number.isFinite(p.longitude));
};
const registerTechnicianHandlers = (io, socket) => {
    // 1. Join Chat & Mapping Channels on assignment setup
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
    // 2. High Frequency Telemetry Processing & Broadcast Layer
    socket.on('update_location', async (payload) => {
        if (!isUpdateLocationPayload(payload)) {
            socket.emit('location_update_error', { message: 'Invalid location telemetry parameters' });
            return;
        }
        const { technicianId, bookingId, latitude, longitude, heading, speed } = payload;
        try {
            // Preserve spatial cluster metrics inside Redis instance for discovery matching queries
            await redis_1.default.geoadd(TECHNICIAN_LOCATIONS_KEY, longitude, latitude, technicianId);
            // Broadcast telemetry frames directly to the client screen container
            const broadcastPayload = {
                latitude,
                longitude,
                heading: heading ?? 0,
                speed: speed ?? 0,
                updatedAt: new Date().toISOString(),
            };
            socket.to(`booking:${bookingId}`).emit('job_location_changed', broadcastPayload);
            socket.emit('location_update_ack', { technicianId, latitude, longitude });
        }
        catch (error) {
            console.error(`❌ Failed to process telemetry pipe frame for ${technicianId}:`, error);
            socket.emit('location_update_error', { message: 'Unable to track coordinates stream' });
        }
    });
    // 3. Forward Specialist Messaging Responses
    socket.on('send_chat_msg', (payload) => {
        if (!payload?.bookingId)
            return;
        socket.to(`chat:${payload.bookingId}`).emit('incoming_chat_msg', payload.message);
    });
    socket.on('disconnect', (reason) => {
        console.info(`🛑 Technician connection severed: ${socket.id} (${reason})`);
    });
};
exports.registerTechnicianHandlers = registerTechnicianHandlers;
exports.default = exports.registerTechnicianHandlers;
//# sourceMappingURL=tech.socket.js.map