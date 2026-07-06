"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.retryNotification = exports.processDueNotifications = exports.deliverNotification = exports.createNotifications = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const notification_model_1 = __importStar(require("../models/notification.model"));
const notification_preference_model_1 = __importDefault(require("../models/notification-preference.model"));
const user_model_1 = __importDefault(require("../models/user.model"));
const email_service_1 = require("./email/email.service");
const audit_log_model_1 = __importStar(require("../models/audit-log.model"));
const channelPreferenceMap = {
    [notification_model_1.NotificationChannel.IN_APP]: 'inApp',
    [notification_model_1.NotificationChannel.EMAIL]: 'email',
    [notification_model_1.NotificationChannel.PUSH]: 'push',
    [notification_model_1.NotificationChannel.SMS]: 'sms',
    [notification_model_1.NotificationChannel.WHATSAPP]: 'whatsapp',
};
const enabledPhaseFourChannels = new Set([
    notification_model_1.NotificationChannel.IN_APP,
    notification_model_1.NotificationChannel.EMAIL,
]);
const getPreferenceChannels = async (userId) => {
    const defaults = {
        inApp: true,
        email: true,
        push: false,
        sms: false,
        whatsapp: false,
    };
    if (!userId)
        return defaults;
    const preference = await notification_preference_model_1.default.findOneAndUpdate({ userId }, { $setOnInsert: { userId, channels: defaults } }, { new: true, upsert: true, runValidators: true }).lean();
    return {
        ...defaults,
        ...(preference?.channels || {}),
    };
};
const shouldCreateForChannel = async (userId, channel) => {
    const preferences = await getPreferenceChannels(userId);
    return Boolean(preferences[channelPreferenceMap[channel]]);
};
const inAppProvider = {
    async send() {
        return { success: true };
    },
};
const emailProvider = {
    async send(notification) {
        if (!notification.recipient.email) {
            return { success: false, error: 'Recipient email is missing.' };
        }
        const sent = await email_service_1.EmailService.sendNotificationEmail({
            recipientEmail: notification.recipient.email,
            title: notification.title,
            message: notification.message,
            customerName: notification.recipient.name,
            collectionDate: typeof notification.metadata.collectionDate === 'string'
                ? notification.metadata.collectionDate
                : undefined,
            address: typeof notification.metadata.address === 'string'
                ? notification.metadata.address
                : undefined,
        });
        return sent
            ? { success: true }
            : { success: false, error: 'Email provider is not configured or delivery failed.' };
    },
};
const disabledProvider = (channel) => ({
    async send() {
        return { success: false, error: `${channel} delivery is disabled in Phase 4.` };
    },
});
const providers = {
    [notification_model_1.NotificationChannel.IN_APP]: inAppProvider,
    [notification_model_1.NotificationChannel.EMAIL]: emailProvider,
    [notification_model_1.NotificationChannel.PUSH]: disabledProvider(notification_model_1.NotificationChannel.PUSH),
    [notification_model_1.NotificationChannel.SMS]: disabledProvider(notification_model_1.NotificationChannel.SMS),
    [notification_model_1.NotificationChannel.WHATSAPP]: disabledProvider(notification_model_1.NotificationChannel.WHATSAPP),
};
const createNotifications = async (input) => {
    const userId = input.userId && mongoose_1.default.Types.ObjectId.isValid(String(input.userId))
        ? new mongoose_1.default.Types.ObjectId(String(input.userId))
        : undefined;
    const user = userId
        ? await user_model_1.default.findById(userId).select('name email phone').lean()
        : null;
    const requestedChannels = input.channels?.length
        ? input.channels
        : [notification_model_1.NotificationChannel.IN_APP, notification_model_1.NotificationChannel.EMAIL];
    const scheduledAt = input.scheduledAt || new Date();
    const initialStatus = scheduledAt.getTime() > Date.now()
        ? notification_model_1.NotificationStatus.SCHEDULED
        : notification_model_1.NotificationStatus.PENDING;
    const documents = [];
    for (const channel of requestedChannels) {
        if (!Object.values(notification_model_1.NotificationChannel).includes(channel))
            continue;
        const preferenceAllowed = await shouldCreateForChannel(userId, channel);
        if (!preferenceAllowed)
            continue;
        documents.push({
            recipient: {
                userId,
                email: input.email || user?.email || '',
                phone: input.phone || user?.phone || '',
                name: input.name || user?.name || '',
            },
            channel,
            type: input.type,
            title: input.title,
            message: input.message,
            status: enabledPhaseFourChannels.has(channel)
                ? initialStatus
                : notification_model_1.NotificationStatus.FAILED,
            scheduledAt,
            lastError: enabledPhaseFourChannels.has(channel) ? '' : `${channel} delivery is disabled in Phase 4.`,
            metadata: input.metadata || {},
        });
    }
    if (!documents.length)
        return [];
    const notifications = await notification_model_1.default.create(documents);
    await audit_log_model_1.default.insertMany(notifications.map((notification) => ({
        actor: {
            email: 'system@myfixer.internal',
            role: 'SYSTEM',
        },
        event: {
            action: 'notification.created',
            module: audit_log_model_1.AuditModule.NOTIFICATIONS,
            resourceType: 'Notification',
            resourceId: notification._id.toString(),
            severity: audit_log_model_1.AuditSeverity.INFO,
        },
        request: {
            ipAddress: '',
            device: '',
            platform: '',
            appVersion: '',
            userAgent: '',
        },
        metadata: {
            channel: notification.channel,
            type: notification.type,
            status: notification.status,
        },
        success: true,
    })));
    return notifications;
};
exports.createNotifications = createNotifications;
const deliverNotification = async (notification) => {
    if (!enabledPhaseFourChannels.has(notification.channel)) {
        notification.status = notification_model_1.NotificationStatus.FAILED;
        notification.lastError = `${notification.channel} delivery is disabled in Phase 4.`;
        notification.retryCount += 1;
        notification.nextRetryAt = null;
        await notification.save();
        await audit_log_model_1.default.create({
            actor: { email: 'system@myfixer.internal', role: 'SYSTEM' },
            event: {
                action: 'notification.failed',
                module: audit_log_model_1.AuditModule.NOTIFICATIONS,
                resourceType: 'Notification',
                resourceId: notification._id.toString(),
                severity: audit_log_model_1.AuditSeverity.WARNING,
            },
            request: { ipAddress: '', device: '', platform: '', appVersion: '', userAgent: '' },
            metadata: { channel: notification.channel, type: notification.type, error: notification.lastError },
            success: false,
        });
        return notification;
    }
    const result = await providers[notification.channel].send(notification);
    if (result.success) {
        notification.status = notification.channel === notification_model_1.NotificationChannel.IN_APP
            ? notification_model_1.NotificationStatus.SENT
            : notification_model_1.NotificationStatus.SENT;
        notification.sentAt = new Date();
        notification.lastError = '';
        notification.nextRetryAt = null;
    }
    else {
        notification.status = notification_model_1.NotificationStatus.FAILED;
        notification.retryCount += 1;
        notification.lastError = result.error || 'Notification delivery failed.';
        const nextRetryAt = new Date();
        nextRetryAt.setMinutes(nextRetryAt.getMinutes() + Math.min(60, 5 * notification.retryCount));
        notification.nextRetryAt = nextRetryAt;
    }
    await notification.save();
    await audit_log_model_1.default.create({
        actor: { email: 'system@myfixer.internal', role: 'SYSTEM' },
        event: {
            action: result.success ? 'notification.sent' : 'notification.failed',
            module: audit_log_model_1.AuditModule.NOTIFICATIONS,
            resourceType: 'Notification',
            resourceId: notification._id.toString(),
            severity: result.success ? audit_log_model_1.AuditSeverity.INFO : audit_log_model_1.AuditSeverity.WARNING,
        },
        request: { ipAddress: '', device: '', platform: '', appVersion: '', userAgent: '' },
        metadata: {
            channel: notification.channel,
            type: notification.type,
            error: notification.lastError,
        },
        success: result.success,
    });
    return notification;
};
exports.deliverNotification = deliverNotification;
const processDueNotifications = async (limit = 50) => {
    const now = new Date();
    const notifications = await notification_model_1.default.find({
        $or: [
            {
                status: { $in: [notification_model_1.NotificationStatus.PENDING, notification_model_1.NotificationStatus.SCHEDULED] },
                scheduledAt: { $lte: now },
            },
            {
                status: notification_model_1.NotificationStatus.FAILED,
                nextRetryAt: { $lte: now },
            },
        ],
    })
        .sort({ scheduledAt: 1 })
        .limit(limit);
    const processed = [];
    for (const notification of notifications) {
        processed.push(await (0, exports.deliverNotification)(notification));
    }
    return processed;
};
exports.processDueNotifications = processDueNotifications;
const retryNotification = async (notificationId) => {
    const notification = await notification_model_1.default.findById(notificationId);
    if (!notification)
        return null;
    notification.status = notification_model_1.NotificationStatus.PENDING;
    notification.nextRetryAt = new Date();
    await notification.save();
    return (0, exports.deliverNotification)(notification);
};
exports.retryNotification = retryNotification;
//# sourceMappingURL=notification.service.js.map