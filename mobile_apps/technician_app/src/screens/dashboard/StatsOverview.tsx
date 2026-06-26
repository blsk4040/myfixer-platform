// src/components/dashboard/StatsOverview.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { StatCard } from './StatCard';
import { DashboardStats } from './types/dashboard';

interface StatsOverviewProps {
  stats: DashboardStats;
}

export function StatsOverview({ stats }: StatsOverviewProps): React.JSX.Element {
  return (
    <View style={styles.grid}>
      {/* Top Row */}
      <View style={styles.row}>
        <StatCard title="Jobs Today" value={stats.jobsToday} />
        <StatCard title="Completed" value={stats.completed} />
      </View>
      
      {/* Bottom Row */}
      <View style={styles.row}>
        <StatCard title="Earnings Today" value={`R ${stats.earnings.toFixed(2)}`} />
        <StatCard title="Partner Rating" value={`⭐ ${stats.rating.toFixed(1)}`} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { 
    gap: 12, 
    marginBottom: 24 
  },
  row: { 
    flexDirection: 'row', 
    gap: 12 
  },
});