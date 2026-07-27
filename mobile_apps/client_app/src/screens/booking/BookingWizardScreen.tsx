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
import {
  PriceBreakdown,
  formatMinorMoney,
  normalizePriceBreakdown,
  promotionDiscountMinor,
  promotionLabel,
  promotionSnapshots,
} from '../../utils/financialDisplay';
import { Colors, Radius, Spacing } from '../../theme';

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

const wizardSteps = ['Service', 'Location', 'Details', 'Schedule', 'Review'];

export default function BookingWizardScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const {
    category = '',
    serviceKey = '',
    subCategory = '',
    subCategoryKey = '',
    basePrice = 0,
    calloutFeeEnabled,
    preferredTechnicianId,
    preferredTechnicianName,
    rebookFromBookingId,
  } = route.params || {};
  const isPreferredProviderRebook = Boolean(preferredTechnicianId && rebookFromBookingId);
  const hasCalloutFee = calloutFeeEnabled === undefined ? basePrice > 0 : calloutFeeEnabled !== false;

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
  const [complexDetails, setComplexDetails] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<LocationConfirmationPayload | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [useDifferentAddress, setUseDifferentAddress] = useState(false);
  const [saveAsDefaultAddress, setSaveAsDefaultAddress] = useState(false);
  
  const [isSearchingProvider, setIsSearchingProvider] = useState(false);
  const [requestAccepted, setRequestAccepted] = useState(false);
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);
  const [dispatchStatus, setDispatchStatus] = useState('');
  const [standbyMessage, setStandbyMessage] = useState('');
  const [confirmedBreakdown, setConfirmedBreakdown] = useState<PriceBreakdown | null>(null);
  const [confirmedPromotions, setConfirmedPromotions] = useState<any[]>([]);

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
        // Location fallback stays silent so the booking form remains calm for users.
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
        Alert.alert('Address Required', 'Please enter your service address.');
        return;
      }

      setIsSubmitting(true);
      setIsSearchingProvider(true);
      setDispatchStatus('');
      setStandbyMessage('');
      setRequestAccepted(false);

      if (!serviceKey && !category) {
        Alert.alert('Service unavailable', 'Please choose an available service before booking.');
        setIsSearchingProvider(false);
        setIsSubmitting(false);
        return;
      }

      if (!subCategory) {
        Alert.alert('Service unavailable', 'Please choose an available service option before booking.');
        setIsSearchingProvider(false);
        setIsSubmitting(false);
        return;
      }

      const customerCoordinate = {
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
      };
      if (scheduleMode === 'LATER' && selectedDate.getTime() <= Date.now() + 5 * 60 * 1000) {
        Alert.alert('Choose a later time', 'Please schedule at least 5 minutes from now.');
        setIsSearchingProvider(false);
        setIsSubmitting(false);
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
        complexDetails: complexDetails.trim() || undefined,
        generalArea: selectedLocation.area || suburb.trim() || readableAddress,
        city: selectedLocation.city || city.trim() || profile?.location?.city,
        area: selectedLocation.area || suburb.trim() || profile?.location?.area,
        serviceKey: serviceKey || category,
        subcategoryKey: subCategoryKey,
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
      const backendBreakdown = normalizePriceBreakdown(response);
      setConfirmedBreakdown(backendBreakdown);
      setConfirmedPromotions(promotionSnapshots(response, backendBreakdown));
      setDispatchStatus(response.dispatchStatus || '');
      if (response.dispatchStatus === 'STANDBY') {
        setStandbyMessage(response.message || 'We are still looking for a nearby provider. Your request is open and we will notify you when someone accepts.');
      }
      if (response.dispatchStatus === 'SCHEDULED') {
        setIsSearchingProvider(false);
        setStandbyMessage('Your request has been scheduled. We will notify you when provider matching starts.');
      }

      socket.once('booking_assigned', (payload: { bookingId?: string; technicianId?: string }) => {
        if (payload.bookingId !== response.bookingId) return;

        setRequestAccepted(true);
        setIsSearchingProvider(false);
        setDispatchStatus('ACCEPTED');
        setStandbyMessage('');
      });

    } catch (err: any) {
      Alert.alert('Booking failed', err.message || 'We could not create your booking right now. Please try again.');
      setIsSearchingProvider(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelOpenRequest = () => {
    if (!createdBookingId) return;
    Alert.alert(
      'Cancel request?',
      'This will close your open provider search. You can request the service again later.',
      [
        { text: 'Keep Searching', style: 'cancel' },
        {
          text: 'Cancel Request',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.updateBookingStatus(createdBookingId, 'CANCELLED');
              setIsSearchingProvider(false);
              setDispatchStatus('CANCELLED');
              setStandbyMessage('');
              Alert.alert('Request Cancelled', 'Your provider search has been cancelled.');
            } catch (error: any) {
              Alert.alert('Unable to Cancel', error.message || 'Please try again.');
            }
          },
        },
      ]
    );
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
            <Text style={styles.headerTitle}>{subCategory || 'Selected service'}</Text>
            <Text style={styles.headerSubtitle}>
              {hasCalloutFee ? 'Call-out fee: ' : 'No call-out fee'}
              {hasCalloutFee ? <Text style={styles.greenText}>{basePrice > 0 ? `R${basePrice}` : 'Confirmed by Padi'}</Text> : null}
            </Text>
            <View style={styles.stepper}>
              {wizardSteps.map((step, index) => (
                <View key={step} style={styles.stepItem}>
                  <View style={[styles.stepDot, index === 0 && styles.stepDotActive]}>
                    <Text style={[styles.stepNumber, index === 0 && styles.stepNumberActive]}>{index + 1}</Text>
                  </View>
                  <Text style={[styles.stepLabel, index === 0 && styles.stepLabelActive]} numberOfLines={1}>{step}</Text>
                </View>
              ))}
            </View>
            {isPreferredProviderRebook && (
              <View style={styles.preferredBox}>
                <Text style={styles.preferredTitle}>Preferred provider request</Text>
                <Text style={styles.preferredText}>
                  We will prioritize {preferredTechnicianName || 'your previous provider'} if they are available. Padi matching, payment, tracking, and support stay in-app.
                </Text>
              </View>
            )}
          </View>

          {isSearchingProvider && (
          <View style={styles.matchingBox}>
            <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.matchingText}>
                {dispatchStatus === 'STANDBY'
                  ? 'Still looking for a nearby provider...'
                  : scheduleMode === 'LATER'
                  ? `Scheduling your request for ${formatScheduledDate(selectedDate)}...`
                  : 'Finding trusted professionals near you...'}
              </Text>
              {dispatchStatus === 'STANDBY' ? (
                <>
                  <Text style={styles.matchingSubText}>
                    {standbyMessage || 'Your request is open. We will notify you when someone accepts.'}
                  </Text>
                  <TouchableOpacity style={styles.cancelSearchButton} onPress={handleCancelOpenRequest} activeOpacity={0.84}>
                    <Text style={styles.cancelSearchButtonText}>Cancel Search</Text>
                  </TouchableOpacity>
                </>
              ) : null}
            </View>
          )}

          {requestAccepted && (
            <View style={styles.providerCard}>
              <View style={styles.acceptedIconWrap}>
                <CheckCircle color={Colors.primary} size={34} />
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
              {confirmedPromotions.length && confirmedBreakdown ? (
                <View style={styles.estimateBox}>
                  <Text style={styles.estimateTitle}>Promotion Applied</Text>
                  {confirmedPromotions.map((promotion, index) => (
                    <View key={`${promotion.promotionId || promotion.code || index}`} style={styles.estimateRow}>
                      <Text style={styles.estimateLabel}>{promotionLabel(promotion)}</Text>
                      <Text style={styles.estimateDiscount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                        -{formatMinorMoney(confirmedBreakdown.currency, promotionDiscountMinor(promotion))}
                      </Text>
                    </View>
                  ))}
                  <View style={styles.estimateRow}>
                    <Text style={styles.estimateTotalLabel}>Estimated Total</Text>
                    <Text style={styles.estimateTotal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                      {formatMinorMoney(confirmedBreakdown.currency, confirmedBreakdown.totalMinor || 0)}
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>
          )}

          {!requestAccepted && !isSearchingProvider && (
            <View style={styles.formContainer}>
              
              <View style={styles.sectionCard}>
              <Text style={styles.sectionEyebrow}>Step 2</Text>
              <Text style={styles.sectionTitle}>Service address</Text>
              <Text style={styles.sectionHint}>Choose where the professional should arrive. You can book for yourself or for someone else.</Text>
              {profile?.defaultServiceAddress?.fullAddress && !useDifferentAddress ? (
                <View style={styles.defaultAddressNotice}>
                  <Text style={styles.defaultAddressText}>Using saved address: {profile.defaultServiceAddress.fullAddress}</Text>
                  <TouchableOpacity onPress={handleUseDifferentAddress}>
                    <Text style={styles.defaultAddressAction}>Use different address</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              <LocationSelectionSheet
                countryCode={profile?.countryCode || authService.getSession()?.user.countryCode || ''}
                initialFullAddress={selectedLocation?.fullAddress || profile?.defaultServiceAddress?.fullAddress || ''}
                initialLatitude={Number(latitude)}
                initialLongitude={Number(longitude)}
                ownerName={profile?.name || authService.getSession()?.user.name || 'Client'}
                ownerPhone={profile?.phone || authService.getSession()?.user.phone || ''}
                onLocationConfirmed={handleLocationConfirmed}
                onLocationInvalidated={() => setSelectedLocation(null)}
              />
              <View style={styles.accessDetailsBox}>
                <Text style={styles.microLabel}>COMPLEX OR ACCESS DETAILS</Text>
                <TextInput
                  style={styles.accessDetailsInput}
                  value={complexDetails}
                  onChangeText={setComplexDetails}
                  placeholder="Optional: unit number, complex name, gate code, floor or access notes"
                  placeholderTextColor={Colors.textSubtle}
                  multiline
                />
              </View>
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
              </View>

              <View style={styles.sectionCard}>
              <Text style={styles.sectionEyebrow}>Step 3</Text>
              <Text style={styles.sectionTitle}>Service details</Text>
              <Text style={styles.sectionHint}>Add notes that help the professional prepare before arrival.</Text>
              <TextInput
                style={styles.instructionInput}
                multiline
                numberOfLines={4}
                placeholder="Example: Fridge is leaking water, or gate code is #403"
                placeholderTextColor="#475569"
                value={notes}
                onChangeText={setNotes}
              />
              </View>

              <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Promo code</Text>
              <TextInput
                style={styles.promoInput}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder="Optional"
                placeholderTextColor={Colors.textSubtle}
                value={promoCode}
                onChangeText={(value) => setPromoCode(value.toUpperCase())}
              />
              </View>

              <View style={styles.sectionCard}>
              <Text style={styles.sectionEyebrow}>Step 4</Text>
              <Text style={styles.sectionTitle}>Schedule</Text>
              <Text style={styles.sectionHint}>Request help now or choose a later arrival window.</Text>
              <View style={styles.timeToggleRow}>
                <TouchableOpacity style={[styles.toggleBtn, scheduleMode === 'NOW' && styles.toggleBtnActive]} onPress={() => setScheduleMode('NOW')}>
                  <Clock color={scheduleMode === 'NOW' ? Colors.background : Colors.textSubtle} size={18} />
                  <Text style={[styles.toggleText, scheduleMode === 'NOW' && styles.toggleTextActive]}>Dispatch Now</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.toggleBtn, scheduleMode === 'LATER' && styles.toggleBtnActive]} onPress={() => setScheduleMode('LATER')}>
                  <Calendar color={scheduleMode === 'LATER' ? Colors.background : Colors.textSubtle} size={18} />
                  <Text style={[styles.toggleText, scheduleMode === 'LATER' && styles.toggleTextActive]}>Schedule Later</Text>
                </TouchableOpacity>
              </View>

              {scheduleMode === 'LATER' && (
                <View style={styles.laterFormInputs}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.microLabel}>DATE</Text>
                    <TouchableOpacity style={styles.pickerSelectorBox} onPress={() => setShowDatePicker(true)}>
                      <Calendar color={Colors.primary} size={16} />
                      <Text style={styles.pickerSelectorText}>{selectedDate.toLocaleDateString()}</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.microLabel}>ARRIVAL TIME</Text>
                    <TouchableOpacity style={styles.pickerSelectorBox} onPress={() => setShowTimePicker(true)}>
                      <Clock color={Colors.primary} size={16} />
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
                <MapPin color={Colors.textSubtle} size={16} />
                <Text style={styles.locationSummaryText}>
                  {isLocating
                    ? 'Finding your service area...'
                    : selectedLocation?.fullAddress
                    ? 'Service address confirmed'
                    : 'Enter your address to confirm where the provider should arrive'}
                </Text>
              </View>
              </View>

              {selectedLocation ? (
                <View style={styles.reviewBox}>
                  <Text style={styles.sectionEyebrow}>Step 5</Text>
                  <Text style={styles.reviewTitle}>Booking review</Text>
                  <Text style={styles.reviewLine}>Owner: {profile?.name || authService.getSession()?.user.name || 'You'}</Text>
                  <Text style={styles.reviewLine}>
                    Service recipient: {selectedLocation.serviceRecipient.type === 'OTHER'
                      ? selectedLocation.serviceRecipient.fullName
                      : 'You'}
                  </Text>
                  <Text style={styles.reviewLine}>Service address: {selectedLocation.fullAddress}</Text>
                  {complexDetails.trim() ? (
                    <Text style={styles.reviewLine}>Access details: {complexDetails.trim()}</Text>
                  ) : null}
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
              {isSubmitting ? <ActivityIndicator color={Colors.background} /> : <Text style={styles.primaryActionText}>Request a professional</Text>}
            </TouchableOpacity>
          </View>
        )}

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  scrollWrapper: { padding: Spacing.xxl, paddingBottom: 128 },
  header: { marginBottom: Spacing.xl },
  headerTitle: { color: Colors.text, fontSize: 28, fontWeight: '900' },
  headerSubtitle: { color: Colors.textMuted, fontSize: 14, marginTop: 5, fontWeight: '600' },
  greenText: { color: Colors.primary, fontWeight: '900' },
  stepper: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xl },
  stepItem: { flex: 1, alignItems: 'center', gap: 6 },
  stepDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  stepNumber: { color: Colors.textSubtle, fontSize: 11, fontWeight: '900' },
  stepNumberActive: { color: Colors.background },
  stepLabel: { color: Colors.textSubtle, fontSize: 9, fontWeight: '800' },
  stepLabelActive: { color: Colors.text },
  preferredBox: { marginTop: 14, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.md },
  preferredTitle: { color: Colors.primary, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  preferredText: { color: Colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  formContainer: { gap: Spacing.lg },
  sectionCard: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.md },
  sectionEyebrow: { color: Colors.primary, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  sectionTitle: { color: Colors.text, fontSize: 17, fontWeight: '900' },
  sectionHint: { color: Colors.textMuted, fontSize: 12, fontWeight: '600', lineHeight: 18 },
  instructionInput: { backgroundColor: Colors.input, borderColor: Colors.border, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.lg, color: Colors.text, fontSize: 14, minHeight: 96, textAlignVertical: 'top' },
  promoInput: { backgroundColor: Colors.input, borderColor: Colors.border, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.lg, color: Colors.text, fontSize: 14, fontWeight: '700', letterSpacing: 0 },
  estimateBox: { marginTop: 14, backgroundColor: Colors.background, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: 14, gap: 8 },
  estimateTitle: { color: Colors.primary, fontSize: 13, fontWeight: '800' },
  estimateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  estimateLabel: { flex: 1, color: Colors.text, fontSize: 12, fontWeight: '700' },
  estimateDiscount: { flexShrink: 1, color: Colors.primary, fontSize: 12, fontWeight: '800', textAlign: 'right' },
  estimateTotalLabel: { color: Colors.text, fontSize: 13, fontWeight: '900' },
  estimateTotal: { flexShrink: 1, color: Colors.text, fontSize: 13, fontWeight: '900', textAlign: 'right' },
  addressRow: { flexDirection: 'row', gap: 12 },
  addressInput: { backgroundColor: Colors.input, borderColor: Colors.border, borderWidth: 1, borderRadius: Radius.md, padding: 14, color: Colors.text, fontSize: 14 },
  defaultAddressNotice: { backgroundColor: Colors.input, borderColor: Colors.border, borderWidth: 1, borderRadius: Radius.md, padding: 12, gap: 8 },
  defaultAddressText: { color: Colors.textMuted, fontSize: 12, lineHeight: 18 },
  defaultAddressAction: { color: Colors.primary, fontSize: 12, fontWeight: '800' },
  saveDefaultToggle: { backgroundColor: Colors.input, borderColor: Colors.border, borderWidth: 1, borderRadius: Radius.md, padding: 12 },
  saveDefaultText: { color: Colors.primary, fontSize: 12, fontWeight: '800' },
  timeToggleRow: { flexDirection: 'row', gap: 12 },
  toggleBtn: { flex: 1, flexDirection: 'row', gap: 8, height: 50, backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  toggleBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  toggleText: { color: Colors.textSubtle, fontSize: 13, fontWeight: '700' },
  toggleTextActive: { color: Colors.background, fontWeight: '900' },
  
  laterFormInputs: { flexDirection: 'row', gap: 12, backgroundColor: Colors.input, padding: 16, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border },
  microLabel: { color: Colors.textSubtle, fontSize: 9, fontWeight: '800', marginBottom: 6 },
  pickerSelectorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surfaceRaised, height: 44, borderRadius: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.borderStrong },
  pickerSelectorText: { color: Colors.text, fontSize: 13, fontWeight: '700' },

  accessDetailsBox: { backgroundColor: Colors.input, borderColor: Colors.border, borderWidth: 1, borderRadius: Radius.md, padding: 12, gap: 8 },
  accessDetailsInput: { color: Colors.text, fontSize: 13, fontWeight: '600', minHeight: 64, padding: 0, textAlignVertical: 'top' },
  locationSummaryBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  locationSummaryText: { color: Colors.textSubtle, fontSize: 12 },
  reviewBox: { backgroundColor: Colors.surface, borderColor: Colors.border, borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.lg, gap: 6 },
  reviewTitle: { color: Colors.text, fontSize: 16, fontWeight: '900' },
  reviewLine: { color: Colors.textMuted, fontSize: 12, lineHeight: 18 },
  footerSticky: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.background, padding: 20, borderTopWidth: 1, borderColor: Colors.border },
  primaryActionButton: { backgroundColor: Colors.primary, height: 54, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  primaryActionText: { color: Colors.background, fontSize: 15, fontWeight: '900' },
  matchingBox: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderColor: Colors.border, borderWidth: 1, padding: 32, alignItems: 'center', gap: 16, marginTop: 20 },
  matchingText: { color: Colors.text, fontSize: 14, fontWeight: '700', textAlign: 'center', lineHeight: 20 },
  matchingSubText: { color: Colors.textSubtle, fontSize: 13, fontWeight: '600', textAlign: 'center', lineHeight: 19, marginTop: -6 },
  cancelSearchButton: { marginTop: 2, paddingHorizontal: 18, height: 40, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.borderStrong, justifyContent: 'center', alignItems: 'center' },
  cancelSearchButtonText: { color: Colors.text, fontSize: 13, fontWeight: '800' },
  providerCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: 20, marginTop: 10 },
  acceptedIconWrap: { width: 62, height: 62, borderRadius: 31, backgroundColor: 'rgba(184, 255, 61, 0.14)', borderWidth: 1, borderColor: Colors.primary, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },
  providerMeta: { borderBottomWidth: 1, borderColor: Colors.border, paddingBottom: 16 },
  providerName: { color: Colors.text, fontSize: 16, fontWeight: '800' },
  providerRating: { color: Colors.textMuted, fontSize: 12, marginTop: 6, lineHeight: 18 },
  providerActions: { flexDirection: 'row', gap: 12, marginTop: 16, alignItems: 'center' },
  trackBtn: { flex: 1, backgroundColor: Colors.primary, height: 44, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center' },
  trackBtnText: { color: Colors.background, fontSize: 13, fontWeight: '900' },
  secondaryTrackBtn: { flex: 1, backgroundColor: Colors.surfaceRaised, height: 44, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.borderStrong },
  secondaryTrackBtnText: { color: Colors.text, fontSize: 13, fontWeight: '800' }
});

