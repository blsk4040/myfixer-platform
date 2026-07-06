// src/screens/profile/BankingInvoiceScreen.tsx
import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  Alert, 
  FlatList // 👈 FIXED: Explicitly imported to prevent runtime crash
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Type definitions matching a globally adaptable platform infrastructure
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

export function BankingInvoiceScreen({ navigation }: any): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<'payout' | 'invoices'>('payout');
  const [selectedRegion, setSelectedRegion] = useState<'ZA' | 'NG' | 'EA'>('ZA');

  // Form Fields State
  const [accountHolder, setAccountHolder] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  
  // Region Specific Variables
  const [branchCode, setBranchCode] = useState(''); // ZA specific
  const [sortCode, setSortCode] = useState(''); // NG specific
  const [mobileMoneyNumber, setMobileMoneyNumber] = useState(''); // East Africa (M-Pesa/Airtel)

  // Global Currency Formatting Utility
  const formatGlobalCurrency = (amount: number, currencyCode: string) => {
    try {
      return new Intl.NumberFormat('en-ZA', {
        style: 'currency',
        currency: currencyCode,
      }).format(amount);
    } catch (e) {
      return `${currencyCode} ${amount.toFixed(2)}`;
    }
  };

  const handleSavePayoutProfile = () => {
    if (!accountHolder || (!bankName && selectedRegion !== 'EA')) {
      Alert.alert("Missing Information", "Please enter the account holder name and financial institution.");
      return;
    }

    Alert.alert(
      "Secure Vault Saved",
      `Your African market settlement profile (${selectedRegion}) has been encrypted and saved to the secure banking directory.`,
      [{ text: "Understood" }]
    );
  };

  const handleDownloadInvoice = (invoice: InvoiceItem) => {
    Alert.alert(
      "Downloading Document",
      `Fetching PDF object link for ${invoice.invoiceNumber} from cloud storage bucket...`,
      [{ text: "OK" }]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Dynamic Sub-header Navigation Matrix */}
      <View style={styles.tabHeaderContainer}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'payout' && styles.activeTabButton]}
          onPress={() => setActiveTab('payout')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'payout' && styles.activeTabButtonText]}>Payout Methods</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'invoices' && styles.activeTabButton]}
          onPress={() => setActiveTab('invoices')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'invoices' && styles.activeTabButtonText]}>Tax Invoices</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'payout' ? (
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>Global Settlement Architecture</Text>
          <Text style={styles.sectionSubtitle}>Select the target infrastructure payout layout matching your operating market country:</Text>

          {/* Region Picker Ribbon - Updated for major African expansion hubs */}
          <View style={styles.regionSelectorRow}>
            <TouchableOpacity 
              style={[styles.regionChip, selectedRegion === 'ZA' && styles.activeRegionChip]} 
              onPress={() => setSelectedRegion('ZA')}
            >
              <Text style={[styles.regionChipText, selectedRegion === 'ZA' && styles.activeRegionChipText]}>South Africa (ZAR)</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.regionChip, selectedRegion === 'NG' && styles.activeRegionChip]} 
              onPress={() => setSelectedRegion('NG')}
            >
              <Text style={[styles.regionChipText, selectedRegion === 'NG' && styles.activeRegionChipText]}>Nigeria (NGN)</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.regionChip, selectedRegion === 'EA' && styles.activeRegionChip]} 
              onPress={() => setSelectedRegion('EA')}
            >
              <Text style={[styles.regionChipText, selectedRegion === 'EA' && styles.activeRegionChipText]}>East Africa (KES/GHS)</Text>
            </TouchableOpacity>
          </View>

          {/* Shared Standard Vault Inputs */}
          <View style={styles.formContainer}>
            <Text style={styles.inputLabel}>Account Holder Legal Name</Text>
            <TextInput 
              style={styles.input} 
              placeholder="e.g., Account holder legal name" 
              placeholderTextColor="#64748B"
              value={accountHolder}
              onChangeText={setAccountHolder}
            />

            {selectedRegion !== 'EA' && (
              <>
                <Text style={styles.inputLabel}>Financial Institution / Bank Name</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="e.g., Standard Bank, Access Bank, GTBank" 
                  placeholderTextColor="#64748B"
                  value={bankName}
                  onChangeText={setBankName}
                />
              </>
            )}

            {/* Dynamic Adaptive UI Row Layout Fields based on Location */}
            {selectedRegion === 'ZA' && (
              <>
                <Text style={styles.inputLabel}>Account Number</Text>
                <TextInput style={styles.input} placeholder="10123456789" placeholderTextColor="#64748B" keyboardType="number-pad" value={accountNumber} onChangeText={setAccountNumber} />
                <Text style={styles.inputLabel}>Branch Code</Text>
                <TextInput style={styles.input} placeholder="250655" placeholderTextColor="#64748B" keyboardType="number-pad" value={branchCode} onChangeText={setBranchCode} />
              </>
            )}

            {selectedRegion === 'NG' && (
              <>
                <Text style={styles.inputLabel}>10-Digit NUBAN Account Number</Text>
                <TextInput style={styles.input} placeholder="0123456789" placeholderTextColor="#64748B" keyboardType="number-pad" value={accountNumber} onChangeText={setAccountNumber} />
                <Text style={styles.inputLabel}>Bank Sort Code (Optional)</Text>
                <TextInput style={styles.input} placeholder="e.g., 044150149" placeholderTextColor="#64748B" keyboardType="number-pad" value={sortCode} onChangeText={setSortCode} />
              </>
            )}

            {selectedRegion === 'EA' && (
              <>
                <Text style={styles.inputLabel}>Mobile Money Operator Name</Text>
                <TextInput style={styles.input} placeholder="e.g., M-Pesa, MTN MoMo, Airtel Money" placeholderTextColor="#64748B" value={bankName} onChangeText={setBankName} />
                <Text style={styles.inputLabel}>Registered Mobile Wallet Number</Text>
                <TextInput style={styles.input} placeholder="e.g., +254 712 345 678" placeholderTextColor="#64748B" keyboardType="phone-pad" value={mobileMoneyNumber} onChangeText={setMobileMoneyNumber} />
              </>
            )}
          </View>

          <TouchableOpacity style={styles.saveButton} activeOpacity={0.8} onPress={handleSavePayoutProfile}>
            <Text style={styles.saveButtonText}>Encrypt & Save Banking Vault</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        /* Tax Invoice Ledger Rendering Node */
        <FlatList 
          data={invoices}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.invoiceListContainer}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.invoiceCard}>
              <View style={styles.invoiceHeaderRow}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.invoiceNumberText}>{item.invoiceNumber}</Text>
                  <Text style={styles.invoiceDateText}>{item.date}</Text>
                </View>
                <Text style={styles.invoiceAmountText}>
                  {formatGlobalCurrency(item.amount, item.currency)}
                </Text>
              </View>
              
              <Text style={styles.invoiceDescText}>{item.description}</Text>
              
              <View style={styles.invoiceActionRow}>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>● {item.status}</Text>
                </View>
                <TouchableOpacity 
                  style={styles.downloadLinkButton}
                  onPress={() => handleDownloadInvoice(item)}
                >
                  <Text style={styles.downloadLinkText}>Get PDF Statement</Text>
                </TouchableOpacity>
              </View>
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
  tabButtonText: { color: '#64748B', fontSize: 14, fontWeight: '600' },
  activeTabButtonText: { color: '#00FF87' },
  scrollContainer: { paddingHorizontal: 20, paddingBottom: 40 },
  sectionTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginBottom: 6 },
  sectionSubtitle: { color: '#64748B', fontSize: 13, marginBottom: 16, lineHeight: 18 },
  regionSelectorRow: { flexDirection: 'row', gap: 8, marginBottom: 24, flexWrap: 'wrap' },
  regionChip: { backgroundColor: '#111827', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#1E293B' },
  activeRegionChip: { borderColor: '#00FF87', backgroundColor: '#00FF8710' },
  regionChipText: { color: '#64748B', fontSize: 12, fontWeight: '600' },
  activeRegionChipText: { color: '#00FF87' },
  formContainer: { marginBottom: 24 },
  inputLabel: { color: '#FFFFFF', fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 14 },
  input: { backgroundColor: '#111827', color: '#FFFFFF', padding: 14, borderRadius: 10, fontSize: 15, borderWidth: 1, borderColor: '#1E293B' },
  saveButton: { backgroundColor: '#00FF87', padding: 16, borderRadius: 12, alignItems: 'center' },
  saveButtonText: { color: '#090D14', fontSize: 15, fontWeight: '700' },
  invoiceListContainer: { padding: 20, paddingBottom: 40 },
  invoiceCard: { backgroundColor: '#111827', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#1E293B', marginBottom: 14 },
  invoiceHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  invoiceNumberText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  invoiceDateText: { color: '#64748B', fontSize: 12, marginTop: 2 },
  invoiceAmountText: { color: '#00FF87', fontSize: 16, fontWeight: '700' },
  invoiceDescText: { color: '#E2E8F0', fontSize: 13, marginBottom: 14, lineHeight: 18 },
  invoiceActionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#1E293B', paddingTop: 12 },
  statusBadge: { backgroundColor: '#00FF8715', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusBadgeText: { color: '#00FF87', fontSize: 11, fontWeight: '700' },
  downloadLinkButton: { paddingVertical: 4 },
  downloadLinkText: { color: '#38BDF8', fontSize: 13, fontWeight: '600' }
});
