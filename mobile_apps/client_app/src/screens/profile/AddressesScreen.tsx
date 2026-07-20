// src/screens/profile/AddressesScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import apiService from '../../services/api.service';
import authService from '../../services/auth.service';
import { Colors, Radius } from '../../theme';

export function AddressesScreen(): React.JSX.Element {
  const [streetAddress, setStreetAddress] = useState('');
  const [suburb, setSuburb] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiService.getMyProfile()
      .then((response) => {
        const address = response.profile.defaultServiceAddress;
        setStreetAddress(address?.streetAddress || '');
        setSuburb(address?.suburb || '');
        setCity(address?.city || response.profile.location?.city || '');
        setPostalCode(address?.postalCode || '');
        const coordinates = address?.coordinates?.coordinates;
        if (coordinates?.length === 2) {
          setLongitude(coordinates[0]);
          setLatitude(coordinates[1]);
        }
      })
      .catch((error: Error) => Alert.alert('Saved Address', error.message))
      .finally(() => setLoading(false));
  }, []);

  const useCurrentLocation = async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        Alert.alert('Location Permission', 'Location permission is required to attach GPS coordinates.');
        return;
      }

      const current = await Location.getCurrentPositionAsync({});
      setLatitude(current.coords.latitude);
      setLongitude(current.coords.longitude);
    } catch {
      Alert.alert('Location Error', 'Could not read your current GPS location.');
    }
  };

  const saveAddress = async () => {
    if (!streetAddress.trim() || !suburb.trim() || !city.trim() || !postalCode.trim()) {
      Alert.alert('Address Required', 'Please enter street address, suburb, city, and postal code.');
      return;
    }

    try {
      setSaving(true);
      const session = authService.getSession();
      const response = await apiService.updateDefaultAddress({
        streetAddress: streetAddress.trim(),
        suburb: suburb.trim(),
        city: city.trim(),
        postalCode: postalCode.trim(),
        countryCode: session?.user.countryCode,
        latitude,
        longitude,
      });
      if (session) {
        authService.setSession({
          ...session,
          user: {
            ...session.user,
            ...response.profile,
          },
        });
      }
      Alert.alert('Saved Address', 'Your default service address has been updated.');
    } catch (error: any) {
      Alert.alert('Saved Address', error.message || 'Could not save your address.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Default Service Address</Text>

        <View style={styles.formCard}>
          <Text style={styles.label}>Street Address</Text>
          <TextInput style={styles.input} value={streetAddress} onChangeText={setStreetAddress} placeholder="Street address" placeholderTextColor={Colors.textSubtle} />

          <Text style={styles.label}>Suburb</Text>
          <TextInput style={styles.input} value={suburb} onChangeText={setSuburb} placeholder="Suburb" placeholderTextColor={Colors.textSubtle} />

          <Text style={styles.label}>City</Text>
          <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="City" placeholderTextColor={Colors.textSubtle} />

          <Text style={styles.label}>Postal Code</Text>
          <TextInput style={styles.input} value={postalCode} onChangeText={setPostalCode} placeholder="Postal code" placeholderTextColor={Colors.textSubtle} />

          <View style={styles.gpsBox}>
            <Text style={styles.gpsText}>
              {typeof latitude === 'number' && typeof longitude === 'number'
                ? `GPS saved: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
                : 'No GPS coordinates saved yet.'}
            </Text>
            <TouchableOpacity onPress={useCurrentLocation}>
              <Text style={styles.gpsAction}>Use current GPS</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.8} onPress={saveAddress} disabled={saving}>
          {saving ? <ActivityIndicator color={Colors.background} /> : <Text style={styles.actionBtnText}>Save Default Address</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  scrollContainer: { padding: 20 },
  sectionTitle: { color: Colors.textSubtle, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 },
  formCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: 16 },
  label: { color: Colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: Colors.input, borderColor: Colors.border, borderWidth: 1, borderRadius: Radius.md, padding: 14, color: Colors.text, fontSize: 14 },
  gpsBox: { backgroundColor: Colors.input, borderColor: Colors.border, borderWidth: 1, borderRadius: Radius.md, padding: 12, marginTop: 16, gap: 8 },
  gpsText: { color: Colors.textMuted, fontSize: 12 },
  gpsAction: { color: Colors.primary, fontSize: 12, fontWeight: '700' },
  actionBtn: { padding: 16, borderRadius: Radius.md, alignItems: 'center', marginTop: 24, backgroundColor: Colors.primary },
  actionBtnText: { color: Colors.background, fontSize: 14, fontWeight: '800' },
});
