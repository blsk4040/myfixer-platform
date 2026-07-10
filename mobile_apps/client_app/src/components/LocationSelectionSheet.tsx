import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { ServiceRecipient } from '../types/booking';

declare const process: {
  env?: {
    EXPO_PUBLIC_GOOGLE_PLACES_API_KEY?: string;
    EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?: string;
  };
};

export interface LocationConfirmationPayload {
  fullAddress: string;
  latitude: number;
  longitude: number;
  isForSomeoneElse: boolean;
  contactName?: string;
  contactPhone?: string;
  recipientRelationship?: string;
  recipientEmail?: string;
  recipientNotes?: string;
  serviceRecipient: ServiceRecipient;
  city?: string;
  area?: string;
  postalCode?: string;
}

interface LocationSelectionSheetProps {
  countryCode?: string;
  initialFullAddress?: string;
  initialLatitude?: number;
  initialLongitude?: number;
  ownerName?: string;
  ownerPhone?: string;
  onLocationConfirmed: (payload: LocationConfirmationPayload) => void;
}

const GOOGLE_PLACES_API_KEY =
  process.env?.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ||
  process.env?.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  '';

const normalizeCountryFilter = (countryCode?: string): string => {
  const normalized = (countryCode || 'ZA').trim().toLowerCase();
  return normalized ? `country:${normalized}` : 'country:za';
};

const getAddressPart = (components: any[] | undefined, types: string[]): string => {
  if (!Array.isArray(components)) return '';
  const component = components.find((item) =>
    Array.isArray(item.types) && types.some((type) => item.types.includes(type))
  );
  return String(component?.long_name || '').trim();
};

