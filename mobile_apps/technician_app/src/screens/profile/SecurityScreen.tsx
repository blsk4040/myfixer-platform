import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, CheckCircle2, ChevronRight, Eye, EyeOff, FileCheck2, KeyRound, Mail, ShieldCheck, Smartphone, UserCheck, X } from 'lucide-react-native';

import authService from '../../services/auth.service';
import apiService, { SecuritySummaryResponse } from '../../services/api.service';

const Colors = {
  background: '#0B0B0D',
  surface: '#17171A',
  surfaceRaised: '#222226',
  input: '#1C1C20',
  border: '#303036',
  borderStrong: '#3A3A42',
  primary: '#B8FF3D',
  amber: '#FFB547',
  info: '#56B8FF',
  text: '#F7F7F5',
  textMuted: '#B9B9BF',
  textSubtle: '#74747C',
  overlay: 'rgba(0, 0, 0, 0.72)',
};

const Radius = {
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
};

const BellIcon = Bell as any;
const CheckCircleIcon = CheckCircle2 as any;
const ChevronRightIcon = ChevronRight as any;
const EyeIcon = Eye as any;
const EyeOffIcon = EyeOff as any;
const FileCheckIcon = FileCheck2 as any;
const KeyIcon = KeyRound as any;
const MailIcon = Mail as any;
const ShieldIcon = ShieldCheck as any;
const SmartphoneIcon = Smartphone as any;
const UserCheckIcon = UserCheck as any;
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

