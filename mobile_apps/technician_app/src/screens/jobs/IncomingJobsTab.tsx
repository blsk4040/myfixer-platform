// src/screens/jobs/IncomingJobsTab.tsx
import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { IncomingRequestCard } from '../dashboard/IncomingRequestCard';
import { acceptBookingWorkflow, declineBookingWorkflow } from '../../services/jobWorkflow.service';
import { getTechnicianIdentity } from '../../services/technicianIdentity.service';
import { useJobStore } from '../../store/useJobStore';

export function IncomingJobsTab(): React.JSX.Element {
  const incomingJobs = useJobStore((state) => state.incomingJobs || []);
  const technicianIdentity = getTechnicianIdentity();

  if (incomingJobs.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyTitle}>No incoming requests yet</Text>
        <Text style={styles.emptyText}>Stay live and nearby jobs will appear here.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {incomingJobs.map((job) => (
        <IncomingRequestCard
          key={job.id}
          job={{
            id: job.id,
            applianceType: job.applianceType,
            faultDescription: job.faultDescription || '',
            callOutFee: job.price,
            currency: job.currency,
            distance: job.distance || 'Nearby',
            generalArea: job.generalArea || 'Local area',
            hasPreciseLocation: false,
          }}
          onAccept={async (job: any) => {
            try {
              await acceptBookingWorkflow(job, technicianIdentity.userId);
            } catch (error: any) {
              console.error('Accept booking failed:', error);
              Alert.alert('Accept failed', error.message || 'Could not accept this job.');
            }
          }}
          onDecline={async (jobId: string) => {
            try {
              await declineBookingWorkflow(jobId);
            } catch (error: any) {
              console.error('Decline booking failed:', error);
              Alert.alert('Decline failed', error.message || 'Could not decline this job.');
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    color: '#F7F7F5',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptyText: {
    color: '#A7A7AD',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
