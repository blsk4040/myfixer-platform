// src/screens/dashboard/DashboardScreen.tsx
import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Import local type definitions
import { DashboardStats, IncomingJob, ActiveJob, UpcomingJob } from './types/dashboard';

// Import service hooks and global store connections
import { techSocketService } from '../../services/tech_socket.service';
import { TrackingService } from '../../services/TrackingService';
import { useJobStore } from '../../store/useJobStore'; 

// Import child views
import { DashboardHeader } from './DashboardHeader';
import { StatsOverview } from './StatsOverview';
import { ActiveJobCard } from './ActiveJobCard';
import { IncomingRequestsList } from './IncomingRequestsList';
import { UpcomingBookings } from './UpcomingBookings';

const MOCK_TECHNICIAN_ID = 'tech_drew_001';

export function DashboardScreen(): React.JSX.Element {
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [isNetworkLoading, setIsNetworkLoading] = useState<boolean>(false);

  // Zustand bindings matching your exact store types
  const incomingJobsGlobal = useJobStore((state) => state.incomingJobs || []) as any[];
  
  // FIX 1: Read 'activeJobs' from store state structure instead of 'activeJob'
  const activeJobsGlobal = useJobStore((state) => (state as any).activeJobs);
  const acceptJobGlobal = useJobStore((state) => state.acceptJob);
  const declineJobGlobal = useJobStore((state) => state.declineJob);

  // Cast store data cleanly to your specific Dashboard UI types
  const incomingJobs: IncomingJob[] = incomingJobsGlobal.map(job => ({
    id: job.id,
    applianceType: job.applianceType,
    faultDescription: job.faultDescription || '',
    callOutFee: job.callOutFee || job.price || 450,
    distance: job.distance || 'Nearby',
    generalArea: job.generalArea || 'Local Area',
    customerName: job.customerName || 'Client',
    fullAddress: job.fullAddress || '',
    complexDetails: job.complexDetails
  }));

  // Safely extract the primary current job from your active assignments collection state
  const currentActiveTarget = Array.isArray(activeJobsGlobal) 
    ? activeJobsGlobal[0] 
    : activeJobsGlobal;

  const activeJob: ActiveJob | null = currentActiveTarget ? {
    id: currentActiveTarget.id,
    applianceType: currentActiveTarget.applianceType,
    faultDescription: currentActiveTarget.faultDescription || '',
    customerName: currentActiveTarget.customerName || 'Client',
    status: 'In Progress',
    distance: currentActiveTarget.distance || 'Nearby',
    fullAddress: currentActiveTarget.fullAddress || '',
    complexDetails: currentActiveTarget.complexDetails
  } : null;

  const [stats, setStats] = useState<DashboardStats>({
    jobsToday: 0,
    completed: 0,
    earnings: 0.00,
    rating: 5.0,
  });
  const [upcomingBookings] = useState<UpcomingJob[]>([]);

  useEffect(() => {
    setStats((prev) => ({
      ...prev,
      jobsToday: activeJob ? prev.completed + 1 : prev.completed
    }));
  }, [activeJob]);

  useEffect(() => {
    let unsubscribeIncomingListener: (() => void) | null = null;

    const toggleOnlineStatus = async () => {
      setIsNetworkLoading(true);
      if (isOnline) {
        try {
          techSocketService.initializeConnection(MOCK_TECHNICIAN_ID);

          unsubscribeIncomingListener = techSocketService.onIncomingRequest((payload: any) => {
            console.log('📬 Live Booking Ping Received!', payload);
            
            // TYPE FIX: Format directly to compliance layout matching the store rules (JobPayload)
            const storeJobPayload = {
              id: payload.bookingId || String(Date.now()),
              applianceType: payload.applianceType || 'Unknown Appliance',
              faultDescription: payload.faultDescription || 'No description provided.',
              price: Number(payload.callOutFee || payload.price) || 450, 
              distance: payload.distance || 'Nearby',
              generalArea: payload.generalArea || 'Local Area',
              customerName: payload.customerName || 'Client',
              fullAddress: payload.fullAddress || 'Address Secure',
              complexDetails: payload.complexDetails || '',
              
              // Appended structural primitives to completely satisfy JobPayload interface requirement
              customerId: payload.customerId || 'cust_unknown_fallback',
              currency: payload.currency || 'ZAR',
              latitude: Number(payload.latitude) || 0,
              longitude: Number(payload.longitude) || 0
            };

            // Safely alter state cache directly since a custom hook action mapping doesn't exist
            useJobStore.setState((state: any) => ({
              incomingJobs: [storeJobPayload, ...(state.incomingJobs || [])]
            }));

            Alert.alert(
              'New Job Available!',
              `${storeJobPayload.applianceType} in ${storeJobPayload.generalArea}\nCall-Out: R ${storeJobPayload.price}`,
              [{ text: 'View on Dashboard' }]
            );
          });

        } catch (error) {
          Alert.alert('Connection Error', 'Could not open real-time data channels.');
          setIsOnline(false);
        } finally {
          setIsNetworkLoading(false);
        }
      } else {
        if (unsubscribeIncomingListener) unsubscribeIncomingListener();
        await TrackingService.stopLiveTracking();
        techSocketService.disconnect();
        
        // Clear incoming cache via clean state partial merge when going offline
        useJobStore.setState({ incomingJobs: [] }); 
        setIsNetworkLoading(false);
      }
    };

    toggleOnlineStatus();

    return () => {
      if (unsubscribeIncomingListener) unsubscribeIncomingListener();
    };
  }, [isOnline]);

  const handleAcceptJob = async (job: IncomingJob) => {
    console.log('Job Accepted:', job.id);

    // Construct full JobPayload matching store rules with fallback items
    const storePayload = {
      id: job.id,
      applianceType: job.applianceType,
      faultDescription: job.faultDescription,
      price: job.callOutFee,
      distance: job.distance,
      generalArea: job.generalArea,
      customerName: job.customerName,
      fullAddress: job.fullAddress,
      complexDetails: job.complexDetails || '',
      
      // Strict payload requirements appended directly:
      customerId: 'cust_unknown_fallback',
      currency: 'ZAR',
      latitude: 0,
      longitude: 0
    };

    acceptJobGlobal(storePayload);

    const trackingLaunched = await TrackingService.startLiveTracking(MOCK_TECHNICIAN_ID, job.id);
    if (!trackingLaunched) {
      Alert.alert('Telemetry Offline', 'Background location tracking engine failed to initialize.');
    }
  };

  const handleDeclineJob = (id: string) => {
    console.log('Job Declined:', id);
    declineJobGlobal(id);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        <DashboardHeader 
          isOnline={isOnline} 
          isLoading={isNetworkLoading} 
          onStatusChange={() => setIsOnline(!isOnline)} 
        />

        <StatsOverview stats={stats} />

        <ActiveJobCard job={activeJob} />

        <IncomingRequestsList 
          jobs={incomingJobs} 
          isOnline={isOnline} 
          onAccept={handleAcceptJob}
          onDecline={handleDeclineJob}
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