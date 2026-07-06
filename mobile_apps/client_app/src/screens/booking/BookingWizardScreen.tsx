// mobile_apps/client_app/src/screens/booking/BookingWizardScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  ScrollView,
  Alert,
  Image,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useRoute, useNavigation } from '@react-navigation/native';
import { 
  Calendar as LucideCalendar, 
  Clock as LucideClock, 
  MapPin as LucideMapPin, 
  User as LucideUser, 
  MessageSquare as LucideMessageSquare, 
  Phone as LucidePhone 
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker'; 
import apiService, { Coordinate, CustomerProfile } from '../../services/api.service';
import socketService from '../../services/socket.service';
import authService from '../../services/auth.service';

// ✅ Clean type casting to fully resolve IntrinsicAttributes TypeScript errors
const Calendar = LucideCalendar as any;
const Clock = LucideClock as any;
const MapPin = LucideMapPin as any;
const User = LucideUser as any;
const MessageSquare = LucideMessageSquare as any;
const Phone = LucidePhone as any;

const DEFAULT_COORDINATE: Coordinate = { latitude: -26.2041, longitude: 28.0473 };

export default function BookingWizardScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const { category, serviceKey, subCategory, basePrice } = route.params || {
    category: 'appliance_repair',
    serviceKey: 'appliance_repair',
    subCategory: 'General Appliance Fix',
    basePrice: 350
  };

  const [notes, setNotes] = useState('');
  const [scheduleMode, setScheduleMode] = useState<'NOW' | 'LATER'>('NOW');
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [latitude, setLatitude] = useState(String(DEFAULT_COORDINATE.latitude));
  const [longitude, setLongitude] = useState(String(DEFAULT_COORDINATE.longitude));
  const [streetAddress, setStreetAddress] = useState('');
  const [suburb, setSuburb] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [useDifferentAddress, setUseDifferentAddress] = useState(false);
  const [saveAsDefaultAddress, setSaveAsDefaultAddress] = useState(false);
  
  const [isSearchingProvider, setIsSearchingProvider] = useState(false);
  const [assignedProvider, setAssignedProvider] = useState<any>(null);
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadProfileAndLocation = async () => {
      setIsLocating(true);
      try {
        const profileResponse = await apiService.getMyProfile();
        if (!isMounted) return;
        const nextProfile = profileResponse.profile;
        setProfile(nextProfile);
        const defaultAddress = nextProfile.defaultServiceAddress;
        if (defaultAddress?.streetAddress) {
          setStreetAddress(defaultAddress.streetAddress || '');
          setSuburb(defaultAddress.suburb || '');
          setCity(defaultAddress.city || '');
          setPostalCode(defaultAddress.postalCode || '');
          const coordinates = defaultAddress.coordinates?.coordinates;
          if (coordinates?.length === 2) {
            setLongitude(String(coordinates[0]));
            setLatitude(String(coordinates[1]));
            return;
          }
        }

        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== Location.PermissionStatus.GRANTED) return;
        const currentLoc = await Location.getCurrentPositionAsync({});
        if (isMounted) {
          setLatitude(String(currentLoc.coords.latitude));
          setLongitude(String(currentLoc.coords.longitude));
        }
      } catch {
        console.log("Fallback location coordinates generated.");
      } finally {
        if (isMounted) setIsLocating(false);
      }
    };
    loadProfileAndLocation();
    return () => { isMounted = false; };
  }, []);

  const onDateChange = (event: any, date?: Date) => {
    setShowDatePicker(Platform.OS === 'ios'); 
    if (date) {
      const updatedDate = new Date(selectedDate);
      updatedDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
      setSelectedDate(updatedDate);
    }
  };

  const onTimeChange = (event: any, time?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (time) {
      const updatedTime = new Date(selectedDate);
      updatedTime.setHours(time.getHours(), time.getMinutes());
      setSelectedDate(updatedTime);
    }
  };

  const handleBookingSubmit = async () => {
    try {
      if (!streetAddress.trim() || !suburb.trim() || !city.trim() || !postalCode.trim()) {
        Alert.alert('Address Required', 'Please enter your street address, suburb, city, and postal code.');
        return;
      }

      setIsSubmitting(true);
      setIsSearchingProvider(true);

      const customerCoordinate = { latitude: Number(latitude), longitude: Number(longitude) };
      const formattedTimestamp = scheduleMode === 'NOW' ? 'Urgent / Right Now' : selectedDate.toLocaleString();
      const readableAddress = [streetAddress, suburb, city, postalCode].filter(Boolean).join(', ');
      const session = authService.getSession();
      const currency = (session?.user.currency ?? 'ZAR') as any;

      const response = await apiService.createBooking({
        customerName: session?.user.name ?? 'Client',
        applianceType: `${subCategory} (${formattedTimestamp})`,
        faultDescription: notes.trim() || 'No description provided.',
        latitude: customerCoordinate.latitude,
        longitude: customerCoordinate.longitude,
        price: basePrice,
        countryCode: session?.user.countryCode,
        currency,
        fullAddress: readableAddress,
        streetAddress: streetAddress.trim(),
        suburb: suburb.trim(),
        postalCode: postalCode.trim(),
        generalArea: suburb.trim(),
        city: city.trim(),
        area: suburb.trim(),
        serviceKey: serviceKey || category,
        category,
        saveAsDefaultAddress: useDifferentAddress && saveAsDefaultAddress,
      });

      const socket = socketService.initializeConnection();
      socketService.joinBookingRoom(response.bookingId);
      setCreatedBookingId(response.bookingId);

      socket.once('booking_assigned', (payload: { bookingId?: string; technicianId?: string }) => {
        if (payload.bookingId !== response.bookingId) return;

        setAssignedProvider({
          name: payload.technicianId ? `Technician ${payload.technicianId}` : 'Assigned technician',
          rating: 'Verified',
          phone: '',
          image: 'https://images.unsplash.com/photo-1540569014015-19a7be504e3a?auto=format&fit=crop&w=200&q=80',
        });
        setIsSearchingProvider(false);
      });

    } catch (err: any) {
      Alert.alert('Booking Failure', err.message || 'System issues encountered.');
      setIsSearchingProvider(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUseDifferentAddress = () => {
    setUseDifferentAddress(true);
    setSaveAsDefaultAddress(false);
    setStreetAddress('');
    setSuburb('');
    setCity('');
    setPostalCode('');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollWrapper} keyboardShouldPersistTaps="handled">
          
          <View style={styles.header}>
            <Text style={styles.headerLabel}>SERVICE DISPATCH</Text>
            <Text style={styles.headerTitle}>{subCategory}</Text>
            <Text style={styles.headerSubtitle}>Est. Base Cost: <Text style={styles.greenText}>R{basePrice}</Text></Text>
          </View>

          {isSearchingProvider && (
            <View style={styles.matchingBox}>
              <ActivityIndicator size="large" color="#00FF87" />
              <Text style={styles.matchingText}>Broadcasting Request to Nearest Professionals...</Text>
            </View>
          )}

          {assignedProvider && (
            <View style={styles.providerCard}>
              <Text style={styles.providerHeader}>🎉 Match Found! Dispatching Now</Text>
              <View style={styles.providerMeta}>
                <Image source={{ uri: assignedProvider.image }} style={styles.providerAvatar} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.providerName}>{assignedProvider.name}</Text>
                  <Text style={styles.providerRating}>⭐ {assignedProvider.rating} Verified Specialist</Text>
                </View>
              </View>
              <View style={styles.providerActions}>
                <TouchableOpacity style={styles.actionIconBtn}><Phone color="#00FF87" size={18} /></TouchableOpacity>
                <TouchableOpacity style={styles.actionIconBtn}><MessageSquare color="#38BDF8" size={18} /></TouchableOpacity>
                <TouchableOpacity
                  style={styles.trackBtn}
                  onPress={() => navigation.navigate('TrackingMain', { bookingId: createdBookingId })}
                  disabled={!createdBookingId}
                >
                  <Text style={styles.trackBtnText}>Track On Map</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {!assignedProvider && !isSearchingProvider && (
            <View style={styles.formContainer}>
              
              <Text style={styles.sectionTitle}>Service Address</Text>
              {profile?.defaultServiceAddress?.fullAddress && !useDifferentAddress ? (
                <View style={styles.defaultAddressNotice}>
                  <Text style={styles.defaultAddressText}>Using saved address: {profile.defaultServiceAddress.fullAddress}</Text>
                  <TouchableOpacity onPress={handleUseDifferentAddress}>
                    <Text style={styles.defaultAddressAction}>Use different address</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              <TextInput
                style={styles.instructionInput}
                placeholder="Street address"
                placeholderTextColor="#475569"
                value={streetAddress}
                onChangeText={setStreetAddress}
              />
              <View style={styles.addressRow}>
                <TextInput
                  style={[styles.addressInput, { flex: 1 }]}
                  placeholder="Suburb"
                  placeholderTextColor="#475569"
                  value={suburb}
                  onChangeText={setSuburb}
                />
                <TextInput
                  style={[styles.addressInput, { flex: 1 }]}
                  placeholder="City"
                  placeholderTextColor="#475569"
                  value={city}
                  onChangeText={setCity}
                />
              </View>
              <TextInput
                style={styles.addressInput}
                placeholder="Postal code"
                placeholderTextColor="#475569"
                value={postalCode}
                onChangeText={setPostalCode}
              />
              {useDifferentAddress ? (
                <TouchableOpacity
                  style={styles.saveDefaultToggle}
                  onPress={() => setSaveAsDefaultAddress((current) => !current)}
                >
                  <Text style={styles.saveDefaultText}>
                    {saveAsDefaultAddress ? 'Save this as my default address' : 'Do not save as default'}
                  </Text>
                </TouchableOpacity>
              ) : null}

              <Text style={styles.sectionTitle}>Instruction Notes for Provider</Text>
              <TextInput
                style={styles.instructionInput}
                multiline
                numberOfLines={4}
                placeholder="Provide additional details here (e.g. Fridge is leaking water, gate code is #403)"
                placeholderTextColor="#475569"
                value={notes}
                onChangeText={setNotes}
              />

              <Text style={styles.sectionTitle}>When should we arrive?</Text>
              <View style={styles.timeToggleRow}>
                <TouchableOpacity style={[styles.toggleBtn, scheduleMode === 'NOW' && styles.toggleBtnActive]} onPress={() => setScheduleMode('NOW')}>
                  <Clock color={scheduleMode === 'NOW' ? '#090D14' : '#64748B'} size={18} />
                  <Text style={[styles.toggleText, scheduleMode === 'NOW' && styles.toggleTextActive]}>Dispatch Now</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.toggleBtn, scheduleMode === 'LATER' && styles.toggleBtnActive]} onPress={() => setScheduleMode('LATER')}>
                  <Calendar color={scheduleMode === 'LATER' ? '#090D14' : '#64748B'} size={18} />
                  <Text style={[styles.toggleText, scheduleMode === 'LATER' && styles.toggleTextActive]}>Schedule Later</Text>
                </TouchableOpacity>
              </View>

              {scheduleMode === 'LATER' && (
                <View style={styles.laterFormInputs}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.microLabel}>DATE</Text>
                    <TouchableOpacity style={styles.pickerSelectorBox} onPress={() => setShowDatePicker(true)}>
                      <Calendar color="#00FF87" size={16} />
                      <Text style={styles.pickerSelectorText}>{selectedDate.toLocaleDateString()}</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.microLabel}>ARRIVAL TIME</Text>
                    <TouchableOpacity style={styles.pickerSelectorBox} onPress={() => setShowTimePicker(true)}>
                      <Clock color="#00FF87" size={16} />
                      <Text style={styles.pickerSelectorText}>
                        {selectedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {showDatePicker && (
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  minimumDate={new Date()}
                  onChange={onDateChange}
                />
              )}

              {showTimePicker && (
                <DateTimePicker
                  value={selectedDate}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onTimeChange}
                />
              )}

              <View style={styles.locationSummaryBox}>
                <MapPin color="#64748B" size={16} />
                <Text style={styles.locationSummaryText}>
                  {isLocating ? 'Locating your address coordinates...' : `Lat: ${Number(latitude).toFixed(4)}, Lon: ${Number(longitude).toFixed(4)}`}
                </Text>
              </View>
            </View>
          )}

        </ScrollView>
        
        {!assignedProvider && !isSearchingProvider && (
          <View style={styles.footerSticky}>
            <TouchableOpacity style={styles.primaryActionButton} onPress={handleBookingSubmit} disabled={isSubmitting}>
              {isSubmitting ? <ActivityIndicator color="#090D14" /> : <Text style={styles.primaryActionText}>Confirm & Book Fixer</Text>}
            </TouchableOpacity>
          </View>
        )}

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#090D14' },
  scrollWrapper: { padding: 24, paddingBottom: 120 },
  header: { marginBottom: 28 },
  headerLabel: { color: '#64748B', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  headerTitle: { color: '#FFFFFF', fontSize: 26, fontWeight: '900', marginTop: 4 },
  headerSubtitle: { color: '#E2E8F0', fontSize: 14, marginTop: 4 },
  greenText: { color: '#00FF87', fontWeight: '700' },
  formContainer: { gap: 20 },
  sectionTitle: { color: '#94A3B8', fontSize: 13, fontWeight: '700' },
  instructionInput: { backgroundColor: '#111827', borderColor: '#1E293B', borderWidth: 1, borderRadius: 12, padding: 16, color: '#FFFFFF', fontSize: 14, minHeight: 90, textAlignVertical: 'top' },
  addressRow: { flexDirection: 'row', gap: 12 },
  addressInput: { backgroundColor: '#111827', borderColor: '#1E293B', borderWidth: 1, borderRadius: 12, padding: 14, color: '#FFFFFF', fontSize: 14 },
  defaultAddressNotice: { backgroundColor: '#111827', borderColor: '#1E293B', borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  defaultAddressText: { color: '#CBD5E1', fontSize: 12, lineHeight: 18 },
  defaultAddressAction: { color: '#00FF87', fontSize: 12, fontWeight: '700' },
  saveDefaultToggle: { backgroundColor: '#111827', borderColor: '#1E293B', borderWidth: 1, borderRadius: 12, padding: 12 },
  saveDefaultText: { color: '#00FF87', fontSize: 12, fontWeight: '700' },
  timeToggleRow: { flexDirection: 'row', gap: 12 },
  toggleBtn: { flex: 1, flexDirection: 'row', gap: 8, height: 48, backgroundColor: '#111827', borderWidth: 1, borderColor: '#1E293B', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  toggleBtnActive: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  toggleText: { color: '#64748B', fontSize: 13, fontWeight: '600' },
  toggleTextActive: { color: '#090D14', fontWeight: '700' },
  
  laterFormInputs: { flexDirection: 'row', gap: 12, backgroundColor: '#111827', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#1E293B' },
  microLabel: { color: '#64748B', fontSize: 9, fontWeight: '700', marginBottom: 6 },
  pickerSelectorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1E293B', height: 44, borderRadius: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: '#334155' },
  pickerSelectorText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },

  locationSummaryBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  locationSummaryText: { color: '#64748B', fontSize: 12 },
  footerSticky: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#090D14', padding: 20, borderTopWidth: 1, borderColor: '#1E293B' },
  primaryActionButton: { backgroundColor: '#00FF87', height: 54, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  primaryActionText: { color: '#090D14', fontSize: 15, fontWeight: '800' },
  matchingBox: { backgroundColor: '#111827', borderRadius: 16, borderColor: '#1E293B', borderWidth: 1, padding: 32, alignItems: 'center', gap: 16, marginTop: 20 },
  matchingText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', textAlign: 'center', lineHeight: 20 },
  providerCard: { backgroundColor: '#111827', borderRadius: 16, borderWidth: 1, borderColor: '#1E293B', padding: 20, marginTop: 10 },
  providerHeader: { color: '#00FF87', fontSize: 14, fontWeight: '700', marginBottom: 16 },
  providerMeta: { flexDirection: 'row', alignItems: 'center', gap: 16, borderBottomWidth: 1, borderColor: '#1E293B', paddingBottom: 16 },
  providerAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#1E293B' },
  providerName: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  providerRating: { color: '#64748B', fontSize: 12, marginTop: 4 },
  providerActions: { flexDirection: 'row', gap: 12, marginTop: 16, alignItems: 'center' },
  actionIconBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center' },
  trackBtn: { flex: 1, backgroundColor: '#FFFFFF', height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  trackBtnText: { color: '#090D14', fontSize: 13, fontWeight: '700' }
});
