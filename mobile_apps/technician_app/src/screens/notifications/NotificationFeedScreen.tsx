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
import { getDisplayedNotifications, getFeedForNotification, getNotificationTime, isUnreadNotification, NotificationFeedMode } from '../../utils/notificationFeed';

const displayNotificationText = (value: string): string =>
  value
    .replace(/\btechnicican\b/gi, 'Service Provider')
    .replace(/\btechnician\b/gi, 'Service Provider')
    .replace(/\btechnicians\b/gi, 'Service Providers')
    .replace(/\bsmeone\b/gi, 'someone');

const prettyType = (value: unknown): string => {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return 'Update';
  return raw
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const copyByMode: Record<NotificationFeedMode, {
  title: string;
  subtitle: string;
  empty: string;
  loading: string;
}> = {
  alerts: {
    title: 'Alerts',
    subtitle: 'Job requests, admin broadcasts, profile updates and urgent operational notices',
    empty: 'No alerts yet.',
    loading: 'Loading alerts...',
  },
  inbox: {
    title: 'Inbox',
    subtitle: 'Approved quotes, invoices, receipts, payout records and formal documents',
    empty: 'No Inbox records yet.',
    loading: 'Loading Inbox...',
  },
};

function NotificationFeedScreen({ mode, navigation }: { mode: NotificationFeedMode; navigation?: any }): React.JSX.Element {
  const copy = copyByMode[mode];
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
      .catch((error: Error) => Alert.alert('Notifications', error.message))
      .finally(() => setLoading(false));
  }, [loadNotifications]);

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

  const openBookingJob = (bookingId: string) => {
    if (!bookingId) return;
    navigation?.navigate?.('Jobs', { jobId: bookingId });
    navigation?.getParent?.()?.navigate?.('MainTabs', { screen: 'Jobs', params: { jobId: bookingId } });
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
    Alert.alert(displayNotificationText(notification.title || copy.title), displayNotificationText(notification.message || 'No message details available.'), [
      { text: 'Close', style: 'cancel' },
      bookingId ? { text: 'Open Jobs', onPress: () => openBookingJob(bookingId) } : { text: 'OK' },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#B8FF3D" />
        <Text style={styles.muted}>{copy.loading}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#B8FF3D" />}
        ListEmptyComponent={<Text style={styles.empty}>{copy.empty}</Text>}
        renderItem={({ item }) => {
          const isRead = !isUnreadNotification(item);
          return (
            <TouchableOpacity style={[styles.card, !isRead && styles.unreadCard]} activeOpacity={0.88} onPress={() => openNotification(item)}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{displayNotificationText(item.title)}</Text>
                  <Text style={styles.typePill}>{prettyType(item.type)}</Text>
                </View>
                <Text style={[styles.status, isRead ? styles.statusRead : styles.statusUnread]}>
                  {isRead ? 'READ' : 'UNREAD'}
                </Text>
              </View>
              <Text style={styles.message}>{displayNotificationText(item.message)}</Text>
              <Text style={styles.meta}>{new Date(getNotificationTime(item)).toLocaleString()}</Text>
              <View style={styles.actions}>
                <TouchableOpacity style={styles.actionButton} onPress={() => updateNotification(item._id, isRead ? 'MARK_UNREAD' : 'MARK_READ')}>
                  {isRead ? <MailOpen color="#B9B9BF" size={16} /> : <CheckCircle2 color="#EF4444" size={16} />}
                  <Text style={styles.actionText}>{isRead ? 'Mark unread' : 'Mark read'}</Text>
                </TouchableOpacity>
                {typeof item.metadata?.bookingId === 'string' ? (
                  <TouchableOpacity style={styles.actionButton} onPress={() => openBookingJob(String(item.metadata?.bookingId || ''))}>
                    <Bell color="#B9B9BF" size={16} />
                    <Text style={styles.actionText}>View</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={styles.actionButton} onPress={() => deleteNotification(item)}>
                  <Trash2 color="#FF5D5D" size={16} />
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

export function TechnicianAlertsScreen({ navigation }: any): React.JSX.Element {
  return <NotificationFeedScreen mode="alerts" navigation={navigation} />;
}

export function TechnicianInboxScreen({ navigation }: any): React.JSX.Element {
  return <NotificationFeedScreen mode="inbox" navigation={navigation} />;
}

export default TechnicianInboxScreen;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0B0B0D', paddingHorizontal: 18 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B0B0D', gap: 10 },
  muted: { color: '#A7A7AD', fontSize: 13, fontWeight: '700' },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, paddingTop: 10, marginBottom: 16 },
  headerCopy: { flex: 1 },
  title: { color: '#F7F7F5', fontSize: 28, fontWeight: '900' },
  subtitle: { color: '#A7A7AD', fontSize: 12, fontWeight: '600', lineHeight: 18, marginTop: 4 },
  badge: { minWidth: 44, height: 32, borderRadius: 16, backgroundColor: '#EF4444', borderWidth: 1, borderColor: '#7F1D1D', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  badgeText: { color: '#F7F7F5', fontWeight: '900' },
  list: { paddingBottom: 110, gap: 12 },
  empty: { color: '#A7A7AD', textAlign: 'center', marginTop: 80, fontWeight: '700' },
  card: { backgroundColor: '#17171A', borderWidth: 1, borderColor: '#303036', borderRadius: 14, padding: 14 },
  unreadCard: { borderColor: '#EF4444' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardTitle: { color: '#F7F7F5', fontSize: 16, fontWeight: '900' },
  typePill: { alignSelf: 'flex-start', color: '#FCA5A5', backgroundColor: 'rgba(239, 68, 68, 0.14)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, fontSize: 10, fontWeight: '900', marginTop: 8, overflow: 'hidden' },
  status: { fontSize: 10, fontWeight: '900', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  statusRead: { color: '#A7A7AD', backgroundColor: '#222226' },
  statusUnread: { color: '#FFFFFF', backgroundColor: '#EF4444' },
  message: { color: '#D7D7D2', fontSize: 13, lineHeight: 20, marginTop: 12 },
  meta: { color: '#74747C', fontSize: 11, marginTop: 6, fontWeight: '700' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  actionButton: { height: 34, paddingHorizontal: 10, borderRadius: 9, backgroundColor: '#222226', borderWidth: 1, borderColor: '#303036', flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { color: '#D7D7D2', fontSize: 12, fontWeight: '800' },
});
