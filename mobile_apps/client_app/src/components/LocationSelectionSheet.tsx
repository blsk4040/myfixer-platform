import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ServiceRecipient } from '../types/booking';

declare const process: {
  env?: {
    EXPO_PUBLIC_GEOAPIFY_API_KEY?: string;
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

const GEOAPIFY_API_KEY = process.env?.EXPO_PUBLIC_GEOAPIFY_API_KEY || '';

const normalizeCountryFilter = (countryCode?: string): string => {
  const normalized = (countryCode || '').trim().toLowerCase();
  return normalized ? `countrycode:${normalized}` : '';
};

type GeoapifyFeature = {
  type: 'Feature';
  geometry?: {
    type?: string;
    coordinates?: [number, number];
  };
  properties?: {
    formatted?: string;
    address_line1?: string;
    address_line2?: string;
    city?: string;
    suburb?: string;
    district?: string;
    postcode?: string;
    state?: string;
  };
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
  const [suggestions, setSuggestions] = useState<GeoapifyFeature[]>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);

  const countryFilter = useMemo(() => normalizeCountryFilter(countryCode), [countryCode]);

  useEffect(() => {
    const query = fullAddress.trim();
    if (!GEOAPIFY_API_KEY || query.length < 3 || latitude !== null || longitude !== null) {
      setSuggestions([]);
      setIsSearchingAddress(false);
      return undefined;
    }

    let isCurrent = true;
    const handle = setTimeout(async () => {
      setIsSearchingAddress(true);
      try {
        const params = new URLSearchParams({
          text: query,
          limit: '6',
          format: 'geojson',
          apiKey: GEOAPIFY_API_KEY,
        });
        if (countryFilter) params.set('filter', countryFilter);

        const response = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?${params.toString()}`);
        const payload = await response.json();
        if (!isCurrent) return;
        setSuggestions(Array.isArray(payload?.features) ? payload.features : []);
      } catch {
        if (isCurrent) setSuggestions([]);
      } finally {
        if (isCurrent) setIsSearchingAddress(false);
      }
    }, 280);

    return () => {
      isCurrent = false;
      clearTimeout(handle);
    };
  }, [countryFilter, fullAddress, latitude, longitude]);

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
          : 'Please enter your service address.'
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
      <View style={styles.autocompleteContainer}>
        <View style={styles.searchInputWrap}>
          <TextInput
            style={styles.searchInput}
            placeholder="Enter your service address"
            placeholderTextColor="#64748B"
            value={fullAddress}
            onChangeText={(text: string) => {
              setFullAddress(text);
              setLatitude(null);
              setLongitude(null);
              setErrorMessage('');
            }}
          />
          {isSearchingAddress ? <ActivityIndicator color="#B8FF3D" size="small" /> : null}
        </View>

        {suggestions.length ? (
          <FlatList
            data={suggestions}
            keyExtractor={(item, index) => `${item.properties?.formatted || 'address'}-${index}`}
            keyboardShouldPersistTaps="handled"
            style={styles.resultsList}
            ItemSeparatorComponent={() => <View style={styles.resultSeparator} />}
            renderItem={({ item }) => {
              const coordinates = item.geometry?.coordinates;
              const props = item.properties || {};
              const formatted = props.formatted || [props.address_line1, props.address_line2].filter(Boolean).join(', ');
              return (
                <TouchableOpacity
                  style={styles.resultRow}
                  activeOpacity={0.8}
                  onPress={() => {
                    const nextLongitude = Number(coordinates?.[0]);
                    const nextLatitude = Number(coordinates?.[1]);
                    setFullAddress(formatted);
                    if (Number.isFinite(nextLatitude)) setLatitude(nextLatitude);
                    if (Number.isFinite(nextLongitude)) setLongitude(nextLongitude);
                    setCity(props.city || props.district || '');
                    setArea(props.suburb || props.district || props.state || '');
                    setPostalCode(props.postcode || '');
                    setSuggestions([]);
                    setErrorMessage('');
                  }}
                >
                  <Text style={styles.resultDescription}>{formatted}</Text>
                </TouchableOpacity>
              );
            }}
          />
        ) : null}
      </View>

      <View style={styles.selectedAddressBox}>
        <Text style={styles.selectedLabel}>Selected address</Text>
        <Text style={styles.selectedAddress}>{fullAddress || 'Please enter your service address.'}</Text>
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
    color: '#FFFFFF',
    flex: 1,
    fontSize: 14,
    height: 50,
    paddingHorizontal: 0,
  },
  searchInputWrap: {
    alignItems: 'center',
    backgroundColor: '#0B1220',
    borderColor: '#334155',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 50,
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
