// src/screens/jobs/CompletedJobsTab.tsx
import React from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { useJobStore } from '../../store/useJobStore';

export function CompletedJobsTab(): React.JSX.Element {
  const completedJobs = useJobStore((state) => state.completedJobs);

  if (completedJobs.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>No completed repair trails recorded yet.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {completedJobs.map((job) => (
        <View key={job.id} style={styles.jobCard}>
          <View style={styles.row}>
            <View>
              <Text style={styles.applianceText}>{job.applianceType}</Text>
              <Text style={styles.ratingText}>⭐⭐⭐⭐⭐ 5.0 Rating</Text>
            </View>
            <Text style={styles.payoutText}>+{job.currency} {job.price}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { color: '#64748B', fontSize: 14, textAlign: 'center' },
  jobCard: { backgroundColor: '#111827', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#1E293B', marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  applianceText: { color: '#E2E8F0', fontSize: 14, fontWeight: '600' },
  ratingText: { color: '#64748B', fontSize: 11, marginTop: 4 },
  payoutText: { color: '#00FF87', fontSize: 14, fontWeight: '700' },
});