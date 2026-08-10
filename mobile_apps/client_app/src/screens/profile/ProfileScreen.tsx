// src/screens/profile/ProfileScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import authService from '../../services/auth.service';
import apiService, { CustomerLoyaltyProgramResponse, CustomerProfile, CustomerReferralProgramResponse } from '../../services/api.service';
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
  const [referral, setReferral] = useState<CustomerReferralProgramResponse['referral'] | null>(null);
  const [loyalty, setLoyalty] = useState<CustomerLoyaltyProgramResponse['loyalty'] | null>(null);
  const [referralLoading, setReferralLoading] = useState(true);
  const [loyaltyLoading, setLoyaltyLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [managedCollectionPaymentsAvailable, setManagedCollectionPaymentsAvailable] = useState(false);

  useEffect(() => {
    apiService.getMyProfile()
      .then((response) => setProfile(response.profile))
      .catch((error: Error) => Alert.alert('Account', customerErrorMessage(error, 'Unable to load your account right now.')))
      .finally(() => setLoading(false));

    apiService.getMyReferralProgram()
      .then((response) => setReferral(response.referral))
      .catch(() => setReferral(null))
      .finally(() => setReferralLoading(false));

    apiService.getMyLoyaltyProgram()
      .then((response) => setLoyalty(response.loyalty))
      .catch(() => setLoyalty(null))
      .finally(() => setLoyaltyLoading(false));
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

  const handleShareInvite = async () => {
    if (!referral?.shareMessage) {
      Alert.alert('Invite friends', 'Your invite code is not ready yet. Please try again shortly.');
      return;
    }

    await Share.share({ message: referral.shareMessage });
  };

  const handleWhatsAppInvite = async () => {
    if (!referral?.shareMessage) {
      Alert.alert('Invite friends', 'Your invite code is not ready yet. Please try again shortly.');
      return;
    }

    const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(referral.shareMessage)}`;
    const canOpenWhatsApp = await Linking.canOpenURL(whatsappUrl);
    if (canOpenWhatsApp) {
      await Linking.openURL(whatsappUrl);
      return;
    }

    await Share.share({ message: referral.shareMessage });
  };

  const formatRewardOffer = (reward: NonNullable<CustomerReferralProgramResponse['referral']['rewards']>[number]) => {
    if (reward.discountType === 'FREE_CALLOUT') return 'Free call-out';
    const amountMinor = reward.maxDiscountMinor ?? reward.discountValue;
    if (reward.discountType === 'FIXED_AMOUNT') return `${reward.currency} ${Math.round(amountMinor / 100)} off`;
    return `${reward.discountValue}% off`;
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

        <View style={styles.loyaltyCard}>
          <View style={styles.loyaltyHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.loyaltyEyebrow}>Padi rewards</Text>
              <Text style={styles.loyaltyTitle}>
                {loyalty?.rewards?.length ? 'You have loyalty rewards' : loyalty?.nextRewardTitle || 'Keep booking, keep earning'}
              </Text>
              <Text style={styles.loyaltyCopy}>
                Rewards unlock from real paid jobs completed through Padi. No cash payouts, no shortcuts.
              </Text>
            </View>
            <View style={styles.loyaltyProgressBadge}>
              {loyaltyLoading ? (
                <ActivityIndicator color={Colors.primary} />
              ) : (
                <>
                  <Text style={styles.loyaltyProgressValue}>
                    {Math.min(loyalty?.completedCount || 0, loyalty?.milestone || 5)}/{loyalty?.milestone || 5}
                  </Text>
                  <Text style={styles.loyaltyProgressLabel}>Jobs</Text>
                </>
              )}
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(
                    100,
                    Math.round(((loyalty?.completedCount || 0) / Math.max(loyalty?.milestone || 5, 1)) * 100)
                  )}%`,
                },
              ]}
            />
          </View>

          <Text style={styles.loyaltyMeta}>
            {loyalty?.remainingCount
              ? `${loyalty.remainingCount} more completed paid job${loyalty.remainingCount === 1 ? '' : 's'} to unlock ${loyalty.nextRewardTitle}.`
              : loyalty?.rewards?.length
                ? 'Your earned reward is ready below.'
                : 'Your first loyalty milestone is being prepared.'}
          </Text>

          {loyalty?.rewards?.length ? (
            <View style={styles.loyaltyRewardStack}>
              {loyalty.rewards.map((reward) => (
                <View key={reward.id} style={styles.loyaltyRewardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.loyaltyRewardTitle}>{reward.title}</Text>
                    <Text style={styles.loyaltyRewardMeta}>
                      {reward.status} {reward.partnerName ? `- ${reward.partnerName}` : ''}{reward.promotionCode ? ` - code ${reward.promotionCode}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.loyaltyRewardType}>{reward.rewardType.replace(/_/g, ' ')}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.referralCard}>
          <View style={styles.referralHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.referralEyebrow}>Invite friends</Text>
              <Text style={styles.referralTitle}>Give a friend a Padi discount</Text>
              <Text style={styles.referralCopy}>
                Share your code with someone who needs a trusted service. Rewards only unlock after a real paid completed booking.
              </Text>
            </View>
          </View>

          <View style={styles.referralCodePanel}>
            <View>
              <Text style={styles.referralCodeLabel}>Your invite code</Text>
              <View style={styles.referralCodeBox}>
                {referralLoading ? (
                  <ActivityIndicator color={Colors.primary} />
                ) : (
                  <Text style={styles.referralCode}>{referral?.referralCode || 'CODE READY SOON'}</Text>
                )}
              </View>
            </View>
            <View style={styles.referralActionStack}>
              <TouchableOpacity style={styles.whatsAppButton} activeOpacity={0.86} onPress={handleWhatsAppInvite}>
                <Text style={styles.whatsAppButtonText}>WhatsApp</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.shareButton} activeOpacity={0.86} onPress={handleShareInvite}>
                <Text style={styles.shareButtonText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>

          {referral ? (
            <View style={styles.referralStatsGrid}>
              <View style={styles.referralStatPill}>
                <Text style={styles.referralStatValue}>{referral.summary.registeredCount}</Text>
                <Text style={styles.referralStatLabel}>Invited</Text>
              </View>
              <View style={styles.referralStatPill}>
                <Text style={styles.referralStatValue}>{referral.summary.completedCount}</Text>
                <Text style={styles.referralStatLabel}>Completed</Text>
              </View>
              <View style={styles.referralStatPill}>
                <Text style={styles.referralStatValue}>{referral.summary.rewardEligibleCount}</Text>
                <Text style={styles.referralStatLabel}>Rewards</Text>
              </View>
            </View>
          ) : null}

          {referral?.rewards?.length ? (
            <View style={styles.rewardStack}>
              <Text style={styles.rewardSectionTitle}>Your rewards</Text>
              {referral.rewards.map((reward) => (
                <View key={reward.id || reward.code} style={styles.rewardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rewardTitle}>{reward.title}</Text>
                    <Text style={styles.rewardMeta}>{formatRewardOffer(reward)} - use code {reward.code}</Text>
                  </View>
                  <Text style={styles.rewardStatus}>{reward.status}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.noRewardText}>
              No reward code yet. Your next reward appears here after an invited friend completes a paid booking.
            </Text>
          )}
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

        <View style={styles.signOutSection}>
          <TouchableOpacity style={styles.signOutBtn} activeOpacity={0.8} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
          <Text style={styles.signOutHelper}>You can sign back in anytime with your Padi account.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  scrollContainer: { padding: 20, paddingBottom: 168 },
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
  loyaltyCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: 18, borderWidth: 1, borderColor: Colors.border, marginBottom: 18 },
  loyaltyHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  loyaltyEyebrow: { color: '#FFB547', fontSize: 10, fontWeight: '900', letterSpacing: 0.7, textTransform: 'uppercase' },
  loyaltyTitle: { color: Colors.text, fontSize: 17, fontWeight: '900', marginTop: 4 },
  loyaltyCopy: { color: Colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 6 },
  loyaltyProgressBadge: { width: 68, height: 68, borderRadius: 34, borderWidth: 1, borderColor: '#FFB547', backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  loyaltyProgressValue: { color: Colors.text, fontSize: 16, fontWeight: '900' },
  loyaltyProgressLabel: { color: Colors.textSubtle, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  progressTrack: { height: 8, backgroundColor: Colors.background, borderRadius: 4, overflow: 'hidden', marginTop: 16 },
  progressFill: { height: '100%', backgroundColor: '#FFB547', borderRadius: 4 },
  loyaltyMeta: { color: Colors.textSubtle, fontSize: 11, fontWeight: '700', lineHeight: 16, marginTop: 10 },
  loyaltyRewardStack: { marginTop: 14, gap: 8 },
  loyaltyRewardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: 12 },
  loyaltyRewardTitle: { color: Colors.text, fontSize: 13, fontWeight: '900' },
  loyaltyRewardMeta: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', marginTop: 3 },
  loyaltyRewardType: { maxWidth: 96, color: '#FFB547', fontSize: 9, fontWeight: '900', textAlign: 'right' },
  referralCard: { backgroundColor: '#141511', borderRadius: Radius.lg, padding: 18, borderWidth: 1, borderColor: 'rgba(184, 255, 61, 0.28)', marginBottom: 24 },
  referralHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  referralEyebrow: { color: Colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 0.7, textTransform: 'uppercase' },
  referralTitle: { color: Colors.text, fontSize: 17, fontWeight: '900', marginTop: 4 },
  referralCopy: { color: Colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 6 },
  referralCodePanel: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginTop: 16 },
  referralCodeLabel: { color: Colors.textSubtle, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginBottom: 7 },
  referralActionStack: { flexDirection: 'row', gap: 8, flexShrink: 0 },
  shareButton: { minHeight: 40, minWidth: 72, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceRaised, borderWidth: 1, borderColor: Colors.borderStrong, paddingHorizontal: 14 },
  shareButtonText: { color: Colors.text, fontSize: 13, fontWeight: '900' },
  whatsAppButton: { minHeight: 40, minWidth: 92, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, paddingHorizontal: 14 },
  whatsAppButtonText: { color: Colors.background, fontSize: 13, fontWeight: '900' },
  referralCodeBox: { alignSelf: 'flex-start', minHeight: 38, minWidth: 144, paddingHorizontal: 12, borderRadius: 10, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  referralCode: { color: Colors.primary, fontSize: 15, fontWeight: '900', letterSpacing: 0.7 },
  referralStatsGrid: { flexDirection: 'row', gap: 8, marginTop: 14 },
  referralStatPill: { flex: 1, minWidth: 0, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingVertical: 10, alignItems: 'center' },
  referralStatValue: { color: Colors.text, fontSize: 16, fontWeight: '900' },
  referralStatLabel: { color: Colors.textSubtle, fontSize: 9, fontWeight: '900', textTransform: 'uppercase', marginTop: 2 },
  rewardStack: { marginTop: 14, gap: 8 },
  rewardSectionTitle: { color: Colors.text, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.background, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: 12 },
  rewardTitle: { color: Colors.text, fontSize: 13, fontWeight: '800' },
  rewardMeta: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', marginTop: 3 },
  rewardStatus: { color: Colors.primary, fontSize: 10, fontWeight: '900' },
  noRewardText: { color: Colors.textSubtle, fontSize: 11, fontWeight: '700', marginTop: 12 },
  sectionTitle: { color: Colors.textSubtle, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 },
  menuStack: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  menuRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  menuIcon: { color: Colors.primary, fontSize: 20 },
  menuTitle: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  menuSubtitle: { color: Colors.textSubtle, fontSize: 11, marginTop: 2, lineHeight: 14 },
  chevron: { color: Colors.textSubtle, fontSize: 18, fontWeight: '600' },
  signOutSection: { marginTop: 28, marginBottom: 18, paddingTop: 18, borderTopWidth: 1, borderTopColor: Colors.border, alignItems: 'center' },
  signOutBtn: { width: '100%', minHeight: 52, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: Colors.surfaceRaised },
  signOutText: { color: Colors.text, fontSize: 14, fontWeight: '800' },
  signOutHelper: { color: Colors.textSubtle, fontSize: 11, fontWeight: '600', lineHeight: 16, marginTop: 10, textAlign: 'center' },
});
