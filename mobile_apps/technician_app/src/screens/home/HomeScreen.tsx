// src/screens/home/HomeScreen.tsx
import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Briefcase,
  CheckCircle2,
  Clock,
  MapPin,
  Star,
  TrendingUp,
  Wifi,
  WifiOff,
} from 'lucide-react-native';

import { useSocketConnection } from '../../context/SocketContext';
import { getTechnicianIdentity } from '../../services/technicianIdentity.service';
import { useJobStore } from '../../store/useJobStore';
import apiService from '../../services/api.service';
import { acceptBookingWorkflow, normalizeJobPayload } from '../../services/jobWorkflow.service';

const BriefcaseIcon = Briefcase as any;
const CheckCircleIcon = CheckCircle2 as any;
const ClockIcon = Clock as any;
const MapPinIcon = MapPin as any;
const StarIcon = Star as any;
const TrendingUpIcon = TrendingUp as any;
const WifiIcon = Wifi as any;
const WifiOffIcon = WifiOff as any;

const DAILY_GOAL = 1500;

const formatMoney = (amount = 0, currency = 'ZAR') => {
  const roundedAmount = Math.round(Number(amount) || 0);
  return `${currency === 'ZAR' ? 'R' : `${currency} `}${roundedAmount.toLocaleString()}`;
};

const getStageLabel = (status?: string) => {
  switch (status) {
    case 'ACCEPTED':
      return 'Accepted';
    case 'IN_ROUTE':
      return 'On my way';
    case 'ARRIVED':
      return 'Arrived';
    case 'IN_PROGRESS':
      return 'In progress';
    case 'DIAGNOSTIC_DONE':
      return 'In progress';
    case 'COMPLETED':
      return 'Completed';
    default:
      return 'In progress';
  }
};

