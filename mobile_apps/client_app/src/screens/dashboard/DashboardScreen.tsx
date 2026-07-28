// mobile_apps/client_app/src/screens/dashboard/DashboardScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Bell,
  Briefcase,
  Car,
  ChevronRight,
  HeartPulse,
  Home,
  KeyRound,
  MapPin,
  Monitor,
  Search,
  ShieldCheck,
  Star,
  User,
  Wrench,
  X,
} from 'lucide-react-native';

import apiService, {
  BookingDetails,
  MarketAvailabilityBookableService,
  MarketAvailabilityCategory,
  MarketAvailabilityGroup,
  BookingHistoryItem,
  ServiceAvailabilityItem,
} from '../../services/api.service';
import authService from '../../services/auth.service';
import { Colors, Radius, Spacing, Typography } from '../../theme';
import { getUnreadNotificationCounts } from '../../utils/notificationFeed';

const BellIcon = Bell as any;
const BriefcaseIcon = Briefcase as any;
const CarIcon = Car as any;
const ChevronRightIcon = ChevronRight as any;
const HeartPulseIcon = HeartPulse as any;
const HomeIcon = Home as any;
const KeyRoundIcon = KeyRound as any;
const MapPinIcon = MapPin as any;
const MonitorIcon = Monitor as any;
const SearchIcon = Search as any;
const ShieldCheckIcon = ShieldCheck as any;
const StarIcon = Star as any;
const UserIcon = User as any;
const WrenchIcon = Wrench as any;
const XIcon = X as any;

const FridgeIcon = require('../../assets/services/appliance-repair.png');
const MechanicIcon = require('../../assets/services/mechanic-callout.png');
const CleaningIcon = require('../../assets/services/cleaning-service.png');
const ElectricalIcon = require('../../assets/services/electrical-repair.png');
const PlumberIcon = require('../../assets/services/plumbing-service.png');
const PainterIcon = require('../../assets/services/painting-service.png');
const GardeningIcon = require('../../assets/services/gardening-service.png');
const MaintenanceIcon = require('../../assets/services/maintenance-service.png');
const ManagedCollectionIcon = require('../../assets/services/managed-collection.png');
const AppLogo = require('../../assets/logo/app_logo.png');

const { width, height } = Dimensions.get('window');
const GROUP_CARD_WIDTH = Math.max(132, (width - 64) / 3);

type HomeService = {
  id: string;
  serviceKey: string;
  groupKey: string;
  categoryKey: string;
  title: string;
  subtitle: string;
  availabilityStatus: MarketAvailabilityCategory['status'];
  canBook: boolean;
  availabilityMessage: string;
  imageSource: any;
  remoteImageFailureKey: string;
  socialProof?: MarketAvailabilityCategory['socialProof'];
  subCategories: Array<{
    key?: string;
    serviceKey: string;
    name: string;
    description?: string;
    basePrice: number;
    calloutFeeMinor?: number;
    calloutFeeEnabled?: boolean;
    feeLabel: string;
    inspectionRequired?: boolean;
    socialProof?: MarketAvailabilityBookableService['socialProof'];
  }>;
};

type ServiceGroupCard = {
  groupKey: string;
  titleLines: string[];
  Icon: any;
  categoryCount: number;
};

const isVisibleCatalogueStatus = (status?: string) => {
  const normalized = String(status || '').toUpperCase();
  return normalized === 'ACTIVE' || normalized === 'PUBLISHED';
};

const isHiddenCatalogueStatus = (status?: string) => {
  const normalized = String(status || '').toUpperCase();
  return normalized === 'DRAFT' || normalized === 'ARCHIVED' || normalized === 'PAUSED' || normalized === 'DISABLED';
};

const stackGroupTitle = (value: string) =>
  String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

const socialProofText = (proof?: MarketAvailabilityCategory['socialProof']) => {
  if (!proof) return '';
  const parts: string[] = [];
  if (typeof proof.averageRating === 'number' && proof.reviewCount > 0) {
    parts.push(`${proof.averageRating.toFixed(1)} rating`);
  }
  if (proof.completedJobs > 0) {
    const suffix = proof.city ? ` in ${proof.city}` : '';
    parts.push(`${proof.completedJobs.toLocaleString()} jobs completed${suffix}`);
  }
  return parts.join(' - ');
};

