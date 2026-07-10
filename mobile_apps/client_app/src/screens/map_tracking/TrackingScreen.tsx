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
import { Camera, Map as MapLibreMap, Marker, type StyleSpecification } from '@maplibre/maplibre-react-native';
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

// ✅ Clean type bypass declarations to silence strict SVGSVGElement type checking
const Phone = LucidePhone as any;
const MessageSquare = LucideMessageSquare as any;
const ShieldCheck = LucideShieldCheck as any;
const MapPin = LucideMapPin as any;

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
    { id: 'background', type: 'background', paint: { 'background-color': '#090D14' } },
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

export default function TrackingScreen({ bookingId, customerCoordinate, route }: TrackingScreenProps) {
  const resolvedBookingId = bookingId ?? route?.params?.bookingId ?? '';
  const initialCustomerCoordinate = customerCoordinate ?? route?.params?.customerCoordinate ?? null;

  const [customerLocation, setCustomerLocation] = useState<Coordinate | null>(initialCustomerCoordinate);
  const [technicianLocation, setTechnicianLocation] = useState<Coordinate | null>(null);
  const [technician, setTechnician] = useState<BookingDetails['technician'] | null>(null);
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

  if (isLoadingBooking || !mapCenter || !customerLocation) {
    return (
      <SafeAreaView style={styles.centeredScreen}>
        <ActivityIndicator size="large" color="#00FF87" />
        <Text style={styles.loadingText}>Connecting secure map tracking layout...</Text>
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <MapLibreMap mapStyle={OSM_RASTER_STYLE} style={styles.map}>
        {cameraBounds ? (
          <Camera bounds={cameraBounds} padding={{ top: 110, right: 42, bottom: 260, left: 42 }} />
        ) : (
          <Camera center={mapCenter ?? DEFAULT_CENTER} zoom={technicianLocation ? 12 : 14} />
        )}

        <RouteLine id="technician-route" geometry={routeState.route?.geometry} />

        <Marker lngLat={toLngLat(customerLocation)}>
          <View style={styles.customerMarkerOuter}>
            <View style={styles.customerMarkerInner} />
          </View>
        </Marker>

        {technicianLocation && (
          <Marker lngLat={toLngLat(technicianLocation)}>
            <View style={styles.technicianMarker}>
              <View style={styles.technicianMarkerPulse} />
              <View style={styles.technicianMarkerDot} />
            </View>
          </Marker>
        )}
      </MapLibreMap>

      {/* Floating Header Status Bar Indicator */}
      <View style={styles.topStatusIndicator}>
        <View style={[styles.statusDot, { backgroundColor: technicianLocation ? '#00FF87' : '#38BDF8' }]} />
        <Text style={styles.topStatusText}>
          {technicianLocation ? 'Live tracking verified specialist' : 'Dispatched: Finding live coordinates...'}
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
            <Text style={styles.providerName}>{technician?.name || (technicianLocation ? "Assigned Professional" : "Securing Nearest Fixer")}</Text>
            <View style={styles.verificationBadgeRow}>
              <ShieldCheck color="#00FF87" size={14} />
              <Text style={styles.verificationText}>Verified MyFixer Pro</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.etaContainer}>
          <MapPin color="#64748B" size={18} />
          <View style={styles.etaTextBlock}>
            <Text style={styles.etaText}>
              {technicianLocation ? `Estimated travel time: ${travelTimeText}` : "Awaiting technician location..."}
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
            <Phone color="#FFFFFF" size={20} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconActionBtn}>
            <MessageSquare color="#FFFFFF" size={20} />
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
  container: { flex: 1, backgroundColor: '#090D14' },
  map: { ...StyleSheet.absoluteFillObject },
  centeredScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, backgroundColor: '#090D14' },
  loadingText: { marginTop: 14, color: '#64748B', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  errorText: { marginTop: 10, color: '#EF4444', fontSize: 13, textAlign: 'center' },
  
  topStatusIndicator: { position: 'absolute', top: 60, left: 20, right: 20, backgroundColor: '#111827', borderWidth: 1, borderColor: '#1E293B', height: 44, borderRadius: 22, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  topStatusText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  uberPanel: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#111827', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: '#1E293B', padding: 24, paddingBottom: 34 },
  panelHandle: { width: 36, height: 4, backgroundColor: '#1E293B', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarPlaceholder: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center' },
  avatarImage: { width: '100%', height: '100%', borderRadius: 24 },
  avatarInitial: { color: '#64748B', fontSize: 18, fontWeight: '700' },
  providerName: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  verificationBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  verificationText: { color: '#64748B', fontSize: 12, fontWeight: '600' },
  
  divider: { height: 1, backgroundColor: '#1E293B', marginVertical: 18 },
  etaContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  etaText: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  etaTextBlock: { flex: 1 },
  etaSubText: { color: '#64748B', fontSize: 12, fontWeight: '600', marginTop: 3 },
  routeErrorText: { color: '#F59E0B', fontSize: 12, fontWeight: '700', marginTop: 5 },

  actionRow: { flexDirection: 'row', gap: 12 },
  iconActionBtn: { width: 50, height: 50, borderRadius: 14, backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155', justifyContent: 'center', alignItems: 'center' },
  cancelRequestBtn: { flex: 1, backgroundColor: '#EF444415', borderWidth: 1, borderColor: '#EF444430', height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  cancelBtnText: { color: '#EF4444', fontSize: 14, fontWeight: '700' },

  customerMarkerOuter: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#00FF8730', alignItems: 'center', justifyContent: 'center' },
  customerMarkerInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#00FF87' },

  technicianMarker: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  technicianMarkerPulse: { position: 'absolute', width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(56, 189, 248, 0.25)' },
  technicianMarkerDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2.5, borderColor: '#FFFFFF', backgroundColor: '#38BDF8' }
});
