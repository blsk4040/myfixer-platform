// src/screens/profile/ProfileScreen.tsx
import React from 'react';
import { Alert, Image, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { NavigationProp, ParamListBase, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSocketConnection } from '../../context/SocketContext';
import { useJobStore } from '../../store/useJobStore';
import authService from '../../services/auth.service';
import { getTechnicianIdentity } from '../../services/technicianIdentity.service';

interface ProfileScreenProps {
  setIsAuthenticated: (auth: boolean) => void;
}

export function ProfileScreen({ setIsAuthenticated }: ProfileScreenProps): React.JSX.Element {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { isOnDuty, toggleDutyStatus, disconnectSocket } = useSocketConnection();
  const completedJobs = useJobStore((state) => state.completedJobs);
  const technicianIdentity = getTechnicianIdentity();

  const totalCompletedCount = completedJobs.length;
  const currentRating = '5.00';
  const serviceCategories = technicianIdentity.serviceCategories.length
    ? technicianIdentity.serviceCategories
    : ['No service categories set'];

  const handleToggleDuty = () => {
    if (isOnDuty) {
      toggleDutyStatus();
      Alert.alert('Off duty', "You are offline. You won't receive new jobs.");
      return;
    }

    Alert.alert(
      'Go live?',
      'You will start receiving nearby job requests and share your location while live.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Go Live', onPress: toggleDutyStatus },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Log out?',
      'You will stop receiving jobs until you sign in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: () => {
            disconnectSocket();
            authService.clearSession();
            setIsAuthenticated(false);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.avatarRow}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('ProfilePictureUpload')}
        >
          <View style={styles.avatarPlaceholder}>
            {technicianIdentity.profilePhotoUrl ? (
              <Image source={{ uri: technicianIdentity.profilePhotoUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{technicianIdentity.initials}</Text>
            )}
            <View style={styles.avatarEditBadge}>
              <Text style={styles.avatarEditBadgeText}>+</Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.techName}>{technicianIdentity.displayName}</Text>
            <Text style={styles.techMeta}>{technicianIdentity.email}</Text>
            <Text style={styles.techMeta}>{technicianIdentity.phone}</Text>
            <Text style={styles.techMeta}>{technicianIdentity.city} - {technicianIdentity.approvalStatus}</Text>
            <Text style={styles.photoStatus}>Photo: {technicianIdentity.profilePhotoStatus}</Text>
          </View>
        </TouchableOpacity>

        <View style={[styles.dutyCard, { borderColor: isOnDuty ? '#00FF87' : '#EF4444' }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dutyLabel}>AVAILABILITY</Text>
            <Text style={[styles.dutyStatusText, { color: isOnDuty ? '#00FF87' : '#EF4444' }]}>
              {isOnDuty ? 'Live and receiving jobs' : 'Off duty'}
            </Text>
          </View>
          <Switch
            value={isOnDuty}
            onValueChange={handleToggleDuty}
            trackColor={{ false: '#1E293B', true: '#00FF8730' }}
            thumbColor={isOnDuty ? '#00FF87' : '#64748B'}
          />
        </View>

        <View style={styles.performanceMetricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>RATING</Text>
            <Text style={styles.metricValue}>{currentRating}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>COMPLETED</Text>
            <Text style={styles.metricValue}>{totalCompletedCount} jobs</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Service Areas</Text>
        <View style={styles.badgeWrapper}>
          {serviceCategories.map((spec) => (
            <View key={spec} style={styles.badge}>
              <Text style={styles.badgeText}>{spec}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.menuGroup}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => Alert.alert('Operating Area', `Your current operating city is ${technicianIdentity.city}.`)}
          >
            <Text style={styles.menuItemText}>Operating Area ({technicianIdentity.city})</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('BankingInvoice')}
          >
            <Text style={styles.menuItemText}>Banking Details & Tax Invoices</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          activeOpacity={0.8}
          onPress={handleLogout}
        >
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090D14' },
  scrollContainer: { padding: 20, paddingBottom: 80 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 20 },
  avatarPlaceholder: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#00FF87', position: 'relative', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: '#00FF87', fontSize: 20, fontWeight: '700' },
  avatarEditBadge: { position: 'absolute', bottom: -2, right: -2, backgroundColor: '#00FF87', width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  avatarEditBadgeText: { color: '#090D14', fontSize: 12, fontWeight: '900', lineHeight: 14 },
  techName: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  techMeta: { color: '#64748B', fontSize: 13 },
  photoStatus: { color: '#00FF87', fontSize: 12, fontWeight: '800', marginTop: 3 },
  dutyCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111827', padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 20 },
  dutyLabel: { color: '#64748B', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  dutyStatusText: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  performanceMetricsGrid: { flexDirection: 'row', gap: 12, marginBottom: 25 },
  metricCard: { flex: 1, backgroundColor: '#111827', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#1E293B' },
  metricLabel: { color: '#64748B', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  metricValue: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginTop: 4 },
  sectionTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 12, marginTop: 5 },
  badgeWrapper: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 25 },
  badge: { backgroundColor: '#111827', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#1E293B' },
  badgeText: { color: '#F8FAFC', fontSize: 12, fontWeight: '600' },
  menuGroup: { backgroundColor: '#111827', borderRadius: 14, borderWidth: 1, borderColor: '#1E293B', overflow: 'hidden', marginBottom: 30 },
  menuItem: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#1E293B', backgroundColor: '#111827' },
  menuItemText: { color: '#E2E8F0', fontSize: 14, fontWeight: '500' },
  logoutButton: { backgroundColor: '#EF444415', paddingVertical: 15, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#EF444430', marginBottom: 20 },
  logoutText: { color: '#EF4444', fontWeight: '700', fontSize: 14 },
});
