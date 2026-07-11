// src/screens/jobs/JobsScreen.tsx
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';

import { IncomingJobsTab } from './IncomingJobsTab';
import { ActiveJobsTab } from './ActiveJobsTab';
import { ScheduledJobsTab } from './ScheduledJobsTab';
import { CompletedJobsTab } from './CompletedJobsTab';
import { useSocketConnection } from '../../context/SocketContext';
import { OfflineAction, useOfflineQueue } from '../../store/useOfflineQueue';
import { useJobStore } from '../../store/useJobStore';

type JobTab = 'Incoming' | 'Active' | 'Scheduled' | 'Completed';

export function JobsScreen(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<JobTab>('Incoming');
  const [isConnected, setIsConnected] = useState<boolean | null>(true);

  const { socket } = useSocketConnection();
  const { queue, loadQueue, clearQueue } = useOfflineQueue();
  const advanceJobStatus = useJobStore((state) => state.advanceJobStatus);

  useEffect(() => {
    loadQueue();
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected);

      if (state.isConnected && queue.length > 0) {
        console.log(`Connection restored. Syncing ${queue.length} saved job updates.`);

        queue.forEach((action: OfflineAction) => {
          advanceJobStatus(action.jobId);
          if (socket && typeof socket.emit === 'function') {
            socket.emit('sync_offline_job_state', action);
          }
        });

        clearQueue();
        Alert.alert('Updates synced', 'Your saved job updates are now up to date.');
      }
    });

    return () => unsubscribe();
  }, [advanceJobStatus, clearQueue, queue, socket]);

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
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Jobs</Text>
        {!isConnected && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineBannerText}>Offline mode: job updates will save and sync later</Text>
          </View>
        )}
      </View>

      <View style={styles.segmentedControlWrapper}>
        {tabs.map((tab) => {
          const isSelected = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              activeOpacity={0.8}
              onPress={() => setActiveTab(tab)}
              style={[styles.tabButton, isSelected && styles.activeTabButton]}
            >
              <Text style={[styles.tabLabel, isSelected && styles.activeTabLabel]}>
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.contentBodyContainer}>
        {renderTabContent()}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D14',
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
    backgroundColor: '#111827',
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
    backgroundColor: '#1E293B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  activeTabLabel: {
    color: '#00FF87',
  },
  contentBodyContainer: {
    flex: 1,
    marginTop: 10,
  },
});
