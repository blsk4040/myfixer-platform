// C:\myfixer-platform\mobile_apps\technician_app\App.tsx
import React, { useEffect, useState } from 'react';
import { Linking, Platform, StatusBar, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { SocketProvider } from './src/context/SocketContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { LoginScreen } from './src/screens/auth/LoginScreen';
import { RegisterScreen } from './src/screens/auth/RegisterScreen';
import { ApplicationStatusScreen } from './src/screens/auth/ApplicationStatusScreen';
import { AuthSession } from './src/services/auth.service';
import { getTechnicianIdentity } from './src/services/technicianIdentity.service';

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
    async function configureAndroidChannels() {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('job-alerts', {
          name: 'Job Alerts',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#00FF87',
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

  return (
    <SafeAreaProvider>
      <SocketProvider authToken={authSession?.token} technicianId={technicianIdentity.userId}>
        <StatusBar barStyle="light-content" backgroundColor="#090D14" />

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
    backgroundColor: '#090D14',
  },
});
