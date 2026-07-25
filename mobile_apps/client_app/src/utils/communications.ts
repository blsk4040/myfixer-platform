// src/utils/communications.ts
import { Linking, Alert, Platform } from 'react-native';

/**
 * Invokes the system native phone application interface layer safely
 * @param phoneNumber Destination contact string (e.g., '+27821234567')
 */
export const initiateNativeCall = (phoneNumber: unknown): void => {
  if (typeof phoneNumber !== 'string' || !phoneNumber.trim()) {
    Alert.alert('Call unavailable', 'We do not have a phone number for this provider yet.');
    return;
  }

  // Clean numerical string to prevent formatting parsing breaks
  const sanitizedNumber = phoneNumber.replace(/\s+/g, '');
  const dialerUrl = Platform.OS === 'android' ? `tel:${sanitizedNumber}` : `telprompt:${sanitizedNumber}`;

  Linking.canOpenURL(dialerUrl)
    .then((supported) => {
      if (!supported) {
        Alert.alert('Call unavailable', 'This device cannot start a phone call from the app.');
      } else {
        return Linking.openURL(dialerUrl);
      }
    })
    .catch((err) => console.error('[Linking Error] Handshake failed:', err));
};
