// src/screens/profile/AddressesScreen.tsx
import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface SavedAddress {
  id: string;
  label: string;
  address: string;
  icon: string;
}

export function AddressesScreen({ navigation }: any): React.JSX.Element {
  // Mock data setup mirroring future database collections
  const [addresses, setAddresses] = useState<SavedAddress[]>([
    { id: '1', label: 'Home', address: '42 Beach Road, Sea Point, Cape Town, 8005', icon: '🏠' },
    { id: '2', label: 'Office', address: '102 Rivonia Road, Sandton, Johannesburg, 2196', icon: '💼' },
  ]);

  const handleAddAddress = () => {
    Alert.alert('Add Address', 'Address lookup via Google Places / MapTiler API pipeline coming soon.');
  };

  const handleDeleteAddress = (id: string, label: string) => {
    Alert.alert('Remove Address', `Are you sure you want to delete "${label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Delete', 
        style: 'destructive', 
        onPress: () => setAddresses(prev => prev.filter(item => item.id !== id)) 
      }
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        <Text style={styles.sectionTitle}>Saved Service Locations</Text>
        
        <View style={styles.listStack}>
          {addresses.map((item) => (
            <View key={item.id} style={styles.addressRow}>
              <View style={styles.addressLeft}>
                <Text style={styles.addressIcon}>{item.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.addressLabel}>{item.label}</Text>
                  <Text style={styles.addressText}>{item.address}</Text>
                </View>
              </View>
              <TouchableOpacity 
                style={styles.deleteBtn}
                onPress={() => handleDeleteAddress(item.id, item.label)}
              >
                <Text style={styles.deleteBtnText}>🗑️</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.8} onPress={handleAddAddress}>
          <Text style={styles.actionBtnText}>＋ Add New Address</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090D14' },
  scrollContainer: { padding: 20 },
  sectionTitle: { color: '#64748B', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 },
  listStack: { backgroundColor: '#111827', borderRadius: 16, borderWidth: 1, borderColor: '#1E293B', overflow: 'hidden' },
  addressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  addressLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  addressIcon: { fontSize: 20 },
  addressLabel: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  addressText: { color: '#64748B', fontSize: 12, marginTop: 4, lineHeight: 16 },
  deleteBtn: { padding: 8 },
  deleteBtnText: { fontSize: 16 },
  actionBtn: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 24, borderWidth: 1, borderColor: '#1E293B', backgroundColor: '#111827' },
  actionBtnText: { color: '#00FF87', fontSize: 14, fontWeight: '700' }
});