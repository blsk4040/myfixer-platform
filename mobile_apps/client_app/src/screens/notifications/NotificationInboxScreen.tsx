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
import { Bell, CheckCircle2, MailOpen, Trash2 } from 'lucide-react-native';
import apiService, { NotificationRecord } from '../../services/api.service';
import { customerErrorMessage } from '../../utils/userFacingErrors';
import { getDisplayedNotifications, getFeedForNotification, getNotificationTime, isUnreadNotification, NotificationFeedMode } from '../../utils/notificationFeed';

const displayNotificationText = (value: string): string =>
  value
    .replace(/\btechnicican\b/gi, 'Service Provider')
    .replace(/\btechnician\b/gi, 'Service Provider')
    .replace(/\btechnicians\b/gi, 'Service Providers')
    .replace(/\bsmeone\b/gi, 'someone');

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
    TECHNICIAN_ARRIVED: 'Service provider arrived',
    JOB_STARTED: 'In progress',
    BOOKING_COMPLETED: 'Completed',
    BOOKING_CANCELLED: 'Cancelled',
    QUOTE_READY: 'Quote ready',
    PAYMENT_REQUIRED: 'Payment needed',
  };
  return labels[notification.type] || prettyServiceName(notification.type);
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
    subtitle: 'Invoices, quotes, receipts and booking messages',
    empty: 'No Inbox messages yet.',
  },
  alerts: {
    loading: 'Loading alerts...',
    title: 'Alerts',
    subtitle: 'Provider dispatch, urgent booking updates and account notifications',
    empty: 'No alerts yet.',
  },
};

function NotificationFeedScreen({ mode, navigation }: { mode: NotificationFeedMode; navigation?: any }): React.JSX.Element {
  const copy = notificationCopy[mode];
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(async () => {
    const result = await apiService.getNotifications();
    const feedNotifications = (result.notifications || []).filter((notification) => getFeedForNotification(notification) === mode);
    const displayedNotifications = getDisplayedNotifications(feedNotifications);
    setNotifications(displayedNotifications);
    setUnreadCount(displayedNotifications.filter(isUnreadNotification).length);
  }, [mode]);

  useEffect(() => {
    loadNotifications()
      .catch((error: Error) => Alert.alert(copy.title, customerErrorMessage(error, `Unable to load your ${copy.title.toLowerCase()} right now.`)))
      .finally(() => setLoading(false));
  }, [copy.title, loadNotifications]);

  useEffect(() => {
    const unsubscribe = navigation?.addListener?.('focus', () => {
      void loadNotifications();
    });
    return () => unsubscribe?.();
  }, [loadNotifications, navigation]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await loadNotifications();
    } catch (error) {
      Alert.alert(copy.title, customerErrorMessage(error, `Unable to refresh your ${copy.title.toLowerCase()} right now.`));
    } finally {
      setRefreshing(false);
    }
  };

  const updateNotification = async (id: string, action: 'MARK_READ' | 'MARK_UNREAD' | 'ARCHIVE') => {
    try {
      await apiService.updateNotification(id, action);
      await loadNotifications();
    } catch (error) {
      Alert.alert(copy.title, customerErrorMessage(error, 'Unable to update this item right now.'));
    }
  };

  const deleteNotification = (notification: NotificationRecord) => {
    Alert.alert(
      'Delete notification?',
      'This will remove it from your notification list.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => updateNotification(notification._id, 'ARCHIVE') },
      ]
    );
  };

  const openBookingActivity = (bookingId: string) => {
    if (!bookingId) return;
    navigation?.navigate?.('TrackingMain', { bookingId });
  };

  const openNotification = async (notification: NotificationRecord) => {
    const isRead = !isUnreadNotification(notification);
    if (!isRead) {
      setNotifications((current) => current.map((item) => (
        item._id === notification._id
          ? { ...item, status: 'READ', readAt: new Date().toISOString() }
          : item
      )));
      setUnreadCount((current) => Math.max(0, current - 1));
      await apiService.updateNotification(notification._id, 'MARK_READ').catch(() => loadNotifications());
    }

    const bookingId = typeof notification.metadata?.bookingId === 'string' ? notification.metadata.bookingId : '';
    const title = displayNotificationText(notification.title || copy.title);
    const message = displayNotificationText(notification.message || 'No message details available.');
    Alert.alert(title, message, [
      { text: 'Close', style: 'cancel' },
      bookingId
        ? { text: 'Open Activity', onPress: () => openBookingActivity(bookingId) }
        : { text: 'OK' },
    ]);
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
          const isRead = !isUnreadNotification(item);
          const serviceName = prettyServiceName(item.metadata?.applianceType || item.metadata?.serviceKey);
          const statusLabel = statusLabelForNotification(item);
          const scheduledText = formatNotificationSchedule(item.metadata?.scheduledAt);
          const bookingId = typeof item.metadata?.bookingId === 'string' ? item.metadata.bookingId : '';
          return (
            <TouchableOpacity style={[styles.card, !isRead && styles.unreadCard]} activeOpacity={0.88} onPress={() => openNotification(item)}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{displayNotificationText(item.title)}</Text>
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
              <Text style={styles.message}>{displayNotificationText(item.message)}</Text>
              <Text style={styles.meta}>{new Date(getNotificationTime(item)).toLocaleString()}</Text>
              <View style={styles.actions}>
                <TouchableOpacity style={styles.actionButton} onPress={() => updateNotification(item._id, isRead ? 'MARK_UNREAD' : 'MARK_READ')}>
                  {isRead ? <MailOpen color="#CBD5E1" size={16} /> : <CheckCircle2 color="#EF4444" size={16} />}
                  <Text style={styles.actionText}>{isRead ? 'Mark unread' : 'Mark read'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={() => bookingId ? openBookingActivity(bookingId) : openRelatedCollection(item)}>
                  <Bell color="#CBD5E1" size={16} />
                  <Text style={styles.actionText}>{bookingId ? 'View' : 'Open'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={() => deleteNotification(item)}>
                  <Trash2 color="#F87171" size={16} />
                  <Text style={styles.actionText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

export function NotificationInboxScreen({ navigation }: any): React.JSX.Element {
  return <NotificationFeedScreen mode="inbox" navigation={navigation} />;
}

export function NotificationAlertsScreen({ navigation }: any): React.JSX.Element {
  return <NotificationFeedScreen mode="alerts" navigation={navigation} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#090D14', paddingHorizontal: 18 },
  inboxScreen: { paddingTop: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#090D14', gap: 10 },
  muted: { color: '#94A3B8', fontSize: 13 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '800' },
  subtitle: { color: '#94A3B8', fontSize: 12, fontWeight: '600', marginTop: 4 },
  badge: { minWidth: 44, height: 32, borderRadius: 16, backgroundColor: '#EF4444', borderWidth: 1, borderColor: '#7F1D1D', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  badgeText: { color: '#FFFFFF', fontWeight: '800' },
  list: { paddingBottom: 110, gap: 12 },
  empty: { color: '#94A3B8', textAlign: 'center', marginTop: 80 },
  card: { backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#1E293B', borderRadius: 12, padding: 14 },
  unreadCard: { borderColor: '#EF4444' },
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
  statusUnread: { color: '#FFFFFF', backgroundColor: '#EF4444' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  actionButton: { height: 34, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#111827', borderWidth: 1, borderColor: '#1E293B', flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { color: '#CBD5E1', fontSize: 12, fontWeight: '700' },
});

export default NotificationInboxScreen;
