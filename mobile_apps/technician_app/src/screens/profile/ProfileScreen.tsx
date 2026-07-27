// src/screens/profile/ProfileScreen.tsx
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, Share, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { NavigationProp, ParamListBase, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSocketConnection } from '../../context/SocketContext';
import { useJobStore } from '../../store/useJobStore';
import authService from '../../services/auth.service';
import apiService, { ProviderReferralProgramResponse } from '../../services/api.service';
import { getTechnicianIdentity } from '../../services/technicianIdentity.service';

const Colors = {
  background: '#0B0B0D',
  surface: '#17171A',
  surfaceRaised: '#222226',
  border: '#303036',
  primary: '#B8FF3D',
  text: '#F7F7F5',
  textMuted: '#B9B9BF',
  textSubtle: '#74747C',
  danger: '#FF5D5D',
};

const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
};

interface ProfileScreenProps {
  setIsAuthenticated: (auth: boolean) => void;
}

const formatServiceCategory = (value: string): string =>
  value
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');

export function ProfileScreen({ setIsAuthenticated }: ProfileScreenProps): React.JSX.Element {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { isOnDuty, toggleDutyStatus, disconnectSocket } = useSocketConnection();
  const completedJobs = useJobStore((state) => state.completedJobs);
  const technicianIdentity = getTechnicianIdentity();
  const [referralProgram, setReferralProgram] = useState<ProviderReferralProgramResponse['referral'] | null>(null);
  const [referralLoading, setReferralLoading] = useState(false);

  const totalCompletedCount = Math.max(technicianIdentity.stats.completedJobs, completedJobs.length);
  const currentRating = technicianIdentity.stats.reviewCount > 0 && technicianIdentity.stats.averageRating !== null
    ? technicianIdentity.stats.averageRating.toFixed(1)
    : '0.0';
  const reviewCountLabel = technicianIdentity.stats.reviewCount === 1
    ? '1 review'
    : `${technicianIdentity.stats.reviewCount} reviews`;
  const verificationLabel = technicianIdentity.approvalStatus === 'Approved'
    ? 'Verified Padi Pro'
    : `Status: ${technicianIdentity.approvalStatus}`;
  const serviceCategories = technicianIdentity.serviceCategories.length
    ? technicianIdentity.serviceCategories.map(formatServiceCategory)
    : ['No services set'];

  useEffect(() => {
    setReferralLoading(true);
    apiService.getMyReferralProgram()
      .then((result) => setReferralProgram(result.referral))
      .catch(() => setReferralProgram(null))
      .finally(() => setReferralLoading(false));
  }, []);

  const handleShareInvite = async () => {
    const fallbackCode = technicianIdentity.referralCode;
    const message = referralProgram?.shareMessage ||
      (fallbackCode
        ? `Book trusted home services through Padi. Use my invite code ${fallbackCode} when you sign up.`
        : '');

    if (!message) {
      Alert.alert('Invite unavailable', 'Your invite code is not ready yet. Please try again shortly.');
      return;
    }

    await Share.share({ message });
  };

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
            <Text style={styles.reputationLine}>
              {verificationLabel} · {reviewCountLabel}
            </Text>
            <Text style={styles.photoStatus}>Photo: {technicianIdentity.profilePhotoStatus}</Text>
          </View>
        </TouchableOpacity>

        <View style={[styles.dutyCard, { borderColor: isOnDuty ? Colors.primary : Colors.danger }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dutyLabel}>AVAILABILITY</Text>
            <Text style={[styles.dutyStatusText, { color: isOnDuty ? Colors.primary : Colors.danger }]}>
              {isOnDuty ? 'Live and receiving jobs' : 'Off duty'}
            </Text>
          </View>
          <Switch
            value={isOnDuty}
            onValueChange={handleToggleDuty}
            trackColor={{ false: Colors.surfaceRaised, true: '#B8FF3D30' }}
            thumbColor={isOnDuty ? Colors.primary : Colors.textSubtle}
          />
        </View>

        <View style={styles.performanceMetricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>RATING</Text>
            <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {currentRating}
            </Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>COMPLETED</Text>
            <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {totalCompletedCount} jobs
            </Text>
          </View>
        </View>

        <View style={styles.inviteCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.inviteEyebrow}>GROW WITH PADI</Text>
            <Text style={styles.inviteTitle}>Invite a customer to Padi</Text>
            <Text style={styles.inviteCopy}>
              Share your code with customers who already trust your work. Rewards will be added after the official rules are approved.
            </Text>
            <View style={styles.inviteCodeBox}>
              {referralLoading ? (
                <ActivityIndicator color={Colors.primary} />
              ) : (
                <Text style={styles.inviteCode}>{referralProgram?.referralCode || technicianIdentity.referralCode || 'CODE READY SOON'}</Text>
              )}
            </View>
            {referralProgram && (
              <Text style={styles.inviteStats}>
                {referralProgram.summary.registeredCount} signed up · {referralProgram.summary.completedCount} completed jobs
              </Text>
            )}
          </View>
          <TouchableOpacity style={styles.inviteButton} activeOpacity={0.86} onPress={handleShareInvite}>
            <Text style={styles.inviteButtonText}>Share</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Services</Text>
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

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('Security')}
          >
            <Text style={styles.menuItemText}>Security</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('Support')}
          >
            <Text style={styles.menuItemText}>Help & Support</Text>
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
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContainer: { padding: 20, paddingBottom: 80 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 20 },
  avatarPlaceholder: { width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.surfaceRaised, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.primary, position: 'relative', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: Colors.primary, fontSize: 20, fontWeight: '700' },
  avatarEditBadge: { position: 'absolute', bottom: -2, right: -2, backgroundColor: Colors.primary, width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  avatarEditBadgeText: { color: Colors.background, fontSize: 12, fontWeight: '900', lineHeight: 14 },
  techName: { color: Colors.text, fontSize: 20, fontWeight: '700' },
  techMeta: { color: Colors.textSubtle, fontSize: 13 },
  reputationLine: { color: Colors.primary, fontSize: 12, fontWeight: '900', marginTop: 3 },
  photoStatus: { color: Colors.primary, fontSize: 12, fontWeight: '800', marginTop: 3 },
  dutyCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, padding: 16, borderRadius: Radius.md, borderWidth: 1, marginBottom: 20 },
  dutyLabel: { color: Colors.textSubtle, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  dutyStatusText: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  performanceMetricsGrid: { flexDirection: 'row', gap: 12, marginBottom: 25 },
  metricCard: { flex: 1, minWidth: 0, backgroundColor: Colors.surface, padding: 14, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border },
  metricLabel: { color: Colors.textSubtle, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  metricValue: { color: Colors.text, fontSize: 16, fontWeight: '700', marginTop: 4 },
  inviteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#141511',
    borderWidth: 1,
    borderColor: '#B8FF3D44',
    borderRadius: Radius.lg,
    padding: 16,
    marginBottom: 25,
  },
  inviteEyebrow: { color: Colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  inviteTitle: { color: Colors.text, fontSize: 17, fontWeight: '900', marginTop: 4 },
  inviteCopy: { color: Colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 6 },
  inviteCodeBox: {
    alignSelf: 'flex-start',
    minHeight: 34,
    minWidth: 112,
    paddingHorizontal: 12,
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: '#0B0B0D',
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteCode: { color: Colors.primary, fontSize: 14, fontWeight: '900', letterSpacing: 0.6 },
  inviteStats: { color: Colors.textSubtle, fontSize: 11, fontWeight: '700', marginTop: 8 },
  inviteButton: {
    minWidth: 74,
    minHeight: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
  },
  inviteButtonText: { color: Colors.background, fontSize: 13, fontWeight: '900' },
  sectionTitle: { color: Colors.text, fontSize: 13, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 12, marginTop: 5 },
  badgeWrapper: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 25 },
  badge: { backgroundColor: Colors.surface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: Colors.border },
  badgeText: { color: Colors.text, fontSize: 12, fontWeight: '600' },
  menuGroup: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', marginBottom: 30 },
  menuItem: { padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  menuItemText: { color: Colors.textMuted, fontSize: 14, fontWeight: '500' },
  logoutButton: { backgroundColor: '#FF5D5D18', paddingVertical: 15, alignItems: 'center', borderRadius: Radius.md, borderWidth: 1, borderColor: '#FF5D5D44', marginBottom: 20 },
  logoutText: { color: Colors.danger, fontWeight: '700', fontSize: 14 },
});
