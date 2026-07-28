import dns from 'dns';
import { promises as dnsPromises } from 'dns';

dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '1.1.1.1']);
dnsPromises.setServers(['8.8.8.8', '1.1.1.1']);

import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import { dequeueWorkerTask, WorkerQueueName } from './services/worker-queue.service';
import { processDueNotifications, processNotificationQueueTask } from './services/notification.service';
import { incrementMetric } from './services/metrics.service';
import { processStandbyDispatchRetry } from './services/dispatch-retry.service';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
require('../../config/load-platform-config').loadPlatformConfig({ override: false });

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

let shuttingDown = false;

const processOnce = async (): Promise<void> => {
  const notificationTask = await dequeueWorkerTask(WorkerQueueName.NOTIFICATION_DELIVERY, 1);
  if (notificationTask) {
    try {
      await processNotificationQueueTask(notificationTask.id);
      incrementMetric('worker_tasks_processed_total', { queue: notificationTask.name });
    } catch (error) {
      incrementMetric('worker_tasks_failed_total', { queue: notificationTask.name });
      console.warn('Worker task failed:', error instanceof Error ? error.message : error);
    }
    return;
  }

  const dispatchTask = await dequeueWorkerTask(WorkerQueueName.DISPATCH_RETRY, 1);
  if (dispatchTask) {
    try {
      const retryUntil =
        typeof dispatchTask.payload?.retryUntil === 'string'
          ? new Date(dispatchTask.payload.retryUntil)
          : undefined;
      await processStandbyDispatchRetry({
        bookingId: dispatchTask.id,
        retryUntil: retryUntil && !Number.isNaN(retryUntil.getTime()) ? retryUntil : undefined,
      });
      incrementMetric('worker_tasks_processed_total', { queue: dispatchTask.name });
    } catch (error) {
      incrementMetric('worker_tasks_failed_total', { queue: dispatchTask.name });
      console.warn('Worker task failed:', error instanceof Error ? error.message : error);
    }
    return;
  }

  await processDueNotifications(Number(process.env.WORKER_NOTIFICATION_BATCH_SIZE || 25));
  await sleep(Number(process.env.WORKER_IDLE_SLEEP_MS || 1500));
};

const main = async (): Promise<void> => {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI is required.');

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 10000,
    autoIndex: false,
  });

  console.info('Padi worker started.');
  while (!shuttingDown) {
    await processOnce();
  }
};

process.on('SIGINT', () => { shuttingDown = true; });
process.on('SIGTERM', () => { shuttingDown = true; });

main()
  .catch((error) => {
    console.error('Padi worker failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });
