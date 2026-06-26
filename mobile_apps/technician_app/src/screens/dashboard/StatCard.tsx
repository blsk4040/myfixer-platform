// src/components/dashboard/StatCard.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface StatCardProps {
  title: string;
  value: string | number;
}

export function StatCard({ title, value }: StatCardProps): React.JSX.Element {
  return (
    <View style={styles.card}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,                 // Fluid flex grid adjustment (Better than hardcoded %)
    backgroundColor: '#111922', // Deep premium dark background
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E293B',    // Clean slate border outline
  },
  value: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',       // Bold emphasis
  },
  title: {
    color: '#94A3B8',         // Muted slate text
    marginTop: 6,
    fontSize: 12,
    fontWeight: '500',
  },
});