import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import apiService, { ProviderPayoutMethodRecord } from '../../services/api.service';
import { getTechnicianIdentity } from '../../services/technicianIdentity.service';
import { BRAND } from '../../config/brand';

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
type PayoutMethodType = 'BANK_ACCOUNT' | 'MOBILE_MONEY';

const countryNames: Record<string, string> = {
  ZA: 'South Africa',
  GH: 'Ghana',
  NG: 'Nigeria',
  KE: 'Kenya',
  UG: 'Uganda',
  TZ: 'Tanzania',
  RW: 'Rwanda',
  ZM: 'Zambia',
};

const payoutMethodLabels: Record<PayoutMethodType, string> = {
  BANK_ACCOUNT: 'Bank account',
  MOBILE_MONEY: 'Mobile money',
};

const Colors = {
  background: '#0B0B0D',
  surface: '#17171A',
  surfaceRaised: '#222226',
  input: '#1C1C20',
  border: '#303036',
  primary: '#B8FF3D',
  text: '#F7F7F5',
  textMuted: '#B9B9BF',
  textSubtle: '#74747C',
  info: '#56B8FF',
};

const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
};

export function BankingInvoiceScreen({ navigation }: any): React.JSX.Element {
  const technicianIdentity = getTechnicianIdentity();
  const payoutCapabilities = technicianIdentity.payoutCapabilities;
  const payoutOptions = payoutCapabilities.providerPayoutMethods;
  const [activeTab, setActiveTab] = useState<'banking' | 'invoices'>('banking');
  const [selectedPayoutType, setSelectedPayoutType] = useState<PayoutMethodType>(payoutCapabilities.defaultProviderPayoutMethod);
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

  useEffect(() => {
    if (!payoutOptions.includes(selectedPayoutType) && payoutOptions[0]) {
      setSelectedPayoutType(payoutOptions[0]);
    }
  }, [payoutOptions, selectedPayoutType]);

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

    if (payoutOptions.length === 0) {
      Alert.alert('Payout Not Available', `Payout methods are not available for ${countryNames[technicianIdentity.countryCode] || technicianIdentity.countryCode} yet.`);
      return;
    }

    if (selectedPayoutType === 'MOBILE_MONEY') {
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
      if (selectedPayoutType === 'MOBILE_MONEY') {
        const response = await apiService.addMobileMoneyPayoutMethod({
          countryCode: technicianIdentity.countryCode,
          currency: technicianIdentity.currency,
          operatorCode: bankName.trim(),
          phoneNumber: mobileMoneyNumber.trim(),
          accountName: accountHolder.trim(),
          makeDefault: true,
        });
        setMethods((prev) => [response.method, ...prev.filter((item) => item.id !== response.method.id)]);
      } else {
        const response = await apiService.addBankPayoutMethod({
          countryCode: technicianIdentity.countryCode,
          currency: technicianIdentity.currency,
          accountHolderName: accountHolder.trim(),
          bankName: bankName.trim(),
          bankCode: technicianIdentity.countryCode === 'ZA' ? branchCode.trim() : sortCode.trim(),
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
        <Text style={styles.invoiceAmountText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {formatMoney(item.amount, item.currency)}
        </Text>
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
      <View style={styles.screenHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation?.canGoBack?.() ? navigation.goBack() : navigation?.navigate?.('ProfileMain')}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Back to Profile"
        >
          <ArrowLeft color={Colors.text} size={22} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Banking & Invoices</Text>
          <Text style={styles.headerSubtitle}>Payout details and job invoice records</Text>
        </View>
      </View>

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
            Add the bank account or mobile wallet {BRAND.displayName} should use for your payouts.
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
            <View style={styles.regionChip}>
              <Text style={styles.regionChipText}>{countryNames[technicianIdentity.countryCode] || technicianIdentity.countryCode}</Text>
            </View>
            {payoutOptions.map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.regionChip, selectedPayoutType === option && styles.activeRegionChip]}
                onPress={() => setSelectedPayoutType(option)}
              >
                <Text style={[styles.regionChipText, selectedPayoutType === option && styles.activeRegionChipText]}>{payoutMethodLabels[option]}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.inputLabel}>Account holder name</Text>
            <TextInput
              style={styles.input}
              placeholder="Name on the account"
              placeholderTextColor={Colors.textSubtle}
              value={accountHolder}
              onChangeText={setAccountHolder}
            />

            {selectedPayoutType === 'MOBILE_MONEY' ? (
              <>
                <Text style={styles.inputLabel}>Mobile money provider</Text>
                <TextInput
                  style={styles.input}
                  placeholder="M-Pesa, MTN MoMo, Airtel Money"
                  placeholderTextColor={Colors.textSubtle}
                  value={bankName}
                  onChangeText={setBankName}
                />
                <Text style={styles.inputLabel}>Registered wallet number</Text>
                <TextInput
                  style={styles.input}
                  placeholder="+254 712 345 678"
                  placeholderTextColor={Colors.textSubtle}
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
                  placeholder={technicianIdentity.countryCode === 'ZA' ? 'Standard Bank, FNB, Capitec' : 'Bank name'}
                  placeholderTextColor={Colors.textSubtle}
                  value={bankName}
                  onChangeText={setBankName}
                />
                <Text style={styles.inputLabel}>Account number</Text>
                <TextInput
                  style={styles.input}
                  placeholder={technicianIdentity.countryCode === 'ZA' ? '10123456789' : 'Account number'}
                  placeholderTextColor={Colors.textSubtle}
                  keyboardType="number-pad"
                  value={accountNumber}
                  onChangeText={setAccountNumber}
                />
                <Text style={styles.inputLabel}>{technicianIdentity.countryCode === 'ZA' ? 'Branch code' : 'Bank code / sort code'}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={technicianIdentity.countryCode === 'ZA' ? '250655' : 'Bank code'}
                  placeholderTextColor={Colors.textSubtle}
                  keyboardType="number-pad"
                  value={technicianIdentity.countryCode === 'ZA' ? branchCode : sortCode}
                  onChangeText={technicianIdentity.countryCode === 'ZA' ? setBranchCode : setSortCode}
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
              placeholderTextColor={Colors.textSubtle}
              value={businessName}
              onChangeText={setBusinessName}
            />
            <Text style={styles.inputLabel}>Tax number</Text>
            <TextInput
              style={styles.input}
              placeholder="Optional"
              placeholderTextColor={Colors.textSubtle}
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
  container: { flex: 1, backgroundColor: Colors.background },
  screenHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.surfaceRaised, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  headerTitle: { color: Colors.text, fontSize: 22, fontWeight: '900' },
  headerSubtitle: { color: Colors.textSubtle, fontSize: 12, fontWeight: '700', marginTop: 3 },
  tabHeaderContainer: { flexDirection: 'row', backgroundColor: Colors.surface, marginHorizontal: 16, marginTop: 4, marginBottom: 16, borderRadius: 10, padding: 4, borderWidth: 1, borderColor: Colors.border },
  tabButton: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: Radius.sm },
  activeTabButton: { backgroundColor: Colors.surfaceRaised },
  tabButtonText: { color: Colors.textSubtle, fontSize: 14, fontWeight: '700' },
  activeTabButtonText: { color: Colors.primary },
  scrollContainer: { paddingHorizontal: 20, paddingBottom: 40 },
  sectionTitle: { color: Colors.text, fontSize: 18, fontWeight: '900', marginBottom: 6 },
  sectionSubtitle: { color: Colors.textMuted, fontSize: 13, marginBottom: 16, lineHeight: 19 },
  statusCard: { backgroundColor: Colors.surface, borderColor: Colors.border, borderWidth: 1, borderRadius: Radius.md, padding: 14, marginBottom: 18 },
  statusTitle: { color: Colors.text, fontSize: 14, fontWeight: '800' },
  statusText: { color: Colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  regionSelectorRow: { flexDirection: 'row', gap: 8, marginBottom: 18, flexWrap: 'wrap' },
  regionChip: { backgroundColor: Colors.surface, paddingHorizontal: 12, paddingVertical: 9, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border },
  activeRegionChip: { borderColor: Colors.primary, backgroundColor: '#B8FF3D14' },
  regionChipText: { color: Colors.textSubtle, fontSize: 12, fontWeight: '700' },
  activeRegionChipText: { color: Colors.primary },
  formContainer: { marginBottom: 18 },
  inputLabel: { color: Colors.textMuted, fontSize: 12, fontWeight: '800', marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: Colors.input, color: Colors.text, padding: 14, borderRadius: 10, fontSize: 15, borderWidth: 1, borderColor: Colors.border },
  saveButton: { backgroundColor: Colors.primary, padding: 16, borderRadius: Radius.md, alignItems: 'center', marginBottom: 26 },
  saveButtonText: { color: Colors.background, fontSize: 15, fontWeight: '900' },
  secondaryButton: { backgroundColor: Colors.surfaceRaised, padding: 15, borderRadius: Radius.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, marginTop: 16 },
  secondaryButtonText: { color: Colors.text, fontSize: 14, fontWeight: '800' },
  taxSection: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 22 },
  invoiceListContainer: { padding: 20, paddingBottom: 40 },
  invoiceIntro: { marginBottom: 12 },
  invoiceCard: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 14 },
  invoiceHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  invoiceNumberText: { color: Colors.text, fontSize: 15, fontWeight: '800' },
  invoiceDateText: { color: Colors.textSubtle, fontSize: 12, marginTop: 2 },
  invoiceAmountText: { flexShrink: 1, maxWidth: 140, color: Colors.primary, fontSize: 16, fontWeight: '800', textAlign: 'right' },
  invoiceDescText: { color: Colors.textMuted, fontSize: 13, marginBottom: 14, lineHeight: 18 },
  invoiceActionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12 },
  statusBadge: { backgroundColor: '#B8FF3D18', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusBadgeText: { color: Colors.primary, fontSize: 11, fontWeight: '800' },
  downloadLinkButton: { paddingVertical: 4 },
  downloadLinkText: { color: Colors.info, fontSize: 13, fontWeight: '800' },
  emptyState: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg, padding: 22, marginTop: 8, alignItems: 'center' },
  emptyTitle: { color: Colors.text, fontSize: 16, fontWeight: '900' },
  emptyText: { color: Colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 8 },
});
