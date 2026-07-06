// src/screens/profile/ProfileScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import authService from '../../services/auth.service';
import apiService, { CustomerProfile } from '../../services/api.service';

interface ProfileOption {
  title: string;
  subtitle: string;
  icon: string;
  actionKey: string;
}

export function ProfileScreen({ navigation }: any): React.JSX.Element {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiService.getMyProfile()
      .then((response) => setProfile(response.profile))
      .catch((error: Error) => Alert.alert('Account', error.message))
      .finally(() => setLoading(false));
  }, []);

  const accountOptions: ProfileOption[] = [
    { title: 'Booking History', subtitle: 'View completed and cancelled service requests', icon: '•', actionKey: 'History' },
    { title: 'Active Requests', subtitle: 'Track jobs currently in progress', icon: '•', actionKey: 'Activity' },
    { title: 'Wallet & Payments', subtitle: 'Manage cards and payment methods', icon: '•', actionKey: 'Payments' },
    { title: 'Saved Address', subtitle: 'Manage your default service location', icon: '•', actionKey: 'Addresses' },
    { title: 'Security', subtitle: 'Password and account protection', icon: '•', actionKey: 'Security' },
    { title: 'Help & Support', subtitle: 'Get assistance with your account', icon: '•', actionKey: 'Support' },
  ];

  const handleAction = (key: string) => {
    switch (key) {
      case 'History':
        navigation.navigate('History');
        break;
      case 'Activity':
        navigation.navigate('Activity');
        break;
      case 'Addresses':
        navigation.navigate('Addresses');
        break;
      case 'Payments':
        Alert.alert('Wallet & Payments', 'Payment management is not available yet.');
        break;
      case 'Security':
        Alert.alert('Security', 'Security settings are not available yet.');
        break;
      case 'Support':
        Alert.alert('Support', 'Support Centre is not available yet.');
        break;
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to exit your session?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          authService.clearSession();
          navigation?.replace('Login');
        },
      },
    ]);
  };

  const initials = (profile?.name || 'Customer')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'C';

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#00FF87" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeroCard}>
          <View style={styles.avatarMock}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>

          <Text style={styles.userName}>{profile?.name || 'Customer'}</Text>
          <Text style={styles.userEmail}>{profile?.email || 'Email unavailable'}</Text>
          {profile?.phone ? <Text style={styles.userEmail}>{profile.phone}</Text> : null}

          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{profile?.stats?.completedBookingCount ?? 0}</Text>
              <Text style={styles.metricLabel}>Completed</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{profile?.stats?.activeRequestCount ?? 0}</Text>
              <Text style={styles.metricLabel}>Active</Text>
            </View>
          </View>

          {profile?.defaultServiceAddress?.fullAddress ? (
            <View style={styles.addressBox}>
              <Text style={styles.addressLabel}>Default Service Address</Text>
              <Text style={styles.addressText}>{profile.defaultServiceAddress.fullAddress}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>My Account</Text>
        <View style={styles.menuStack}>
          {accountOptions.map((opt, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.menuRow}
              activeOpacity={0.7}
              onPress={() => handleAction(opt.actionKey)}
            >
              <View style={styles.menuLeft}>
                <Text style={styles.menuIcon}>{opt.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuTitle}>{opt.title}</Text>
                  <Text style={styles.menuSubtitle}>{opt.subtitle}</Text>
                </View>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.signOutBtn} activeOpacity={0.8} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090D14' },
  loadingContainer: { flex: 1, backgroundColor: '#090D14', alignItems: 'center', justifyContent: 'center' },
  scrollContainer: { padding: 20, paddingBottom: 110 },
  profileHeroCard: { backgroundColor: '#111827', borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#1E293B', marginBottom: 28 },
  avatarMock: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#00FF8720', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#00FF87', marginBottom: 14 },
  avatarText: { color: '#00FF87', fontSize: 24, fontWeight: '700' },
  userName: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  userEmail: { color: '#64748B', fontSize: 13, marginTop: 4 },
  metricsRow: { flexDirection: 'row', marginTop: 18, justifyContent: 'space-around', width: '100%' },
  metricItem: { alignItems: 'center' },
  metricValue: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  metricLabel: { color: '#64748B', fontSize: 11 },
  addressBox: { marginTop: 18, width: '100%', backgroundColor: '#090D14', borderWidth: 1, borderColor: '#1E293B', borderRadius: 12, padding: 12 },
  addressLabel: { color: '#64748B', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  addressText: { color: '#E2E8F0', fontSize: 12, lineHeight: 18, marginTop: 4 },
  sectionTitle: { color: '#64748B', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 },
  menuStack: { backgroundColor: '#111827', borderRadius: 16, borderWidth: 1, borderColor: '#1E293B', overflow: 'hidden' },
  menuRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  menuIcon: { color: '#00FF87', fontSize: 20 },
  menuTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  menuSubtitle: { color: '#64748B', fontSize: 11, marginTop: 2, lineHeight: 14 },
  chevron: { color: '#64748B', fontSize: 18, fontWeight: '600' },
  signOutBtn: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 32, borderWidth: 1, borderColor: '#EF444430', backgroundColor: '#EF444405' },
  signOutText: { color: '#EF4444', fontSize: 14, fontWeight: '700' },
});
