import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MailCheck } from 'lucide-react-native';

import authService from '../../services/auth.service';
import apiService from '../../services/api.service';

export function VerifyEmailNoticeScreen({ route, navigation }: any): React.JSX.Element {
  const [isChecking, setIsChecking] = useState(false);
  const [email, setEmail] = useState(authService.getSession()?.user.email || 'your email address');

  const handleSignOut = () => {
    authService.clearSession();
    navigation.replace('Login');
  };

  const handleCheckVerification = useCallback(async (silent = false) => {
    const currentSession = authService.getSession() ?? await authService.restoreSession();

    if (!currentSession?.token) {
      navigation.replace('Login');
      return;
    }

    setEmail(currentSession.user.email || 'your email address');
    setIsChecking(true);
    try {
      const result = await apiService.getMyProfile();
      const updatedUser = {
        ...currentSession.user,
        ...result.profile,
      };

      await authService.persistSession({
        ...currentSession,
        status: updatedUser.isEmailVerified ? 'success' : 'email_verification_required',
        user: updatedUser,
      });

      if (updatedUser.isEmailVerified) {
        navigation.replace('MainTabs');
        return;
      }

      if (!silent) {
        Alert.alert('Still Not Verified', 'Please open the verification link in your email, then try again.');
      }
    } catch (error: any) {
      if (!silent) {
        Alert.alert('Verification Check Failed', error.message || 'Unable to refresh your account right now.');
      }
    } finally {
      setIsChecking(false);
    }
  }, [navigation]);

  useEffect(() => {
    if (route?.params?.autoCheck) {
      handleCheckVerification(true);
    }
  }, [handleCheckVerification, route?.params?.autoCheck]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <MailCheck color="#00FF87" size={34} />
        </View>
        <Text style={styles.title}>Verify your email</Text>
        <Text style={styles.body}>
          We sent a verification link to {email}. You can look around, but booking is blocked until your email is verified.
        </Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => handleCheckVerification(false)} disabled={isChecking}>
          {isChecking ? (
            <ActivityIndicator color="#090D14" />
          ) : (
            <Text style={styles.primaryButtonText}>I've verified my email</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.laterButton} onPress={() => navigation.replace('MainTabs')} disabled={isChecking}>
          <Text style={styles.laterButtonText}>I'll verify later</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleSignOut}>
          <Text style={styles.secondaryButtonText}>Use another account</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090D14' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  iconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#111827', borderWidth: 1, borderColor: '#1E293B', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', textAlign: 'center' },
  body: { color: '#94A3B8', fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 10, marginBottom: 28 },
  primaryButton: { width: '100%', height: 52, borderRadius: 12, backgroundColor: '#00FF87', alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#090D14', fontSize: 15, fontWeight: '900' },
  laterButton: { padding: 16, marginTop: 8 },
  laterButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  secondaryButton: { padding: 16, marginTop: 8 },
  secondaryButtonText: { color: '#94A3B8', fontSize: 14, fontWeight: '700' },
});
