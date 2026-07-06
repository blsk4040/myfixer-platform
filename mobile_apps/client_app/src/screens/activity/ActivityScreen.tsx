import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShieldAlert } from 'lucide-react-native';
import { LiveTrackScreen } from '../tracking/LiveTrackScreen';
import apiService, { BookingDetails } from '../../services/api.service';

export function ActivityScreen({ navigation }: any): React.JSX.Element {
  const [checkingActiveJobs, setCheckingActiveJobs] = useState<boolean>(true);
  const [activeJob, setActiveJob] = useState<BookingDetails | null>(null);

  useEffect(() => {
    let isMounted = true;

    const checkActiveClientDispatches = async () => {
      try {
        setCheckingActiveJobs(true);
        const response = await apiService.getMyActiveBooking();
        if (isMounted) setActiveJob(response.active ? response.booking : null);
      } catch {
        if (isMounted) setActiveJob(null);
      } finally {
        if (isMounted) setCheckingActiveJobs(false);
      }
    };

    void checkActiveClientDispatches();

    return () => {
      isMounted = false;
    };
  }, []);

  if (checkingActiveJobs) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00FF87" />
        <Text style={styles.syncText}>Checking your active booking...</Text>
      </View>
    );
  }

  if (activeJob) {
    const technician = activeJob.technician;
    const routeObject = {
      params: {
        bookingId: activeJob.id,
        techName: technician?.name || 'Assigned technician',
        techPhone: technician?.phone || '',
        techPhotoUrl: technician?.profilePhotoUrl || '',
        currentStatus: activeJob.status,
        lastGpsUpdate: (technician as any)?.lastGpsUpdate || activeJob.updatedAt,
      },
    };

    return <LiveTrackScreen route={routeObject} navigation={navigation} />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <View style={styles.emptyContent}>
        <View style={styles.iconContainer}>
          <ShieldAlert color="#64748B" size={40} />
        </View>
        <Text style={styles.emptyTitle}>No Active Callouts Found</Text>
        <Text style={styles.emptySubtitle}>
          You don't have a specialist dispatched to your location right now. Need something repaired?
        </Text>

        <TouchableOpacity
          style={styles.actionBtn}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.actionBtnText}>Book a Repair Fixer</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090D14' },
  centered: { flex: 1, backgroundColor: '#090D14', justifyContent: 'center', alignItems: 'center' },
  syncText: { color: '#64748B', fontSize: 13, marginTop: 12, fontWeight: '500' },
  emptyContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  iconContainer: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#111827', justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#1E293B' },
  emptyTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  emptySubtitle: { color: '#64748B', fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 20, fontWeight: '500' },
  actionBtn: { backgroundColor: '#00FF87', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12, marginTop: 28, shadowColor: '#00FF87', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 },
  actionBtnText: { color: '#090D14', fontSize: 14, fontWeight: '700' },
});
