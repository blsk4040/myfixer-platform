// src/screens/tracking/LiveTrackScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { initiateNativeCall } from '../../utils/communications';
import socketService from '../../services/socket.service';
import apiService, { JobQuote } from '../../services/api.service';
import { getProviderRoleForService } from '../../utils/providerRole';

interface TechnicianLocation {
  latitude: number;
  longitude: number;
  heading: number;
  speed: number;
  updatedAt: string;
}

export function LiveTrackScreen({ route, navigation }: any): React.JSX.Element {
  const {
    bookingId,
    jobId,
    techName,
    techPhone = '',
    techPhotoUrl = '',
    providerRole,
    providerRoleCapitalized,
    serviceKey,
    applianceType,
    currentStatus = 'Dispatched',
    lastGpsUpdate = '',
  } = route?.params || {};
  const trackingId = bookingId ?? jobId;
  const resolvedProviderRole = providerRole
    ? {
        singular: String(providerRole),
        capitalized: String(providerRoleCapitalized || providerRole).charAt(0).toUpperCase() + String(providerRoleCapitalized || providerRole).slice(1),
      }
    : getProviderRoleForService(serviceKey, applianceType);
  const displayProviderName = techName || `Assigned ${resolvedProviderRole.singular}`;

  const [isLoading, setIsLoading] = useState(true);
  const [techLocation, setTechLocation] = useState<TechnicianLocation | null>(null);
  const [pendingQuote, setPendingQuote] = useState<JobQuote | null>(null);
  const [isQuoteDecisionLoading, setIsQuoteDecisionLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string>('PENDING');
  const [completionPending, setCompletionPending] = useState(false);
  const [isCompletionActionLoading, setIsCompletionActionLoading] = useState(false);

  useEffect(() => {
    if (!trackingId) {
      setIsLoading(false);
      return undefined;
    }

    const socket = socketService.initializeConnection();
    const joinRoom = () => {
      setIsLoading(false);
      socketService.joinBookingRoom(trackingId);
    };
    const handleLocation = (data: TechnicianLocation) => {
      setTechLocation(data);
    };
    const handleQuote = (quote: JobQuote) => setPendingQuote(quote);
    const handlePaymentSecured = () => {
      setPaymentStatus('SECURED');
      Alert.alert('Payment confirmed', 'MyFixer verified the payment with Paystack. The provider can now begin work.');
      setPendingQuote(null);
    };
    const handlePaymentFailed = () => setPaymentStatus('FAILED');
    const handleCompletionSubmitted = () => {
      setCompletionPending(true);
      Alert.alert('Completion submitted', 'Inspect the work before confirming. Do not confirm until you are satisfied.');
    };
    const handleCompletionConfirmed = () => setCompletionPending(false);

    socket.on('connect', joinRoom);
    socket.on('job_location_changed', handleLocation);
    socket.on('quote_sent', handleQuote);
    socket.on('quote_submitted', handleQuote);
    socket.on('quote_revised', handleQuote);
    socket.on('payment_secured', handlePaymentSecured);
    socket.on('payment_failed', handlePaymentFailed);
    socket.on('completion_submitted', handleCompletionSubmitted);
    socket.on('completion_confirmed', handleCompletionConfirmed);
    socket.on('connect_error', () => setIsLoading(false));
    if (socket.connected) joinRoom();

    return () => {
      socket.off('connect', joinRoom);
      socket.off('job_location_changed', handleLocation);
      socket.off('quote_sent', handleQuote);
      socket.off('quote_submitted', handleQuote);
      socket.off('quote_revised', handleQuote);
      socket.off('payment_secured', handlePaymentSecured);
      socket.off('payment_failed', handlePaymentFailed);
      socket.off('completion_submitted', handleCompletionSubmitted);
      socket.off('completion_confirmed', handleCompletionConfirmed);
      socket.off('connect_error');
    };
  }, [trackingId]);

  useEffect(() => {
    let isMounted = true;
    const loadPaymentStatus = async () => {
      if (!trackingId) return;
      try {
        const response = await apiService.getBookingPaymentStatus(trackingId);
        if (isMounted) setPaymentStatus(response.paymentStatus);
      } catch {
        // Quote and socket flows still work if this optional status refresh fails.
      }
    };
    void loadPaymentStatus();
    return () => { isMounted = false; };
  }, [trackingId]);

  useEffect(() => {
    let isMounted = true;

    const loadPendingQuote = async () => {
      if (!trackingId) return;
      try {
        const response = await apiService.getBookingQuotes(trackingId);
        const quote = response.quotes.find((item) => item.status === 'SUBMITTED' || item.status === 'SENT_TO_CLIENT');
        if (isMounted && quote) setPendingQuote(quote);
      } catch {
        // Socket updates still surface new quotes.
      }
    };

    void loadPendingQuote();
    return () => { isMounted = false; };
  }, [trackingId]);

  const handleQuoteDecision = async (decision: 'APPROVE' | 'REJECT') => {
    if (!pendingQuote) return;

    try {
      setIsQuoteDecisionLoading(true);
      if (decision === 'APPROVE') {
        await apiService.approveJobQuote(pendingQuote.id);
        const initialized = await apiService.initializePayment({
          bookingId: pendingQuote.bookingId,
          quoteId: pendingQuote.id,
          idempotencyKey: `quote:${pendingQuote.id}:payment`,
        });
        setPaymentStatus(initialized.payment.status);
        await Linking.openURL(initialized.payment.authorizationUrl);
        Alert.alert('Paystack checkout opened', 'Payment is confirmed only after MyFixer verifies it with Paystack.');
      } else {
        await apiService.rejectJobQuote(pendingQuote.id, 'Client rejected the quote in the app.');
        Alert.alert('Quote Rejected', `The ${resolvedProviderRole.singular} has been notified.`);
      }
      if (decision === 'REJECT') setPendingQuote(null);
    } catch (error: any) {
      Alert.alert('Quote Error', error.message || 'Could not update quote.');
    } finally {
      setIsQuoteDecisionLoading(false);
    }
  };

  const handleClarificationRequest = async () => {
    if (!pendingQuote) return;
    try {
      setIsQuoteDecisionLoading(true);
      await apiService.requestQuoteClarification(pendingQuote.id, 'Please clarify this quote before I approve it.');
      Alert.alert('Clarification requested', `The ${resolvedProviderRole.singular} has been asked to send a revised quote.`);
      setPendingQuote(null);
    } catch (error: any) {
      Alert.alert('Quote Error', error.message || 'Could not request clarification.');
    } finally {
      setIsQuoteDecisionLoading(false);
    }
  };

  const handleConfirmCompletion = async () => {
    if (!trackingId) return;
    try {
      setIsCompletionActionLoading(true);
      await apiService.confirmCompletion(trackingId, `completion-confirm:${trackingId}`);
      setCompletionPending(false);
      Alert.alert('Completion confirmed', 'Thanks. The provider earning is now eligible for MyFixer review and admin-approved payout.');
    } catch (error: any) {
      Alert.alert('Completion Error', error.message || 'Could not confirm completion.');
    } finally {
      setIsCompletionActionLoading(false);
    }
  };

  const handleReportCompletionIssue = async () => {
    if (!trackingId) return;
    try {
      setIsCompletionActionLoading(true);
      await apiService.reportCompletionIssue(trackingId, 'Customer reported an issue from the tracking screen.');
      setCompletionPending(false);
      Alert.alert('Issue reported', 'MyFixer has been notified. Provider payout will remain on hold while this is reviewed.');
    } catch (error: any) {
      Alert.alert('Issue Error', error.message || 'Could not report this issue.');
    } finally {
      setIsCompletionActionLoading(false);
    }
  };

  const paymentStatusLabel = typeof paymentStatus === 'string' && paymentStatus.trim()
    ? paymentStatus.replace(/_/g, ' ')
    : 'PENDING';

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00FF87" />
        <Text style={styles.loadingText}>Connecting to live tracking...</Text>
      </View>
    );
  }

  if (!trackingId) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>No active booking selected for live tracking.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.mapViewport}>
        <View style={styles.mapGridLinesSim}>
          {techLocation ? (
            <View style={styles.techMarkerPulse}>
              <Text style={styles.markerIcon}>•</Text>
              <Text style={styles.markerBadgeText}>{displayProviderName.split(' ')[0]}</Text>
            </View>
          ) : (
            <Text style={styles.searchingText}>Waiting for the {resolvedProviderRole.singular}'s latest location...</Text>
          )}
        </View>
      </View>

      <View style={styles.hudWrapper}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.hudScrollBody}>
          <View style={styles.identityContainer}>
            {techPhotoUrl ? <Image source={{ uri: techPhotoUrl }} style={styles.techAvatar} /> : null}
            <View style={styles.metaLeft}>
              <Text style={styles.techNameText} numberOfLines={1}>{displayProviderName}</Text>
              <Text style={styles.techMetaText}>Verified {resolvedProviderRole.singular}</Text>
            </View>
            <View style={styles.etaBadgeSmall}>
              <Text style={styles.etaCalculatingText}>ETA calculating...</Text>
            </View>
          </View>

          <View style={styles.metricGrid}>
            <View style={styles.gridItem}>
              <Text style={styles.metricLabel}>STATUS</Text>
              <Text style={styles.metricValueText}>{techLocation ? 'En route' : currentStatus}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.metricLabel}>LAST GPS</Text>
              <Text style={styles.metricValueText}>
                {techLocation?.updatedAt
                  ? new Date(techLocation.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : lastGpsUpdate ? new Date(lastGpsUpdate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Waiting'}
              </Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.actionButton, styles.callButton]} activeOpacity={0.8} onPress={() => initiateNativeCall(techPhone)}>
              <Text style={styles.actionButtonText}>Call</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.chatButton]}
              activeOpacity={0.8}
              onPress={() => Alert.alert('Chat Unavailable', `Chat is not available for this booking yet. You can still call your ${resolvedProviderRole.singular}.`)}
            >
              <Text style={styles.actionButtonText}>Chat</Text>
            </TouchableOpacity>
          </View>
          {completionPending ? (
            <View style={styles.completionCard}>
              <Text style={styles.completionTitle}>Provider marked the work complete</Text>
              <Text style={styles.completionText}>Inspect the work before confirming. Do not confirm until you are satisfied.</Text>
              <View style={styles.completionActions}>
                <TouchableOpacity style={styles.issueButton} onPress={handleReportCompletionIssue} disabled={isCompletionActionLoading}>
                  <Text style={styles.quoteRejectText}>Report Issue</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmCompletion} disabled={isCompletionActionLoading}>
                  <Text style={styles.quoteApproveText}>{isCompletionActionLoading ? 'Working...' : 'Confirm Completion'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </ScrollView>
      </View>

      <Modal visible={!!pendingQuote} animationType="slide" transparent onRequestClose={() => setPendingQuote(null)}>
        <View style={styles.quoteModalOverlay}>
          <View style={styles.quoteModalContent}>
            <Text style={styles.quoteTitle}>Approve Work Order {pendingQuote?.version ? `v${pendingQuote.version}` : ''}</Text>
            <Text style={styles.quoteSubtitle}>Review the {resolvedProviderRole.singular}'s quote before work continues.</Text>
            <Text style={styles.quoteWarning}>Only pay through MyFixer. Payments made outside the app may not qualify for refunds, dispute support, invoices or service guarantees.</Text>
            <Text style={styles.paymentStatusText}>Payment status: {paymentStatusLabel}</Text>

            <View style={styles.quoteLineList}>
              {pendingQuote?.lineItems.map((item, index) => (
                <View key={`${item.label}-${index}`} style={styles.quoteLine}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.quoteLineLabel}>{item.label}</Text>
                    <Text style={styles.quoteLineMeta}>{item.type} x {item.quantity}</Text>
                  </View>
                  <Text style={styles.quoteLineAmount}>{pendingQuote.currency} {item.totalAmount.toFixed(2)}</Text>
                </View>
              ))}
            </View>

            <View style={styles.quoteTotalRow}>
              <Text style={styles.quoteTotalLabel}>Total</Text>
              <Text style={styles.quoteTotalAmount}>{pendingQuote?.currency} {pendingQuote?.totalAmount.toFixed(2)}</Text>
            </View>

            {pendingQuote?.technicianNotes ? <Text style={styles.quoteNotes}>{pendingQuote.technicianNotes}</Text> : null}

            <View style={styles.quoteActions}>
              <TouchableOpacity style={styles.quoteRejectButton} onPress={() => handleQuoteDecision('REJECT')} disabled={isQuoteDecisionLoading}>
                <Text style={styles.quoteRejectText}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quoteClarifyButton} onPress={handleClarificationRequest} disabled={isQuoteDecisionLoading}>
                <Text style={styles.quoteRejectText}>Clarify</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quoteApproveButton} onPress={() => handleQuoteDecision('APPROVE')} disabled={isQuoteDecisionLoading}>
                <Text style={styles.quoteApproveText}>{isQuoteDecisionLoading ? 'Working...' : 'Approve'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090D14' },
  loadingContainer: { flex: 1, backgroundColor: '#090D14', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#64748B', fontSize: 14, marginTop: 12, fontWeight: '600' },
  mapViewport: { height: '45%', backgroundColor: '#111827', marginHorizontal: 16, marginTop: 10, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#1E293B' },
  mapGridLinesSim: { flex: 1, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  techMarkerPulse: { alignItems: 'center', position: 'absolute' },
  markerIcon: { color: '#00FF87', fontSize: 52, lineHeight: 52 },
  markerBadgeText: { color: '#00FF87', fontSize: 11, fontWeight: '700', backgroundColor: '#090D14', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#1E293B', marginTop: 4, overflow: 'hidden' },
  searchingText: { color: '#475569', fontSize: 13, fontWeight: '500' },
  hudWrapper: { flex: 1, backgroundColor: '#111827', margin: 16, marginTop: 8, borderRadius: 20, borderWidth: 1, borderColor: '#1E293B', overflow: 'hidden' },
  hudScrollBody: { padding: 20, paddingBottom: 40 },
  identityContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#1E293B', paddingBottom: 16, marginBottom: 16 },
  techAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1E293B', marginRight: 12 },
  metaLeft: { flex: 1, paddingRight: 12 },
  techNameText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  techMetaText: { color: '#00FF87', fontSize: 12, fontWeight: '600', marginTop: 4 },
  etaBadgeSmall: { backgroundColor: '#00FF8710', borderWidth: 1, borderColor: '#00FF87', borderRadius: 10, minWidth: 96, minHeight: 52, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 },
  etaCalculatingText: { color: '#00FF87', fontSize: 11, fontWeight: '800', textAlign: 'center' },
  metricGrid: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  gridItem: { flex: 1, backgroundColor: '#090D14', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#1E293B' },
  metricLabel: { color: '#64748B', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  metricValueText: { color: '#E2E8F0', fontSize: 13, fontWeight: '600', marginTop: 4 },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  actionButton: { flex: 1, padding: 15, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  callButton: { backgroundColor: '#1E293B', borderColor: '#334155' },
  chatButton: { backgroundColor: '#090D14', borderColor: '#1E293B' },
  actionButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  completionCard: { backgroundColor: '#090D14', borderWidth: 1, borderColor: '#334155', borderRadius: 12, padding: 14, marginTop: 14 },
  completionTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  completionText: { color: '#CBD5E1', fontSize: 12, lineHeight: 18, marginTop: 6 },
  completionActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  issueButton: { flex: 1, backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#F59E0B', borderRadius: 12, height: 46, alignItems: 'center', justifyContent: 'center' },
  confirmButton: { flex: 1.5, backgroundColor: '#00FF87', borderRadius: 12, height: 46, alignItems: 'center', justifyContent: 'center' },
  quoteModalOverlay: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end' },
  quoteModalContent: { backgroundColor: '#111827', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderWidth: 1, borderColor: '#1E293B' },
  quoteTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  quoteSubtitle: { color: '#64748B', fontSize: 12, marginTop: 4, marginBottom: 16 },
  quoteWarning: { color: '#FBBF24', fontSize: 12, lineHeight: 18, marginBottom: 14 },
  paymentStatusText: { color: '#CBD5E1', fontSize: 12, fontWeight: '700', marginBottom: 12 },
  quoteLineList: { gap: 10 },
  quoteLine: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#1E293B', paddingBottom: 10 },
  quoteLineLabel: { color: '#E2E8F0', fontSize: 14, fontWeight: '700' },
  quoteLineMeta: { color: '#64748B', fontSize: 11, marginTop: 2 },
  quoteLineAmount: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  quoteTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#334155' },
  quoteTotalLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  quoteTotalAmount: { color: '#00FF87', fontSize: 18, fontWeight: '900' },
  quoteNotes: { color: '#94A3B8', fontSize: 12, marginTop: 12, lineHeight: 18 },
  quoteActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  quoteRejectButton: { flex: 1, backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155', borderRadius: 12, height: 48, alignItems: 'center', justifyContent: 'center' },
  quoteClarifyButton: { flex: 1, backgroundColor: '#111827', borderWidth: 1, borderColor: '#F59E0B', borderRadius: 12, height: 48, alignItems: 'center', justifyContent: 'center' },
  quoteApproveButton: { flex: 2, backgroundColor: '#00FF87', borderRadius: 12, height: 48, alignItems: 'center', justifyContent: 'center' },
  quoteRejectText: { color: '#94A3B8', fontSize: 14, fontWeight: '700' },
  quoteApproveText: { color: '#090D14', fontSize: 14, fontWeight: '800' },
});
