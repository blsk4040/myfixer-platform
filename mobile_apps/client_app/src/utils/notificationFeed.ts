import { NotificationRecord } from '../services/api.service';

export type NotificationFeedMode = 'inbox' | 'alerts';

const INBOX_NOTIFICATION_TYPES = new Set([
  'CHAT_MESSAGE',
  'CHAT_IMAGE',
  'INVOICE_GENERATED',
  'INVOICE_READY',
  'INVOICE_PAID',
  'INVOICE_OVERDUE',
  'QUOTE_SUBMITTED',
  'QUOTE_READY',
  'QUOTE_UPDATED',
  'QUOTE_APPROVED',
  'QUOTE_REJECTED',
  'QUOTE_CLARIFICATION_REQUESTED',
  'PAYMENT_REQUIRED',
  'PAYMENT_PENDING',
  'PAYMENT_RECEIVED',
  'PAYMENT_CONFIRMED',
  'PAYMENT_FAILED',
  'RECEIPT_READY',
  'RECEIPT_GENERATED',
]);

const ALERT_NOTIFICATION_TYPES = new Set([
  'SYSTEM',
  'SUPPORT_REPLY',
]);

export const getFeedForNotification = (notification: NotificationRecord): NotificationFeedMode => {
  const type = String(notification.type || '').trim().toUpperCase();
  if (ALERT_NOTIFICATION_TYPES.has(type)) return 'alerts';

  const metadataFeed = typeof notification.metadata?.feed === 'string'
    ? notification.metadata.feed.trim().toLowerCase()
    : '';
  if (metadataFeed === 'inbox' || metadataFeed === 'alerts') return metadataFeed;

  return INBOX_NOTIFICATION_TYPES.has(type) ? 'inbox' : 'alerts';
};

export const isUnreadNotification = (notification: NotificationRecord): boolean =>
  !notification.readAt && notification.status !== 'READ';

export const getNotificationTime = (notification: NotificationRecord): number =>
  new Date(notification.sentAt || notification.scheduledAt || Date.now()).getTime();

export const getDisplayedNotifications = (items: NotificationRecord[]): NotificationRecord[] => {
  const map = new Map<string, NotificationRecord>();
  items.forEach((item) => {
    const bookingId = typeof item.metadata?.bookingId === 'string' ? item.metadata.bookingId : '';
    const key = bookingId ? `${bookingId}:${item.type}` : `${item.title}:${item.message}`;
    const existing = map.get(key);
    if (!existing || getNotificationTime(item) > getNotificationTime(existing)) {
      map.set(key, item);
    }
  });
  return Array.from(map.values()).sort((a, b) => getNotificationTime(b) - getNotificationTime(a));
};

export const getUnreadNotificationCounts = (notifications: NotificationRecord[]) =>
  getDisplayedNotifications(notifications).reduce(
    (counts, notification) => {
      if (!isUnreadNotification(notification)) return counts;
      counts[getFeedForNotification(notification)] += 1;
      return counts;
    },
    { inbox: 0, alerts: 0 } as Record<NotificationFeedMode, number>
  );
