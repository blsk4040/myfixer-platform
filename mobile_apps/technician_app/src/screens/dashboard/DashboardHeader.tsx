// src/components/dashboard/DashboardHeader.tsx
import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

interface DashboardHeaderProps {
  isOnline: boolean;
  isLoading: boolean;
  onStatusChange: () => void;
}

export function DashboardHeader({
  isOnline,
  isLoading,
  onStatusChange,
}: DashboardHeaderProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <View>
        <Text style={styles.greeting}>
          Good Morning 👋
        </Text>
        <Text style={styles.subtitle}>
          Workspace Overview
        </Text>
      </View>

      <Pressable
        onPress={onStatusChange}
        disabled={isLoading} // Prevent duplicate backend hits while loading
        style={[
          styles.statusButton,
          isOnline ? styles.online : styles.offline,
        ]}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <View
              style={[
                styles.dot,
                { backgroundColor: isOnline ? '#00E676' : '#EF4444' },
              ]}
            />
            <Text style={styles.statusText}>
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94A3B8',
    marginTop: 4,
    fontSize: 13,
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 14,
    height: 40,
    justifyContent: 'center',
    minWidth: 100,
  },
  online: {
    backgroundColor: '#103529', // Premium deep forest green background
  },
  offline: {
    backgroundColor: '#1E293B', // Slate gray background matching your cards
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  statusText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.5,
  },
});