export default function LocationSelectionSheet({
  countryCode,
  initialFullAddress = '',
  initialLatitude,
  initialLongitude,
  ownerName = '',
  ownerPhone = '',
  onLocationConfirmed,
}: LocationSelectionSheetProps) {
  const [fullAddress, setFullAddress] = useState(initialFullAddress);
  const [latitude, setLatitude] = useState<number | null>(
    typeof initialLatitude === 'number' ? initialLatitude : null
  );
  const [longitude, setLongitude] = useState<number | null>(
    typeof initialLongitude === 'number' ? initialLongitude : null
  );
  const [isForSomeoneElse, setIsForSomeoneElse] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientNotes, setRecipientNotes] = useState('');
  const [city, setCity] = useState('');
  const [area, setArea] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const countryFilter = useMemo(() => normalizeCountryFilter(countryCode), [countryCode]);

  const canConfirm =
    fullAddress.trim().length > 0 &&
    typeof latitude === 'number' &&
    Number.isFinite(latitude) &&
    typeof longitude === 'number' &&
    Number.isFinite(longitude) &&
    (!isForSomeoneElse ||
      (
        contactName.trim().length > 0 &&
        contactPhone.trim().length > 0 &&
        relationship.trim().length > 0 &&
        city.trim().length > 0
      ));

  const handleConfirm = () => {
    if (!canConfirm || latitude === null || longitude === null) {
      setErrorMessage(
        isForSomeoneElse
          ? 'Choose an address and add the on-site contact details.'
          : 'Choose an address from the search results.'
      );
      return;
    }

    const serviceRecipient: ServiceRecipient = isForSomeoneElse
      ? {
          type: 'OTHER',
          fullName: contactName.trim(),
          phoneNumber: contactPhone.trim(),
          relationship: relationship.trim(),
          email: recipientEmail.trim() || undefined,
          countryCode: countryCode?.trim() || undefined,
          country: countryCode?.trim() || undefined,
          city: city.trim(),
          streetAddress: fullAddress.trim(),
          notes: recipientNotes.trim() || undefined,
        }
      : {
          type: 'SELF',
          fullName: ownerName.trim() || 'Client',
          phoneNumber: ownerPhone.trim(),
          countryCode: countryCode?.trim() || undefined,
          country: countryCode?.trim() || undefined,
          city: city.trim() || undefined,
          streetAddress: fullAddress.trim(),
        };

    setErrorMessage('');
    onLocationConfirmed({
      fullAddress: fullAddress.trim(),
      latitude,
      longitude,
      isForSomeoneElse,
      contactName: isForSomeoneElse ? contactName.trim() : undefined,
      contactPhone: isForSomeoneElse ? contactPhone.trim() : undefined,
      recipientRelationship: isForSomeoneElse ? relationship.trim() : undefined,
      recipientEmail: isForSomeoneElse ? recipientEmail.trim() || undefined : undefined,
      recipientNotes: isForSomeoneElse ? recipientNotes.trim() || undefined : undefined,
      serviceRecipient,
      city: city.trim() || undefined,
      area: area.trim() || undefined,
      postalCode: postalCode.trim() || undefined,
    });
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheet}>
      <GooglePlacesAutocomplete
        placeholder="Search for service address"
        fetchDetails
        enablePoweredByContainer={false}
        keyboardShouldPersistTaps="handled"
        minLength={2}
        debounce={250}
        onPress={(data, details = null) => {
          const location = details?.geometry?.location;
          const nextFullAddress = details?.formatted_address || data.description || '';
          const nextLatitude = Number(location?.lat);
          const nextLongitude = Number(location?.lng);

          setFullAddress(nextFullAddress);
          if (Number.isFinite(nextLatitude)) setLatitude(nextLatitude);
          if (Number.isFinite(nextLongitude)) setLongitude(nextLongitude);
          setCity(getAddressPart(details?.address_components, ['locality', 'administrative_area_level_2']));
          setArea(getAddressPart(details?.address_components, ['sublocality', 'sublocality_level_1', 'neighborhood']));
          setPostalCode(getAddressPart(details?.address_components, ['postal_code']));
          setErrorMessage('');
        }}
        query={{
          key: GOOGLE_PLACES_API_KEY,
          language: 'en',
          components: countryFilter,
        }}
        textInputProps={{
          placeholderTextColor: '#64748B',
          value: fullAddress,
          onChangeText: (text: string) => {
            setFullAddress(text);
            setLatitude(null);
            setLongitude(null);
          },
        }}
        styles={{
          container: styles.autocompleteContainer,
          textInput: styles.searchInput,
          listView: styles.resultsList,
          row: styles.resultRow,
          description: styles.resultDescription,
          separator: styles.resultSeparator,
        }}
      />

      <View style={styles.selectedAddressBox}>
        <Text style={styles.selectedLabel}>Selected address</Text>
        <Text style={styles.selectedAddress}>{fullAddress || 'Choose an address from Google Places'}</Text>
      </View>

      <TouchableOpacity
        activeOpacity={0.8}
        style={styles.someoneElseRow}
        onPress={() => setIsForSomeoneElse((current) => !current)}
      >
        <Text style={styles.someoneElseText}>Ordering for someone else?</Text>
        <Switch
          value={isForSomeoneElse}
          onValueChange={setIsForSomeoneElse}
          trackColor={{ false: '#334155', true: '#00A86B' }}
          thumbColor={isForSomeoneElse ? '#00FF87' : '#94A3B8'}
        />
      </TouchableOpacity>

      {isForSomeoneElse ? (
        <View style={styles.contactFields}>
          <TextInput
            style={styles.contactInput}
            placeholder="Recipient full name"
            placeholderTextColor="#64748B"
            value={contactName}
            onChangeText={setContactName}
          />
          <TextInput
            style={styles.contactInput}
            placeholder="Recipient phone number"
            placeholderTextColor="#64748B"
            value={contactPhone}
            onChangeText={setContactPhone}
            keyboardType="phone-pad"
          />
          <TextInput
            style={styles.contactInput}
            placeholder="Relationship to you"
            placeholderTextColor="#64748B"
            value={relationship}
            onChangeText={setRelationship}
          />
          <TextInput
            style={styles.contactInput}
            placeholder="Recipient city"
            placeholderTextColor="#64748B"
            value={city}
            onChangeText={setCity}
          />
          <TextInput
            style={styles.contactInput}
            placeholder="Recipient email (optional)"
            placeholderTextColor="#64748B"
            value={recipientEmail}
            onChangeText={setRecipientEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={[styles.contactInput, styles.notesInput]}
            placeholder="Recipient notes (optional)"
            placeholderTextColor="#64748B"
            value={recipientNotes}
            onChangeText={setRecipientNotes}
            multiline
          />
        </View>
      ) : null}

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <TouchableOpacity
        style={[styles.confirmButton, !canConfirm && styles.confirmButtonDisabled]}
        onPress={handleConfirm}
        activeOpacity={0.85}
      >
        <Text style={styles.confirmButtonText}>Use This Location</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: '#111827',
    borderColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 14,
    zIndex: 20,
  },
  autocompleteContainer: {
    flex: 0,
    zIndex: 40,
  },
  searchInput: {
    backgroundColor: '#0B1220',
    borderColor: '#334155',
    borderRadius: 12,
    borderWidth: 1,
    color: '#FFFFFF',
    fontSize: 14,
    height: 50,
    paddingHorizontal: 14,
  },
  resultsList: {
    backgroundColor: '#0B1220',
    borderColor: '#334155',
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
    overflow: 'hidden',
  },
  resultRow: {
    backgroundColor: '#0B1220',
    paddingVertical: 12,
  },
  resultDescription: {
    color: '#E2E8F0',
    fontSize: 13,
  },
  resultSeparator: {
    backgroundColor: '#1E293B',
    height: 1,
  },
  selectedAddressBox: {
    backgroundColor: '#0B1220',
    borderColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  selectedLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  selectedAddress: {
    color: '#E2E8F0',
    fontSize: 13,
    lineHeight: 18,
  },
  someoneElseRow: {
    alignItems: 'center',
    backgroundColor: '#0B1220',
    borderColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 12,
  },
  someoneElseText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '700',
  },
  contactFields: {
    gap: 10,
  },
  contactInput: {
    backgroundColor: '#0B1220',
    borderColor: '#334155',
    borderRadius: 12,
    borderWidth: 1,
    color: '#FFFFFF',
    fontSize: 14,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  notesInput: {
    minHeight: 76,
    paddingVertical: 12,
    textAlignVertical: 'top',
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
    lineHeight: 16,
  },
  confirmButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    color: '#090D14',
    fontSize: 13,
    fontWeight: '800',
  },
});
