// src/screens/profile/PaymentScreen.tsx
import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface SavedCard {
  id: string;
  brand: 'Visa' | 'Mastercard';
  last4: string;
  expiry: string;
  isDefault: boolean;
}

export function PaymentScreen(): React.JSX.Element {
  const [loading, setLoading] = useState<boolean>(false);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [selectedCurrency, setSelectedCurrency] = useState<'ZAR' | 'NGN' | 'KES'>('ZAR');

  // Form State for Adding New Instrument
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');

  // Dummy Vault Data
  const [savedCards, setSavedCards] = useState<SavedCard[]>([
    { id: '1', brand: 'Visa', last4: '4321', expiry: '08/28', isDefault: true },
    { id: '2', brand: 'Mastercard', last4: '8899', expiry: '11/26', isDefault: false },
  ]);

  const handleSetDefault = (id: string) => {
    setSavedCards(prev =>
      prev.map(card => ({
        ...card,
        isDefault: card.id === id,
      }))
    );
  };

  const handleAddCard = () => {
    if (cardNumber.length < 16 || expiry.length < 5 || cvv.length < 3) {
      Alert.alert('Validation Error', 'Please check card parameters and retry.');
      return;
    }

    setLoading(true);
    setModalVisible(false);

    // Simulate tokenization request to your payment gateway (e.g., Paystack/Stripe)
    setTimeout(() => {
      const brand: 'Visa' | 'Mastercard' = cardNumber.startsWith('5') ? 'Mastercard' : 'Visa';
      const newCard: SavedCard = {
        id: Date.now().toString(),
        brand,
        last4: cardNumber.slice(-4),
        expiry,
        isDefault: savedCards.length === 0,
      };

      setSavedCards(prev => [...prev, newCard]);
      setCardNumber('');
      setExpiry('');
      setCvv('');
      setLoading(false);
      Alert.alert('Instrument Bound', 'Encrypted payment instrument registered successfully.');
    }, 1500);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        {/* Core Currency Environment Context */}
        <Text style={styles.sectionTitle}>Default Operating Currency</Text>
        <View style={styles.currencyRow}>
          {(['ZAR', 'NGN', 'KES'] as const).map(curr => (
            <TouchableOpacity
              key={curr}
              style={[styles.currencyCard, selectedCurrency === curr && styles.activeCurrencyCard]}
              activeOpacity={0.7}
              onPress={() => setSelectedCurrency(curr)}
            >
              <Text style={[styles.currencyText, selectedCurrency === curr && styles.activeCurrencyText]}>
                {curr}
              </Text>
              <Text style={styles.currencyLabel}>
                {curr === 'ZAR' ? 'South Africa' : curr === 'NGN' ? 'Nigeria' : 'Kenya'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Saved Instruments Ledger */}
        <View style={styles.headerWithAction}>
          <Text style={styles.sectionTitle}>Secure Payment Cards</Text>
          <TouchableOpacity onPress={() => setModalVisible(true)}>
            <Text style={styles.addActionText}>+ Add Card</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="small" color="#00FF87" style={{ marginVertical: 20 }} />
        ) : (
          <View style={styles.cardStack}>
            {savedCards.map(card => (
              <TouchableOpacity
                key={card.id}
                style={[styles.paymentCardRow, card.isDefault && styles.defaultCardBorder]}
                activeOpacity={0.7}
                onPress={() => handleSetDefault(card.id)}
              >
                <View style={styles.cardLeft}>
                  <View style={styles.brandIconMock}>
                    <Text style={styles.brandText}>{card.brand === 'Visa' ? '💳 V' : '💳 M'}</Text>
                  </View>
                  <View>
                    <Text style={styles.cardMaskText}>•••• •••• •••• {card.last4}</Text>
                    <Text style={styles.cardExpiryText}>Expires {card.expiry}</Text>
                  </View>
                </View>
                {card.isDefault && (
                  <View style={styles.defaultBadge}>
                    <Text style={styles.defaultBadgeText}>PRIMARY</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Security Disclaimers */}
        <View style={styles.complianceBox}>
          <Text style={styles.complianceText}>
            🔒 PCI-DSS Compliant Tokenization Architecture. Your complete card matrices are never persisted directly on MyFixer systems infrastructure.
          </Text>
        </View>

      </ScrollView>

      {/* Add Instrument Modal Sheet Overlay */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Link New Card</Text>

            <Text style={styles.inputLabel}>CARD NUMBER</Text>
            <TextInput
              style={styles.input}
              placeholder="4000 1234 5678 9010"
              placeholderTextColor="#475569"
              keyboardType="number-pad"
              maxLength={16}
              value={cardNumber}
              onChangeText={setCardNumber}
            />

            <View style={styles.formRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>EXPIRY (MM/YY)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="12/29"
                  placeholderTextColor="#475569"
                  keyboardType="number-pad"
                  maxLength={5}
                  value={expiry}
                  onChangeText={setExpiry}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>CVV SECURITIES</Text>
                <TextInput
                  style={styles.input}
                  placeholder="321"
                  placeholderTextColor="#475569"
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={3}
                  value={cvv}
                  onChangeText={setCvv}
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Dismiss</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleAddCard}>
                <Text style={styles.saveBtnText}>Secure Vault Link</Text>
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
  scrollContainer: { padding: 20 },
  sectionTitle: { color: '#64748B', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 },
  headerWithAction: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 28 },
  addActionText: { color: '#00FF87', fontSize: 13, fontWeight: '600' },
  currencyRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  currencyCard: { flex: 1, backgroundColor: '#111827', borderWidth: 1, borderColor: '#1E293B', padding: 16, borderRadius: 12, alignItems: 'center' },
  activeCurrencyCard: { borderColor: '#00FF87', backgroundColor: '#00FF8705' },
  currencyText: { color: '#64748B', fontSize: 16, fontWeight: '800' },
  activeCurrencyText: { color: '#00FF87' },
  currencyLabel: { color: '#475569', fontSize: 10, marginTop: 4, fontWeight: '500' },
  cardStack: { backgroundColor: '#111827', borderRadius: 16, borderWidth: 1, borderColor: '#1E293B', overflow: 'hidden' },
  paymentCardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  defaultCardBorder: { backgroundColor: '#00FF8702' },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  brandIconMock: { width: 44, height: 32, backgroundColor: '#090D14', borderRadius: 6, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#1E293B' },
  brandText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  cardMaskText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', letterSpacing: 0.5 },
  cardExpiryText: { color: '#64748B', fontSize: 11, marginTop: 2 },
  defaultBadge: { backgroundColor: '#00FF8715', borderWidth: 1, borderColor: '#00FF8740', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  defaultBadgeText: { color: '#00FF87', fontSize: 9, fontWeight: '700' },
  complianceBox: { marginTop: 24, padding: 14, backgroundColor: '#0F172A', borderRadius: 12, borderWidth: 1, borderColor: '#1E293B' },
  complianceText: { color: '#475569', fontSize: 11, lineHeight: 16, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#111827', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderTopWidth: 1, borderColor: '#1E293B' },
  modalTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginBottom: 20 },
  inputLabel: { color: '#64748B', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 8, marginTop: 14 },
  input: { backgroundColor: '#090D14', borderWidth: 1, borderColor: '#1E293B', borderRadius: 12, padding: 14, color: '#FFFFFF', fontSize: 14 },
  formRow: { flexDirection: 'row', gap: 12 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 28, marginBottom: Platform.OS === 'ios' ? 20 : 0 },
  cancelBtn: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#1E293B' },
  cancelBtnText: { color: '#64748B', fontSize: 14, fontWeight: '600' },
  saveBtn: { flex: 2, padding: 16, borderRadius: 12, alignItems: 'center', backgroundColor: '#00FF87' },
  saveBtnText: { color: '#090D14', fontSize: 14, fontWeight: '700' }
});