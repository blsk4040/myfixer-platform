// src/screens/map/MapScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, Map as MapLibreMap, Marker, UserLocation, type StyleSpecification } from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { Crosshair, EyeOff, RefreshCw } from 'lucide-react-native';
import { useJobStore } from '../store/useJobStore';
import { useSocketConnection } from '../context/SocketContext';
import { RouteLine } from '../components/maps/RouteLine';
import { useJobRoute } from '../hooks/useJobRoute';
import { distanceMetersBetween, isWithinArrivalRadius } from '../utils/distance';
import { formatEta } from '../utils/formatEta';
import apiService from '../services/api.service';

const EyeOffIcon = EyeOff as any;
const RefreshCwIcon = RefreshCw as any;
const CrosshairIcon = Crosshair as any;

const DEFAULT_CENTER: [number, number] = [28.0473, -26.1200];

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

const toLngLat = (latitude: number, longitude: number): [number, number] => [longitude, latitude];
const ARRIVAL_RADIUS_METERS = 100;
const MAX_ARRIVAL_ACCURACY_METERS = 50;

export function MapScreen(): React.JSX.Element {
  const { isOnDuty, toggleDutyStatus } = useSocketConnection();
  const incomingJobs = useJobStore((state) => state.incomingJobs || []);
  const activeJobs = useJobStore((state) => state.activeJobs || []);
  const updateJobStatus = useJobStore((state) => state.updateJobStatus);

  const [selectedJob, setSelectedJob] = useState<any | null>(activeJobs[0] || null);
  const [technicianLocation, setTechnicianLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [lastLocationRecordedAt, setLastLocationRecordedAt] = useState<string | null>(null);
  const [hasShownArrivalPrompt, setHasShownArrivalPrompt] = useState(false);
  const [isConfirmingArrival, setIsConfirmingArrival] = useState(false);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    if (!isOnDuty) return undefined;

    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
      (location) => {
        setTechnicianLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        setLocationAccuracy(location.coords.accuracy ?? null);
        setLastLocationRecordedAt(new Date(location.timestamp).toISOString());
      }
    ).then((nextSubscription) => {
      subscription = nextSubscription;
    }).catch(() => undefined);

    return () => {
      subscription?.remove();
    };
  }, [isOnDuty]);

  const destination = useMemo(() => {
    if (!selectedJob) return null;
    const destination = {
      latitude: Number(selectedJob.latitude),
      longitude: Number(selectedJob.longitude),
    };
    if (!Number.isFinite(destination.latitude) || !Number.isFinite(destination.longitude)) return null;
    return destination;
  }, [selectedJob]);

  const bookingId = selectedJob ? String(selectedJob.bookingId || selectedJob.id || '') : '';

  const routeState = useJobRoute({
    bookingId,
    origin: technicianLocation,
    destination,
    enabled: Boolean(bookingId && technicianLocation && destination && selectedJob?.jobStatus !== 'COMPLETED'),
  });

  const eta = routeState.route ? formatEta(routeState.route.durationSeconds, routeState.route.estimatedArrivalAt) : null;
  const fallbackDistanceMeters = technicianLocation && destination ? distanceMetersBetween(technicianLocation, destination) : null;
  const distanceText = routeState.route
    ? `${routeState.route.distanceKilometers.toFixed(1)} km`
    : fallbackDistanceMeters !== null
      ? `Approx. ${(fallbackDistanceMeters / 1000).toFixed(1)} km`
      : 'Distance pending';
  const cameraBounds = useMemo<[number, number, number, number] | null>(() => {
    if (!technicianLocation || !destination) return null;
    return [
      Math.min(technicianLocation.longitude, destination.longitude),
      Math.min(technicianLocation.latitude, destination.latitude),
      Math.max(technicianLocation.longitude, destination.longitude),
      Math.max(technicianLocation.latitude, destination.latitude),
    ];
  }, [destination, technicianLocation]);

  useEffect(() => {
    setHasShownArrivalPrompt(false);
  }, [bookingId]);

  const isInArrivalArea = Boolean(
    technicianLocation &&
      destination &&
      selectedJob?.jobStatus === 'IN_ROUTE' &&
      locationAccuracy !== null &&
      locationAccuracy <= MAX_ARRIVAL_ACCURACY_METERS &&
      isWithinArrivalRadius(technicianLocation, destination, ARRIVAL_RADIUS_METERS)
  );

  const handleConfirmArrival = async (): Promise<void> => {
    if (!bookingId || !technicianLocation || locationAccuracy === null) {
      Alert.alert('Arrival unavailable', 'Your current GPS reading is unavailable. Please retry when location is active.');
      return;
    }

    try {
      setIsConfirmingArrival(true);
      const result = await apiService.confirmArrival(bookingId, {
        latitude: technicianLocation.latitude,
        longitude: technicianLocation.longitude,
        accuracyMeters: locationAccuracy,
        recordedAt: lastLocationRecordedAt ?? new Date().toISOString(),
      });

      if (result.status === 'ARRIVED') {
        updateJobStatus('ARRIVED');
        setSelectedJob((job: any | null) => job ? { ...job, jobStatus: 'ARRIVED' } : job);
        Alert.alert(
          'Arrival confirmed',
          'Keep all job communication, approvals and payments inside MyFixer. Use Start Job when work begins.'
        );
        return;
      }

      Alert.alert('Arrival reading accepted', result.message || 'Please confirm again after a short moment.');
    } catch (error) {
      Alert.alert(
        'Arrival not confirmed',
        error instanceof Error
          ? `${error.message}\n\nRetry, contact support, or record the access issue in MyFixer.`
          : 'Retry, contact support, or record the access issue in MyFixer.'
      );
    } finally {
      setIsConfirmingArrival(false);
    }
  };

  useEffect(() => {
    if (!isInArrivalArea || hasShownArrivalPrompt || !bookingId) return;
    setHasShownArrivalPrompt(true);
    Alert.alert(
      'You appear to have reached the service location.',
      'Confirm arrival so MyFixer can verify your location. Keep all job communication, approvals and payments inside MyFixer.',
      [
        { text: 'Not yet', style: 'cancel' },
        { text: 'Confirm Arrival', onPress: () => { void handleConfirmArrival(); } },
      ]
    );
  }, [bookingId, hasShownArrivalPrompt, isInArrivalArea]);

  const renderJobMarker = (job: any, color: string) => {
    const latitude = Number(job.latitude);
    const longitude = Number(job.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    return (
      <Marker
        key={job.id || job.bookingId || `${latitude},${longitude}`}
        lngLat={toLngLat(latitude, longitude)}
        onPress={() => setSelectedJob(job)}
      >
        <View style={[styles.markerDot, { backgroundColor: color }]} />
      </Marker>
    );
  };

  return (
    <View style={styles.container}>
      <MapLibreMap mapStyle={OSM_RASTER_STYLE} style={styles.map}>
        {cameraBounds ? (
          <Camera bounds={cameraBounds} padding={{ top: 90, right: 36, bottom: 240, left: 36 }} />
        ) : (
          <Camera center={DEFAULT_CENTER} zoom={11} />
        )}

        {isOnDuty && <UserLocation animated accuracy />}

        <RouteLine id="active-route" geometry={routeState.route?.geometry} />

        {technicianLocation && (
          <Marker lngLat={toLngLat(technicianLocation.latitude, technicianLocation.longitude)}>
            <View style={styles.technicianMarker} />
          </Marker>
        )}

        {isOnDuty && incomingJobs.map((job: any) => renderJobMarker(job, '#00FF87'))}
        {isOnDuty && activeJobs.map((job: any) => renderJobMarker(job, '#38BDF8'))}
      </MapLibreMap>

      {!isOnDuty && (
        <View style={[StyleSheet.absoluteFillObject, styles.blurredBackdrop]}>
          <EyeOffIcon color="#64748B" size={40} style={{ marginBottom: 14 }} />
          <Text style={styles.lockTitle}>Map Offline</Text>
          <Text style={styles.lockSubtitle}>Go live when you are ready to show your location and view nearby job pins.</Text>
          <TouchableOpacity style={styles.btnGoOnline} onPress={toggleDutyStatus}>
            <Text style={styles.btnOnlineText}>Go Live</Text>
          </TouchableOpacity>
        </View>
      )}

      {isOnDuty && (
        <SafeAreaView style={styles.hudOverlayContainer} pointerEvents="box-none">
          {selectedJob ? (
            <View style={styles.hudCard}>
              <View style={styles.hudHeader}>
                <Text style={styles.hudTitle}>
                  {selectedJob.applianceType} ({selectedJob.jobStatus || 'INCOMING'})
                </Text>
                <View style={styles.etaBadge}>
                  <Text style={styles.etaText}>{eta?.travelTime || 'Calculating'}</Text>
                </View>
              </View>

              <Text style={styles.addressText}>{selectedJob.fullAddress || 'Service address unavailable'}</Text>
              <Text style={styles.distanceText}>
                {distanceText} • {eta?.arrivalTime || 'Estimated travel time pending'}
              </Text>
              {routeState.errorMessage ? (
                <Text style={styles.routeErrorText}>The road route is temporarily unavailable. Fallback distance is approximate.</Text>
              ) : null}
              {locationAccuracy !== null && locationAccuracy > MAX_ARRIVAL_ACCURACY_METERS ? (
                <Text style={styles.routeErrorText}>GPS accuracy is too low for arrival confirmation.</Text>
              ) : null}
              {selectedJob.jobStatus === 'IN_ROUTE' ? (
                <TouchableOpacity
                  style={[styles.btnArrival, !isInArrivalArea && styles.btnArrivalDisabled]}
                  onPress={() => { void handleConfirmArrival(); }}
                  disabled={isConfirmingArrival}
                >
                  <Text style={styles.btnArrivalText}>
                    {isConfirmingArrival ? 'Confirming...' : 'Confirm Arrival'}
                  </Text>
                </TouchableOpacity>
              ) : null}
              {selectedJob.jobStatus === 'ARRIVED' ? (
                <Text style={styles.routeHintText}>Start the job from Active Jobs when work begins.</Text>
              ) : null}

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.btnSecondary}
                  onPress={routeState.refreshRoute}
                >
                  <RefreshCwIcon color="#F8FAFC" size={16} />
                  <Text style={styles.btnSecondaryText}>Refresh Route</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.btnPrimary}
                  onPress={() => setSelectedJob(selectedJob)}
                >
                  <CrosshairIcon color="#090D14" size={16} />
                  <Text style={styles.btnPrimaryText}>Recenter</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.noSelectionCard}>
              <Text style={styles.noSelectionText}>Tap any map marker to show navigation info.</Text>
            </View>
          )}
        </SafeAreaView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090D14' },
  map: { ...StyleSheet.absoluteFillObject },
  markerDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 3, borderColor: '#090D14' },
  technicianMarker: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 4, borderColor: '#00FF87' },
  blurredBackdrop: { backgroundColor: '#090D14DD', justifyContent: 'center', alignItems: 'center', padding: 30 },
  lockTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  lockSubtitle: { color: '#94A3B8', fontSize: 13, textAlign: 'center', marginTop: 6, marginBottom: 20, lineHeight: 18 },
  btnGoOnline: { backgroundColor: '#00FF87', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  btnOnlineText: { color: '#090D14', fontWeight: '800', fontSize: 14 },
  hudOverlayContainer: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', padding: 20 },
  hudCard: { backgroundColor: '#090D14', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#1E293B' },
  hudHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  hudTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  etaBadge: { backgroundColor: '#00FF87', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  etaText: { color: '#090D14', fontSize: 11, fontWeight: '800' },
  addressText: { color: '#F8FAFC', fontSize: 15, fontWeight: '600', marginBottom: 2 },
  distanceText: { color: '#64748B', fontSize: 13, marginBottom: 15 },
  routeErrorText: { color: '#F59E0B', fontSize: 12, fontWeight: '700', marginBottom: 10 },
  routeHintText: { color: '#94A3B8', fontSize: 12, fontWeight: '700', marginBottom: 10 },
  btnArrival: { backgroundColor: '#F59E0B', paddingVertical: 12, alignItems: 'center', borderRadius: 10, marginBottom: 10 },
  btnArrivalDisabled: { opacity: 0.65 },
  btnArrivalText: { color: '#090D14', fontSize: 13, fontWeight: '800' },
  actionRow: { flexDirection: 'row', gap: 10 },
  btnPrimary: { flex: 1, backgroundColor: '#00FF87', paddingVertical: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, borderRadius: 10 },
  btnPrimaryText: { color: '#090D14', fontWeight: '700', fontSize: 14 },
  btnSecondary: { flex: 1, backgroundColor: '#1E293B', paddingVertical: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, borderRadius: 10, borderWidth: 1, borderColor: '#334155' },
  btnSecondaryText: { color: '#F8FAFC', fontWeight: '700', fontSize: 14 },
  noSelectionCard: { backgroundColor: '#111827', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#1E293B' },
  noSelectionText: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
});

