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
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import apiService from '../../services/api.service';
import authService, { AuthSession } from '../../services/auth.service';

interface LoginScreenProps {
  onLoginSuccess: (session: AuthSession) => void;
  onRegisterPress: () => void;
  onVerificationRequired: (details: { email?: string }) => void;
}

export function LoginScreen({ onLoginSuccess, onRegisterPress, onVerificationRequired }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const isGoogleConfigured = !!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      offlineAccess: false,
    });
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing Fields', 'Please enter your technician email and password.');
      return;
    }

    try {
      setIsLoading(true);
      const session = await apiService.login(email, password);
      const role = session.user.role.toUpperCase();

      if (role !== 'TECHNICIAN' && role !== 'ADMIN') {
        throw new Error('This account is not registered as a technician.');
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
    if (!isGoogleConfigured) {
      Alert.alert('Configuration Unavailable', 'Google Web Client ID is missing.');
      return;
    }

    setIsGoogleLoading(true);

    try {
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });

      await GoogleSignin.signOut();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken;

      if (!idToken) {
        throw new Error('Google did not return an ID token.');
      }

      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      await auth().signInWithCredential(googleCredential);

      const result = await apiService.signInWithGoogle(idToken);

      if (result.status === 'profile_required') {
        Alert.alert(
          'Technician application required',
          'This Google account is not registered as an approved technician yet. Please submit a technician application.',
          [{ text: 'Apply Now', onPress: onRegisterPress }]
        );
        return;
      }

      if (result.status === 'email_verification_required') {
        onVerificationRequired({ email: result.user?.email });
        return;
      }

      if (!result.token || !result.user) {
        throw new Error(result.message || 'Google session exchange was missing session details.');
      }

      const role = result.user.role.toUpperCase();

      if (role !== 'TECHNICIAN' && role !== 'ADMIN') {
        throw new Error('This Google account is not registered as a technician.');
      }

      const session = { token: result.token, user: result.user, technician: result.technician };
      authService.setSession(session);
      onLoginSuccess(session);
    } catch (error: any) {
      if (error?.code === 'SIGN_IN_CANCELLED' || error?.code === '12501') {
        return;
      }

      Alert.alert('Google Sign-In Failed', error.message || 'Unable to complete Google sign-in.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.innerContainer}
      >
        
        {/* 1. Brand Logo & Header Segment */}
        <View style={styles.headerContainer}>
          <Image 
            source={{ uri: 'https://res.cloudinary.com/dz7dr3wku/image/upload/v1782316410/favicon-96x96_ymy1mu.png' }} 
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.logoText}>MyFixer<Text style={styles.accentText}> Pro</Text></Text>
          <Text style={styles.subtitleText}>Service Provider</Text>
        </View>

        {/* 2. Authentication Input Matrix */}
        <View style={styles.formContainer}>
          <Text style={styles.inputLabel}>Email Address</Text>
          <TextInput 
            style={styles.input}
            placeholder="Enter your email"
            placeholderTextColor="#64748B" // Slate gray placeholder
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!isLoading && !isGoogleLoading}
          />

          <Text style={styles.inputLabel}>Password</Text>
          <TextInput 
            style={styles.input}
            placeholder="Enter your password"
            placeholderTextColor="#64748B"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            editable={!isLoading && !isGoogleLoading}
          />
        </View>

        {/* 3. Operational Sign In Button Trigger */}
        <TouchableOpacity 
          style={styles.loginButton} 
          activeOpacity={0.8} 
          onPress={handleLogin}
          disabled={isLoading || isGoogleLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#090D14" />
          ) : (
            <Text style={styles.loginButtonText}>Sign In</Text>
          )}
        </TouchableOpacity>

        <View style={styles.socialDivider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* 4. Native Google Provider Auth Matrix */}
        <TouchableOpacity
          style={[styles.googleButton, (isLoading || isGoogleLoading || !isGoogleConfigured) && styles.googleButtonDisabled]}
          activeOpacity={0.8}
          onPress={handleGoogleSignIn}
          disabled={isLoading || isGoogleLoading || !isGoogleConfigured}
        >
          {isGoogleLoading ? (
            <ActivityIndicator color="#090D14" />
          ) : (
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.registerLink} onPress={onRegisterPress} disabled={isLoading || isGoogleLoading}>
          <Text style={styles.registerText}>New provider? Apply to join MyFixer Pro</Text>
        </TouchableOpacity>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#090D14' // Synchronized Matte Black Theme
  },
  innerContainer: { 
    flex: 1, 
    padding: 24, 
    justifyContent: 'center' 
  },
  headerContainer: { 
    alignItems: 'center', 
    marginBottom: 40 
  },
  logoImage: {
    width: 100,
    height: 100,
    marginBottom: 16,
  },
  logoText: { 
    fontSize: 32, 
    fontWeight: '700', 
    color: '#FFFFFF' 
  },
  accentText: { 
    color: '#00FF87' // Electric MyFixer Accent Green
  }, 
  subtitleText: { 
    fontSize: 14, 
    color: '#64748B', 
    marginTop: 6,
    fontWeight: '500'
  },
  formContainer: { 
    marginBottom: 24 
  },
  inputLabel: { 
    color: '#FFFFFF', 
    fontSize: 13, 
    fontWeight: '600', 
    marginBottom: 8 
  },
  input: { 
    backgroundColor: '#111827', // Deep slate container background fill
    color: '#FFFFFF', 
    padding: 16, 
    borderRadius: 12, 
    fontSize: 16, 
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1E293B' // Clean structural borders
  },
  loginButton: { 
    backgroundColor: '#00FF87', // Electric Accent Green
    padding: 16, 
    borderRadius: 12, 
    alignItems: 'center',
    shadowColor: '#00FF87',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5
  },
  loginButtonText: { 
    color: '#090D14', // High-contrast text core execution 
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
    backgroundColor: '#1E293B',
  },
  dividerText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  googleButtonDisabled: {
    opacity: 0.5,
  },
  googleButtonText: {
    color: '#090D14',
    fontSize: 16,
    fontWeight: '700',
  },
  registerLink: { alignItems: 'center', paddingVertical: 18 },
  registerText: { color: '#94A3B8', fontSize: 13, fontWeight: '700' }
});
