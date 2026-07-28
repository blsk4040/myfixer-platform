import { Emitter } from '@socket.io/redis-emitter';
import { createRedisClient, isRedisEnabled } from '../config/redis';

const emitterEnabled = (): boolean =>
  isRedisEnabled() && process.env.SOCKET_REDIS_ADAPTER_ENABLED === 'true';

let emitter: Emitter | null = null;
let emitterClient: ReturnType<typeof createRedisClient> = null;
let warningLogged = false;

const warnOnce = (message: string): void => {
  if (warningLogged) return;
  warningLogged = true;
  console.warn(message);
};

export const getSocketRedisEmitter = async (): Promise<Emitter | null> => {
  if (!emitterEnabled()) return null;
  if (emitter) return emitter;

  const client = emitterClient ?? createRedisClient();
  if (!client) return null;

  try {
    if (client.status !== 'ready') {
      await client.connect();
    }
    emitterClient = client;
    emitter = new Emitter(client);
    return emitter;
  } catch (error) {
    warnOnce(`Socket.IO Redis emitter unavailable. Worker broadcasts will rely on push notifications. ${error instanceof Error ? error.message : String(error)}`);
    client.disconnect();
    return null;
  }
};

export const emitSocketRoomEvent = async (
  room: string,
  event: string,
  payload: unknown
): Promise<boolean> => {
  const redisEmitter = await getSocketRedisEmitter();
  if (!redisEmitter) return false;

  redisEmitter.to(room).emit(event, payload);
  return true;
};
