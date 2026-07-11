import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'lucide-react-native';
import apiService from '../../services/api.service';
import authService, { AuthSession } from '../../services/auth.service';

const CameraIcon = Camera as any;

const toDataUri = (asset: ImagePicker.ImagePickerAsset): string | null => {
  if (!asset.base64) return null;
  return `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`;
};

const SERVICE_CATEGORIES = [
  { key: 'appliance_repair', label: 'Appliance Repair' },
  { key: 'automotive', label: 'Mechanic' },
  { key: 'cleaning', label: 'Cleaning' },
  { key: 'electrical', label: 'Electrical' },
  { key: 'plumbing', label: 'Plumbing' },
  { key: 'painting', label: 'Painting' },
  { key: 'gardening', label: 'Gardening' },
  { key: 'maintenance', label: 'Maintenance' },
];
const PROVIDER_MODULE_SERVICES = new Set(['managed_collection', 'rental_property']);

interface RegisterScreenProps {
  onBackToLogin: () => void;
  onRegistrationApproved: (session: AuthSession) => void;
  onApplicationSubmitted: (details: { email: string; verificationEmailSent?: boolean }) => void;
}

export function RegisterScreen({
  onBackToLogin,
  onRegistrationApproved,
  onApplicationSubmitted,
}: RegisterScreenProps): React.JSX.Element {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    countryCode: 'ZA',
    city: '',
    password: '',
    confirmPassword: '',
    businessName: '',
    idNumber: '',
    vehicleType: '',
    yearsExperience: '0',
    serviceRadiusKm: '25',
    bio: '',
  });
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['appliance_repair']);
  const [categoryOptions, setCategoryOptions] = useState(SERVICE_CATEGORIES);
  const [profilePhotoUri, setProfilePhotoUri] = useState('');
  const [profilePhotoDataUri, setProfilePhotoDataUri] = useState('');

  useEffect(() => {
    const countryCode = formData.countryCode.trim().toUpperCase();
    if (!countryCode) {
      setCategoryOptions(SERVICE_CATEGORIES);
      return;
    }

    let isCurrent = true;
    apiService.getMarketAvailability({ countryCode, city: formData.city.trim() })
      .then((result) => {
        if (!isCurrent) return;
        const activeServices = result.availability.services
          .filter((service) => service.canBook && !PROVIDER_MODULE_SERVICES.has(service.serviceKey))
          .map((service) => ({ key: service.serviceKey, label: service.label }));
        const nextOptions = activeServices;
        const allowedKeys = new Set(nextOptions.map((service) => service.key));
        setCategoryOptions(nextOptions);
        setSelectedCategories((current) => current.filter((serviceKey) => allowedKeys.has(serviceKey)));
      })
      .catch(() => setCategoryOptions(SERVICE_CATEGORIES));

    return () => {
      isCurrent = false;
    };
  }, [formData.countryCode, formData.city]);

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((item) => item !== category)
        : [...prev, category]
    );
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.email.trim() || !formData.phone.trim() || !formData.city.trim()) {
      Alert.alert('Missing Fields', 'Please complete your name, email, phone, and city.');
      return;
    }

    if (selectedCategories.length === 0) {
      Alert.alert('Service Required', 'Select at least one service category.');
      return;
    }

    if (!profilePhotoDataUri) {
      Alert.alert('Profile Photo Required', 'Please upload a clear headshot for admin review.');
      return;
    }

    if (formData.password.length < 6 || formData.password !== formData.confirmPassword) {
      Alert.alert('Password Error', 'Password must be at least 6 characters and match confirmation.');
      return;
    }

    try {
      setIsLoading(true);
      const response = await apiService.registerTechnician({
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        countryCode: formData.countryCode.trim().toUpperCase(),
        city: formData.city.trim(),
        password: formData.password,
        serviceCategories: selectedCategories,
        yearsExperience: Number(formData.yearsExperience) || 0,
        businessName: formData.businessName.trim(),
        idNumber: formData.idNumber.trim(),
        vehicleType: formData.vehicleType.trim(),
        serviceRadiusKm: Number(formData.serviceRadiusKm) || 25,
        bio: formData.bio.trim(),
        profilePhotoDataUri,
      });

      if (response.token && response.user?.isEmailVerified) {
        const session = { token: response.token, user: response.user, technician: response.technician };
        authService.setSession(session);
        onRegistrationApproved(session);
        return;
      }

      onApplicationSubmitted({
        email: formData.email.trim(),
        verificationEmailSent: response.verificationEmailSent,
      });
    } catch (error: any) {
      Alert.alert('Registration Failed', error.message || 'Unable to submit application.');
    } finally {
      setIsLoading(false);
    }
  };

  const pickProfilePhoto = async (source: 'camera' | 'library') => {
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permission Required', 'Please allow photo access so you can upload your profile headshot.');
      return;
    }

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.75, base64: true, allowsEditing: true, aspect: [1, 1] })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.75, base64: true, allowsEditing: true, aspect: [1, 1] });

    if (result.canceled || !result.assets?.[0]) return;

    const dataUri = toDataUri(result.assets[0]);
    if (!dataUri) {
      Alert.alert('Image Error', 'Could not prepare this photo for upload. Please try another image.');
      return;
    }

    setProfilePhotoUri(result.assets[0].uri);
    setProfilePhotoDataUri(dataUri);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Join MyFixer Pro</Text>
          <Text style={styles.subtitle}>Submit your service provider application for review.</Text>

          <Text style={styles.label}>Profile Photo</Text>
          <View style={styles.photoCard}>
            <View style={styles.photoPreview}>
              {profilePhotoUri ? (
                <Image source={{ uri: profilePhotoUri }} style={styles.photoImage} />
              ) : (
                <CameraIcon color="#64748B" size={32} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.photoTitle}>Clear headshot required</Text>
              <Text style={styles.photoHelp}>Admin must approve this image before you can go live or be shown to customers.</Text>
              <View style={styles.photoActions}>
                <TouchableOpacity style={styles.photoButton} onPress={() => pickProfilePhoto('camera')} disabled={isLoading}>
                  <Text style={styles.photoButtonText}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.photoButton} onPress={() => pickProfilePhoto('library')} disabled={isLoading}>
                  <Text style={styles.photoButtonText}>Gallery</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <Text style={styles.label}>Full Name</Text>
          <TextInput style={styles.input} value={formData.name} onChangeText={(value) => updateField('name', value)} placeholder="e.g. Thabo Mokoena" placeholderTextColor="#64748B" />

          <Text style={styles.label}>Email</Text>
          <TextInput style={styles.input} value={formData.email} onChangeText={(value) => updateField('email', value)} keyboardType="email-address" autoCapitalize="none" placeholder="name@domain.com" placeholderTextColor="#64748B" />

          <Text style={styles.label}>Mobile Number</Text>
          <TextInput style={styles.input} value={formData.phone} onChangeText={(value) => updateField('phone', value)} keyboardType="phone-pad" placeholder="+27 82 123 4567" placeholderTextColor="#64748B" />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Country Code</Text>
              <TextInput style={styles.input} value={formData.countryCode} onChangeText={(value) => updateField('countryCode', value)} autoCapitalize="characters" placeholder="ZA" placeholderTextColor="#64748B" />
            </View>
            <View style={{ flex: 2 }}>
              <Text style={styles.label}>City</Text>
              <TextInput style={styles.input} value={formData.city} onChangeText={(value) => updateField('city', value)} placeholder="Johannesburg" placeholderTextColor="#64748B" />
            </View>
          </View>

          <Text style={styles.label}>Service Categories</Text>
          <View style={styles.categoryGrid}>
            {categoryOptions.map((category) => {
              const isSelected = selectedCategories.includes(category.key);
              return (
                <TouchableOpacity
                  key={category.key}
                  style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                  onPress={() => toggleCategory(category.key)}
                >
                  <Text style={[styles.categoryText, isSelected && styles.categoryTextActive]}>{category.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {!categoryOptions.length && (
            <Text style={styles.helperText}>No active provider services are available for this country or city yet.</Text>
          )}

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Years Exp.</Text>
              <TextInput style={styles.input} value={formData.yearsExperience} onChangeText={(value) => updateField('yearsExperience', value)} keyboardType="numeric" placeholder="3" placeholderTextColor="#64748B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Radius KM</Text>
              <TextInput style={styles.input} value={formData.serviceRadiusKm} onChangeText={(value) => updateField('serviceRadiusKm', value)} keyboardType="numeric" placeholder="25" placeholderTextColor="#64748B" />
            </View>
          </View>

          <Text style={styles.label}>Business Name</Text>
          <TextInput style={styles.input} value={formData.businessName} onChangeText={(value) => updateField('businessName', value)} placeholder="Optional" placeholderTextColor="#64748B" />

          <Text style={styles.label}>ID / Registration Number</Text>
          <TextInput style={styles.input} value={formData.idNumber} onChangeText={(value) => updateField('idNumber', value)} placeholder="Used for admin verification" placeholderTextColor="#64748B" />

          <Text style={styles.label}>Vehicle / Transport</Text>
          <TextInput style={styles.input} value={formData.vehicleType} onChangeText={(value) => updateField('vehicleType', value)} placeholder="Bakkie, bike, car, none" placeholderTextColor="#64748B" />

          <Text style={styles.label}>Short Bio</Text>
          <TextInput style={[styles.input, styles.textArea]} value={formData.bio} onChangeText={(value) => updateField('bio', value)} multiline placeholder="Tell us about your trade experience." placeholderTextColor="#64748B" />

          <Text style={styles.label}>Password</Text>
          <TextInput style={styles.input} value={formData.password} onChangeText={(value) => updateField('password', value)} secureTextEntry placeholder="Minimum 6 characters" placeholderTextColor="#64748B" />

          <Text style={styles.label}>Confirm Password</Text>
          <TextInput style={styles.input} value={formData.confirmPassword} onChangeText={(value) => updateField('confirmPassword', value)} secureTextEntry placeholder="Retype password" placeholderTextColor="#64748B" />

          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="#090D14" /> : <Text style={styles.submitText}>Submit Application</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.loginLink} onPress={onBackToLogin} disabled={isLoading}>
            <Text style={styles.loginText}>Already registered? Sign in</Text>
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
  subtitle: { color: '#64748B', fontSize: 13, marginTop: 6, marginBottom: 24, lineHeight: 19 },
  label: { color: '#94A3B8', fontSize: 11, fontWeight: '800', marginBottom: 8, marginTop: 10, textTransform: 'uppercase' },
  input: { backgroundColor: '#111827', borderWidth: 1, borderColor: '#1E293B', borderRadius: 12, color: '#FFFFFF', padding: 14, fontSize: 14 },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  photoCard: { flexDirection: 'row', gap: 14, backgroundColor: '#111827', borderWidth: 1, borderColor: '#1E293B', borderRadius: 14, padding: 14, alignItems: 'center' },
  photoPreview: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#090D14', borderWidth: 1, borderColor: '#334155', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoImage: { width: '100%', height: '100%' },
  photoTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  photoHelp: { color: '#94A3B8', fontSize: 12, lineHeight: 17, marginTop: 4 },
  photoActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  photoButton: { backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  photoButtonText: { color: '#E2E8F0', fontSize: 12, fontWeight: '800' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: { borderWidth: 1, borderColor: '#1E293B', backgroundColor: '#111827', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  categoryChipActive: { backgroundColor: '#00FF8715', borderColor: '#00FF87' },
  categoryText: { color: '#64748B', fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  categoryTextActive: { color: '#00FF87' },
  helperText: { color: '#94A3B8', fontSize: 12, lineHeight: 18, marginTop: 8 },
  submitButton: { backgroundColor: '#00FF87', borderRadius: 12, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  submitText: { color: '#090D14', fontSize: 15, fontWeight: '900' },
  loginLink: { alignItems: 'center', paddingVertical: 18 },
  loginText: { color: '#94A3B8', fontSize: 13, fontWeight: '700' },
});
