// src/sockets/socket.server.ts
import { Server as SocketIOServer, Socket } from 'socket.io';
import { registerClientHandlers } from './client.socket';
import { registerTechnicianHandlers } from './tech.socket';

type SocketRole = 'technician' | 'customer';

const normalizeRole = (value: unknown): SocketRole | null => {
  if (typeof value !== 'string') return null;
  const role = value.trim().toLowerCase();
  if (role === 'technician' || role === 'tech') return 'technician';
  if (role === 'customer' || role === 'client') return 'customer';
  return null;
};

const getHandshakeRole = (socket: Socket): SocketRole | null => {
  const queryRole = socket.handshake.query.role;
  const headerRole = socket.handshake.headers['x-myfixer-role'];

  if (Array.isArray(queryRole)) {
    return normalizeRole(queryRole[0]);
  }
  return normalizeRole(queryRole) ?? normalizeRole(headerRole);
};

export const registerSocketServer = (io: SocketIOServer): void => {
  io.on('connection', (socket: Socket) => {
    const role = getHandshakeRole(socket);

    console.info(
      `🔌 Socket connected: ${socket.id}${role ? ` as ${role}` : ' with unknown role'}`,
    );

    if (role === 'technician') {
      registerTechnicianHandlers(io, socket);
      return;
    }

    if (role === 'customer') {
      registerClientHandlers(io, socket);
      return;
    }

    console.warn(`⚠️ Socket ${socket.id} connected without a supported role`);
    socket.emit('socket_role_error', {
      message: 'A supported socket role is required',
      supportedRoles: ['technician', 'customer'],
    });

    socket.on('disconnect', (reason: string) => {
      console.info(`Unassigned socket disconnected: ${socket.id} (${reason})`);
    });
  });
};

export default registerSocketServer;