export function HomeScreen({ navigation }: any): React.JSX.Element {
  const { isConnected, connectionStatus, isOnDuty, toggleDutyStatus } = useSocketConnection();
  const technicianIdentity = getTechnicianIdentity();

  const incomingJobs = useJobStore((state) => state.incomingJobs || []);
  const activeJobs = useJobStore((state) => state.activeJobs || []);
  const completedJobs = useJobStore((state) => state.completedJobs || []);
  const earningsToday = useJobStore((state) => state.earningsToday || 0);

  const activeJob = activeJobs[0] || null;
  const visibleIncomingJobs = incomingJobs.slice(0, 3);
  const goalProgress = Math.min(100, Math.round((earningsToday / DAILY_GOAL) * 100));

  useEffect(() => {
    const loadAvailableJobs = async () => {
      if (!isOnDuty) return;

      try {
        const response = await apiService.getAvailableJobsForTechnician();

        if (Array.isArray(response.jobs)) {
          useJobStore.setState({
            incomingJobs: response.jobs.map(normalizeJobPayload),
          });
        }
      } catch (error) {
        console.warn('Failed to load Home available jobs:', error);
      }
    };

    void loadAvailableJobs();
  }, [isOnDuty]);

  const handleAcceptJob = async (job: any) => {
    try {
      await acceptBookingWorkflow(job, technicianIdentity.userId);

      Alert.alert('Job accepted', 'You can now open the job and start your next step.');
      navigation.navigate('Jobs', { jobId: job.id });
    } catch (error: any) {
      Alert.alert('Accept failed', error?.message || 'Could not accept this job.');
    }
  };

  const handleDeclineJob = async (job: any) => {
    try {
      await apiService.declineBooking(job.id);
      useJobStore.getState().declineJob(job.id);
    } catch (error: any) {
      Alert.alert('Decline failed', error?.message || 'Could not decline this job.');
    }
  };

  const connectionLabel = connectionStatus === 'RECONNECTING'
    ? 'Reconnecting'
    : isConnected
      ? 'Connected'
      : 'Disconnected';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={styles.headerTextBlock}>
            <Text style={styles.welcomeLabel}>Welcome,</Text>
            <Text style={styles.technicianName} numberOfLines={1}>
              {technicianIdentity.displayName}
            </Text>
          </View>

          <View style={styles.liveControl}>
            <Text style={[styles.liveText, isOnDuty && styles.liveTextActive]}>
              {isOnDuty ? 'Live' : 'Go Live'}
            </Text>
            <Switch
              value={isOnDuty}
              onValueChange={toggleDutyStatus}
              trackColor={{ false: '#1E293B', true: '#00FF8730' }}
              thumbColor={isOnDuty ? '#00FF87' : '#94A3B8'}
            />
          </View>
        </View>

        <View style={[styles.statusCard, isOnDuty && styles.statusCardActive]}>
          <View style={styles.statusTopRow}>
            <View>
              <Text style={styles.statusTitle}>
                {isOnDuty ? 'You are live and receiving jobs' : 'You are offline'}
              </Text>
              <Text style={styles.statusSubtitle}>
                {isOnDuty
                  ? 'Stay nearby and keep your location active for new requests.'
                  : 'Go live when you are ready to receive nearby bookings.'}
              </Text>
            </View>
            <View style={[styles.statusPill, isOnDuty && styles.statusPillActive]}>
              <Text style={[styles.statusPillText, isOnDuty && styles.statusPillTextActive]}>
                {isOnDuty ? 'On Duty' : 'Off Duty'}
              </Text>
            </View>
          </View>

          <View style={styles.connectionRow}>
            {isConnected ? (
              <WifiIcon color="#00FF87" size={15} />
            ) : (
              <WifiOffIcon color="#EF4444" size={15} />
            )}
            <Text style={styles.connectionText}>{connectionLabel}</Text>
            <Text style={styles.connectionDivider}>•</Text>
            <MapPinIcon color={isOnDuty ? '#00FF87' : '#64748B'} size={15} />
            <Text style={styles.connectionText}>
              {isOnDuty ? 'Location sharing active while live' : 'Location sharing paused'}
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <BriefcaseIcon color="#38BDF8" size={18} />
            <Text style={styles.statValue}>{activeJobs.length + completedJobs.length}</Text>
            <Text style={styles.statLabel}>Jobs Today</Text>
          </View>
          <View style={styles.statCard}>
            <CheckCircleIcon color="#00FF87" size={18} />
            <Text style={styles.statValue}>{completedJobs.length}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statCard}>
            <TrendingUpIcon color="#00FF87" size={18} />
            <Text style={styles.statValue}>{formatMoney(earningsToday)}</Text>
            <Text style={styles.statLabel}>Earnings</Text>
          </View>
          <View style={styles.statCard}>
            <StarIcon color="#FBBF24" size={18} />
            <Text style={styles.statValue}>5.0</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Active Job</Text>
        {activeJob ? (
          <View style={styles.activeJobCard}>
            <View style={styles.cardHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.activeJobTitle}>{activeJob.applianceType}</Text>
                <Text style={styles.activeJobMeta}>
                  Client: {activeJob.customerName || 'Client'}
                </Text>
              </View>
              <View style={styles.stageBadge}>
                <Text style={styles.stageBadgeText}>{getStageLabel(activeJob.jobStatus)}</Text>
              </View>
            </View>

            <View style={styles.locationLine}>
              <MapPinIcon color="#00FF87" size={14} />
              <Text style={styles.locationText} numberOfLines={1}>
                {activeJob.fullAddress || activeJob.generalArea || 'Address will appear here'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate('Jobs', { jobId: activeJob.id })}
            >
              <Text style={styles.primaryButtonText}>Open Job</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <ClockIcon color="#64748B" size={26} />
            <Text style={styles.emptyTitle}>No active job right now</Text>
            <Text style={styles.emptyBody}>
              Accepted jobs will appear here with your next action.
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Incoming Requests</Text>
        {!isOnDuty ? (
          <View style={styles.emptyCard}>
            <BriefcaseIcon color="#64748B" size={26} />
            <Text style={styles.emptyTitle}>Go live to receive requests</Text>
            <Text style={styles.emptyBody}>
              New nearby jobs will appear here when your shift is live.
            </Text>
          </View>
        ) : visibleIncomingJobs.length === 0 ? (
          <View style={styles.emptyCard}>
            <ActivityIndicator size="small" color="#00FF87" />
            <Text style={styles.emptyTitle}>No nearby requests yet</Text>
            <Text style={styles.emptyBody}>
              Stay live and keep the app open for new bookings.
            </Text>
          </View>
        ) : (
          <View style={styles.incomingStack}>
            {visibleIncomingJobs.map((job: any) => (
              <View key={job.id} style={styles.requestCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.requestTitle}>{job.applianceType}</Text>
                    <Text style={styles.requestMeta}>
                      {job.generalArea || 'Local area'} • {job.distance || 'Nearby'}
                    </Text>
                  </View>
                  <Text style={styles.requestPrice}>
                    {formatMoney(job.price, job.currency)}
                  </Text>
                </View>

                <Text style={styles.requestDescription} numberOfLines={2}>
                  {job.faultDescription || 'Client has requested help with this service.'}
                </Text>

                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={styles.declineButton}
                    onPress={() => handleDeclineJob(job)}
                  >
                    <Text style={styles.declineButtonText}>Decline</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={() => handleAcceptJob(job)}
                  >
                    <Text style={styles.acceptButtonText}>Accept Job</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.goalCard}>
          <View style={styles.goalHeader}>
            <View>
              <Text style={styles.goalTitle}>Today's Goal</Text>
              <Text style={styles.goalSubtitle}>
                {formatMoney(earningsToday)} / {formatMoney(DAILY_GOAL)}
              </Text>
            </View>
            <Text style={styles.goalPercent}>{goalProgress}%</Text>
          </View>
          <View style={styles.goalTrack}>
            <View style={[styles.goalFill, { width: `${goalProgress}%` as any }]} />
          </View>
          <Text style={styles.goalHint}>
            {earningsToday >= DAILY_GOAL
              ? 'Goal reached. Nice shift.'
              : `${formatMoney(DAILY_GOAL - earningsToday)} away from your daily target.`}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090D14' },
  scrollContainer: { padding: 20, paddingBottom: 96 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginTop: 8,
    marginBottom: 20,
  },
  headerTextBlock: { flex: 1 },
  welcomeLabel: { color: '#64748B', fontSize: 13, fontWeight: '700' },
  technicianName: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', marginTop: 2 },
  liveControl: {
    minWidth: 116,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 14,
    paddingLeft: 12,
    paddingRight: 4,
  },
  liveText: { color: '#94A3B8', fontSize: 12, fontWeight: '800' },
  liveTextActive: { color: '#00FF87' },

  statusCard: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  statusCardActive: { borderColor: '#00FF8735', backgroundColor: '#00FF8705' },
  statusTopRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  statusTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  statusSubtitle: { color: '#94A3B8', fontSize: 12, lineHeight: 18, marginTop: 4 },
  statusPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#1E293B',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusPillActive: { backgroundColor: '#00FF8720' },
  statusPillText: { color: '#94A3B8', fontSize: 10, fontWeight: '900' },
  statusPillTextActive: { color: '#00FF87' },
  connectionRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7, marginTop: 14 },
  connectionText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  connectionDivider: { color: '#334155', fontSize: 12, fontWeight: '900' },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 22 },
  statCard: {
    flex: 1,
    minHeight: 92,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 14,
    padding: 10,
    justifyContent: 'space-between',
  },
  statValue: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  statLabel: { color: '#64748B', fontSize: 10, fontWeight: '700' },

  sectionTitle: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 8,
  },

  activeJobCard: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#00FF8735',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  activeJobTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  activeJobMeta: { color: '#94A3B8', fontSize: 12, fontWeight: '600', marginTop: 3 },
  stageBadge: {
    backgroundColor: '#00FF8720',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  stageBadgeText: { color: '#00FF87', fontSize: 10, fontWeight: '900' },
  locationLine: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 14 },
  locationText: { flex: 1, color: '#CBD5E1', fontSize: 12, fontWeight: '600' },
  primaryButton: {
    height: 44,
    borderRadius: 12,
    backgroundColor: '#00FF87',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  primaryButtonText: { color: '#090D14', fontSize: 13, fontWeight: '900' },

  emptyCard: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 16,
    padding: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', marginTop: 10 },
  emptyBody: { color: '#64748B', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 4 },

  incomingStack: { gap: 10, marginBottom: 16 },
  requestCard: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
  },
  requestTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  requestMeta: { color: '#94A3B8', fontSize: 12, fontWeight: '600', marginTop: 3 },
  requestPrice: { color: '#00FF87', fontSize: 16, fontWeight: '900' },
  requestDescription: { color: '#CBD5E1', fontSize: 12, lineHeight: 18, marginTop: 12 },
  requestActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  declineButton: {
    flex: 1,
    height: 42,
    backgroundColor: '#1E293B',
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineButtonText: { color: '#CBD5E1', fontSize: 12, fontWeight: '900' },
  acceptButton: {
    flex: 2,
    height: 42,
    backgroundColor: '#00FF87',
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButtonText: { color: '#090D14', fontSize: 12, fontWeight: '900' },

  goalCard: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginTop: 4,
  },
  goalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  goalTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  goalSubtitle: { color: '#94A3B8', fontSize: 12, fontWeight: '700', marginTop: 3 },
  goalPercent: { color: '#00FF87', fontSize: 18, fontWeight: '900' },
  goalTrack: { height: 7, backgroundColor: '#1E293B', borderRadius: 999, overflow: 'hidden', marginTop: 14 },
  goalFill: { height: '100%', backgroundColor: '#00FF87', borderRadius: 999 },
  goalHint: { color: '#64748B', fontSize: 12, fontWeight: '600', marginTop: 10 },
});
