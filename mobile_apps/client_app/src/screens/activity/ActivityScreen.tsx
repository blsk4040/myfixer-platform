// mobile_apps/client_app/src/screens/activity/ActivityScreen.tsx
import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShieldAlert } from 'lucide-react-native';
import { LiveTrackScreen } from '../tracking/LiveTrackScreen';

export function ActivityScreen({ navigation }: any): React.JSX.Element {
  const [checkingActiveJobs, setCheckingActiveJobs] = useState<boolean>(true);
  const [activeJob, setActiveJob] = useState<any | null>(null);

  useEffect(() => {
    // Synchronize check with backend engine framework pipeline
    const checkActiveClientDispatches = async () => {
      try {
        setCheckingActiveJobs(true);
        
        // In production context API lookups: 
        // const res = await axios.get('/api/v1/bookings/active-current');
        // if (res.data.active) { setActiveJob(res.data.jobPayload); }
        
        setTimeout(() => {
          // 💡 TEST MECHANIC: Set to null to see the empty "No jobs" screen framework, 
          // or leave populated to see the LiveTrackScreen run automatically!
          setActiveJob({
            jobId: 'JOB-9921',
            techName: 'Andrew Murray',
            techPhone: '+27821234567'
          });
          setCheckingActiveJobs(false);
        }, 1000);
      } catch (err) {
        setCheckingActiveJobs(false);
      }
    };

    checkActiveClientDispatches();
  }, []);

  // 1. Loading Frame Layout State
  if (checkingActiveJobs) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00FF87" />
        <Text style={styles.syncText}>Checking dispatch gateway pipeline...</Text>
      </View>
    );
  }

  // 2. Active Tracking State -> Renders Live Track pipeline straight into the Tab viewport frame
  if (activeJob) {
    const mockRouteObject = {
      params: {
        jobId: activeJob.jobId,
        techName: activeJob.techName,
        techPhone: activeJob.techPhone
      }
    };
    return <LiveTrackScreen route={mockRouteObject} navigation={navigation} />;
  }

  // 3. Idle / Empty State Layout
  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <View style={styles.emptyContent}>
        <View style={styles.iconContainer}>
          <ShieldAlert color="#64748B" size={40} />
        </View>
        <Text style={styles.emptyTitle}>No Active Callouts Found</Text>
        <Text style={styles.emptySubtitle}>
          You don't have an engineering specialist dispatched to your location right now. Need something repaired?
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
  actionBtnText: { color: '#090D14', fontSize: 14, fontWeight: '700' }
});