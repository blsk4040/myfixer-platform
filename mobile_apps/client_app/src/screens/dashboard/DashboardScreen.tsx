// mobile_apps/client_app/src/screens/dashboard/DashboardScreen.tsx
import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  Dimensions,
  Image,
  Modal,
  Pressable
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  User as LucideUser, 
  Zap as LucideZap,
  Droplet as LucideDroplet,
  X as LucideX,
  Wrench as LucideWrench,
  Paintbrush as LucidePaintbrush,
  Sprout as LucideSprout,
  Hammer as LucideHammer
} from 'lucide-react-native';

const User = LucideUser as any;
const Zap = LucideZap as any;
const Droplet = LucideDroplet as any;
const X = LucideX as any;
const Wrench = LucideWrench as any;
const Paintbrush = LucidePaintbrush as any;
const Sprout = LucideSprout as any;
const Hammer = LucideHammer as any;

// 📁 Asset registrations
const FridgeIcon = require('../assets/Fridge.png');
const MechanicIcon = require('../assets/Sedan-160-temp.png');
const CleaningIcon = require('../assets/cleaning_1.png');
const ElectricalIcon = require('../assets/electrical-repair-icon.png');
const PlumberIcon = require('../assets/plumbing.png');
const PainterIcon = require('../assets/painting-icon.png');
const GardeningIcon = require('../assets/FM_2.png');
const MaintenanceIcon = require('../assets/info-icon-1.png');

const { width, height } = Dimensions.get('window');
const GRID_SIZE = (width - 52) / 2; 

