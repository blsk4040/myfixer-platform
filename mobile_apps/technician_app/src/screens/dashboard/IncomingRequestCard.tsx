// src/screens/dashboard/IncomingRequestCard.tsx
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IncomingJob } from './types/dashboard';

interface IncomingRequestCardProps {
  job: IncomingJob;
  onAccept: (job: IncomingJob) => void;
  onDecline: (id: string) => void;
}

export function IncomingRequestCard({
  job,
  onAccept,
  onDecline,
}: IncomingRequestCardProps): React.JSX.Element {
  return (
    <View style={styles.card}>
      <View style={styles.infoRow}>
        <Text style={styles.title} numberOfLines={1}>
          {job.applianceType}
        </Text>
        <Text style={styles.price}>
          {job.currency || 'ZAR'} {job.callOutFee}
        </Text>
      </View>

      <Text style={styles.distanceText}>
        {job.distance || 'Nearby'} away • {job.generalArea || 'Local area'}
      </Text>

      {!!job.faultDescription && (
        <Text style={styles.descriptionText} numberOfLines={2}>
          {job.faultDescription}
        </Text>
      )}

      <View style={styles.buttonRow}>
        <Pressable
          style={styles.declineButton}
          onPress={() => onDecline(job.id)}
        >
          <Text style={styles.declineText}>Decline</Text>
        </Pressable>

        <Pressable
          style={styles.acceptButton}
          onPress={() => onAccept(job)}
        >
          <Text style={styles.acceptText}>Accept Job</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#111922', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#1E293B', marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  title: { color: '#FFFFFF', fontWeight: '700', fontSize: 16, flex: 1 },
  price: { color: '#00E676', fontWeight: '800', fontSize: 18 },
  distanceText: { color: '#94A3B8', marginTop: 4, fontSize: 13 },
  descriptionText: { color: '#CBD5E1', marginTop: 10, fontSize: 13, lineHeight: 18 },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
  declineButton: { flex: 1, backgroundColor: '#1E293B', paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  acceptButton: { flex: 2, backgroundColor: '#00E676', paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  declineText: { color: '#94A3B8', fontWeight: '700', fontSize: 14 },
  acceptText: { color: '#111922', fontWeight: '800', fontSize: 14 },
});
