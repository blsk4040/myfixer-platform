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
import { Archive, Bell, CheckCircle2, MailOpen } from 'lucide-react-native';
import apiService, { NotificationRecord } from '../../services/api.service';

export function NotificationInboxScreen(): React.JSX.Element {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(async () => {
    const result = await apiService.getNotifications();
    setNotifications(result.notifications || []);
    setUnreadCount(result.unreadCount || 0);
  }, []);

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
        <Text style={styles.muted}>Loading notifications...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Notification Inbox</Text>
          <Text style={styles.title}>Updates</Text>
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
        ListEmptyComponent={<Text style={styles.empty}>No notifications yet.</Text>}
        renderItem={({ item }) => {
          const isRead = Boolean(item.readAt) || item.status === 'READ';
          return (
            <View style={[styles.card, !isRead && styles.unreadCard]}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.meta}>{item.channel} - {item.type}</Text>
                </View>
                <Text style={[styles.status, isRead ? styles.statusRead : styles.statusUnread]}>
                  {isRead ? 'READ' : 'UNREAD'}
                </Text>
              </View>
              <Text style={styles.message}>{item.message}</Text>
              <Text style={styles.meta}>{new Date(item.scheduledAt || item.sentAt || Date.now()).toLocaleString()}</Text>
              <View style={styles.actions}>
                <TouchableOpacity style={styles.actionButton} onPress={() => updateNotification(item._id, isRead ? 'MARK_UNREAD' : 'MARK_READ')}>
                  {isRead ? <MailOpen color="#CBD5E1" size={16} /> : <CheckCircle2 color="#00FF87" size={16} />}
                  <Text style={styles.actionText}>{isRead ? 'Unread' : 'Read'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={() => openRelatedCollection(item)}>
                  <Bell color="#CBD5E1" size={16} />
                  <Text style={styles.actionText}>Open</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#090D14', paddingHorizontal: 18, paddingTop: 22 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#090D14', gap: 10 },
  muted: { color: '#94A3B8', fontSize: 13 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  eyebrow: { color: '#00FF87', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', marginTop: 3 },
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
  status: { fontSize: 10, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  statusRead: { color: '#94A3B8', backgroundColor: '#111827' },
  statusUnread: { color: '#052E16', backgroundColor: '#00FF87' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  actionButton: { height: 34, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#111827', borderWidth: 1, borderColor: '#1E293B', flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { color: '#CBD5E1', fontSize: 12, fontWeight: '700' },
});

export default NotificationInboxScreen;
