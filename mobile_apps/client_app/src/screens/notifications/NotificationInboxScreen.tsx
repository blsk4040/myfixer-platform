import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Archive, Bell, CheckCircle2, MailOpen } from 'lucide-react-native';
import apiService, { NotificationRecord } from '../../services/api.service';

const getNotificationTime = (notification: NotificationRecord): number =>
  new Date(notification.sentAt || notification.scheduledAt || Date.now()).getTime();

const dedupeNotifications = (items: NotificationRecord[]): NotificationRecord[] => {
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

const prettyServiceName = (value: unknown): string => {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return 'Service update';
  return raw
    .replace(/\s*\((Urgent \/ Right Now|[^)]*\d{1,2}:\d{2}[^)]*)\)\s*$/i, '')
    .replace(/_/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const isScheduledNotification = (notification: NotificationRecord): boolean => {
  const scheduledAt = notification.metadata?.scheduledAt;
  const status = notification.metadata?.status || notification.metadata?.bookingStatus;
  return Boolean(scheduledAt) || status === 'SCHEDULED';
};

const formatNotificationSchedule = (value: unknown): string => {
  if (typeof value !== 'string' && !(value instanceof Date)) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const statusLabelForNotification = (notification: NotificationRecord): string => {
  if (notification.type === 'BOOKING_CREATED' && isScheduledNotification(notification)) return 'Scheduled';

  const labels: Record<string, string> = {
    BOOKING_CREATED: 'Finding provider',
    TECHNICIAN_ACCEPTED: 'Provider found',
    TECHNICIAN_EN_ROUTE: 'On the way',
    TECHNICIAN_ARRIVED: 'Arrived',
    JOB_STARTED: 'In progress',
    BOOKING_COMPLETED: 'Completed',
    BOOKING_CANCELLED: 'Cancelled',
    QUOTE_READY: 'Quote ready',
    PAYMENT_REQUIRED: 'Payment needed',
  };
  return labels[notification.type] || prettyServiceName(notification.type);
};

type NotificationFeedMode = 'inbox' | 'alerts';

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
  'RECEIPT_READY',
  'RECEIPT_GENERATED',
]);

const getFeedForNotification = (notification: NotificationRecord): NotificationFeedMode => {
  const metadataFeed = typeof notification.metadata?.feed === 'string'
    ? notification.metadata.feed.trim().toLowerCase()
    : '';
  if (metadataFeed === 'inbox' || metadataFeed === 'alerts') return metadataFeed;

  const type = String(notification.type || '').trim().toUpperCase();
  return INBOX_NOTIFICATION_TYPES.has(type) ? 'inbox' : 'alerts';
};

const notificationCopy: Record<NotificationFeedMode, {
  loading: string;
  title: string;
  subtitle: string;
  empty: string;
}> = {
  inbox: {
    loading: 'Loading your Inbox...',
    title: 'Inbox',
    subtitle: 'Invoices, quotes, receipts, booking messages and support updates',
    empty: 'No Inbox messages yet.',
  },
  alerts: {
    loading: 'Loading alerts...',
    title: 'Alerts',
    subtitle: 'Provider dispatch, urgent booking updates and account notifications',
    empty: 'No alerts yet.',
  },
};

