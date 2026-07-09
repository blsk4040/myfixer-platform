// mobile_apps/client_app/src/screens/dashboard/DashboardScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { 
  ActivityIndicator,
  Alert,
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
import apiService, { ServiceAvailabilityItem } from '../../services/api.service';
import authService from '../../services/auth.service';

const User = LucideUser as any;
const Zap = LucideZap as any;
const Droplet = LucideDroplet as any;
const X = LucideX as any;
const Wrench = LucideWrench as any;
const Paintbrush = LucidePaintbrush as any;
const Sprout = LucideSprout as any;
const Hammer = LucideHammer as any;

// 📁 Asset registrations
const FridgeIcon = require('../../assets/services/appliance-repair.png');
const MechanicIcon = require('../../assets/services/mechanic-callout.png');
const CleaningIcon = require('../../assets/services/cleaning-service.png');
const ElectricalIcon = require('../../assets/services/electrical-repair.png');
const PlumberIcon = require('../../assets/services/plumbing-service.png');
const PainterIcon = require('../../assets/services/painting-service.png');
const GardeningIcon = require('../../assets/services/gardening-service.png');
const MaintenanceIcon = require('../../assets/services/maintenance-service.png');
const ManagedCollectionIcon = require('../../assets/services/managed-collection.png');

const { width, height } = Dimensions.get('window');
const GRID_SIZE = (width - 52) / 2; 

