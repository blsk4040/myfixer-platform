// src/sockets/client.socket.ts
import { Server as SocketIOServer, Socket } from 'socket.io';

interface BookingRoomPayload {
  bookingId: string;
}

interface ChatMessagePayload {
  bookingId: string;
  message: {
    id: string;
    senderRole: 'client' | 'technician';
    text: string;
    timestamp: string;
  };
}

const isBookingPayload = (payload: unknown): payload is BookingRoomPayload => {
  return !!payload && typeof payload === 'object' && typeof (payload as any).bookingId === 'string' && (payload as any).bookingId.trim().length > 0;
};

export const registerClientHandlers = (io: SocketIOServer, socket: Socket): void => {
  const queryUserId = socket.handshake.query.userId;
  const authUserId = socket.handshake.auth?.userId;
  const candidateUserId = Array.isArray(queryUserId) ? queryUserId[0] : queryUserId || authUserId;
  if (typeof candidateUserId === 'string' && candidateUserId.trim()) {
    const customerId = candidateUserId.trim();
    socket.data.customerId = customerId;
    void socket.join(`customer:${customerId}`);
  }

  socket.on('join_customer_room', async (payload: { userId?: string } = {}) => {
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
  socket.on('join_booking_room', async (payload: unknown) => {
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
    } catch (error) {
      socket.emit('join_booking_room_error', { message: 'Unable to join booking room' });
    }
  });

  // 2. Join Secure Live Chat Communication Room Context
  socket.on('join_chat_room', async (payload: unknown) => {
    if (!isBookingPayload(payload)) return;
    const roomName = `chat:${payload.bookingId.trim()}`;
    await socket.join(roomName);
    console.info(`💬 Client chat connection established: ${roomName}`);
  });

  // 3. Dispatch Messaging Packets to Assigned Specialist
  socket.on('send_chat_msg', (payload: ChatMessagePayload) => {
    if (!payload?.bookingId) return;
    socket.to(`chat:${payload.bookingId}`).emit('incoming_chat_msg', payload.message);
  });

  socket.on('disconnect', (reason: string) => {
    console.info(`🛑 Customer socket disconnected: ${socket.id} (${reason})`);
  });
};

export default registerClientHandlers;
