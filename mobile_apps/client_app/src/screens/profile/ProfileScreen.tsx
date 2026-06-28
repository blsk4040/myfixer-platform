// src/screens/profile/ProfileScreen.tsx
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

interface ProfileOption {
  title: string;
  subtitle: string;
  icon: string;
  actionKey: string;
}

export function ProfileScreen({ navigation }: any): React.JSX.Element {
  const accountOptions: ProfileOption[] = [
    {
      title: 'Booking History',
      subtitle: 'View all completed service requests',
      icon: '🕒',
      actionKey: 'History',
    },
    {
      title: 'Active Requests',
      subtitle: 'Track jobs currently in progress',
      icon: '🚚',
      actionKey: 'Activity',
    },
    {
      title: 'Wallet & Payments',
      subtitle: 'Manage cards and payment methods',
      icon: '💳',
      actionKey: 'Payments',
    },
    {
      title: 'Saved Addresses',
      subtitle: 'Manage your service locations',
      icon: '📍',
      actionKey: 'Addresses',
    },
    {
      title: 'Security',
      subtitle: 'Password and account protection',
      icon: '🔒',
      actionKey: 'Security',
    },
    {
      title: 'Help & Support',
      subtitle: 'Get assistance with your account',
      icon: '❓',
      actionKey: 'Support',
    },
  ];

  const handleAction = (key: string) => {
    switch (key) {
      case 'History':
        navigation.navigate('History');
        break;

      case 'Activity':
        navigation.navigate('Activity');
        break;

      case 'Payments':
        Alert.alert(
          'Wallet & Payments',
          'This feature will be available soon.'
        );
        break;

      case 'Addresses':
        Alert.alert(
          'Saved Addresses',
          'Address management is coming soon.'
        );
        break;

      case 'Security':
        Alert.alert(
          'Security',
          'Security settings will be available soon.'
        );
        break;

      case 'Support':
        Alert.alert(
          'Support',
          'Support Centre coming soon.'
        );
        break;
    }
  };

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to exit your session?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: () => navigation?.replace('Login') }
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        {/* User Identity Matrix Badge Card */}
        <View style={styles.profileHeroCard}>
          <View style={styles.avatarMock}>
            <Text style={styles.avatarText}>JD</Text>
          </View>
          
          <Text style={styles.userName}>John Doe</Text>
          <Text style={styles.userEmail}>johndoe@myfixer.co.za</Text>

          {/* User Engagement Metrics */}
          <View
            style={{
              flexDirection: 'row',
              marginTop: 18,
              justifyContent: 'space-around',
              width: '100%',
            }}
          >
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>
                12
              </Text>
              <Text style={{ color: '#64748B', fontSize: 11 }}>
                Bookings
              </Text>
            </View>

            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>
                4.9★
              </Text>
              <Text style={{ color: '#64748B', fontSize: 11 }}>
                Rating
              </Text>
            </View>

            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>
                3
              </Text>
              <Text style={{ color: '#64748B', fontSize: 11 }}>
                Active
              </Text>
            </View>
          </View>

          <View style={styles.verificationBadge}>
            <Text style={styles.badgeText}>🛡️ Verified Customer Profile</Text>
          </View>
        </View>

        {/* Configuration Menus Options Selection Stack */}
        <Text style={styles.sectionTitle}>My Account</Text>
        <View style={styles.menuStack}>
          {accountOptions.map((opt, idx) => (
            <TouchableOpacity 
              key={idx} 
              style={styles.menuRow}
              activeOpacity={0.7}
              onPress={() => handleAction(opt.actionKey)}
            >
              <View style={styles.menuLeft}>
                <Text style={styles.menuIcon}>{opt.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuTitle}>{opt.title}</Text>
                  <Text style={styles.menuSubtitle}>{opt.subtitle}</Text>
                </View>
              </View>
              <Text style={styles.chevron}>→</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* System Session Signout Button */}
        <TouchableOpacity style={styles.signOutBtn} activeOpacity={0.8} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090D14' },
  scrollContainer: { padding: 20, paddingBottom: 110 },
  profileHeroCard: { backgroundColor: '#111827', borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#1E293B', marginBottom: 28 },
  avatarMock: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#00FF8720', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#00FF87', marginBottom: 14 },
  avatarText: { color: '#00FF87', fontSize: 24, fontWeight: '700' },
  userName: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  userEmail: { color: '#64748B', fontSize: 13, marginTop: 4 },
  verificationBadge: { backgroundColor: '#1E293B', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginTop: 14, borderWidth: 1, borderColor: '#334155' },
  badgeText: { color: '#E2E8F0', fontSize: 11, fontWeight: '700' },
  sectionTitle: { color: '#64748B', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 },
  menuStack: { backgroundColor: '#111827', borderRadius: 16, borderWidth: 1, borderColor: '#1E293B', overflow: 'hidden' },
  menuRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  menuIcon: { fontSize: 20 },
  menuTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  menuSubtitle: { color: '#64748B', fontSize: 11, marginTop: 2, lineHeight: 14 },
  chevron: { color: '#64748B', fontSize: 16, fontWeight: '600' },
  signOutBtn: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 32, borderWidth: 1, borderColor: '#EF444430', backgroundColor: '#EF444405' },
  signOutText: { color: '#EF4444', fontSize: 14, fontWeight: '700' }
});