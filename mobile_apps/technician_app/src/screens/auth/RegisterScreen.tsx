import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Check, ChevronDown, ChevronRight, Eye, EyeOff, Search, X } from 'lucide-react-native';
import apiService from '../../services/api.service';
import authService, { AuthSession } from '../../services/auth.service';
import { BRAND } from '../../config/brand';

const CameraIcon = Camera as any;
const CheckIcon = Check as any;
const ChevronDownIcon = ChevronDown as any;
const ChevronRightIcon = ChevronRight as any;
const EyeIcon = Eye as any;
const EyeOffIcon = EyeOff as any;
const SearchIcon = Search as any;
const XIcon = X as any;

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
};

const toDataUri = (asset: ImagePicker.ImagePickerAsset): string | null => {
  if (!asset.base64) return null;
  return `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`;
};

const PROVIDER_MODULE_SERVICES = new Set(['managed_collection', 'rental_property']);

type CategoryOption = {
  key: string;
  label: string;
  groupKey: string;
  groupLabel: string;
  services: Array<{
    key: string;
    label: string;
  }>;
};

const APPLICATION_STEPS = [
  { label: 'Profile', caption: 'Identity' },
  { label: 'Market', caption: 'Where you work' },
  { label: 'Services', caption: 'Skills' },
  { label: 'Experience', caption: 'Trust' },
  { label: 'Security', caption: 'Submit' },
];

interface RegisterScreenProps {
  onBackToLogin: () => void;
  onRegistrationApproved: (session: AuthSession) => void;
  onApplicationSubmitted: (details: { email: string; verificationEmailSent?: boolean }) => void;
}

