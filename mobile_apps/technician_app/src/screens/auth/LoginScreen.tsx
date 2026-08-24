// src/screens/auth/LoginScreen.tsx
import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform,
  Image,
  Alert,
  ActivityIndicator,
  NativeModules,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, EyeOff } from 'lucide-react-native';
import apiService from '../../services/api.service';
import authService, { AuthSession } from '../../services/auth.service';
import { BRAND } from '../../config/brand';

const appLogo = require('../../../assets/logo/app_logo.png');
const EyeIcon = Eye as any;
const EyeOffIcon = EyeOff as any;

const Colors = {
  background: '#0B0B0D',
  card: '#141417',
  input: '#1C1C20',
  border: '#303036',
  primary: '#B8FF3D',
  amber: '#FFB547',
  text: '#F7F7F5',
  textMuted: '#B9B9BF',
  textSubtle: '#74747C',
};

const trustSignals = ['Verified jobs', 'Protected payments', 'Live dispatch'];

interface LoginScreenProps {
  onLoginSuccess: (session: AuthSession) => void;
  onRegisterPress: () => void;
  onVerificationRequired: (details: { email?: string }) => void;
}

export function LoginScreen({ onLoginSuccess, onRegisterPress, onVerificationRequired }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const hasGoogleNativeModule = Boolean((NativeModules as Record<string, unknown>).RNGoogleSignin);
  const isGoogleConfigured = !!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID && hasGoogleNativeModule;

  useEffect(() => {
    if (!hasGoogleNativeModule || !process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) return;

    const { GoogleSignin } = require('@react-native-google-signin/google-signin');
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      offlineAccess: false,
    });
  }, [hasGoogleNativeModule]);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing Fields', 'Please enter your service provider email and password.');
      return;
    }

    try {
      setIsLoading(true);
      const session = await apiService.login(email, password);
      const role = session.user.role.toUpperCase();

      if (role !== 'TECHNICIAN' && role !== 'ADMIN') {
        throw new Error('This account is not registered as a service provider.');
      }

      authService.setSession(session);
      onLoginSuccess(session);
    } catch (error: any) {
      if (typeof error.message === 'string' && error.message.toLowerCase().includes('verify your email')) {
        onVerificationRequired({ email: email.trim() });
        return;
      }

      Alert.alert('Sign In Failed', error.message || 'Unable to sign in.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!hasGoogleNativeModule) {
      Alert.alert('Google Sign-In Unavailable', 'Please install the latest Padi Pro app build to use Google sign-in.');
      return;
    }

    if (!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) {
      Alert.alert('Google Sign-In Unavailable', 'Google sign-in is not ready on this app build.');
      return;
    }

    setIsGoogleLoading(true);

    try {
      const { GoogleSignin } = require('@react-native-google-signin/google-signin');
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });

      await GoogleSignin.signOut();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken;

      if (!idToken) {
        throw new Error('Google sign-in could not be completed. Please try again.');
      }

      const result = await apiService.signInWithGoogle(idToken);

      if (result.status === 'profile_required') {
        Alert.alert(
          'Service provider application required',
          'This Google account is not registered as an approved service provider yet. Please submit a service provider application.',
          [{ text: 'Apply Now', onPress: onRegisterPress }]
        );
        return;
      }

      if (result.status === 'email_verification_required') {
        onVerificationRequired({ email: result.user?.email });
        return;
      }

      if (!result.token || !result.user) {
        throw new Error(result.message || 'Google sign-in could not be completed. Please try again.');
      }

      const role = result.user.role.toUpperCase();

      if (role !== 'TECHNICIAN' && role !== 'ADMIN') {
        throw new Error('This Google account is not registered as a service provider.');
      }

      const session = { token: result.token, user: result.user, technician: result.technician };
      authService.setSession(session);
      onLoginSuccess(session);
    } catch (error: any) {
      if (error?.code === 'SIGN_IN_CANCELLED' || error?.code === '12501') {
        return;
      }

      Alert.alert('Google Sign-In Failed', error.message || 'Unable to complete Google sign-in right now.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.heroHeader}>
            <Image
              source={appLogo}
              style={styles.logoImage}
              resizeMode="contain"
              accessible
              accessibilityLabel={`${BRAND.platformName} logo`}
            />
            <Text style={styles.subtitleText}>Professional workspace for trusted service providers.</Text>
            <View style={styles.signalRow}>
              {trustSignals.map((signal) => (
                <View key={signal} style={styles.signalPill}>
                  <Text style={styles.signalText}>{signal}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.formCard}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>Ready for work?</Text>
              <Text style={styles.formSubtitle}>Sign in to receive jobs, manage work, and track protected payouts.</Text>
            </View>

            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="name@domain.com"
              placeholderTextColor={Colors.textSubtle}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!isLoading && !isGoogleLoading}
            />

            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.passwordField}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="Enter your password"
                placeholderTextColor={Colors.textSubtle}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                editable={!isLoading && !isGoogleLoading}
              />
              <TouchableOpacity
                style={styles.passwordToggle}
                activeOpacity={0.75}
                onPress={() => setShowPassword((value) => !value)}
                disabled={isLoading || isGoogleLoading}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOffIcon size={20} color={Colors.textMuted} strokeWidth={2.2} />
                ) : (
                  <EyeIcon size={20} color={Colors.textMuted} strokeWidth={2.2} />
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.loginButton}
              activeOpacity={0.86}
              onPress={handleLogin}
              disabled={isLoading || isGoogleLoading}
            >
              {isLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={Colors.background} />
                  <Text style={styles.loginButtonText}>Signing In</Text>
                </View>
              ) : (
                <Text style={styles.loginButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <View style={styles.socialDivider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={[styles.googleButton, (isLoading || isGoogleLoading || !isGoogleConfigured) && styles.googleButtonDisabled]}
              activeOpacity={0.86}
              onPress={handleGoogleSignIn}
              disabled={isLoading || isGoogleLoading || !isGoogleConfigured}
            >
              {isGoogleLoading ? (
                <ActivityIndicator color={Colors.background} />
              ) : (
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.registerLink} onPress={onRegisterPress} disabled={isLoading || isGoogleLoading}>
            <View style={styles.registerBrandRow}>
              <Text style={styles.registerPromptText}>New provider? </Text>
              <Text style={styles.registerText}>Apply to join </Text>
              <View
                style={styles.registerWordmark}
                accessible
                accessibilityRole="text"
                accessibilityLabel={BRAND.displayName}
              >
                <Text style={styles.registerLogoText}>Pad</Text>
                <View style={styles.registerLetterI} accessible={false}>
                  <View style={styles.registerDot} />
                  <View style={styles.registerStem} />
                </View>
                <Text style={styles.registerProText}> Pro</Text>
              </View>
            </View>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 32,
    justifyContent: 'center',
    gap: 20,
  },
  heroHeader: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 10,
  },
  logoImage: {
    width: 180,
    height: 86,
    marginBottom: 8,
  },
  subtitleText: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 10,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 300,
  },
  signalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
  },
  signalPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#B8FF3D10',
    borderWidth: 1,
    borderColor: '#B8FF3D26',
  },
  signalText: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '900',
  },
  formCard: {
    padding: 20,
    borderRadius: 18,
    backgroundColor: 'rgba(20, 20, 23, 0.86)',
    borderWidth: 1,
    borderColor: 'rgba(247, 247, 245, 0.1)',
  },
  formHeader: {
    marginBottom: 18,
  },
  formTitle: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  formSubtitle: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  inputLabel: { 
    color: Colors.text,
    fontSize: 13, 
    fontWeight: '600', 
    marginBottom: 8 
  },
  input: { 
    backgroundColor: '#1C1C20',
    color: Colors.text,
    padding: 16, 
    borderRadius: 12, 
    fontSize: 16, 
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border
  },
  passwordField: {
    position: 'relative',
    marginBottom: 14,
  },
  passwordInput: {
    marginBottom: 0,
    paddingRight: 52,
  },
  passwordToggle: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButton: { 
    backgroundColor: Colors.primary,
    padding: 16, 
    borderRadius: 16, 
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loginButtonText: { 
    color: Colors.background,
    fontSize: 16, 
    fontWeight: '700' 
  },
  socialDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    color: Colors.textSubtle,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  googleButton: {
    backgroundColor: Colors.text,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  googleButtonDisabled: {
    opacity: 0.5,
  },
  googleButtonText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: '700',
  },
  registerLink: { alignItems: 'center', paddingVertical: 12 },
  registerBrandRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  registerPromptText: { color: Colors.textMuted, fontSize: 13, fontWeight: '700' },
  registerText: { color: Colors.amber, fontSize: 13, fontWeight: '800' },
  registerWordmark: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  registerLogoText: { color: Colors.text, fontSize: 13, fontWeight: '900' },
  registerLetterI: {
    width: 6,
    height: 14,
    marginLeft: 1,
    marginBottom: 3,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  registerDot: {
    width: 3,
    height: 3,
    borderRadius: 999,
    backgroundColor: Colors.primary,
    marginBottom: 2,
  },
  registerStem: {
    width: 2.5,
    height: 7,
    borderRadius: 999,
    backgroundColor: Colors.text,
  },
  registerProText: { color: Colors.text, fontSize: 13, fontWeight: '900' }
});
