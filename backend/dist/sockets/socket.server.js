"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSocketServer = void 0;
const client_socket_1 = require("./client.socket");
const tech_socket_1 = require("./tech.socket");
const normalizeRole = (value) => {
    if (typeof value !== 'string')
        return null;
    const role = value.trim().toLowerCase();
    if (role === 'technician' || role === 'tech')
        return 'technician';
    if (role === 'customer' || role === 'client')
        return 'customer';
    return null;
};
const getHandshakeRole = (socket) => {
    const queryRole = socket.handshake.query.role;
    const authRole = socket.handshake.auth?.role;
    const headerRole = socket.handshake.headers['x-myfixer-role'];
    if (Array.isArray(queryRole)) {
        return normalizeRole(queryRole[0]);
    }
    return normalizeRole(queryRole) ?? normalizeRole(authRole) ?? normalizeRole(headerRole);
};
const isSocketDebugEnabled = () => process.env.NODE_ENV !== 'production' || process.env.SOCKET_DEBUG === 'true';
const logSocketDebug = (message, metadata) => {
    if (!isSocketDebugEnabled())
        return;
    console.info(`[tech-socket-debug] ${message}`, metadata ?? '');
};
const registerSocketServer = (io) => {
    io.on('connection', (socket) => {
        const role = getHandshakeRole(socket);
        logSocketDebug('backend socket connection received', {
            socketId: socket.id,
            role: role ?? 'unknown',
            technicianId: socket.handshake.query.technicianId ?? socket.handshake.auth?.technicianId ?? '',
            host: socket.handshake.headers.host ?? '',
        });
        console.info(`🔌 Socket connected: ${socket.id}${role ? ` as ${role}` : ' with unknown role'}`);
        if (role === 'technician') {
            (0, tech_socket_1.registerTechnicianHandlers)(io, socket);
            return;
        }
        if (role === 'customer') {
            (0, client_socket_1.registerClientHandlers)(io, socket);
            return;
        }
        console.warn(`⚠️ Socket ${socket.id} connected without a supported role`);
        socket.emit('socket_role_error', {
            message: 'A supported socket role is required',
            supportedRoles: ['technician', 'customer'],
        });
        socket.on('disconnect', (reason) => {
            console.info(`Unassigned socket disconnected: ${socket.id} (${reason})`);
        });
    });
};
exports.registerSocketServer = registerSocketServer;
exports.default = exports.registerSocketServer;
//# sourceMappingURL=socket.server.js.map