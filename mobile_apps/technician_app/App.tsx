// C:\myfixer-platform\mobile_apps\technician_app\App.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Linking, Platform, StatusBar, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { SocketProvider } from './src/context/SocketContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { LoginScreen } from './src/screens/auth/LoginScreen';
import { RegisterScreen } from './src/screens/auth/RegisterScreen';
import { ApplicationStatusScreen } from './src/screens/auth/ApplicationStatusScreen';
import { AuthSession } from './src/services/auth.service';
import { getTechnicianIdentity } from './src/services/technicianIdentity.service';
import { BrandLoadingScreen } from './src/components/BrandLoadingScreen';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function App(): React.JSX.Element {
  const [showBrandLoading, setShowBrandLoading] = useState(true);
  const splashOpacity = useRef(new Animated.Value(1)).current;
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'status'>('login');
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [applicationStatus, setApplicationStatus] = useState<{
    email?: string;
    status: 'verify_email' | 'email_verified' | 'under_review';
    verificationEmailSent?: boolean;
  }>({ status: 'verify_email' });
  const technicianIdentity = getTechnicianIdentity(authSession);

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 520,
        useNativeDriver: true,
      }).start(() => setShowBrandLoading(false));
    }, 5000);
    return () => clearTimeout(timer);
  }, [splashOpacity]);

  useEffect(() => {
    async function configureAndroidChannels() {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('job-alerts', {
          name: 'Job Alerts',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#B8FF3D',
          sound: 'incoming_job.wav',
        });
      }
    }

    configureAndroidChannels();
  }, []);

  useEffect(() => {
    const handleUrl = (url: string | null) => {
      if (!url || !url.startsWith('myfixertechnician://email-verified')) return;
      setApplicationStatus((current) => ({
        ...current,
        status: 'email_verified',
        verificationEmailSent: true,
      }));
      setIsAuthenticated(false);
      setAuthMode('status');
    };

    Linking.getInitialURL().then(handleUrl).catch(() => undefined);
    const subscription = Linking.addEventListener('url', (event) => handleUrl(event.url));
    return () => subscription.remove();
  }, []);

  if (showBrandLoading) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor="#0B0B0D" />
        <Animated.View style={{ flex: 1, opacity: splashOpacity }}>
          <BrandLoadingScreen />
        </Animated.View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SocketProvider authToken={authSession?.token} technicianId={technicianIdentity.userId}>
        <StatusBar barStyle="light-content" backgroundColor="#0B0B0D" />

        {isAuthenticated ? (
          <AppNavigator
            setIsAuthenticated={(auth) => {
              setIsAuthenticated(auth);
              if (!auth) setAuthSession(null);
            }}
          />
        ) : (
          <SafeAreaView style={styles.container}>
            {authMode === 'login' ? (
              <LoginScreen
                onRegisterPress={() => setAuthMode('register')}
                onLoginSuccess={(session) => {
                  setAuthSession(session);
                  setIsAuthenticated(true);
                }}
                onVerificationRequired={({ email }) => {
                  setApplicationStatus({ email, status: 'verify_email', verificationEmailSent: true });
                  setAuthMode('status');
                }}
              />
            ) : authMode === 'register' ? (
              <RegisterScreen
                onBackToLogin={() => setAuthMode('login')}
                onRegistrationApproved={(session) => {
                  setAuthSession(session);
                  setIsAuthenticated(true);
                }}
                onApplicationSubmitted={(details) => {
                  setApplicationStatus({
                    email: details.email,
                    status: 'verify_email',
                    verificationEmailSent: details.verificationEmailSent,
                  });
                  setAuthMode('status');
                }}
              />
            ) : (
              <ApplicationStatusScreen
                email={applicationStatus.email}
                status={applicationStatus.status}
                verificationEmailSent={applicationStatus.verificationEmailSent}
                onBackToLogin={() => setAuthMode('login')}
              />
            )}
          </SafeAreaView>
        )}
      </SocketProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B0D',
  },
});
