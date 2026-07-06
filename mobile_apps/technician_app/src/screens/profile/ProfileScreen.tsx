// src/screens/profile/ProfileScreen.tsx
import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, Switch, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, NavigationProp, ParamListBase } from '@react-navigation/native'; // 🟢 Added React Navigation hooks & types
import { useSocketConnection } from '../../context/SocketContext'; 
import { useJobStore } from '../../store/useJobStore';     
import authService from '../../services/auth.service';
import { getTechnicianIdentity } from '../../services/technicianIdentity.service';

// 🟢 Correctly typed props interface
interface ProfileScreenProps {
  setIsAuthenticated: (auth: boolean) => void;
}

export function ProfileScreen({ setIsAuthenticated }: ProfileScreenProps): React.JSX.Element {
  // 🟢 Hook instantiation with an open navigation param type to avoid navigation compilation blocks
  const navigation = useNavigation<NavigationProp<ParamListBase>>(); 
  const { isConnected, disconnectSocket } = useSocketConnection(); 
  const completedJobs = useJobStore((state) => state.completedJobs);
  const technicianIdentity = getTechnicianIdentity();

  const totalCompletedCount = completedJobs.length; 
  const currentRating = "5.00";
  const serviceCategories = technicianIdentity.serviceCategories.length
    ? technicianIdentity.serviceCategories
    : ['No service categories set'];

  const handleToggleDuty = () => {
    if (isConnected) {
      disconnectSocket();
      Alert.alert("Off Duty", "You are now offline. You won't receive new live repair jobs.");
    } else {
      Alert.alert(
        "Go On Duty?",
        "This will connect to the dispatch grid and start your location tracking shift.",
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Go Online", 
            onPress: () => {
              Alert.alert("System Notice", "To go back online, please toggle availability or pull-to-refresh your dashboard.");
            }
          }
        ]
      );
    }
  };

  const handleAbsoluteLogout = () => {
    Alert.alert(
      "Confirm Logout",
      "Are you sure you want to log out of MyFixer Pro completely?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Log Out", 
          style: "destructive",
          onPress: () => {
            disconnectSocket(); 
            authService.clearSession();
            setIsAuthenticated(false); 
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        {/* Profile Identity Unit - Interactive Trigger Link to AI Security Upload */}
        <TouchableOpacity 
          style={styles.avatarRow} 
          activeOpacity={0.7}
          onPress={() => navigation.navigate('ProfilePictureUpload')}
        >
          <View style={styles.avatarPlaceholder}>
            {technicianIdentity.profilePhotoUrl ? (
              <Image source={{ uri: technicianIdentity.profilePhotoUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{technicianIdentity.initials}</Text>
            )}
            <View style={styles.avatarEditBadge}>
              <Text style={styles.avatarEditBadgeText}>+</Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.techName}>{technicianIdentity.displayName}</Text>
            <Text style={styles.techMeta}>{technicianIdentity.email}</Text>
            <Text style={styles.techMeta}>{technicianIdentity.phone}</Text>
            <Text style={styles.techMeta}>{technicianIdentity.city} - {technicianIdentity.approvalStatus}</Text>
          </View>
        </TouchableOpacity>

        {/* 🟢 Dedicated Shift Status Control Card */}
        <View style={[styles.dutyCard, { borderColor: isConnected ? '#00FF87' : '#EF4444' }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dutyLabel}>DISPATCH AVAILABILITY</Text>
            <Text style={[styles.dutyStatusText, { color: isConnected ? '#00FF87' : '#EF4444' }]}>
              {isConnected ? '🟢 ON DUTY (Live Tracking)' : '🔴 OFF DUTY (Passive Viewing)'}
            </Text>
          </View>
          <Switch 
            value={isConnected} 
            onValueChange={handleToggleDuty}
            trackColor={{ false: '#1E293B', true: '#00FF8730' }}
            thumbColor={isConnected ? '#00FF87' : '#64748B'}
          />
        </View>

        {/* 📊 Live Performance Stats Ribbon Row */}
        <View style={styles.performanceMetricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>RATING</Text>
            <Text style={styles.metricValue}>⭐ {currentRating}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>COMPLETED</Text>
            <Text style={styles.metricValue}>{totalCompletedCount} jobs</Text>
          </View>
        </View>

        {/* Operating Specialties Badges Container */}
        <Text style={styles.sectionTitle}>Service Focus Areas</Text>
        <View style={styles.badgeWrapper}>
          {serviceCategories.map((spec) => (
            <View key={spec} style={styles.badge}>
              <Text style={styles.badgeText}>{spec}</Text>
            </View>
          ))}
        </View>

        {/* Settings Action Blocks Grid */}
        <Text style={styles.sectionTitle}>Account Configurations</Text>
        <View style={styles.menuGroup}>
          <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert("Operating Zone", `Your current operating city is ${technicianIdentity.city}.`)}>
            <Text style={styles.menuItemText}>Operating Zone ({technicianIdentity.city})</Text>
          </TouchableOpacity>
          
          {/* 🏦 Dynamic Global Payouts & Invoicing Entry Point */}
          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => navigation.navigate('BankingInvoice')}
          >
            <Text style={styles.menuItemText}>Banking Details & Tax Invoices</Text>
          </TouchableOpacity>
        </View>

        {/* 🚨 Separate Absolute Account Logout Button */}
        <TouchableOpacity 
          style={styles.logoutButton} 
          activeOpacity={0.8}
          onPress={handleAbsoluteLogout}
        >
          <Text style={styles.logoutText}>Log Out of Account</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090D14' },
  scrollContainer: { padding: 20, paddingBottom: 80 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 20 },
  avatarPlaceholder: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#00FF87', position: 'relative', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: '#00FF87', fontSize: 20, fontWeight: '700' },
  avatarEditBadge: { position: 'absolute', bottom: -2, right: -2, backgroundColor: '#00FF87', width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  avatarEditBadgeText: { color: '#090D14', fontSize: 12, fontWeight: '900', lineHeight: 14 },
  techName: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  techMeta: { color: '#64748B', fontSize: 13 },
  dutyCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111827', padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 20 },
  dutyLabel: { color: '#64748B', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  dutyStatusText: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  performanceMetricsGrid: { flexDirection: 'row', gap: 12, marginBottom: 25 },
  metricCard: { flex: 1, backgroundColor: '#111827', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#1E293B' },
  metricLabel: { color: '#64748B', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  metricValue: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginTop: 4 },
  sectionTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 12, marginTop: 5 },
  badgeWrapper: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 25 },
  badge: { backgroundColor: '#111827', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#1E293B' },
  badgeText: { color: '#F8FAFC', fontSize: 12, fontWeight: '600' },
  menuGroup: { backgroundColor: '#111827', borderRadius: 14, borderWidth: 1, borderColor: '#1E293B', overflow: 'hidden', marginBottom: 30 },
  menuItem: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#1E293B', backgroundColor: '#111827' },
  menuItemText: { color: '#E2E8F0', fontSize: 14, fontWeight: '500' },
  logoutButton: { backgroundColor: '#EF444415', paddingVertical: 15, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#EF444430', marginBottom: 20 },
  logoutText: { color: '#EF4444', fontWeight: '700', fontSize: 14 },
});
