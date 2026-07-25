// src/screens/home/HomeScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Bell,
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
import apiService, { ProviderSettlementRecord } from '../../services/api.service';
import { acceptBookingWorkflow, normalizeJobPayload } from '../../services/jobWorkflow.service';
import { BRAND } from '../../config/brand';

const BellIcon = Bell as any;
const BriefcaseIcon = Briefcase as any;
const CheckCircleIcon = CheckCircle2 as any;
const ClockIcon = Clock as any;
const MapPinIcon = MapPin as any;
const StarIcon = Star as any;
const TrendingUpIcon = TrendingUp as any;
const WifiIcon = Wifi as any;
const WifiOffIcon = WifiOff as any;
const appLogo = require('../../../assets/logo/app_logo.png');

const formatMoney = (amount = 0, currency = 'ZAR') => {
  const roundedAmount = Math.round(Number(amount) || 0);
  return `${currency === 'ZAR' ? 'R' : `${currency} `}${roundedAmount.toLocaleString()}`;
};

const startOfWeek = (date: Date): Date => {
  const start = new Date(date);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  return start;
};

const settlementActivityDate = (settlement: ProviderSettlementRecord): Date | null => {
  const rawDate = settlement.paidAt || settlement.readyForPayoutAt || settlement.completionConfirmedAt || settlement.createdAt;
  if (!rawDate) return null;
  const date = new Date(rawDate);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isPendingSettlement = (settlement: ProviderSettlementRecord): boolean =>
  settlement.status !== 'PAID' && settlement.status !== 'CANCELLED' && settlement.status !== 'REVERSED';

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
  const [settlements, setSettlements] = useState<ProviderSettlementRecord[]>([]);
  const [settlementsLoading, setSettlementsLoading] = useState(true);

  const incomingJobs = useJobStore((state) => state.incomingJobs || []);
  const activeJobs = useJobStore((state) => state.activeJobs || []);
  const completedJobs = useJobStore((state) => state.completedJobs || []);
  const earningsToday = useJobStore((state) => state.earningsToday || 0);

  const activeJob = activeJobs[0] || null;
  const visibleIncomingJobs = incomingJobs.slice(0, 3);
  const weeklySummary = useMemo(() => {
    const weekStart = startOfWeek(new Date());
    const weekSettlements = settlements.filter((settlement) => {
      const date = settlementActivityDate(settlement);
      return date !== null && date >= weekStart && settlement.status !== 'CANCELLED' && settlement.status !== 'REVERSED';
    });

    const totalAmount = weekSettlements.reduce((sum, settlement) => sum + settlement.netAmountMinor / 100, 0);
    const pendingAmount = weekSettlements
      .filter(isPendingSettlement)
      .reduce((sum, settlement) => sum + settlement.netAmountMinor / 100, 0);

    return {
      totalAmount,
      pendingAmount,
      paidAmount: Math.max(totalAmount - pendingAmount, 0),
      settlementCount: weekSettlements.length,
    };
  }, [settlements]);
  const ratingLabel = technicianIdentity.stats.reviewCount > 0 && technicianIdentity.stats.averageRating !== null
    ? technicianIdentity.stats.averageRating.toFixed(1)
    : '0.0';

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

  useEffect(() => {
    apiService.getMySettlements()
      .then((response) => setSettlements(response.settlements || []))
      .catch((error) => {
        console.warn('Failed to load Home settlement summary:', error);
      })
      .finally(() => setSettlementsLoading(false));
  }, []);

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
            <Image source={appLogo} style={styles.headerLogo} resizeMode="contain" accessibilityLabel="Padi Pro logo" />
            <Text style={styles.welcomeLabel}>Welcome back</Text>
            <Text style={styles.technicianName} numberOfLines={1}>
              {technicianIdentity.displayName}
            </Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.alertButton}
              onPress={() => navigation.navigate('Alerts')}
              accessibilityRole="button"
              accessibilityLabel="Open alerts"
            >
              <BellIcon color="#F7F7F5" size={19} />
            </TouchableOpacity>
            <View style={styles.liveControl}>
              <Text style={[styles.liveText, isOnDuty && styles.liveTextActive]}>
                {isOnDuty ? 'Live' : 'Go Live'}
              </Text>
              <Switch
                value={isOnDuty}
                onValueChange={toggleDutyStatus}
                trackColor={{ false: '#303036', true: 'rgba(184, 255, 61, 0.28)' }}
                thumbColor={isOnDuty ? '#B8FF3D' : '#A7A7AD'}
              />
            </View>
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
              <WifiIcon color="#B8FF3D" size={15} />
            ) : (
              <WifiOffIcon color="#FF5D5D" size={15} />
            )}
            <Text style={styles.connectionText}>{connectionLabel}</Text>
            <Text style={styles.connectionDivider}>•</Text>
            <MapPinIcon color={isOnDuty ? '#B8FF3D' : '#74747C'} size={15} />
            <Text style={styles.connectionText}>
              {isOnDuty ? 'Location sharing active while live' : 'Location sharing paused'}
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <BriefcaseIcon color="#38BDF8" size={18} />
            <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {activeJobs.length + completedJobs.length}
            </Text>
            <Text style={styles.statLabel}>Jobs Today</Text>
          </View>
          <View style={styles.statCard}>
            <CheckCircleIcon color="#B8FF3D" size={18} />
            <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {completedJobs.length}
            </Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statCard}>
            <TrendingUpIcon color="#B8FF3D" size={18} />
            <Text style={[styles.statValue, styles.statMoneyValue]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
              {formatMoney(earningsToday)}
            </Text>
            <Text style={styles.statLabel}>Earnings</Text>
          </View>
          <View style={styles.statCard}>
            <StarIcon color="#FBBF24" size={18} />
            <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {ratingLabel}
            </Text>
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
              <MapPinIcon color="#B8FF3D" size={14} />
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
            <ClockIcon color="#74747C" size={26} />
            <Text style={styles.emptyTitle}>No active job right now</Text>
            <Text style={styles.emptyBody}>
              Accepted jobs will appear here with your next action.
            </Text>
          </View>
        )}

        {isOnDuty && (
          <>
            <Text style={styles.sectionTitle}>Incoming Requests</Text>
            {visibleIncomingJobs.length === 0 ? (
              <View style={styles.emptyCard}>
                <ActivityIndicator size="small" color="#B8FF3D" />
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
                  <Text style={styles.requestPrice} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
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
          </>
        )}

        <View style={styles.weekCard}>
          <View style={styles.weekHeader}>
            <View>
              <Text style={styles.weekTitle}>This Week</Text>
              <Text style={styles.weekSubtitle}>
                {weeklySummary.settlementCount === 1 ? '1 settlement' : `${weeklySummary.settlementCount} settlements`}
              </Text>
            </View>
            {settlementsLoading ? (
              <ActivityIndicator size="small" color="#B8FF3D" />
            ) : (
              <Text style={styles.weekAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                {formatMoney(weeklySummary.totalAmount, technicianIdentity.currency)}
              </Text>
            )}
          </View>
          <View style={styles.weekBreakdown}>
            <View style={styles.weekBreakdownItem}>
              <Text style={styles.weekBreakdownLabel}>Paid</Text>
              <Text style={styles.weekBreakdownValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                {formatMoney(weeklySummary.paidAmount, technicianIdentity.currency)}
              </Text>
            </View>
            <View style={styles.weekDivider} />
            <View style={styles.weekBreakdownItem}>
              <Text style={styles.weekBreakdownLabel}>Pending clearance</Text>
              <Text style={styles.weekBreakdownValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                {formatMoney(weeklySummary.pendingAmount, technicianIdentity.currency)}
              </Text>
            </View>
          </View>
          <Text style={styles.weekHint}>
            Confirmed jobs and admin-reviewed settlements update this weekly summary.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0B0D' },
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
  headerLogo: { width: 92, height: 40, marginBottom: 6 },
  welcomeLabel: { color: '#A7A7AD', fontSize: 13, fontWeight: '700' },
  technicianName: { color: '#F7F7F5', fontSize: 24, fontWeight: '900', marginTop: 2 },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alertButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#17171A',
    borderWidth: 1,
    borderColor: '#303036',
  },
  liveControl: {
    minWidth: 116,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: '#17171A',
    borderWidth: 1,
    borderColor: '#303036',
    borderRadius: 14,
    paddingLeft: 12,
    paddingRight: 4,
  },
  liveText: { color: '#A7A7AD', fontSize: 12, fontWeight: '800' },
  liveTextActive: { color: '#B8FF3D' },

  statusCard: {
    backgroundColor: '#17171A',
    borderWidth: 1,
    borderColor: '#303036',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  statusCardActive: { borderColor: 'rgba(184, 255, 61, 0.35)', backgroundColor: 'rgba(184, 255, 61, 0.05)' },
  statusTopRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  statusTitle: { color: '#F7F7F5', fontSize: 16, fontWeight: '800' },
  statusSubtitle: { color: '#A7A7AD', fontSize: 12, lineHeight: 18, marginTop: 4 },
  statusPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#222226',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusPillActive: { backgroundColor: 'rgba(184, 255, 61, 0.14)' },
  statusPillText: { color: '#A7A7AD', fontSize: 10, fontWeight: '900' },
  statusPillTextActive: { color: '#B8FF3D' },
  connectionRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7, marginTop: 14 },
  connectionText: { color: '#A7A7AD', fontSize: 12, fontWeight: '600' },
  connectionDivider: { color: '#303036', fontSize: 12, fontWeight: '900' },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 22 },
  statCard: {
    flex: 1,
    minHeight: 92,
    backgroundColor: '#17171A',
    borderWidth: 1,
    borderColor: '#303036',
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  statValue: { color: '#F7F7F5', fontSize: 16, fontWeight: '900', textAlign: 'center' },
  statMoneyValue: { fontSize: 13 },
  statLabel: { color: '#74747C', fontSize: 10, fontWeight: '700', textAlign: 'center' },

  sectionTitle: {
    color: '#F7F7F5',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 8,
  },

  activeJobCard: {
    backgroundColor: '#17171A',
    borderWidth: 1,
    borderColor: '#B8FF3D44',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  activeJobTitle: { color: '#F7F7F5', fontSize: 17, fontWeight: '900' },
  activeJobMeta: { color: '#A7A7AD', fontSize: 12, fontWeight: '600', marginTop: 3 },
  stageBadge: {
    backgroundColor: '#B8FF3D22',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  stageBadgeText: { color: '#B8FF3D', fontSize: 10, fontWeight: '900' },
  locationLine: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 14 },
  locationText: { flex: 1, color: '#B9B9BF', fontSize: 12, fontWeight: '600' },
  primaryButton: {
    height: 44,
    borderRadius: 12,
    backgroundColor: '#B8FF3D',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  primaryButtonText: { color: '#0B0B0D', fontSize: 13, fontWeight: '900' },

  emptyCard: {
    backgroundColor: '#17171A',
    borderWidth: 1,
    borderColor: '#303036',
    borderRadius: 16,
    padding: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { color: '#F7F7F5', fontSize: 14, fontWeight: '800', marginTop: 10 },
  emptyBody: { color: '#74747C', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 4 },

  incomingStack: { gap: 10, marginBottom: 16 },
  requestCard: {
    backgroundColor: '#17171A',
    borderWidth: 1,
    borderColor: '#303036',
    borderRadius: 16,
    padding: 16,
  },
  requestTitle: { color: '#F7F7F5', fontSize: 15, fontWeight: '900' },
  requestMeta: { color: '#B9B9BF', fontSize: 12, fontWeight: '600', marginTop: 3 },
  requestPrice: { color: '#B8FF3D', fontSize: 16, fontWeight: '900' },
  requestDescription: { color: '#B9B9BF', fontSize: 12, lineHeight: 18, marginTop: 12 },
  requestActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  declineButton: {
    flex: 1,
    height: 42,
    backgroundColor: '#222226',
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineButtonText: { color: '#B9B9BF', fontSize: 12, fontWeight: '900' },
  acceptButton: {
    flex: 2,
    height: 42,
    backgroundColor: '#B8FF3D',
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButtonText: { color: '#0B0B0D', fontSize: 12, fontWeight: '900' },

  weekCard: {
    backgroundColor: '#17171A',
    borderWidth: 1,
    borderColor: '#303036',
    borderRadius: 16,
    padding: 16,
    marginTop: 4,
  },
  weekHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  weekTitle: { color: '#F7F7F5', fontSize: 15, fontWeight: '900' },
  weekSubtitle: { color: '#B9B9BF', fontSize: 12, fontWeight: '700', marginTop: 3 },
  weekAmount: { flexShrink: 1, color: '#B8FF3D', fontSize: 20, fontWeight: '900', textAlign: 'right' },
  weekBreakdown: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  weekBreakdownItem: { flex: 1 },
  weekBreakdownLabel: { color: '#74747C', fontSize: 11, fontWeight: '800', marginBottom: 4 },
  weekBreakdownValue: { color: '#F7F7F5', fontSize: 14, fontWeight: '900', textAlign: 'center' },
  weekDivider: { width: 1, height: 34, backgroundColor: '#303036', marginHorizontal: 14 },
  weekHint: { color: '#74747C', fontSize: 12, fontWeight: '600', lineHeight: 18, marginTop: 12 },
});
