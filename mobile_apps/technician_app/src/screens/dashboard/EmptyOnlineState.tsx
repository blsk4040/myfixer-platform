// src/components/dashboard/EmptyOnlineState.tsx
import React from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';

export function EmptyOnlineState(): React.JSX.Element {
  return (
    <View style={styles.card}>
      <ActivityIndicator size="small" color="#00E676" style={styles.spinner} />
      <Text style={styles.title}>Searching for local matches...</Text>
      <Text style={styles.subtitle}>
        Keep your screen active. Appliance repairs near your current location will appear here in real time.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { 
    backgroundColor: '#111922', 
    padding: 24, 
    borderRadius: 14, 
    alignItems: 'center', 
    borderStyle: 'dashed', 
    borderWidth: 1, 
    borderColor: '#1E293B' 
  },
  spinner: {
    marginBottom: 12,
  },
  title: { 
    color: '#FFFFFF', 
    fontSize: 15, 
    fontWeight: '700',
    marginBottom: 4
  },
  subtitle: { 
    color: '#94A3B8', 
    textAlign: 'center', 
    fontSize: 13, 
    lineHeight: 18 
  },
});