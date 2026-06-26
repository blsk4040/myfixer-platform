// mobile_apps/client_app/src/screens/booking/BookingWizardScreen.tsx
import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft as LucideChevronLeft, MapPin as LucideMapPin } from 'lucide-react-native';

const ChevronLeft = LucideChevronLeft as any;
const MapPin = LucideMapPin as any;

export function BookingWizardScreen({ route, navigation }: any): React.JSX.Element {
  // Extract parameters from dashboard selection safely with robust fallback defaults
  const { category, subCategory, basePrice } = route?.params || { 
    category: 'appliances', 
    subCategory: 'General Assessment', 
    basePrice: 450 
  };

  // Helper utility to resolve human-readable titles from database IDs
  const getCategoryTitle = (id: string) => {
    const titles: Record<string, string> = {
      appliances: 'Appliance Repair',
      mechanic: 'Mechanic Callout',
      cleaning: 'Cleaning Services',
      electrical: 'Electrical Works',
      plumbing: 'Plumber Service',
      painter: 'Painter',
      gardening: 'Gardening & Landscaping',
      maintenance: 'Maintenance'
    };
    return titles[id] || id;
  };

  // Core Form Fields
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');

  // 1. Appliance Specific State
  const [applianceBrand, setApplianceBrand] = useState('');

  // 2. Mechanic Specific State
  const [vehicleDetails, setVehicleDetails] = useState(''); // e.g., Toyota Hilux 2019

  // 3. Electrical / Infrastructure Specific State
  const [infrastructureType, setInfrastructureType] = useState('Residential'); 

  // Form Submission Engine
  const handleDispatchSubmission = () => {
    if (!address.trim() || !description.trim()) {
      Alert.alert("Fields Required", "Please provide your service location address and a description of the problem.");
      return;
    }

    // Dynamic clean structural schema mapping matching backend design
    const bookingPayload = {
      categoryId: category,
      categoryName: getCategoryTitle(category),
      subCategory: subCategory,
      basePrice: basePrice,
      address: address.trim(),
      description: description.trim(),
      timestamp: new Date().toISOString(),
      metadata: {
        ...(category === 'appliances' && { brand: applianceBrand }),
        ...(category === 'mechanic' && { vehicle: vehicleDetails }),
        ...(category === 'electrical' && { infrastructure: infrastructureType }),
      }
    };

    console.log("Dispatch payload locked: ", bookingPayload);

    Alert.alert(
      "Searching for Specialists",
      `Your request for ${subCategory} is being broadcasted to verified service providers in your area...`,
      [{ text: "Track Progress", onPress: () => navigation?.navigate('Home') }]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Premium Back-navigation top header ribbon */}
      <View style={styles.topNavbar}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ChevronLeft color="#FFFFFF" size={22} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Create Dispatch Ticket</Text>
        <View style={styles.placeholderBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        
        {/* Active Target Banner Details */}
        <View style={styles.contextCard}>
          <View>
            <Text style={styles.contextMeta}>Selected Target Service</Text>
            <Text style={styles.contextMainTitle}>{subCategory}</Text>
            <Text style={styles.contextSubTitle}>{getCategoryTitle(category)} Group</Text>
          </View>
          <View style={styles.priceTag}>
            <Text style={styles.priceLabel}>Base Rate</Text>
            <Text style={styles.priceAmount}>R{basePrice}</Text>
          </View>
        </View>

        {/* SECTION 1: Location Address and Core Problems */}
        <Text style={styles.sectionTitle}>1. Location & Core Problem</Text>
        
        <Text style={styles.inputLabel}>Physical Address</Text>
        <View style={styles.inputWrapper}>
          <MapPin color="#64748B" size={18} style={styles.inputIcon} />
          <TextInput 
            style={[styles.input, { paddingLeft: 44 }]} 
            placeholder="e.g., 42 Calderwood Rd, Johannesburg" 
            placeholderTextColor="#64748B"
            value={address}
            onChangeText={setAddress}
          />
        </View>

        <Text style={styles.inputLabel}>Describe the Fault / Symptoms</Text>
        <TextInput 
          style={[styles.input, styles.textArea]} 
          placeholder="What exactly is going wrong? Give as much detail as possible to help the fixer prepare..." 
          placeholderTextColor="#64748B"
          multiline
          numberOfLines={4}
          value={description}
          onChangeText={setDescription}
        />

        {/* SECTION 2: Conditional Extra Attributes Metadata */}
        {(category === 'appliances' || category === 'mechanic' || category === 'electrical') && (
          <>
            <Text style={styles.sectionTitle}>2. Specialized Technical Details</Text>

            {category === 'appliances' && (
              <View>
                <Text style={styles.inputLabel}>Appliance Brand / Model (Optional)</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="e.g., Defy EcoCool, Samsung, LG" 
                  placeholderTextColor="#64748B"
                  value={applianceBrand}
                  onChangeText={setApplianceBrand}
                />
              </View>
            )}

            {category === 'mechanic' && (
              <View>
                <Text style={styles.inputLabel}>Vehicle Make, Model & Year</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="e.g., VW Polo 2017 / Toyota Hilux 2020" 
                  placeholderTextColor="#64748B"
                  value={vehicleDetails}
                  onChangeText={setVehicleDetails}
                />
              </View>
            )}

            {category === 'electrical' && (
              <View>
                <Text style={styles.inputLabel}>Property Setup Type</Text>
                <View style={styles.toggleRow}>
                  {['Residential', 'Commercial / 3-Phase'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.toggleChip, infrastructureType === type && styles.activeToggleChip]}
                      onPress={() => setInfrastructureType(type)}
                    >
                      <Text style={[styles.toggleChipText, infrastructureType === type && styles.activeToggleChipText]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </>
        )}

        {/* Cost Transparency Disclaimer Information Card */}
        <View style={styles.infoNoticeBox}>
          <Text style={styles.infoNoticeText}>
            * The base rate listed above covers the specialist's standard transit callout and initial diagnostic evaluation on site. Parts and extended manual labor plans will be quoted transparently before repair cycles initiate.
          </Text>
        </View>

        {/* Action Dispatch Button */}
        <TouchableOpacity style={styles.submitButton} activeOpacity={0.8} onPress={handleDispatchSubmission}>
          <Text style={styles.submitButtonText}>Broadcast Ticket To Network</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090D14' },
  topNavbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#111827', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#1E293B' },
  navTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  placeholderBtn: { width: 40 },
  scrollContainer: { padding: 20, paddingBottom: 40 },
  
  contextCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111827', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#1E293B', marginBottom: 24 },
  contextMeta: { color: '#64748B', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  contextMainTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginTop: 2 },
  contextSubTitle: { color: '#00FF87', fontSize: 12, fontWeight: '600', marginTop: 2 },
  priceTag: { alignItems: 'flex-end', backgroundColor: '#1E293B', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#334155' },
  priceLabel: { color: '#64748B', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  priceAmount: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginTop: 2 },

  sectionTitle: { color: '#64748B', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 16, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#1E293B', paddingBottom: 6 },
  inputLabel: { color: '#E2E8F0', fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 12 },
  inputWrapper: { position: 'relative', justifyContent: 'center' },
  inputIcon: { position: 'absolute', left: 14, zIndex: 5 },
  input: { backgroundColor: '#111827', color: '#FFFFFF', padding: 14, paddingHorizontal: 16, borderRadius: 12, fontSize: 15, borderWidth: 1, borderColor: '#1E293B' },
  textArea: { height: 110, textAlignVertical: 'top', paddingTop: 14 },
  
  toggleRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  toggleChip: { flex: 1, backgroundColor: '#111827', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#1E293B', alignItems: 'center' },
  activeToggleChip: { borderColor: '#00FF87', backgroundColor: '#00FF8710' },
  toggleChipText: { color: '#64748B', fontSize: 13, fontWeight: '600' },
  activeToggleChipText: { color: '#00FF87' },
  
  infoNoticeBox: { backgroundColor: '#111827', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#1E293B', marginTop: 24 },
  infoNoticeText: { color: '#64748B', fontSize: 11, lineHeight: 16, fontStyle: 'italic' },
  
  submitButton: { backgroundColor: '#00FF87', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 28 },
  submitButtonText: { color: '#090D14', fontSize: 15, fontWeight: '700' }
});