const resolveTopLevelGroupIcon = (groupKey?: string, label?: string) => {
  const text = `${groupKey || ''} ${label || ''}`.toLowerCase();
  if (/(auto|car|vehicle|mechanic)/.test(text)) return CarIcon;
  if (/(business|office|company|commercial)/.test(text)) return BriefcaseIcon;
  if (/(it|tech|computer|laptop|software|support)/.test(text)) return MonitorIcon;
  if (/(health|care|medical|nurse|doctor)/.test(text)) return HeartPulseIcon;
  if (/(rent|rental|lease|property|key)/.test(text)) return KeyRoundIcon;
  if (/(home|house|clean|plumb|paint|garden|maintenance|appliance)/.test(text)) return HomeIcon;
  return WrenchIcon;
};

export function DashboardScreen({ navigation }: any): React.JSX.Element {
  const [selectedCategory, setSelectedCategory] = useState<HomeService | null>(null);
  const [selectedGroupKey, setSelectedGroupKey] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [availabilityGroups, setAvailabilityGroups] = useState<MarketAvailabilityGroup[]>([]);
  const [legacyAvailability, setLegacyAvailability] = useState<ServiceAvailabilityItem[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');
  const [availabilityCurrency, setAvailabilityCurrency] = useState('');
  const [activeBooking, setActiveBooking] = useState<BookingDetails | null>(null);
  const [activeBookingLoading, setActiveBookingLoading] = useState(false);
  const [pendingReview, setPendingReview] = useState<BookingHistoryItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [failedRemoteImages, setFailedRemoteImages] = useState<Record<string, true>>({});
  const [alertsUnreadCount, setAlertsUnreadCount] = useState(0);

  const session = authService.getSession();
  const firstName = session?.user.name?.split(' ')[0] || 'there';
  const locationLabel = [
    session?.user.location?.area,
    session?.user.location?.city,
  ].filter(Boolean).join(', ');
  const mustVerifyEmail = session?.user.role === 'CUSTOMER' && session.user.isEmailVerified === false;

  const serviceImageRegistry: Record<string, any> = {
    appliance_repair: FridgeIcon,
    automotive: MechanicIcon,
    cleaning: CleaningIcon,
    electrical: ElectricalIcon,
    plumbing: PlumberIcon,
    painting: PainterIcon,
    gardening: GardeningIcon,
    maintenance: MaintenanceIcon,
    managed_collection: ManagedCollectionIcon,
    placeholder: MaintenanceIcon,
  };

  const resolveCatalogueImage = (item: { imageUrl?: string; imageKey?: string; serviceKey?: string; categoryKey?: string; groupKey?: string }) => {
    const stableKey = item.serviceKey || item.categoryKey || item.groupKey || item.imageKey || 'placeholder';
    const failedKey = `${stableKey}:${item.imageUrl || ''}`;
    if (item.imageUrl && !failedRemoteImages[failedKey]) {
      return { source: { uri: item.imageUrl }, failedKey };
    }

    const imageKey = item.imageKey || item.serviceKey || item.categoryKey || item.groupKey || 'placeholder';
    return {
      source: serviceImageRegistry[imageKey] || serviceImageRegistry.placeholder,
      failedKey: '',
    };
  };

  const formatFee = (amountMinor?: number, enabled = true) => {
    if (!enabled) return 'Quote after inspection';
    if (typeof amountMinor !== 'number') return 'Quote based';
    if (amountMinor <= 0) return 'Quote after inspection';
    const amount = amountMinor / 100;
    if (!availabilityCurrency) return 'Fee configured';
    return availabilityCurrency === 'ZAR'
      ? `R${amount.toFixed(0)}`
      : `${availabilityCurrency} ${amount.toFixed(2)}`;
  };

  const hasVisibleCalloutFee = (enabled?: boolean, amountMinor?: number) => {
    if (enabled === false) return false;
    return typeof amountMinor === 'number' && amountMinor > 0;
  };

  const loadAvailability = useCallback(async () => {
    const currentSession = authService.getSession();
    const countryCode = currentSession?.user.countryCode || '';
    const city = currentSession?.user.location?.city || '';
    const area = currentSession?.user.location?.area || '';

    if (!countryCode) {
      setAvailabilityGroups([]);
      setLegacyAvailability([]);
      setAvailabilityError('No active market is linked to your account yet.');
      return;
    }

    setAvailabilityLoading(true);
    setAvailabilityError('');
    try {
      const result = await apiService.getMarketAvailability({ countryCode, city, area });
      setAvailabilityCurrency(result.availability.currency || currentSession?.user.currency || '');
      setAvailabilityGroups(Array.isArray(result.availability.groups) ? result.availability.groups : []);
      setLegacyAvailability(result.availability.services || []);
    } catch (error: any) {
      setAvailabilityError(error.message || 'Unable to load service availability.');
    } finally {
      setAvailabilityLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAvailability();
  }, [loadAvailability]);

  useEffect(() => {
    let isMounted = true;

    const loadAlertCount = async () => {
      try {
        const result = await apiService.getNotifications();
        if (isMounted) setAlertsUnreadCount(getUnreadNotificationCounts(result.notifications || []).alerts);
      } catch {
        if (isMounted) setAlertsUnreadCount(0);
      }
    };

    void loadAlertCount();
    const unsubscribe = navigation.addListener?.('focus', loadAlertCount);
    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, [navigation]);

  useEffect(() => {
    setActiveBookingLoading(true);
    apiService.getMyActiveBooking()
      .then((result) => setActiveBooking(result.active ? result.booking : null))
      .catch(() => setActiveBooking(null))
      .finally(() => setActiveBookingLoading(false));
  }, []);

  useEffect(() => {
    apiService.getMyBookingHistory()
      .then((result) => {
        const nextPendingReview = (result.bookings || []).find((booking) => booking.canReview);
        setPendingReview(nextPendingReview || null);
      })
      .catch(() => setPendingReview(null));
  }, []);

  const visibleBackendGroups = useMemo(() => {
    return availabilityGroups
      .map((group) => ({
        ...group,
        categories: (group.categories || [])
          .map((category) => ({
            ...category,
            services: (category.services || []).filter((service) => service.canBook && service.status === 'ACTIVE'),
          }))
          .filter((category) => isVisibleCatalogueStatus(category.status) && category.services.length > 0),
      }))
      .filter((group) => !isHiddenCatalogueStatus(group.status) && group.categories.length > 0)
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0) || a.label.localeCompare(b.label));
  }, [availabilityGroups]);

  const legacyFallbackGroups = useMemo<MarketAvailabilityGroup[]>(() => {
    if (availabilityGroups.length > 0) return [];
    const categories = legacyAvailability
      .filter((service) => service.canBook && service.status === 'ACTIVE')
      .map((service, index): MarketAvailabilityCategory | null => {
        const services: MarketAvailabilityBookableService[] = (service.subcategories || [])
          .filter((subcategory) => subcategory.status === 'ACTIVE')
          .map((subcategory, subIndex) => ({
            serviceKey: subcategory.subcategoryKey || service.serviceKey,
            legacySubcategoryKey: subcategory.subcategoryKey,
            categoryKey: service.serviceKey,
            groupKey: 'available_services',
            label: subcategory.label,
            description: subcategory.description || '',
            imageKey: subcategory.imageKey || service.imageKey,
            imageUrl: subcategory.imageUrl || service.imageUrl,
            status: subcategory.status,
            canBook: service.canBook,
            message: service.message,
            calloutFeeEnabled: subcategory.calloutFeeEnabled ?? service.calloutFeeEnabled ?? ((subcategory.calloutFeeMinor ?? service.calloutFeeMinor ?? 0) > 0),
            calloutFeeMinor: subcategory.calloutFeeMinor ?? service.calloutFeeMinor ?? 0,
            displayOrder: subIndex * 10,
          }));

        if (!services.length) {
          services.push({
            serviceKey: service.serviceKey,
            legacySubcategoryKey: service.serviceKey,
            categoryKey: service.serviceKey,
            groupKey: 'available_services',
            label: service.label,
            description: service.description || '',
            imageKey: service.imageKey,
            imageUrl: service.imageUrl,
            status: service.status,
            canBook: service.canBook,
            message: service.message,
            calloutFeeEnabled: service.calloutFeeEnabled ?? ((service.calloutFeeMinor ?? 0) > 0),
            calloutFeeMinor: service.calloutFeeMinor ?? 0,
            displayOrder: 0,
          });
        }

        if (!services.length) return null;
        return {
          categoryKey: service.serviceKey,
          legacyServiceKey: service.serviceKey,
          groupKey: 'available_services',
          label: service.label,
          description: service.description || '',
          imageKey: service.imageKey,
          imageUrl: service.imageUrl,
          status: service.status,
          displayOrder: index * 10,
          services,
        };
      })
      .filter((category): category is MarketAvailabilityCategory => Boolean(category));

    return categories.length
      ? [{
          groupKey: 'available_services',
          label: 'Available Services',
          description: 'Services currently available in your area',
          status: 'PUBLISHED',
          displayOrder: 0,
          categories,
        }]
      : [];
  }, [availabilityGroups.length, legacyAvailability]);

  const visibleGroups = visibleBackendGroups.length ? visibleBackendGroups : legacyFallbackGroups;

  useEffect(() => {
    if (!visibleGroups.length) {
      if (selectedGroupKey) setSelectedGroupKey('');
      return;
    }
    if (!visibleGroups.some((group) => group.groupKey === selectedGroupKey)) {
      setSelectedGroupKey(visibleGroups[0].groupKey);
    }
  }, [selectedGroupKey, visibleGroups]);

  const selectedGroup = visibleGroups.find((group) => group.groupKey === selectedGroupKey) || visibleGroups[0] || null;

  const groupCards = useMemo<ServiceGroupCard[]>(() => {
    return visibleGroups.map((group) => {
      return {
        groupKey: group.groupKey,
        titleLines: stackGroupTitle(group.label),
        Icon: resolveTopLevelGroupIcon(group.iconKey || group.groupKey, group.label),
        categoryCount: group.categories?.length || 0,
      };
    });
  }, [visibleGroups]);

  const mainServices = useMemo<HomeService[]>(() => {
    if (!selectedGroup) return [];
    return selectedGroup.categories
      .slice()
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((category) => {
        const services = category.services
          .slice()
          .sort((a, b) => a.label.localeCompare(b.label));
        const image = resolveCatalogueImage({
          serviceKey: category.legacyServiceKey,
          categoryKey: category.categoryKey,
          imageKey: category.imageKey || category.iconKey,
          imageUrl: category.imageUrl,
        });
        return {
          id: category.categoryKey,
          serviceKey: category.legacyServiceKey || category.categoryKey,
          groupKey: selectedGroup.groupKey,
          categoryKey: category.categoryKey,
          title: category.label,
          subtitle: category.description || 'Choose a service to continue',
          availabilityStatus: category.status,
          canBook: services.length > 0,
          availabilityMessage: '',
          imageSource: image.source,
          remoteImageFailureKey: image.failedKey,
          socialProof: category.socialProof,
          subCategories: services.map((service) => ({
            key: service.legacySubcategoryKey || service.serviceKey,
            serviceKey: service.serviceKey,
            name: service.label,
            description: service.description,
            basePrice: (service.calloutFeeMinor ?? 0) / 100,
            calloutFeeMinor: service.calloutFeeMinor,
            calloutFeeEnabled: hasVisibleCalloutFee(service.calloutFeeEnabled, service.calloutFeeMinor),
            feeLabel: formatFee(service.calloutFeeMinor, hasVisibleCalloutFee(service.calloutFeeEnabled, service.calloutFeeMinor)),
            inspectionRequired: service.inspectionRequired,
            socialProof: service.socialProof,
          })),
        };
      });
  }, [selectedGroup, failedRemoteImages, availabilityCurrency]);

  const filteredServices = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return mainServices;
    return mainServices.filter((service) =>
      `${service.title} ${service.subtitle} ${service.serviceKey} ${service.subCategories.map((sub) => sub.name).join(' ')}`.toLowerCase().includes(query)
    );
  }, [mainServices, searchQuery]);

  const popularServices = filteredServices.slice(0, 8);

  const handleCategoryPress = (category: HomeService) => {
    if (mustVerifyEmail) {
      Alert.alert('Verify Your Email', 'Please verify your email before booking a service.');
      navigation.navigate('VerifyEmailNotice');
      return;
    }

    if (!category.canBook) {
      if (category.availabilityStatus === 'COMING_SOON') {
        void handleJoinWaitlist(category);
        return;
      }

      Alert.alert('Service Unavailable', category.availabilityMessage || 'This service is not available in your area yet.');
      return;
    }

    if (category.serviceKey === 'managed_collection') {
      navigation.navigate('ManagedCollection');
      return;
    }

    if (category.serviceKey === 'rental_property') {
      Alert.alert(
        'Property Listings Coming Soon',
        'Rental Property Listings are prepared in your market settings, but the landlord listing and browsing module is not released in this app version yet.'
      );
      return;
    }

    setSelectedCategory(category);
    setModalVisible(true);
  };

  const handleJoinWaitlist = async (category: HomeService) => {
    const currentSession = authService.getSession();
    const city = currentSession?.user.location?.city || '';

    if (!currentSession?.user.email || !currentSession?.user.countryCode || !city) {
      Alert.alert('Location Required', 'Please complete your account location before joining a service waitlist.');
      return;
    }

    try {
      const result = await apiService.joinServiceWaitlist({
        email: currentSession.user.email,
        phone: currentSession.user.phone,
        countryCode: currentSession.user.countryCode,
        city,
        area: currentSession.user.location?.area,
        serviceKey: category.serviceKey,
      });
      Alert.alert('Waitlist Joined', result.message);
    } catch (error: any) {
      Alert.alert('Waitlist Error', error.message || 'Unable to join the waitlist right now.');
    }
  };

  const handleSubCategorySelect = (sub: { key?: string; serviceKey: string; name: string; basePrice: number; calloutFeeMinor?: number; calloutFeeEnabled?: boolean; inspectionRequired?: boolean }) => {
    if (!selectedCategory) return;
    setModalVisible(false);
    navigation.navigate('BookingWizard', {
      category: selectedCategory.categoryKey,
      serviceKey: sub.serviceKey,
      subCategory: sub.name,
      subCategoryKey: sub.key,
      basePrice: sub.basePrice,
      calloutFeeMinor: sub.calloutFeeMinor,
      calloutFeeEnabled: sub.calloutFeeEnabled,
      inspectionRequired: sub.inspectionRequired,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={availabilityLoading} onRefresh={loadAvailability} tintColor={Colors.primary} />}
      >
        <View style={styles.header}>
          <View style={styles.brandBlock}>
            <Image source={AppLogo} style={styles.logo} resizeMode="contain" />
            <View style={styles.locationRow}>
              <MapPinIcon color={Colors.textSubtle} size={14} />
              <Text style={styles.locationText} numberOfLines={1}>
                {locationLabel || 'Set your service location'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.iconButton, alertsUnreadCount > 0 && styles.iconButtonUnread]}
            onPress={() => navigation.navigate('Alerts')}
            accessibilityRole="button"
            accessibilityLabel={`Open alerts${alertsUnreadCount > 0 ? `, ${alertsUnreadCount} unread` : ''}`}
          >
            <BellIcon color={alertsUnreadCount > 0 ? Colors.primary : Colors.text} size={20} />
            {alertsUnreadCount > 0 ? (
              <View style={styles.alertBadge}>
                <Text style={styles.alertBadgeText}>{alertsUnreadCount > 99 ? '99+' : alertsUnreadCount}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>

        <View style={styles.greetingBlock}>
          <Text style={styles.greeting}>Hello, {firstName}</Text>
          <Text style={styles.headline}>What service do you need today?</Text>
        </View>

        {activeBookingLoading ? (
          <View style={styles.activeBookingCard}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={styles.activeBookingMeta}>Checking active bookings...</Text>
          </View>
        ) : activeBooking ? (
          <TouchableOpacity
            style={styles.activeBookingCard}
            activeOpacity={0.86}
            onPress={() => navigation.navigate('TrackingMain', { bookingId: activeBooking.id })}
          >
            <View style={styles.activeBookingTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.activeBookingLabel}>Active booking</Text>
                <Text style={styles.activeBookingTitle} numberOfLines={1}>
                  {String(activeBooking.applianceType || activeBooking.serviceKey || 'Service booking')}
                </Text>
              </View>
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>{String(activeBooking.status || 'ACTIVE').replace(/_/g, ' ')}</Text>
              </View>
            </View>
            <Text style={styles.activeBookingMeta} numberOfLines={1}>
              {activeBooking.technician?.name ? `Professional: ${activeBooking.technician.name}` : 'We will show professional details when assigned.'}
            </Text>
            <View style={styles.activeBookingActions}>
              <Text style={styles.trackText}>Track booking</Text>
              <ChevronRightIcon color={Colors.background} size={18} />
            </View>
          </TouchableOpacity>
        ) : null}

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

        {pendingReview && (
          <TouchableOpacity
            style={styles.reviewReminderCard}
            activeOpacity={0.86}
            onPress={() => navigation.navigate('History')}
          >
            <View style={styles.reviewReminderIcon}>
              <StarIcon color={Colors.background} size={18} fill={Colors.background} />
            </View>
            <View style={styles.reviewReminderCopy}>
              <Text style={styles.reviewReminderTitle}>Rate your recent Padi job</Text>
              <Text style={styles.reviewReminderText} numberOfLines={1}>
                {pendingReview.applianceType || pendingReview.serviceKey || 'Completed service'} is ready for your feedback.
              </Text>
            </View>
            <ChevronRightIcon color={Colors.background} size={18} strokeWidth={3} />
          </TouchableOpacity>
        )}

        <View style={styles.searchShell}>
          <SearchIcon color={Colors.textSubtle} size={18} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search for a service"
            placeholderTextColor={Colors.textSubtle}
            returnKeyType="search"
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.groupRow}
        >
          {groupCards.map((group) => {
            const GroupIcon = group.Icon;
            return (
              <TouchableOpacity
                key={group.groupKey}
                style={[styles.groupCard, selectedGroup?.groupKey === group.groupKey && styles.groupCardSelected]}
                activeOpacity={0.86}
                onPress={() => {
                  setSelectedGroupKey(group.groupKey);
                  setSearchQuery('');
                }}
              >
                <View style={[styles.groupIconWrap, selectedGroup?.groupKey === group.groupKey && styles.groupIconWrapSelected]}>
                  <GroupIcon color="#FFB547" size={28} strokeWidth={2.25} />
                </View>
                <View style={styles.groupTitleStack}>
                  {group.titleLines.map((line, index) => (
                    <Text key={`${group.groupKey}-${line}-${index}`} style={styles.groupTitle} numberOfLines={1}>
                      {line}
                    </Text>
                  ))}
                </View>
                <Text style={styles.groupMeta}>
                  {group.categoryCount} {group.categoryCount === 1 ? 'category' : 'categories'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.trustBanner}>
          <ShieldCheckIcon color={Colors.primary} size={18} />
          <Text style={styles.trustText}>Verified professionals</Text>
          <Text style={styles.trustDot}>.</Text>
          <Text style={styles.trustText}>Secure payments</Text>
          <Text style={styles.trustDot}>.</Text>
          <Text style={styles.trustText}>Live tracking</Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Popular Services</Text>
          {availabilityLoading ? <ActivityIndicator size="small" color={Colors.primary} /> : null}
        </View>

        {!!availabilityError && (
          <View style={styles.noticeCard}>
            <Text style={styles.noticeText}>{availabilityError}</Text>
          </View>
        )}

        {!availabilityLoading && !availabilityError && popularServices.length === 0 && (
          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>No services are currently available in your area.</Text>
            <Text style={styles.noticeText}>Services will appear here when they are published and available in your country and city.</Text>
          </View>
        )}

        <View style={styles.serviceList}>
          {popularServices.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.serviceRow}
              activeOpacity={0.86}
              onPress={() => handleCategoryPress(item)}
            >
              <View style={styles.serviceIconWrap}>
                <Image
                  source={item.imageSource}
                  style={styles.serviceIcon}
                  resizeMode="contain"
                  onError={() => {
                    if (item.remoteImageFailureKey) {
                      setFailedRemoteImages((current) => ({ ...current, [item.remoteImageFailureKey]: true }));
                    }
                  }}
                />
              </View>
              <View style={styles.serviceTextBlock}>
                <View style={styles.serviceTitleRow}>
                  <Text style={styles.serviceTitle} numberOfLines={1}>{item.title}</Text>
                  {item.availabilityStatus !== 'ACTIVE' ? (
                    <Text style={styles.serviceStatus}>
                      {item.availabilityStatus === 'COMING_SOON' ? 'Soon' : 'Paused'}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.serviceSubtitle} numberOfLines={1}>{item.subtitle}</Text>
                {!!socialProofText(item.socialProof) && (
                  <Text style={styles.serviceSocialProof} numberOfLines={1}>{socialProofText(item.socialProof)}</Text>
                )}
                <View style={styles.serviceMetaRow}>
                  <Text style={styles.serviceCount}>
                    {item.subCategories.length} {item.subCategories.length === 1 ? 'service' : 'services'}
                  </Text>
                </View>
              </View>
              <View style={styles.serviceArrow}>
                <ChevronRightIcon color={Colors.background} size={17} strokeWidth={3} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleWrap}>
                <Text style={styles.modalTitle}>What do you need help with?</Text>
                <Text style={styles.modalSubtitle}>Some services include a call-out fee. Others can be requested with no call-out charge.</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setModalVisible(false)}>
                <XIcon color={Colors.textMuted} size={20} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator contentContainerStyle={styles.modalScrollBody}>
              {selectedCategory?.subCategories.map((sub) => (
                <TouchableOpacity
                  key={sub.key || sub.name}
                  style={styles.subItemRow}
                  onPress={() => handleSubCategorySelect(sub)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.subItemName}>{sub.name}</Text>
                    <Text style={styles.subItemEstimate}>
                      {sub.calloutFeeEnabled === false ? 'Quote after inspection' : 'Call-out fee for visit and diagnosis'}
                    </Text>
                    {!!socialProofText(sub.socialProof) && (
                      <Text style={styles.subItemProof}>{socialProofText(sub.socialProof)}</Text>
                    )}
                  </View>
                  <View style={styles.subItemFeePill}>
                    <Text style={styles.subItemPrice} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                      {sub.feeLabel}
                    </Text>
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
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 112,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.lg,
    marginBottom: 22,
  },
  brandBlock: { flex: 1 },
  logo: {
    width: 92,
    height: 40,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  locationText: { flex: 1, color: Colors.textSubtle, fontSize: 12, fontWeight: '600' },
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#111114',
    borderWidth: 1,
    borderColor: '#2A2A31',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 8,
  },
  iconButtonUnread: {
    borderColor: 'rgba(239, 68, 68, 0.5)',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  alertBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    borderWidth: 1,
    borderColor: '#7F1D1D',
  },
  alertBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  greetingBlock: { marginBottom: 20 },
  greeting: { color: Colors.textMuted, fontSize: 14, fontWeight: '700' },
  headline: { color: Colors.text, fontSize: 31, lineHeight: 37, fontWeight: '900', marginTop: 6, letterSpacing: 0 },
  activeBookingCard: {
    backgroundColor: Colors.primary,
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 8,
  },
  activeBookingTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  activeBookingLabel: { color: Colors.background, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  activeBookingTitle: { color: Colors.background, fontSize: 18, fontWeight: '900', marginTop: 3 },
  activeBookingMeta: { color: '#1B1B1F', fontSize: 12, fontWeight: '700', marginTop: Spacing.md },
  statusBadge: {
    backgroundColor: 'rgba(11, 11, 13, 0.12)',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
  },
  statusBadgeText: { color: Colors.background, fontSize: 10, fontWeight: '900' },
  activeBookingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  trackText: { color: Colors.background, fontSize: 13, fontWeight: '900' },
  verifyBanner: {
    backgroundColor: '#151312',
    borderWidth: 1,
    borderColor: 'rgba(255, 181, 71, 0.42)',
    borderRadius: 18,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  verifyBannerTitle: { color: Colors.amber, fontSize: 14, fontWeight: '900', marginBottom: 4 },
  verifyBannerText: { color: Colors.text, fontSize: 12, fontWeight: '600', lineHeight: 18 },
  reviewReminderCard: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: 22,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.lg,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 7,
  },
  reviewReminderIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(11, 11, 13, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewReminderCopy: { flex: 1, minWidth: 0 },
  reviewReminderTitle: { color: Colors.background, fontSize: 14, fontWeight: '900' },
  reviewReminderText: { color: '#1B1B1F', fontSize: 12, fontWeight: '700', marginTop: 3 },
  searchShell: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: '#111114',
    borderWidth: 1,
    borderColor: '#27272E',
    borderRadius: 22,
    paddingHorizontal: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 5,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
  },
  groupRow: { gap: 12, paddingBottom: 18, paddingRight: 6 },
  groupCard: {
    width: GROUP_CARD_WIDTH,
    minHeight: 132,
    backgroundColor: '#101013',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#292930',
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 5,
  },
  groupCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#171A16',
    shadowColor: Colors.primary,
    shadowOpacity: 0.16,
  },
  groupIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 181, 71, 0.13)',
    borderWidth: 1,
    borderColor: 'rgba(255, 181, 71, 0.28)',
  },
  groupIconWrapSelected: {
    backgroundColor: 'rgba(255, 181, 71, 0.2)',
    borderColor: '#FFB547',
  },
  groupTitleStack: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 18,
    textAlign: 'center',
  },
  groupMeta: {
    color: Colors.textSubtle,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: -2,
  },
  groupSubtitle: {
    color: Colors.textSubtle,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  trustBanner: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 7,
    backgroundColor: '#101113',
    borderWidth: 1,
    borderColor: '#24242A',
    borderRadius: 18,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginBottom: 22,
  },
  trustText: { color: Colors.textMuted, fontSize: 12, fontWeight: '700' },
  trustDot: { color: Colors.textSubtle, fontSize: 12, fontWeight: '900' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  sectionTitle: { color: Colors.text, fontSize: 18, fontWeight: '900' },
  noticeCard: {
    backgroundColor: '#111114',
    borderWidth: 1,
    borderColor: '#28282F',
    borderRadius: 20,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  noticeTitle: { color: Colors.text, fontSize: 14, fontWeight: '900', marginBottom: 4 },
  noticeText: { color: Colors.textMuted, fontSize: 12, fontWeight: '600', lineHeight: 18 },
  serviceList: { gap: 12 },
  serviceRow: {
    minHeight: 102,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#101013',
    borderWidth: 1,
    borderColor: '#292930',
    borderRadius: 26,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 5,
  },
  serviceIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: '#F7F7F5',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  serviceIcon: { width: 48, height: 48 },
  serviceTextBlock: { flex: 1 },
  serviceTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  serviceTitle: { flex: 1, color: Colors.text, fontSize: 15, fontWeight: '900' },
  serviceStatus: {
    color: Colors.amber,
    fontSize: 10,
    fontWeight: '900',
    backgroundColor: 'rgba(255, 181, 71, 0.12)',
    borderRadius: Radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  serviceSubtitle: { color: Colors.textMuted, fontSize: 12, fontWeight: '600', marginTop: 4 },
  serviceSocialProof: {
    color: Colors.text,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 5,
    opacity: 0.84,
  },
  serviceMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  serviceCount: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '900',
    backgroundColor: 'rgba(184, 255, 61, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(184, 255, 61, 0.18)',
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    overflow: 'hidden',
  },
  serviceArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#101014',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 22,
    borderTopWidth: 1,
    borderColor: '#303038',
    maxHeight: height * 0.72,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#3A3A42',
    marginBottom: 16,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.lg, marginBottom: Spacing.xl },
  modalTitleWrap: { flex: 1 },
  modalTitle: { color: Colors.text, fontSize: 18, fontWeight: '900' },
  modalSubtitle: { color: Colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 6 },
  closeBtn: {
    backgroundColor: '#1B1B20',
    padding: Spacing.sm,
    borderRadius: Radius.pill,
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScrollBody: { paddingBottom: Spacing.xxl },
  subItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.lg,
    minHeight: 72,
    marginBottom: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#292930',
    borderRadius: 18,
    backgroundColor: '#151519',
  },
  subItemName: { color: Colors.text, fontSize: 15, fontWeight: '800' },
  subItemEstimate: { color: Colors.textMuted, fontSize: 12, marginTop: 3 },
  subItemProof: { color: Colors.primary, fontSize: 12, fontWeight: '800', marginTop: 5 },
  subItemFeePill: {
    minWidth: 84,
    minHeight: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.input,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  subItemPrice: { color: Colors.primary, fontSize: 15, fontWeight: '900' },
});
