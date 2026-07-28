"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitSocketRoomEvent = exports.getSocketRedisEmitter = void 0;
const redis_emitter_1 = require("@socket.io/redis-emitter");
const redis_1 = require("../config/redis");
const emitterEnabled = () => (0, redis_1.isRedisEnabled)() && process.env.SOCKET_REDIS_ADAPTER_ENABLED === 'true';
let emitter = null;
let emitterClient = null;
let warningLogged = false;
const warnOnce = (message) => {
    if (warningLogged)
        return;
    warningLogged = true;
    console.warn(message);
};
const getSocketRedisEmitter = async () => {
    if (!emitterEnabled())
        return null;
    if (emitter)
        return emitter;
    const client = emitterClient ?? (0, redis_1.createRedisClient)();
    if (!client)
        return null;
    try {
        if (client.status !== 'ready') {
            await client.connect();
        }
        emitterClient = client;
        emitter = new redis_emitter_1.Emitter(client);
        return emitter;
    }
    catch (error) {
        warnOnce(`Socket.IO Redis emitter unavailable. Worker broadcasts will rely on push notifications. ${error instanceof Error ? error.message : String(error)}`);
        client.disconnect();
        return null;
    }
};
exports.getSocketRedisEmitter = getSocketRedisEmitter;
const emitSocketRoomEvent = async (room, event, payload) => {
    const redisEmitter = await (0, exports.getSocketRedisEmitter)();
    if (!redisEmitter)
        return false;
    redisEmitter.to(room).emit(event, payload);
    return true;
};
exports.emitSocketRoomEvent = emitSocketRoomEvent;
//# sourceMappingURL=redis-emitter.js.map