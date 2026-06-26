// src/screens/home/HomeScreen.tsx
import React from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  Dimensions,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Briefcase, 
  Map, 
  TrendingUp, 
  Shield, 
  Power,
  ChevronRight,
  Clock
} from 'lucide-react-native';
import { useSocketConnection } from '../../context/SocketContext';

// Clean type casting for Lucide icons to eliminate SVGSVGElement issues
const BriefcaseIcon = Briefcase as any;
const MapIcon = Map as any;
const TrendingUpIcon = TrendingUp as any;
const ShieldIcon = Shield as any;
const PowerIcon = Power as any;
const ChevronRightIcon = ChevronRight as any;
const ClockIcon = Clock as any;

export function HomeScreen({ navigation }: any): React.JSX.Element {
  // ✅ FIX: Single unified extraction line from global telemetry context
  const { isConnected, isOnDuty, toggleDutyStatus } = useSocketConnection();

  // Mocked state tracking live workspace parameters for the region
  const activeIncomingJobs = [
    {
      id: 'job_01',
      category: 'Appliance Repair',
      subCategory: 'Fridge Repair',
      distance: '2.4 km away',
      basePrice: 450,
      timeString: 'Received 2m ago'
    },
    {
      id: 'job_02',
      category: 'Electrical Work',
      subCategory: 'Fault Finding / Tripping',
      distance: '5.1 km away',
      basePrice: 450,
      timeString: 'Received 7m ago'
    }
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        {/* Top Operational Identity Header */}
        <View style={styles.headerHero}>
          <View>
            <Text style={styles.brandTitle}>MyFixer <Text style={styles.proAccent}>Pro</Text></Text>
            <Text style={styles.welcomeSubtitle}>Technician Workstation Terminal</Text>
          </View>
          <View style={[styles.networkBadge, { borderColor: isConnected ? '#00FF8730' : '#EF444430' }]}>
            <View style={[styles.networkDot, { backgroundColor: isConnected ? '#00FF87' : '#EF4444' }]} />
            <Text style={[styles.networkText, { color: isConnected ? '#00FF87' : '#EF4444' }]}>
              {isConnected ? 'Live Sync' : 'Offline'}
            </Text>
          </View>
        </View>

        {/* Master Duty Status Control Switcher Banner */}
        <TouchableOpacity 
          style={[styles.dutyCard, isOnDuty && styles.dutyCardActive]} 
          activeOpacity={0.9}
          onPress={toggleDutyStatus}
        >
          <View style={styles.dutyLeftLayout}>
            <View style={[styles.dutyPowerCircle, { backgroundColor: isOnDuty ? '#00FF8715' : '#1E293B' }]}>
              <PowerIcon color={isOnDuty ? '#00FF87' : '#64748B'} size={22} strokeWidth={2.5} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.dutyStateTitle}>{isOnDuty ? 'You are Live On-Duty' : 'You are currently Off-Duty'}</Text>
              <Text style={styles.dutyStateSubtitle}>
                {isOnDuty ? 'Scanning radar for incoming local job dispatches...' : 'Go online to begin receiving client bookings'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Quick Shift Stats Matrix Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statTile}>
            <TrendingUpIcon color="#00FF87" size={18} />
            <Text style={styles.statValue}>R0.00</Text>
            <Text style={styles.statLabel}>Today's Earnings</Text>
          </View>
          <View style={styles.statTile}>
            <BriefcaseIcon color="#38BDF8" size={18} />
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Completed Jobs</Text>
          </View>
        </View>

        {/* Live Incoming Jobs Radar Stack */}
        <Text style={styles.sectionTitle}>Available Dispatch Radar</Text>
        
        {!isOnDuty ? (
          <View style={styles.emptyRadarContainer}>
            <ClockIcon color="#334155" size={32} />
            <Text style={styles.emptyRadarText}>Radar is disabled while Off-Duty</Text>
          </View>
        ) : activeIncomingJobs.length === 0 ? (
          <View style={styles.emptyRadarContainer}>
            <ActivityIndicator size="small" color="#00FF87" style={{ marginBottom: 10 }} />
            <Text style={styles.emptyRadarText}>Scanning for nearby client allocations...</Text>
          </View>
        ) : (
          <View style={styles.jobStack}>
            {activeIncomingJobs.map((job) => (
              <TouchableOpacity 
                key={job.id} 
                style={styles.jobCard}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('Jobs', { jobId: job.id })}
              >
                {/* ✅ FIX: Swapped out raw HTML <div> elements for native layout components */}
                <View style={styles.jobMetaLeft}>
                  <Text style={styles.jobCategoryText}>{job.category}</Text>
                  <Text style={styles.jobSubCategoryText}>{job.subCategory}</Text>
                  <View style={styles.distanceBadgeRow}>
                    <MapIcon color="#64748B" size={12} />
                    <Text style={styles.distanceText}>{job.distance} • {job.timeString}</Text>
                  </View>
                </View>
                <View style={styles.jobActionRight}>
                  <Text style={styles.jobPrice}>R{job.basePrice}</Text>
                  <ChevronRightIcon color="#64748B" size={16} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Platform Compliance Trust Banner */}
        <View style={styles.trustBanner}>
          <ShieldIcon color="#64748B" size={16} />
          <View style={{ flex: 1 }}>
            <Text style={styles.trustTitle}>Secure Telemetry Verified</Text>
            <Text style={styles.trustBody}>
              Your location tracking data is managed securely under platform compliance rules strictly while active on shift.
            </Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090D14' },
  scrollContainer: { padding: 20, paddingBottom: 40 },
  headerHero: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, marginTop: 10 },
  brandTitle: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  proAccent: { color: '#00FF87' },
  welcomeSubtitle: { color: '#64748B', fontSize: 14, marginTop: 4 },
  
  networkBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: '#111827' },
  networkDot: { width: 6, height: 6, borderRadius: 3 },
  networkText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },

  dutyCard: { backgroundColor: '#111827', borderWidth: 1, borderColor: '#1E293B', borderRadius: 16, padding: 18, marginBottom: 20 },
  dutyCardActive: { borderColor: '#00FF8735', backgroundColor: '#00FF8705' },
  dutyLeftLayout: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  dutyPowerCircle: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  dutyStateTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  dutyStateSubtitle: { color: '#64748B', fontSize: 12, marginTop: 3, lineHeight: 16 },

  statsGrid: { flexDirection: 'row', gap: 12, marginBottom: 28 },
  statTile: { flex: 1, backgroundColor: '#111827', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#1E293B', gap: 6 },
  statValue: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', marginTop: 4 },
  statLabel: { color: '#64748B', fontSize: 12, fontWeight: '500' },

  sectionTitle: { color: '#E2E8F0', fontSize: 13, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 14 },
  
  emptyRadarContainer: { backgroundColor: '#111827', borderRadius: 16, borderWidth: 1, borderColor: '#1E293B', padding: 40, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyRadarText: { color: '#64748B', fontSize: 13, fontWeight: '600', textAlign: 'center' },

  jobStack: { gap: 10 },
  jobCard: { backgroundColor: '#111827', borderRadius: 16, borderWidth: 1, borderColor: '#1E293B', padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  jobMetaLeft: { gap: 4, flex: 1 },
  jobCategoryText: { color: '#64748B', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  jobSubCategoryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  distanceBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  distanceText: { color: '#64748B', fontSize: 12, fontWeight: '500' },
  jobActionRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  jobPrice: { color: '#00FF87', fontSize: 16, fontWeight: '800' },

  trustBanner: { flexDirection: 'row', gap: 12, backgroundColor: '#111827', borderRadius: 16, padding: 16, marginTop: 24, borderWidth: 1, borderColor: '#1E293B', alignItems: 'center' },
  trustTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  trustBody: { color: '#64748B', fontSize: 12, marginTop: 2, lineHeight: 16 }
});