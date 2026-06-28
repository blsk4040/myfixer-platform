// src/screens/profile/SupportScreen.tsx
import React from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function SupportScreen({ navigation }: any): React.JSX.Element {
  
  const handleSupportAction = (type: string) => {
    Alert.alert('Support Dispatch', `${type} communication route opening shortly.`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        <Text style={styles.sectionTitle}>Help & Helpdesks</Text>
        
        <View style={styles.menuStack}>
          {/* FAQ Channel */}
          <TouchableOpacity style={styles.menuRow} activeOpacity={0.7} onPress={() => handleSupportAction('Knowledge Base')}>
            <View style={styles.menuLeft}>
              <Text style={styles.menuIcon}>📖</Text>
              <View>
                <Text style={styles.menuTitle}>Knowledge Base & FAQs</Text>
                <Text style={styles.menuSubtitle}>Instant technical answers for platform operations</Text>
              </View>
            </View>
            <Text style={styles.chevron}>→</Text>
          </TouchableOpacity>

          {/* Ticket Dispatch */}
          <TouchableOpacity style={styles.menuRow} activeOpacity={0.7} onPress={() => handleSupportAction('Helpdesk Ticket')}>
            <View style={styles.menuLeft}>
              <Text style={styles.menuIcon}>✉️</Text>
              <View>
                <Text style={styles.menuTitle}>Submit Help Ticket</Text>
                <Text style={styles.menuSubtitle}>File operational reports directly to support team</Text>
              </View>
            </View>
            <Text style={styles.chevron}>→</Text>
          </TouchableOpacity>

          {/* Immediate Call Escalation */}
          <TouchableOpacity style={styles.menuRow} activeOpacity={0.7} onPress={() => handleSupportAction('Emergency Hotwire')}>
            <View style={styles.menuLeft}>
              <Text style={styles.menuIcon}>📞</Text>
              <View>
                <Text style={styles.menuTitle}>Emergency Support Desk</Text>
                <Text style={styles.menuSubtitle}>Direct telephone channel for active service issues</Text>
              </View>
            </View>
            <Text style={styles.chevron}>→</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>App Version</Text>
          <Text style={styles.infoValue}>v1.0.0 (Build 2026.06)</Text>
        </View>

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
  menuSubtitle: { color: '#64748B', fontSize: 11, marginTop: 2, lineHeight: 14 },
  chevron: { color: '#64748B', fontSize: 16, fontWeight: '600' },
  infoCard: { marginTop: 32, alignItems: 'center' },
  infoTitle: { color: '#475569', fontSize: 11, fontWeight: '600' },
  infoValue: { color: '#1E293B', fontSize: 11, fontFamily: 'monospace', marginTop: 4 }
});