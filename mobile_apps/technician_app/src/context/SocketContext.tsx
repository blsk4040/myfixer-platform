// src/context/SocketContext.tsx
import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { io, Socket } from 'socket.io-client';

import {
  clearBackgroundLocationUpdateEmitter,
  registerBackgroundLocationUpdateEmitter,
} from '../features/duty/services/locationTrackingTask';

declare const process: {
  env?: {
    EXPO_PUBLIC_API_URL?: string;
    EXPO_PUBLIC_AUTH_TOKEN?: string;
    EXPO_PUBLIC_TECHNICIAN_ID?: string;
  };
};

const DEFAULT_API_URL = 'http://localhost:5000';
const DEFAULT_TEST_TECHNICIAN_ID = 'test-technician-user';

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  isOnDuty: boolean; // 👈 Expose state to the workspace layout grid
  toggleDutyStatus: () => void; // 👈 Handler to sync tracking tasks automatically
  disconnectSocket: () => void;
}

interface SocketProviderProps extends PropsWithChildren {
  authToken?: string;
  technicianId?: string;
}

const SocketContext = createContext<SocketContextValue | undefined>(undefined);

const getExpoPublicEnv = (key: keyof NonNullable<typeof process.env>): string | undefined => {
  const value = process.env?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
};

export function SocketProvider({
  authToken,
  technicianId,
  children,
}: SocketProviderProps): React.JSX.Element {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isOnDuty, setIsOnDuty] = useState(false); // 👈 Added global duty flag

  const connectionConfig = useMemo(() => {
    const resolvedServerUrl = getExpoPublicEnv('EXPO_PUBLIC_API_URL') ?? DEFAULT_API_URL;
    const resolvedTechnicianId =
      technicianId?.trim() ||
      getExpoPublicEnv('EXPO_PUBLIC_TECHNICIAN_ID') ||
      DEFAULT_TEST_TECHNICIAN_ID;
    const resolvedAuthToken = authToken?.trim() || getExpoPublicEnv('EXPO_PUBLIC_AUTH_TOKEN');

    return {
      authToken: resolvedAuthToken,
      serverUrl: resolvedServerUrl,
      technicianId: resolvedTechnicianId,
    };
  }, [authToken, technicianId]);

  // Handle Socket Lifecycle Events
  useEffect(() => {
    const nextSocket = io(connectionConfig.serverUrl, {
      autoConnect: true,
      transports: ['websocket'],
      auth: {
        role: 'TECHNICIAN',
        technicianId: connectionConfig.technicianId,
        token: connectionConfig.authToken,
      },
      query: { technicianId: connectionConfig.technicianId },
      extraHeaders: {
        authorization: connectionConfig.authToken
          ? `Bearer ${connectionConfig.authToken}`
          : `TestUser ${connectionConfig.technicianId}`,
        'x-myfixer-role': 'TECHNICIAN',
      },
    });

    nextSocket.on('connect', () => setIsConnected(true));
    nextSocket.on('disconnect', () => setIsConnected(false));
    setSocket(nextSocket);

    return () => {
      nextSocket.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, [connectionConfig]);

  // ✅ Telemetry Management: Hardware GPS tracking spins up dynamically *ONLY* while On-Duty
  useEffect(() => {
    if (!socket || !isOnDuty) {
      clearBackgroundLocationUpdateEmitter(); // Battery preservation guardrail
      return undefined;
    }

    // Tell server clustering engine we are active
    socket.emit('technician_status_change', { status: 'ONLINE', technicianId: connectionConfig.technicianId });

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
    if (socket) socket.disconnect();
  };

  const value = useMemo<SocketContextValue>(
    () => ({
      socket,
      isConnected,
      isOnDuty,
      toggleDutyStatus,
      disconnectSocket,
    }),
    [isConnected, isOnDuty, socket]
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocketConnection(): SocketContextValue {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocketConnection must be used within a SocketProvider.');
  return context;
}