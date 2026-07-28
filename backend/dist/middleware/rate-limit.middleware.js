"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mediaUploadRateLimiter = exports.supportRateLimiter = exports.paymentRateLimiter = exports.bookingWriteRateLimiter = exports.publicReadRateLimiter = exports.passwordResetRateLimiter = exports.bootstrapRateLimiter = exports.authRateLimiter = exports.createRateLimiter = void 0;
const redis_1 = require("../config/redis");
const metrics_service_1 = require("../services/metrics.service");
const buckets = new Map();
const getClientIp = (req) => {
    const forwardedFor = req.header('x-forwarded-for');
    if (forwardedFor) {
        return forwardedFor.split(',')[0]?.trim() || 'unknown';
    }
    return req.ip || req.socket.remoteAddress || 'unknown';
};
const cleanExpiredBuckets = (now) => {
    if (buckets.size < 10000 && Math.random() > 0.01)
        return;
    for (const [key, bucket] of buckets.entries()) {
        if (bucket.resetAt <= now) {
            buckets.delete(key);
        }
    }
};
const getPositiveIntegerEnv = (key, fallback) => {
    const parsed = Number.parseInt(process.env[key] || '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};
const emailIpKey = (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    return `${getClientIp(req)}:${email || 'no-email'}`;
};
const createRateLimiter = (options) => {
    return async (req, res, next) => {
        const now = Date.now();
        const rawKey = options.keyGenerator ? options.keyGenerator(req) : getClientIp(req);
        const key = `${options.keyPrefix}:${rawKey}`;
        const redisClient = await (0, redis_1.connectRedis)();
        if (redisClient) {
            try {
                const count = await redisClient.incr(key);
                if (count === 1) {
                    await redisClient.pexpire(key, options.windowMs);
                }
                const ttl = await redisClient.pttl(key);
                const resetAt = now + Math.max(ttl, 0);
                const remaining = Math.max(options.max - count, 0);
                res.setHeader('RateLimit-Limit', String(options.max));
                res.setHeader('RateLimit-Remaining', String(remaining));
                res.setHeader('RateLimit-Reset', String(Math.ceil(resetAt / 1000)));
                if (count > options.max) {
                    (0, metrics_service_1.incrementMetric)('rate_limit_rejections_total', { limiter: options.keyPrefix, store: 'redis' });
                    res.status(429).json({
                        success: false,
                        message: options.message,
                    });
                    return;
                }
                next();
                return;
            }
            catch (error) {
                console.warn('Redis rate limit check failed, using in-memory fallback:', error instanceof Error ? error.message : error);
            }
        }
        cleanExpiredBuckets(now);
        const existing = buckets.get(key);
        const bucket = existing && existing.resetAt > now
            ? existing
            : { count: 0, resetAt: now + options.windowMs };
        bucket.count += 1;
        buckets.set(key, bucket);
        const remaining = Math.max(options.max - bucket.count, 0);
        res.setHeader('RateLimit-Limit', String(options.max));
        res.setHeader('RateLimit-Remaining', String(remaining));
        res.setHeader('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));
        if (bucket.count > options.max) {
            (0, metrics_service_1.incrementMetric)('rate_limit_rejections_total', { limiter: options.keyPrefix, store: 'memory' });
            res.status(429).json({
                success: false,
                message: options.message,
            });
            return;
        }
        next();
    };
};
exports.createRateLimiter = createRateLimiter;
exports.authRateLimiter = (0, exports.createRateLimiter)({
    keyPrefix: 'auth',
    windowMs: 15 * 60 * 1000,
    max: getPositiveIntegerEnv('AUTH_RATE_LIMIT_MAX', 20),
    message: 'Too many sign-in or account attempts. Please wait and try again.',
    keyGenerator: emailIpKey,
});
exports.bootstrapRateLimiter = (0, exports.createRateLimiter)({
    keyPrefix: 'bootstrap-admin',
    windowMs: 60 * 60 * 1000,
    max: getPositiveIntegerEnv('BOOTSTRAP_ADMIN_RATE_LIMIT_MAX', 5),
    message: 'Too many setup attempts. Please wait and try again.',
});
exports.passwordResetRateLimiter = (0, exports.createRateLimiter)({
    keyPrefix: 'password-reset',
    windowMs: 60 * 60 * 1000,
    max: getPositiveIntegerEnv('PASSWORD_RESET_RATE_LIMIT_MAX', 5),
    message: 'Too many password reset attempts. Please wait and try again.',
    keyGenerator: emailIpKey,
});
exports.publicReadRateLimiter = (0, exports.createRateLimiter)({
    keyPrefix: 'public-read',
    windowMs: 60 * 1000,
    max: getPositiveIntegerEnv('PUBLIC_READ_RATE_LIMIT_MAX', 180),
    message: 'Too many requests. Please slow down and try again.',
});
exports.bookingWriteRateLimiter = (0, exports.createRateLimiter)({
    keyPrefix: 'booking-write',
    windowMs: 10 * 60 * 1000,
    max: getPositiveIntegerEnv('BOOKING_WRITE_RATE_LIMIT_MAX', 60),
    message: 'Too many booking actions. Please wait and try again.',
});
exports.paymentRateLimiter = (0, exports.createRateLimiter)({
    keyPrefix: 'payment',
    windowMs: 10 * 60 * 1000,
    max: getPositiveIntegerEnv('PAYMENT_RATE_LIMIT_MAX', 40),
    message: 'Too many payment attempts. Please wait and try again.',
});
exports.supportRateLimiter = (0, exports.createRateLimiter)({
    keyPrefix: 'support',
    windowMs: 5 * 60 * 1000,
    max: getPositiveIntegerEnv('SUPPORT_RATE_LIMIT_MAX', 60),
    message: 'Too many support messages. Please wait and try again.',
});
exports.mediaUploadRateLimiter = (0, exports.createRateLimiter)({
    keyPrefix: 'media-upload',
    windowMs: 10 * 60 * 1000,
    max: getPositiveIntegerEnv('MEDIA_UPLOAD_RATE_LIMIT_MAX', 30),
    message: 'Too many image uploads. Please wait and try again.',
});
//# sourceMappingURL=rate-limit.middleware.js.map