export function DashboardScreen({ navigation }: any): React.JSX.Element {
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const mainServices = [
    {
      id: 'appliances',
      title: 'Appliance Repair',
      subtitle: 'Fridges, washers & ovens',
      imageSource: FridgeIcon, 
      isCustomImage: true,
      color: '#EF4444',
      subCategories: [
        { name: 'Fridge & Freezer', basePrice: 450 },
        { name: 'Air Condition Repair and Services', basePrice: 500 },
        { name: 'Coffee Machine Repair', basePrice: 350 },
        { name: 'Stove & Oven Repair', basePrice: 400 },
        { name: 'Washing & Tumbler Repair', basePrice: 450 },
        { name: 'Tv repair', basePrice: 400 },
        { name: 'Dishwasher Repair', basePrice: 450 }
      ]
    },
    {
      id: 'mechanic',
      title: 'Mechanic Callout',
      subtitle: 'Engines, brakes & diagnostics',
      imageSource: MechanicIcon,
      isCustomImage: true,
      color: '#F97316',
      subCategories: [
        { name: 'Engine Diagnostics', basePrice: 600 },
        { name: 'Brake Replacement', basePrice: 550 },
        { name: 'Minor Vehicle Service', basePrice: 850 },
        { name: 'Battery / Jumpstart', basePrice: 300 },
        { name: 'Emergency Breakdown Assist', basePrice: 500 }
      ]
    },
    {
      id: 'cleaning',
      title: 'Cleaning Services',
      subtitle: 'Deep home & office sanitizing',
      icon: Droplet,
      imageSource: CleaningIcon,
      isCustomImage: true,
      color: '#10B981',
      subCategories: [
        { name: 'Regular House Cleaning', basePrice: 250 },
        { name: 'Deep Spring Cleaning', basePrice: 500 },
        { name: 'Carpet & Couch Wash', basePrice: 400 },
        { name: 'Solar Panel Cleaning', basePrice: 450 },
        { name: 'Post-Renovation / Move-in', basePrice: 750 }
      ]
    },
    {
      id: 'electrical',
      title: 'Electrical Works',
      subtitle: 'Tripping boards & wiring',
      icon: Zap,
      imageSource: ElectricalIcon,
      isCustomImage: true,
      color: '#FBBF24',
      subCategories: [
        { name: 'Fault Finding / Tripping', basePrice: 450 },
        { name: 'Inverter & Solar Diagnostics', basePrice: 850 },
        { name: 'DB Board Upgrades', basePrice: 1200 },
        { name: 'Light & Plug Installations', basePrice: 350 }
      ]
    },
    {
      id: 'plumbing',
      title: 'Plumber Service',
      subtitle: 'Leaks, drains & burst geysers',
      icon: Wrench,
      imageSource: PlumberIcon,
      isCustomImage: true,
      color: '#3B82F6',
      subCategories: [
        { name: 'Burst Geyser Emergency', basePrice: 750 },
        { name: 'Blocked Drain Cleaning', basePrice: 450 },
        { name: 'Leak Detection & Repair', basePrice: 500 },
        { name: 'Tap, Valve & Toilet Fixes', basePrice: 300 }
      ]
    },
    {
      id: 'painter',
      title: 'Painter',
      subtitle: 'Interior & exterior walls',
      icon: Paintbrush,
      imageSource: PainterIcon,
      isCustomImage: true,
      color: '#EC4899',
      subCategories: [
        { name: 'Interior Wall Painting', basePrice: 650 },
        { name: 'Exterior / Boundary Walls', basePrice: 950 },
        { name: 'Ceiling Repair & Paint', basePrice: 400 },
        { name: 'Gate & Fence Coating', basePrice: 350 }
      ]
    },
    {
      id: 'gardening',
      title: 'Gardening & Landscaping',
      subtitle: 'Lawn trimming & yard cleanups',
      icon: Sprout,
      imageSource: GardeningIcon,
      isCustomImage: true,
      color: '#84CC16',
      subCategories: [
        { name: 'Once-off Yard Cleanup', basePrice: 350 },
        { name: 'Tree Felling & Stump Removal', basePrice: 950 },
        { name: 'Lawn Dressing & Edging', basePrice: 200 },
        { name: 'Irrigation Repairs', basePrice: 400 }
      ]
    },
    {
      id: 'maintenance',
      title: 'Maintenance',
      subtitle: 'Handyman tasks & structural fixes',
      icon: Hammer,
      imageSource: MaintenanceIcon,
      isCustomImage: true,
      color: '#64748B',
      subCategories: [
        { name: 'TV Bracket Mounting', basePrice: 250 },
        { name: 'Door Lock & Handle Swaps', basePrice: 300 },
        { name: 'Blind & Curtain Hanging', basePrice: 200 },
        { name: 'Minor Plaster & Drywall Fix', basePrice: 400 }
      ]
    }
  ];

  const handleCategoryPress = (category: any) => {
    setSelectedCategory(category);
    setModalVisible(true);
  };

  const handleSubCategorySelect = (subName: string, price: number) => {
    setModalVisible(false);
    navigation.navigate('BookingWizard', {
      category: selectedCategory.id,
      subCategory: subName,
      basePrice: price,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        <View style={styles.header}>
          <View>
            <Text style={styles.welcomeText}>Good Day 👋</Text>
            <Text style={styles.brandText}>Find a <Text style={styles.proAccent}>Fixer</Text></Text>
          </View>
          <TouchableOpacity style={styles.profileAvatar} onPress={() => navigation.navigate('Account')}>
            <User color="#090D14" size={20} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>Professional help, dispatched instantly.</Text>
            <Text style={styles.heroSubtitle}>Verified service specialists at your doorstep.</Text>
          </View>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>24/7 Service</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Select a Core Service</Text>

        <View style={styles.gridContainer}>
          {mainServices.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.gridTile}
              activeOpacity={0.9}
              onPress={() => handleCategoryPress(item)}
            >
              {/* IMAGE LAYER CONTAINER */}
              <View style={[
                styles.tileImageContainer, 
                item.isCustomImage ? styles.whiteBackplate : { backgroundColor: `${item.color}10` }
              ]}>
                {item.isCustomImage ? (
                  <Image source={item.imageSource} style={styles.coverImage} resizeMode="contain" />
                ) : (
                  item.icon && <item.icon color={item.color} size={32} strokeWidth={2} />
                )}
              </View>
              
              {/* TEXT PANEL */}
              <View style={styles.tileMetaContainer}>
                <Text style={styles.tileTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.tileSubtitle} numberOfLines={2}>{item.subtitle}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent={true} onRequestClose={() => setModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Specialization</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setModalVisible(false)}>
                <X color="#64748B" size={20} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={true} contentContainerStyle={styles.modalScrollBody}>
              {selectedCategory?.subCategories.map((sub: any) => (
                <TouchableOpacity 
                  key={sub.name} 
                  style={styles.subItemRow}
                  onPress={() => handleSubCategorySelect(sub.name, sub.basePrice)}
                >
                  <View>
                    <Text style={styles.subItemName}>{sub.name}</Text>
                    <Text style={styles.subItemEstimate}>Estimated base rate setup</Text>
                  </View>
                  <Text style={[styles.subItemPrice, { color: selectedCategory.color }]}>R{sub.basePrice}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090D14' },
  scrollContainer: { 
    padding: 20,
    paddingBottom: 90
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  welcomeText: { color: '#64748B', fontSize: 14, fontWeight: '500' },
  brandText: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  proAccent: { color: '#00FF87' },
  profileAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' },
  heroCard: { backgroundColor: '#111827', borderWidth: 1, borderColor: '#1E293B', borderRadius: 16, padding: 20, marginBottom: 28, position: 'relative', overflow: 'hidden' },
  heroContent: { maxWidth: '85%' },
  heroTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', lineHeight: 24 },
  heroSubtitle: { color: '#64748B', fontSize: 13, marginTop: 6, lineHeight: 18 },
  heroBadge: { position: 'absolute', right: -15, top: 10, backgroundColor: '#1E293B', paddingHorizontal: 18, paddingVertical: 4, transform: [{ rotate: '12deg' }] },
  heroBadgeText: { color: '#00FF87', fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  sectionTitle: { color: '#E2E8F0', fontSize: 15, fontWeight: '700', marginBottom: 16, letterSpacing: 0.3 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 },
  gridTile: { 
    width: GRID_SIZE, 
    height: GRID_SIZE + 50, 
    backgroundColor: '#111827', 
    borderRadius: 16, 
    borderWidth: 1, 
    borderColor: '#1E293B', 
    overflow: 'hidden',
  },
  tileImageContainer: { 
    flex: 1, 
    width: '100%', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  whiteBackplate: {
    backgroundColor: '#FFFFFF',
    padding: 16
  },
  coverImage: { 
    width: '100%', 
    height: '100%' 
  },
  tileMetaContainer: { 
    padding: 12, 
    backgroundColor: '#111827',
    borderTopWidth: 1,
    borderColor: '#1E293B'
  },
  tileTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  tileSubtitle: { color: '#64748B', fontSize: 11, marginTop: 3, lineHeight: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#111827', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderTopWidth: 1, borderColor: '#1E293B', maxHeight: height * 0.6 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  closeBtn: { backgroundColor: '#1E293B', padding: 8, borderRadius: 20, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  modalScrollBody: { paddingBottom: 24 },
  subItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderColor: '#1E293B' },
  subItemName: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  subItemEstimate: { color: '#64748B', fontSize: 12, marginTop: 2 },
  subItemPrice: { fontSize: 16, fontWeight: '700' }
});