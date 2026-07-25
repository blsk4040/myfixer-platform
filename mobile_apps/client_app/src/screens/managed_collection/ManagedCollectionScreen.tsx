import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiService, {
  ManagedCollectionBinColor,
  ManagedCollectionDay,
  ManagedCollectionFrequency,
  ManagedCollectionPropertyType,
} from '../../services/api.service';
import authService from '../../services/auth.service';

const propertyTypes: ManagedCollectionPropertyType[] = ['HOUSE', 'APARTMENT', 'ESTATE', 'COMMERCIAL', 'INDUSTRIAL'];
const frequencies: ManagedCollectionFrequency[] = ['WEEKLY', 'TWICE_WEEKLY', 'MONTHLY'];
const days: ManagedCollectionDay[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const binColors: ManagedCollectionBinColor[] = ['RED', 'GREEN', 'BLUE'];

export function ManagedCollectionScreen({ navigation }: any): React.JSX.Element {
  const session = authService.getSession();
  const [fullAddress, setFullAddress] = useState('');
  const [propertyType, setPropertyType] = useState<ManagedCollectionPropertyType>('HOUSE');
  const [binPackage, setBinPackage] = useState<ManagedCollectionBinColor[]>(['RED', 'GREEN', 'BLUE']);
  const [frequency, setFrequency] = useState<ManagedCollectionFrequency>('WEEKLY');
  const [preferredDay, setPreferredDay] = useState<ManagedCollectionDay>('MONDAY');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const countryCode = session?.user.countryCode;
    const city = session?.user.location?.city || '';
    if (!countryCode) return;

    apiService.getMarketAvailability({
      countryCode,
      city,
      area: session?.user.location?.area,
    })
      .then((result) => {
        const managedCollection = result.availability.services.find((service) => service.serviceKey === 'managed_collection');
        if (!managedCollection?.canBook) {
          Alert.alert(
            'Service Unavailable',
            managedCollection?.message || 'Managed Collection Services are not available in your country yet.',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
        }
      })
      .catch(() => {
        Alert.alert('Service unavailable', 'We could not confirm this service right now.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      });
  }, [navigation, session?.user.countryCode, session?.user.location?.area, session?.user.location?.city]);

  const toggleBin = (bin: ManagedCollectionBinColor) => {
    setBinPackage((current) => (
      current.includes(bin) ? current.filter((item) => item !== bin) : [...current, bin]
    ));
  };

  const submit = async () => {
    const city = session?.user.location?.city || '';
    if (!session?.user.countryCode || !city) {
      Alert.alert('Location Required', 'Please complete your country and city on your account before requesting this service.');
      return;
    }

    if (!fullAddress.trim()) {
      Alert.alert('Address Required', 'Please enter the collection address.');
      return;
    }

    if (!binPackage.length) {
      Alert.alert('Bin Package Required', 'Please choose at least one bin color.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await apiService.createManagedCollectionProfile({
        countryCode: session.user.countryCode,
        city,
        area: session.user.location?.area,
        fullAddress: fullAddress.trim(),
        propertyType,
        collectionType: 'GENERAL_WASTE',
        binPackage,
        frequency,
        preferredCollectionDay: preferredDay,
      });

      Alert.alert(
        'Request Confirmed',
        `Managed Collection Services profile created. ${result.reminders?.length || 0} reminder records were scheduled.`,
        [{ text: 'Done', onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      Alert.alert('Request Not Available', error.message || 'Unable to create managed collection request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>Managed Collection Services</Text>
        <Text style={styles.title}>Set up collection</Text>
        <Text style={styles.subtitle}>Start with general waste collection. Billing and route scheduling will be activated in a later phase.</Text>

        <Text style={styles.label}>Location</Text>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>{session?.user.countryCode || '-'} - {session?.user.location?.city || 'City not set'}</Text>
          {!!session?.user.location?.area && <Text style={styles.summarySubtext}>{session.user.location.area}</Text>}
        </View>

        <Text style={styles.label}>Collection Address</Text>
        <TextInput
          style={styles.input}
          placeholder="Street address, estate, unit, access notes"
          placeholderTextColor="#64748B"
          value={fullAddress}
          onChangeText={setFullAddress}
          multiline
        />

        <Text style={styles.label}>Property Type</Text>
        <View style={styles.optionGrid}>
          {propertyTypes.map((item) => (
            <OptionButton key={item} label={item} selected={propertyType === item} onPress={() => setPropertyType(item)} />
          ))}
        </View>

        <Text style={styles.label}>Collection Type</Text>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>GENERAL_WASTE</Text>
          <Text style={styles.summarySubtext}>More collection types will be configured in later phases.</Text>
        </View>

        <Text style={styles.label}>Bin Package</Text>
        <View style={styles.optionGrid}>
          {binColors.map((item) => (
            <OptionButton key={item} label={item} selected={binPackage.includes(item)} onPress={() => toggleBin(item)} />
          ))}
        </View>

        <Text style={styles.label}>Frequency</Text>
        <View style={styles.optionGrid}>
          {frequencies.map((item) => (
            <OptionButton key={item} label={item} selected={frequency === item} onPress={() => setFrequency(item)} />
          ))}
        </View>

        <Text style={styles.label}>Preferred Collection Day</Text>
        <View style={styles.optionGrid}>
          {days.map((item) => (
            <OptionButton key={item} label={item} selected={preferredDay === item} onPress={() => setPreferredDay(item)} />
          ))}
        </View>

        <TouchableOpacity style={styles.submitButton} onPress={submit} disabled={isSubmitting}>
          {isSubmitting ? <ActivityIndicator color="#090D14" /> : <Text style={styles.submitText}>Confirm Collection Request</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function OptionButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const displayLabel = typeof label === 'string' ? label.replace(/_/g, ' ') : '';

  return (
    <TouchableOpacity style={[styles.optionButton, selected && styles.optionButtonSelected]} onPress={onPress}>
      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{displayLabel}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090D14' },
  content: { padding: 22, paddingBottom: 40 },
  eyebrow: { color: '#00FF87', fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  title: { color: '#FFFFFF', fontSize: 26, fontWeight: '900', marginTop: 6 },
  subtitle: { color: '#94A3B8', fontSize: 13, lineHeight: 19, marginTop: 8, marginBottom: 24 },
  label: { color: '#E2E8F0', fontSize: 13, fontWeight: '800', marginTop: 18, marginBottom: 10 },
  summaryBox: { backgroundColor: '#111827', borderWidth: 1, borderColor: '#1E293B', borderRadius: 12, padding: 14 },
  summaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  summarySubtext: { color: '#64748B', fontSize: 12, marginTop: 4 },
  input: { minHeight: 84, backgroundColor: '#111827', borderWidth: 1, borderColor: '#1E293B', borderRadius: 12, padding: 14, color: '#FFFFFF', textAlignVertical: 'top' },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  optionButton: { borderWidth: 1, borderColor: '#1E293B', backgroundColor: '#111827', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 10 },
  optionButtonSelected: { borderColor: '#00FF87', backgroundColor: '#00FF8715' },
  optionText: { color: '#94A3B8', fontSize: 12, fontWeight: '800' },
  optionTextSelected: { color: '#00FF87' },
  submitButton: { height: 54, backgroundColor: '#00FF87', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 28 },
  submitText: { color: '#090D14', fontSize: 15, fontWeight: '900' },
});

export default ManagedCollectionScreen;
