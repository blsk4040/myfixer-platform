import mongoose from 'mongoose';
import Notification, {
  INotificationDocument,
  NotificationChannel,
  NotificationStatus,
  NotificationType,
} from '../models/notification.model';
import NotificationPreference from '../models/notification-preference.model';
import User from '../models/user.model';
import PushToken from '../models/push-token.model';
import { EmailService } from './email/email.service';
import AuditLog, { AuditModule, AuditSeverity } from '../models/audit-log.model';
import { incrementMetric } from './metrics.service';
import { enqueueWorkerTask, isWorkerQueueEnabled, WorkerQueueName } from './worker-queue.service';

interface CreateNotificationInput {
  userId?: string | mongoose.Types.ObjectId;
  email?: string;
  phone?: string;
  name?: string;
  channels?: NotificationChannel[];
  type: NotificationType | string;
  title: string;
  message: string;
  scheduledAt?: Date;
  metadata?: Record<string, unknown>;
}

interface DeliveryResult {
  success: boolean;
  error?: string;
}

interface NotificationChannelProvider {
  send(notification: INotificationDocument): Promise<DeliveryResult>;
}

type PreferenceChannelKey = 'inApp' | 'email' | 'push' | 'sms' | 'whatsapp';

const channelPreferenceMap: Record<NotificationChannel, PreferenceChannelKey> = {
  [NotificationChannel.IN_APP]: 'inApp',
  [NotificationChannel.EMAIL]: 'email',
  [NotificationChannel.PUSH]: 'push',
  [NotificationChannel.SMS]: 'sms',
  [NotificationChannel.WHATSAPP]: 'whatsapp',
};

const enabledPhaseFourChannels = new Set<NotificationChannel>([
  NotificationChannel.IN_APP,
  NotificationChannel.EMAIL,
  NotificationChannel.PUSH,
]);

const getPreferenceChannels = async (userId?: mongoose.Types.ObjectId) => {
  const defaults = {
    inApp: true,
    email: true,
    push: true,
    sms: false,
    whatsapp: false,
  };

  if (!userId) return defaults;

  const preference = await NotificationPreference.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId, channels: defaults } },
    { new: true, upsert: true, runValidators: true }
  ).lean();

  return {
    ...defaults,
    ...(preference?.channels || {}),
  };
};

const shouldCreateForChannel = async (userId: mongoose.Types.ObjectId | undefined, channel: NotificationChannel) => {
  const preferences = await getPreferenceChannels(userId);
  return Boolean(preferences[channelPreferenceMap[channel]]);
};

const inAppProvider: NotificationChannelProvider = {
  async send() {
    return { success: true };
  },
};

