import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { CheckCircle2 as LucideCheckCircle, FileText as LucideFileText, X as LucideX } from 'lucide-react-native';
import apiService, { BookingHistoryItem } from '../../services/api.service';
import { formatBookingStatus } from '../../types/booking';
import { Colors, Radius, Spacing } from '../../theme';
import { customerErrorMessage } from '../../utils/userFacingErrors';
import {
  PriceBreakdown,
  formatMinorMoney,
  normalizePriceBreakdown,
  promotionDiscountMinor,
  promotionLabel,
  promotionSnapshots,
} from '../../utils/financialDisplay';

const FileText = LucideFileText as any;
const X = LucideX as any;
const CheckCircle = LucideCheckCircle as any;

const money = (currency: string, amountMinor = 0) => formatMinorMoney(currency, amountMinor);

export function BookingHistoryScreen(): React.JSX.Element {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<BookingHistoryItem[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<BookingHistoryItem | null>(null);
  const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);

  useEffect(() => {
    const fetchHistoryData = async () => {
      try {
        setLoading(true);
        const response = await apiService.getMyBookingHistory();
        setBookings(response.bookings || []);
      } catch (error) {
        Alert.alert('History', customerErrorMessage(error, 'Unable to load your booking history right now.'));
      } finally {
        setLoading(false);
      }
    };

    void fetchHistoryData();
  }, []);

  const handleViewInvoice = (item: BookingHistoryItem) => {
    if (!item.invoice) return;
    setSelectedBooking(item);
    setInvoiceModalVisible(true);
  };

  const handleBookAgain = (item: BookingHistoryItem) => {
    if (item.status !== 'COMPLETED') {
      Alert.alert('Book Again', 'You can rebook a provider after a completed Padi job.');
      return;
    }

    const hasPreferredProvider = Boolean(item.technician?.id);
    Alert.alert(
      'Book through Padi',
      hasPreferredProvider
        ? `We will prioritize ${item.technician?.name || 'your previous provider'} if they are available while keeping payment, tracking, support, and job protection inside Padi.`
        : 'This will create a fresh request for the same service. Preferred provider rebooking is only available after a completed job with an assigned provider.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => navigation.navigate('BookingWizard', {
            category: item.serviceKey || 'maintenance',
            serviceKey: item.serviceKey || 'maintenance',
            subCategory: item.applianceType,
            basePrice: Math.round((item.priceMinor || 0) / 100),
            preferredTechnicianId: hasPreferredProvider ? item.technician?.id : undefined,
            preferredTechnicianName: hasPreferredProvider ? item.technician?.name : undefined,
            rebookFromBookingId: hasPreferredProvider ? item.id : undefined,
          }),
        },
      ]
    );
  };

  const renderBookingItem = ({ item }: { item: BookingHistoryItem }) => {
    const statusColor = item.status === 'COMPLETED' ? Colors.primary : Colors.danger;
    const completedDate = new Date(item.completedAt || item.cancelledAt || item.updatedAt).toLocaleDateString();

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.categoryRow}>
            {item.technician?.profilePhotoUrl ? (
              <Image source={{ uri: item.technician.profilePhotoUrl }} style={styles.techAvatar} />
            ) : (
              <Text style={styles.icon}>•</Text>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.categoryText}>{item.applianceType}</Text>
              <Text style={styles.jobId}>{item.generalArea || item.fullAddress || 'Service address'}</Text>
              {item.technician?.name ? <Text style={styles.techName}>Handled by {item.technician.name}</Text> : null}
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}10`, borderColor: statusColor }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{formatBookingStatus(item.status)}</Text>
          </View>
        </View>

        <Text style={styles.serviceDetails}>{item.faultDescription || 'Service booking'}</Text>

        <View style={styles.cardFooter}>
          <Text style={styles.dateText}>{item.status === 'COMPLETED' ? 'Completed' : 'Updated'}: {completedDate}</Text>

          <View style={styles.footerActions}>
            {item.status === 'COMPLETED' ? (
              <TouchableOpacity style={styles.rebookButton} onPress={() => handleBookAgain(item)}>
                <Text style={styles.rebookButtonText}>Book again</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={styles.invoiceButton}
              onPress={() => handleViewInvoice(item)}
              disabled={!item.invoice}
            >
              <FileText color={item.invoice ? Colors.primary : Colors.textSubtle} size={14} style={{ marginRight: 6 }} />
              <Text style={[styles.invoiceButtonText, !item.invoice && { color: Colors.textSubtle }]}>Invoice</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const invoice = selectedBooking?.invoice;
  const currency = selectedBooking?.currency || invoice?.priceBreakdown?.currency || '';
  const invoiceBreakdown = normalizePriceBreakdown(invoice);
  const invoicePromotions = promotionSnapshots(invoice, invoiceBreakdown);
  const legacyPromoDiscountMinor = Number(invoice?.promoDiscountMinor || invoice?.priceBreakdown?.promotionDiscountMinor || 0);
  const invoiceRows = (breakdown: PriceBreakdown | null) => {
    if (!breakdown) return [];
    return [
      ['Call-out Fee', breakdown.calloutFeeMinor],
      ['Labour', breakdown.labourMinor ?? breakdown.laborMinor],
      ['Parts', breakdown.partsMinor],
      ['Additional Services', breakdown.additionalServicesMinor],
      ['Surcharges', breakdown.surchargeMinor],
      ...invoicePromotions.map((promotion) => [promotionLabel(promotion), -promotionDiscountMinor(promotion)] as [string, number]),
      ['Other Discounts', breakdown.otherDiscountMinor ? -breakdown.otherDiscountMinor : 0],
      ['Subtotal', breakdown.subtotalMinor],
      ['Client Service Fee', breakdown.clientServiceFeeMinor],
      ['Tax', breakdown.taxMinor],
      ['Total', breakdown.totalMinor],
    ].filter(([label, amount]) => ['Subtotal', 'Tax', 'Total'].includes(String(label)) || Number(amount || 0) !== 0);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#00FF87" />
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          renderItem={renderBookingItem}
          ListHeaderComponent={
            <View style={styles.screenHeader}>
              <Text style={styles.screenTitle}>History</Text>
              <Text style={styles.screenSubtitle}>Completed, cancelled and invoiced bookings</Text>
            </View>
          }
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyText}>No bookings yet. Completed and cancelled bookings will appear here.</Text></View>}
        />
      )}

      <Modal visible={invoiceModalVisible} animationType="slide" transparent onRequestClose={() => setInvoiceModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.taxTitle}>TAX INVOICE</Text>
                <Text style={styles.invoiceNum}>{invoice?.invoiceNumber}</Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={() => setInvoiceModalVisible(false)}>
                <X color="#FFFFFF" size={20} />
              </TouchableOpacity>
            </View>

            <View style={styles.invoiceBody}>
              {invoiceBreakdown ? invoiceRows(invoiceBreakdown).map(([label, amount]) => (
                <View key={String(label)} style={styles.invoiceRow}>
                  <Text style={Number(amount) < 0 ? styles.discountLabel : String(label) === 'Total' ? styles.totalLabel : styles.billingLabel}>{String(label)}</Text>
                  <Text
                    style={Number(amount) < 0 ? styles.discountValue : String(label) === 'Total' ? styles.totalValue : styles.billingValue}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {Number(amount) < 0 ? '-' : ''}{money(currency, Math.abs(Number(amount || 0)))}
                  </Text>
                </View>
              )) : (
                <>
                  <View style={styles.invoiceRow}><Text style={styles.billingLabel}>Call-out Fee</Text><Text style={styles.billingValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{money(currency, invoice?.baseAmountMinor)}</Text></View>
                  <View style={styles.invoiceRow}><Text style={styles.billingLabel}>Extended Labour Charges</Text><Text style={styles.billingValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{money(currency, invoice?.additionalLaborMinor)}</Text></View>
                  <View style={styles.invoiceRow}><Text style={styles.billingLabel}>Materials & Parts</Text><Text style={styles.billingValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{money(currency, invoice?.partsAmountMinor)}</Text></View>
                  {legacyPromoDiscountMinor > 0 ? (
                    <View style={styles.invoiceRow}><Text style={styles.discountLabel}>{promotionLabel(invoice?.promotion || {})}</Text><Text style={styles.discountValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>-{money(currency, legacyPromoDiscountMinor)}</Text></View>
                  ) : null}
                  <View style={styles.totalDivider} />
                  <View style={styles.invoiceRow}><Text style={styles.totalLabel}>Total Paid Balance</Text><Text style={styles.totalValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.68}>{money(currency, invoice?.totalAmountMinor)}</Text></View>
                </>
              )}
              <View style={styles.invoiceRow}><Text style={styles.billingLabel}>Payment Status</Text><Text style={styles.billingValue}>{invoice?.status || 'Unavailable'}</Text></View>
              <View style={styles.totalDivider} />

              <View style={styles.complianceBox}>
                <CheckCircle color={Colors.primary} size={16} style={{ marginRight: 8 }} />
                <Text style={styles.complianceText}>A copy of this invoice has been sent to your registered email profile.</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.dismissBtn} onPress={() => setInvoiceModalVisible(false)}>
              <Text style={styles.dismissBtnText}>Dismiss Summary</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  listContainer: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, paddingBottom: 112 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  screenHeader: { marginBottom: Spacing.xl },
  screenTitle: { color: Colors.text, fontSize: 28, fontWeight: '900' },
  screenSubtitle: { color: Colors.textSubtle, fontSize: 12, fontWeight: '700', marginTop: 4 },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.md },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  icon: { color: Colors.primary, fontSize: 22, backgroundColor: Colors.surfaceRaised, padding: 8, borderRadius: Radius.sm, overflow: 'hidden' },
  techAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.surfaceRaised, borderWidth: 1, borderColor: Colors.primary },
  categoryText: { color: Colors.text, fontSize: 15, fontWeight: '800' },
  jobId: { color: Colors.textSubtle, fontSize: 11, fontWeight: '600', marginTop: 1 },
  techName: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', marginTop: 3 },
  statusBadge: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  serviceDetails: { color: Colors.text, fontSize: 13, fontWeight: '500', marginVertical: 14, lineHeight: 18 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12 },
  dateText: { color: Colors.textSubtle, fontSize: 12 },
  footerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rebookButton: { backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  rebookButtonText: { color: Colors.background, fontSize: 12, fontWeight: '900' },
  invoiceButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceRaised, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: Colors.borderStrong },
  invoiceButtonText: { color: Colors.primary, fontSize: 12, fontWeight: '700' },
  emptyContainer: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: Colors.textSubtle, fontSize: 14, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.xxl, borderWidth: 1, borderColor: Colors.border },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  taxTitle: { color: Colors.textSubtle, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  invoiceNum: { color: Colors.text, fontSize: 22, fontWeight: '800', marginTop: 2 },
  closeButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surfaceRaised, justifyContent: 'center', alignItems: 'center' },
  invoiceBody: { gap: 14 },
  invoiceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  billingLabel: { flex: 1, color: Colors.textMuted, fontSize: 14, fontWeight: '500' },
  billingValue: { flexShrink: 1, maxWidth: 150, color: Colors.text, fontSize: 14, fontWeight: '600', textAlign: 'right' },
  discountLabel: { flex: 1, color: Colors.primary, fontSize: 14, fontWeight: '700' },
  discountValue: { flexShrink: 1, maxWidth: 150, color: Colors.primary, fontSize: 14, fontWeight: '700', textAlign: 'right' },
  totalDivider: { height: 1, backgroundColor: Colors.borderStrong, borderStyle: 'dashed', borderWidth: 1, borderRadius: 1, marginVertical: 8 },
  totalLabel: { flex: 1, color: Colors.text, fontSize: 16, fontWeight: '800' },
  totalValue: { flexShrink: 1, maxWidth: 170, color: Colors.primary, fontSize: 20, fontWeight: '800', textAlign: 'right' },
  complianceBox: { flexDirection: 'row', backgroundColor: Colors.background, padding: 14, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, marginTop: 12 },
  complianceText: { flex: 1, color: Colors.textSubtle, fontSize: 11, lineHeight: 16, fontWeight: '500' },
  dismissBtn: { backgroundColor: Colors.primary, padding: 16, borderRadius: Radius.md, alignItems: 'center', marginTop: 28 },
  dismissBtnText: { color: Colors.background, fontSize: 15, fontWeight: '800' },
});
