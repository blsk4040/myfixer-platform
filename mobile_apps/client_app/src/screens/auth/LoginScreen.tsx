// mobile_apps/client_app/src/screens/auth/LoginScreen.tsx
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LockKeyhole, Mail, ShieldCheck } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, IconSizes, Radius, Shadows, Spacing, Typography } from '../../theme';

export function LoginScreen({ navigation }: any): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleLogin = async () => {
    const targetEmail = email ? email.trim() : '';
    const targetPassword = password ? password : '';

    if (!targetEmail || !targetPassword) {
      Alert.alert('Authentication Failed', 'Please populate all fields.');
      return;
    }

    setIsLoading(true);
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.3.34:5000/api/v1';
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetEmail.toLowerCase(),
          password: targetPassword,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Invalid username or credentials.');
      }

      navigation?.replace('MainTabs');
    } catch (error: any) {
      Alert.alert('Access Denied', error.message || 'Network transport failure. Check host connection rules.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardAvoidingView}>
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.brandContainer}>
            <View style={styles.trustBadge} accessible accessibilityRole="text" accessibilityLabel="Secure MyFixer access">
              <ShieldCheck color={Colors.primary} size={IconSizes.sm} />
              <Text style={styles.trustBadgeText}>Secure client access</Text>
            </View>

            <Text style={styles.logoText}>
              MyFixer <Text style={styles.proAccent}>Pro</Text>
            </Text>
            <Text style={styles.tagline}>On-demand verified field specialists</Text>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <View style={styles.inputShell}>
                <Mail color={Colors.textSubtle} size={IconSizes.md} />
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
                  onChange={(event) => setEmail(event.nativeEvent.text)}
                  editable={!isLoading}
                  accessibilityLabel="Email address"
                  returnKeyType="next"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Secure Password</Text>
              <View style={styles.inputShell}>
                <LockKeyhole color={Colors.textSubtle} size={IconSizes.md} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor={Colors.textSubtle}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="password"
                  textContentType="password"
                  value={password}
                  onChangeText={setPassword}
                  onChange={(event) => setPassword(event.nativeEvent.text)}
                  editable={!isLoading}
                  accessibilityLabel="Password"
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.forgotBtn}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('ForgotPassword')}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="Forgot password"
            >
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.loginBtn, isLoading && styles.loginBtnDisabled]}
              activeOpacity={0.86}
              onPress={handleLogin}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel={isLoading ? 'Signing in' : 'Secure sign in'}
            >
              {isLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={Colors.background} />
                  <Text style={styles.loginBtnText}>Signing In</Text>
                </View>
              ) : (
                <Text style={styles.loginBtnText}>Secure Sign In</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>New to the platform? </Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Register')}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="Create account"
            >
              <Text style={styles.registerText}>Create Account</Text>
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
    paddingVertical: Spacing.xxxl,
    justifyContent: 'center',
  },
  brandContainer: { alignItems: 'center', marginBottom: Spacing.huge },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    marginBottom: Spacing.lg,
  },
  trustBadgeText: {
    color: Colors.textMuted,
    fontSize: Typography.caption.fontSize,
    fontWeight: Typography.caption.fontWeight,
  },
  logoText: {
    color: Colors.white,
    fontSize: Typography.hero.fontSize,
    fontWeight: Typography.hero.fontWeight,
  },
  proAccent: { color: Colors.primary },
  tagline: {
    color: Colors.textSubtle,
    fontSize: Typography.label.fontSize,
    marginTop: Spacing.xs,
    fontWeight: '600',
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    backgroundColor: Colors.card,
    ...Shadows.card,
  },
  inputGroup: { width: '100%', marginBottom: Spacing.lg },
  inputLabel: {
    color: Colors.text,
    fontSize: Typography.label.fontSize,
    fontWeight: Typography.label.fontWeight,
    marginBottom: Spacing.sm,
  },
  inputShell: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  input: {
    flex: 1,
    color: Colors.white,
    fontSize: Typography.body.fontSize,
    fontWeight: Typography.body.fontWeight,
    paddingVertical: Platform.OS === 'ios' ? Spacing.lg : Spacing.md,
  },
  forgotBtn: { alignSelf: 'flex-end', paddingVertical: Spacing.sm },
  forgotText: { color: Colors.textMuted, fontSize: Typography.label.fontSize, fontWeight: '600' },
  loginBtn: {
    minHeight: 54,
    backgroundColor: Colors.primary,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xl,
  },
  loginBtnDisabled: { backgroundColor: Colors.primaryPressed },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  loginBtnText: { color: Colors.background, fontSize: Typography.body.fontSize, fontWeight: '800' },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.xxxl,
    flexWrap: 'wrap',
  },
  footerText: { color: Colors.textSubtle, fontSize: Typography.label.fontSize },
  registerText: { color: Colors.primary, fontSize: Typography.label.fontSize, fontWeight: '700' },
});
