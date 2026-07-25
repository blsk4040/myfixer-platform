// mobile_apps/client_app/src/screens/auth/LoginScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Sparkles } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, IconSizes, Radius, Shadows, Spacing, Typography } from '../../theme';
import authService, { AuthSession as LocalAuthSession } from '../../services/auth.service';
import apiService from '../../services/api.service';
import { assertConfiguredUrl, getApiBaseUrl } from '../../config/runtime.config';
import { BRAND } from '../../config/brand';
import { isExpoGoRuntime } from '../../config/runtimeEnvironment';

const brandLogo = require('../../assets/logo/final_2_logo.png');

type GoogleSigninModule = typeof import('@react-native-google-signin/google-signin')['GoogleSignin'];

const loadGoogleSignin = async (): Promise<GoogleSigninModule | null> => {
  if (isExpoGoRuntime) return null;
  try {
    const module = await import('@react-native-google-signin/google-signin');
    return module.GoogleSignin;
  } catch {
    return null;
  }
};

export function LoginScreen({ navigation }: any): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState<boolean>(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);

  // Configuration check using webClientId as specified
  const isGoogleConfigured = !!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

  // Configure native Google Sign-In on initial mount
  useEffect(() => {
    let isMounted = true;
    loadGoogleSignin().then((GoogleSignin) => {
      if (!isMounted || !GoogleSignin) return;
      GoogleSignin.configure({
        webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
        offlineAccess: false,
      });
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogin = async () => {
    const targetEmail = email ? email.trim() : '';
    const targetPassword = password ? password : '';

    if (!targetEmail || !targetPassword) {
      Alert.alert('Authentication Failed', 'Please populate all fields.');
      return;
    }

    setIsLoading(true);
    try {
      const apiUrl = getApiBaseUrl();
      assertConfiguredUrl(apiUrl, 'EXPO_PUBLIC_API_BASE_URL');
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetEmail.toLowerCase(),
          password: targetPassword,
        }),
      });

      const result = await response.json() as Partial<LocalAuthSession> & { message?: string };

      if (!response.ok) {
        throw new Error(result.message || 'Invalid username or credentials.');
      }

      if (!result.token || !result.user) {
        throw new Error('Login response was missing session details.');
      }

      await authService.persistSession({ token: result.token, user: result.user });
      if (result.user.role === 'CUSTOMER' && result.user.isEmailVerified === false) {
        navigation?.replace('VerifyEmailNotice');
        return;
      }
      navigation?.replace('MainTabs');
    } catch (error: any) {
      Alert.alert('Sign in failed', error.message || 'Please check your internet connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!isGoogleConfigured) {
      Alert.alert('Google Sign-In Unavailable', 'Google sign-in is not ready on this app build.');
      return;
    }

    setIsGoogleLoading(true);

    try {
      const GoogleSignin = await loadGoogleSignin();
      if (!GoogleSignin) {
        throw new Error('Please install the latest Padi app build to use Google sign-in.');
      }

      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });

      await GoogleSignin.signOut();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken;

      if (!idToken) {
        throw new Error('Google sign-in could not be completed. Please try again.');
      }

      await processGoogleAuthentication(idToken);
    } catch (error: any) {
      setIsGoogleLoading(false);

      if (error?.code === 'SIGN_IN_CANCELLED' || error?.code === '12501') {
        return;
      }

      Alert.alert(
        'Google Sign-In Failed',
        error.message || 'Unable to complete Google sign-in right now.'
      );
    }
  };

  const processGoogleAuthentication = async (idToken: string) => {
    try {
      const result = await apiService.signInWithGoogle(idToken);

      if (result.status === 'profile_required') {
        if (result.token && result.user) {
          await authService.persistSession({ token: result.token, user: result.user });
        }
        navigation?.navigate('CompleteClientProfile', {
          idToken,
          googleProfile: result.googleProfile,
        });
        return;
      }

      if (!result.token || !result.user) {
        throw new Error(result.message || 'Google sign-in could not be completed. Please try again.');
      }

      await authService.persistSession({ token: result.token, user: result.user });
      if (result.status === 'email_verification_required' || result.user.isEmailVerified === false) {
        navigation?.replace('VerifyEmailNotice');
        return;
      }
      navigation?.replace('MainTabs');
    } catch (error: any) {
      Alert.alert('Google Sign-In Failed', error.message || 'Unable to sign you in with Google right now.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardAvoidingView}>
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.brandContainer}>
            <View style={styles.logoFrame}>
              <Image
                source={brandLogo}
                style={styles.brandLogo}
                resizeMode="contain"
                accessible
                accessibilityLabel={`${BRAND.displayName} logo`}
              />
            </View>
            <Text style={styles.kicker}>Trusted home services, on demand</Text>
            <Text style={styles.heroTitle}>Welcome back</Text>
            <Text style={styles.heroCopy}>
              Sign in to book verified providers, track active jobs, and manage your Padi account.
            </Text>
            <View style={styles.signalRow}>
              <View style={styles.signalPill}>
                <ShieldCheck color={Colors.primary} size={16} />
                <Text style={styles.signalText}>Verified providers</Text>
              </View>
              <View style={styles.signalPill}>
                <Sparkles color={Colors.amber} size={16} />
                <Text style={styles.signalText}>Clear pricing</Text>
              </View>
            </View>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>Sign in</Text>
              <Text style={styles.formSubtitle}>Use your customer account details.</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <View style={[styles.inputShell, focusedField === 'email' && styles.inputShellFocused]}>
                <Mail color={focusedField === 'email' ? Colors.primary : Colors.textSubtle} size={IconSizes.md} />
                <TextInput
                  style={styles.input}
                  placeholder="name@domain.com"
                  placeholderTextColor={Colors.textSubtle}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  textContentType="username"
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  editable={!isLoading && !isGoogleLoading}
                  accessibilityLabel="Email address"
                  returnKeyType="next"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={[styles.inputShell, focusedField === 'password' && styles.inputShellFocused]}>
                <LockKeyhole color={focusedField === 'password' ? Colors.primary : Colors.textSubtle} size={IconSizes.md} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor={Colors.textSubtle}
                  secureTextEntry={!isPasswordVisible}
                  autoCapitalize="none"
                  autoComplete="password"
                  textContentType="password"
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  editable={!isLoading && !isGoogleLoading}
                  accessibilityLabel="Password"
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity
                  style={styles.visibilityButton}
                  activeOpacity={0.75}
                  onPress={() => setIsPasswordVisible((current) => !current)}
                  disabled={isLoading || isGoogleLoading}
                  accessibilityRole="button"
                  accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'}
                >
                  {isPasswordVisible ? (
                    <EyeOff color={Colors.textMuted} size={18} />
                  ) : (
                    <Eye color={Colors.textMuted} size={18} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={styles.forgotBtn}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('ForgotPassword')}
              disabled={isLoading || isGoogleLoading}
              accessibilityRole="button"
              accessibilityLabel="Forgot password"
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.loginBtn, (isLoading || isGoogleLoading) && styles.loginBtnDisabled]}
              activeOpacity={0.86}
              onPress={handleLogin}
              disabled={isLoading || isGoogleLoading}
              accessibilityRole="button"
              accessibilityLabel={isLoading ? 'Signing in' : 'Sign in'}
            >
              {isLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={Colors.background} />
                  <Text style={styles.loginBtnText}>Signing in</Text>
                </View>
              ) : (
                <View style={styles.buttonContent}>
                  <Text style={styles.loginBtnText}>Sign in</Text>
                  <ArrowRight color={Colors.background} size={18} />
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.socialDivider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={[
                styles.googleButton,
                (isLoading || isGoogleLoading || !isGoogleConfigured) && styles.googleButtonDisabled
              ]}
              activeOpacity={0.86}
              onPress={handleGoogleSignIn}
              disabled={isLoading || isGoogleLoading || !isGoogleConfigured}
              accessibilityRole="button"
              accessibilityLabel="Continue with Google"
            >
              {isGoogleLoading ? (
                <ActivityIndicator color="#111827" />
              ) : (
                <>
                  <View style={styles.googleIconWrap}>
                    <Text style={styles.googleIconText}>G</Text>
                  </View>
                  <Text style={styles.googleButtonText}>Google</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footerCard}>
            <Text style={styles.footerText}>New to Padi?</Text>
            <TouchableOpacity
              style={styles.registerButton}
              activeOpacity={0.78}
              onPress={() => navigation.navigate('Register')}
              disabled={isLoading || isGoogleLoading}
              accessibilityRole="button"
              accessibilityLabel="Create account"
            >
              <Text style={styles.registerText}>Create account</Text>
              <ArrowRight color={Colors.primary} size={16} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  keyboardAvoidingView: { flex: 1 },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.xxxl,
    paddingBottom: Spacing.huge,
    justifyContent: 'center',
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xxxl,
  },
  logoFrame: {
    width: '100%',
    maxWidth: 250,
    height: 104,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  brandLogo: {
    width: '100%',
    height: '100%',
  },
  kicker: {
    color: Colors.primary,
    fontSize: Typography.caption.fontSize,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0,
    marginBottom: Spacing.sm,
  },
  heroTitle: {
    color: Colors.white,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
    textAlign: 'center',
  },
  heroCopy: {
    color: Colors.textMuted,
    fontSize: Typography.body.fontSize,
    lineHeight: 22,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: Spacing.md,
    maxWidth: 330,
  },
  signalRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
  },
  signalPill: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.surface,
  },
  signalText: {
    color: Colors.text,
    fontSize: Typography.caption.fontSize,
    fontWeight: '700',
  },
  formContainer: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.xl,
    backgroundColor: Colors.card,
    ...Shadows.card,
  },
  formHeader: {
    marginBottom: Spacing.xl,
  },
  formTitle: {
    color: Colors.white,
    fontSize: Typography.title.fontSize,
    fontWeight: '900',
  },
  formSubtitle: {
    color: Colors.textSubtle,
    fontSize: Typography.label.fontSize,
    fontWeight: '600',
    marginTop: Spacing.xs,
  },
  inputGroup: { width: '100%', marginBottom: Spacing.lg },
  inputLabel: {
    color: Colors.text,
    fontSize: Typography.label.fontSize,
    fontWeight: Typography.label.fontWeight,
    marginBottom: Spacing.sm,
  },
  inputShell: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.input,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputShellFocused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceRaised,
  },
  input: {
    flex: 1,
    color: Colors.white,
    fontSize: Typography.body.fontSize,
    fontWeight: Typography.body.fontWeight,
    paddingVertical: Platform.OS === 'ios' ? Spacing.lg : Spacing.md,
  },
  visibilityButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
  },
  forgotBtn: { alignSelf: 'flex-end', paddingVertical: Spacing.sm },
  forgotText: { color: Colors.textMuted, fontSize: Typography.label.fontSize, fontWeight: '700' },
  loginBtn: {
    minHeight: 58,
    backgroundColor: Colors.primary,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xl,
  },
  loginBtnDisabled: { backgroundColor: Colors.primaryPressed, opacity: 0.7 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  buttonContent: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  loginBtnText: { color: Colors.background, fontSize: Typography.body.fontSize, fontWeight: '900' },
  socialDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginVertical: Spacing.xl,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { color: Colors.textSubtle, fontSize: Typography.caption.fontSize, fontWeight: '700' },
  googleButton: {
    minHeight: 56,
    backgroundColor: Colors.white,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.md,
  },
  googleButtonDisabled: { opacity: 0.4 },
  googleIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  googleIconText: { color: '#4285F4', fontSize: 16, fontWeight: '900' },
  googleButtonText: { color: '#111827', fontSize: Typography.body.fontSize, fontWeight: '900' },
  footerCard: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.xl,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  footerText: { color: Colors.textMuted, fontSize: Typography.label.fontSize, fontWeight: '700' },
  registerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flexShrink: 0,
  },
  registerText: { color: Colors.primary, fontSize: Typography.label.fontSize, fontWeight: '900' },
});
