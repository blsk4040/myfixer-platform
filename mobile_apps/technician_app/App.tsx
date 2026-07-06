// C:\myfixer-platform\mobile_apps\technician_app\App.tsx
import React, { useEffect, useState } from 'react';
import { Platform, SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { SocketProvider } from './src/context/SocketContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { LoginScreen } from './src/screens/auth/LoginScreen';
import { RegisterScreen } from './src/screens/auth/RegisterScreen';
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
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const technicianIdentity = getTechnicianIdentity(authSession);

  useEffect(() => {
    async function configureAndroidChannels() {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('job-alerts', {
          name: 'Job Alerts',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#00FF87',
          sound: 'default',
        });
      }
    }

    configureAndroidChannels();
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
              />
            ) : (
              <RegisterScreen
                onBackToLogin={() => setAuthMode('login')}
                onRegistrationApproved={(session) => {
                  setAuthSession(session);
                  setIsAuthenticated(true);
                }}
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
