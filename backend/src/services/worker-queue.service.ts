import { connectRedis } from '../config/redis';
import { incrementMetric } from './metrics.service';

export enum WorkerQueueName {
  NOTIFICATION_DELIVERY = 'notification-delivery',
  DISPATCH_RETRY = 'dispatch-retry',
  PAYMENT_SIDE_EFFECT = 'payment-side-effect',
}

export interface WorkerTask {
  name: WorkerQueueName;
  id: string;
  payload?: Record<string, unknown>;
  runAt?: string;
}

const queueEnabled = (): boolean =>
  process.env.WORKER_QUEUE_ENABLED === 'true' && process.env.REDIS_ENABLED === 'true';

const immediateKey = (name: WorkerQueueName): string => `padi:queue:${name}`;
const delayedKey = (name: WorkerQueueName): string => `padi:queue:${name}:delayed`;

export const isWorkerQueueEnabled = (): boolean => queueEnabled();

export const enqueueWorkerTask = async (task: WorkerTask): Promise<boolean> => {
  if (!queueEnabled()) return false;
  const redis = await connectRedis();
  if (!redis) return false;

  const serialized = JSON.stringify(task);
  const runAt = task.runAt ? new Date(task.runAt).getTime() : Date.now();
  if (runAt > Date.now()) {
    await redis.zadd(delayedKey(task.name), runAt, serialized);
  } else {
    await redis.lpush(immediateKey(task.name), serialized);
  }
  incrementMetric('worker_tasks_enqueued_total', { queue: task.name });
  return true;
};

export const promoteDueWorkerTasks = async (name: WorkerQueueName, limit = 100): Promise<number> => {
  if (!queueEnabled()) return 0;
  const redis = await connectRedis();
  if (!redis) return 0;

  const due = await redis.zrangebyscore(delayedKey(name), 0, Date.now(), 'LIMIT', 0, limit);
  if (!due.length) return 0;

  const pipeline = redis.pipeline();
  due.forEach((task) => {
    pipeline.zrem(delayedKey(name), task);
    pipeline.lpush(immediateKey(name), task);
  });
  await pipeline.exec();
  return due.length;
};

export const dequeueWorkerTask = async (name: WorkerQueueName, timeoutSeconds = 2): Promise<WorkerTask | null> => {
  if (!queueEnabled()) return null;
  const redis = await connectRedis();
  if (!redis) return null;

  await promoteDueWorkerTasks(name);
  const result = await redis.brpop(immediateKey(name), timeoutSeconds);
  if (!result?.[1]) return null;

  try {
    return JSON.parse(result[1]) as WorkerTask;
  } catch {
    incrementMetric('worker_tasks_invalid_total', { queue: name });
    return null;
  }
};
