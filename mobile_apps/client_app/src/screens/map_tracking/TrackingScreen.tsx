// mobile_apps/client_app/src/screens/tracking/TrackingScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import { 
  Phone as LucidePhone, 
  MessageSquare as LucideMessageSquare, 
  ShieldCheck as LucideShieldCheck, 
  MapPin as LucideMapPin 
} from 'lucide-react-native';
import apiService, { BookingDetails, Coordinate } from '../../services/api.service';
import socketService from '../../services/socket.service';
import { RouteLine } from '../../components/maps/RouteLine';
import { useJobRoute } from '../../hooks/useJobRoute';
import { distanceMetersBetween } from '../../utils/distance';
import { formatEta, formatTravelTime } from '../../utils/formatEta';
import { getProviderRoleForService } from '../../utils/providerRole';
import { Colors, Radius, Spacing } from '../../theme';
import { isExpoGoRuntime } from '../../config/runtimeEnvironment';

// ✅ Clean type bypass declarations to silence strict SVGSVGElement type checking
const Phone = LucidePhone as any;
const MessageSquare = LucideMessageSquare as any;
const ShieldCheck = LucideShieldCheck as any;
const MapPin = LucideMapPin as any;

declare const require: any;

type StyleSpecification = any;

const MapLibreNative = (() => {
  if (isExpoGoRuntime) return null;
  try {
    return require('@maplibre/maplibre-react-native');
  } catch {
    return null;
  }
})();

type TrackingScreenRoute = {
  params?: {
    bookingId?: string;
    customerCoordinate?: Coordinate;
  };
};

interface TrackingScreenProps {
  bookingId?: string;
  customerCoordinate?: Coordinate;
  route?: TrackingScreenRoute;
}

type LocationPayload = {
  latitude?: unknown;
  longitude?: unknown;
  location?: { latitude?: unknown; longitude?: unknown };
  coordinate?: { latitude?: unknown; longitude?: unknown };
};

const DEFAULT_CENTER: [number, number] = [28.0473, -26.2041];

const OSM_RASTER_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#0B0B0D' } },
    { id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-opacity': 0.92 } },
  ],
};

const isCoordinate = (value: unknown): value is Coordinate => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Coordinate>;
  return (
    typeof candidate.latitude === 'number' &&
    Number.isFinite(candidate.latitude) &&
    candidate.latitude >= -90 &&
    candidate.latitude <= 90 &&
    typeof candidate.longitude === 'number' &&
    Number.isFinite(candidate.longitude) &&
    candidate.longitude >= -180 &&
    candidate.longitude <= 180
  );
};

const toCoordinate = (payload: LocationPayload): Coordinate | null => {
  const direct = { latitude: payload.latitude, longitude: payload.longitude };
  if (isCoordinate(direct)) return direct;
  if (isCoordinate(payload.location)) return payload.location;
  if (isCoordinate(payload.coordinate)) return payload.coordinate;
  return null;
};

const getBookingCustomerCoordinate = (booking: BookingDetails): Coordinate | null => {
  if (isCoordinate(booking.customerLocation)) return booking.customerLocation;
  if (isCoordinate(booking.customer_location)) return booking.customer_location;
  return null;
};

const toLngLat = (coordinate: Coordinate): [number, number] => [coordinate.longitude, coordinate.latitude];

const providerReputationText = (technician: BookingDetails['technician'] | null): string => {
  const reputation = technician?.reputation;
  if (!reputation) return 'Verified Padi Pro';
  const parts = [];
  if (typeof reputation.averageRating === 'number' && reputation.reviewCount > 0) {
    parts.push(`${reputation.averageRating.toFixed(1)} rating`);
  }
  if (reputation.completedJobs > 0) {
    parts.push(`${reputation.completedJobs.toLocaleString()} jobs completed`);
  }
  parts.push(reputation.verified ? 'Verified Padi Pro' : 'Padi Pro');
  return parts.join(' · ');
};

