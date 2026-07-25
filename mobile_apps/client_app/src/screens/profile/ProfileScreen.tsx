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
import { Colors, Radius } from '../../theme';
import { customerErrorMessage } from '../../utils/userFacingErrors';

interface ProfileOption {
  title: string;
  subtitle: string;
  icon: string;
  actionKey: string;
}

export function ProfileScreen({ navigation }: any): React.JSX.Element {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [managedCollectionPaymentsAvailable, setManagedCollectionPaymentsAvailable] = useState(false);

  useEffect(() => {
    apiService.getMyProfile()
      .then((response) => setProfile(response.profile))
      .catch((error: Error) => Alert.alert('Account', customerErrorMessage(error, 'Unable to load your account right now.')))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!profile?.countryCode) {
      setManagedCollectionPaymentsAvailable(false);
      return;
    }

    apiService.getMarketAvailability({
      countryCode: profile.countryCode,
      city: profile.location?.city,
      area: profile.location?.area,
    })
      .then((response) => {
        const managedCollection = response.availability.services.find((service) => service.serviceKey === 'managed_collection');
        setManagedCollectionPaymentsAvailable(Boolean(managedCollection?.canBook));
      })
      .catch(() => setManagedCollectionPaymentsAvailable(false));
  }, [profile?.countryCode, profile?.location?.area, profile?.location?.city]);

  const accountOptions: ProfileOption[] = [
    { title: 'History', subtitle: 'Same booking history as the History tab', icon: '•', actionKey: 'History' },
    { title: 'Active Requests', subtitle: 'Track jobs currently in progress', icon: '•', actionKey: 'Activity' },
    ...(managedCollectionPaymentsAvailable
      ? [{ title: 'Wallet & Payments', subtitle: 'Manage Managed Collection subscriptions and payments', icon: '•', actionKey: 'Payments' }]
      : []),
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
        navigation.navigate('Subscriptions');
        break;
      case 'Security':
        navigation.navigate('Security');
        break;
      case 'Support':
        navigation.navigate('Support');
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
        <ActivityIndicator color={Colors.primary} />
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
              <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {profile?.stats?.completedBookingCount ?? 0}
              </Text>
              <Text style={styles.metricLabel}>Completed</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {profile?.stats?.activeRequestCount ?? 0}
              </Text>
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
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  scrollContainer: { padding: 20, paddingBottom: 110 },
  profileHeroCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, marginBottom: 28 },
  avatarMock: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(184, 255, 61, 0.14)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.primary, marginBottom: 14 },
  avatarText: { color: Colors.primary, fontSize: 24, fontWeight: '700' },
  userName: { color: Colors.text, fontSize: 20, fontWeight: '800' },
  userEmail: { color: Colors.textSubtle, fontSize: 13, marginTop: 4 },
  metricsRow: { flexDirection: 'row', marginTop: 18, justifyContent: 'space-around', width: '100%' },
  metricItem: { flex: 1, alignItems: 'center', minWidth: 0 },
  metricValue: { color: Colors.text, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  metricLabel: { color: Colors.textSubtle, fontSize: 11 },
  addressBox: { marginTop: 18, width: '100%', backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: 12 },
  addressLabel: { color: Colors.textSubtle, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  addressText: { color: Colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  sectionTitle: { color: Colors.textSubtle, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 },
  menuStack: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  menuRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  menuIcon: { color: Colors.primary, fontSize: 20 },
  menuTitle: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  menuSubtitle: { color: Colors.textSubtle, fontSize: 11, marginTop: 2, lineHeight: 14 },
  chevron: { color: Colors.textSubtle, fontSize: 18, fontWeight: '600' },
  signOutBtn: { padding: 16, borderRadius: Radius.md, alignItems: 'center', marginTop: 32, borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: Colors.surfaceRaised },
  signOutText: { color: Colors.text, fontSize: 14, fontWeight: '700' },
});
