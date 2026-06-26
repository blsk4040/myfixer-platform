// src/server.ts
import dns from 'dns';
import { promises as dnsPromises } from 'dns';

dns.setDefaultResultOrder('ipv4first');
dnsPromises.setServers(['8.8.8.8', '1.1.1.1']);

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import express, { Application, Request, Response } from 'express';
import http, { Server as HttpServer } from 'http';
import cors, { CorsOptions } from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { Server as SocketIOServer } from 'socket.io';

import apiRouter from './routes/api.routes';
import { registerSocketServer } from './sockets/socket.server';

const parseAllowedOrigins = (): string[] => {
  const configuredOrigins = process.env.CORS_ORIGIN ?? process.env.CORS_ORIGINS;
  if (!configuredOrigins) {
    return [
      'http://localhost:19006',
      'http://localhost:3000',
      'http://192.168.3.34:8081',
      'http://192.168.3.34:8082',
      'http://192.168.3.34:8083',
    ];
  }
  return configuredOrigins.split(',').map((o) => o.trim()).filter(Boolean);
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
  cors: { origin: allowedOrigins, credentials: true, methods: ['GET', 'POST'] },
});

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.set('io', io);

// Versioned umbrella endpoints
app.use('/api/v1', apiRouter);

app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'myfixer-backend',
    timestamp: new Date().toISOString(),
  });
});

registerSocketServer(io);

const port = Number.parseInt(process.env.PORT ?? '5000', 10);
const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error('❌ MONGODB_URI is not defined in environment variables!');
  process.exit(1);
}

mongoose.set('strictQuery', true);

const startServer = async () => {
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000, autoIndex: true });
    console.info('💾 MongoDB Atlas connected successfully');
    httpServer.listen(port, '0.0.0.0', () => {
      console.info(`🚀 MyFixer backend running on port ${port}`);
    });
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}