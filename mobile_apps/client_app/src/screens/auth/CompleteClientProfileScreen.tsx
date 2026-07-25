import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import apiService from '../../services/api.service';
import authService from '../../services/auth.service';

export function CompleteClientProfileScreen({ route, navigation }: any): React.JSX.Element {
  const idToken = route?.params?.idToken || '';
  const googleProfile = route?.params?.googleProfile || {};
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [consent, setConsent] = useState(false);
  const [activeMarketCodes, setActiveMarketCodes] = useState<string[]>([]);
  const [form, setForm] = useState({
    name: googleProfile.name || '',
    phone: '',
    countryCode: 'ZA',
    city: '',
    area: '',
    streetAddress: '',
    postalCode: '',
    fullAddress: '',
  });

  const serviceAddress = useMemo(() => {
    return form.fullAddress.trim() || [form.streetAddress, form.area, form.city, form.postalCode].filter(Boolean).join(', ');
  }, [form]);

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  useEffect(() => {
    let isCurrent = true;
    apiService.getPublicMarkets()
      .then((result) => {
        if (!isCurrent) return;
        const marketCodes = (result.markets || []).map((market) => market.countryCode).filter(Boolean);
        setActiveMarketCodes(marketCodes);
        if (marketCodes.length && !marketCodes.includes(form.countryCode.trim().toUpperCase())) {
          updateField('countryCode', marketCodes[0]);
        }
      })
      .catch(() => setActiveMarketCodes([]));
    return () => {
      isCurrent = false;
    };
  }, []);

  const handleSubmit = async () => {
    if (!idToken) {
      Alert.alert('Google sign-in expired', 'Please sign in with Google again.');
      navigation.replace('Login');
      return;
    }

    if (!form.name.trim() || !form.phone.trim() || !form.countryCode.trim() || !form.city.trim() || !form.area.trim() || !serviceAddress.trim() || !consent) {
      Alert.alert('Profile incomplete', 'Please complete all required fields and accept the consent.');
      return;
    }

    if (!activeMarketCodes.includes(form.countryCode.trim().toUpperCase())) {
      Alert.alert('Market Unavailable', 'Client registration is not available in this market right now.');
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await apiService.completeGoogleProfile({
        idToken,
        name: form.name.trim(),
        phone: form.phone.trim(),
        countryCode: form.countryCode.trim().toUpperCase(),
        city: form.city.trim(),
        area: form.area.trim(),
        consent,
        defaultServiceAddress: {
          streetAddress: form.streetAddress.trim() || serviceAddress.trim(),
          suburb: form.area.trim(),
          city: form.city.trim(),
          postalCode: form.postalCode.trim(),
          countryCode: form.countryCode.trim().toUpperCase(),
          fullAddress: serviceAddress.trim(),
        },
      });

      if (!result.token || !result.user) {
        throw new Error(result.message || 'We could not finish your profile right now. Please try again.');
      }

      await authService.persistSession({ token: result.token, user: result.user });
      if (result.status === 'email_verification_required' || result.user.isEmailVerified === false) {
        navigation.replace('VerifyEmailNotice');
        return;
      }

      navigation.replace('MainTabs');
    } catch (error: any) {
      Alert.alert('Profile Error', error.message || 'Unable to complete your profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Complete Your Profile</Text>
          <Text style={styles.subtitle}>We need a few details before you can book a service.</Text>

          <Text style={styles.label}>Full Name</Text>
          <TextInput style={styles.input} value={form.name} onChangeText={(value) => updateField('name', value)} placeholder="Full name" placeholderTextColor="#64748B" />

          <Text style={styles.label}>Mobile Number</Text>
          <TextInput style={styles.input} value={form.phone} onChangeText={(value) => updateField('phone', value)} keyboardType="phone-pad" placeholder="+27 82 123 4567" placeholderTextColor="#64748B" />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Country</Text>
              <TextInput style={styles.input} value={form.countryCode} onChangeText={(value) => updateField('countryCode', value)} autoCapitalize="characters" placeholder="ZA" placeholderTextColor="#64748B" />
            </View>
            <View style={{ flex: 2 }}>
              <Text style={styles.label}>City</Text>
              <TextInput style={styles.input} value={form.city} onChangeText={(value) => updateField('city', value)} placeholder="Johannesburg" placeholderTextColor="#64748B" />
            </View>
          </View>

          <Text style={styles.label}>Area / Suburb</Text>
          <TextInput style={styles.input} value={form.area} onChangeText={(value) => updateField('area', value)} placeholder="Bryanston" placeholderTextColor="#64748B" />

          <Text style={styles.label}>Default Service Address</Text>
          <TextInput style={styles.input} value={form.streetAddress} onChangeText={(value) => updateField('streetAddress', value)} placeholder="Street address" placeholderTextColor="#64748B" />
          <TextInput style={[styles.input, { marginTop: 10 }]} value={form.fullAddress} onChangeText={(value) => updateField('fullAddress', value)} placeholder="Full address if different" placeholderTextColor="#64748B" />

          <Text style={styles.label}>Postal Code Optional</Text>
          <TextInput style={styles.input} value={form.postalCode} onChangeText={(value) => updateField('postalCode', value)} keyboardType="number-pad" placeholder="2191" placeholderTextColor="#64748B" />

          <View style={styles.consentRow}>
            <Text style={styles.consentText}>I agree that Padi may use these details to create my customer profile and match service providers.</Text>
            <Switch value={consent} onValueChange={setConsent} thumbColor={consent ? '#00FF87' : '#64748B'} />
          </View>

          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? <ActivityIndicator color="#090D14" /> : <Text style={styles.submitText}>Complete Profile</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090D14' },
  scrollContainer: { padding: 24, paddingBottom: 40 },
  title: { color: '#FFFFFF', fontSize: 26, fontWeight: '900' },
  subtitle: { color: '#94A3B8', fontSize: 14, lineHeight: 20, marginTop: 6, marginBottom: 22 },
  label: { color: '#94A3B8', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: '#111827', borderWidth: 1, borderColor: '#1E293B', borderRadius: 12, color: '#FFFFFF', padding: 14, fontSize: 14 },
  row: { flexDirection: 'row', gap: 12 },
  consentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#111827', borderRadius: 12, borderWidth: 1, borderColor: '#1E293B', padding: 14, marginTop: 18 },
  consentText: { flex: 1, color: '#CBD5E1', fontSize: 12, lineHeight: 18 },
  submitButton: { backgroundColor: '#00FF87', borderRadius: 12, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  submitText: { color: '#090D14', fontSize: 15, fontWeight: '900' },
});
