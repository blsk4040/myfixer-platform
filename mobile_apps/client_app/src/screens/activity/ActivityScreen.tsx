import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarClock, ChevronRight, Clock3, MapPin, ShieldCheck } from 'lucide-react-native';

import TrackingScreen from '../map_tracking/TrackingScreen';
import apiService, { BookingDetails } from '../../services/api.service';
import { getProviderRoleForService } from '../../utils/providerRole';
import { BRAND } from '../../config/brand';
import { Colors, Radius, Spacing, Typography } from '../../theme';

const CalendarClockIcon = CalendarClock as any;
const ChevronRightIcon = ChevronRight as any;
const ClockIcon = Clock3 as any;
const MapPinIcon = MapPin as any;
const ShieldCheckIcon = ShieldCheck as any;

const formatBookingStatus = (status?: unknown): string =>
  String(status || 'ACTIVE')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const statusTone = (status?: unknown) => {
  const value = String(status || '').toUpperCase();
  if (value === 'PENDING') return { color: Colors.amber, background: 'rgba(255, 181, 71, 0.14)', border: 'rgba(255, 181, 71, 0.34)' };
  if (value === 'SCHEDULED') return { color: Colors.info, background: 'rgba(86, 184, 255, 0.12)', border: 'rgba(86, 184, 255, 0.3)' };
  return { color: Colors.primary, background: 'rgba(184, 255, 61, 0.12)', border: 'rgba(184, 255, 61, 0.32)' };
};

