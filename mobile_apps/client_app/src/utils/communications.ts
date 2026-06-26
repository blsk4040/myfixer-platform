// src/utils/communications.ts
import { Linking, Alert, Platform } from 'react-native';

/**
 * Invokes the system native phone application interface layer safely
 * @param phoneNumber Destination contact string (e.g., '+27821234567')
 */
export const initiateNativeCall = (phoneNumber: string): void => {
  if (!phoneNumber) {
    Alert.alert('Error', 'No valid communication number mapped for this specialist.');
    return;
  }

  // Clean numerical string to prevent formatting parsing breaks
  const sanitizedNumber = phoneNumber.replace(/\s+/g, '');
  const dialerUrl = Platform.OS === 'android' ? `tel:${sanitizedNumber}` : `telprompt:${sanitizedNumber}`;

  Linking.canOpenURL(dialerUrl)
    .then((supported) => {
      if (!supported) {
        Alert.alert('Device Restriction', 'Telephony framework operations are unavailable on this device environment.');
      } else {
        return Linking.openURL(dialerUrl);
      }
    })
    .catch((err) => console.error('[Linking Error] Handshake failed:', err));
};