export function RegisterScreen({
  onBackToLogin,
  onRegistrationApproved,
  onApplicationSubmitted,
}: RegisterScreenProps): React.JSX.Element {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    countryCode: 'ZA',
    city: '',
    password: '',
    confirmPassword: '',
    businessName: '',
    idNumber: '',
    vehicleType: '',
    yearsExperience: '0',
    serviceRadiusKm: '25',
    bio: '',
  });
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [categorySearch, setCategorySearch] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [activeMarketCodes, setActiveMarketCodes] = useState<string[]>([]);
  const [profilePhotoUri, setProfilePhotoUri] = useState('');
  const [profilePhotoDataUri, setProfilePhotoDataUri] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    apiService.getPublicMarkets()
      .then((result) => {
        if (!isCurrent) return;
        const marketCodes = (result.markets || []).map((market) => market.countryCode).filter(Boolean);
        setActiveMarketCodes(marketCodes);
        if (marketCodes.length && !marketCodes.includes(formData.countryCode.trim().toUpperCase())) {
          updateField('countryCode', marketCodes[0]);
        }
      })
      .catch(() => setActiveMarketCodes([]));
    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    const countryCode = formData.countryCode.trim().toUpperCase();
    if (!countryCode) {
      setCategoryOptions([]);
      setSelectedServices([]);
      return;
    }

    let isCurrent = true;
    apiService.getMarketAvailability({ countryCode, city: formData.city.trim() })
      .then((result) => {
        if (!isCurrent) return;
        const groupedCategories = (result.availability.groups || []).flatMap((group) =>
          (group.categories || []).map((category) => {
            const bookableServices = (category.services || category.bookableServices || [])
              .filter((service) => service.canBook !== false && !PROVIDER_MODULE_SERVICES.has(service.serviceKey));
            return {
              key: category.categoryKey || category.serviceKey || '',
              label: category.label,
              groupKey: group.groupKey,
              groupLabel: group.groupLabel || group.label,
              services: bookableServices
                .map((service) => ({
                  key: service.serviceKey,
                  label: service.label,
                }))
                .filter((service) => service.key && service.label),
            };
          })
        )
          .filter((category) => category.key && category.label && category.services.length > 0);

        const flatServices = result.availability.services
          .filter((service) => service.canBook && !PROVIDER_MODULE_SERVICES.has(service.serviceKey))
          .map((service) => ({
            key: service.serviceKey,
            label: service.label,
            groupKey: 'available_services',
            groupLabel: 'Available Services',
            services: [{
              key: service.serviceKey,
              label: service.label,
            }],
          }));
        const sourceOptions = groupedCategories.length ? groupedCategories : flatServices;
        const dedupedOptions = Array.from(
          new Map(sourceOptions.map((option) => [option.key, option])).values()
        );
        const nextOptions = dedupedOptions.sort((a, b) =>
          a.groupLabel.localeCompare(b.groupLabel) || a.label.localeCompare(b.label)
        );
        const allowedKeys = new Set(nextOptions.flatMap((category) => category.services.map((service) => service.key)));
        setCategoryOptions(nextOptions);
        setSelectedServices((current) => current.filter((serviceKey) => allowedKeys.has(serviceKey)));
        setExpandedGroups((current) => {
          const next = { ...current };
          nextOptions.forEach((option) => {
            if (typeof next[option.groupKey] !== 'boolean') {
              next[option.groupKey] = true;
            }
          });
          return next;
        });
      })
      .catch(() => {
        setCategoryOptions([]);
        setSelectedServices([]);
      });

    return () => {
      isCurrent = false;
    };
  }, [formData.countryCode, formData.city]);

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleService = (serviceKey: string) => {
    setSelectedServices((prev) =>
      prev.includes(serviceKey)
        ? prev.filter((item) => item !== serviceKey)
        : [...prev, serviceKey]
    );
  };

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups((current) => ({ ...current, [groupKey]: !current[groupKey] }));
  };

  const groupedCategoryOptions = useMemo(() => {
    const query = categorySearch.trim().toLowerCase();
    const filtered = categoryOptions.filter((category) => {
      if (!query) return true;
      return (
        category.label.toLowerCase().includes(query) ||
        category.groupLabel.toLowerCase().includes(query) ||
        category.services.some((service) => service.label.toLowerCase().includes(query))
      );
    });

    return filtered.reduce<Array<{ groupKey: string; groupLabel: string; categories: CategoryOption[] }>>((groups, category) => {
      const existing = groups.find((group) => group.groupKey === category.groupKey);
      if (existing) {
        existing.categories.push(category);
      } else {
        groups.push({ groupKey: category.groupKey, groupLabel: category.groupLabel, categories: [category] });
      }
      return groups;
    }, []);
  }, [categoryOptions, categorySearch]);

  const selectedServiceOptions = useMemo(
    () => selectedServices
      .map((serviceKey) => {
        for (const category of categoryOptions) {
          const service = category.services.find((item) => item.key === serviceKey);
          if (service) {
            return {
              ...service,
              categoryLabel: category.label,
              groupLabel: category.groupLabel,
            };
          }
        }
        return null;
      })
      .filter((service): service is { key: string; label: string; categoryLabel: string; groupLabel: string } => Boolean(service)),
    [categoryOptions, selectedServices]
  );

  const isFinalStep = currentStep === APPLICATION_STEPS.length - 1;

  const handleNextStep = () => {
    if (currentStep === 0 && (!formData.name.trim() || !formData.email.trim() || !formData.phone.trim() || !profilePhotoDataUri)) {
      Alert.alert('Profile Required', 'Add your name, email, phone, and a clear headshot before continuing.');
      return;
    }

    if (currentStep === 1) {
      const selectedCountry = formData.countryCode.trim().toUpperCase();
      if (!selectedCountry || !formData.city.trim()) {
        Alert.alert('Market Required', 'Add your country code and city before continuing.');
        return;
      }
      if (!activeMarketCodes.includes(selectedCountry)) {
        Alert.alert('Market Unavailable', 'Service provider registration is not available in this market right now.');
        return;
      }
    }

    if (currentStep === 2 && selectedServices.length === 0) {
      Alert.alert('Service Required', 'Select at least one specific service you can provide.');
      return;
    }

    if (currentStep === 4) {
      handleSubmit();
      return;
    }

    setCurrentStep((step) => Math.min(step + 1, APPLICATION_STEPS.length - 1));
  };

  const handlePreviousStep = () => {
    setCurrentStep((step) => Math.max(step - 1, 0));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.email.trim() || !formData.phone.trim() || !formData.city.trim()) {
      Alert.alert('Missing Fields', 'Please complete your name, email, phone, and city.');
      return;
    }

    if (selectedServices.length === 0) {
      Alert.alert('Service Required', 'Select at least one specific service you can provide.');
      return;
    }

    if (!activeMarketCodes.includes(formData.countryCode.trim().toUpperCase())) {
      Alert.alert('Market Unavailable', 'Service provider registration is not available in this market right now.');
      return;
    }

    if (!profilePhotoDataUri) {
      Alert.alert('Profile Photo Required', 'Please upload a clear headshot for admin review.');
      return;
    }

    if (formData.password.length < 6 || formData.password !== formData.confirmPassword) {
      Alert.alert('Password Error', 'Password must be at least 6 characters and match confirmation.');
      return;
    }

    try {
      setIsLoading(true);
      const response = await apiService.registerTechnician({
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        countryCode: formData.countryCode.trim().toUpperCase(),
        city: formData.city.trim(),
        password: formData.password,
        serviceCategories: selectedServices,
        yearsExperience: Number(formData.yearsExperience) || 0,
        businessName: formData.businessName.trim(),
        idNumber: formData.idNumber.trim(),
        vehicleType: formData.vehicleType.trim(),
        serviceRadiusKm: Number(formData.serviceRadiusKm) || 25,
        bio: formData.bio.trim(),
        profilePhotoDataUri,
      });

      if (response.token && response.user?.isEmailVerified) {
        const session = { token: response.token, user: response.user, technician: response.technician };
        authService.setSession(session);
        onRegistrationApproved(session);
        return;
      }

      onApplicationSubmitted({
        email: formData.email.trim(),
        verificationEmailSent: response.verificationEmailSent,
      });
    } catch (error: any) {
      Alert.alert('Registration Failed', error.message || 'Unable to submit application.');
    } finally {
      setIsLoading(false);
    }
  };

  const pickProfilePhoto = async (source: 'camera' | 'library') => {
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permission Required', 'Please allow photo access so you can upload your profile headshot.');
      return;
    }

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.75, base64: true, allowsEditing: true, aspect: [1, 1] })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.75, base64: true, allowsEditing: true, aspect: [1, 1] });

    if (result.canceled || !result.assets?.[0]) return;

    const dataUri = toDataUri(result.assets[0]);
    if (!dataUri) {
      Alert.alert('Image Error', 'Could not prepare this photo for upload. Please try another image.');
      return;
    }

    setProfilePhotoUri(result.assets[0].uri);
    setProfilePhotoDataUri(dataUri);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.heroPanel}>
            <View
              style={styles.titleWordmark}
              accessible
              accessibilityRole="text"
              accessibilityLabel={`Join ${BRAND.displayName}`}
            >
              <Text style={styles.title}>Join Pad</Text>
              <View style={styles.titleLetterI} accessible={false}>
                <View style={styles.titleDot} />
                <View style={styles.titleStem} />
              </View>
              <Text style={styles.title}> Pro</Text>
            </View>
            <Text style={styles.subtitle}>Apply once. Get reviewed. Go live when your profile and services are approved.</Text>
          </View>

          <View style={styles.stepper}>
            {APPLICATION_STEPS.map((step, index) => {
              const isActive = index === currentStep;
              const isComplete = index < currentStep;
              return (
                <TouchableOpacity
                  key={step.label}
                  style={[styles.stepItem, isActive && styles.stepItemActive]}
                  onPress={() => setCurrentStep(index)}
                  activeOpacity={0.84}
                  accessibilityRole="button"
                  accessibilityLabel={`${step.label} step`}
                >
                  <View style={[styles.stepDot, (isActive || isComplete) && styles.stepDotActive]}>
                    <Text style={[styles.stepDotText, (isActive || isComplete) && styles.stepDotTextActive]}>{index + 1}</Text>
                  </View>
                  <Text style={[styles.stepLabel, isActive && styles.stepLabelActive]}>{step.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.applicationCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardEyebrow}>Step {currentStep + 1} of {APPLICATION_STEPS.length}</Text>
              <Text style={styles.cardTitle}>{APPLICATION_STEPS[currentStep].label}</Text>
              <Text style={styles.cardSubtitle}>{APPLICATION_STEPS[currentStep].caption}</Text>
            </View>

            {currentStep === 0 && (
              <View style={styles.stepContent}>
                <Text style={styles.label}>Profile Photo</Text>
                <View style={styles.photoCard}>
                  <View style={styles.photoPreview}>
                    {profilePhotoUri ? (
                      <Image source={{ uri: profilePhotoUri }} style={styles.photoImage} />
                    ) : (
                      <CameraIcon color={Colors.textSubtle} size={32} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.photoTitle}>Clear headshot required</Text>
                    <Text style={styles.photoHelp}>Use a clear, professional headshot. Customers will see it after your profile is approved.</Text>
                    <View style={styles.photoActions}>
                      <TouchableOpacity style={styles.photoButton} onPress={() => pickProfilePhoto('camera')} disabled={isLoading}>
                        <Text style={styles.photoButtonText}>Camera</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.photoButton} onPress={() => pickProfilePhoto('library')} disabled={isLoading}>
                        <Text style={styles.photoButtonText}>Gallery</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                <Text style={styles.label}>Full Name</Text>
                <TextInput style={styles.input} value={formData.name} onChangeText={(value) => updateField('name', value)} placeholder="e.g. Thabo Mokoena" placeholderTextColor={Colors.textSubtle} />

                <Text style={styles.label}>Email</Text>
                <TextInput style={styles.input} value={formData.email} onChangeText={(value) => updateField('email', value)} keyboardType="email-address" autoCapitalize="none" placeholder="name@domain.com" placeholderTextColor={Colors.textSubtle} />

                <Text style={styles.label}>Mobile Number</Text>
                <TextInput style={styles.input} value={formData.phone} onChangeText={(value) => updateField('phone', value)} keyboardType="phone-pad" placeholder="+27 82 123 4567" placeholderTextColor={Colors.textSubtle} />
              </View>
            )}

            {currentStep === 1 && (
              <View style={styles.stepContent}>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Country Code</Text>
                    <TextInput style={styles.input} value={formData.countryCode} onChangeText={(value) => updateField('countryCode', value)} autoCapitalize="characters" placeholder="ZA" placeholderTextColor={Colors.textSubtle} />
                  </View>
                  <View style={{ flex: 2 }}>
                    <Text style={styles.label}>City</Text>
                    <TextInput style={styles.input} value={formData.city} onChangeText={(value) => updateField('city', value)} placeholder="Johannesburg" placeholderTextColor={Colors.textSubtle} />
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Radius KM</Text>
                    <TextInput style={styles.input} value={formData.serviceRadiusKm} onChangeText={(value) => updateField('serviceRadiusKm', value)} keyboardType="numeric" placeholder="25" placeholderTextColor={Colors.textSubtle} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Vehicle / Transport</Text>
                    <TextInput style={styles.input} value={formData.vehicleType} onChangeText={(value) => updateField('vehicleType', value)} placeholder="Bakkie, bike, car, none" placeholderTextColor={Colors.textSubtle} />
                  </View>
                </View>
              </View>
            )}

            {currentStep === 2 && (
              <View style={styles.stepContent}>
                <View style={styles.serviceSectionHeader}>
                  <View>
                    <Text style={styles.label}>Choose your services</Text>
                    <Text style={styles.sectionHelp}>Select the exact work you are qualified to provide. Broad categories are only used to organise the list.</Text>
                  </View>
                  <View style={styles.selectedCountPill}>
                    <Text style={styles.selectedCountText}>{selectedServices.length} selected</Text>
                  </View>
                </View>
                <View style={styles.searchShell}>
                  <SearchIcon color={Colors.textSubtle} size={18} />
                  <TextInput
                    style={styles.searchInput}
                    value={categorySearch}
                    onChangeText={setCategorySearch}
                    placeholder="Search bookable services"
                    placeholderTextColor={Colors.textSubtle}
                    editable={!isLoading}
                  />
                </View>
                {selectedServiceOptions.length > 0 && (
                  <View style={styles.selectedSummary}>
                    <Text style={styles.selectedSummaryTitle}>Selected work types</Text>
                    <View style={styles.selectedSkillList}>
                      {selectedServiceOptions.map((service) => (
                        <TouchableOpacity
                          key={service.key}
                          style={styles.selectedSkillPill}
                          onPress={() => toggleService(service.key)}
                          activeOpacity={0.82}
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${service.label}`}
                        >
                          <Text style={styles.selectedSkillText}>{service.label}</Text>
                          <XIcon color={Colors.background} size={12} strokeWidth={3} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
                <View style={styles.categoryPanel}>
                  {groupedCategoryOptions.map((group) => {
                    const selectedInGroup = group.categories.reduce(
                      (total, category) => total + category.services.filter((service) => selectedServices.includes(service.key)).length,
                      0
                    );
                    const isSearchActive = Boolean(categorySearch.trim());
                    const isExpanded = isSearchActive || expandedGroups[group.groupKey] === true;
                    return (
                      <View key={group.groupKey} style={styles.categoryGroup}>
                        <TouchableOpacity
                          style={styles.categoryGroupHeader}
                          onPress={() => toggleGroup(group.groupKey)}
                          activeOpacity={0.84}
                          accessibilityRole="button"
                          accessibilityLabel={`${isExpanded ? 'Collapse' : 'Expand'} ${group.groupLabel}`}
                        >
                          <View style={styles.categoryGroupTitleWrap}>
                            {isExpanded ? (
                              <ChevronDownIcon color={Colors.text} size={18} />
                            ) : (
                              <ChevronRightIcon color={Colors.textSubtle} size={18} />
                            )}
                            <Text style={styles.categoryGroupTitle}>{group.groupLabel}</Text>
                          </View>
                          <View style={[styles.groupCountPill, selectedInGroup > 0 && styles.groupCountPillActive]}>
                            <Text style={[styles.groupCountText, selectedInGroup > 0 && styles.groupCountTextActive]}>
                              {selectedInGroup} selected
                            </Text>
                          </View>
                        </TouchableOpacity>

                        {isExpanded && (
                          <View style={styles.categoryRows}>
                            {group.categories.map((category) => {
                              return (
                                <View
                                  key={category.key}
                                  style={styles.categoryBlock}
                                >
                                  <View style={styles.categoryRowCopy}>
                                    <Text style={styles.categoryText}>{category.label}</Text>
                                    <Text style={styles.categoryMeta}>Choose only the services you can confidently complete.</Text>
                                  </View>
                                  <View style={styles.bookableServiceList}>
                                    {category.services.map((service) => {
                                      const isSelected = selectedServices.includes(service.key);
                                      return (
                                        <TouchableOpacity
                                          key={service.key}
                                          style={[styles.bookableServiceRow, isSelected && styles.categoryRowActive]}
                                          onPress={() => toggleService(service.key)}
                                          activeOpacity={0.86}
                                          accessibilityRole="checkbox"
                                          accessibilityState={{ checked: isSelected }}
                                          accessibilityLabel={`${service.label}, ${category.label}`}
                                        >
                                          <Text style={[styles.bookableServiceText, isSelected && styles.categoryTextActive]}>
                                            {service.label}
                                          </Text>
                                          <View style={[styles.categoryCheck, isSelected && styles.categoryCheckActive]}>
                                            {isSelected && <CheckIcon color={Colors.background} size={14} strokeWidth={3} />}
                                          </View>
                                        </TouchableOpacity>
                                      );
                                    })}
                                  </View>
                                </View>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
                {!categoryOptions.length && (
                  <Text style={styles.helperText}>No active bookable services are available for this country or city yet.</Text>
                )}
                {Boolean(categoryOptions.length) && !groupedCategoryOptions.length && (
                  <Text style={styles.helperText}>No bookable services match your search.</Text>
                )}
              </View>
            )}

            {currentStep === 3 && (
              <View style={styles.stepContent}>
                <Text style={styles.label}>Years Exp.</Text>
                <TextInput style={styles.input} value={formData.yearsExperience} onChangeText={(value) => updateField('yearsExperience', value)} keyboardType="numeric" placeholder="3" placeholderTextColor={Colors.textSubtle} />

                <Text style={styles.label}>Business Name</Text>
                <TextInput style={styles.input} value={formData.businessName} onChangeText={(value) => updateField('businessName', value)} placeholder="Optional" placeholderTextColor={Colors.textSubtle} />

                <Text style={styles.label}>ID / Registration Number</Text>
                <TextInput style={styles.input} value={formData.idNumber} onChangeText={(value) => updateField('idNumber', value)} placeholder="Used for admin verification" placeholderTextColor={Colors.textSubtle} />

                <Text style={styles.label}>Short Bio</Text>
                <TextInput style={[styles.input, styles.textArea]} value={formData.bio} onChangeText={(value) => updateField('bio', value)} multiline placeholder="Tell us about your trade experience." placeholderTextColor={Colors.textSubtle} />
              </View>
            )}

            {currentStep === 4 && (
              <View style={styles.stepContent}>
                <View style={styles.reviewBox}>
                  <Text style={styles.reviewTitle}>Application summary</Text>
                  <Text style={styles.reviewText}>{formData.name.trim() || 'Your profile'} - {formData.city.trim() || 'City'} - {selectedServices.length} work {selectedServices.length === 1 ? 'type' : 'types'}</Text>
                </View>

                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordField}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    value={formData.password}
                    onChangeText={(value) => updateField('password', value)}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    placeholder="Minimum 6 characters"
                    placeholderTextColor={Colors.textSubtle}
                  />
                  <TouchableOpacity
                    style={styles.passwordToggle}
                    activeOpacity={0.75}
                    onPress={() => setShowPassword((value) => !value)}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOffIcon size={20} color={Colors.textMuted} strokeWidth={2.2} />
                    ) : (
                      <EyeIcon size={20} color={Colors.textMuted} strokeWidth={2.2} />
                    )}
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>Confirm Password</Text>
                <View style={styles.passwordField}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    value={formData.confirmPassword}
                    onChangeText={(value) => updateField('confirmPassword', value)}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    placeholder="Retype password"
                    placeholderTextColor={Colors.textSubtle}
                  />
                  <TouchableOpacity
                    style={styles.passwordToggle}
                    activeOpacity={0.75}
                    onPress={() => setShowConfirmPassword((value) => !value)}
                    accessibilityRole="button"
                    accessibilityLabel={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  >
                    {showConfirmPassword ? (
                      <EyeOffIcon size={20} color={Colors.textMuted} strokeWidth={2.2} />
                    ) : (
                      <EyeIcon size={20} color={Colors.textMuted} strokeWidth={2.2} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={styles.stepActions}>
              <TouchableOpacity style={styles.secondaryButton} onPress={handlePreviousStep} disabled={currentStep === 0 || isLoading}>
                <Text style={styles.secondaryButtonText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitButton} onPress={handleNextStep} disabled={isLoading}>
                {isLoading ? (
                  <ActivityIndicator color={Colors.background} />
                ) : (
                  <Text style={styles.submitText}>{isFinalStep ? 'Submit Application' : 'Continue'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.loginLink} onPress={onBackToLogin} disabled={isLoading}>
            <Text style={styles.loginText}>Already registered? Sign in</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContainer: { padding: 22, paddingBottom: 34, gap: 14 },
  heroPanel: {
    padding: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  titleWordmark: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  title: { color: Colors.text, fontSize: 26, fontWeight: '900' },
  titleLetterI: {
    width: 11,
    height: 25,
    marginLeft: 1,
    marginBottom: 6,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  titleDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: Colors.primary,
    marginBottom: 3,
  },
  titleStem: {
    width: 4,
    height: 12,
    borderRadius: 999,
    backgroundColor: Colors.text,
  },
  subtitle: { color: Colors.textSubtle, fontSize: 13, marginTop: 6, marginBottom: 24, lineHeight: 19 },
  stepper: {
    flexDirection: 'row',
    gap: 7,
  },
  stepItem: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  stepItemActive: {
    backgroundColor: '#B8FF3D12',
    borderColor: '#B8FF3D66',
  },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.input,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stepDotActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  stepDotText: { color: Colors.textMuted, fontSize: 11, fontWeight: '900' },
  stepDotTextActive: { color: Colors.background },
  stepLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: '900' },
  stepLabelActive: { color: Colors.primary },
  applicationCard: {
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  cardHeader: {
    marginBottom: 14,
  },
  cardEyebrow: {
    color: '#FFB547',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  cardTitle: { color: Colors.text, fontSize: 22, fontWeight: '900', marginTop: 4 },
  cardSubtitle: { color: Colors.textMuted, fontSize: 12, fontWeight: '700', marginTop: 4 },
  stepContent: {
    gap: 2,
  },
  label: { color: Colors.textMuted, fontSize: 11, fontWeight: '800', marginBottom: 8, marginTop: 10, textTransform: 'uppercase' },
  input: { backgroundColor: Colors.input, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, color: Colors.text, padding: 14, fontSize: 14 },
  passwordField: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 52,
  },
  passwordToggle: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  photoCard: { flexDirection: 'row', gap: 14, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 14, alignItems: 'center' },
  photoPreview: { width: 84, height: 84, borderRadius: 42, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoImage: { width: '100%', height: '100%' },
  photoTitle: { color: Colors.text, fontSize: 14, fontWeight: '800' },
  photoHelp: { color: Colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 4 },
  photoActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  photoButton: { backgroundColor: Colors.surfaceRaised, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  photoButtonText: { color: Colors.text, fontSize: 12, fontWeight: '800' },
  serviceSectionHeader: {
    marginTop: 10,
    marginBottom: 10,
    gap: 10,
  },
  sectionHelp: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: -2,
  },
  selectedCountPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFB54718',
    borderWidth: 1,
    borderColor: '#FFB54766',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  selectedCountText: { color: '#FFB547', fontSize: 12, fontWeight: '900' },
  searchShell: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.input,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
    paddingVertical: Platform.OS === 'ios' ? 12 : 9,
  },
  categoryPanel: {
    gap: 10,
    marginBottom: 4,
  },
  categoryGroup: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    backgroundColor: Colors.surface,
  },
  categoryGroupHeader: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  categoryGroupTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  categoryGroupTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  groupCountPill: {
    borderRadius: 999,
    backgroundColor: Colors.input,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  groupCountPillActive: {
    backgroundColor: '#B8FF3D18',
    borderColor: '#B8FF3D66',
  },
  groupCountText: { color: Colors.textMuted, fontSize: 11, fontWeight: '900' },
  groupCountTextActive: { color: Colors.primary },
  categoryRows: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  categoryBlock: {
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#24242A',
  },
  categoryRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#24242A',
  },
  categoryRowActive: {
    backgroundColor: '#B8FF3D12',
  },
  categoryRowCopy: {
    flex: 1,
  },
  bookableServiceList: {
    gap: 8,
  },
  bookableServiceRow: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.input,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bookableServiceText: {
    flex: 1,
    color: Colors.text,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
  selectedSummary: {
    borderRadius: 16,
    backgroundColor: '#B8FF3D10',
    borderWidth: 1,
    borderColor: '#B8FF3D3D',
    padding: 12,
    marginBottom: 12,
  },
  selectedSummaryTitle: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  selectedSkillList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  selectedSkillPill: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  selectedSkillText: {
    color: Colors.background,
    fontSize: 11,
    fontWeight: '900',
  },
  categoryCheck: {
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryCheckActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryText: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  categoryTextActive: { color: Colors.primary },
  categoryMeta: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
    marginTop: 3,
  },
  categoryPreview: {
    color: Colors.textSubtle,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
    marginTop: 3,
  },
  helperText: { color: Colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 8 },
  reviewBox: {
    gap: 4,
    padding: 13,
    borderRadius: 16,
    backgroundColor: '#B8FF3D10',
    borderWidth: 1,
    borderColor: '#B8FF3D3D',
    marginBottom: 8,
  },
  reviewTitle: { color: Colors.primary, fontSize: 13, fontWeight: '900' },
  reviewText: { color: Colors.textMuted, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  stepActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  secondaryButton: {
    flex: 1,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.input,
  },
  secondaryButtonText: { color: Colors.text, fontSize: 14, fontWeight: '900' },
  submitButton: { flex: 1.35, backgroundColor: Colors.primary, borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: Colors.background, fontSize: 15, fontWeight: '900' },
  loginLink: { alignItems: 'center', paddingVertical: 18 },
  loginText: { color: Colors.textMuted, fontSize: 13, fontWeight: '700' },
});
