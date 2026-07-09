import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { assertConfiguredUrl, getApiBaseUrl } from '../config/runtime.config';

const API_BASE_URL = getApiBaseUrl();

type PushApp = 'client' | 'technician';

const configureAndroidChannel = async (): Promise<void> => {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('default', {
    name: 'MyFixer updates',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#00FF87',
    sound: 'default',
  });
};

export const registerDeviceForPushNotifications = async (
  app: PushApp,
  authHeader: Record<string, string>
): Promise<string | null> => {
  if (!authHeader.Authorization) return null;

  await configureAndroidChannel();

  const permissions = await Notifications.getPermissionsAsync();
  const finalPermissions = permissions.granted
    ? permissions
    : await Notifications.requestPermissionsAsync();

  if (!finalPermissions.granted) return null;

  const tokenResponse = await Notifications.getExpoPushTokenAsync();
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
