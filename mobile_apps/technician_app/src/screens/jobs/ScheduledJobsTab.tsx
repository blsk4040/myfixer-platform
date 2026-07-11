// src/screens/jobs/ScheduledJobsTab.tsx
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useJobStore } from '../../store/useJobStore';

export function ScheduledJobsTab(): React.JSX.Element {
  const scheduledJobs = useJobStore((state) => state.scheduledJobs);

  if (scheduledJobs.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyTitle}>No scheduled jobs</Text>
        <Text style={styles.emptyText}>Future bookings will appear here once clients schedule ahead.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {scheduledJobs.map((job) => (
        <View key={job.id} style={styles.jobCard}>
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{job.scheduledTime || 'Scheduled job'}</Text>
            <Text style={styles.priceText}>{job.currency} {job.price}</Text>
          </View>

          <Text style={styles.applianceText}>{job.applianceType}</Text>
          <Text style={styles.areaText}>{job.generalArea || 'Local area'} - {job.distance || 'Nearby'}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  emptyText: { color: '#64748B', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  jobCard: { backgroundColor: '#111827', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#1E293B', marginBottom: 12 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  timeText: { color: '#00FF87', fontSize: 12, fontWeight: '700' },
  priceText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  applianceText: { color: '#F8FAFC', fontSize: 15, fontWeight: '600' },
  areaText: { color: '#64748B', fontSize: 13, marginTop: 4 },
});
