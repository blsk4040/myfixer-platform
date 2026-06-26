// src/screens/jobs/ScheduledJobsTab.tsx
import React from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { useJobStore } from '../../store/useJobStore';

export function ScheduledJobsTab(): React.JSX.Element {
  const scheduledJobs = useJobStore((state) => state.scheduledJobs);

  if (scheduledJobs.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>No upcoming bookings scheduled.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {scheduledJobs.map((job) => (
        <View key={job.id} style={styles.jobCard}>
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{job.scheduledTime || 'Scheduled Assignment'}</Text>
            <Text style={styles.priceText}>{job.currency} {job.price}</Text>
          </View>
          
          <Text style={styles.applianceText}>{job.applianceType}</Text>
          <Text style={styles.areaText}>📍 {job.generalArea || 'Local Area'} ({job.distance || '— km'})</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { color: '#64748B', fontSize: 14, textAlign: 'center' },
  jobCard: { backgroundColor: '#111827', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#1E293B', marginBottom: 12 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  timeText: { color: '#00FF87', fontSize: 12, fontWeight: '700' },
  priceText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  applianceText: { color: '#F8FAFC', fontSize: 15, fontWeight: '600' },
  areaText: { color: '#64748B', fontSize: 13, marginTop: 4 },
});