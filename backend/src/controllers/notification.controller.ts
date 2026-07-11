import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Notification, {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
} from '../models/notification.model';
import NotificationPreference from '../models/notification-preference.model';
import { logAuditEvent } from '../services/audit.service';
import { processDueNotifications, retryNotification } from '../services/notification.service';

const getAuthUser = (req: Request) =>
  (req as any).user as { id?: string; _id?: string; email?: string; role?: string } | undefined;

const getUserId = (req: Request) => {
  const authUser = getAuthUser(req);
  const userId = String(authUser?.id ?? authUser?._id ?? '').trim();
  return mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null;
};

const buildNotificationFilter = (query: Request['query']) => {
  const filter: Record<string, unknown> = {};
  if (typeof query.status === 'string' && query.status) filter.status = query.status;
  if (typeof query.channel === 'string' && query.channel) filter.channel = query.channel;
  if (typeof query.type === 'string' && query.type) filter.type = query.type;
  if (typeof query.user === 'string' && query.user) {
    if (mongoose.Types.ObjectId.isValid(query.user)) {
      filter['recipient.userId'] = new mongoose.Types.ObjectId(query.user);
    } else {
      filter['recipient.email'] = new RegExp(query.user, 'i');
    }
  }
  if (typeof query.from === 'string' || typeof query.to === 'string') {
    const range: Record<string, Date> = {};
    if (typeof query.from === 'string' && query.from) {
      const from = new Date(query.from);
      if (!Number.isNaN(from.getTime())) range.$gte = from;
    }
    if (typeof query.to === 'string' && query.to) {
      const to = new Date(query.to);
      if (!Number.isNaN(to.getTime())) range.$lte = to;
    }
    if (Object.keys(range).length) filter.scheduledAt = range;
  }
  return filter;
};

export const listAdminNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const filter = buildNotificationFilter(req.query);
    const [notifications, counts] = await Promise.all([
      Notification.find(filter).sort({ scheduledAt: -1 }).limit(300).lean(),
      Notification.aggregate([
        { $match: filter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    res.status(200).json({
      success: true,
      notifications,
      counts,
      meta: {
        statuses: Object.values(NotificationStatus),
        channels: Object.values(NotificationChannel),
        enabledChannels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.PUSH],
        disabledChannels: [NotificationChannel.SMS, NotificationChannel.WHATSAPP],
        types: Object.values(NotificationType),
      },
    });
  } catch (error) {
    console.error('Failed to list notifications:', error);
    res.status(500).json({ message: 'Failed to list notifications.' });
  }
};

export const retryAdminNotification = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: 'Invalid notification id.' });
    return;
  }

  try {
    const before = await Notification.findById(id).lean();
    const notification = await retryNotification(id);
    if (!notification) {
      res.status(404).json({ message: 'Notification not found.' });
      return;
    }

    await logAuditEvent(req, {
      action: 'notification.retry',
      module: 'NOTIFICATIONS',
      resourceType: 'Notification',
      resourceId: notification._id.toString(),
      changes: { before, after: notification.toObject() },
      success: notification.status === NotificationStatus.SENT,
      metadata: { channel: notification.channel, type: notification.type },
    });

    res.status(200).json({ success: true, notification });
  } catch (error) {
    console.error('Failed to retry notification:', error);
    res.status(500).json({ message: 'Failed to retry notification.' });
  }
};

export const cancelAdminNotification = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: 'Invalid notification id.' });
    return;
  }

  try {
    const before = await Notification.findById(id).lean();
    const notification = await Notification.findByIdAndUpdate(
      id,
      {
        status: NotificationStatus.CANCELLED,
        cancelledAt: new Date(),
      },
      { new: true, runValidators: true }
    );

    if (!notification) {
      res.status(404).json({ message: 'Notification not found.' });
      return;
    }

    await logAuditEvent(req, {
      action: 'notification.cancel',
      module: 'NOTIFICATIONS',
      resourceType: 'Notification',
      resourceId: notification._id.toString(),
      changes: { before, after: notification.toObject() },
      metadata: { channel: notification.channel, type: notification.type },
    });

    res.status(200).json({ success: true, notification });
  } catch (error) {
    console.error('Failed to cancel notification:', error);
    res.status(500).json({ message: 'Failed to cancel notification.' });
  }
};

export const processAdminNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const processed = await processDueNotifications();
    await logAuditEvent(req, {
      action: 'notification.process_due',
      module: 'NOTIFICATIONS',
      resourceType: 'Notification',
      metadata: { processedCount: processed.length },
    });
    res.status(200).json({ success: true, processed });
  } catch (error) {
    console.error('Failed to process notifications:', error);
    res.status(500).json({ message: 'Failed to process notifications.' });
  }
};

export const getMyNotifications = async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ message: 'Valid user identity is required.' });
    return;
  }

  try {
    const filter: Record<string, unknown> = {
      'recipient.userId': userId,
      channel: NotificationChannel.IN_APP,
      status: { $ne: NotificationStatus.ARCHIVED },
    };
    if (typeof req.query.status === 'string' && req.query.status) filter.status = req.query.status;
    const notifications = await Notification.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    const unreadCount = await Notification.countDocuments({
      'recipient.userId': userId,
      channel: NotificationChannel.IN_APP,
      readAt: null,
      status: { $nin: [NotificationStatus.ARCHIVED, NotificationStatus.CANCELLED] },
    });
    res.status(200).json({ success: true, notifications, unreadCount });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load notifications.' });
  }
};

export const updateMyNotification = async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const { id } = req.params;
  if (!userId || !mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: 'Invalid notification request.' });
    return;
  }

  const action = String(req.body.action || '').trim().toUpperCase();
  const updates: Record<string, unknown> = {};
  if (action === 'MARK_READ') {
    updates.readAt = new Date();
    updates.status = NotificationStatus.READ;
  } else if (action === 'MARK_UNREAD') {
    updates.readAt = null;
    updates.status = NotificationStatus.SENT;
  } else if (action === 'ARCHIVE') {
    updates.archivedAt = new Date();
    updates.status = NotificationStatus.ARCHIVED;
  } else {
    res.status(400).json({ message: 'Unsupported notification action.' });
    return;
  }

  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: id, 'recipient.userId': userId },
      updates,
      { new: true, runValidators: true }
    );
    if (!notification) {
      res.status(404).json({ message: 'Notification not found.' });
      return;
    }
    res.status(200).json({ success: true, notification });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update notification.' });
  }
};

export const getMyNotificationPreferences = async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ message: 'Valid user identity is required.' });
    return;
  }

  const preference = await NotificationPreference.findOneAndUpdate(
    { userId },
    {
      $setOnInsert: {
        userId,
        channels: {
          inApp: true,
          email: true,
          push: true,
          sms: false,
          whatsapp: false,
        },
      },
    },
    { new: true, upsert: true, runValidators: true }
  ).lean();

  res.status(200).json({ success: true, preference });
};

export const updateMyNotificationPreferences = async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ message: 'Valid user identity is required.' });
    return;
  }

  const allowed = ['inApp', 'email', 'push', 'sms', 'whatsapp'];
  const channels: Record<string, boolean> = {};
  allowed.forEach((key) => {
    if (typeof req.body.channels?.[key] === 'boolean') channels[`channels.${key}`] = req.body.channels[key];
  });

  if (!Object.keys(channels).length) {
    res.status(400).json({ message: 'No notification preferences supplied.' });
    return;
  }

  const preference = await NotificationPreference.findOneAndUpdate(
    { userId },
    { $set: channels },
    { new: true, upsert: true, runValidators: true }
  ).lean();

  res.status(200).json({ success: true, preference });
};
