// src/screens/jobs/IncomingJobsTab.tsx
import React from 'react';
import { Alert, StyleSheet, View, Text, ScrollView } from 'react-native';
import { useJobStore } from '../../store/useJobStore';
import { IncomingRequestCard } from '.././dashboard/IncomingRequestCard';
import { acceptBookingWorkflow, declineBookingWorkflow } from '../../services/jobWorkflow.service';
import { getTechnicianIdentity } from '../../services/technicianIdentity.service';

export function IncomingJobsTab(): React.JSX.Element {
  // Pull live data and actions from the unified store
  const incomingJobs = useJobStore((state) => state.incomingJobs || []);
  const technicianIdentity = getTechnicianIdentity();

  if (incomingJobs.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>No incoming job pings in your area.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {incomingJobs.map((job) => (
        <IncomingRequestCard
          key={job.id}
          // 🚀 Bypasses type constraint and explicit sanity sanitizes location types
          job={{
            ...job,
            latitude: Number(job.latitude),
            longitude: Number(job.longitude),
          } as any}   
          // 🔌 Ensures the action handlers extract the primitive ID payload smoothly
          onAccept={async (job: any) => {
            try {
              await acceptBookingWorkflow(job, technicianIdentity.userId);
            } catch (error: any) {
              console.error('Accept booking failed:', error);
              Alert.alert('Accept Failed', error.message || 'Could not accept this booking.');
            }
          }}
          onDecline={async (job: any) => {
            try {
              await declineBookingWorkflow(job.id);
            } catch (error: any) {
              console.error('Decline booking failed:', error);
              Alert.alert('Decline Failed', error.message || 'Could not decline this booking.');
            }
          }}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center', // Fixed the 'justify Soy' syntax error here
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
  },
});