export default function TrackingScreen({ bookingId, customerCoordinate, route }: TrackingScreenProps) {
  const resolvedBookingId = bookingId ?? route?.params?.bookingId ?? '';
  const initialCustomerCoordinate = customerCoordinate ?? route?.params?.customerCoordinate ?? null;

  const [customerLocation, setCustomerLocation] = useState<Coordinate | null>(initialCustomerCoordinate);
  const [technicianLocation, setTechnicianLocation] = useState<Coordinate | null>(null);
  const [technician, setTechnician] = useState<BookingDetails['technician'] | null>(null);
  const [bookingService, setBookingService] = useState<{ serviceKey?: unknown; applianceType?: unknown }>({});
  const [isLoadingBooking, setIsLoadingBooking] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastLocationUpdatedAt, setLastLocationUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadBookingDetails = async () => {
      if (!resolvedBookingId) {
        setErrorMessage('Missing booking reference.');
        setIsLoadingBooking(false);
        return;
      }
      try {
        const booking = await apiService.getBookingDetails(resolvedBookingId);
        const bookingCustomerLocation = getBookingCustomerCoordinate(booking);
        if (isMounted && bookingCustomerLocation) {
          setCustomerLocation(bookingCustomerLocation);
        }
        if (isMounted) {
          setTechnician(booking.technician || null);
          setBookingService({ serviceKey: booking.serviceKey, applianceType: booking.applianceType });
        }
      } catch (error) {
        if (isMounted) setErrorMessage(error instanceof Error ? error.message : 'Unable to load booking.');
      } finally {
        if (isMounted) setIsLoadingBooking(false);
      }
    };
    void loadBookingDetails();
    return () => { isMounted = false; };
  }, [resolvedBookingId]);

  useEffect(() => {
    if (!resolvedBookingId) return undefined;

    const socket = socketService.initializeConnection();
    const handleTechnicianLocationUpdated = (payload: LocationPayload) => {
      const nextLocation = toCoordinate(payload);
      if (nextLocation) {
        setTechnicianLocation(nextLocation);
        const updatedAt = typeof (payload as { updatedAt?: unknown }).updatedAt === 'string'
          ? (payload as { updatedAt: string }).updatedAt
          : new Date().toISOString();
        setLastLocationUpdatedAt(updatedAt);
      }
    };

    socketService.joinBookingRoom(resolvedBookingId);
    socket.on('job_location_changed', handleTechnicianLocationUpdated);
    socket.on('technician_location_updated', handleTechnicianLocationUpdated);

    return () => {
      socket.off('job_location_changed', handleTechnicianLocationUpdated);
      socket.off('technician_location_updated', handleTechnicianLocationUpdated);
    };
  }, [resolvedBookingId]);

  const mapCenter = useMemo<[number, number] | null>(() => {
    if (!customerLocation) return null;
    if (!technicianLocation) return toLngLat(customerLocation);
    return [
      (customerLocation.longitude + technicianLocation.longitude) / 2,
      (customerLocation.latitude + technicianLocation.latitude) / 2,
    ];
  }, [customerLocation, technicianLocation]);
  const cameraBounds = useMemo<[number, number, number, number] | null>(() => {
    if (!customerLocation || !technicianLocation) return null;
    return [
      Math.min(customerLocation.longitude, technicianLocation.longitude),
      Math.min(customerLocation.latitude, technicianLocation.latitude),
      Math.max(customerLocation.longitude, technicianLocation.longitude),
      Math.max(customerLocation.latitude, technicianLocation.latitude),
    ];
  }, [customerLocation, technicianLocation]);

  const routeState = useJobRoute({
    bookingId: resolvedBookingId,
    origin: technicianLocation,
    destination: customerLocation,
    enabled: Boolean(resolvedBookingId && technicianLocation && customerLocation),
  });

  const eta = routeState.route ? formatEta(routeState.route.durationSeconds, routeState.route.estimatedArrivalAt) : null;
  const approximateDistanceMeters = technicianLocation && customerLocation
    ? distanceMetersBetween(technicianLocation, customerLocation)
    : null;
  const distanceText = routeState.route
    ? `${routeState.route.distanceKilometers.toFixed(1)} km`
    : approximateDistanceMeters !== null
      ? `Approx. ${(approximateDistanceMeters / 1000).toFixed(1)} km`
      : 'Distance pending';
  const travelTimeText = eta?.travelTime ?? (routeState.route ? formatTravelTime(routeState.route.durationSeconds) : 'Calculating...');
  const lastUpdatedText = lastLocationUpdatedAt
    ? new Date(lastLocationUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Waiting';
  const providerRole = getProviderRoleForService(bookingService.serviceKey, bookingService.applianceType);
  const hasNativeMap = Boolean(MapLibreNative);

  if (isLoadingBooking || !mapCenter || !customerLocation) {
    return (
      <SafeAreaView style={styles.centeredScreen}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Connecting secure map tracking layout...</Text>
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {hasNativeMap ? (
        <MapLibreNative.Map mapStyle={OSM_RASTER_STYLE} style={styles.map}>
          {cameraBounds ? (
            <MapLibreNative.Camera bounds={cameraBounds} padding={{ top: 110, right: 42, bottom: 260, left: 42 }} />
          ) : (
            <MapLibreNative.Camera center={mapCenter ?? DEFAULT_CENTER} zoom={technicianLocation ? 12 : 14} />
          )}

          <RouteLine id="technician-route" geometry={routeState.route?.geometry} />

          <MapLibreNative.Marker lngLat={toLngLat(customerLocation)}>
            <View style={styles.customerMarkerOuter}>
              <View style={styles.customerMarkerInner} />
            </View>
          </MapLibreNative.Marker>

          {technicianLocation && (
            <MapLibreNative.Marker lngLat={toLngLat(technicianLocation)}>
              <View style={styles.technicianMarker}>
                <View style={styles.technicianMarkerPulse} />
                <View style={styles.technicianMarkerDot} />
              </View>
            </MapLibreNative.Marker>
          )}
        </MapLibreNative.Map>
      ) : (
        <View style={styles.mapFallback}>
          <MapPin color={Colors.primary} size={28} />
          <Text style={styles.mapFallbackTitle}>Live map unavailable</Text>
          <Text style={styles.mapFallbackBody}>
            Please install the latest Padi app build to view live tracking.
          </Text>
        </View>
      )}

      {/* Floating Header Status Bar Indicator */}
      <View style={styles.topStatusIndicator}>
        <View style={[styles.statusDot, { backgroundColor: technicianLocation ? Colors.primary : Colors.info }]} />
        <Text style={styles.topStatusText}>
          {technicianLocation ? `Live tracking verified ${providerRole.singular}` : 'Dispatched: Finding live coordinates...'}
        </Text>
      </View>

      {/* Modern Fixed Bottom Action HUD Panel */}
      <View style={styles.uberPanel}>
        <View style={styles.panelHandle} />
        
        <View style={styles.profileRow}>
          <View style={styles.avatarPlaceholder}>
            {technician?.profilePhotoUrl ? (
              <Image source={{ uri: technician.profilePhotoUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarInitial}>T</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.providerName}>{technician?.name || (technicianLocation ? `Assigned ${providerRole.capitalized}` : `Securing nearest ${providerRole.singular}`)}</Text>
            <View style={styles.verificationBadgeRow}>
              <ShieldCheck color={Colors.primary} size={14} />
              <Text style={styles.verificationText}>{providerReputationText(technician)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.etaContainer}>
          <MapPin color={Colors.textSubtle} size={18} />
          <View style={styles.etaTextBlock}>
            <Text style={styles.etaText}>
              {technicianLocation ? `Estimated travel time: ${travelTimeText}` : `Awaiting ${providerRole.singular} location...`}
            </Text>
            <Text style={styles.etaSubText}>
              {routeState.isLoading ? 'Calculating road route...' : `${distanceText} • Last update ${lastUpdatedText}`}
            </Text>
            {eta?.arrivalTime ? <Text style={styles.etaSubText}>{eta.arrivalTime}</Text> : null}
            {routeState.errorMessage ? (
              <Text style={styles.routeErrorText}>The road route is temporarily unavailable.</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.iconActionBtn}>
            <Phone color={Colors.text} size={20} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconActionBtn}>
            <MessageSquare color={Colors.text} size={20} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelRequestBtn}>
            <Text style={styles.cancelBtnText}>Cancel Job</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  map: { ...StyleSheet.absoluteFillObject },
  mapFallback: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, backgroundColor: Colors.background },
  mapFallbackTitle: { color: Colors.text, fontSize: 16, fontWeight: '900', marginTop: 12, textAlign: 'center' },
  mapFallbackBody: { color: Colors.textSubtle, fontSize: 13, fontWeight: '600', lineHeight: 19, marginTop: 6, textAlign: 'center' },
  centeredScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, backgroundColor: Colors.background },
  loadingText: { marginTop: 14, color: Colors.textSubtle, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  errorText: { marginTop: 10, color: Colors.danger, fontSize: 13, textAlign: 'center' },
  
  topStatusIndicator: { position: 'absolute', top: 60, left: 20, right: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, height: 44, borderRadius: 22, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  topStatusText: { color: Colors.text, fontSize: 13, fontWeight: '800' },

  uberPanel: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderTopWidth: 1, borderColor: Colors.border, padding: Spacing.xxl, paddingBottom: 34 },
  panelHandle: { width: 36, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarPlaceholder: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.surfaceRaised, justifyContent: 'center', alignItems: 'center' },
  avatarImage: { width: '100%', height: '100%', borderRadius: 24 },
  avatarInitial: { color: Colors.textSubtle, fontSize: 18, fontWeight: '700' },
  providerName: { color: Colors.text, fontSize: 16, fontWeight: '900' },
  verificationBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  verificationText: { color: Colors.textSubtle, fontSize: 12, fontWeight: '700' },
  
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 18 },
  etaContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  etaText: { color: Colors.textMuted, fontSize: 13, fontWeight: '700' },
  etaTextBlock: { flex: 1 },
  etaSubText: { color: Colors.textSubtle, fontSize: 12, fontWeight: '600', marginTop: 3 },
  routeErrorText: { color: Colors.amber, fontSize: 12, fontWeight: '700', marginTop: 5 },

  actionRow: { flexDirection: 'row', gap: 12 },
  iconActionBtn: { width: 50, height: 50, borderRadius: Radius.md, backgroundColor: Colors.surfaceRaised, borderWidth: 1, borderColor: Colors.borderStrong, justifyContent: 'center', alignItems: 'center' },
  cancelRequestBtn: { flex: 1, backgroundColor: 'rgba(255, 93, 93, 0.08)', borderWidth: 1, borderColor: 'rgba(255, 93, 93, 0.25)', height: 50, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center' },
  cancelBtnText: { color: Colors.danger, fontSize: 14, fontWeight: '800' },

  customerMarkerOuter: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(184, 255, 61, 0.28)', alignItems: 'center', justifyContent: 'center' },
  customerMarkerInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },

  technicianMarker: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  technicianMarkerPulse: { position: 'absolute', width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(86, 184, 255, 0.25)' },
  technicianMarkerDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2.5, borderColor: Colors.text, backgroundColor: Colors.info }
});