function NotificationFeedScreen({ mode }: { mode: NotificationFeedMode }): React.JSX.Element {
  const copy = notificationCopy[mode];
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(async () => {
    const result = await apiService.getNotifications();
    const feedNotifications = (result.notifications || []).filter((notification) => getFeedForNotification(notification) === mode);
    setNotifications(dedupeNotifications(feedNotifications));
    setUnreadCount(feedNotifications.filter((notification) => !notification.readAt && notification.status !== 'READ').length);
  }, [mode]);

  useEffect(() => {
    loadNotifications()
      .catch((error: Error) => Alert.alert('Notifications', error.message))
      .finally(() => setLoading(false));
  }, [loadNotifications]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await loadNotifications();
    } catch (error) {
      Alert.alert('Notifications', error instanceof Error ? error.message : 'Unable to refresh notifications.');
    } finally {
      setRefreshing(false);
    }
  };

  const updateNotification = async (id: string, action: 'MARK_READ' | 'MARK_UNREAD' | 'ARCHIVE') => {
    try {
      await apiService.updateNotification(id, action);
      await loadNotifications();
    } catch (error) {
      Alert.alert('Notifications', error instanceof Error ? error.message : 'Unable to update notification.');
    }
  };

  const openRelatedCollection = (notification: NotificationRecord) => {
    if (notification.metadata?.profileId) {
      Alert.alert('Managed Collection', 'This notification is linked to your Managed Collection Services profile.');
      return;
    }
    Alert.alert('Notification', 'No related collection record is attached to this notification.');
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#00FF87" />
        <Text style={styles.muted}>{copy.loading}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, mode === 'inbox' && styles.inboxScreen]} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.subtitle}>{copy.subtitle}</Text>
        </View>
        <View style={styles.badge}>
          <Bell color="#00FF87" size={18} />
          <Text style={styles.badgeText}>{unreadCount}</Text>
        </View>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#00FF87" />}
        ListEmptyComponent={<Text style={styles.empty}>{copy.empty}</Text>}
        renderItem={({ item }) => {
          const isRead = Boolean(item.readAt) || item.status === 'READ';
          const serviceName = prettyServiceName(item.metadata?.applianceType || item.metadata?.serviceKey);
          const statusLabel = statusLabelForNotification(item);
          const scheduledText = formatNotificationSchedule(item.metadata?.scheduledAt);
          const bookingId = typeof item.metadata?.bookingId === 'string' ? item.metadata.bookingId : '';
          return (
            <View style={[styles.card, !isRead && styles.unreadCard]}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <View style={styles.pillRow}>
                    <Text style={styles.servicePill}>{serviceName}</Text>
                    <Text style={styles.stagePill}>{statusLabel}</Text>
                  </View>
                </View>
                <Text style={[styles.status, isRead ? styles.statusRead : styles.statusUnread]}>
                  {isRead ? 'READ' : 'UNREAD'}
                </Text>
              </View>
              {scheduledText ? <Text style={styles.scheduleText}>Scheduled for {scheduledText}</Text> : null}
              <Text style={styles.message}>{item.message}</Text>
              <Text style={styles.meta}>{new Date(getNotificationTime(item)).toLocaleString()}</Text>
              <View style={styles.actions}>
                <TouchableOpacity style={styles.actionButton} onPress={() => updateNotification(item._id, isRead ? 'MARK_UNREAD' : 'MARK_READ')}>
                  {isRead ? <MailOpen color="#CBD5E1" size={16} /> : <CheckCircle2 color="#00FF87" size={16} />}
                  <Text style={styles.actionText}>{isRead ? 'Unread' : 'Read'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={() => bookingId ? Alert.alert('Booking Update', 'Open the Activity tab to view or track this booking.') : openRelatedCollection(item)}>
                  <Bell color="#CBD5E1" size={16} />
                  <Text style={styles.actionText}>{bookingId ? 'View' : 'Open'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={() => updateNotification(item._id, 'ARCHIVE')}>
                  <Archive color="#F87171" size={16} />
                  <Text style={styles.actionText}>Archive</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

export function NotificationInboxScreen(): React.JSX.Element {
  return <NotificationFeedScreen mode="inbox" />;
}

export function NotificationAlertsScreen(): React.JSX.Element {
  return <NotificationFeedScreen mode="alerts" />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#090D14', paddingHorizontal: 18 },
  inboxScreen: { paddingTop: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#090D14', gap: 10 },
  muted: { color: '#94A3B8', fontSize: 13 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '800' },
  subtitle: { color: '#94A3B8', fontSize: 12, fontWeight: '600', marginTop: 4 },
  badge: { minWidth: 58, height: 36, borderRadius: 18, backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#1E293B', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  badgeText: { color: '#FFFFFF', fontWeight: '800' },
  list: { paddingBottom: 110, gap: 12 },
  empty: { color: '#94A3B8', textAlign: 'center', marginTop: 80 },
  card: { backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#1E293B', borderRadius: 12, padding: 14 },
  unreadCard: { borderColor: '#00FF87' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  message: { color: '#CBD5E1', fontSize: 13, lineHeight: 20, marginTop: 10 },
  meta: { color: '#64748B', fontSize: 11, marginTop: 4 },
  scheduleText: { color: '#94A3B8', fontSize: 12, fontWeight: '700', marginTop: 8 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 7, alignItems: 'flex-start' },
  servicePill: { color: '#E2E8F0', backgroundColor: '#111827', borderWidth: 1, borderColor: '#1E293B', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, fontSize: 10, fontWeight: '800', lineHeight: 14, overflow: 'hidden' },
  stagePill: { color: '#00FF87', backgroundColor: '#00FF8715', borderWidth: 1, borderColor: '#00FF8740', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, fontSize: 10, fontWeight: '900', lineHeight: 14, overflow: 'hidden' },
  status: { fontSize: 10, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  statusRead: { color: '#94A3B8', backgroundColor: '#111827' },
  statusUnread: { color: '#052E16', backgroundColor: '#00FF87' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  actionButton: { height: 34, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#111827', borderWidth: 1, borderColor: '#1E293B', flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { color: '#CBD5E1', fontSize: 12, fontWeight: '700' },
});

export default NotificationInboxScreen;
