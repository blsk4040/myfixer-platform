// src/context/SocketContext.tsx
import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Socket } from 'socket.io-client';

import { useJobStore } from '../store/useJobStore';
import { NotificationService } from '../services/notification.service';
import techSocketService from '../services/tech_socket.service';
import { normalizeJobPayload, refreshAvailableJobs, refreshTechnicianJobBuckets } from '../services/jobWorkflow.service';
import {
  clearBackgroundLocationUpdateEmitter,
  registerBackgroundLocationUpdateEmitter,
} from '../features/duty/services/locationTrackingTask';
import { getSocketUrl, isSocketDebugEnabled } from '../config/runtime.config';

type ConnectionStatus = 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED';

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  connectionStatus: ConnectionStatus;
  isOnDuty: boolean;
  toggleDutyStatus: () => void;
  disconnectSocket: () => void;
}

interface SocketProviderProps extends PropsWithChildren {
  authToken?: string;
  technicianId?: string;
}

const SocketContext = createContext<SocketContextValue | undefined>(undefined);

const logSocketDebug = (message: string, metadata?: Record<string, unknown>): void => {
  if (!isSocketDebugEnabled()) return;
  console.info(`[tech-socket-debug] ${message}`, metadata ?? '');
};

export function SocketProvider({
  authToken,
  technicianId,
  children,
}: SocketProviderProps): React.JSX.Element {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('DISCONNECTED');
  const [isOnDuty, setIsOnDuty] = useState(false);
  const isOnDutyRef = useRef(isOnDuty);

  const connectionConfig = useMemo(() => ({
    authToken: authToken?.trim() || '',
    serverUrl: getSocketUrl(),
    technicianId: technicianId?.trim() || '',
  }), [authToken, technicianId]);

  useEffect(() => {
    isOnDutyRef.current = isOnDuty;
    useJobStore.getState().setOnlineStatus(isOnDuty);
  }, [isOnDuty]);

  useEffect(() => {
    const hasAuthenticationInput = Boolean(connectionConfig.authToken || connectionConfig.technicianId);

    if (!connectionConfig.serverUrl || !connectionConfig.technicianId) {
      if (hasAuthenticationInput) {
        console.warn('Technician socket not initialized. Missing socket URL or technician id.');
      } else {
        logSocketDebug('socket initialization waiting for authenticated technician session', {
          socketUrl: connectionConfig.serverUrl || '(missing)',
          technicianId: connectionConfig.technicianId || '(missing)',
        });
      }
      setSocket(null);
      setIsConnected(false);
      return undefined;
    }

    logSocketDebug('initializing SocketContext connection', {
      socketUrl: connectionConfig.serverUrl,
      technicianId: connectionConfig.technicianId,
    });

    const nextSocket = techSocketService.initializeConnection(connectionConfig.technicianId);

    const refreshAssignedJobs = (context: string) => {
      void refreshTechnicianJobBuckets().catch((error) => {
        console.warn(`Failed to refresh technician jobs ${context}:`, error);
      });
    };

    const emitOnlineAndRefresh = () => {
      refreshAssignedJobs('after reconnect');
      if (!isOnDutyRef.current) return;
      nextSocket.emit('technician_status_change', {
        status: 'ONLINE',
        technicianId: connectionConfig.technicianId,
      });
      void refreshAvailableJobs().catch((error) => {
        console.warn('Failed to refresh available jobs after reconnect:', error);
      });
    };

    const handleConnect = () => {
      logSocketDebug('SocketContext connected', {
        socketId: nextSocket.id,
        technicianId: connectionConfig.technicianId,
      });
      setIsConnected(true);
      setConnectionStatus('CONNECTED');
      emitOnlineAndRefresh();
    };

    const handleDisconnect = (reason: string) => {
      logSocketDebug('SocketContext disconnected', {
        reason,
        technicianId: connectionConfig.technicianId,
      });
      setIsConnected(false);
      setConnectionStatus('DISCONNECTED');
    };

    const handleIncomingRequest = async (payload: any) => {
      logSocketDebug('SocketContext incoming request received', payload as Record<string, unknown>);
      const job = normalizeJobPayload(payload);
      if (!job.id) return;
      const inserted = useJobStore.getState().upsertIncomingJob(job);
      if (inserted) {
        await NotificationService.handleIncomingJob(job.id, {
          body: `${job.applianceType} in ${job.generalArea || 'your area'}`,
        });
      }
    };

    const handleAvailableJobs = async (payload: any) => {
      const jobs = Array.isArray(payload) ? payload.map(normalizeJobPayload) : [];
      const existingJobIds = new Set(useJobStore.getState().incomingJobs.map((job) => job.id));
      useJobStore.getState().replaceIncomingJobs(jobs);

      const newJob = jobs.find((job) => job.id && !existingJobIds.has(job.id));
      if (newJob) {
        await NotificationService.handleIncomingJob(newJob.id, {
          body: `${newJob.applianceType} in ${newJob.generalArea || 'your area'}`,
        });
      }
    };

    const handleUnavailable = (payload: any) => {
      const bookingId = String(payload?.bookingId || '');
      if (!bookingId) return;
      useJobStore.getState().removeIncomingJob(bookingId);
      if (payload?.reason !== 'declined') void NotificationService.handleJobCancelled(bookingId);
    };

    const handleChatMessage = (message: any) => {
      void NotificationService.handleMessage(String(message?.id || message?.timestamp || Date.now()));
    };

    const handlePayment = (payload: any) => {
      void NotificationService.handlePayment(String(payload?.bookingId || payload?.invoiceId || Date.now()));
    };

    const handleStatusChanged = (payload: any) => {
      if (payload?.status === 'CANCELLED') {
        void NotificationService.handleJobCancelled(String(payload.bookingId || 'cancelled'));
      }
      refreshAssignedJobs('after status change');
    };

    nextSocket.on('connect', handleConnect);
    nextSocket.on('disconnect', handleDisconnect);
    nextSocket.on('connect_error', (error) => {
      logSocketDebug('SocketContext connect error', {
        message: error.message,
        technicianId: connectionConfig.technicianId,
      });
      setConnectionStatus('RECONNECTING');
    });
    nextSocket.io.on('reconnect_attempt', () => setConnectionStatus('RECONNECTING'));
    nextSocket.io.on('reconnect', emitOnlineAndRefresh);
    nextSocket.on('technician_status_ack', (payload) => {
      logSocketDebug('SocketContext technician registration acknowledged', payload as Record<string, unknown>);
    });
    nextSocket.on('incoming_request', handleIncomingRequest);
    nextSocket.on('available_jobs', handleAvailableJobs);
    nextSocket.on('job_taken', handleUnavailable);
    nextSocket.on('job_unavailable', handleUnavailable);
    nextSocket.on('incoming_chat_msg', handleChatMessage);
    nextSocket.on('payment_confirmed', handlePayment);
    nextSocket.on('booking_status_changed', handleStatusChanged);

    setSocket(nextSocket);
    if (nextSocket.connected) handleConnect();

    return () => {
      nextSocket.off('connect', handleConnect);
      nextSocket.off('disconnect', handleDisconnect);
      nextSocket.off('incoming_request', handleIncomingRequest);
      nextSocket.off('available_jobs', handleAvailableJobs);
      nextSocket.off('job_taken', handleUnavailable);
      nextSocket.off('job_unavailable', handleUnavailable);
      nextSocket.off('incoming_chat_msg', handleChatMessage);
      nextSocket.off('payment_confirmed', handlePayment);
      nextSocket.off('booking_status_changed', handleStatusChanged);
      techSocketService.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, [connectionConfig]);

  useEffect(() => {
    if (!socket || !isOnDuty) {
      clearBackgroundLocationUpdateEmitter();
      return undefined;
    }

    logSocketDebug('registering technician online status', {
      technicianId: connectionConfig.technicianId,
    });
    socket.emit('technician_status_change', { status: 'ONLINE', technicianId: connectionConfig.technicianId });
    void refreshAvailableJobs().catch((error) => {
      console.warn('Failed to refresh available jobs after duty change:', error);
    });
    void refreshTechnicianJobBuckets().catch((error) => {
      console.warn('Failed to refresh technician jobs after duty change:', error);
    });

    registerBackgroundLocationUpdateEmitter((payload) => {
      socket.emit('technician_location_update', {
        technicianId: connectionConfig.technicianId,
        latitude: payload.latitude,
        longitude: payload.longitude,
        recordedAt: payload.recordedAt,
      });
    });

    return () => {
      clearBackgroundLocationUpdateEmitter();
      if (socket.connected) {
        socket.emit('technician_status_change', { status: 'OFFLINE', technicianId: connectionConfig.technicianId });
      }
    };
  }, [socket, isOnDuty, connectionConfig.technicianId]);

  const toggleDutyStatus = () => {
    setIsOnDuty((prev) => !prev);
  };

  const disconnectSocket = (): void => {
    setIsOnDuty(false);
    clearBackgroundLocationUpdateEmitter();
    techSocketService.disconnect();
  };

  const value = useMemo<SocketContextValue>(
    () => ({
      socket,
      isConnected,
      connectionStatus,
      isOnDuty,
      toggleDutyStatus,
      disconnectSocket,
    }),
    [connectionStatus, isConnected, isOnDuty, socket]
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocketConnection(): SocketContextValue {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocketConnection must be used within a SocketProvider.');
  return context;
}
