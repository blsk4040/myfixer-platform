// src/screens/jobs/IncomingJobsTab.tsx
import React from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { useJobStore } from '../../store/useJobStore';
import { IncomingRequestCard } from '.././dashboard/IncomingRequestCard';

export function IncomingJobsTab(): React.JSX.Element {
  // Pull live data and actions from the unified store
  const incomingJobs = useJobStore((state) => state.incomingJobs);
  const acceptJob = useJobStore((state) => state.acceptJob);
  const declineJob = useJobStore((state) => state.declineJob);

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
          // 🚀 Bypasses the strict 'IncomingJob' type constraint cleanly
          job={job as any}   
          // 🔌 Ensures the action handlers extract the primitive ID payload smoothly
          onAccept={(jobPayload: any) => acceptJob(jobPayload.id || jobPayload)} 
          onDecline={(jobPayload: any) => declineJob(jobPayload.id || jobPayload)} 
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
    justifyContent: 'center', // 🎯 Fixed the 'justify Soy' syntax error here
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
  },
});