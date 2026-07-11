import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Pause, Play, Receipt, XCircle } from 'lucide-react-native';
import apiService, {
  ManagedCollectionSubscriptionPlan,
  ManagedCollectionSubscriptionRecord,
} from '../../services/api.service';
import authService from '../../services/auth.service';

const money = (minor?: number, currency = 'ZMW') =>
  typeof minor === 'number' ? `${currency} ${(minor / 100).toFixed(2)}` : '-';

export function SubscriptionDashboardScreen(): React.JSX.Element {
  const [plans, setPlans] = useState<ManagedCollectionSubscriptionPlan[]>([]);
  const [current, setCurrent] = useState<ManagedCollectionSubscriptionRecord | null>(null);
  const [invoices, setInvoices] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unavailableMessage, setUnavailableMessage] = useState('');

  const load = useCallback(async () => {
    const session = authService.getSession();
    const countryCode = session?.user.countryCode;
    if (!countryCode) {
      setUnavailableMessage('Please complete your account country before using Managed Collection subscriptions.');
      setPlans([]);
      setCurrent(null);
      setInvoices([]);
      return;
    }

    const availability = await apiService.getMarketAvailability({
      countryCode,
      city: session.user.location?.city,
      area: session.user.location?.area,
    });
    const managedCollection = availability.availability.services.find((service) => service.serviceKey === 'managed_collection');
    if (!managedCollection?.canBook) {
      setUnavailableMessage(managedCollection?.message || 'Managed Collection subscriptions are not available in your country yet.');
      setPlans([]);
      setCurrent(null);
      setInvoices([]);
      return;
    }

    setUnavailableMessage('');
    const [planResult, dashboard] = await Promise.all([
      apiService.getManagedCollectionPlans(countryCode),
      apiService.getManagedCollectionSubscriptionDashboard(),
    ]);
    setPlans(planResult.plans || []);
    setCurrent(dashboard.currentSubscription || null);
    setInvoices(dashboard.invoices || []);
  }, []);

  useEffect(() => {
    load()
      .catch((error: Error) => Alert.alert('Subscriptions', error.message))
      .finally(() => setLoading(false));
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } catch (error) {
      Alert.alert('Subscriptions', error instanceof Error ? error.message : 'Unable to refresh subscriptions.');
    } finally {
      setRefreshing(false);
    }
  };

  const subscribe = async (planId: string) => {
    try {
      if (current) {
        const targetPlan = plans.find((plan) => plan._id === planId);
        const action = targetPlan && targetPlan.priceMinor > current.priceMinor ? 'UPGRADE' : 'DOWNGRADE';
        await apiService.updateManagedCollectionSubscription(current._id, action, planId);
      } else {
        await apiService.createManagedCollectionSubscription(planId);
      }
      await load();
      Alert.alert('Subscription', current ? 'Subscription plan updated.' : 'Subscription created. Your first invoice has been generated.');
    } catch (error) {
      Alert.alert('Subscription', error instanceof Error ? error.message : 'Unable to subscribe.');
    }
  };

  const update = async (action: 'PAUSE' | 'RESUME' | 'CANCEL') => {
    if (!current) return;
    try {
      await apiService.updateManagedCollectionSubscription(current._id, action);
      await load();
    } catch (error) {
      Alert.alert('Subscription', error instanceof Error ? error.message : 'Unable to update subscription.');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#00FF87" />
        <Text style={styles.muted}>Loading subscription dashboard...</Text>
      </View>
    );
  }

  if (unavailableMessage) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Managed Collection</Text>
        <Text style={styles.muted}>{unavailableMessage}</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={plans}
      keyExtractor={(item) => item._id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#00FF87" />}
      ListHeaderComponent={(
        <View>
          <Text style={styles.eyebrow}>Managed Collection Services</Text>
          <Text style={styles.title}>Subscription</Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Current Plan</Text>
            {current ? (
              <>
                <Text style={styles.planName}>{current.planName}</Text>
                <Text style={styles.meta}>{money(current.priceMinor, current.currency)} - {current.billingFrequency}</Text>
                <Text style={styles.meta}>Next billing: {new Date(current.nextBillingDate).toLocaleDateString()}</Text>
                <Text style={styles.status}>{current.status}</Text>
                <View style={styles.actions}>
                  {current.status === 'ACTIVE' && (
                    <TouchableOpacity style={styles.actionButton} onPress={() => update('PAUSE')}>
                      <Pause color="#CBD5E1" size={16} />
                      <Text style={styles.actionText}>Pause</Text>
                    </TouchableOpacity>
                  )}
                  {current.status === 'PAUSED' && (
                    <TouchableOpacity style={styles.actionButton} onPress={() => update('RESUME')}>
                      <Play color="#00FF87" size={16} />
                      <Text style={styles.actionText}>Resume</Text>
                    </TouchableOpacity>
                  )}
                  {!['CANCELLED', 'EXPIRED'].includes(current.status) && (
                    <TouchableOpacity style={styles.actionButton} onPress={() => update('CANCEL')}>
                      <XCircle color="#F87171" size={16} />
                      <Text style={styles.actionText}>Cancel</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            ) : (
              <Text style={styles.muted}>No managed collection subscription active.</Text>
            )}
          </View>
          <Text style={styles.sectionTitle}>Available Plans</Text>
        </View>
      )}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.planName}>{item.name}</Text>
          <Text style={styles.message}>{item.description || 'Managed Collection Services plan'}</Text>
          <Text style={styles.meta}>{money(item.priceMinor, item.currency)} - {item.billingFrequency}</Text>
          <Text style={styles.meta}>{item.collectionFrequency} - {(item.binPackage || []).join(', ')}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => subscribe(item._id)}>
            <Text style={styles.primaryText}>{current ? 'Change to this plan' : 'Subscribe'}</Text>
          </TouchableOpacity>
        </View>
      )}
      ListFooterComponent={(
        <View>
          <Text style={styles.sectionTitle}>Billing History</Text>
          {invoices.length ? invoices.map((invoice) => (
            <View style={styles.invoiceRow} key={String(invoice._id || invoice.invoiceNumber)}>
              <Receipt color="#CBD5E1" size={16} />
              <View style={{ flex: 1 }}>
                <Text style={styles.message}>{String(invoice.invoiceNumber || '-')}</Text>
                <Text style={styles.meta}>{String(invoice.status || '-')} - {money(invoice.amountMinor as number, String(invoice.currency || 'ZMW'))}</Text>
              </View>
            </View>
          )) : <Text style={styles.empty}>No subscription invoices yet.</Text>}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#090D14' },
  content: { padding: 18, paddingBottom: 110, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#090D14', gap: 10 },
  eyebrow: { color: '#00FF87', fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', marginTop: 4, marginBottom: 16 },
  sectionTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginTop: 18, marginBottom: 10 },
  card: { backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#1E293B', borderRadius: 12, padding: 14, marginBottom: 12 },
  cardTitle: { color: '#94A3B8', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  planName: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginTop: 6 },
  message: { color: '#CBD5E1', fontSize: 13, lineHeight: 20, marginTop: 6 },
  muted: { color: '#94A3B8', fontSize: 13 },
  meta: { color: '#94A3B8', fontSize: 12, marginTop: 5 },
  status: { alignSelf: 'flex-start', marginTop: 10, color: '#052E16', backgroundColor: '#00FF87', fontSize: 11, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  actionButton: { height: 36, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#111827', borderWidth: 1, borderColor: '#1E293B', flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { color: '#CBD5E1', fontSize: 12, fontWeight: '700' },
  primaryButton: { marginTop: 12, height: 42, borderRadius: 8, backgroundColor: '#00FF87', alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#052E16', fontSize: 13, fontWeight: '800' },
  invoiceRow: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#1E293B', borderRadius: 10, padding: 12, marginBottom: 8 },
  empty: { color: '#94A3B8', textAlign: 'center', marginVertical: 20 },
});

export default SubscriptionDashboardScreen;
