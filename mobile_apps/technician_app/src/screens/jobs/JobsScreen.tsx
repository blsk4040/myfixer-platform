// src/screens/jobs/JobsScreen.tsx
import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import NetInfo from '@react-native-community/netinfo';

// Import our sub-tab modules
import { IncomingJobsTab } from './IncomingJobsTab';
import { ActiveJobsTab } from './ActiveJobsTab';
import { ScheduledJobsTab } from './ScheduledJobsTab';
import { CompletedJobsTab } from './CompletedJobsTab';

// 🔌 Correct named hook imported from SocketContext
import { useSocketConnection } from '../../context/SocketContext'; 
import { useOfflineQueue, OfflineAction } from '../../store/useOfflineQueue'; 
import { useJobStore } from '../../store/useJobStore';

type JobTab = 'Incoming' | 'Active' | 'Scheduled' | 'Completed';

export function JobsScreen(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<JobTab>('Incoming');
  const [isConnected, setIsConnected] = useState<boolean | null>(true);
  
  // 🔌 Destructure socket object from the custom hook values
  const { socket } = useSocketConnection(); 
  const { queue, loadQueue, clearQueue } = useOfflineQueue();
  const advanceJobStatus = useJobStore((state) => state.advanceJobStatus);

  // Initialize Offline Storage Cache Layer on Startup
  useEffect(() => {
    loadQueue();
  }, []);

  // Monitor Global Connection State Transitions
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected);
      
      // If network returns online and items are queued, flush them immediately
      if (state.isConnected && queue.length > 0) {
        console.log(`⚡ Connection Restored! Syncing ${queue.length} offline operations.`);
        
        queue.forEach((action: OfflineAction) => {
          // Fire updates back down our pipeline engine endpoints
          advanceJobStatus(action.jobId);
          if (socket && typeof socket.emit === 'function') {
            socket.emit('sync_offline_job_state', action);
          }
        });

        clearQueue();
        Alert.alert("Sync Successful", "Your background offline job records have updated cleanly.");
      }
    });

    return () => unsubscribe();
  }, [isConnected, queue, socket]);

  // Live Foreground Tracking Pipeline
  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;

    async function startTrackingTechnician() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          "Location Access Denied", 
          "Foreground map tracing has been disabled. Turn permissions on to stream routing tracking telemetry to clients."
        );
        return;
      }

      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,   // Sync operational telemetry bounds every 5 seconds
          distanceInterval: 10, // Or update when positional variance shifts over 10 meters
        },
        (location) => {
          const { latitude, longitude } = location.coords;
          console.log(`📡 Streaming location updates down pipeline: Lat ${latitude}, Lon ${longitude}`);
          
          // Only stream over network socket lines if currently connected
          if (isConnected && socket && typeof socket.emit === 'function') {
            socket.emit('technician_moved', { latitude, longitude });
          }
        }
      );
    }

    startTrackingTechnician();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [socket, isConnected]);

  // Render the correct tab content based on selected state
  const renderTabContent = () => {
    switch (activeTab) {
      case 'Incoming':
        return <IncomingJobsTab />;
      case 'Active':
        return <ActiveJobsTab />;
      case 'Scheduled':
        return <ScheduledJobsTab />;
      case 'Completed':
        return <CompletedJobsTab />;
      default:
        return <IncomingJobsTab />;
    }
  };

  const tabs: JobTab[] = ['Incoming', 'Active', 'Scheduled', 'Completed'];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* 1. Screen Sticky Title Header */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Work Queue</Text>
        {/* Network State Warning Indicator Strip */}
        {!isConnected && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineBannerText}>⚠️ OFFLINE MODE — Actions will save locally</Text>
          </View>
        )}
      </View>

      {/* 2. Premium Segmented Control Selector Segment */}
      <View style={styles.segmentedControlWrapper}>
        {tabs.map((tab) => {
          const isSelected = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              activeOpacity={0.8}
              onPress={() => setActiveTab(tab)}
              style={[
                styles.tabButton,
                isSelected && styles.activeTabButton,
              ]}
            >
              <Text style={[styles.tabLabel, isSelected && styles.activeTabLabel]}>
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 3. Main Dynamic Content Target Panel */}
      <View style={styles.contentBodyContainer}>
        {renderTabContent()}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D14', // Synchronized Matte Black
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  offlineBanner: {
    backgroundColor: '#EF444420',
    borderColor: '#EF444440',
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginTop: 8,
  },
  offlineBannerText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  segmentedControlWrapper: {
    flexDirection: 'row',
    backgroundColor: '#111827', // Slightly lighter dark for container depth
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTabButton: {
    backgroundColor: '#1E293B', // Highlight container slot
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B', // Muted slate gray
  },
  activeTabLabel: {
    color: '#00FF87', // Electric MyFixer Accent Green
  },
  contentBodyContainer: {
    flex: 1,
    marginTop: 10,
  },
});