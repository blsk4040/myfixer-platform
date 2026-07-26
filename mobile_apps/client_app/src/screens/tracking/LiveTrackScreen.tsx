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
import {
  PriceBreakdown,
  formatMinorMoney,
  normalizePriceBreakdown,
  promotionDiscountMinor,
  promotionLabel,
  promotionSnapshots,
} from '../../utils/financialDisplay';
import { getProviderRoleForService } from '../../utils/providerRole';
import { Colors, Radius, Spacing } from '../../theme';

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
      Alert.alert('Payment confirmed', 'Padi verified the payment with Paystack. The provider can now begin work.');
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
        Alert.alert('Secure checkout opened', 'Padi will confirm the payment before work continues.');
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
      Alert.alert(
        'Completion confirmed',
        'Thanks. You can now rate this Padi job from your booking history.',
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Rate job', onPress: () => navigation.navigate('History') },
        ]
      );
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
      Alert.alert('Issue reported', 'Padi has been notified. Provider payout will remain on hold while this is reviewed.');
    } catch (error: any) {
      Alert.alert('Issue Error', error.message || 'Could not report this issue.');
    } finally {
      setIsCompletionActionLoading(false);
    }
  };

  const paymentStatusLabel = typeof paymentStatus === 'string' && paymentStatus.trim()
    ? paymentStatus.replace(/_/g, ' ')
    : 'PENDING';
  const quoteBreakdown = normalizePriceBreakdown(pendingQuote);
  const quotePromotions = promotionSnapshots(pendingQuote, quoteBreakdown);
  const quoteBreakdownRows = (breakdown: PriceBreakdown | null) => {
    if (!breakdown) return [];
    const currency = breakdown.currency || pendingQuote?.currency || '';
    return [
      ['Call-out Fee', breakdown.calloutFeeMinor],
      ['Labour', breakdown.labourMinor ?? breakdown.laborMinor],
      ['Parts', breakdown.partsMinor],
      ['Additional Services', breakdown.additionalServicesMinor],
      ['Surcharges', breakdown.surchargeMinor],
      ...quotePromotions.map((promotion) => [promotionLabel(promotion), -promotionDiscountMinor(promotion)] as [string, number]),
      ['Other Discount', breakdown.otherDiscountMinor ? -breakdown.otherDiscountMinor : 0],
      ['Subtotal', breakdown.subtotalMinor],
      ['Client Service Fee', breakdown.clientServiceFeeMinor],
      ['Tax', breakdown.taxMinor],
      ['Total', breakdown.totalMinor],
    ].filter(([, amount], index, list) => {
      const label = list[index][0];
      return ['Subtotal', 'Tax', 'Total'].includes(String(label)) || Number(amount || 0) !== 0;
    }).map(([label, amount]) => ({ label: String(label), amountMinor: Number(amount || 0), currency }));
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
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
            <Text style={styles.quoteTitle}>Approve Work Order {pendingQuote?.quoteNumber || (pendingQuote?.version ? `v${pendingQuote.version}` : '')}</Text>
            <Text style={styles.quoteSubtitle}>Review the {resolvedProviderRole.singular}'s quote before work continues.</Text>
            <Text style={styles.quoteWarning}>Padi keeps quote approval, checkout, invoices and support together for this booking.</Text>
            <Text style={styles.paymentStatusText}>Payment status: {paymentStatusLabel}</Text>

            <View style={styles.quoteLineList}>
              {quoteBreakdown ? quoteBreakdownRows(quoteBreakdown).map((item, index) => (
                <View key={`${item.label}-${index}`} style={styles.quoteLine}>
                  <Text style={item.amountMinor < 0 ? styles.quoteDiscountLabel : styles.quoteLineLabel}>{item.label}</Text>
                  <Text
                    style={item.amountMinor < 0 ? styles.quoteDiscountAmount : styles.quoteLineAmount}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {item.amountMinor < 0 ? '-' : ''}{formatMinorMoney(item.currency, Math.abs(item.amountMinor))}
                  </Text>
                </View>
              )) : pendingQuote?.lineItems.map((item, index) => (
                <View key={`${item.label}-${index}`} style={styles.quoteLine}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.quoteLineLabel}>{item.label}</Text>
                    <Text style={styles.quoteLineMeta}>{item.type} x {item.quantity}</Text>
                  </View>
                  <Text style={styles.quoteLineAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                    {formatMinorMoney(pendingQuote.currency, item.totalAmountMinor || Math.round(item.totalAmount * 100))}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.quoteTotalRow}>
              <Text style={styles.quoteTotalLabel}>Total</Text>
                <Text style={styles.quoteTotalAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.68}>
                  {formatMinorMoney(pendingQuote?.currency || '', quoteBreakdown?.totalMinor ?? pendingQuote?.totalAmountMinor ?? 0)}
                </Text>
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
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: Colors.textSubtle, fontSize: 14, marginTop: 12, fontWeight: '600' },
  mapViewport: { height: '45%', backgroundColor: Colors.surface, marginHorizontal: 16, marginTop: 10, borderRadius: Radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  mapGridLinesSim: { flex: 1, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  techMarkerPulse: { alignItems: 'center', position: 'absolute' },
  markerIcon: { color: Colors.primary, fontSize: 52, lineHeight: 52 },
  markerBadgeText: { color: Colors.primary, fontSize: 11, fontWeight: '700', backgroundColor: Colors.background, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: Colors.border, marginTop: 4, overflow: 'hidden' },
  searchingText: { color: Colors.textSubtle, fontSize: 13, fontWeight: '600' },
  hudWrapper: { flex: 1, backgroundColor: Colors.surface, margin: 16, marginTop: 8, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  hudScrollBody: { padding: 20, paddingBottom: 40 },
  identityContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: Colors.border, paddingBottom: 16, marginBottom: 16 },
  techAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surfaceRaised, marginRight: 12 },
  metaLeft: { flex: 1, paddingRight: 12 },
  techNameText: { color: Colors.text, fontSize: 18, fontWeight: '900' },
  techMetaText: { color: Colors.primary, fontSize: 12, fontWeight: '700', marginTop: 4 },
  etaBadgeSmall: { backgroundColor: 'rgba(184, 255, 61, 0.10)', borderWidth: 1, borderColor: Colors.primary, borderRadius: 10, minWidth: 96, minHeight: 52, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 },
  etaCalculatingText: { color: Colors.primary, fontSize: 11, fontWeight: '900', textAlign: 'center' },
  metricGrid: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  gridItem: { flex: 1, backgroundColor: Colors.background, padding: 12, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border },
  metricLabel: { color: Colors.textSubtle, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  metricValueText: { color: Colors.text, fontSize: 13, fontWeight: '700', marginTop: 4 },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  actionButton: { flex: 1, padding: 15, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  callButton: { backgroundColor: Colors.surfaceRaised, borderColor: Colors.borderStrong },
  chatButton: { backgroundColor: Colors.background, borderColor: Colors.border },
  actionButtonText: { color: Colors.text, fontSize: 14, fontWeight: '800' },
  completionCard: { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.borderStrong, borderRadius: Radius.md, padding: 14, marginTop: 14 },
  completionTitle: { color: Colors.text, fontSize: 15, fontWeight: '900' },
  completionText: { color: Colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 6 },
  completionActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  issueButton: { flex: 1, backgroundColor: Colors.surfaceRaised, borderWidth: 1, borderColor: Colors.amber, borderRadius: Radius.md, height: 46, alignItems: 'center', justifyContent: 'center' },
  confirmButton: { flex: 1.5, backgroundColor: Colors.primary, borderRadius: Radius.md, height: 46, alignItems: 'center', justifyContent: 'center' },
  quoteModalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  quoteModalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.xxl, borderWidth: 1, borderColor: Colors.border },
  quoteTitle: { color: Colors.text, fontSize: 18, fontWeight: '900' },
  quoteSubtitle: { color: Colors.textSubtle, fontSize: 12, marginTop: 4, marginBottom: 16 },
  quoteWarning: { color: Colors.amber, fontSize: 12, lineHeight: 18, marginBottom: 14 },
  paymentStatusText: { color: Colors.textMuted, fontSize: 12, fontWeight: '800', marginBottom: 12 },
  quoteLineList: { gap: 10 },
  quoteLine: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingBottom: 10 },
  quoteLineLabel: { flex: 1, color: Colors.text, fontSize: 14, fontWeight: '700' },
  quoteLineMeta: { color: Colors.textSubtle, fontSize: 11, marginTop: 2 },
  quoteLineAmount: { flexShrink: 1, maxWidth: 145, color: Colors.text, fontSize: 13, fontWeight: '700', textAlign: 'right' },
  quoteDiscountLabel: { flex: 1, color: Colors.primary, fontSize: 14, fontWeight: '800' },
  quoteDiscountAmount: { flexShrink: 1, maxWidth: 145, color: Colors.primary, fontSize: 13, fontWeight: '800', textAlign: 'right' },
  quoteTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: Colors.borderStrong },
  quoteTotalLabel: { flex: 1, color: Colors.text, fontSize: 16, fontWeight: '900' },
  quoteTotalAmount: { flexShrink: 1, maxWidth: 170, color: Colors.primary, fontSize: 18, fontWeight: '900', textAlign: 'right' },
  quoteNotes: { color: Colors.textMuted, fontSize: 12, marginTop: 12, lineHeight: 18 },
  quoteActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  quoteRejectButton: { flex: 1, backgroundColor: Colors.surfaceRaised, borderWidth: 1, borderColor: Colors.borderStrong, borderRadius: Radius.md, height: 48, alignItems: 'center', justifyContent: 'center' },
  quoteClarifyButton: { flex: 1, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.amber, borderRadius: Radius.md, height: 48, alignItems: 'center', justifyContent: 'center' },
  quoteApproveButton: { flex: 2, backgroundColor: Colors.primary, borderRadius: Radius.md, height: 48, alignItems: 'center', justifyContent: 'center' },
  quoteRejectText: { color: Colors.textMuted, fontSize: 14, fontWeight: '800' },
  quoteApproveText: { color: Colors.background, fontSize: 14, fontWeight: '900' },
});
