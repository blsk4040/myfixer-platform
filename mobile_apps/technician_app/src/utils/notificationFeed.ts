import { NotificationRecord } from '../services/api.service';

export type NotificationFeedMode = 'alerts' | 'inbox';

const INBOX_NOTIFICATION_TYPES = new Set([
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
  'PAYOUT_READY',
  'PAYOUT_RELEASED',
  'PAYOUT_PAID',
  'PAYOUT_FAILED',
  'SETTLEMENT_READY',
  'STATEMENT_READY',
  'RECEIPT_READY',
  'RECEIPT_GENERATED',
]);

export const getFeedForNotification = (notification: NotificationRecord): NotificationFeedMode => {
  const metadataFeed = typeof notification.metadata?.feed === 'string'
    ? notification.metadata.feed.trim().toLowerCase()
    : '';
  if (metadataFeed === 'inbox' || metadataFeed === 'alerts') return metadataFeed;

  const type = String(notification.type || '').trim().toUpperCase();
  return INBOX_NOTIFICATION_TYPES.has(type) ? 'inbox' : 'alerts';
};

export const isUnreadNotification = (notification: NotificationRecord): boolean =>
  !notification.readAt && notification.status !== 'READ';

export const getUnreadNotificationCounts = (notifications: NotificationRecord[]) =>
  notifications.reduce(
    (counts, notification) => {
      if (!isUnreadNotification(notification)) return counts;
      counts[getFeedForNotification(notification)] += 1;
      return counts;
    },
    { alerts: 0, inbox: 0 } as Record<NotificationFeedMode, number>
  );
