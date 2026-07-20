// mobile_apps/client_app/src/screens/profile/SecurityScreen.tsx
import React from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, CheckCircle2, ChevronRight, KeyRound, Mail, ShieldCheck } from 'lucide-react-native';

import authService from '../../services/auth.service';
import { Colors, Radius, Spacing } from '../../theme';

const BellIcon = Bell as any;
const CheckCircleIcon = CheckCircle2 as any;
const ChevronRightIcon = ChevronRight as any;
const KeyIcon = KeyRound as any;
const MailIcon = Mail as any;
const ShieldIcon = ShieldCheck as any;

export function SecurityScreen({ navigation }: any): React.JSX.Element {
  const session = authService.getSession();
  const isEmailVerified = session?.user.isEmailVerified !== false;
  const email = session?.user.email || 'Email unavailable';

  const handleChangePassword = () => {
    navigation.navigate('ForgotPassword');
  };

  const handleEmailVerification = () => {
    if (isEmailVerified) {
      Alert.alert('Email verified', 'Your email is already verified.');
      return;
    }

    navigation.navigate('VerifyEmailNotice');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <ShieldIcon color={Colors.primary} size={28} strokeWidth={2.4} />
          </View>
          <Text style={styles.heroTitle}>Security</Text>
          <Text style={styles.heroText}>Manage how you sign in and protect your Padi account.</Text>
        </View>

        <Text style={styles.sectionLabel}>Sign-in security</Text>
        <View style={styles.cardStack}>
          <TouchableOpacity style={styles.actionRow} activeOpacity={0.84} onPress={handleChangePassword}>
            <View style={styles.iconWrap}>
              <KeyIcon color={Colors.primary} size={20} />
            </View>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>Password</Text>
              <Text style={styles.rowSubtitle}>Reset your password using your registered email.</Text>
            </View>
            <ChevronRightIcon color={Colors.textSubtle} size={19} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionRow} activeOpacity={0.84} onPress={handleEmailVerification}>
            <View style={styles.iconWrap}>
              <MailIcon color={isEmailVerified ? Colors.primary : Colors.amber} size={20} />
            </View>
            <View style={styles.rowCopy}>
              <View style={styles.titleLine}>
                <Text style={styles.rowTitle}>Email verification</Text>
                <View style={[styles.statusPill, isEmailVerified ? styles.statusPillGood : styles.statusPillWarning]}>
                  <Text style={[styles.statusText, isEmailVerified ? styles.statusTextGood : styles.statusTextWarning]}>
                    {isEmailVerified ? 'Verified' : 'Not verified'}
                  </Text>
                </View>
              </View>
              <Text style={styles.rowSubtitle} numberOfLines={2}>{email}</Text>
            </View>
            {isEmailVerified ? (
              <CheckCircleIcon color={Colors.primary} size={19} />
            ) : (
              <ChevronRightIcon color={Colors.textSubtle} size={19} />
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>Account protection</Text>
        <View style={styles.infoCard}>
          <View style={styles.iconWrap}>
            <BellIcon color={Colors.info} size={20} />
          </View>
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>Security alerts</Text>
            <Text style={styles.rowSubtitle}>Important account and booking security notices will appear in Alerts.</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Active session</Text>
        <View style={styles.infoCard}>
          <View style={styles.iconWrap}>
            <ShieldIcon color={Colors.primary} size={20} />
          </View>
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>This device</Text>
            <Text style={styles.rowSubtitle}>You are currently signed in on this device. Sign out remains available from Account.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContainer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 110 },
  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 22,
    marginBottom: 28,
  },
  heroIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(184, 255, 61, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(184, 255, 61, 0.34)',
    marginBottom: 16,
  },
  heroTitle: { color: Colors.text, fontSize: 26, fontWeight: '900' },
  heroText: { color: Colors.textMuted, fontSize: 13, lineHeight: 20, marginTop: 7, fontWeight: '600' },
  sectionLabel: {
    color: Colors.textSubtle,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 12,
    marginTop: 6,
  },
  cardStack: {
    backgroundColor: Colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: 22,
  },
  actionRow: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  infoRow: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  infoCard: {
    minHeight: 86,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    marginBottom: 22,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.input,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rowCopy: { flex: 1 },
  titleLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.sm },
  rowTitle: { color: Colors.text, fontSize: 15, fontWeight: '900' },
  rowSubtitle: { color: Colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 4, fontWeight: '600' },
  statusPill: {
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusPillGood: { backgroundColor: 'rgba(184, 255, 61, 0.13)' },
  statusPillWarning: { backgroundColor: 'rgba(255, 181, 71, 0.14)' },
  statusText: { fontSize: 10, fontWeight: '900' },
  statusTextGood: { color: Colors.primary },
  statusTextWarning: { color: Colors.amber },
});
