// src/screens/tracking/LiveTrackScreen.tsx
import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert,
  Platform,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { initiateNativeCall } from '../../utils/communications'; 
import socketService from '../../services/socket.service';

interface TechnicianLocation {
  latitude: number;
  longitude: number;
  heading: number;
  speed: number;
  updatedAt: string;
}

export function LiveTrackScreen({ route, navigation }: any): React.JSX.Element {
  const { bookingId, jobId, techName, techPhone } = route?.params || { 
    bookingId: 'JOB-9921',
    jobId: 'JOB-9921',
    techName: 'Andrew Murray',
    techPhone: '+27821234567' 
  };
  const trackingId = bookingId ?? jobId;

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [techLocation, setTechLocation] = useState<TechnicianLocation | null>(null);
  const [eta, setEta] = useState<number>(14); 

  useEffect(() => {
    const socket = socketService.initializeConnection();

    socket.on('connect', () => {
      console.log(`[Socket] Connected. ID: ${socket.id}`);
      setIsLoading(false);
      socketService.joinBookingRoom(trackingId);
    });

    if (socket.connected) {
      setIsLoading(false);
      socketService.joinBookingRoom(trackingId);
    }

    socket.on('job_location_changed', (data: TechnicianLocation) => {
      console.log('⚡ Telemetry received:', data);
      setTechLocation(data);
      if (data.speed > 5) {
        setEta((currentEta) => (currentEta > 2 ? currentEta - 1 : 2));
      }
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection failed:', error);
      setIsLoading(false); 
    });

    return () => {
      console.log(`[Socket] Tearing down stream for: ${trackingId}`);
      socket.off('job_location_changed');
      socket.off('connect');
      socket.off('connect_error');
    };
  }, [trackingId]);

  const handleCallSpecialist = () => {
    initiateNativeCall(techPhone);
  };

  const handleChatSpecialist = () => {
    Alert.alert('In-App Chat', 'Chat pipeline initialization coming soon.');
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00FF87" />
        <Text style={styles.loadingText}>Connecting to Live Dispatch Grid...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      
      {/* 🗺️ MAP SURFACE - Restricted to 45% screen height */}
      <View style={styles.mapViewport}>
        <View style={styles.mapGridLinesSim}>
          <Text style={styles.mapWatermark}>MapTiler Vector Layer Active</Text>
          {techLocation ? (
            <View style={styles.techMarkerPulse}>
              <Text style={styles.markerIcon}>🛠️</Text>
              <Text style={styles.markerBadgeText}>{techName.split(' ')[0]}</Text>
              <Text style={styles.telemetryMiniText}>
                {techLocation.latitude.toFixed(4)}, {techLocation.longitude.toFixed(4)}
              </Text>
            </View>
          ) : (
            <Text style={styles.searchingText}>Awaiting GPS beacon signal...</Text>
          )}
        </View>
      </View>

      {/* 🎛️ SCROLLABLE HUD DELIVERY PANEL */}
      <View style={styles.hudWrapper}>
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={styles.hudScrollBody}
        >
          {/* Identity Block */}
          <View style={styles.identityContainer}>
            <View style={styles.metaLeft}>
              <Text style={styles.techNameText} numberOfLines={1}>👤 {techName}</Text>
              <Text style={styles.techMetaText}>★ 4.9 Verified Specialist</Text>
            </View>
            <View style={styles.etaBadgeSmall}>
              <Text style={styles.etaNumberSmall}>{eta}</Text>
              <Text style={styles.etaUnitSmall}>MINS</Text>
            </View>
          </View>

          {/* Metric Grid Layer */}
          <View style={styles.metricGrid}>
            <View style={styles.gridItem}>
              <Text style={styles.metricLabel}>STATUS</Text>
              <Text style={styles.metricValueText}>
                {techLocation ? '🟢 En Route' : '🟡 Dispatched'}
              </Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.metricLabel}>LAST GPS</Text>
              <Text style={styles.metricValueText}>
                {techLocation ? 'Just now' : 'Connecting...'}
              </Text>
            </View>
          </View>

          <View style={styles.metricGrid}>
            <View style={styles.gridItem}>
              <Text style={styles.metricLabel}>SPEED</Text>
              <Text style={styles.metricValueText}>
                {techLocation && techLocation.speed > 0 ? `${Math.round(techLocation.speed)} km/h` : '0 km/h'}
              </Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.metricLabel}>TRACKING ID</Text>
              <Text style={styles.metricValueText} numberOfLines={1}>{trackingId}</Text>
            </View>
          </View>

          {/* Double Action Row */}
          <View style={styles.actionRow}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.callButton]} 
              activeOpacity={0.8} 
              onPress={handleCallSpecialist}
            >
              <Text style={styles.actionButtonText}>📞 Call</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, styles.chatButton]} 
              activeOpacity={0.8} 
              onPress={handleChatSpecialist}
            >
              <Text style={styles.actionButtonText}>💬 Chat</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090D14' },
  loadingContainer: { flex: 1, backgroundColor: '#090D14', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#64748B', fontSize: 14, marginTop: 12, fontWeight: '600' },
  
  // Map sizing configuration
  mapViewport: { height: '45%', backgroundColor: '#111827', marginHorizontal: 16, marginTop: 10, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#1E293B' },
  mapGridLinesSim: { flex: 1, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  mapWatermark: { color: '#1E293B', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2, position: 'absolute', bottom: 16 },
  techMarkerPulse: { alignItems: 'center', position: 'absolute' },
  markerIcon: { fontSize: 32 },
  markerBadgeText: { color: '#00FF87', fontSize: 11, fontWeight: '700', backgroundColor: '#090D14', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#1E293B', marginTop: 4, overflow: 'hidden' },
  telemetryMiniText: { color: '#64748B', fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginTop: 2 },
  searchingText: { color: '#475569', fontSize: 13, fontWeight: '500' },
  
  // Safe layout containers
  hudWrapper: { flex: 1, backgroundColor: '#111827', margin: 16, marginTop: 8, borderRadius: 20, borderWidth: 1, borderColor: '#1E293B', overflow: 'hidden' },
  hudScrollBody: { padding: 20, paddingBottom: 40 },
  
  // Identity elements
  identityContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#1E293B', paddingBottom: 16, marginBottom: 16 },
  metaLeft: { flex: 1, paddingRight: 12 },
  techNameText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  techMetaText: { color: '#00FF87', fontSize: 12, fontWeight: '600', marginTop: 4 },
  
  // Optimized space-conscious ETA badge
  etaBadgeSmall: { backgroundColor: '#00FF8710', borderWidth: 1, borderColor: '#00FF87', borderRadius: 10, width: 52, height: 52, justifyContent: 'center', alignItems: 'center' },
  etaNumberSmall: { color: '#00FF87', fontSize: 18, fontWeight: '800', lineHeight: 20 },
  etaUnitSmall: { color: '#00FF87', fontSize: 8, fontWeight: '700', marginTop: 1 },
  
  // Anti-wrapping grid systems
  metricGrid: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  gridItem: { flex: 1, backgroundColor: '#090D14', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#1E293B' },
  metricLabel: { color: '#64748B', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  metricValueText: { color: '#E2E8F0', fontSize: 13, fontWeight: '600', marginTop: 4 },
  
  // Composed actions bar
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  actionButton: { flex: 1, padding: 15, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  callButton: { backgroundColor: '#1E293B', borderColor: '#334155' },
  chatButton: { backgroundColor: '#090D14', borderColor: '#1E293B' },
  actionButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' }
});
