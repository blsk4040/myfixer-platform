"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectRedis = exports.redisClient = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const parsePort = (value, fallback) => {
    if (!value) {
        return fallback;
    }
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
};
const redisOptions = {
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    port: parsePort(process.env.REDIS_PORT, 6379),
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
};
exports.redisClient = new ioredis_1.default(redisOptions);
exports.redisClient.on('error', (error) => {
    console.error('Redis connection error', error);
});
const connectRedis = async () => {
    if (exports.redisClient.status === 'ready' || exports.redisClient.status === 'connect') {
        return;
    }
    await exports.redisClient.connect();
};
exports.connectRedis = connectRedis;
exports.default = exports.redisClient;
//# sourceMappingURL=redis.js.map