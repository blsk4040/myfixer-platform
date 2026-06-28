// src/screens/profile/SecurityScreen.tsx
import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  Switch,
  Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function SecurityScreen({ navigation }: any): React.JSX.Element {
  const [biometricsEnabled, setBiometricsEnabled] = useState<boolean>(false);
  const [mfaEnabled, setMfaEnabled] = useState<boolean>(false);

  const handleChangePassword = () => {
    Alert.alert('Password Update', 'Secure reset link will be dispatched to your registered email matrix.');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        <Text style={styles.sectionTitle}>Account Access & Controls</Text>
        
        <View style={styles.menuStack}>
          {/* Change Password Row */}
          <TouchableOpacity style={styles.menuRow} activeOpacity={0.7} onPress={handleChangePassword}>
            <View style={styles.menuLeft}>
              <Text style={styles.menuIcon}>🔑</Text>
              <View>
                <Text style={styles.menuTitle}>Update Password</Text>
                <Text style={styles.menuSubtitle}>Change or reset your active session credential</Text>
              </View>
            </View>
            <Text style={styles.chevron}>→</Text>
          </TouchableOpacity>

          {/* Biometrics Switch Row */}
          <View style={styles.menuRow}>
            <View style={styles.menuLeft}>
              <Text style={styles.menuIcon}>🔒</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuTitle}>Biometric Authentication</Text>
                <Text style={styles.menuSubtitle}>Unlock app using FaceID or fingerprint sensory hardware</Text>
              </View>
            </View>
            <Switch 
              value={biometricsEnabled}
              onValueChange={(val) => setBiometricsEnabled(val)}
              trackColor={{ false: '#1E293B', true: '#00FF8730' }}
              thumbColor={biometricsEnabled ? '#00FF87' : '#64748B'}
            />
          </View>

          {/* MFA Switch Row */}
          <View style={styles.menuRow}>
            <View style={styles.menuLeft}>
              <Text style={styles.menuIcon}>🛡️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuTitle}>Two-Factor Auth (MFA)</Text>
                <Text style={styles.menuSubtitle}>Secure actions via dynamic mobile token verifications</Text>
              </View>
            </View>
            <Switch 
              value={mfaEnabled}
              onValueChange={(val) => setMfaEnabled(val)}
              trackColor={{ false: '#1E293B', true: '#00FF8730' }}
              thumbColor={mfaEnabled ? '#00FF87' : '#64748B'}
            />
          </View>
        </View>

        <TouchableOpacity 
          style={styles.deleteAccountBtn} 
          activeOpacity={0.8} 
          onPress={() => Alert.alert('Danger Zone', 'Account purging requires compliance validation. Contact support.')}
        >
          <Text style={styles.deleteAccountText}>Deactivate Customer Profile</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090D14' },
  scrollContainer: { padding: 20 },
  sectionTitle: { color: '#64748B', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 },
  menuStack: { backgroundColor: '#111827', borderRadius: 16, borderWidth: 1, borderColor: '#1E293B', overflow: 'hidden' },
  menuRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  menuIcon: { fontSize: 20 },
  menuTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  menuSubtitle: { color: '#64748B', fontSize: 11, marginTop: 2, lineHeight: 14, paddingRight: 8 },
  chevron: { color: '#64748B', fontSize: 16, fontWeight: '600' },
  deleteAccountBtn: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 32, borderWidth: 1, borderColor: '#EF444420', backgroundColor: '#EF444405' },
  deleteAccountText: { color: '#EF4444', fontSize: 14, fontWeight: '600' }
});