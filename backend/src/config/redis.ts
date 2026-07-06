import Redis, { RedisOptions } from 'ioredis';

export const isRedisEnabled = (): boolean =>
  process.env.REDIS_ENABLED === 'true' && Boolean(process.env.REDIS_URL);

const redisOptions: RedisOptions = {
  lazyConnect: true,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 0,
  enableReadyCheck: true,
  retryStrategy: () => null,
};

let redisClient: Redis | null = null;
let warningLogged = false;

const warnOnce = (message: string): void => {
  if (warningLogged) return;
  warningLogged = true;
  console.warn(message);
};

export const getRedisClient = (): Redis | null => {
  if (!isRedisEnabled()) {
    if (process.env.REDIS_ENABLED === 'true' && !process.env.REDIS_URL) {
      warnOnce('Redis is enabled but REDIS_URL is missing. Redis-backed features are disabled.');
    }
    return null;
  }

  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL as string, redisOptions);
    redisClient.on('error', (error: Error) => {
      warnOnce(`Redis connection failed. Redis-backed features are disabled. ${error.message}`);
    });
  }

  return redisClient;
};

export const connectRedis = async (): Promise<Redis | null> => {
  const client = getRedisClient();
  if (!client) return null;

  if (client.status === 'ready') return client;
  if (client.status === 'connect' || client.status === 'connecting') return client;

  try {
    await client.connect();
    return client;
  } catch (error) {
    warnOnce(`Redis connection failed. Redis-backed features are disabled. ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
};

export default getRedisClient;