export function SecurityScreen(): React.JSX.Element {
  const session = authService.getSession();
  const [summary, setSummary] = useState<SecuritySummaryResponse['security'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [signingOutOthers, setSigningOutOthers] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

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

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardOffset(event.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardOffset(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const resetPasswordForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
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
        authService.setSession({ token: result.token, user: result.user, technician: result.technician || session?.technician });
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
      'Older Padi Pro sessions on other devices will be signed out. This device will remain signed in.',
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
                authService.setSession({ token: result.token, user: result.user, technician: result.technician || session?.technician });
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
          <Text style={styles.heroText}>Protect your Padi Pro account, provider documents and job access.</Text>
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

          <View style={styles.actionRow}>
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
            {isEmailVerified ? <CheckCircleIcon color={Colors.primary} size={19} /> : null}
          </View>
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

        <Text style={styles.sectionLabel}>Provider protection</Text>
        <View style={styles.infoCard}>
          <View style={styles.iconWrap}>
            <FileCheckIcon color={Colors.primary} size={20} />
          </View>
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>Account documents</Text>
            <Text style={styles.rowSubtitle}>Your profile photo, service approvals, jobs, quotes, invoices and payout records are protected under this account.</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.iconWrap}>
            <UserCheckIcon color={Colors.amber} size={20} />
          </View>
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>Go live from your own device</Text>
            <Text style={styles.rowSubtitle}>Only accept jobs from a device you control. Never share your login or accept work for another provider.</Text>
          </View>
        </View>

        <View style={[styles.infoCard, styles.disabledInfoCard]}>
          <View style={styles.iconWrap}>
            <ShieldIcon color={Colors.textSubtle} size={20} />
          </View>
          <View style={styles.rowCopy}>
            <View style={styles.titleLine}>
              <Text style={styles.rowTitle}>Two-step verification</Text>
              <View style={styles.comingSoonPill}>
                <Text style={styles.comingSoonText}>Coming soon</Text>
              </View>
            </View>
            <Text style={styles.rowSubtitle}>Extra protection for payouts, password changes and new-device sign-ins.</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.iconWrap}>
            <BellIcon color={Colors.info} size={20} />
          </View>
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>Security alerts</Text>
            <Text style={styles.rowSubtitle}>New sign-ins and account security events appear in Alerts.</Text>
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
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            contentContainerStyle={[styles.modalScrollContent, { paddingBottom: keyboardOffset ? keyboardOffset + 24 : 34 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
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
              <View style={styles.passwordField}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  secureTextEntry={!showCurrentPassword}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Enter current password"
                  placeholderTextColor={Colors.textSubtle}
                />
                <TouchableOpacity style={styles.passwordToggle} onPress={() => setShowCurrentPassword((value) => !value)} accessibilityLabel={showCurrentPassword ? 'Hide current password' : 'Show current password'}>
                  {showCurrentPassword ? <EyeOffIcon color={Colors.textMuted} size={20} /> : <EyeIcon color={Colors.textMuted} size={20} />}
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>New password</Text>
              <View style={styles.passwordField}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  secureTextEntry={!showNewPassword}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Enter new password"
                  placeholderTextColor={Colors.textSubtle}
                />
                <TouchableOpacity style={styles.passwordToggle} onPress={() => setShowNewPassword((value) => !value)} accessibilityLabel={showNewPassword ? 'Hide new password' : 'Show new password'}>
                  {showNewPassword ? <EyeOffIcon color={Colors.textMuted} size={20} /> : <EyeIcon color={Colors.textMuted} size={20} />}
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Confirm new password</Text>
              <View style={styles.passwordField}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  secureTextEntry={!showConfirmPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Repeat new password"
                  placeholderTextColor={Colors.textSubtle}
                />
                <TouchableOpacity style={styles.passwordToggle} onPress={() => setShowConfirmPassword((value) => !value)} accessibilityLabel={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}>
                  {showConfirmPassword ? <EyeOffIcon color={Colors.textMuted} size={20} /> : <EyeIcon color={Colors.textMuted} size={20} />}
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={[styles.saveButton, savingPassword && styles.disabledButton]} activeOpacity={0.86} onPress={handleChangePassword} disabled={savingPassword}>
                {savingPassword ? <ActivityIndicator color={Colors.background} /> : <Text style={styles.saveButtonText}>Update password</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContainer: { padding: 20, paddingBottom: 90 },
  heroCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, padding: 22, marginBottom: 24 },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  heroIcon: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(184, 255, 61, 0.12)', borderWidth: 1, borderColor: 'rgba(184, 255, 61, 0.34)' },
  scorePill: { borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: Colors.input, paddingHorizontal: 10, paddingVertical: 6 },
  scorePillText: { color: Colors.text, fontSize: 11, fontWeight: '900' },
  heroTitle: { color: Colors.text, fontSize: 26, fontWeight: '900' },
  heroText: { color: Colors.textMuted, fontSize: 13, lineHeight: 20, marginTop: 7, fontWeight: '600' },
  loadingCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, marginBottom: 20 },
  loadingText: { color: Colors.textMuted, fontSize: 12, fontWeight: '700' },
  sectionLabel: { color: Colors.textSubtle, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginBottom: 12, marginTop: 6 },
  cardStack: { backgroundColor: Colors.surface, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', marginBottom: 22 },
  actionRow: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 13, padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  infoCard: { minHeight: 86, flexDirection: 'row', alignItems: 'center', gap: 13, padding: 16, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, marginBottom: 16 },
  disabledInfoCard: { opacity: 0.72 },
  iconWrap: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border },
  rowCopy: { flex: 1 },
  titleLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  rowTitle: { color: Colors.text, fontSize: 15, fontWeight: '900' },
  rowSubtitle: { color: Colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 4, fontWeight: '600' },
  statusPill: { borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 4 },
  statusPillGood: { backgroundColor: 'rgba(184, 255, 61, 0.13)' },
  statusPillWarning: { backgroundColor: 'rgba(255, 181, 71, 0.14)' },
  statusText: { fontSize: 10, fontWeight: '900' },
  statusTextGood: { color: Colors.primary },
  statusTextWarning: { color: Colors.amber },
  comingSoonPill: { borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.borderStrong },
  comingSoonText: { color: Colors.textSubtle, fontSize: 10, fontWeight: '900' },
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
  modalScrollContent: { flexGrow: 1, justifyContent: 'flex-end', paddingTop: 48 },
  modalCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 42,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: Colors.text, fontSize: 22, fontWeight: '900' },
  modalSubtitle: { color: Colors.textSubtle, fontSize: 12, marginTop: 4, fontWeight: '700' },
  closeButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.input, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  inputLabel: { color: Colors.text, fontSize: 12, fontWeight: '900', marginBottom: 8, marginTop: 12 },
  input: { minHeight: 52, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.input, color: Colors.text, paddingHorizontal: 14, fontSize: 14, fontWeight: '700' },
  passwordField: { position: 'relative' },
  passwordInput: { paddingRight: 52 },
  passwordToggle: {
    position: 'absolute',
    right: 8,
    top: 0,
    width: 44,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: { minHeight: 56, borderRadius: Radius.lg, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 28, marginBottom: 6 },
  saveButtonText: { color: Colors.background, fontSize: 14, fontWeight: '900' },
});

export default SecurityScreen;
