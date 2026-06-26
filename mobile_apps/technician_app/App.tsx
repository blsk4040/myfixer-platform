// C:\myfixer-platform\mobile_apps\technician_app\App.tsx
import React, { useState, useEffect } from 'react';
import { StatusBar, StyleSheet, SafeAreaView, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context'; 
import * as Notifications from 'expo-notifications';
import { SocketProvider } from './src/context/SocketContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { LoginScreen } from './src/screens/auth/LoginScreen';
import { useJobStore } from './src/store/useJobStore';

// Configure system notification interaction behavior models
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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const incomingCount = useJobStore((state) => state.incomingJobs.length);

  // Initialize native Android notification channels
  useEffect(() => {
    async function configureAndroidChannels() {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default Queue Channel',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#00FF87', // Electric MyFixer Accent Green
        });
      }
    }
    
    configureAndroidChannels();
  }, []);

  // Monitor incoming queue depth to alert the technician instantly
  useEffect(() => {
    if (isAuthenticated && incomingCount > 0) {
      Notifications.scheduleNotificationAsync({
        content: {
          title: "🚨 New Repair Request Available!",
          body: `There are currently ${incomingCount} premium work tickets unassigned near you. Open platform map rows.`,
          sound: true, // Plays default system audio file
        },
        // channelId goes inside the trigger object wrapper for local alerts
        trigger: Platform.OS === 'android' ? { channelId: 'default' } : null, 
      });
    }
  }, [incomingCount, isAuthenticated]);

  return (
    <SafeAreaProvider>
      <SocketProvider>
        <StatusBar barStyle="light-content" backgroundColor="#090D14" />
        
        {isAuthenticated ? (
          // 👈 Threading down the state setter to cleanly drive the log out redirect flow
          <AppNavigator setIsAuthenticated={setIsAuthenticated} /> 
        ) : (
          <SafeAreaView style={styles.container}>
            <LoginScreen onLoginSuccess={() => setIsAuthenticated(true)} />
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