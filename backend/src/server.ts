// src/server.ts

import dns from 'dns';

import { promises as dnsPromises } from 'dns';

dns.setDefaultResultOrder('ipv4first');

dns.setServers(['8.8.8.8', '1.1.1.1']);

dnsPromises.setServers(['8.8.8.8', '1.1.1.1']);

import dotenv from 'dotenv';

import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

require('../../config/load-platform-config').loadPlatformConfig({ override: false });

import express, { Application, Request, Response } from 'express';

import http, { Server as HttpServer } from 'http';

import cors, { CorsOptions } from 'cors';

import helmet from 'helmet';

import morgan from 'morgan';

import mongoose from 'mongoose';

import { Server as SocketIOServer } from 'socket.io';

import apiRouter from './routes/api.routes';

import preLaunchRegistrationRoutes from './routes/prelaunch-registration.routes';

import { registerSocketServer } from './sockets/socket.server';

import { configureSocketRedisAdapter } from './sockets/redis-adapter';

import { validatePaystackStartupConfiguration } from './services/paystack.service';

import { validatePayoutStartupConfiguration } from './config/payment-capabilities.config';

import { metricsMiddleware } from './middleware/metrics.middleware';

import { renderMetrics } from './services/metrics.service';

const isProductionRuntime = (): boolean =>
  process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production';

