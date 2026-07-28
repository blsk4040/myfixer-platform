"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectRedis = exports.createRedisClient = exports.getRedisClient = exports.isRedisEnabled = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const isRedisEnabled = () => process.env.REDIS_ENABLED === 'true' && Boolean(process.env.REDIS_URL);
exports.isRedisEnabled = isRedisEnabled;
const redisOptions = {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0,
    enableReadyCheck: true,
    retryStrategy: () => null,
};
let redisClient = null;
let warningLogged = false;
const warnOnce = (message) => {
    if (warningLogged)
        return;
    warningLogged = true;
    console.warn(message);
};
const attachRedisErrorHandler = (client) => {
    client.on('error', (error) => {
        warnOnce(`Redis connection failed. Redis-backed features are disabled. ${error.message}`);
    });
    return client;
};
const getRedisClient = () => {
    if (!(0, exports.isRedisEnabled)()) {
        if (process.env.REDIS_ENABLED === 'true' && !process.env.REDIS_URL) {
            warnOnce('Redis is enabled but REDIS_URL is missing. Redis-backed features are disabled.');
        }
        return null;
    }
    if (!redisClient) {
        redisClient = attachRedisErrorHandler(new ioredis_1.default(process.env.REDIS_URL, redisOptions));
    }
    return redisClient;
};
exports.getRedisClient = getRedisClient;
const createRedisClient = () => {
    if (!(0, exports.isRedisEnabled)())
        return null;
    return attachRedisErrorHandler(new ioredis_1.default(process.env.REDIS_URL, redisOptions));
};
exports.createRedisClient = createRedisClient;
const connectRedis = async () => {
    const client = (0, exports.getRedisClient)();
    if (!client)
        return null;
    if (client.status === 'ready')
        return client;
    if (client.status === 'connect' || client.status === 'connecting')
        return client;
    try {
        await client.connect();
        return client;
    }
    catch (error) {
        warnOnce(`Redis connection failed. Redis-backed features are disabled. ${error instanceof Error ? error.message : String(error)}`);
        return null;
    }
};
exports.connectRedis = connectRedis;
exports.default = exports.getRedisClient;
//# sourceMappingURL=redis.js.map