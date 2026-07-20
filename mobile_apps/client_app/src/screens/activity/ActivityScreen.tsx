import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarClock, ChevronRight, ShieldCheck } from 'lucide-react-native';

import { LiveTrackScreen } from '../tracking/LiveTrackScreen';
import apiService, { BookingDetails } from '../../services/api.service';
import { getProviderRoleForService } from '../../utils/providerRole';
import { BRAND } from '../../config/brand';
import { Colors, Radius, Spacing, Typography } from '../../theme';

const CalendarClockIcon = CalendarClock as any;
const ChevronRightIcon = ChevronRight as any;
const ShieldCheckIcon = ShieldCheck as any;

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
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.syncText}>Checking your active booking...</Text>
      </View>
    );
  }

  if (activeJob) {
    const technician = activeJob.technician;
    const providerRole = getProviderRoleForService(activeJob.serviceKey, activeJob.applianceType);
    const routeObject = {
      params: {
        bookingId: activeJob.id,
        techName: technician?.name || `Assigned ${providerRole.singular}`,
        techPhone: technician?.phone || '',
        techPhotoUrl: technician?.profilePhotoUrl || '',
        providerRole: providerRole.singular,
        providerRoleCapitalized: providerRole.capitalized,
        serviceKey: activeJob.serviceKey,
        applianceType: activeJob.applianceType,
        currentStatus: activeJob.status,
        lastGpsUpdate: (technician as any)?.lastGpsUpdate || activeJob.updatedAt,
      },
    };

    return <LiveTrackScreen route={routeObject} navigation={navigation} />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
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
          When a professional is assigned, your live tracking, quote, payment, and completion steps will appear here.
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
  emptyContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.huge },
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
    marginBottom: Spacing.xl,
  },
  brandPillText: { color: Colors.textMuted, fontSize: Typography.caption.fontSize, fontWeight: '800' },
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
