// src/screens/earnings/EarningsScreen.tsx
import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, DimensionValue } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useJobStore } from '../../store/useJobStore';

export function EarningsScreen(): React.JSX.Element {
  const completedJobs = useJobStore((state) => state.completedJobs);

  // 📊 Dynamic Metric Calculations based on live completed store history
  const storePayoutTotal = completedJobs.reduce((sum, job) => sum + (Number(job.price) || 0), 0);
  
  // Base baseline platform statistics combined with newly cleared dynamic session settlements
  const baseWeeklyEarnings = 0;
  const currentWeeklyTotal = baseWeeklyEarnings + storePayoutTotal;
  
  const baseTodayEarnings = 0;
  const currentTodayTotal = baseTodayEarnings + storePayoutTotal;

  const currentMonthTotal = storePayoutTotal;

  const weeklyGoal = 7500;
  const progressPercent = Math.min(Math.round((currentWeeklyTotal / weeklyGoal) * 100), 100);

  // Core structured settlement loop mapping platform payment providers (Yoco, PayFast)
  const basePayouts: Array<{ id: string; appliance: string; method: string; amount: number; date: string }> = [];

  // Dynamic cashout batch initialization logic
  const handleCashoutRequest = () => {
    Alert.alert(
      "Payout Batch Requested",
      `Your balance of R ${currentWeeklyTotal.toLocaleString()} has been queued for bank transfer batch processing.`,
      [{ text: "Awesome" }]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        <View style={styles.header}>
          <Text style={styles.title}>Earnings</Text>
          <Text style={styles.subtitle}>Real-time revenue metrics tracking</Text>
        </View>

        {/* Financial Metrics Progress Panel Card */}
        <View style={styles.mainBalanceCard}>
          <Text style={styles.balanceLabel}>TOTAL EARNED THIS WEEK</Text>
          <Text style={styles.balanceAmount}>R {currentWeeklyTotal.toLocaleString()}</Text>
          
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Weekly Progress Target</Text>
              <Text style={styles.progressValue}>{progressPercent}% (Goal: R {weeklyGoal})</Text>
            </View>
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${progressPercent}%` as any }]} />
            </View>
          </View>

          <View style={styles.divider} />
          
          <View style={styles.statsStrip}>
            <View style={styles.stripBox}>
              <Text style={styles.stripLabel}>Today</Text>
              <Text style={styles.stripValue}>R {currentTodayTotal.toLocaleString()}</Text>
            </View>
            <View style={styles.verticalDivider} />
            <View style={styles.stripBox}>
              <Text style={styles.stripLabel}>This Month</Text>
              <Text style={styles.stripValue}>R {currentMonthTotal.toLocaleString()}</Text>
            </View>
          </View>
        </View>

        {/* Graphical Analytical Layout Track */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Daily Activity Balance Blueprint</Text>
          <View style={styles.barChartWrapper}>
            {[
              { day: 'Mon', h: '65%', val: 'R1.2k' },
              { day: 'Tue', h: '85%', val: 'R1.8k' },
              { day: 'Wed', h: currentWeeklyTotal > baseWeeklyEarnings ? '50%' : '20%', val: 'Active', active: true },
              { day: 'Thu', h: '0%', val: '—' },
              { day: 'Fri', h: '0%', val: '—' },
              { day: 'Sat', h: '0%', val: '—' },
              { day: 'Sun', h: '0%', val: '—' },
            ].map((item, index) => (
              <View key={index} style={styles.chartColumn}>
                <View style={styles.barTrack}>
                  {/* 🚀 FIXED: Added the explicit casting constraint layout fix right here */}
                  <View style={[styles.barFill, { height: item.h as DimensionValue }, item.active && { backgroundColor: '#38BDF8' }]} />
                </View>
                <Text style={styles.dayLabel}>{item.day}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Transaction Ledger Section */}
        <Text style={styles.sectionTitle}>Recent Settlements</Text>
        
        {/* Render freshly completed live app tasks if present */}
        {completedJobs.map((job) => (
          <View key={job.id} style={styles.ledgerCard}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.ledgerAppliance} numberOfLines={1}>{job.applianceType}</Text>
              <Text style={styles.ledgerMeta}>Just Now • Completed (Job Pipeline)</Text>
            </View>
            <Text style={[styles.ledgerAmount, { color: '#00FF87' }]}>+R {job.price}</Text>
          </View>
        ))}

        {/* Regular base static listings */}
        {basePayouts.map((item) => (
          <View key={item.id} style={styles.ledgerCard}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.ledgerAppliance} numberOfLines={1}>{item.appliance}</Text>
              <Text style={styles.ledgerMeta}>{item.date} • {item.method}</Text>
            </View>
            <Text style={styles.ledgerAmount}>+R {item.amount}</Text>
          </View>
        ))}

        <TouchableOpacity 
          style={styles.cashoutButton} 
          activeOpacity={0.8}
          onPress={handleCashoutRequest}
        >
          <Text style={styles.cashoutText}>Request Payout Batch</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090D14' },
  scrollContainer: { padding: 20 },
  header: { marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '700', color: '#FFFFFF' },
  subtitle: { fontSize: 13, color: '#64748B', marginTop: 2 },
  mainBalanceCard: { backgroundColor: '#111827', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#1E293B', marginBottom: 16 },
  balanceLabel: { color: '#64748B', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  balanceAmount: { color: '#00FF87', fontSize: 32, fontWeight: '800', marginTop: 6, marginBottom: 15 },
  progressContainer: { marginBottom: 5 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { color: '#94A3B8', fontSize: 12 },
  progressValue: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  progressBarTrack: { height: 6, backgroundColor: '#1E293B', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#00FF87', borderRadius: 3 },
  divider: { height: 1, backgroundColor: '#1E293B', marginVertical: 18 },
  statsStrip: { flexDirection: 'row', justifyContent: 'space-between' },
  stripBox: { flex: 1, alignItems: 'center' },
  stripLabel: { color: '#64748B', fontSize: 12, marginBottom: 2 },
  stripValue: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  verticalDivider: { width: 1, backgroundColor: '#1E293B' },
  chartCard: { backgroundColor: '#111827', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#1E293B', marginBottom: 20 },
  chartTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', marginBottom: 15 },
  barChartWrapper: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 90 },
  chartColumn: { alignItems: 'center', flex: 1 },
  barTrack: { height: 70, width: 10, backgroundColor: '#1E293B', borderRadius: 5, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', backgroundColor: '#475569', borderRadius: 5 },
  dayLabel: { color: '#64748B', fontSize: 11, marginTop: 6, fontWeight: '600' },
  sectionTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginBottom: 12, marginTop: 4 },
  ledgerCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111827', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#1E293B', marginBottom: 10 },
  ledgerAppliance: { color: '#F8FAFC', fontSize: 14, fontWeight: '600' },
  ledgerMeta: { color: '#64748B', fontSize: 12, marginTop: 3 },
  ledgerAmount: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', minWidth: 60, textAlign: 'right' },
  cashoutButton: { backgroundColor: '#1E293B', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 10, marginBottom: 15, borderWidth: 1, borderColor: '#334155' },
  cashoutText: { color: '#00FF87', fontWeight: '700', fontSize: 14 },
});
