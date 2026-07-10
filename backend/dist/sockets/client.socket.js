"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerClientHandlers = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const booking_model_1 = __importDefault(require("../models/booking.model"));
const isBookingPayload = (payload) => {
    return !!payload && typeof payload === 'object' && typeof payload.bookingId === 'string' && payload.bookingId.trim().length > 0;
};
const registerClientHandlers = (io, socket) => {
    const queryUserId = socket.handshake.query.userId;
    const authUserId = socket.handshake.auth?.userId;
    const candidateUserId = Array.isArray(queryUserId) ? queryUserId[0] : queryUserId || authUserId;
    if (typeof candidateUserId === 'string' && candidateUserId.trim()) {
        const customerId = candidateUserId.trim();
        socket.data.customerId = customerId;
        void socket.join(`customer:${customerId}`);
    }
    socket.on('join_customer_room', async (payload = {}) => {
        const customerId = payload.userId?.trim() || (typeof socket.data.customerId === 'string' ? socket.data.customerId : '');
        if (!customerId) {
            socket.emit('join_customer_room_error', { message: 'Missing customer identity' });
            return;
        }
        socket.data.customerId = customerId;
        await socket.join(`customer:${customerId}`);
        socket.emit('customer_room_joined', { userId: customerId, room: `customer:${customerId}` });
    });
    // 1. Join Unified Live Tracking Room Context
    socket.on('join_booking_room', async (payload) => {
        if (!isBookingPayload(payload)) {
            socket.emit('join_booking_room_error', { message: 'Invalid booking room payload' });
            return;
        }
        const bookingId = payload.bookingId.trim();
        const roomName = `booking:${bookingId}`;
        const customerId = typeof socket.data.customerId === 'string' ? socket.data.customerId : '';
        try {
            if (!customerId || !mongoose_1.default.Types.ObjectId.isValid(bookingId)) {
                socket.emit('join_booking_room_error', { message: 'Not authorized for this booking room' });
                return;
            }
            const booking = await booking_model_1.default.findOne({ _id: bookingId, customerId }).select('_id').lean();
            if (!booking) {
                socket.emit('join_booking_room_error', { message: 'Not authorized for this booking room' });
                return;
            }
            await socket.join(roomName);
            console.info(`📡 Client registered inside tracking viewport room: ${roomName}`);
            socket.emit('booking_room_joined', { bookingId, room: roomName });
        }
        catch (error) {
            socket.emit('join_booking_room_error', { message: 'Unable to join booking room' });
        }
    });
    // 2. Join Secure Live Chat Communication Room Context
    socket.on('join_chat_room', async (payload) => {
        if (!isBookingPayload(payload))
            return;
        const bookingId = payload.bookingId.trim();
        const customerId = typeof socket.data.customerId === 'string' ? socket.data.customerId : '';
        if (!customerId || !mongoose_1.default.Types.ObjectId.isValid(bookingId)) {
            socket.emit('join_chat_room_error', { message: 'Not authorized for this chat room' });
            return;
        }
        const booking = await booking_model_1.default.findOne({ _id: bookingId, customerId }).select('_id').lean();
        if (!booking) {
            socket.emit('join_chat_room_error', { message: 'Not authorized for this chat room' });
            return;
        }
        const roomName = `chat:${bookingId}`;
        await socket.join(roomName);
        console.info(`💬 Client chat connection established: ${roomName}`);
    });
    // 3. Dispatch Messaging Packets to Assigned Specialist
    socket.on('send_chat_msg', (payload) => {
        if (!payload?.bookingId)
            return;
        socket.to(`chat:${payload.bookingId}`).emit('incoming_chat_msg', payload.message);
    });
    socket.on('disconnect', (reason) => {
        console.info(`🛑 Customer socket disconnected: ${socket.id} (${reason})`);
    });
};
exports.registerClientHandlers = registerClientHandlers;
exports.default = exports.registerClientHandlers;
//# sourceMappingURL=client.socket.js.map