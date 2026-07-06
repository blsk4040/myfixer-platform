// src/components/dashboard/IncomingRequestsList.tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { IncomingRequestCard } from './IncomingRequestCard';
import { EmptyOnlineState } from './EmptyOnlineState';
import { IncomingJob } from '../../screens/dashboard/types/dashboard';

interface IncomingRequestsListProps {
  jobs: IncomingJob[]; // FIX: Explicitly match your local array schema type
  isOnline: boolean;
  onAccept: (job: IncomingJob) => void;
  onDecline: (id: string) => void;
  connectionMessage?: string;
}

export function IncomingRequestsList({
  jobs,
  isOnline,
  onAccept,
  onDecline,
  connectionMessage = '',
}: IncomingRequestsListProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Incoming Job Pings</Text>
      
      {isOnline && connectionMessage ? (
        <View style={styles.offlineCard}>
          <Text style={styles.offlineText}>{connectionMessage}</Text>
        </View>
      ) : !isOnline ? (
        <View style={styles.offlineCard}>
          <Text style={styles.offlineText}>
            🔴 Go online to start receiving live technician pings.
          </Text>
        </View>
      ) : jobs.length === 0 ? (
        <EmptyOnlineState />
      ) : (
        jobs.map((job) => (
          <IncomingRequestCard 
            key={job.id} 
            job={job} 
            onAccept={onAccept} 
            onDecline={onDecline} 
          />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginBottom: 12 },
  offlineCard: { backgroundColor: '#111922', padding: 20, borderRadius: 14, alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#EF4444' },
  offlineText: { color: '#94A3B8', fontSize: 13, textAlign: 'center', fontWeight: '500' },
});
