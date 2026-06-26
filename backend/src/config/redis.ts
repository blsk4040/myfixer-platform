import Redis, { RedisOptions } from 'ioredis';

const parsePort = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const redisOptions: RedisOptions = {
  host: process.env.REDIS_HOST ?? '127.0.0.1',
  port: parsePort(process.env.REDIS_PORT, 6379),
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
};

export const redisClient = new Redis(redisOptions);

redisClient.on('error', (error: Error) => {
  console.error('Redis connection error', error);
});

export const connectRedis = async (): Promise<void> => {
  if (redisClient.status === 'ready' || redisClient.status === 'connect') {
    return;
  }

  await redisClient.connect();
};

export default redisClient;
