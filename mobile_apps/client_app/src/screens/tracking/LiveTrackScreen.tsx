// src/screens/tracking/LiveTrackScreen.tsx
import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { io, Socket } from 'socket.io-client'; 
import { initiateNativeCall } from '../../utils/communications'; // Native call helper

// Type structure matching incoming real-time backend updates
interface TechnicianLocation {
  latitude: number;
  longitude: number;
  heading: number;
  speed: number;
  updatedAt: string;
}

export function LiveTrackScreen({ route, navigation }: any): React.JSX.Element {
  // Extract route parameters safely with production fallbacks
  const { jobId, techName, techPhone } = route?.params || { 
    jobId: 'JOB-9921', 
    techName: 'Andrew Murray',
    techPhone: '+27821234567' // Fallback number for the specialist
  };

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [techLocation, setTechLocation] = useState<TechnicianLocation | null>(null);
  const [eta, setEta] = useState<number>(14); // Estimated time in minutes

  useEffect(() => {
    // 1. Establish production websocket link to backend engine
    const socket: Socket = io('https://api.myfixer.co.za', {
      transports: ['websocket'], // Forces fast websocket transport protocol layer
    });

    socket.on('connect', () => {
      console.log(`[Socket] Connected to backend grid pipeline. Socket ID: ${socket.id}`);
      setIsLoading(false);

      // 2. Instantly bind this client session into the dedicated job tracking channel room
      socket.emit('join_job_room', { jobId, role: 'client' });
    });

    // 3. Listen for live spatial updates emitted from the assigned technician app
    socket.on('job_location_changed', (data: TechnicianLocation) => {
      console.log('⚡ Real-time technician telemetry frame received:', data);
      setTechLocation(data);

      // Dynamic calculation: If technician is moving, progressively decrement estimated arrival time
      if (data.speed > 5) {
        setEta((currentEta) => (currentEta > 2 ? currentEta - 1 : 2));
      }
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection handshake failed:', error);
      setIsLoading(false); // Fails gracefully to let the UI map layout overlay stack render
    });

    // 4. Complete cleanup handling sequence to prevent memory leaks on screen exit
    return () => {
      console.log(`[Socket] Tearing down active stream conduit for job context: ${jobId}`);
      socket.off('job_location_changed');
      socket.off('connect');
      socket.off('connect_error');
      socket.disconnect();
    };
  }, [jobId]);

  const handleCallSpecialist = () => {
    // Direct trigger connection straight to the OS dialer tray
    initiateNativeCall(techPhone);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00FF87" />
        <Text style={styles.loadingText}>Connecting to Real-Time Dispatch Grid...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      
      {/* 🗺️ MAP SURFACE CONTAINER PLACEHOLDER */}
      <View style={styles.mapViewportMock}>
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
            <Text style={styles.searchingText}>Awaiting active GPS beacon signals...</Text>
          )}
        </View>
      </View>

      {/* 🎛️ FLOATING REAL-TIME TELEMETRY PANEL HUD */}
      <View style={styles.hudPanel}>
        <View style={styles.hudHeaderRow}>
          <View>
            <Text style={styles.techNameText}>{techName}</Text>
            <Text style={styles.techMetaText}>MyFixer Dispatched Specialist</Text>
          </View>
          <View style={styles.etaBadge}>
            <Text style={styles.etaNumber}>{eta}</Text>
            <Text style={styles.etaUnit}>MINS</Text>
          </View>
        </View>

        <View style={styles.telemetryMetricsRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>STATUS</Text>
            <Text style={styles.metricValueText}>
              {techLocation ? '🟢 En Route' : '🟡 Connecting...'}
            </Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>TELEMETRY UPDATES</Text>
            <Text style={styles.metricValueText}>
              {techLocation ? 'Active Live Stream' : 'Awaiting Pipeline'}
            </Text>
          </View>
        </View>

        {/* Call Communications Button */}
        <TouchableOpacity style={styles.actionButton} activeOpacity={0.8} onPress={handleCallSpecialist}>
          <Text style={styles.actionButtonText}>📞 Call Dispatched Provider</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090D14' },
  loadingContainer: { flex: 1, backgroundColor: '#090D14', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#64748B', fontSize: 14, marginTop: 12, fontWeight: '600' },
  mapViewportMock: { flex: 1, backgroundColor: '#111827', marginHorizontal: 16, marginTop: 10, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#1E293B' },
  mapGridLinesSim: { flex: 1, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  mapWatermark: { color: '#1E293B', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2, position: 'absolute', bottom: 16 },
  techMarkerPulse: { alignItems: 'center', position: 'absolute' },
  markerIcon: { fontSize: 32 },
  markerBadgeText: { color: '#00FF87', fontSize: 11, fontWeight: '700', backgroundColor: '#090D14', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#1E293B', marginTop: 4, overflow: 'hidden' },
  telemetryMiniText: { color: '#64748B', fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginTop: 2 },
  searchingText: { color: '#475569', fontSize: 13, fontWeight: '500' },
  hudPanel: { backgroundColor: '#111827', margin: 16, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#1E293B', shadowColor: '#000000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 },
  hudHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  techNameText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  techMetaText: { color: '#64748B', fontSize: 12, marginTop: 2 },
  etaBadge: { backgroundColor: '#00FF8710', borderWidth: 1, borderColor: '#00FF87', borderRadius: 12, width: 64, height: 64, justifyContent: 'center', alignItems: 'center' },
  etaNumber: { color: '#00FF87', fontSize: 22, fontWeight: '800', lineHeight: 24 },
  etaUnit: { color: '#00FF87', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  telemetryMetricsRow: { flexDirection: 'row', gap: 20, marginTop: 16, borderTopWidth: 1, borderTopColor: '#1E293B', paddingTop: 16, marginBottom: 20 },
  metricItem: { flex: 1 },
  metricLabel: { color: '#64748B', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  metricValueText: { color: '#E2E8F0', fontSize: 13, fontWeight: '600', marginTop: 4 },
  actionButton: { backgroundColor: '#1E293B', padding: 15, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  actionButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' }
});