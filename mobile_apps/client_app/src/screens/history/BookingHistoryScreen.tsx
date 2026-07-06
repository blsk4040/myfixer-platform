// src/screens/history/BookingHistoryScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FileText as LucideFileText, X as LucideX, CheckCircle2 as LucideCheckCircle } from 'lucide-react-native';
import apiService, { BookingHistoryItem } from '../../services/api.service';

const FileText = LucideFileText as any;
const X = LucideX as any;
const CheckCircle = LucideCheckCircle as any;

const money = (currency: string, amountMinor = 0) => `${currency} ${(amountMinor / 100).toFixed(2)}`;

export function BookingHistoryScreen(): React.JSX.Element {
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
      } catch (err) {
        Alert.alert('Error', 'Could not synchronize account history logs.');
      } finally {
        setLoading(false);
      }
    };

    fetchHistoryData();
  }, []);

  const handleViewInvoice = (item: BookingHistoryItem) => {
    if (!item.invoice) return;
    setSelectedBooking(item);
    setInvoiceModalVisible(true);
  };

  const renderBookingItem = ({ item }: { item: BookingHistoryItem }) => {
    const statusColor = item.status === 'COMPLETED' ? '#00FF87' : '#F87171';
    const completedDate = new Date(item.completedAt || item.cancelledAt || item.updatedAt).toLocaleDateString();

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.categoryRow}>
            <Text style={styles.icon}>•</Text>
            <View>
              <Text style={styles.categoryText}>{item.applianceType}</Text>
              <Text style={styles.jobId}>{item.generalArea || item.fullAddress || 'Service address'}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}10`, borderColor: statusColor }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
          </View>
        </View>

        <Text style={styles.serviceDetails}>{item.faultDescription || 'Service booking'}</Text>

        <View style={styles.cardFooter}>
          <Text style={styles.dateText}>{item.status === 'COMPLETED' ? 'Completed' : 'Updated'}: {completedDate}</Text>

          <TouchableOpacity
            style={styles.invoiceButton}
            onPress={() => handleViewInvoice(item)}
            disabled={!item.invoice}
          >
            <FileText color={item.invoice ? '#00FF87' : '#64748B'} size={14} style={{ marginRight: 6 }} />
            <Text style={[styles.invoiceButtonText, !item.invoice && { color: '#64748B' }]}>Invoice</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const invoice = selectedBooking?.invoice;
  const currency = selectedBooking?.currency || 'ZAR';

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
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
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyText}>No historical booking items found.</Text></View>}
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
              <View style={styles.invoiceRow}><Text style={styles.billingLabel}>Base Diagnostic Callout</Text><Text style={styles.billingValue}>{money(currency, invoice?.baseAmountMinor)}</Text></View>
              <View style={styles.invoiceRow}><Text style={styles.billingLabel}>Extended Labour Charges</Text><Text style={styles.billingValue}>{money(currency, invoice?.additionalLaborMinor)}</Text></View>
              <View style={styles.invoiceRow}><Text style={styles.billingLabel}>Materials & Parts</Text><Text style={styles.billingValue}>{money(currency, invoice?.partsAmountMinor)}</Text></View>
              <View style={styles.totalDivider} />
              <View style={styles.invoiceRow}><Text style={styles.totalLabel}>Total Paid Balance</Text><Text style={styles.totalValue}>{money(currency, invoice?.totalAmountMinor)}</Text></View>

              <View style={styles.complianceBox}>
                <CheckCircle color="#00FF87" size={16} style={{ marginRight: 8 }} />
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
  container: { flex: 1, backgroundColor: '#090D14' },
  listContainer: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#111827', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#1E293B', marginBottom: 14 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  icon: { color: '#00FF87', fontSize: 22, backgroundColor: '#1E293B', padding: 8, borderRadius: 10, overflow: 'hidden' },
  categoryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  jobId: { color: '#64748B', fontSize: 11, fontWeight: '600', marginTop: 1 },
  statusBadge: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  serviceDetails: { color: '#E2E8F0', fontSize: 13, fontWeight: '500', marginVertical: 14, lineHeight: 18 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#1E293B', paddingTop: 12 },
  dateText: { color: '#64748B', fontSize: 12 },
  invoiceButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#334155' },
  invoiceButtonText: { color: '#00FF87', fontSize: 12, fontWeight: '700' },
  emptyContainer: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: '#64748B', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#111827', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderWidth: 1, borderColor: '#1E293B' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  taxTitle: { color: '#64748B', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  invoiceNum: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 2 },
  closeButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center' },
  invoiceBody: { gap: 14 },
  invoiceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  billingLabel: { color: '#94A3B8', fontSize: 14, fontWeight: '500' },
  billingValue: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  totalDivider: { height: 1, backgroundColor: '#334155', borderStyle: 'dashed', borderWidth: 1, borderRadius: 1, marginVertical: 8 },
  totalLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  totalValue: { color: '#00FF87', fontSize: 20, fontWeight: '800' },
  complianceBox: { flexDirection: 'row', backgroundColor: '#090D14', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#1E293B', marginTop: 12 },
  complianceText: { flex: 1, color: '#64748B', fontSize: 11, lineHeight: 16, fontWeight: '500' },
  dismissBtn: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 28 },
  dismissBtnText: { color: '#090D14', fontSize: 15, fontWeight: '700' },
});
