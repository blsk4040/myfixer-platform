import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import * as Location from 'expo-location';
import { isExpoGoRuntime } from '../config/runtimeEnvironment';
import { getGeoapifyApiKey } from '../config/runtime.config';
import { ServiceRecipient } from '../types/booking';

declare const require: any;

type StyleSpecification = any;

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
  onLocationInvalidated?: () => void;
}

const GEOAPIFY_API_KEY = getGeoapifyApiKey();

const MapLibreNative = (() => {
  if (isExpoGoRuntime) return null;
  try {
    return require('@maplibre/maplibre-react-native');
  } catch {
    return null;
  }
})();

const OSM_RASTER_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '(c) OpenStreetMap contributors',
    },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#0B0B0D' } },
    { id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-opacity': 0.9 } },
  ],
};

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

const getFeatureLabel = (feature: GeoapifyFeature): string => {
  const props = feature.properties || {};
  return props.formatted || [props.address_line1, props.address_line2].filter(Boolean).join(', ');
};

const toLngLat = (longitude: number, latitude: number): [number, number] => [longitude, latitude];

export default function LocationSelectionSheet({
  countryCode,
  initialFullAddress = '',
  initialLatitude,
  initialLongitude,
  ownerName = '',
  ownerPhone = '',
  onLocationConfirmed,
  onLocationInvalidated,
}: LocationSelectionSheetProps) {
  const hasAutoLocated = useRef(false);
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
  const [isLocatingCurrentAddress, setIsLocatingCurrentAddress] = useState(false);

  const countryFilter = useMemo(() => normalizeCountryFilter(countryCode), [countryCode]);
  const hasSelectedCoordinates =
    typeof latitude === 'number' &&
    Number.isFinite(latitude) &&
    typeof longitude === 'number' &&
    Number.isFinite(longitude);

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
    hasSelectedCoordinates &&
    (!isForSomeoneElse ||
      (
        contactName.trim().length > 0 &&
        contactPhone.trim().length > 0 &&
        relationship.trim().length > 0 &&
        city.trim().length > 0
      ));

  const buildConfirmationPayload = useCallback((): LocationConfirmationPayload | null => {
    if (!canConfirm || latitude === null || longitude === null) {
      return null;
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

    return {
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
    };
  }, [
    area,
    canConfirm,
    city,
    contactName,
    contactPhone,
    countryCode,
    fullAddress,
    isForSomeoneElse,
    latitude,
    longitude,
    ownerName,
    ownerPhone,
    postalCode,
    recipientEmail,
    recipientNotes,
    relationship,
  ]);

  const handleConfirm = () => {
    const payload = buildConfirmationPayload();
    if (!payload) {
      setErrorMessage(
        isForSomeoneElse
          ? 'Choose an address and add the on-site contact details.'
          : 'Please enter your service address.'
      );
      return;
    }

    setErrorMessage('');
    onLocationConfirmed(payload);
  };

  const applySelectedAddress = useCallback((payload: {
    formatted: string;
    latitude: number;
    longitude: number;
    city?: string;
    area?: string;
    postalCode?: string;
  }) => {
    setFullAddress(payload.formatted);
    setLatitude(payload.latitude);
    setLongitude(payload.longitude);
    setCity(payload.city || '');
    setArea(payload.area || '');
    setPostalCode(payload.postalCode || '');
    setSuggestions([]);
    setErrorMessage('');

    if (!isForSomeoneElse) {
      onLocationConfirmed({
        fullAddress: payload.formatted.trim(),
        latitude: payload.latitude,
        longitude: payload.longitude,
        isForSomeoneElse: false,
        serviceRecipient: {
          type: 'SELF',
          fullName: ownerName.trim() || 'Client',
          phoneNumber: ownerPhone.trim(),
          countryCode: countryCode?.trim() || undefined,
          country: countryCode?.trim() || undefined,
          city: payload.city?.trim() || undefined,
          streetAddress: payload.formatted.trim(),
        },
        city: payload.city?.trim() || undefined,
        area: payload.area?.trim() || undefined,
        postalCode: payload.postalCode?.trim() || undefined,
      });
    }
  }, [countryCode, isForSomeoneElse, onLocationConfirmed, ownerName, ownerPhone]);

  const applyGeoapifyFeature = useCallback((feature: GeoapifyFeature) => {
    const coordinates = feature.geometry?.coordinates;
    const props = feature.properties || {};
    const formatted = getFeatureLabel(feature);
    const nextLongitude = Number(coordinates?.[0]);
    const nextLatitude = Number(coordinates?.[1]);

    if (!formatted || !Number.isFinite(nextLatitude) || !Number.isFinite(nextLongitude)) {
      setErrorMessage('Please choose an address from the search results.');
      return;
    }

    applySelectedAddress({
      formatted,
      latitude: nextLatitude,
      longitude: nextLongitude,
      city: props.city || props.district || '',
      area: props.suburb || props.district || props.state || '',
      postalCode: props.postcode || '',
    });
  }, [applySelectedAddress]);

  const applyCoordinateFallback = useCallback((nextLatitude: number, nextLongitude: number) => {
    applySelectedAddress({
      formatted: `Pinned location (${nextLatitude.toFixed(5)}, ${nextLongitude.toFixed(5)})`,
      latitude: nextLatitude,
      longitude: nextLongitude,
    });
  }, [applySelectedAddress]);

  const reverseGeocode = useCallback(async (nextLatitude: number, nextLongitude: number) => {
    if (!GEOAPIFY_API_KEY) {
      applyCoordinateFallback(nextLatitude, nextLongitude);
      return;
    }

    const params = new URLSearchParams({
      lat: String(nextLatitude),
      lon: String(nextLongitude),
      format: 'geojson',
      apiKey: GEOAPIFY_API_KEY,
    });
    const response = await fetch(`https://api.geoapify.com/v1/geocode/reverse?${params.toString()}`);
    const payload = await response.json();
    const feature = Array.isArray(payload?.features) ? payload.features[0] : null;
    if (feature) {
      applyGeoapifyFeature(feature);
      return;
    }

    applyCoordinateFallback(nextLatitude, nextLongitude);
  }, [applyCoordinateFallback, applyGeoapifyFeature]);

  const useCurrentLocation = useCallback(async () => {
    setIsLocatingCurrentAddress(true);
    setErrorMessage('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        setErrorMessage('Location permission is needed to use your current location.');
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      await reverseGeocode(currentLocation.coords.latitude, currentLocation.coords.longitude);
    } catch {
      setErrorMessage('Unable to detect your current location. Please enter your service address.');
    } finally {
      setIsLocatingCurrentAddress(false);
    }
  }, [reverseGeocode]);

  useEffect(() => {
    if (hasAutoLocated.current || initialFullAddress.trim()) return;
    hasAutoLocated.current = true;
    void useCurrentLocation();
  }, [initialFullAddress, useCurrentLocation]);

  const handleRecipientToggle = useCallback((nextValue: boolean) => {
    setIsForSomeoneElse(nextValue);
    onLocationInvalidated?.();
  }, [onLocationInvalidated]);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheet}>
      <View style={styles.mapCard}>
        {MapLibreNative && hasSelectedCoordinates ? (
          <MapLibreNative.Map mapStyle={OSM_RASTER_STYLE} style={styles.map} logoEnabled={false} attributionEnabled={false}>
            <MapLibreNative.Camera center={toLngLat(longitude, latitude)} zoom={15} />
            <MapLibreNative.Marker lngLat={toLngLat(longitude, latitude)}>
              <View style={styles.mapPinOuter}>
                <View style={styles.mapPinInner} />
              </View>
            </MapLibreNative.Marker>
          </MapLibreNative.Map>
        ) : (
          <View style={styles.mapFallback}>
            <Text style={styles.mapFallbackTitle}>
              {isLocatingCurrentAddress ? 'Finding your location...' : 'Set your service address'}
            </Text>
            <Text style={styles.mapFallbackText}>
              Search for an address or use your current location to pin where the provider should arrive.
            </Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.currentLocationButton}
          activeOpacity={0.84}
          onPress={useCurrentLocation}
          disabled={isLocatingCurrentAddress}
        >
          {isLocatingCurrentAddress ? (
            <ActivityIndicator color="#0B0B0D" size="small" />
          ) : (
            <Text style={styles.currentLocationButtonText}>Use current location</Text>
          )}
        </TouchableOpacity>
      </View>

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
              onLocationInvalidated?.();
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
              const formatted = getFeatureLabel(item);
              return (
                <TouchableOpacity
                  style={styles.resultRow}
                  activeOpacity={0.8}
                  onPress={() => applyGeoapifyFeature(item)}
                >
                  <Text style={styles.resultDescription}>{formatted}</Text>
                </TouchableOpacity>
              );
            }}
          />
        ) : null}
      </View>

      <View style={styles.selectedAddressBox}>
        <Text style={styles.selectedLabel}>Service address</Text>
        <Text style={styles.selectedAddress}>{fullAddress || 'Please enter your service address.'}</Text>
      </View>

      <TouchableOpacity
        activeOpacity={0.8}
        style={styles.someoneElseRow}
        onPress={() => handleRecipientToggle(!isForSomeoneElse)}
      >
        <Text style={styles.someoneElseText}>Ordering for someone else?</Text>
        <Switch
          value={isForSomeoneElse}
          onValueChange={handleRecipientToggle}
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
  mapCard: {
    backgroundColor: '#0B0B0D',
    borderColor: '#1F2937',
    borderRadius: 16,
    borderWidth: 1,
    height: 240,
    overflow: 'hidden',
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  mapFallback: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 22,
  },
  mapFallbackTitle: {
    color: '#F7F7F5',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  mapFallbackText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 8,
    textAlign: 'center',
  },
  mapPinOuter: {
    alignItems: 'center',
    backgroundColor: 'rgba(184, 255, 61, 0.22)',
    borderColor: '#B8FF3D',
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  mapPinInner: {
    backgroundColor: '#B8FF3D',
    borderColor: '#0B0B0D',
    borderRadius: 7,
    borderWidth: 2,
    height: 14,
    width: 14,
  },
  currentLocationButton: {
    alignItems: 'center',
    backgroundColor: '#B8FF3D',
    borderRadius: 999,
    bottom: 12,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 16,
    position: 'absolute',
    right: 12,
  },
  currentLocationButtonText: {
    color: '#0B0B0D',
    fontSize: 12,
    fontWeight: '900',
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
