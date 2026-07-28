import { NextFunction, Request, Response } from 'express';
import { incrementMetric, observeMetric } from '../services/metrics.service';

const routeLabel = (req: Request): string => {
  const routePath = req.route?.path;
  if (typeof routePath === 'string') return routePath;
  return req.path.replace(/[0-9a-f]{24}/gi, ':id');
};

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const started = Date.now();
  res.on('finish', () => {
    const labels = {
      method: req.method,
      route: routeLabel(req),
      status: res.statusCode,
    };
    incrementMetric('http_requests_total', labels);
    observeMetric('http_request_duration_ms', Date.now() - started, {
      method: req.method,
      route: routeLabel(req),
    });
  });
  next();
};
