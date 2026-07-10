import { NextFunction, Request, Response } from 'express';
import { routingService } from './routing.service';
import { RoutingError } from './routing.types';
import { validateRouteRequest } from './routing.validation';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;
const buckets = new Map<string, { count: number; resetAt: number }>();

export const routeRateLimit = (request: Request, response: Response, next: NextFunction): void => {
  const userId = String((request as any).user?.id ?? request.ip ?? 'anonymous');
  const now = Date.now();
  const bucket = buckets.get(userId);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    next();
    return;
  }

  if (bucket.count >= RATE_LIMIT_MAX) {
    response.status(429).json({ success: false, message: 'Too many route requests. Please try again shortly.' });
    return;
  }

  bucket.count += 1;
  next();
};

export const calculateRoute = async (request: Request, response: Response): Promise<void> => {
  const validation = validateRouteRequest(request.body);
  if (!validation.value) {
    response.status(400).json({ success: false, message: validation.message || 'Invalid route request.' });
    return;
  }

  try {
    const result = await routingService.calculateRoute(validation.value, (request as any).user);
    response.status(200).json({ success: true, data: result });
  } catch (error) {
    if (error instanceof RoutingError) {
      response.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
      return;
    }

    response.status(500).json({ success: false, message: 'Road routing is temporarily unavailable.' });
  }
};
