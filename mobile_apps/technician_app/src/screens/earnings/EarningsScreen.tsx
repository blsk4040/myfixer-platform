import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DimensionValue,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CreditCard, Wallet } from 'lucide-react-native';

import { useJobStore } from '../../store/useJobStore';
import apiService, { ProviderSettlementRecord, WalletBalanceResponse, WalletTransactionRecord } from '../../services/api.service';

const WalletIcon = Wallet as any;
const CreditCardIcon = CreditCard as any;

const formatMoney = (amount: number, currency = 'ZAR') => {
  try {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
};

const amountFromTransaction = (transaction: WalletTransactionRecord): number => {
  if (typeof transaction.amount === 'number') return transaction.amount;
  if (typeof transaction.amountMinor === 'number') return transaction.amountMinor / 100;
  return 0;
};

const startOfWeek = (date: Date): Date => {
  const start = new Date(date);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  return start;
};

export function EarningsScreen({ navigation }: any): React.JSX.Element {
  const completedJobs = useJobStore((state) => state.completedJobs);
  const [wallet, setWallet] = useState<WalletBalanceResponse | null>(null);
  const [transactions, setTransactions] = useState<WalletTransactionRecord[]>([]);
  const [settlements, setSettlements] = useState<ProviderSettlementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requestingPayout, setRequestingPayout] = useState(false);

  const storePayoutTotal = completedJobs.reduce((sum, job) => sum + (Number(job.price) || 0), 0);
  const currency = wallet?.currency || 'ZAR';
  const availableAmount = 0;
  const availableAmountMinor = 0;
  const pendingAmount = settlements
    .filter((settlement) => settlement.status !== 'PAID' && settlement.status !== 'CANCELLED' && settlement.status !== 'REVERSED')
    .reduce((sum, settlement) => sum + settlement.netAmountMinor / 100, 0);
  const totalEarnedEstimate = Math.max(storePayoutTotal, availableAmount + pendingAmount);
  const weeklyActivity = useMemo(() => {
    const weekStart = startOfWeek(new Date());
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + index);
      return { day, date, amount: 0 };
    });

    const addAmount = (rawDate: string | null | undefined, amount: number) => {
      if (!rawDate || amount <= 0) return;
      const date = new Date(rawDate);
      if (Number.isNaN(date.getTime()) || date < weekStart) return;
      const dayIndex = Math.floor((date.getTime() - weekStart.getTime()) / 86400000);
      if (dayIndex >= 0 && dayIndex < days.length) {
        days[dayIndex].amount += amount;
      }
    };

    settlements.forEach((settlement) => {
      addAmount(settlement.paidAt || settlement.readyForPayoutAt || settlement.completionConfirmedAt || settlement.createdAt, settlement.netAmountMinor / 100);
    });
    transactions.forEach((transaction) => {
      addAmount(transaction.createdAt, amountFromTransaction(transaction));
    });

    return days;
  }, [settlements, transactions]);
  const weeklyEarned = weeklyActivity.reduce((sum, item) => sum + item.amount, 0);
  const weeklyGoal = 7500;
  const progressPercent = Math.min(Math.round((weeklyEarned / weeklyGoal) * 100), 100);

  const chartBars = useMemo(() => {
    const maxAmount = Math.max(...weeklyActivity.map((item) => item.amount), 0);
    const todayLabel = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()];
    return weeklyActivity.map((item) => ({
      day: item.day,
      h: `${maxAmount > 0 ? Math.max(10, Math.round((item.amount / maxAmount) * 100)) : 10}%`,
      active: item.day === todayLabel,
    }));
  }, [weeklyActivity]);

  const loadWallet = useCallback(async () => {
    const [balanceResponse, transactionResponse, settlementResponse] = await Promise.all([
      apiService.getWalletBalance(),
      apiService.getWalletTransactions(),
      apiService.getMySettlements(),
    ]);
    setWallet(balanceResponse);
    setTransactions(transactionResponse.transactions || []);
    setSettlements(settlementResponse.settlements || []);
  }, []);

  useEffect(() => {
    loadWallet()
      .catch((error: Error) => Alert.alert('Earnings', error.message || 'Unable to load earnings.'))
      .finally(() => setLoading(false));
  }, [loadWallet]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await loadWallet();
    } catch (error) {
      Alert.alert('Earnings', error instanceof Error ? error.message : 'Unable to refresh earnings.');
    } finally {
      setRefreshing(false);
    }
  };

  const handlePayoutRequest = () => {
    if (availableAmountMinor <= 0) {
      Alert.alert(
        'Admin Approval Required',
        'Technician payouts are reviewed and initiated by MyFixer after completion confirmation. Direct payout requests are disabled during the pilot.'
      );
      return;
    }

    Alert.alert(
      'Request Payout?',
      `${formatMoney(availableAmount, currency)} will be requested for payout. Make sure your bank details are correct.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              setRequestingPayout(true);
              const response = await apiService.requestWalletCashout(availableAmountMinor);
              Alert.alert('Payout Requested', response.message || 'Your payout request has been sent.');
              await loadWallet();
            } catch (error) {
              Alert.alert('Payout Not Sent', error instanceof Error ? error.message : 'Unable to request payout.');
            } finally {
              setRequestingPayout(false);
            }
          },
        },
      ]
    );
  };

  const handleAddBankDetails = () => {
    navigation?.navigate?.('Profile', { screen: 'BankingInvoice' });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centered} edges={['top', 'left', 'right']}>
        <ActivityIndicator color="#00FF87" />
        <Text style={styles.loadingText}>Loading your earnings...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#00FF87" />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Earnings</Text>
          <Text style={styles.subtitle}>See what is available, what is still clearing, and your recent payments.</Text>
        </View>

        <View style={styles.mainBalanceCard}>
          <View style={styles.balanceHeader}>
            <View>
              <Text style={styles.balanceLabel}>AVAILABLE TO WITHDRAW</Text>
              <Text style={styles.balanceAmount}>{formatMoney(availableAmount, currency)}</Text>
            </View>
            <View style={styles.walletIconWrap}>
              <WalletIcon color="#00FF87" size={24} />
            </View>
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Weekly goal</Text>
              <Text style={styles.progressValue}>{formatMoney(weeklyEarned, currency)} of {formatMoney(weeklyGoal, currency)}</Text>
            </View>
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${progressPercent}%` as DimensionValue }]} />
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.statsStrip}>
            <View style={styles.stripBox}>
              <Text style={styles.stripLabel}>Pending clearance</Text>
              <Text style={styles.stripValue}>{formatMoney(pendingAmount, currency)}</Text>
            </View>
            <View style={styles.verticalDivider} />
            <View style={styles.stripBox}>
              <Text style={styles.stripLabel}>Total shown</Text>
              <Text style={styles.stripValue}>{formatMoney(totalEarnedEstimate, currency)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.payoutCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.payoutTitle}>Payout</Text>
            <Text style={styles.payoutText}>
              {availableAmountMinor > 0
                ? 'Eligible payouts are processed after admin approval.'
                : 'Payouts are reviewed by MyFixer after customer confirmation.'}
            </Text>
          </View>
          <CreditCardIcon color="#CBD5E1" size={22} />
        </View>

        <View style={styles.payoutActions}>
          <TouchableOpacity
            style={[styles.primaryButton, requestingPayout && styles.disabledButton]}
            activeOpacity={0.85}
            onPress={handlePayoutRequest}
            disabled={requestingPayout}
          >
            {requestingPayout ? <ActivityIndicator color="#090D14" /> : <Text style={styles.primaryButtonText}>Request Payout</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.85} onPress={handleAddBankDetails}>
            <Text style={styles.secondaryButtonText}>Bank Details</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Weekly activity</Text>
          <View style={styles.barChartWrapper}>
            {chartBars.map((item) => (
              <View key={item.day} style={styles.chartColumn}>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { height: item.h as DimensionValue }, item.active && { backgroundColor: '#38BDF8' }]} />
                </View>
                <Text style={styles.dayLabel}>{item.day}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Settlement earnings</Text>

        {settlements.length === 0 && transactions.length === 0 && completedJobs.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No payments yet</Text>
            <Text style={styles.emptyText}>Confirmed jobs and admin-approved payout records will appear here.</Text>
          </View>
        ) : (
          <>
            {settlements.map((settlement) => (
              <View key={settlement.id} style={styles.paymentCard}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.paymentTitle} numberOfLines={1}>Booking {settlement.bookingId.slice(-6).toUpperCase()}</Text>
                  <Text style={styles.paymentMeta}>{settlement.status.replace(/_/g, ' ')}</Text>
                </View>
                <Text style={styles.paymentAmount}>{formatMoney(settlement.netAmountMinor / 100, settlement.currency)}</Text>
              </View>
            ))}
            {transactions.map((transaction) => (
              <View key={transaction._id} style={styles.paymentCard}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.paymentTitle} numberOfLines={1}>{transaction.description || transaction.type || 'Wallet activity'}</Text>
                  <Text style={styles.paymentMeta}>{transaction.status || 'Recorded'}{transaction.createdAt ? ` - ${new Date(transaction.createdAt).toLocaleDateString()}` : ''}</Text>
                </View>
                <Text style={styles.paymentAmount}>{formatMoney(amountFromTransaction(transaction), transaction.currency || currency)}</Text>
              </View>
            ))}
            {transactions.length === 0 && completedJobs.map((job) => (
              <View key={job.id} style={styles.paymentCard}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.paymentTitle} numberOfLines={1}>{job.applianceType}</Text>
                  <Text style={styles.paymentMeta}>Completed job</Text>
                </View>
                <Text style={[styles.paymentAmount, { color: '#00FF87' }]}>+{formatMoney(Number(job.price) || 0, currency)}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090D14' },
  centered: { flex: 1, backgroundColor: '#090D14', alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#94A3B8', fontSize: 13, marginTop: 10 },
  scrollContainer: { padding: 20, paddingBottom: 100 },
  header: { marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '800', color: '#FFFFFF' },
  subtitle: { fontSize: 13, color: '#94A3B8', marginTop: 3, lineHeight: 19 },
  mainBalanceCard: { backgroundColor: '#111827', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#1E293B', marginBottom: 14 },
  balanceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  balanceLabel: { color: '#64748B', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  balanceAmount: { color: '#00FF87', fontSize: 32, fontWeight: '900', marginTop: 6, marginBottom: 15 },
  walletIconWrap: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#00FF8715', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#00FF8740' },
  progressContainer: { marginBottom: 5 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { color: '#94A3B8', fontSize: 12 },
  progressValue: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  progressBarTrack: { height: 6, backgroundColor: '#1E293B', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#00FF87', borderRadius: 3 },
  divider: { height: 1, backgroundColor: '#1E293B', marginVertical: 18 },
  statsStrip: { flexDirection: 'row', justifyContent: 'space-between' },
  stripBox: { flex: 1, alignItems: 'center' },
  stripLabel: { color: '#64748B', fontSize: 12, marginBottom: 2 },
  stripValue: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  verticalDivider: { width: 1, backgroundColor: '#1E293B' },
  payoutCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#111827', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#1E293B', marginBottom: 10 },
  payoutTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  payoutText: { color: '#94A3B8', fontSize: 12, lineHeight: 18, marginTop: 4 },
  payoutActions: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  primaryButton: { flex: 1.3, backgroundColor: '#00FF87', borderRadius: 12, minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#090D14', fontWeight: '900', fontSize: 14 },
  secondaryButton: { flex: 1, backgroundColor: '#1E293B', borderRadius: 12, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#334155' },
  secondaryButtonText: { color: '#E2E8F0', fontWeight: '800', fontSize: 14 },
  disabledButton: { opacity: 0.6 },
  chartCard: { backgroundColor: '#111827', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#1E293B', marginBottom: 20 },
  chartTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', marginBottom: 15 },
  barChartWrapper: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 90 },
  chartColumn: { alignItems: 'center', flex: 1 },
  barTrack: { height: 70, width: 10, backgroundColor: '#1E293B', borderRadius: 5, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', backgroundColor: '#475569', borderRadius: 5 },
  dayLabel: { color: '#64748B', fontSize: 11, marginTop: 6, fontWeight: '700' },
  sectionTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginBottom: 12, marginTop: 4 },
  emptyCard: { backgroundColor: '#111827', padding: 18, borderRadius: 12, borderWidth: 1, borderColor: '#1E293B', marginBottom: 10 },
  emptyTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  emptyText: { color: '#94A3B8', fontSize: 12, lineHeight: 18, marginTop: 4 },
  paymentCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111827', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#1E293B', marginBottom: 10 },
  paymentTitle: { color: '#F8FAFC', fontSize: 14, fontWeight: '700' },
  paymentMeta: { color: '#64748B', fontSize: 12, marginTop: 3 },
  paymentAmount: { color: '#00FF87', fontSize: 14, fontWeight: '800', minWidth: 80, textAlign: 'right' },
});
