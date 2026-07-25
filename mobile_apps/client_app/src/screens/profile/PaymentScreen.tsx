// src/screens/profile/PaymentScreen.tsx
import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function PaymentScreen(): React.JSX.Element {
  const handleOpenBookings = () => {
    Alert.alert(
      'Payment Methods',
      'Payment options are shown during checkout and are based on the active market for that booking.'
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Payment Methods</Text>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Booking-based checkout</Text>
          <Text style={styles.infoText}>
            Padi uses the booking market to choose the currency, payment provider, and available payment methods.
          </Text>
          <Text style={styles.infoText}>
            Cards and payment authorizations are handled securely by the active provider during checkout.
          </Text>
          <TouchableOpacity style={styles.primaryButton} activeOpacity={0.85} onPress={handleOpenBookings}>
            <Text style={styles.primaryButtonText}>View checkout guidance</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.complianceBox}>
          <Text style={styles.complianceText}>
            Padi does not let customers manually override booking currency or payment providers.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090D14' },
  scrollContainer: { padding: 20 },
  sectionTitle: { color: '#64748B', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 },
  infoCard: { backgroundColor: '#111827', borderWidth: 1, borderColor: '#1E293B', borderRadius: 16, padding: 18, gap: 10 },
  infoTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  infoText: { color: '#94A3B8', fontSize: 13, lineHeight: 20 },
  primaryButton: { marginTop: 8, backgroundColor: '#00FF87', borderRadius: 12, padding: 14, alignItems: 'center' },
  primaryButtonText: { color: '#090D14', fontSize: 14, fontWeight: '800' },
  complianceBox: { marginTop: 24, padding: 14, backgroundColor: '#0F172A', borderRadius: 12, borderWidth: 1, borderColor: '#1E293B' },
  complianceText: { color: '#64748B', fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
