import { NextFunction, Request, Response } from 'express';
import { connectRedis } from '../config/redis';
import { incrementMetric } from '../services/metrics.service';

type RateLimitKeyGenerator = (req: Request) => string;

interface RateLimitOptions {
  keyPrefix: string;
  windowMs: number;
  max: number;
  message: string;
  keyGenerator?: RateLimitKeyGenerator;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimitBucket>();

const getClientIp = (req: Request): string => {
  const forwardedFor = req.header('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
};

const cleanExpiredBuckets = (now: number): void => {
  if (buckets.size < 10000 && Math.random() > 0.01) return;
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
};

const getPositiveIntegerEnv = (key: string, fallback: number): number => {
  const parsed = Number.parseInt(process.env[key] || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const emailIpKey = (req: Request): string => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  return `${getClientIp(req)}:${email || 'no-email'}`;
};

export const createRateLimiter = (options: RateLimitOptions) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const now = Date.now();
    const rawKey = options.keyGenerator ? options.keyGenerator(req) : getClientIp(req);
    const key = `${options.keyPrefix}:${rawKey}`;

    const redisClient = await connectRedis();
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
          incrementMetric('rate_limit_rejections_total', { limiter: options.keyPrefix, store: 'redis' });
          res.status(429).json({
            success: false,
            message: options.message,
          });
          return;
        }

        next();
        return;
      } catch (error) {
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
      incrementMetric('rate_limit_rejections_total', { limiter: options.keyPrefix, store: 'memory' });
      res.status(429).json({
        success: false,
        message: options.message,
      });
      return;
    }

    next();
  };
};

export const authRateLimiter = createRateLimiter({
  keyPrefix: 'auth',
  windowMs: 15 * 60 * 1000,
  max: getPositiveIntegerEnv('AUTH_RATE_LIMIT_MAX', 20),
  message: 'Too many sign-in or account attempts. Please wait and try again.',
  keyGenerator: emailIpKey,
});

export const bootstrapRateLimiter = createRateLimiter({
  keyPrefix: 'bootstrap-admin',
  windowMs: 60 * 60 * 1000,
  max: getPositiveIntegerEnv('BOOTSTRAP_ADMIN_RATE_LIMIT_MAX', 5),
  message: 'Too many setup attempts. Please wait and try again.',
});

export const passwordResetRateLimiter = createRateLimiter({
  keyPrefix: 'password-reset',
  windowMs: 60 * 60 * 1000,
  max: getPositiveIntegerEnv('PASSWORD_RESET_RATE_LIMIT_MAX', 5),
  message: 'Too many password reset attempts. Please wait and try again.',
  keyGenerator: emailIpKey,
});

export const publicReadRateLimiter = createRateLimiter({
  keyPrefix: 'public-read',
  windowMs: 60 * 1000,
  max: getPositiveIntegerEnv('PUBLIC_READ_RATE_LIMIT_MAX', 180),
  message: 'Too many requests. Please slow down and try again.',
});

export const bookingWriteRateLimiter = createRateLimiter({
  keyPrefix: 'booking-write',
  windowMs: 10 * 60 * 1000,
  max: getPositiveIntegerEnv('BOOKING_WRITE_RATE_LIMIT_MAX', 60),
  message: 'Too many booking actions. Please wait and try again.',
});

export const paymentRateLimiter = createRateLimiter({
  keyPrefix: 'payment',
  windowMs: 10 * 60 * 1000,
  max: getPositiveIntegerEnv('PAYMENT_RATE_LIMIT_MAX', 40),
  message: 'Too many payment attempts. Please wait and try again.',
});

export const supportRateLimiter = createRateLimiter({
  keyPrefix: 'support',
  windowMs: 5 * 60 * 1000,
  max: getPositiveIntegerEnv('SUPPORT_RATE_LIMIT_MAX', 60),
  message: 'Too many support messages. Please wait and try again.',
});

export const mediaUploadRateLimiter = createRateLimiter({
  keyPrefix: 'media-upload',
  windowMs: 10 * 60 * 1000,
  max: getPositiveIntegerEnv('MEDIA_UPLOAD_RATE_LIMIT_MAX', 30),
  message: 'Too many image uploads. Please wait and try again.',
});
