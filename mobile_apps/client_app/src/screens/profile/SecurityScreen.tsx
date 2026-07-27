// mobile_apps/client_app/src/screens/profile/SecurityScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, CheckCircle2, ChevronRight, KeyRound, Lock, Mail, ShieldCheck, Smartphone, X } from 'lucide-react-native';

import authService from '../../services/auth.service';
import apiService, { SecuritySummaryResponse } from '../../services/api.service';
import { Colors, Radius, Spacing } from '../../theme';

const BellIcon = Bell as any;
const CheckCircleIcon = CheckCircle2 as any;
const ChevronRightIcon = ChevronRight as any;
const KeyIcon = KeyRound as any;
const LockIcon = Lock as any;
const MailIcon = Mail as any;
const ShieldIcon = ShieldCheck as any;
const SmartphoneIcon = Smartphone as any;
const XIcon = X as any;

const formatDateTime = (value?: string | null): string => {
  if (!value) return 'Not recorded yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded yet';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export function SecurityScreen({ navigation }: any): React.JSX.Element {
  const session = authService.getSession();
  const [summary, setSummary] = useState<SecuritySummaryResponse['security'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingPassword, setSavingPassword] = useState(false);
  const [signingOutOthers, setSigningOutOthers] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const isEmailVerified = summary?.emailVerified ?? session?.user.isEmailVerified !== false;
  const email = summary?.email || session?.user.email || 'Email unavailable';

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiService.getSecuritySummary();
      setSummary(response.security);
    } catch (error) {
      Alert.alert('Security', error instanceof Error ? error.message : 'Unable to load security settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const resetPasswordForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleEmailVerification = () => {
    if (isEmailVerified) {
      Alert.alert('Email verified', 'Your email is already verified.');
      return;
    }

    navigation.navigate('VerifyEmailNotice');
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Password', 'Please complete all password fields.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Password', 'New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Password', 'New passwords do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      const result = await apiService.changePassword({ currentPassword, newPassword });
      if (result.token && result.user) {
        await authService.persistSession({ token: result.token, user: result.user });
      }
      resetPasswordForm();
      setPasswordModalVisible(false);
      await loadSummary();
      Alert.alert('Password updated', result.message || 'Your password has been updated.');
    } catch (error) {
      Alert.alert('Password', error instanceof Error ? error.message : 'Unable to change password.');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSignOutOtherSessions = () => {
    Alert.alert(
      'Sign out other sessions?',
      'Older sessions on other devices will be signed out. This device will remain signed in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out Others',
          style: 'destructive',
          onPress: async () => {
            setSigningOutOthers(true);
            try {
              const result = await apiService.signOutOtherSessions();
              if (result.token && result.user) {
                await authService.persistSession({ token: result.token, user: result.user });
              }
              await loadSummary();
              Alert.alert('Sessions updated', result.message || 'Other sessions were signed out.');
            } catch (error) {
              Alert.alert('Sessions', error instanceof Error ? error.message : 'Unable to sign out other sessions.');
            } finally {
              setSigningOutOthers(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroIcon}>
              <ShieldIcon color={Colors.primary} size={28} strokeWidth={2.4} />
            </View>
            <View style={styles.scorePill}>
              <Text style={styles.scorePillText}>{isEmailVerified ? 'Protected' : 'Needs review'}</Text>
            </View>
          </View>
          <Text style={styles.heroTitle}>Security</Text>
          <Text style={styles.heroText}>Protect your Padi account, password, sessions and alerts.</Text>
        </View>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={styles.loadingText}>Loading security settings...</Text>
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>Sign-in security</Text>
        <View style={styles.cardStack}>
          <TouchableOpacity style={styles.actionRow} activeOpacity={0.84} onPress={() => setPasswordModalVisible(true)}>
            <View style={styles.iconWrap}>
              <KeyIcon color={Colors.primary} size={20} />
            </View>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>Password</Text>
              <Text style={styles.rowSubtitle}>Last changed: {formatDateTime(summary?.lastPasswordChangeAt)}</Text>
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

        <Text style={styles.sectionLabel}>Sessions</Text>
        <View style={styles.infoCard}>
          <View style={styles.iconWrap}>
            <SmartphoneIcon color={Colors.primary} size={20} />
          </View>
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>This device</Text>
            <Text style={styles.rowSubtitle}>Last sign-in: {formatDateTime(summary?.lastLoginAt)}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.sessionButton, signingOutOthers && styles.disabledButton]}
          activeOpacity={0.84}
          onPress={handleSignOutOtherSessions}
          disabled={signingOutOthers}
        >
          {signingOutOthers ? <ActivityIndicator color={Colors.background} /> : <Text style={styles.sessionButtonText}>Sign out other sessions</Text>}
        </TouchableOpacity>

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

        {summary?.recentEvents?.length ? (
          <>
            <Text style={styles.sectionLabel}>Recent security activity</Text>
            <View style={styles.eventStack}>
              {summary.recentEvents.slice(0, 4).map((event) => (
                <View key={event.id} style={styles.eventRow}>
                  <View style={[styles.eventDot, event.success ? styles.eventDotGood : styles.eventDotWarning]} />
                  <View style={styles.rowCopy}>
                    <Text style={styles.eventTitle}>{event.action.replace(/[._-]+/g, ' ')}</Text>
                    <Text style={styles.rowSubtitle}>{formatDateTime(event.createdAt)}{event.device ? ` • ${event.device}` : ''}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>

      <Modal visible={passwordModalVisible} animationType="slide" transparent onRequestClose={() => setPasswordModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Change password</Text>
                <Text style={styles.modalSubtitle}>Use at least 8 characters.</Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  resetPasswordForm();
                  setPasswordModalVisible(false);
                }}
              >
                <XIcon color={Colors.text} size={20} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Current password</Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Enter current password"
              placeholderTextColor={Colors.textSubtle}
            />

            <Text style={styles.inputLabel}>New password</Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Enter new password"
              placeholderTextColor={Colors.textSubtle}
            />

            <Text style={styles.inputLabel}>Confirm new password</Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Repeat new password"
              placeholderTextColor={Colors.textSubtle}
            />

            <TouchableOpacity
              style={[styles.saveButton, savingPassword && styles.disabledButton]}
              activeOpacity={0.86}
              onPress={handleChangePassword}
              disabled={savingPassword}
            >
              {savingPassword ? <ActivityIndicator color={Colors.background} /> : <Text style={styles.saveButtonText}>Update password</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  heroIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(184, 255, 61, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(184, 255, 61, 0.34)',
  },
  scorePill: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.input,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  scorePillText: { color: Colors.text, fontSize: 11, fontWeight: '900' },
  heroTitle: { color: Colors.text, fontSize: 26, fontWeight: '900' },
  heroText: { color: Colors.textMuted, fontSize: 13, lineHeight: 20, marginTop: 7, fontWeight: '600' },
  loadingCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, marginBottom: 20 },
  loadingText: { color: Colors.textMuted, fontSize: 12, fontWeight: '700' },
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
    marginBottom: 16,
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
  sessionButton: { minHeight: 52, borderRadius: Radius.lg, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  sessionButtonText: { color: Colors.background, fontSize: 14, fontWeight: '900' },
  disabledButton: { opacity: 0.65 },
  eventStack: { borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, overflow: 'hidden' },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  eventDot: { width: 10, height: 10, borderRadius: 5 },
  eventDotGood: { backgroundColor: Colors.primary },
  eventDotWarning: { backgroundColor: Colors.amber },
  eventTitle: { color: Colors.text, fontSize: 13, fontWeight: '900', textTransform: 'capitalize' },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingTop: Spacing.xxl,
    paddingHorizontal: Spacing.xxl,
    paddingBottom: 42,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xl },
  modalTitle: { color: Colors.text, fontSize: 22, fontWeight: '900' },
  modalSubtitle: { color: Colors.textSubtle, fontSize: 12, marginTop: 4, fontWeight: '700' },
  closeButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.input, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  inputLabel: { color: Colors.text, fontSize: 12, fontWeight: '900', marginBottom: 8, marginTop: 12 },
  input: { minHeight: 52, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.input, color: Colors.text, paddingHorizontal: 14, fontSize: 14, fontWeight: '700' },
  saveButton: { minHeight: 56, borderRadius: Radius.lg, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 28, marginBottom: 6 },
  saveButtonText: { color: Colors.background, fontSize: 14, fontWeight: '900' },
});
