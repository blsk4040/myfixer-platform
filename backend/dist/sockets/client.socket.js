"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerClientHandlers = void 0;
const isBookingPayload = (payload) => {
    return !!payload && typeof payload === 'object' && typeof payload.bookingId === 'string' && payload.bookingId.trim().length > 0;
};
const registerClientHandlers = (io, socket) => {
    // 1. Join Unified Live Tracking Room Context
    socket.on('join_booking_room', async (payload) => {
        if (!isBookingPayload(payload)) {
            socket.emit('join_booking_room_error', { message: 'Invalid booking room payload' });
            return;
        }
        const bookingId = payload.bookingId.trim();
        const roomName = `booking:${bookingId}`;
        try {
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
        const roomName = `chat:${payload.bookingId.trim()}`;
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