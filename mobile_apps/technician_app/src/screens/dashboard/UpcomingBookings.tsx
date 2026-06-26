// src/components/dashboard/UpcomingBookings.tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { UpcomingJob } from './types/dashboard';

interface UpcomingBookingsProps {
  bookings: UpcomingJob[];
}

export function UpcomingBookings({ bookings }: UpcomingBookingsProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Scheduled Future Work</Text>
      
      {bookings.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No upcoming bookings scheduled for today.</Text>
        </View>
      ) : (
        bookings.map((item) => (
          <View key={item.id} style={styles.row}>
            <View style={styles.timeBadge}>
              <Text style={styles.timeText}>{item.time}</Text>
            </View>
            <Text style={styles.itemText} numberOfLines={1}>
              {item.applianceType}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    marginBottom: 16 
  },
  sectionTitle: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: '#FFFFFF', 
    marginBottom: 12 
  },
  emptyCard: {
    backgroundColor: '#111922',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  emptyText: { 
    color: '#64748B', 
    fontSize: 13 
  },
  row: { 
    flexDirection: 'row', 
    backgroundColor: '#111922', 
    padding: 14, 
    borderRadius: 14, 
    marginBottom: 10, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B'
  },
  timeBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 14,
    minWidth: 60,
    alignItems: 'center',
  },
  timeText: { 
    color: '#00E676', 
    fontWeight: '800', 
    fontSize: 12 
  },
  itemText: { 
    color: '#FFFFFF', 
    fontSize: 14, 
    fontWeight: '600',
    flex: 1
  },
});