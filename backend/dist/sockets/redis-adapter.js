"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configureSocketRedisAdapter = void 0;
const redis_adapter_1 = require("@socket.io/redis-adapter");
const redis_1 = require("../config/redis");
const adapterEnabled = () => (0, redis_1.isRedisEnabled)() && process.env.SOCKET_REDIS_ADAPTER_ENABLED === 'true';
const configureSocketRedisAdapter = async (io) => {
    if (!adapterEnabled())
        return;
    const pubClient = (0, redis_1.createRedisClient)();
    const subClient = pubClient?.duplicate();
    if (!pubClient || !subClient)
        return;
    try {
        await Promise.all([pubClient.connect(), subClient.connect()]);
        io.adapter((0, redis_adapter_1.createAdapter)(pubClient, subClient));
        console.info('Socket.IO Redis adapter enabled.');
    }
    catch (error) {
        console.warn('Socket.IO Redis adapter unavailable. Continuing with single-instance adapter:', error instanceof Error ? error.message : error);
        pubClient.disconnect();
        subClient.disconnect();
    }
};
exports.configureSocketRedisAdapter = configureSocketRedisAdapter;
//# sourceMappingURL=redis-adapter.js.map