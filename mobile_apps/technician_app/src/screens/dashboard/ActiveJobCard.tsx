// src/screens/dashboard/ActiveJobCard.tsx
import React from 'react';
import { Alert, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { ActiveJob } from './types/dashboard';

interface ActiveJobCardProps {
  job: ActiveJob | null;
}

export function ActiveJobCard({ job }: ActiveJobCardProps): React.JSX.Element {
  if (!job) {
    return (
      <View style={[styles.container, styles.emptyState]}>
        <Text style={styles.emptyText}>No active job</Text>
      </View>
    );
  }

  const handleOpenNavigation = () => {
    const encodedAddress = encodeURIComponent(job.fullAddress || '');
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;

    Linking.canOpenURL(mapsUrl)
      .then((supported) => {
        if (supported) {
          Linking.openURL(mapsUrl);
        } else {
          Alert.alert('Navigation unavailable', 'Unable to open your maps app.');
        }
      });
  };

  return (
    <View style={styles.container}>
      <View style={styles.badgeRow}>
        <Text style={styles.badgeText}>ACTIVE JOB</Text>
        <Text style={styles.statusText}>{job.status.toUpperCase()}</Text>
      </View>

      <Text style={styles.applianceText}>{job.applianceType}</Text>
      <Text style={styles.customerText}>Client: {job.customerName} • {job.distance}</Text>
      <Text style={styles.addressText}>{job.fullAddress}</Text>

      <TouchableOpacity style={styles.actionButton} onPress={handleOpenNavigation}>
        <Text style={styles.actionButtonText}>Open Map</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#111922',
    padding: 20,
    borderRadius: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#00E676',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  emptyState: {
    borderLeftColor: '#334155',
    borderStyle: 'dashed',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  badgeText: {
    color: '#00E676',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusText: {
    color: '#FFFFFF',
    backgroundColor: '#1E293B',
    fontSize: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    fontWeight: '700',
  },
  applianceText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  customerText: {
    color: '#94A3B8',
    fontSize: 13,
    marginBottom: 8,
  },
  addressText: {
    color: '#37D399',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 18,
  },
  actionButton: {
    backgroundColor: '#00E676',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#111922',
    fontWeight: '800',
    fontSize: 14,
  },
});