const emailProvider: NotificationChannelProvider = {
  async send(notification) {
    if (!notification.recipient.email) {
      return { success: false, error: 'Recipient email is missing.' };
    }

    const sent = await EmailService.sendNotificationEmail({
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

const isTechnicianJobAlert = (type: string): boolean =>
  ['NEW_JOB_REQUEST', 'EMERGENCY_JOB_REQUEST'].includes(type);

const pushProvider: NotificationChannelProvider = {
  async send(notification) {
    const userId = notification.recipient.userId;
    if (!userId) {
      return { success: false, error: 'Recipient user id is missing.' };
    }

    const tokens = await PushToken.find({
      userId,
      isActive: true,
    }).select('token').lean();

    if (!tokens.length) {
      return { success: false, error: 'No active push tokens registered for recipient.' };
    }

    const technicianJobAlert = isTechnicianJobAlert(String(notification.type));
    const messages = tokens.map((record) => ({
      to: record.token,
      sound: technicianJobAlert ? 'incoming_job.wav' : 'default',
      channelId: technicianJobAlert ? 'job-alerts' : 'default',
      title: notification.title,
      body: notification.message,
      data: {
        notificationId: notification._id.toString(),
        type: notification.type,
        ...notification.metadata,
      },
    }));

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      return { success: false, error: `Expo push request failed with status ${response.status}.` };
    }

    const body = await response.json() as {
      data?: Array<{ status?: string; details?: { error?: string }; message?: string }>;
      errors?: Array<{ message?: string }>;
    };

    if (body.errors?.length) {
      return { success: false, error: body.errors.map((error) => error.message).filter(Boolean).join('; ') || 'Expo push delivery failed.' };
    }

    const receipts = body.data || [];
    const invalidTokens = receipts
      .map((receipt, index) => receipt.details?.error === 'DeviceNotRegistered' ? tokens[index]?.token : '')
      .filter((token): token is string => Boolean(token));

    if (invalidTokens.length) {
      await PushToken.updateMany(
        { token: { $in: invalidTokens } },
        { $set: { isActive: false, disabledAt: new Date() } }
      );
    }

    const failedReceipts = receipts.filter((receipt) => receipt.status === 'error' && receipt.details?.error !== 'DeviceNotRegistered');
    if (failedReceipts.length) {
      return {
        success: false,
        error: failedReceipts.map((receipt) => receipt.message || receipt.details?.error).filter(Boolean).join('; ') || 'Expo push delivery failed.',
      };
    }

    return { success: true };
  },
};

const disabledProvider = (channel: NotificationChannel): NotificationChannelProvider => ({
  async send() {
    return { success: false, error: `${channel} delivery is disabled in Phase 4.` };
  },
});

const providers: Record<NotificationChannel, NotificationChannelProvider> = {
  [NotificationChannel.IN_APP]: inAppProvider,
  [NotificationChannel.EMAIL]: emailProvider,
  [NotificationChannel.PUSH]: pushProvider,
  [NotificationChannel.SMS]: disabledProvider(NotificationChannel.SMS),
  [NotificationChannel.WHATSAPP]: disabledProvider(NotificationChannel.WHATSAPP),
};

export const createNotifications = async (input: CreateNotificationInput) => {
  const userId = input.userId && mongoose.Types.ObjectId.isValid(String(input.userId))
    ? new mongoose.Types.ObjectId(String(input.userId))
    : undefined;
  const user = userId
    ? await User.findById(userId).select('name email phone').lean()
    : null;
  const requestedChannels = input.channels?.length
    ? input.channels
    : [NotificationChannel.IN_APP, NotificationChannel.EMAIL];
  const scheduledAt = input.scheduledAt || new Date();
  const initialStatus = scheduledAt.getTime() > Date.now()
    ? NotificationStatus.SCHEDULED
    : NotificationStatus.PENDING;

  const documents = [];
  for (const channel of requestedChannels) {
    if (!Object.values(NotificationChannel).includes(channel)) continue;
    const preferenceAllowed = await shouldCreateForChannel(userId, channel);
    if (!preferenceAllowed) continue;

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
        : NotificationStatus.FAILED,
      scheduledAt,
      lastError: enabledPhaseFourChannels.has(channel) ? '' : `${channel} delivery is disabled in Phase 4.`,
      metadata: input.metadata || {},
    });
  }

  if (!documents.length) return [];
  const notifications = await Notification.create(documents);
  await AuditLog.insertMany(notifications.map((notification) => ({
    actor: {
      email: 'system@myfixer.internal',
      role: 'SYSTEM',
    },
    event: {
      action: 'notification.created',
      module: AuditModule.NOTIFICATIONS,
      resourceType: 'Notification',
      resourceId: notification._id.toString(),
      severity: AuditSeverity.INFO,
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

  const dueNotifications = notifications.filter((notification) => notification.scheduledAt.getTime() <= Date.now());
  if (!dueNotifications.length) return notifications;

  if (isWorkerQueueEnabled()) {
    await Promise.all(dueNotifications.map((notification) =>
      enqueueWorkerTask({
        name: WorkerQueueName.NOTIFICATION_DELIVERY,
        id: notification._id.toString(),
      })
    ));
    return notifications;
  }

  return Promise.all(dueNotifications.map((notification) => deliverNotification(notification)));
};

export const deliverNotification = async (notification: INotificationDocument) => {
  if (!enabledPhaseFourChannels.has(notification.channel)) {
    notification.status = NotificationStatus.FAILED;
    notification.lastError = `${notification.channel} delivery is disabled in Phase 4.`;
    notification.retryCount += 1;
    notification.nextRetryAt = null;
    await notification.save();
    await AuditLog.create({
      actor: { email: 'system@myfixer.internal', role: 'SYSTEM' },
      event: {
        action: 'notification.failed',
        module: AuditModule.NOTIFICATIONS,
        resourceType: 'Notification',
        resourceId: notification._id.toString(),
        severity: AuditSeverity.WARNING,
      },
      request: { ipAddress: '', device: '', platform: '', appVersion: '', userAgent: '' },
      metadata: { channel: notification.channel, type: notification.type, error: notification.lastError },
      success: false,
    });
    return notification;
  }

  const result = await providers[notification.channel].send(notification);
  if (result.success) {
    notification.status = notification.channel === NotificationChannel.IN_APP
      ? NotificationStatus.SENT
      : NotificationStatus.SENT;
    notification.sentAt = new Date();
    notification.lastError = '';
    notification.nextRetryAt = null;
  } else {
    notification.status = NotificationStatus.FAILED;
    notification.retryCount += 1;
    notification.lastError = result.error || 'Notification delivery failed.';
    const nextRetryAt = new Date();
    nextRetryAt.setMinutes(nextRetryAt.getMinutes() + Math.min(60, 5 * notification.retryCount));
    notification.nextRetryAt = nextRetryAt;
  }

  await notification.save();
  await AuditLog.create({
    actor: { email: 'system@myfixer.internal', role: 'SYSTEM' },
    event: {
      action: result.success ? 'notification.sent' : 'notification.failed',
      module: AuditModule.NOTIFICATIONS,
      resourceType: 'Notification',
      resourceId: notification._id.toString(),
      severity: result.success ? AuditSeverity.INFO : AuditSeverity.WARNING,
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

export const processNotificationQueueTask = async (notificationId: string) => {
  const notification = await Notification.findById(notificationId);
  if (!notification) {
    incrementMetric('worker_tasks_missing_total', { queue: WorkerQueueName.NOTIFICATION_DELIVERY });
    return null;
  }
  return deliverNotification(notification);
};

export const processDueNotifications = async (limit = 50) => {
  const now = new Date();
  const notifications = await Notification.find({
    $or: [
      {
        status: { $in: [NotificationStatus.PENDING, NotificationStatus.SCHEDULED] },
        scheduledAt: { $lte: now },
      },
      {
        status: NotificationStatus.FAILED,
        nextRetryAt: { $lte: now },
      },
    ],
  })
    .sort({ scheduledAt: 1 })
    .limit(limit);

  const processed = [];
  for (const notification of notifications) {
    processed.push(await deliverNotification(notification));
  }

  return processed;
};

export const retryNotification = async (notificationId: string) => {
  const notification = await Notification.findById(notificationId);
  if (!notification) return null;
  notification.status = NotificationStatus.PENDING;
  notification.nextRetryAt = new Date();
  await notification.save();
  return deliverNotification(notification);
};
