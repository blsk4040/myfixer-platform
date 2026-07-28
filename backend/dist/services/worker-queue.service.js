"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dequeueWorkerTask = exports.promoteDueWorkerTasks = exports.enqueueWorkerTask = exports.isWorkerQueueEnabled = exports.WorkerQueueName = void 0;
const redis_1 = require("../config/redis");
const metrics_service_1 = require("./metrics.service");
var WorkerQueueName;
(function (WorkerQueueName) {
    WorkerQueueName["NOTIFICATION_DELIVERY"] = "notification-delivery";
    WorkerQueueName["DISPATCH_RETRY"] = "dispatch-retry";
    WorkerQueueName["PAYMENT_SIDE_EFFECT"] = "payment-side-effect";
})(WorkerQueueName || (exports.WorkerQueueName = WorkerQueueName = {}));
const queueEnabled = () => process.env.WORKER_QUEUE_ENABLED === 'true' && process.env.REDIS_ENABLED === 'true';
const immediateKey = (name) => `padi:queue:${name}`;
const delayedKey = (name) => `padi:queue:${name}:delayed`;
const isWorkerQueueEnabled = () => queueEnabled();
exports.isWorkerQueueEnabled = isWorkerQueueEnabled;
const enqueueWorkerTask = async (task) => {
    if (!queueEnabled())
        return false;
    const redis = await (0, redis_1.connectRedis)();
    if (!redis)
        return false;
    const serialized = JSON.stringify(task);
    const runAt = task.runAt ? new Date(task.runAt).getTime() : Date.now();
    if (runAt > Date.now()) {
        await redis.zadd(delayedKey(task.name), runAt, serialized);
    }
    else {
        await redis.lpush(immediateKey(task.name), serialized);
    }
    (0, metrics_service_1.incrementMetric)('worker_tasks_enqueued_total', { queue: task.name });
    return true;
};
exports.enqueueWorkerTask = enqueueWorkerTask;
const promoteDueWorkerTasks = async (name, limit = 100) => {
    if (!queueEnabled())
        return 0;
    const redis = await (0, redis_1.connectRedis)();
    if (!redis)
        return 0;
    const due = await redis.zrangebyscore(delayedKey(name), 0, Date.now(), 'LIMIT', 0, limit);
    if (!due.length)
        return 0;
    const pipeline = redis.pipeline();
    due.forEach((task) => {
        pipeline.zrem(delayedKey(name), task);
        pipeline.lpush(immediateKey(name), task);
    });
    await pipeline.exec();
    return due.length;
};
exports.promoteDueWorkerTasks = promoteDueWorkerTasks;
const dequeueWorkerTask = async (name, timeoutSeconds = 2) => {
    if (!queueEnabled())
        return null;
    const redis = await (0, redis_1.connectRedis)();
    if (!redis)
        return null;
    await (0, exports.promoteDueWorkerTasks)(name);
    const result = await redis.brpop(immediateKey(name), timeoutSeconds);
    if (!result?.[1])
        return null;
    try {
        return JSON.parse(result[1]);
    }
    catch {
        (0, metrics_service_1.incrementMetric)('worker_tasks_invalid_total', { queue: name });
        return null;
    }
};
exports.dequeueWorkerTask = dequeueWorkerTask;
//# sourceMappingURL=worker-queue.service.js.map