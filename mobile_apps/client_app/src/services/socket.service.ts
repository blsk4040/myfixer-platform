import { io, Socket } from 'socket.io-client';
import { assertConfiguredUrl, getSocketUrl } from '../config/runtime.config';

const BACKEND_ENGINE_URL = getSocketUrl();
const CUSTOMER_ROLE_HEADER = 'CUSTOMER';

class SocketService {
  private socket: Socket | null = null;

  initializeConnection(): Socket {
    if (this.socket) {
      return this.socket;
    }

    assertConfiguredUrl(BACKEND_ENGINE_URL, 'EXPO_PUBLIC_SOCKET_URL');

    this.socket = io(BACKEND_ENGINE_URL, {
      transports: ['websocket'],
      extraHeaders: {
        'x-myfixer-role': CUSTOMER_ROLE_HEADER,
      },
    });

    return this.socket;
  }

  joinBookingRoom(bookingId: string): void {
    const socket = this.socket ?? this.initializeConnection();

    socket.emit('join_booking_room', { bookingId });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  getSocket(): Socket | null {
    return this.socket;
  }
}

export const socketService = new SocketService();
export default socketService;
