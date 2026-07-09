// src/screens/map/MapScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, GeoJSONSource, Layer, Map as MapLibreMap, Marker, UserLocation, type StyleSpecification } from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { EyeOff } from 'lucide-react-native';
import { useJobStore } from '../store/useJobStore';
import { useSocketConnection } from '../context/SocketContext';

const EyeOffIcon = EyeOff as any;

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

export function MapScreen(): React.JSX.Element {
  const { isOnDuty, toggleDutyStatus } = useSocketConnection();
  const incomingJobs = useJobStore((state) => state.incomingJobs || []);
  const activeJobs = useJobStore((state) => state.activeJobs || []);

  const [selectedJob, setSelectedJob] = useState<any | null>(activeJobs[0] || null);
  const [technicianLocation, setTechnicianLocation] = useState<{ latitude: number; longitude: number } | null>(null);

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
      }
    ).then((nextSubscription) => {
      subscription = nextSubscription;
    }).catch(() => undefined);

    return () => {
      subscription?.remove();
    };
  }, [isOnDuty]);

  const routeGeoJson = useMemo(() => {
    if (!technicianLocation || !selectedJob) return null;
    const destination = {
      latitude: Number(selectedJob.latitude),
      longitude: Number(selectedJob.longitude),
    };
    if (!Number.isFinite(destination.latitude) || !Number.isFinite(destination.longitude)) return null;

    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [
              toLngLat(technicianLocation.latitude, technicianLocation.longitude),
              toLngLat(destination.latitude, destination.longitude),
            ],
          },
        },
      ],
    } as any;
  }, [selectedJob, technicianLocation]);

  const openNativeMaps = (lat: number, lng: number, label: string) => {
    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
    const latLng = `${lat},${lng}`;
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`,
    });
    if (url) Linking.openURL(url);
  };

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
        <Camera center={DEFAULT_CENTER} zoom={11} />

        {isOnDuty && <UserLocation animated accuracy />}

        {routeGeoJson && (
          <GeoJSONSource id="active-route" data={routeGeoJson}>
            <Layer
              id="active-route-line"
              type="line"
              paint={{ 'line-color': '#00FF87', 'line-width': 4, 'line-opacity': 0.95 }}
            />
          </GeoJSONSource>
        )}

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
                  <Text style={styles.etaText}>{selectedJob.distance || '— km'}</Text>
                </View>
              </View>

              <Text style={styles.addressText}>{selectedJob.fullAddress || 'Service address unavailable'}</Text>
              <Text style={styles.distanceText}>
                {selectedJob.customerName || 'Client'} • {selectedJob.generalArea || 'Local Area'}
              </Text>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.btnSecondary}
                  onPress={() => Linking.openURL(`tel:${selectedJob.customerPhone || '0110000000'}`)}
                >
                  <Text style={styles.btnSecondaryText}>Call Client</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.btnPrimary}
                  onPress={() => openNativeMaps(Number(selectedJob.latitude), Number(selectedJob.longitude), selectedJob.applianceType)}
                >
                  <Text style={styles.btnPrimaryText}>Navigate</Text>
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
  actionRow: { flexDirection: 'row', gap: 10 },
  btnPrimary: { flex: 1, backgroundColor: '#00FF87', paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  btnPrimaryText: { color: '#090D14', fontWeight: '700', fontSize: 14 },
  btnSecondary: { flex: 1, backgroundColor: '#1E293B', paddingVertical: 12, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#334155' },
  btnSecondaryText: { color: '#F8FAFC', fontWeight: '700', fontSize: 14 },
  noSelectionCard: { backgroundColor: '#111827', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#1E293B' },
  noSelectionText: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
});

