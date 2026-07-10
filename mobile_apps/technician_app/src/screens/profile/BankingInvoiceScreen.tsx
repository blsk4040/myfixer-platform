import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import apiService, { ProviderPayoutMethodRecord } from '../../services/api.service';

interface InvoiceItem {
  id: string;
  invoiceNumber: string;
  date: string;
  amount: number;
  currency: string;
  status: 'Paid' | 'Pending' | 'Failed';
  description: string;
}

const invoices: InvoiceItem[] = [];

export function BankingInvoiceScreen(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<'banking' | 'invoices'>('banking');
  const [selectedRegion, setSelectedRegion] = useState<'ZA' | 'NG' | 'EA'>('ZA');
  const [accountHolder, setAccountHolder] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [sortCode, setSortCode] = useState('');
  const [mobileMoneyNumber, setMobileMoneyNumber] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [methods, setMethods] = useState<ProviderPayoutMethodRecord[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiService.getPayoutMethods()
      .then((response) => setMethods(response.methods || []))
      .catch(() => undefined);
  }, []);

  const formatMoney = (amount: number, currencyCode: string) => {
    try {
      return new Intl.NumberFormat('en-ZA', {
        style: 'currency',
        currency: currencyCode,
      }).format(amount);
    } catch {
      return `${currencyCode} ${amount.toFixed(2)}`;
    }
  };

  const handleSaveBankingDetails = async () => {
    if (!accountHolder.trim()) {
      Alert.alert('Account Holder Required', 'Please enter the name on the bank or wallet account.');
      return;
    }

    if (selectedRegion === 'EA') {
      if (!bankName.trim() || !mobileMoneyNumber.trim()) {
        Alert.alert('Mobile Money Required', 'Please enter your mobile money provider and registered wallet number.');
        return;
      }
    } else if (!bankName.trim() || !accountNumber.trim()) {
      Alert.alert('Bank Details Required', 'Please enter your bank name and account number.');
      return;
    }

    try {
      setSaving(true);
      if (selectedRegion === 'EA') {
        const response = await apiService.addMobileMoneyPayoutMethod({
          countryCode: 'GH',
          currency: 'GHS',
          operatorCode: bankName.trim(),
          phoneNumber: mobileMoneyNumber.trim(),
          accountName: accountHolder.trim(),
          makeDefault: true,
        });
        setMethods((prev) => [response.method, ...prev.filter((item) => item.id !== response.method.id)]);
      } else {
        const response = await apiService.addBankPayoutMethod({
          countryCode: selectedRegion === 'ZA' ? 'ZA' : 'NG',
          currency: selectedRegion === 'ZA' ? 'ZAR' : 'NGN',
          accountHolderName: accountHolder.trim(),
          bankName: bankName.trim(),
          bankCode: selectedRegion === 'ZA' ? branchCode.trim() : sortCode.trim(),
          accountNumber: accountNumber.trim(),
          makeDefault: true,
        });
        setMethods((prev) => [response.method, ...prev.filter((item) => item.id !== response.method.id)]);
      }

      Alert.alert(
        'Payout Method Saved',
        'Your details were saved for admin-approved payouts. Full account details will not be shown again.'
      );
      setAccountNumber('');
      setMobileMoneyNumber('');
    } catch (error) {
      Alert.alert('Payout Method Not Saved', error instanceof Error ? error.message : 'Unable to save payout method.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTaxDetails = () => {
    Alert.alert(
      'Tax Details Saved',
      taxNumber.trim()
        ? 'Your tax details have been saved for future invoices.'
        : 'No tax number was added. You can add it later if needed.'
    );
  };

  const handleDownloadInvoice = (invoice: InvoiceItem) => {
    Alert.alert('Invoice', `Opening ${invoice.invoiceNumber}.`);
  };

  const renderInvoice = ({ item }: { item: InvoiceItem }) => (
    <View style={styles.invoiceCard}>
      <View style={styles.invoiceHeaderRow}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.invoiceNumberText}>{item.invoiceNumber}</Text>
          <Text style={styles.invoiceDateText}>{item.date}</Text>
        </View>
        <Text style={styles.invoiceAmountText}>{formatMoney(item.amount, item.currency)}</Text>
      </View>

      <Text style={styles.invoiceDescText}>{item.description}</Text>

      <View style={styles.invoiceActionRow}>
        <View style={styles.statusBadge}>
          <Text style={styles.statusBadgeText}>{item.status}</Text>
        </View>
        <TouchableOpacity style={styles.downloadLinkButton} onPress={() => handleDownloadInvoice(item)}>
          <Text style={styles.downloadLinkText}>View Invoice</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.tabHeaderContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'banking' && styles.activeTabButton]}
          onPress={() => setActiveTab('banking')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'banking' && styles.activeTabButtonText]}>Bank Account</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'invoices' && styles.activeTabButton]}
          onPress={() => setActiveTab('invoices')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'invoices' && styles.activeTabButtonText]}>Invoices</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'banking' ? (
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>Where should we pay you?</Text>
          <Text style={styles.sectionSubtitle}>
            Add the bank account or mobile wallet MyFixer should use for your payouts.
          </Text>

          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>Payout status</Text>
            <Text style={styles.statusText}>Your earnings become eligible for payout only after the job is completed, confirmed and approved.</Text>
            {methods.map((method) => (
              <Text key={method.id} style={styles.statusText}>
                {method.isDefault ? 'Default: ' : ''}{method.maskedDestination} - {method.status}
              </Text>
            ))}
          </View>

          <Text style={styles.inputLabel}>Country / payout type</Text>
          <View style={styles.regionSelectorRow}>
            <TouchableOpacity
              style={[styles.regionChip, selectedRegion === 'ZA' && styles.activeRegionChip]}
              onPress={() => setSelectedRegion('ZA')}
            >
              <Text style={[styles.regionChipText, selectedRegion === 'ZA' && styles.activeRegionChipText]}>South Africa</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.regionChip, selectedRegion === 'NG' && styles.activeRegionChip]}
              onPress={() => setSelectedRegion('NG')}
            >
              <Text style={[styles.regionChipText, selectedRegion === 'NG' && styles.activeRegionChipText]}>Nigeria</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.regionChip, selectedRegion === 'EA' && styles.activeRegionChip]}
              onPress={() => setSelectedRegion('EA')}
            >
              <Text style={[styles.regionChipText, selectedRegion === 'EA' && styles.activeRegionChipText]}>Mobile money</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.inputLabel}>Account holder name</Text>
            <TextInput
              style={styles.input}
              placeholder="Name on the account"
              placeholderTextColor="#64748B"
              value={accountHolder}
              onChangeText={setAccountHolder}
            />

            {selectedRegion === 'EA' ? (
              <>
                <Text style={styles.inputLabel}>Mobile money provider</Text>
                <TextInput
                  style={styles.input}
                  placeholder="M-Pesa, MTN MoMo, Airtel Money"
                  placeholderTextColor="#64748B"
                  value={bankName}
                  onChangeText={setBankName}
                />
                <Text style={styles.inputLabel}>Registered wallet number</Text>
                <TextInput
                  style={styles.input}
                  placeholder="+254 712 345 678"
                  placeholderTextColor="#64748B"
                  keyboardType="phone-pad"
                  value={mobileMoneyNumber}
                  onChangeText={setMobileMoneyNumber}
                />
              </>
            ) : (
              <>
                <Text style={styles.inputLabel}>Bank name</Text>
                <TextInput
                  style={styles.input}
                  placeholder={selectedRegion === 'ZA' ? 'Standard Bank, FNB, Capitec' : 'Access Bank, GTBank, Zenith'}
                  placeholderTextColor="#64748B"
                  value={bankName}
                  onChangeText={setBankName}
                />
                <Text style={styles.inputLabel}>Account number</Text>
                <TextInput
                  style={styles.input}
                  placeholder={selectedRegion === 'ZA' ? '10123456789' : '0123456789'}
                  placeholderTextColor="#64748B"
                  keyboardType="number-pad"
                  value={accountNumber}
                  onChangeText={setAccountNumber}
                />
                <Text style={styles.inputLabel}>{selectedRegion === 'ZA' ? 'Branch code' : 'Sort code (optional)'}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={selectedRegion === 'ZA' ? '250655' : '044150149'}
                  placeholderTextColor="#64748B"
                  keyboardType="number-pad"
                  value={selectedRegion === 'ZA' ? branchCode : sortCode}
                  onChangeText={selectedRegion === 'ZA' ? setBranchCode : setSortCode}
                />
              </>
            )}
          </View>

          <TouchableOpacity style={[styles.saveButton, saving && { opacity: 0.6 }]} activeOpacity={0.8} onPress={handleSaveBankingDetails} disabled={saving}>
            <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Payout Method'}</Text>
          </TouchableOpacity>

          <View style={styles.taxSection}>
            <Text style={styles.sectionTitle}>Tax details</Text>
            <Text style={styles.sectionSubtitle}>
              Optional for now. Add this if you need it shown on future invoices.
            </Text>
            <Text style={styles.inputLabel}>Business name</Text>
            <TextInput
              style={styles.input}
              placeholder="Optional"
              placeholderTextColor="#64748B"
              value={businessName}
              onChangeText={setBusinessName}
            />
            <Text style={styles.inputLabel}>Tax number</Text>
            <TextInput
              style={styles.input}
              placeholder="Optional"
              placeholderTextColor="#64748B"
              value={taxNumber}
              onChangeText={setTaxNumber}
            />
            <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.8} onPress={handleSaveTaxDetails}>
              <Text style={styles.secondaryButtonText}>Save Tax Details</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={invoices}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.invoiceListContainer}
          showsVerticalScrollIndicator={false}
          renderItem={renderInvoice}
          ListHeaderComponent={(
            <View style={styles.invoiceIntro}>
              <Text style={styles.sectionTitle}>Invoices</Text>
              <Text style={styles.sectionSubtitle}>Invoices for completed jobs will appear here.</Text>
            </View>
          )}
          ListEmptyComponent={(
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No invoices yet</Text>
              <Text style={styles.emptyText}>
                Once jobs are completed and paid, your invoices will show here for viewing or download.
              </Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090D14' },
  tabHeaderContainer: { flexDirection: 'row', backgroundColor: '#111827', margin: 16, borderRadius: 10, padding: 4, borderWidth: 1, borderColor: '#1E293B' },
  tabButton: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8 },
  activeTabButton: { backgroundColor: '#1E293B' },
  tabButtonText: { color: '#64748B', fontSize: 14, fontWeight: '700' },
  activeTabButtonText: { color: '#00FF87' },
  scrollContainer: { paddingHorizontal: 20, paddingBottom: 40 },
  sectionTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', marginBottom: 6 },
  sectionSubtitle: { color: '#94A3B8', fontSize: 13, marginBottom: 16, lineHeight: 19 },
  statusCard: { backgroundColor: '#111827', borderColor: '#1E293B', borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 18 },
  statusTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  statusText: { color: '#94A3B8', fontSize: 12, lineHeight: 18, marginTop: 4 },
  regionSelectorRow: { flexDirection: 'row', gap: 8, marginBottom: 18, flexWrap: 'wrap' },
  regionChip: { backgroundColor: '#111827', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: '#1E293B' },
  activeRegionChip: { borderColor: '#00FF87', backgroundColor: '#00FF8710' },
  regionChipText: { color: '#64748B', fontSize: 12, fontWeight: '700' },
  activeRegionChipText: { color: '#00FF87' },
  formContainer: { marginBottom: 18 },
  inputLabel: { color: '#E2E8F0', fontSize: 12, fontWeight: '800', marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: '#111827', color: '#FFFFFF', padding: 14, borderRadius: 10, fontSize: 15, borderWidth: 1, borderColor: '#1E293B' },
  saveButton: { backgroundColor: '#00FF87', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 26 },
  saveButtonText: { color: '#090D14', fontSize: 15, fontWeight: '900' },
  secondaryButton: { backgroundColor: '#1E293B', padding: 15, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#334155', marginTop: 16 },
  secondaryButtonText: { color: '#E2E8F0', fontSize: 14, fontWeight: '800' },
  taxSection: { borderTopWidth: 1, borderTopColor: '#1E293B', paddingTop: 22 },
  invoiceListContainer: { padding: 20, paddingBottom: 40 },
  invoiceIntro: { marginBottom: 12 },
  invoiceCard: { backgroundColor: '#111827', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#1E293B', marginBottom: 14 },
  invoiceHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  invoiceNumberText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  invoiceDateText: { color: '#64748B', fontSize: 12, marginTop: 2 },
  invoiceAmountText: { color: '#00FF87', fontSize: 16, fontWeight: '800' },
  invoiceDescText: { color: '#E2E8F0', fontSize: 13, marginBottom: 14, lineHeight: 18 },
  invoiceActionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#1E293B', paddingTop: 12 },
  statusBadge: { backgroundColor: '#00FF8715', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusBadgeText: { color: '#00FF87', fontSize: 11, fontWeight: '800' },
  downloadLinkButton: { paddingVertical: 4 },
  downloadLinkText: { color: '#38BDF8', fontSize: 13, fontWeight: '800' },
  emptyState: { backgroundColor: '#111827', borderWidth: 1, borderColor: '#1E293B', borderRadius: 14, padding: 22, marginTop: 8, alignItems: 'center' },
  emptyTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  emptyText: { color: '#94A3B8', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 8 },
});