export function DashboardScreen({ navigation }: any): React.JSX.Element {
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [availability, setAvailability] = useState<ServiceAvailabilityItem[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');
  const session = authService.getSession();
  const mustVerifyEmail = session?.user.role === 'CUSTOMER' && session.user.isEmailVerified === false;

  const serviceCatalog: Record<string, any> = {
    appliance_repair: {
      id: 'appliance_repair',
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
    automotive: {
      id: 'automotive',
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
    cleaning: {
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
    electrical: {
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
    plumbing: {
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
    painting: {
      id: 'painting',
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
    gardening: {
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
    maintenance: {
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
    },
    managed_collection: {
      id: 'managed_collection',
      title: 'Managed Collection Services',
      subtitle: 'General waste collection setup',
      icon: Hammer,
      imageSource: ManagedCollectionIcon,
      isCustomImage: true,
      color: '#38BDF8',
      subCategories: [
        { name: 'GENERAL_WASTE', basePrice: 0 },
      ],
    },
  };

  useEffect(() => {
    const session = authService.getSession();
    const countryCode = session?.user.countryCode || 'ZA';
    const city = session?.user.location?.city || '';
    const area = session?.user.location?.area || '';

    setAvailabilityLoading(true);
    setAvailabilityError('');
    apiService.getMarketAvailability({ countryCode, city, area })
      .then((result) => setAvailability(result.availability.services || []))
      .catch((error: Error) => setAvailabilityError(error.message || 'Unable to load service availability.'))
      .finally(() => setAvailabilityLoading(false));
  }, []);

  const mainServices = useMemo(() => {
    return availability
      .filter((service) => service.status !== 'DISABLED')
      .map((service) => {
        const card = serviceCatalog[service.serviceKey] || {
          id: service.serviceKey,
          title: service.label,
          subtitle: 'Service configured for your market',
          icon: Hammer,
          imageSource: MaintenanceIcon,
          isCustomImage: true,
          color: '#64748B',
          subCategories: [{ name: service.label, basePrice: 450 }],
        };

        return {
          ...card,
          id: service.serviceKey,
          serviceKey: service.serviceKey,
          title: service.label || card.title,
          availabilityStatus: service.status,
          canBook: service.canBook,
          availabilityMessage: service.message,
        };
      });
  }, [availability]);

  const handleCategoryPress = (category: any) => {
    if (mustVerifyEmail) {
      Alert.alert(
        'Verify Your Email',
        'Please verify your email before booking a service.'
      );
      navigation.navigate('VerifyEmailNotice');
      return;
    }

    if (!category.canBook) {
      if (category.availabilityStatus === 'COMING_SOON') {
        handleJoinWaitlist(category);
        return;
      }

      Alert.alert('Service Unavailable', category.availabilityMessage || 'This service is not available in your area yet.');
      return;
    }

    if (category.serviceKey === 'managed_collection') {
      navigation.navigate('ManagedCollection');
      return;
    }

    setSelectedCategory(category);
    setModalVisible(true);
  };

  const handleJoinWaitlist = async (category: any) => {
    const session = authService.getSession();
    const city = session?.user.location?.city || '';
    if (!session?.user.email || !session?.user.countryCode || !city) {
      Alert.alert('Location Required', 'Please complete your account location before joining a service waitlist.');
      return;
    }

    try {
      const result = await apiService.joinServiceWaitlist({
        email: session.user.email,
        phone: session.user.phone,
        countryCode: session.user.countryCode,
        city,
        area: session.user.location?.area,
        serviceKey: category.serviceKey,
      });
      Alert.alert('Waitlist Joined', result.message);
    } catch (error: any) {
      Alert.alert('Waitlist Error', error.message || 'Unable to join the waitlist right now.');
    }
  };

  const handleSubCategorySelect = (subName: string, price: number) => {
    setModalVisible(false);
    navigation.navigate('BookingWizard', {
      category: selectedCategory.id,
      serviceKey: selectedCategory.serviceKey,
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
            <Text style={styles.heroTitle}>What do you need fixed today?</Text>
            <Text style={styles.heroSubtitle}>Verified specialists, clear call-out fees, and repair quotes before extra work starts.</Text>
          </View>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>Verified help</Text>
          </View>
        </View>

        {mustVerifyEmail && (
          <TouchableOpacity
            style={styles.verifyBanner}
            activeOpacity={0.86}
            onPress={() => navigation.navigate('VerifyEmailNotice')}
          >
            <Text style={styles.verifyBannerTitle}>Verify your email</Text>
            <Text style={styles.verifyBannerText}>Please verify your email before booking a service.</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.sectionTitle}>Choose a service</Text>
        {availabilityLoading && (
          <View style={styles.availabilityNotice}>
            <ActivityIndicator size="small" color="#00FF87" />
            <Text style={styles.availabilityNoticeText}>Loading services for your area...</Text>
          </View>
        )}
        {!!availabilityError && (
          <View style={styles.availabilityNotice}>
            <Text style={styles.availabilityNoticeText}>{availabilityError}</Text>
          </View>
        )}

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
                {item.availabilityStatus && item.availabilityStatus !== 'ACTIVE' && (
                  <Text style={[styles.serviceStatusBadge, item.availabilityStatus === 'COMING_SOON' ? styles.statusSoon : styles.statusPaused]}>
                    {item.availabilityStatus === 'COMING_SOON' ? 'COMING SOON' : 'UNAVAILABLE'}
                  </Text>
                )}
                <Text style={styles.tileTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.tileSubtitle} numberOfLines={2}>{item.subtitle}</Text>
                <Text style={styles.tileFeeText}>Call-out fee shown before booking</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent={true} onRequestClose={() => setModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleWrap}>
                <Text style={styles.modalTitle}>What do you need help with?</Text>
                <Text style={styles.modalSubtitle}>The amount shown is the call-out fee. Repairs and parts are quoted after diagnosis.</Text>
              </View>
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
                    <Text style={styles.subItemEstimate}>Call-out fee for visit and diagnosis</Text>
                  </View>
                  <View style={styles.subItemFeePill}>
                    <Text style={[styles.subItemPrice, { color: selectedCategory.color }]}>R{sub.basePrice}</Text>
                  </View>
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
  heroCard: { backgroundColor: '#111827', borderWidth: 1, borderColor: '#1E293B', borderRadius: 16, padding: 20, marginBottom: 22, position: 'relative', overflow: 'hidden' },
  heroContent: { maxWidth: '88%' },
  heroTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', lineHeight: 24 },
  heroSubtitle: { color: '#94A3B8', fontSize: 13, marginTop: 6, lineHeight: 19 },
  heroBadge: { position: 'absolute', right: -15, top: 10, backgroundColor: '#1E293B', paddingHorizontal: 18, paddingVertical: 4, transform: [{ rotate: '12deg' }] },
  heroBadgeText: { color: '#00FF87', fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  verifyBanner: { backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#FBBF24', borderRadius: 12, padding: 14, marginBottom: 18 },
  verifyBannerTitle: { color: '#FBBF24', fontSize: 14, fontWeight: '900', marginBottom: 4 },
  verifyBannerText: { color: '#E2E8F0', fontSize: 12, fontWeight: '600', lineHeight: 18 },
  sectionTitle: { color: '#E2E8F0', fontSize: 15, fontWeight: '700', marginBottom: 16, letterSpacing: 0.3 },
  availabilityNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#111827', borderWidth: 1, borderColor: '#1E293B', borderRadius: 12, padding: 12, marginBottom: 12 },
  availabilityNoticeText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
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
  tileFeeText: { color: '#00FF87', fontSize: 10, fontWeight: '800', marginTop: 7 },
  serviceStatusBadge: { alignSelf: 'flex-start', fontSize: 9, fontWeight: '800', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, marginBottom: 5, overflow: 'hidden' },
  statusSoon: { color: '#FBBF24', backgroundColor: '#FBBF2420' },
  statusPaused: { color: '#F87171', backgroundColor: '#EF444420' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#111827', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderTopWidth: 1, borderColor: '#1E293B', maxHeight: height * 0.6 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 20 },
  modalTitleWrap: { flex: 1 },
  modalTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  modalSubtitle: { color: '#94A3B8', fontSize: 12, lineHeight: 18, marginTop: 6 },
  closeBtn: { backgroundColor: '#1E293B', padding: 8, borderRadius: 20, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  modalScrollBody: { paddingBottom: 24 },
  subItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 14, paddingVertical: 16, borderBottomWidth: 1, borderColor: '#1E293B' },
  subItemName: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  subItemEstimate: { color: '#64748B', fontSize: 12, marginTop: 2 },
  subItemFeePill: { minWidth: 76, minHeight: 38, borderRadius: 10, backgroundColor: '#090D14', borderWidth: 1, borderColor: '#1E293B', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  subItemPrice: { fontSize: 16, fontWeight: '800' }
});







