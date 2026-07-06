// mobile_apps/client_app/src/screens/auth/RegisterScreen.tsx
import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { assertConfiguredUrl, getApiBaseUrl } from '../../config/runtime.config';

const MARKET_OPTIONS = [
  { countryCode: 'ZA', country: 'South Africa', currency: 'ZAR' },
  { countryCode: 'GH', country: 'Ghana', currency: 'GHS' },
  { countryCode: 'NG', country: 'Nigeria', currency: 'NGN' },
  { countryCode: 'KE', country: 'Kenya', currency: 'KES' },
];

export function RegisterScreen({ navigation }: any): React.JSX.Element {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    country: 'South Africa',
    countryCode: 'ZA',
    city: '',
    area: '',
    password: '',
    confirmPassword: '',
  });

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validateStepOne = () => {
    const { fullName, email, phone } = formData;
    if (!fullName.trim() || !email.trim() || !phone.trim()) {
      Alert.alert('Missing Fields', 'Please complete all profile details to continue.');
      return false;
    }
    if (!email.includes('@')) {
      Alert.alert('Invalid Email', 'Please provide a valid email address.');
      return false;
    }
    return true;
  };

  const validateStepTwo = () => {
    if (!formData.city.trim()) {
      Alert.alert('Location Required', 'Please specify your current city for service matching.');
      return false;
    }
    return true;
  };

  const handleFinalSubmit = async () => {
    const { password, confirmPassword } = formData;
    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const apiUrl = getApiBaseUrl();
      assertConfiguredUrl(apiUrl, 'EXPO_PUBLIC_API_BASE_URL');
      const response = await fetch(`${apiUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.fullName,
          email: formData.email.toLowerCase().trim(),
          phone: formData.phone.trim(),
          location: {
            country: formData.country,
            city: formData.city.trim(),
            area: formData.area.trim(),
          },
          countryCode: formData.countryCode,
          password: formData.password,
          role: 'CUSTOMER'
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Registration failed.');
      }

      Alert.alert('Success!', 'Your MyFixer client profile has been created.', [
        { text: 'Login Now', onPress: () => navigation.navigate('Login') }
      ]);
    } catch (error: any) {
      Alert.alert('Registration Error', error.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          
          <View style={styles.headerBlock}>
            <Text style={styles.titleText}>Create Client Profile</Text>
            <Text style={styles.subtitleText}>Step {currentStep} of 3</Text>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${(currentStep / 3) * 100}%` }]} />
            </View>
          </View>

          {currentStep === 1 && (
            <View style={styles.stepFormWrapper}>
              <Text style={styles.inputLabel}>FULL NAME</Text>
              <TextInput
                style={styles.inputField}
                placeholder="e.g. Sipho Sithole"
                placeholderTextColor="#475569"
                value={formData.fullName}
                onChangeText={(val) => updateField('fullName', val)}
              />

              <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
              <TextInput
                style={styles.inputField}
                placeholder="name@domain.com"
                placeholderTextColor="#475569"
                keyboardType="email-address"
                autoCapitalize="none"
                value={formData.email}
                onChangeText={(val) => updateField('email', val)}
              />

              <Text style={styles.inputLabel}>MOBILE NUMBER</Text>
              <TextInput
                style={styles.inputField}
                placeholder="e.g. +27 82 123 4567"
                placeholderTextColor="#475569"
                keyboardType="phone-pad"
                value={formData.phone}
                onChangeText={(val) => updateField('phone', val)}
              />

              <TouchableOpacity style={styles.primaryButton} onPress={() => validateStepOne() && setCurrentStep(2)}>
                <Text style={styles.primaryButtonText}>Continue to Region Details →</Text>
              </TouchableOpacity>
            </View>
          )}

          {currentStep === 2 && (
            <View style={styles.stepFormWrapper}>
              <Text style={styles.inputLabel}>COUNTRY</Text>
              <View style={styles.marketGrid}>
                {MARKET_OPTIONS.map((market) => {
                  const isSelected = formData.countryCode === market.countryCode;
                  return (
                    <TouchableOpacity
                      key={market.countryCode}
                      style={[styles.marketChip, isSelected && styles.marketChipActive]}
                      onPress={() => {
                        updateField('country', market.country);
                        updateField('countryCode', market.countryCode);
                      }}
                    >
                      <Text style={[styles.marketText, isSelected && styles.marketTextActive]}>
                        {market.country}
                      </Text>
                      <Text style={styles.marketCurrency}>{market.currency}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>CITY / AREA</Text>
              <TextInput
                style={styles.inputField}
                placeholder="e.g. Pretoria / Johannesburg"
                placeholderTextColor="#475569"
                value={formData.city}
                onChangeText={(val) => updateField('city', val)}
              />

              <Text style={styles.inputLabel}>AREA / NEIGHBOURHOOD OPTIONAL</Text>
              <TextInput
                style={styles.inputField}
                placeholder="e.g. East Legon, Osu, Bryanston"
                placeholderTextColor="#475569"
                value={formData.area}
                onChangeText={(val) => updateField('area', val)}
              />

              <View style={styles.navigationRow}>
                <TouchableOpacity style={styles.secondaryButton} onPress={() => setCurrentStep(1)}>
                  <Text style={styles.secondaryButtonText}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.primaryButton, { flex: 2, marginTop: 0 }]} onPress={() => validateStepTwo() && setCurrentStep(3)}>
                  <Text style={styles.primaryButtonText}>Security Verification</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {currentStep === 3 && (
            <View style={styles.stepFormWrapper}>
              <Text style={styles.inputLabel}>CHOOSE ACCESS PASSWORD</Text>
              <TextInput
                style={styles.inputField}
                placeholder="Minimum 6 characters"
                placeholderTextColor="#475569"
                secureTextEntry
                autoCapitalize="none"
                textContentType="newPassword"
                value={formData.password}
                onChangeText={(val) => updateField('password', val)}
                onChange={(e) => updateField('password', e.nativeEvent.text)} // ✅ FIX: Autofill Protection
              />

              <Text style={styles.inputLabel}>CONFIRM PASSWORD</Text>
              <TextInput
                style={styles.inputField}
                placeholder="Retype password securely"
                placeholderTextColor="#475569"
                secureTextEntry
                autoCapitalize="none"
                textContentType="newPassword"
                value={formData.confirmPassword}
                onChangeText={(val) => updateField('confirmPassword', val)}
                onChange={(e) => updateField('confirmPassword', e.nativeEvent.text)} // ✅ FIX: Autofill Protection
              />

              <View style={styles.navigationRow}>
                <TouchableOpacity style={styles.secondaryButton} disabled={isLoading} onPress={() => setCurrentStep(2)}>
                  <Text style={styles.secondaryButtonText}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.primaryButton, styles.submitButton, { flex: 2, marginTop: 0 }]} onPress={handleFinalSubmit} disabled={isLoading}>
                  {isLoading ? <ActivityIndicator color="#090D14" /> : <Text style={[styles.primaryButtonText, { color: '#090D14' }]}>Complete Profile ✓</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090D14' },
  scrollContainer: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  headerBlock: { marginBottom: 32 },
  titleText: { color: '#FFFFFF', fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  subtitleText: { color: '#64748B', fontSize: 13, marginTop: 6, fontWeight: '600', textTransform: 'uppercase' },
  progressBarBg: { height: 4, backgroundColor: '#1E293B', borderRadius: 2, marginTop: 12, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#00FF87' },
  stepFormWrapper: { gap: 16 },
  inputLabel: { color: '#64748B', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  inputField: { backgroundColor: '#111827', borderWidth: 1, borderColor: '#1E293B', borderRadius: 12, padding: 16, color: '#FFFFFF', fontSize: 15 },
  disabledInputField: { color: '#475569', backgroundColor: '#0f172a' },
  marketGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  marketChip: { width: '48%', backgroundColor: '#111827', borderWidth: 1, borderColor: '#1E293B', borderRadius: 12, padding: 12 },
  marketChipActive: { borderColor: '#00FF87', backgroundColor: '#00FF8710' },
  marketText: { color: '#E2E8F0', fontSize: 13, fontWeight: '700' },
  marketTextActive: { color: '#00FF87' },
  marketCurrency: { color: '#64748B', fontSize: 11, marginTop: 4, fontWeight: '700' },
  navigationRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 12 },
  primaryButton: { backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  submitButton: { backgroundColor: '#00FF87', borderColor: '#00FF87' },
  secondaryButton: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#1E293B' },
  secondaryButtonText: { color: '#64748B', fontSize: 14, fontWeight: '600' }
});
