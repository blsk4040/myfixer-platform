"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dns_1 = __importDefault(require("dns"));
const dns_2 = require("dns");
dns_1.default.setDefaultResultOrder('ipv4first');
dns_1.default.setServers(['8.8.8.8', '1.1.1.1']);
dns_2.promises.setServers(['8.8.8.8', '1.1.1.1']);
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const mongoose_1 = __importDefault(require("mongoose"));
const worker_queue_service_1 = require("./services/worker-queue.service");
const notification_service_1 = require("./services/notification.service");
const metrics_service_1 = require("./services/metrics.service");
const dispatch_retry_service_1 = require("./services/dispatch-retry.service");
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), '.env') });
require('../../config/load-platform-config').loadPlatformConfig({ override: false });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let shuttingDown = false;
const processOnce = async () => {
    const notificationTask = await (0, worker_queue_service_1.dequeueWorkerTask)(worker_queue_service_1.WorkerQueueName.NOTIFICATION_DELIVERY, 1);
    if (notificationTask) {
        try {
            await (0, notification_service_1.processNotificationQueueTask)(notificationTask.id);
            (0, metrics_service_1.incrementMetric)('worker_tasks_processed_total', { queue: notificationTask.name });
        }
        catch (error) {
            (0, metrics_service_1.incrementMetric)('worker_tasks_failed_total', { queue: notificationTask.name });
            console.warn('Worker task failed:', error instanceof Error ? error.message : error);
        }
        return;
    }
    const dispatchTask = await (0, worker_queue_service_1.dequeueWorkerTask)(worker_queue_service_1.WorkerQueueName.DISPATCH_RETRY, 1);
    if (dispatchTask) {
        try {
            const retryUntil = typeof dispatchTask.payload?.retryUntil === 'string'
                ? new Date(dispatchTask.payload.retryUntil)
                : undefined;
            await (0, dispatch_retry_service_1.processStandbyDispatchRetry)({
                bookingId: dispatchTask.id,
                retryUntil: retryUntil && !Number.isNaN(retryUntil.getTime()) ? retryUntil : undefined,
            });
            (0, metrics_service_1.incrementMetric)('worker_tasks_processed_total', { queue: dispatchTask.name });
        }
        catch (error) {
            (0, metrics_service_1.incrementMetric)('worker_tasks_failed_total', { queue: dispatchTask.name });
            console.warn('Worker task failed:', error instanceof Error ? error.message : error);
        }
        return;
    }
    await (0, notification_service_1.processDueNotifications)(Number(process.env.WORKER_NOTIFICATION_BATCH_SIZE || 25));
    await sleep(Number(process.env.WORKER_IDLE_SLEEP_MS || 1500));
};
const main = async () => {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri)
        throw new Error('MONGODB_URI is required.');
    await mongoose_1.default.connect(mongoUri, {
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
    await mongoose_1.default.disconnect().catch(() => undefined);
});
//# sourceMappingURL=worker.js.map