// src/services/tech_socket.service.ts
import { io, Socket } from 'socket.io-client';
import authService from './auth.service';
import { assertConfiguredUrl, getSocketUrl, isSocketDebugEnabled } from '../config/runtime.config';

const BACKEND_ENGINE_URL = getSocketUrl();
const TECHNICIAN_ROLE_HEADER = 'technician';

const logSocketDebug = (message: string, metadata?: Record<string, unknown>): void => {
  if (!isSocketDebugEnabled()) return;
  console.info(`[tech-socket-debug] ${message}`, metadata ?? '');
};

export interface IncomingRequestPayload {
  bookingId: string;
  applianceType: string;
  faultDescription?: string;
  generalArea?: string;
  approximateArea?: string;
  distanceText?: string;
  priceMinor?: number;
  price: number;
  currency: string;
  hasPreciseLocation: false;
}

export interface AvailableJobsPayload {
  bookingId: string;
  id?: string;
  applianceType: string;
  faultDescription: string;
  generalArea: string;
  approximateArea?: string;
  priceMinor: number;
  callOutFee?: number;
  currency: string;
  countryCode: string;
  distanceKm?: number;
  distanceText: string;
  categoryMatch: boolean;
  hasPreciseLocation: false;
}

export type IncomingRequestListener = (payload: IncomingRequestPayload) => void;
export type AvailableJobsListener = (payload: AvailableJobsPayload[]) => void;
export type JobUnavailableListener = (payload: { bookingId: string; reason?: string }) => void;

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
    const session = authService.getSession();

    assertConfiguredUrl(BACKEND_ENGINE_URL, 'EXPO_PUBLIC_SOCKET_URL');

    logSocketDebug('tech_socket.service initializing connection', {
      socketUrl: BACKEND_ENGINE_URL,
      technicianId: nextTechnicianId,
      hasToken: Boolean(session?.token),
    });

    this.socket = io(BACKEND_ENGINE_URL, {
      transports: ['websocket'],
      query: { 
        role: TECHNICIAN_ROLE_HEADER,
        technicianId: nextTechnicianId 
      },
      auth: {
        role: TECHNICIAN_ROLE_HEADER,
        technicianId: nextTechnicianId,
        token: session?.token,
      },
      extraHeaders: {
        ...(session?.token ? { authorization: `Bearer ${session.token}` } : {}),
        'x-myfixer-role': TECHNICIAN_ROLE_HEADER,
      },
    });

    this.socket.on('connect', () => {
      logSocketDebug('tech_socket.service connected', {
        socketId: this.socket?.id,
        technicianId: nextTechnicianId,
      });
      this.socket?.emit('technician_status_change', {
        status: 'ONLINE',
        technicianId: nextTechnicianId,
      });
      logSocketDebug('tech_socket.service technician registration emitted', {
        technicianId: nextTechnicianId,
      });
    });

    this.socket.on('disconnect', (reason) => {
      logSocketDebug('tech_socket.service disconnected', {
        reason,
        technicianId: nextTechnicianId,
      });
    });

    this.socket.on('connect_error', (error) => {
      logSocketDebug('tech_socket.service connect error', {
        message: error.message,
        technicianId: nextTechnicianId,
      });
    });

    this.socket.on('technician_status_ack', (payload) => {
      logSocketDebug('tech_socket.service technician registration acknowledged', payload as Record<string, unknown>);
    });

    return this.socket;
  }

  onIncomingRequest(listener: IncomingRequestListener): () => void {
    const socket = this.getConnectedSocket();

    const wrappedListener = (payload: IncomingRequestPayload) => {
      listener(payload);
    };

    socket.on('incoming_request', wrappedListener);

    return () => {
      socket.off('incoming_request', wrappedListener);
    };
  }

  onAvailableJobs(listener: AvailableJobsListener): () => void {
    const socket = this.getConnectedSocket();
    socket.on('available_jobs', listener);
    return () => { socket.off('available_jobs', listener); };
  }

  onJobUnavailable(listener: JobUnavailableListener): () => void {
    const socket = this.getConnectedSocket();
    socket.on('job_taken', listener);
    socket.on('job_unavailable', listener);
    return () => {
      socket.off('job_taken', listener);
      socket.off('job_unavailable', listener);
    };
  }

  onConnectionChange(listener: (status: 'connected' | 'disconnected') => void): () => void {
    const socket = this.getConnectedSocket();
    const handleConnect = () => listener('connected');
    const handleDisconnect = () => listener('disconnected');
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
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
    logSocketDebug('tech_socket.service disconnect requested', {
      technicianId: this.technicianId ?? '(missing)',
    });
    if (this.socket?.connected && this.technicianId) {
      this.socket.emit('technician_status_change', {
        status: 'OFFLINE',
        technicianId: this.technicianId,
      });
    }
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