export function ActivityScreen({ navigation }: any): React.JSX.Element {
  const [checkingActiveJobs, setCheckingActiveJobs] = useState<boolean>(true);
  const [activeJobs, setActiveJobs] = useState<BookingDetails[]>([]);
  const [selectedJob, setSelectedJob] = useState<BookingDetails | null>(null);

  useEffect(() => {
    let isMounted = true;

    const checkActiveClientDispatches = async () => {
      try {
        setCheckingActiveJobs(true);
        const response = await apiService.getMyActiveBookings();
        if (isMounted) setActiveJobs(response.bookings || []);
      } catch {
        if (isMounted) setActiveJobs([]);
      } finally {
        if (isMounted) setCheckingActiveJobs(false);
      }
    };

    void checkActiveClientDispatches();

    return () => {
      isMounted = false;
    };
  }, []);

  const renderTrackingScreen = (job: BookingDetails) => {
    const routeObject = {
      params: {
        bookingId: job.id,
      },
    };

    return <TrackingScreen route={routeObject} />;
  };

  if (checkingActiveJobs) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.syncText}>Checking your active booking...</Text>
      </View>
    );
  }

  if (selectedJob) {
    return renderTrackingScreen(selectedJob);
  }

  if (activeJobs.length > 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          <View style={styles.headerCard}>
            <View style={styles.headerTop}>
              <View style={styles.brandPill}>
                <ShieldCheckIcon color={Colors.primary} size={16} />
                <Text style={styles.brandPillText}>{BRAND.name} activity</Text>
              </View>
              <View style={styles.countPill}>
                <Text style={styles.countText}>{activeJobs.length}</Text>
              </View>
            </View>
            <Text style={styles.screenTitle}>Active bookings</Text>
            <Text style={styles.screenSubtitle}>
              Track every open request separately, with its own Service Provider and live booking progress.
            </Text>
          </View>

          <View style={styles.bookingList}>
            {activeJobs.map((job) => {
              const providerRole = getProviderRoleForService(job.serviceKey, job.applianceType);
              const providerName = job.technician?.name || `Waiting for ${providerRole.singular}`;
              const tone = statusTone(job.status);

              return (
                <TouchableOpacity
                  key={job.id}
                  style={styles.bookingCard}
                  activeOpacity={0.86}
                  onPress={() => setSelectedJob(job)}
                >
                  <View style={styles.bookingCardTop}>
                    <View style={styles.bookingIcon}>
                      <ClockIcon color={tone.color} size={20} />
                    </View>
                    <View style={styles.bookingCopy}>
                      <Text style={styles.bookingLabel}>Active booking</Text>
                      <Text style={styles.bookingTitle} numberOfLines={1}>
                        {String(job.applianceType || job.serviceKey || 'Service booking')}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: tone.background, borderColor: tone.border }]}>
                      <Text style={[styles.statusBadgeText, { color: tone.color }]}>{formatBookingStatus(job.status)}</Text>
                    </View>
                  </View>

                  <View style={styles.bookingDetailRow}>
                    <ShieldCheckIcon color={Colors.textSubtle} size={15} />
                    <Text style={styles.bookingMeta} numberOfLines={1}>{providerName}</Text>
                  </View>
                  <View style={styles.bookingDetailRow}>
                    <MapPinIcon color={Colors.textSubtle} size={15} />
                    <Text style={styles.bookingAddress} numberOfLines={1}>{String(job.fullAddress || job.generalArea || 'Service address')}</Text>
                  </View>

                  <View style={styles.trackRow}>
                    <Text style={styles.trackText}>Track this booking</Text>
                    <ChevronRightIcon color={Colors.background} size={18} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.footerActions}>
            <TouchableOpacity
              style={styles.outlineBtn}
              activeOpacity={0.86}
              onPress={() => navigation.navigate('Home')}
            >
              <Text style={styles.outlineBtnText}>Book another service</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryBtn}
              activeOpacity={0.86}
              onPress={() => navigation.navigate('History')}
            >
              <Text style={styles.secondaryBtnText}>View booking history</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.emptyContent}>
        <View style={styles.brandPill}>
          <ShieldCheckIcon color={Colors.primary} size={16} />
          <Text style={styles.brandPillText}>{BRAND.name} activity</Text>
        </View>

        <View style={styles.iconContainer}>
          <CalendarClockIcon color={Colors.primary} size={38} />
        </View>

        <Text style={styles.emptyTitle}>No active booking</Text>
        <Text style={styles.emptySubtitle}>
          When a Service Provider is assigned, your live tracking and booking progress will appear here.
        </Text>

        <TouchableOpacity
          style={styles.actionBtn}
          activeOpacity={0.86}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.actionBtnText}>Find a service</Text>
          <ChevronRightIcon color={Colors.background} size={18} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          activeOpacity={0.86}
          onPress={() => navigation.navigate('History')}
        >
          <Text style={styles.secondaryBtnText}>View booking history</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  syncText: { color: Colors.textMuted, fontSize: Typography.label.fontSize, marginTop: Spacing.md, fontWeight: '600' },
  listContent: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: 132 },
  emptyContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.huge },
  headerCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xl },
  brandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  brandPillText: { color: Colors.textMuted, fontSize: Typography.caption.fontSize, fontWeight: '800' },
  countPill: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  countText: { color: Colors.background, fontSize: 15, fontWeight: '900' },
  screenTitle: { color: Colors.text, fontSize: 30, fontWeight: '900', letterSpacing: 0 },
  screenSubtitle: { color: Colors.textMuted, fontSize: 14, lineHeight: 21, fontWeight: '600', marginTop: Spacing.sm },
  bookingList: { gap: Spacing.md },
  bookingCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
  },
  bookingCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, marginBottom: Spacing.md },
  bookingIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.input,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bookingCopy: { flex: 1, minWidth: 0 },
  bookingLabel: { color: Colors.primary, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginBottom: 6 },
  bookingTitle: { color: Colors.text, fontSize: 18, fontWeight: '900' },
  statusBadge: { borderRadius: Radius.pill, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  statusBadgeText: { fontSize: 10, fontWeight: '900' },
  bookingDetailRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs },
  bookingMeta: { flex: 1, color: Colors.textMuted, fontSize: 13, fontWeight: '700' },
  bookingAddress: { flex: 1, color: Colors.textSubtle, fontSize: 12, fontWeight: '600' },
  trackRow: { minHeight: 46, borderRadius: Radius.md, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.lg },
  trackText: { color: Colors.background, fontSize: Typography.label.fontSize, fontWeight: '900' },
  footerActions: { marginTop: Spacing.xl, gap: Spacing.sm },
  outlineBtn: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.surface,
  },
  outlineBtnText: { color: Colors.text, fontSize: Typography.label.fontSize, fontWeight: '900' },
  iconContainer: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyTitle: { color: Colors.text, fontSize: 22, fontWeight: '900', letterSpacing: 0 },
  emptySubtitle: { color: Colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: Spacing.sm, lineHeight: 21, fontWeight: '600' },
  actionBtn: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.md,
    marginTop: Spacing.xxxl,
  },
  actionBtnText: { color: Colors.background, fontSize: Typography.body.fontSize, fontWeight: '900' },
  secondaryBtn: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg, marginTop: Spacing.sm },
  secondaryBtnText: { color: Colors.textMuted, fontSize: Typography.label.fontSize, fontWeight: '800' },
});
