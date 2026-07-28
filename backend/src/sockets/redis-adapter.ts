import { createAdapter } from '@socket.io/redis-adapter';
import { Server as SocketIOServer } from 'socket.io';
import { createRedisClient, isRedisEnabled } from '../config/redis';

const adapterEnabled = (): boolean =>
  isRedisEnabled() && process.env.SOCKET_REDIS_ADAPTER_ENABLED === 'true';

export const configureSocketRedisAdapter = async (io: SocketIOServer): Promise<void> => {
  if (!adapterEnabled()) return;

  const pubClient = createRedisClient();
  const subClient = pubClient?.duplicate();
  if (!pubClient || !subClient) return;

  try {
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    console.info('Socket.IO Redis adapter enabled.');
  } catch (error) {
    console.warn('Socket.IO Redis adapter unavailable. Continuing with single-instance adapter:', error instanceof Error ? error.message : error);
    pubClient.disconnect();
    subClient.disconnect();
  }
};
