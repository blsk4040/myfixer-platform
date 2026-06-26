// src/screens/map/MapScreen.tsx
import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { EyeOff } from 'lucide-react-native';
import { useJobStore } from '../store/useJobStore';
import { useSocketConnection } from '../context/SocketContext'; // 👈 IMPORT CONNECTEE

const EyeOffIcon = EyeOff as any;

const DEFAULT_REGION = {
  latitude: -26.1200,
  longitude: 28.0473,
  latitudeDelta: 0.1522,
  longitudeDelta: 0.1121,
};

export function MapScreen(): React.JSX.Element {
  const { isOnDuty, toggleDutyStatus } = useSocketConnection(); // 👈 READ SHIFT TRACKER
  const incomingJobs = useJobStore((state) => state.incomingJobs);
  const activeJobs = useJobStore((state) => state.activeJobs);
  
  const [selectedJob, setSelectedJob] = useState<any | null>(activeJobs[0] || null);

  const openNativeMaps = (lat: number, lng: number, label: string) => {
    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
    const latLng = `${lat},${lng}`;
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`
    });
    if (url) Linking.openURL(url);
  };

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={DEFAULT_REGION}
        customMapStyle={darkMapStyle}
        showsUserLocation={isOnDuty} // Only show pin hardware position while active
        showsMyLocationButton={isOnDuty}
      >
        {/* Render job parameters conditionally depending on operational mode */}
        {isOnDuty && incomingJobs.map((job) => (
          <Marker
            key={job.id}
            coordinate={{ latitude: job.latitude, longitude: job.longitude }}
            pinColor="#00FF87"
            onPress={() => setSelectedJob(job)}
          />
        ))}

        {isOnDuty && activeJobs.map((job) => (
          <Marker
            key={job.id}
            coordinate={{ latitude: job.latitude, longitude: job.longitude }}
            pinColor="#38BDF8"
            onPress={() => setSelectedJob(job)}
          />
        ))}
      </MapView>

      {/* 🛑 Security Intercept Overlay Screen Panel: Shows if Off-Duty */}
      {!isOnDuty && (
        <View style={[StyleSheet.absoluteFillObject, styles.blurredBackdrop]}>
          <EyeOffIcon color="#64748B" size={40} style={{ marginBottom: 14 }} />
          <Text style={styles.lockTitle}>Radar Framework Offline</Text>
          <Text style={styles.lockSubtitle}>You must set your status to On-Duty to track job mappings.</Text>
          <TouchableOpacity style={styles.btnGoOnline} onPress={toggleDutyStatus}>
            <Text style={styles.btnOnlineText}>Go On-Duty</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Floating HUD Card Panel */}
      {isOnDuty && (
        <SafeAreaView style={styles.hudOverlayContainer} pointerEvents="box-none">
          {selectedJob ? (
            <View style={styles.hudCard}>
              <View style={styles.hudHeader}>
                <Text style={styles.hudTitle}>
                  {selectedJob.applianceType} ({selectedJob.jobStatus || 'INCOMING'})
                </Text>
                <div style={styles.etaBadge}>
                  <Text style={styles.etaText}>{selectedJob.distance || '— km'}</Text>
                </div>
              </View>
              
              <Text style={styles.addressText}>{selectedJob.fullAddress || 'Unit 12, Stone Arch Estate'}</Text>
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
                  onPress={() => openNativeMaps(selectedJob.latitude, selectedJob.longitude, selectedJob.applianceType)}
                >
                  <Text style={styles.btnPrimaryText}>Open Native Maps</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.noSelectionCard}>
              <Text style={styles.noSelectionText}>📍 Tap any map marker pin to show navigation info.</Text>
            </View>
          )}
        </SafeAreaView>
      )}
    </View>
  );
}

const darkMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#090D14" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#64748B" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#090D14" }] },
  { "featureType": "administrative.land_parcel", "elementType": "labels", "stylers": [{ "visibility": "off" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#1E293B" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#475569" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#0F172A" }] }
];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090D14' },
  map: { ...StyleSheet.absoluteFillObject },
  
  // New Lock Styles
  blurredBackdrop: { backgroundColor: '#090D14FA', justifyContent: 'center', alignItems: 'center', padding: 30 },
  lockTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  lockSubtitle: { color: '#64748B', fontSize: 13, textAlign: 'center', marginTop: 6, marginBottom: 20, lineHeight: 18 },
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
  noSelectionText: { color: '#64748B', fontSize: 13, fontWeight: '600' },
});