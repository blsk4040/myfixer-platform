// src/screens/dashboard/DashboardScreen.tsx
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DashboardStats, IncomingJob, ActiveJob, UpcomingJob } from './types/dashboard';
import { useJobStore } from '../../store/useJobStore';
import { getTechnicianIdentity } from '../../services/technicianIdentity.service';
import { useSocketConnection } from '../../context/SocketContext';
import {
  acceptBookingWorkflow,
  declineBookingWorkflow,
  refreshAvailableJobs,
} from '../../services/jobWorkflow.service';

import { DashboardHeader } from './DashboardHeader';
import { StatsOverview } from './StatsOverview';
import { ActiveJobCard } from './ActiveJobCard';
import { IncomingRequestsList } from './IncomingRequestsList';
import { UpcomingBookings } from './UpcomingBookings';

export function DashboardScreen(): React.JSX.Element {
  const { isOnDuty, toggleDutyStatus, connectionStatus } = useSocketConnection();
  const [isNetworkLoading, setIsNetworkLoading] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState('');
  const technicianIdentity = getTechnicianIdentity();

  const incomingJobsGlobal = useJobStore((state) => state.incomingJobs || []);
  const activeJobsGlobal = useJobStore((state) => state.activeJobs || []);

  const incomingJobs: IncomingJob[] = incomingJobsGlobal.map((job: any) => ({
    id: job.id,
    applianceType: job.applianceType,
    faultDescription: job.faultDescription || '',
    callOutFee: job.callOutFee || job.price || 450,
    currency: job.currency || 'ZAR',
    distance: job.distance || 'Nearby',
    generalArea: job.generalArea || 'Local Area',
    hasPreciseLocation: false,
  }));

  const currentActiveTarget = Array.isArray(activeJobsGlobal) ? activeJobsGlobal[0] : activeJobsGlobal;
  const activeJob: ActiveJob | null = currentActiveTarget ? {
    id: currentActiveTarget.id,
    applianceType: currentActiveTarget.applianceType,
    faultDescription: currentActiveTarget.faultDescription || '',
    customerName: currentActiveTarget.customerName || 'Client',
    status: 'In Progress',
    distance: currentActiveTarget.distance || 'Nearby',
    fullAddress: currentActiveTarget.fullAddress || '',
    complexDetails: currentActiveTarget.complexDetails,
  } : null;

  const [stats, setStats] = useState<DashboardStats>({
    jobsToday: 0,
    completed: technicianIdentity.stats.completedJobs,
    earnings: 0,
    rating: technicianIdentity.stats.averageRating || 0,
    ratingLabel: technicianIdentity.stats.reviewCount > 0 && technicianIdentity.stats.averageRating !== null
      ? technicianIdentity.stats.averageRating.toFixed(1)
      : 'New',
  });
  const [upcomingBookings] = useState<UpcomingJob[]>([]);

  useEffect(() => {
    setStats((prev) => ({
      ...prev,
      jobsToday: activeJob ? prev.completed + 1 : prev.completed,
    }));
  }, [activeJob]);

  useEffect(() => {
    setConnectionMessage(connectionStatus === 'RECONNECTING' ? 'Server disconnected. Reconnecting...' : '');
  }, [connectionStatus]);

  useEffect(() => {
    if (!technicianIdentity.userId || !isOnDuty) return;
    refreshAvailableJobs().catch((error) => {
      console.warn('Failed to load available jobs on dashboard open:', error);
    });
  }, [technicianIdentity.userId, isOnDuty]);

  const handleDutyChange = () => {
    setIsNetworkLoading(true);
    toggleDutyStatus();
    setTimeout(() => setIsNetworkLoading(false), 250);
  };

  const handleAcceptJob = async (job: IncomingJob) => {
    const technicianId = technicianIdentity.userId;
    const storePayload = {
      id: job.id,
      applianceType: job.applianceType,
      faultDescription: job.faultDescription,
      price: job.callOutFee,
      distance: job.distance,
      generalArea: job.generalArea,
      currency: job.currency || 'ZAR',
      hasPreciseLocation: false as const,
    };

    try {
      await acceptBookingWorkflow(storePayload, technicianId);
    } catch (error: any) {
      Alert.alert('Accept Failed', error.message || 'Could not accept this booking.');
    }
  };

  const handleDeclineJob = async (id: string) => {
    try {
      await declineBookingWorkflow(id);
    } catch (error: any) {
      Alert.alert('Decline Failed', error.message || 'Could not decline this booking.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <DashboardHeader
          isOnline={isOnDuty}
          isLoading={isNetworkLoading}
          technicianName={technicianIdentity.displayName}
          onStatusChange={handleDutyChange}
        />

        <StatsOverview stats={stats} />
        <ActiveJobCard job={activeJob} />
        <IncomingRequestsList
          jobs={incomingJobs}
          isOnline={isOnDuty}
          onAccept={handleAcceptJob}
          onDecline={handleDeclineJob}
          connectionMessage={connectionMessage}
        />
        <UpcomingBookings bookings={upcomingBookings} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090D14' },
  scrollContainer: { padding: 20 },
});
