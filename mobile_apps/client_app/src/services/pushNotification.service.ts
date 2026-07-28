import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { assertConfiguredUrl, getApiBaseUrl, getExpoProjectId } from '../config/runtime.config';
import { isExpoGoRuntime } from '../config/runtimeEnvironment';

const API_BASE_URL = getApiBaseUrl();

type PushApp = 'client' | 'technician';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const configureAndroidChannel = async (): Promise<void> => {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('default', {
    name: 'Padi updates',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#B8FF3D',
    sound: 'default',
  });
};

export const registerDeviceForPushNotifications = async (
  app: PushApp,
  authHeader: Record<string, string>
): Promise<string | null> => {
  if (isExpoGoRuntime) return null;
  if (!authHeader.Authorization) return null;

  await configureAndroidChannel();

  const permissions = await Notifications.getPermissionsAsync();
  const finalPermissions = permissions.granted
    ? permissions
    : await Notifications.requestPermissionsAsync();

  if (!finalPermissions.granted) return null;

  const projectId = getExpoProjectId(Constants as Parameters<typeof getExpoProjectId>[0]);
  if (!projectId) {
    console.warn('Push notification registration skipped: EXPO_PUBLIC_EAS_PROJECT_ID is not configured.');
    return null;
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
  const token = tokenResponse.data;
  if (!token) return null;

  assertConfiguredUrl(API_BASE_URL, 'EXPO_PUBLIC_API_BASE_URL');

  await fetch(`${API_BASE_URL}/push-tokens`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...authHeader,
    },
    body: JSON.stringify({
      token,
      app,
      platform: Platform.OS,
    }),
  });

  return token;
};
