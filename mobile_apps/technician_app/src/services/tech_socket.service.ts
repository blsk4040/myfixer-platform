// src/services/tech_socket.service.ts
import { io, Socket } from 'socket.io-client';

const BACKEND_ENGINE_URL = 'https://api.myfixer.co.za';
const TECHNICIAN_ROLE_HEADER = 'technician';

export interface IncomingRequestPayload {
  bookingId: string;
  customerId: string;
  applianceType: string;
  latitude: number;
  longitude: number;
  price: number;
  currency: 'ZAR' | 'NGN' | 'KES';
}

export type IncomingRequestListener = (payload: IncomingRequestPayload) => void;

class TechSocketService {
  private socket: Socket | null = null;
  private technicianId: string | null = null;

  initializeConnection(technicianId: string): Socket {
    const nextTechnicianId = technicianId.trim();
    if (!nextTechnicianId) {
      throw new Error('A technicianId is required to initialize the technician socket.');
    }

    if (this.socket) {
      if (this.technicianId === nextTechnicianId) return this.socket;
      this.disconnect();
    }

    this.technicianId = nextTechnicianId;
    this.socket = io(BACKEND_ENGINE_URL, {
      transports: ['websocket'],
      query: { 
        role: TECHNICIAN_ROLE_HEADER,
        technicianId: nextTechnicianId 
      },
      extraHeaders: {
        'x-myfixer-role': TECHNICIAN_ROLE_HEADER,
      },
    });

    return this.socket;
  }

  onIncomingRequest(listener: IncomingRequestListener): () => void {
    const socket = this.getConnectedSocket();
    socket.on('incoming_request', listener);
    return () => { socket.off('incoming_request', listener); };
  }

  // Bridging endpoint targeted directly by your foreground/background tracking loops
  emitTelemetryUpdate(payload: { bookingId: string; latitude: number; longitude: number; heading: number; speed: number }): void {
    const socket = this.getConnectedSocket();
    if (!this.technicianId) throw new Error('Missing synchronized tracking context validation.');

    socket.emit('update_location', {
      technicianId: this.technicianId,
      ...payload
    });
  }

  joinBookingRoom(bookingId: string): void {
    this.getConnectedSocket().emit('join_booking_room', { bookingId });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.technicianId = null;
  }

  getSocket(): Socket | null { return this.socket; }

  private getConnectedSocket(): Socket {
    if (!this.socket || !this.technicianId) {
      throw new Error('Initialize the technician socket before using it.');
    }
    return this.socket;
  }
}

export const techSocketService = new TechSocketService();
export default techSocketService;