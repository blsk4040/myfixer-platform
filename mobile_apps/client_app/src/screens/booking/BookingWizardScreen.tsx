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
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useRoute, useNavigation } from '@react-navigation/native';
import { 
  Calendar as LucideCalendar, 
  Clock as LucideClock, 
  MapPin as LucideMapPin, 
  CheckCircle2 as LucideCheckCircle
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker'; 
import apiService, { Coordinate, CustomerProfile } from '../../services/api.service';
import socketService from '../../services/socket.service';
import authService from '../../services/auth.service';
import LocationSelectionSheet, {
  LocationConfirmationPayload,
} from '../../components/LocationSelectionSheet';

// ✅ Clean type casting to fully resolve IntrinsicAttributes TypeScript errors
const Calendar = LucideCalendar as any;
const Clock = LucideClock as any;
const MapPin = LucideMapPin as any;
const CheckCircle = LucideCheckCircle as any;

const DEFAULT_COORDINATE: Coordinate = { latitude: -26.2041, longitude: 28.0473 };

const formatScheduledDate = (value: Date): string =>
  value.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export default function BookingWizardScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const { category, serviceKey, subCategory, basePrice, preferredTechnicianId, preferredTechnicianName, rebookFromBookingId } = route.params || {
    category: 'appliance_repair',
    serviceKey: 'appliance_repair',
    subCategory: 'General Appliance Fix',
    basePrice: 350
  };
  const isPreferredProviderRebook = Boolean(preferredTechnicianId && rebookFromBookingId);

  const [notes, setNotes] = useState('');
  const [promoCode, setPromoCode] = useState('');
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
  const [selectedLocation, setSelectedLocation] = useState<LocationConfirmationPayload | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [useDifferentAddress, setUseDifferentAddress] = useState(false);
  const [saveAsDefaultAddress, setSaveAsDefaultAddress] = useState(false);
  
  const [isSearchingProvider, setIsSearchingProvider] = useState(false);
  const [requestAccepted, setRequestAccepted] = useState(false);
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
          if (defaultAddress.fullAddress) {
            const coordinates = defaultAddress.coordinates?.coordinates;
            setSelectedLocation({
              fullAddress: defaultAddress.fullAddress,
              latitude: coordinates?.length === 2 ? coordinates[1] : DEFAULT_COORDINATE.latitude,
              longitude: coordinates?.length === 2 ? coordinates[0] : DEFAULT_COORDINATE.longitude,
              isForSomeoneElse: false,
              serviceRecipient: {
                type: 'SELF',
                fullName: nextProfile.name || 'Client',
                phoneNumber: nextProfile.phone || '',
                countryCode: nextProfile.countryCode,
                country: nextProfile.countryCode,
                city: defaultAddress.city,
                streetAddress: defaultAddress.streetAddress || defaultAddress.fullAddress,
              },
              city: defaultAddress.city,
              area: defaultAddress.suburb,
              postalCode: defaultAddress.postalCode,
            });
          }
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
      const session = authService.getSession();
      if (session?.user.role === 'CUSTOMER' && session.user.profileCompleted === false) {
        Alert.alert('Profile Required', 'Please complete your profile before booking a service.');
        return;
      }

      if (session?.user.role === 'CUSTOMER' && session.user.isEmailVerified === false) {
        Alert.alert('Verify Your Email', 'Please verify your email before booking a service.');
        navigation.navigate('VerifyEmailNotice');
        return;
      }

      if (!selectedLocation?.fullAddress || !Number.isFinite(selectedLocation.latitude) || !Number.isFinite(selectedLocation.longitude)) {
        Alert.alert('Address Required', 'Please choose and confirm a service address from Google Places.');
        return;
      }

      setIsSubmitting(true);
      setIsSearchingProvider(true);

      const customerCoordinate = {
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
      };
      if (scheduleMode === 'LATER' && selectedDate.getTime() <= Date.now() + 5 * 60 * 1000) {
        Alert.alert('Choose a later time', 'Please schedule at least 5 minutes from now.');
        setIsSearchingProvider(false);
        return;
      }

      const readableAddress = selectedLocation.fullAddress;
      const currency = (session?.user.currency ?? 'ZAR') as any;
      const faultDescription = notes.trim() || 'No description provided.';
      const scheduledEndTime = scheduleMode === 'LATER'
        ? new Date(selectedDate.getTime() + 60 * 60 * 1000)
        : null;

      const response = await apiService.createBooking({
        customerName: session?.user.name ?? 'Client',
        applianceType: subCategory,
        faultDescription,
        latitude: customerCoordinate.latitude,
        longitude: customerCoordinate.longitude,
        price: basePrice,
        countryCode: session?.user.countryCode,
        currency,
        fullAddress: readableAddress,
        streetAddress: streetAddress.trim() || readableAddress,
        suburb: selectedLocation.area || suburb.trim(),
        postalCode: selectedLocation.postalCode || postalCode.trim(),
        generalArea: selectedLocation.area || suburb.trim() || readableAddress,
        city: selectedLocation.city || city.trim() || profile?.location?.city,
        area: selectedLocation.area || suburb.trim() || profile?.location?.area,
        serviceKey: serviceKey || category,
        category,
        promoCode: promoCode.trim() || undefined,
        scheduledStartTime: scheduleMode === 'LATER' ? selectedDate.toISOString() : undefined,
        scheduledEndTime: scheduledEndTime ? scheduledEndTime.toISOString() : undefined,
        preferredTechnicianId,
        rebookFromBookingId,
        saveAsDefaultAddress: useDifferentAddress && saveAsDefaultAddress,
        isForSomeoneElse: selectedLocation.isForSomeoneElse,
        contactName: selectedLocation.contactName,
        contactPhone: selectedLocation.contactPhone,
        serviceRecipient: selectedLocation.serviceRecipient,
      });

      const socket = socketService.initializeConnection();
      socketService.joinBookingRoom(response.bookingId);
      setCreatedBookingId(response.bookingId);

      socket.once('booking_assigned', (payload: { bookingId?: string; technicianId?: string }) => {
        if (payload.bookingId !== response.bookingId) return;

        setRequestAccepted(true);
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
    setSelectedLocation(null);
  };

  const handleLocationConfirmed = (payload: LocationConfirmationPayload) => {
    setSelectedLocation(payload);
    setLatitude(String(payload.latitude));
    setLongitude(String(payload.longitude));
    setStreetAddress(payload.fullAddress);
    setSuburb(payload.area || '');
    setCity(payload.city || '');
    setPostalCode(payload.postalCode || '');
    setUseDifferentAddress(true);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollWrapper} keyboardShouldPersistTaps="handled">
          
          <View style={styles.header}>
            <Text style={styles.headerLabel}>SERVICE DISPATCH</Text>
            <Text style={styles.headerTitle}>{subCategory}</Text>
            <Text style={styles.headerSubtitle}>Call-out fee: <Text style={styles.greenText}>R{basePrice}</Text></Text>
            {isPreferredProviderRebook && (
              <View style={styles.preferredBox}>
                <Text style={styles.preferredTitle}>Preferred provider request</Text>
                <Text style={styles.preferredText}>
                  We will prioritize {preferredTechnicianName || 'your previous provider'} if they are available. MyFixer matching, payment, tracking, and support stay in-app.
                </Text>
              </View>
            )}
          </View>

          {isSearchingProvider && (
          <View style={styles.matchingBox}>
            <ActivityIndicator size="large" color="#00FF87" />
              <Text style={styles.matchingText}>
                {scheduleMode === 'LATER'
                  ? `Scheduling your request for ${formatScheduledDate(selectedDate)}...`
                  : 'Finding available specialists near you...'}
              </Text>
            </View>
          )}

          {requestAccepted && (
            <View style={styles.providerCard}>
              <View style={styles.acceptedIconWrap}>
                <CheckCircle color="#00FF87" size={34} />
              </View>
              <View style={styles.providerMeta}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.providerName}>Your request was accepted</Text>
                  <Text style={styles.providerRating}>A verified specialist is now assigned. Open tracking for live updates and contact options.</Text>
                </View>
              </View>
              <View style={styles.providerActions}>
                <TouchableOpacity
                  style={styles.trackBtn}
                  onPress={() => navigation.navigate('TrackingMain', { bookingId: createdBookingId })}
                  disabled={!createdBookingId}
                >
                  <Text style={styles.trackBtnText}>Track Booking</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryTrackBtn}
                  onPress={() => navigation.navigate('Activity')}
                >
                  <Text style={styles.secondaryTrackBtnText}>View Activity</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {!requestAccepted && !isSearchingProvider && (
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
              <LocationSelectionSheet
                countryCode={profile?.countryCode || authService.getSession()?.user.countryCode || 'ZA'}
                initialFullAddress={selectedLocation?.fullAddress || profile?.defaultServiceAddress?.fullAddress || ''}
                initialLatitude={Number(latitude)}
                initialLongitude={Number(longitude)}
                ownerName={profile?.name || authService.getSession()?.user.name || 'Client'}
                ownerPhone={profile?.phone || authService.getSession()?.user.phone || ''}
                onLocationConfirmed={handleLocationConfirmed}
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

              <Text style={styles.sectionTitle}>Tell us what is happening</Text>
              <TextInput
                style={styles.instructionInput}
                multiline
                numberOfLines={4}
                placeholder="Example: Fridge is leaking water, or gate code is #403"
                placeholderTextColor="#475569"
                value={notes}
                onChangeText={setNotes}
              />

              <Text style={styles.sectionTitle}>Promo Code</Text>
              <TextInput
                style={styles.promoInput}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder="Optional, e.g. FIXER50"
                placeholderTextColor="#475569"
                value={promoCode}
                onChangeText={(value) => setPromoCode(value.toUpperCase())}
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

              {selectedLocation ? (
                <View style={styles.reviewBox}>
                  <Text style={styles.reviewTitle}>Booking review</Text>
                  <Text style={styles.reviewLine}>Owner: {profile?.name || authService.getSession()?.user.name || 'You'}</Text>
                  <Text style={styles.reviewLine}>
                    Service recipient: {selectedLocation.serviceRecipient.type === 'OTHER'
                      ? selectedLocation.serviceRecipient.fullName
                      : 'You'}
                  </Text>
                  <Text style={styles.reviewLine}>Service address: {selectedLocation.fullAddress}</Text>
                  <Text style={styles.reviewLine}>
                    Who receives service: {selectedLocation.serviceRecipient.type === 'OTHER' ? 'Someone else' : 'Booking owner'}
                  </Text>
                  <Text style={styles.reviewLine}>Who pays: Booking owner</Text>
                </View>
              ) : null}
            </View>
          )}

        </ScrollView>
        
        {!requestAccepted && !isSearchingProvider && (
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
  preferredBox: { marginTop: 14, backgroundColor: '#111827', borderWidth: 1, borderColor: '#1E293B', borderRadius: 12, padding: 12 },
  preferredTitle: { color: '#00FF87', fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  preferredText: { color: '#CBD5E1', fontSize: 12, lineHeight: 18, marginTop: 5 },
  formContainer: { gap: 20 },
  sectionTitle: { color: '#94A3B8', fontSize: 13, fontWeight: '700' },
  instructionInput: { backgroundColor: '#111827', borderColor: '#1E293B', borderWidth: 1, borderRadius: 12, padding: 16, color: '#FFFFFF', fontSize: 14, minHeight: 90, textAlignVertical: 'top' },
  promoInput: { backgroundColor: '#111827', borderColor: '#1E293B', borderWidth: 1, borderRadius: 12, padding: 16, color: '#FFFFFF', fontSize: 14, fontWeight: '700', letterSpacing: 0 },
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
  reviewBox: { backgroundColor: '#111827', borderColor: '#1E293B', borderWidth: 1, borderRadius: 12, padding: 14, gap: 6 },
  reviewTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  reviewLine: { color: '#CBD5E1', fontSize: 12, lineHeight: 18 },
  footerSticky: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#090D14', padding: 20, borderTopWidth: 1, borderColor: '#1E293B' },
  primaryActionButton: { backgroundColor: '#00FF87', height: 54, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  primaryActionText: { color: '#090D14', fontSize: 15, fontWeight: '800' },
  matchingBox: { backgroundColor: '#111827', borderRadius: 16, borderColor: '#1E293B', borderWidth: 1, padding: 32, alignItems: 'center', gap: 16, marginTop: 20 },
  matchingText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', textAlign: 'center', lineHeight: 20 },
  providerCard: { backgroundColor: '#111827', borderRadius: 16, borderWidth: 1, borderColor: '#1E293B', padding: 20, marginTop: 10 },
  acceptedIconWrap: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#00FF8715', borderWidth: 1, borderColor: '#00FF87', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },
  providerMeta: { borderBottomWidth: 1, borderColor: '#1E293B', paddingBottom: 16 },
  providerName: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  providerRating: { color: '#94A3B8', fontSize: 12, marginTop: 6, lineHeight: 18 },
  providerActions: { flexDirection: 'row', gap: 12, marginTop: 16, alignItems: 'center' },
  trackBtn: { flex: 1, backgroundColor: '#FFFFFF', height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  trackBtnText: { color: '#090D14', fontSize: 13, fontWeight: '700' },
  secondaryTrackBtn: { flex: 1, backgroundColor: '#1E293B', height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  secondaryTrackBtnText: { color: '#CBD5E1', fontSize: 13, fontWeight: '700' }
});