const requireConfiguredEnv = (name: string): string => {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} must be configured in production.`);
  }

  return value;
};

const requireHttpsUrl = (name: string): void => {
  const value = requireConfiguredEnv(name);

  if (!/^https:\/\/[^\s]+$/i.test(value)) {
    throw new Error(`${name} must be a valid HTTPS URL in production.`);
  }
};

const assertNoLocalProductionOrigin = (origin: string): void => {
  if (
    /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d+)?/i.test(
      origin
    )
  ) {
    throw new Error(
      'CORS_ORIGINS must not include localhost addresses in production.'
    );
  }
};

const validateStartupConfiguration = (): void => {
  const routingProvider = (
    process.env.ROUTING_PROVIDER || 'osrm'
  )
    .trim()
    .toLowerCase();

  const isProduction = isProductionRuntime();

  if (isProduction) {
    requireConfiguredEnv('MONGODB_URI');

    const jwtSecret = requireConfiguredEnv('JWT_SECRET');

    if (jwtSecret.length < 48) {
      throw new Error(
        'JWT_SECRET must be at least 48 characters in production.'
      );
    }

    requireHttpsUrl('ADMIN_PORTAL_URL');

    requireHttpsUrl('API_BASE_URL');

    requireHttpsUrl('SOCKET_URL');

    requireConfiguredEnv('RESEND_API_KEY');

    requireConfiguredEnv('RESEND_FROM_EMAIL');

    requireConfiguredEnv('CLOUDINARY_CLOUD_NAME');

    requireConfiguredEnv('CLOUDINARY_API_KEY');

    requireConfiguredEnv('CLOUDINARY_API_SECRET');

    requireConfiguredEnv('GOOGLE_WEB_CLIENT_ID');

    requireConfiguredEnv('GOOGLE_ANDROID_CLIENT_ID');

    const configuredOrigins = (
      process.env.CORS_ORIGIN ??
      process.env.CORS_ORIGINS ??
      ''
    ).trim();

    if (!configuredOrigins) {
      throw new Error('CORS_ORIGINS must be configured in production.');
    }

    configuredOrigins
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
      .forEach((origin) => {
        if (!/^https:\/\/[^\s]+$/i.test(origin)) {
          throw new Error(
            'CORS_ORIGINS must contain only HTTPS origins in production.'
          );
        }

        assertNoLocalProductionOrigin(origin);
      });
  }

  if (
    isProduction &&
    routingProvider === 'osrm' &&
    !process.env.OSRM_BASE_URL?.trim()
  ) {
    throw new Error(
      'OSRM_BASE_URL must be configured when ROUTING_PROVIDER=osrm in production.'
    );
  }

  if (
    process.env.NODE_ENV === 'production' ||
    (process.env.PAYSTACK_ENABLED || '').trim().toLowerCase() === 'true'
  ) {
    validatePaystackStartupConfiguration();
  }

  validatePayoutStartupConfiguration();
};

validateStartupConfiguration();

const parseAllowedOrigins = (): string[] => {
  const configuredOrigins =
    process.env.CORS_ORIGIN ?? process.env.CORS_ORIGINS;

  if (!configuredOrigins) {
    return [process.env.ADMIN_PORTAL_URL].filter(
      (origin): origin is string => Boolean(origin)
    );
  }

  return configuredOrigins
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
};

const allowedOrigins = parseAllowedOrigins();

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },

  credentials: true,
};

export const app: Application = express();

export const httpServer: HttpServer = http.createServer(app);

export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST'],
  },
});

app.use(helmet());

app.set('trust proxy', isProductionRuntime() ? 1 : false);

app.use(cors(corsOptions));

app.use(metricsMiddleware);

const jsonBodyLimit = process.env.JSON_BODY_LIMIT || '8mb';

app.use(
  express.json({
    limit: jsonBodyLimit,
    verify: (req, _res, buf) => {
      (req as any).rawBody = Buffer.from(buf);
    },
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: jsonBodyLimit,
  })
);

app.use(
  morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev')
);

app.set('io', io);

// Versioned umbrella endpoints
app.use('/api/v1', apiRouter);

// Pre-launch registration
app.use(
  '/api/v1/prelaunch-registration',
  preLaunchRegistrationRoutes
);

app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'myfixer-backend',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/metrics', (req: Request, res: Response) => {
  const metricsToken = process.env.METRICS_TOKEN?.trim();

  if (isProductionRuntime()) {
    if (!metricsToken) {
      res.status(404).json({
        message: 'Not found.',
      });

      return;
    }

    const provided = req
      .header('authorization')
      ?.replace(/^Bearer\s+/i, '')
      .trim();

    if (provided !== metricsToken) {
      res.status(403).json({
        message: 'Metrics access denied.',
      });

      return;
    }
  }

  res.setHeader('Content-Type', 'text/plain; version=0.0.4');

  res.status(200).send(renderMetrics());
});

void configureSocketRedisAdapter(io).finally(() =>
  registerSocketServer(io)
);

const port = Number.parseInt(process.env.PORT ?? '5000', 10);

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error(
    '❌ MONGODB_URI is not defined in environment variables!'
  );

  process.exit(1);
}

mongoose.set('strictQuery', true);

let isShuttingDown = false;

const shutdown = async (signal: string) => {
  if (isShuttingDown) return;

  isShuttingDown = true;

  console.info(
    `${signal} received. Shutting down MyFixer backend...`
  );

  httpServer.close(async () => {
    try {
      await mongoose.disconnect();

      console.info(
        'HTTP server closed and MongoDB disconnected.'
      );

      process.exit(0);
    } catch (error) {
      console.error(
        'Error while disconnecting MongoDB:',
        error
      );

      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error('Forced shutdown after timeout.');

    process.exit(1);
  }, 5000);
};

const startServer = async () => {
  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      autoIndex: true,
    });

    console.info('💾 MongoDB Atlas connected successfully');

    httpServer.listen(port, '0.0.0.0', () => {
      console.info(
        `🚀 MyFixer backend running on port ${port}`
      );
    });
  } catch (error) {
    console.error(
      '❌ Failed to connect to MongoDB:',
      error
    );

    process.exit(1);
  }
};

httpServer.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `❌ Port ${port} is already in use. Stop the existing local backend process or set PORT to a free port before starting again.`
    );

    console.error(
      `   Windows check: netstat -ano | findstr :${port}`
    );

    console.error(
      `   Windows stop:  taskkill /PID <PID> /F`
    );
  } else {
    console.error(
      '❌ HTTP server failed to start:',
      error
    );
  }

  void mongoose.disconnect().finally(() =>
    process.exit(1)
  );
});

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

if (require.main === module) {
  void startServer();
}