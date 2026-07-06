import mongoose from 'mongoose';
import Notification, {
  INotificationDocument,
  NotificationChannel,
  NotificationStatus,
  NotificationType,
} from '../models/notification.model';
import NotificationPreference from '../models/notification-preference.model';
import User from '../models/user.model';
import { EmailService } from './email/email.service';
import AuditLog, { AuditModule, AuditSeverity } from '../models/audit-log.model';

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
]);

const getPreferenceChannels = async (userId?: mongoose.Types.ObjectId) => {
  const defaults = {
    inApp: true,
    email: true,
    push: false,
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

const disabledProvider = (channel: NotificationChannel): NotificationChannelProvider => ({
  async send() {
    return { success: false, error: `${channel} delivery is disabled in Phase 4.` };
  },
});

const providers: Record<NotificationChannel, NotificationChannelProvider> = {
  [NotificationChannel.IN_APP]: inAppProvider,
  [NotificationChannel.EMAIL]: emailProvider,
  [NotificationChannel.PUSH]: disabledProvider(NotificationChannel.PUSH),
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
  return notifications;
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
