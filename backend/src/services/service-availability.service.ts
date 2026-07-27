import mongoose from 'mongoose';
import { CountryCode, MARKET_CONFIG, normalizeCountryCode } from '../config/market.config';
import Booking, { BookingStatus } from '../models/booking.model';
import BookingReview, { BookingReviewStatus } from '../models/booking-review.model';
import MarketSetting, { MarketStatus } from '../models/market-setting.model';
import ServiceCatalog, {
  ServiceBillingModel,
  ServicePublicationStatus,
  ServiceSubscriptionCadence,
} from '../models/service-catalog.model';

export interface ServiceDefinition {
  serviceKey: string;
  categoryKey?: string;
  groupKey?: string;
  groupLabel?: string;
  groupDescription?: string;
  groupImageKey?: string;
  groupImageUrl?: string;
  groupIconKey?: string;
  groupStatus?: string;
  groupDisplayOrder?: number;
  label: string;
  status: MarketStatus;
  description?: string;
  imageKey?: string;
  imageUrl?: string;
  iconKey?: string;
  searchKeywords?: string[];
  synonyms?: string[];
  calloutFeeMinor?: number;
  calloutFeeEnabled?: boolean;
  minimumChargeMinor?: number;
  fixedPriceSupported?: boolean;
  requiresCapabilityApproval?: boolean;
  capabilityRequirements?: Record<string, unknown>;
  displayOrder?: number;
  subcategories?: Array<{
    subcategoryKey: string;
    serviceKey?: string;
    label: string;
    description?: string;
    status: MarketStatus;
    publicationStatus?: string;
    displayOrder?: number;
    imageKey?: string;
    imageUrl?: string;
    searchKeywords?: string[];
    synonyms?: string[];
    estimatedDurationMinutes?: number;
    inspectionRequired?: boolean;
    fixedPriceSupported?: boolean;
    requiresCapabilityApproval?: boolean;
    capabilityRequirements?: Record<string, unknown>;
    calloutFeeMinor?: number;
    calloutFeeEnabled?: boolean;
    minimumChargeMinor?: number;
    billingModel?: ServiceBillingModel;
    subscriptionEligible?: boolean;
    subscriptionCadences?: ServiceSubscriptionCadence[];
    subscriptionNotes?: string;
    pricingSource?: string;
    socialProof?: ServiceSocialProof;
  }>;
  pricingSource?: string;
  socialProof?: ServiceSocialProof;
}

export interface AreaAvailability {
  name: string;
  status: MarketStatus;
  services: ServiceDefinition[];
}

export interface CityAvailability {
  city: string;
  status: MarketStatus;
  services: ServiceDefinition[];
  areas: AreaAvailability[];
}

export interface AvailabilityResult {
  countryCode: string;
  countryName: string;
  currency: string;
  city: string;
  area: string;
  market: {
    countryCode: string;
    countryName: string;
    currency: string;
    city: string;
    area: string;
  };
  groups: ServiceGroupAvailability[];
  services: Array<ServiceDefinition & {
    canBook: boolean;
    message: string;
    calloutFeeMinor?: number;
    pricingSource?: string;
  }>;
}

export interface ServiceSocialProof {
  averageRating: number | null;
  reviewCount: number;
  completedJobs: number;
  city?: string;
  countryCode?: string;
}

export interface BookableServiceAvailability {
  serviceKey: string;
  legacySubcategoryKey?: string;
  categoryKey: string;
  groupKey: string;
  label: string;
  description?: string;
  imageKey?: string;
  imageUrl?: string;
  status: MarketStatus;
  canBook: boolean;
  message: string;
  calloutFeeMinor?: number;
  calloutFeeEnabled?: boolean;
  minimumChargeMinor?: number;
  billingModel?: ServiceBillingModel;
  subscriptionEligible?: boolean;
  subscriptionCadences?: ServiceSubscriptionCadence[];
  subscriptionNotes?: string;
  estimatedDurationMinutes?: number;
  inspectionRequired?: boolean;
  fixedPriceSupported?: boolean;
  requiresCapabilityApproval?: boolean;
  capabilityRequirements?: Record<string, unknown>;
  searchKeywords?: string[];
  synonyms?: string[];
  displayOrder?: number;
  pricingSource?: string;
  socialProof?: ServiceSocialProof;
}

export interface ServiceCategoryAvailability {
  categoryKey: string;
  legacyServiceKey: string;
  groupKey: string;
  label: string;
  description?: string;
  imageKey?: string;
  imageUrl?: string;
  iconKey?: string;
  status: MarketStatus;
  displayOrder?: number;
  searchKeywords?: string[];
  synonyms?: string[];
  services: BookableServiceAvailability[];
  socialProof?: ServiceSocialProof;
}

export interface ServiceGroupAvailability {
  groupKey: string;
  label: string;
  description?: string;
  imageKey?: string;
  imageUrl?: string;
  iconKey?: string;
  status: string;
  displayOrder?: number;
  categories: ServiceCategoryAvailability[];
  socialProof?: ServiceSocialProof;
}

export const DEFAULT_SERVICE_DEFINITIONS: ServiceDefinition[] = [
  { serviceKey: 'appliance_repair', categoryKey: 'appliance_repair', groupKey: 'home_services', groupLabel: 'Home Services', label: 'Appliance Repair', status: MarketStatus.ACTIVE, displayOrder: 10 },
  { serviceKey: 'cleaning', categoryKey: 'cleaning', groupKey: 'home_services', groupLabel: 'Home Services', label: 'Cleaning Service', status: MarketStatus.ACTIVE, displayOrder: 20 },
  { serviceKey: 'electrical', categoryKey: 'electrical', groupKey: 'home_services', groupLabel: 'Home Services', label: 'Electrical Repair', status: MarketStatus.ACTIVE, displayOrder: 30 },
  { serviceKey: 'gardening', categoryKey: 'gardening', groupKey: 'home_services', groupLabel: 'Home Services', label: 'Gardening Service', status: MarketStatus.ACTIVE, displayOrder: 40 },
  { serviceKey: 'maintenance', categoryKey: 'maintenance', groupKey: 'home_services', groupLabel: 'Home Services', label: 'Maintenance Service', status: MarketStatus.ACTIVE, displayOrder: 50 },
  { serviceKey: 'painting', categoryKey: 'painting', groupKey: 'home_services', groupLabel: 'Home Services', label: 'Painting Service', status: MarketStatus.ACTIVE, displayOrder: 60 },
  { serviceKey: 'plumbing', categoryKey: 'plumbing', groupKey: 'home_services', groupLabel: 'Home Services', label: 'Plumbing', status: MarketStatus.ACTIVE, displayOrder: 70 },
  { serviceKey: 'automotive', label: 'Automotive', status: MarketStatus.ACTIVE },
  { serviceKey: 'managed_collection', label: 'Managed Collection Services', status: MarketStatus.DISABLED },
  { serviceKey: 'rental_property', label: 'Rental Property Listings', status: MarketStatus.DISABLED },
];

const PUBLIC_SERVICE_FIELDS = 'serviceKey categoryKey groupKey groupLabel groupDescription groupImageKey groupImageUrl groupIconKey groupStatus groupDisplayOrder label description imageKey imageUrl iconKey searchKeywords synonyms status displayOrder defaultCalloutFeeMinor minimumChargeMinor fixedPriceSupported requiresCapabilityApproval capabilityRequirements subcategories';

const isCalloutFeeEnabled = (explicit: unknown, feeMinor: unknown, fallbackFeeMinor?: unknown): boolean => {
  if (typeof explicit === 'boolean') return explicit;
  if (typeof feeMinor === 'number') return feeMinor > 0;
  return typeof fallbackFeeMinor === 'number' && fallbackFeeMinor > 0;
};

const publishedCatalogue = async (): Promise<Map<string, ServiceDefinition>> => {
  const services = await ServiceCatalog.find({ status: ServicePublicationStatus.PUBLISHED })
    .select(PUBLIC_SERVICE_FIELDS)
    .lean();

  return new Map(
    services.map((service) => [
      service.serviceKey,
      {
        serviceKey: service.serviceKey,
        categoryKey: service.categoryKey || service.serviceKey,
        groupKey: service.groupKey || groupKeyForService(service.serviceKey),
        groupLabel: service.groupLabel || groupLabelForKey(service.groupKey || groupKeyForService(service.serviceKey)),
        groupDescription: service.groupDescription,
        groupImageKey: service.groupImageKey,
        groupImageUrl: service.groupImageUrl,
        groupIconKey: service.groupIconKey,
        groupStatus: service.groupStatus,
        groupDisplayOrder: service.groupDisplayOrder,
        label: service.label,
        description: service.description,
        imageKey: service.imageKey,
        imageUrl: service.imageUrl,
        iconKey: service.iconKey,
        searchKeywords: service.searchKeywords,
        synonyms: service.synonyms,
        status: MarketStatus.ACTIVE,
        displayOrder: service.displayOrder,
        calloutFeeMinor: service.defaultCalloutFeeMinor,
        minimumChargeMinor: service.minimumChargeMinor,
        fixedPriceSupported: service.fixedPriceSupported,
        requiresCapabilityApproval: service.requiresCapabilityApproval,
        capabilityRequirements: service.capabilityRequirements,
        subcategories: (service.subcategories || [])
          .filter((subcategory) =>
            subcategory.status !== MarketStatus.ARCHIVED &&
            subcategory.status !== MarketStatus.DISABLED &&
            (!subcategory.publicationStatus || subcategory.publicationStatus === ServicePublicationStatus.PUBLISHED)
          )
          .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
          .map((subcategory) => ({
            subcategoryKey: subcategory.subcategoryKey,
            serviceKey: subcategory.serviceKey || subcategory.subcategoryKey,
            label: subcategory.label,
            description: subcategory.description,
            status: subcategory.status,
            publicationStatus: subcategory.publicationStatus,
            imageKey: subcategory.imageKey,
            imageUrl: subcategory.imageUrl,
            searchKeywords: subcategory.searchKeywords,
            synonyms: subcategory.synonyms,
            displayOrder: subcategory.displayOrder,
            estimatedDurationMinutes: subcategory.estimatedDurationMinutes,
            inspectionRequired: subcategory.inspectionRequired,
            fixedPriceSupported: subcategory.fixedPriceSupported,
            requiresCapabilityApproval: subcategory.requiresCapabilityApproval,
            capabilityRequirements: subcategory.capabilityRequirements,
            billingModel: subcategory.billingModel || ServiceBillingModel.ON_DEMAND,
            subscriptionEligible: subcategory.subscriptionEligible === true,
            subscriptionCadences: subcategory.subscriptionCadences || [],
            subscriptionNotes: subcategory.subscriptionNotes || '',
            calloutFeeEnabled: isCalloutFeeEnabled(subcategory.calloutFeeEnabled, subcategory.calloutFeeMinor, service.defaultCalloutFeeMinor),
            calloutFeeMinor: isCalloutFeeEnabled(subcategory.calloutFeeEnabled, subcategory.calloutFeeMinor, service.defaultCalloutFeeMinor)
              ? (subcategory.calloutFeeMinor ?? service.defaultCalloutFeeMinor ?? 0)
              : 0,
            minimumChargeMinor: subcategory.minimumChargeMinor,
          })),
      },
    ])
  );
};

const SERVICE_ALIASES: Record<string, string> = {
  appliances: 'appliance_repair',
  appliance: 'appliance_repair',
  'appliance repair': 'appliance_repair',
  mechanic: 'automotive',
  automotive: 'automotive',
  painter: 'painting',
  painting: 'painting',
  'painting service': 'painting',
  plumber: 'plumbing',
  plumbing: 'plumbing',
  electrician: 'electrical',
  electrical: 'electrical',
  'electrical repair': 'electrical',
  cleaning: 'cleaning',
  'cleaning service': 'cleaning',
  gardening: 'gardening',
  'gardening service': 'gardening',
  maintenance: 'maintenance',
  'maintenance service': 'maintenance',
  garbage_collection: 'managed_collection',
  'garbage collection': 'managed_collection',
  'managed collection': 'managed_collection',
  'managed collection services': 'managed_collection',
  rental: 'rental_property',
  rentals: 'rental_property',
  'rental property': 'rental_property',
  'rental property listings': 'rental_property',
  'property listing': 'rental_property',
  'property listings': 'rental_property',
  'property rental': 'rental_property',
  'rental listing': 'rental_property',
  'rental listings': 'rental_property',
  landlord: 'rental_property',
  landlords: 'rental_property',
  'long term rental': 'rental_property',
  'long term rentals': 'rental_property',
};

const groupKeyForService = (serviceKey: string): string => {
  if (serviceKey === 'automotive') return 'auto_services';
  if (serviceKey === 'rental_property') return 'rental_services';
  if (serviceKey === 'managed_collection') return 'property_services';
  return 'home_services';
};

const groupLabelForKey = (groupKey: string): string => {
  const labels: Record<string, string> = {
    home_services: 'Home Services',
    auto_services: 'Auto Services',
    business_services: 'Business Services',
    rental_services: 'Rental Services',
    property_services: 'Property Services',
  };
  return labels[groupKey] ?? labelFromServiceKey(groupKey);
};

const statusPriority: Record<MarketStatus, number> = {
  [MarketStatus.DRAFT]: 0,
  [MarketStatus.ACTIVE]: 4,
  [MarketStatus.COMING_SOON]: 3,
  [MarketStatus.PAUSED]: 2,
  [MarketStatus.DISABLED]: 1,
  [MarketStatus.ARCHIVED]: 0,
};

export const normalizeText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

export const normalizeServiceKey = (value: unknown): string => {
  const raw = normalizeText(value).toLowerCase();
  if (!raw) return '';
  return SERVICE_ALIASES[raw] ?? raw.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
};

export const labelFromServiceKey = (serviceKey: string): string =>
  DEFAULT_SERVICE_DEFINITIONS.find((item) => item.serviceKey === serviceKey)?.label ??
  serviceKey
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const enrichServiceEntries = (
  entries: ServiceDefinition[],
  catalogue: Map<string, ServiceDefinition>
): ServiceDefinition[] => {
  const enriched: ServiceDefinition[] = [];
  entries.forEach((entry) => {
      const catalogued = catalogue.get(entry.serviceKey);
      if (!catalogued) return;
      enriched.push({
        ...catalogued,
        ...entry,
        categoryKey: entry.categoryKey || catalogued.categoryKey || entry.serviceKey,
        groupKey: entry.groupKey || catalogued.groupKey || groupKeyForService(entry.serviceKey),
        groupLabel: entry.groupLabel || catalogued.groupLabel || groupLabelForKey(entry.groupKey || catalogued.groupKey || groupKeyForService(entry.serviceKey)),
        groupDescription: entry.groupDescription || catalogued.groupDescription,
        groupImageKey: entry.groupImageKey || catalogued.groupImageKey,
        groupImageUrl: entry.groupImageUrl || catalogued.groupImageUrl,
        groupIconKey: entry.groupIconKey || catalogued.groupIconKey,
        groupStatus: entry.groupStatus || catalogued.groupStatus,
        groupDisplayOrder: entry.groupDisplayOrder ?? catalogued.groupDisplayOrder,
        label: entry.label || catalogued.label,
        description: entry.description || catalogued.description,
        imageKey: entry.imageKey || catalogued.imageKey,
        imageUrl: entry.imageUrl || catalogued.imageUrl,
        iconKey: entry.iconKey || catalogued.iconKey,
        searchKeywords: entry.searchKeywords?.length ? entry.searchKeywords : catalogued.searchKeywords,
        synonyms: entry.synonyms?.length ? entry.synonyms : catalogued.synonyms,
        calloutFeeMinor: entry.calloutFeeMinor ?? catalogued.calloutFeeMinor,
        minimumChargeMinor: entry.minimumChargeMinor ?? catalogued.minimumChargeMinor,
        fixedPriceSupported: entry.fixedPriceSupported ?? catalogued.fixedPriceSupported,
        requiresCapabilityApproval: entry.requiresCapabilityApproval ?? catalogued.requiresCapabilityApproval,
        capabilityRequirements: entry.capabilityRequirements ?? catalogued.capabilityRequirements,
        displayOrder: entry.displayOrder ?? catalogued.displayOrder,
        subcategories: mergeSubcategories(catalogued.subcategories || [], entry.subcategories || []),
      });
    });
  return enriched;
};

const publicCatalogueDefaults = (catalogue: Map<string, ServiceDefinition>): ServiceDefinition[] =>
  Array.from(catalogue.values()).filter((service) =>
    (service.subcategories || []).length > 0 || service.calloutFeeEnabled === true || typeof service.calloutFeeMinor === 'number'
  );

export const isMarketStatus = (value: unknown): value is MarketStatus =>
  typeof value === 'string' && Object.values(MarketStatus).includes(value as MarketStatus);

const isServiceBillingModel = (value: unknown): value is ServiceBillingModel =>
  typeof value === 'string' && Object.values(ServiceBillingModel).includes(value as ServiceBillingModel);

const normalizeSubscriptionCadences = (value: unknown): ServiceSubscriptionCadence[] =>
  (Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [])
    .map((item) => String(item || '').trim().toUpperCase())
    .filter((item): item is ServiceSubscriptionCadence =>
      Object.values(ServiceSubscriptionCadence).includes(item as ServiceSubscriptionCadence)
    )
    .filter((item, index, values) => values.indexOf(item) === index);

export const normalizeServiceEntry = (entry: unknown): ServiceDefinition | null => {
  if (typeof entry === 'string') {
    const serviceKey = normalizeServiceKey(entry);
    if (!serviceKey) return null;
    return { serviceKey, label: labelFromServiceKey(serviceKey), status: MarketStatus.ACTIVE };
  }

  if (!entry || typeof entry !== 'object') return null;
  const record = entry as Record<string, unknown>;
  const serviceKey = normalizeServiceKey(record.serviceKey ?? record.key ?? record.value ?? record.label);
  if (!serviceKey) return null;

  const recordCalloutFeeMinor = typeof record.calloutFeeMinor === 'number'
    ? record.calloutFeeMinor
    : typeof record.calloutFee === 'number'
      ? Math.round(record.calloutFee * 100)
      : undefined;

  return {
    serviceKey,
    label: normalizeText(record.label) || labelFromServiceKey(serviceKey),
    status: isMarketStatus(record.status) ? record.status : MarketStatus.ACTIVE,
    calloutFeeEnabled: isCalloutFeeEnabled(record.calloutFeeEnabled, recordCalloutFeeMinor),
    calloutFeeMinor: isCalloutFeeEnabled(record.calloutFeeEnabled, recordCalloutFeeMinor) ? (recordCalloutFeeMinor ?? 0) : 0,
    imageKey: normalizeText(record.imageKey),
    imageUrl: normalizeText(record.imageUrl),
    description: normalizeText(record.description),
    minimumChargeMinor: typeof record.minimumChargeMinor === 'number' ? record.minimumChargeMinor : undefined,
    fixedPriceSupported: record.fixedPriceSupported === true,
    displayOrder: Number.isFinite(Number(record.displayOrder)) ? Number(record.displayOrder) : undefined,
    subcategories: Array.isArray(record.subcategories)
      ? record.subcategories
          .map((subcategory): NonNullable<ServiceDefinition['subcategories']>[number] | null => {
            if (!subcategory || typeof subcategory !== 'object') return null;
            const subRecord = subcategory as Record<string, unknown>;
            const subcategoryKey = normalizeServiceKey(subRecord.subcategoryKey ?? subRecord.key ?? subRecord.label);
            const serviceKey = normalizeServiceKey(subRecord.serviceKey ?? subRecord.subcategoryKey ?? subRecord.key ?? subRecord.label);
            const label = normalizeText(subRecord.label);
            if (!subcategoryKey) return null;
            const subRecordCalloutFeeMinor = typeof subRecord.calloutFeeMinor === 'number'
              ? subRecord.calloutFeeMinor
              : typeof subRecord.calloutFee === 'number'
                ? Math.round(subRecord.calloutFee * 100)
                : undefined;
            return {
              subcategoryKey,
              serviceKey,
              label: label || labelFromServiceKey(subcategoryKey),
              description: normalizeText(subRecord.description),
              status: isMarketStatus(subRecord.status) ? subRecord.status : MarketStatus.ACTIVE,
              publicationStatus: normalizeText(subRecord.publicationStatus),
              imageKey: normalizeText(subRecord.imageKey),
              imageUrl: normalizeText(subRecord.imageUrl),
              estimatedDurationMinutes: Number.isFinite(Number(subRecord.estimatedDurationMinutes)) ? Number(subRecord.estimatedDurationMinutes) : undefined,
              inspectionRequired: subRecord.inspectionRequired === true,
              fixedPriceSupported: subRecord.fixedPriceSupported === true,
              billingModel: isServiceBillingModel(subRecord.billingModel) ? subRecord.billingModel : ServiceBillingModel.ON_DEMAND,
              subscriptionEligible: subRecord.subscriptionEligible === true,
              subscriptionCadences: normalizeSubscriptionCadences(subRecord.subscriptionCadences),
              subscriptionNotes: normalizeText(subRecord.subscriptionNotes).slice(0, 800),
              calloutFeeEnabled: isCalloutFeeEnabled(subRecord.calloutFeeEnabled, subRecordCalloutFeeMinor),
              calloutFeeMinor: isCalloutFeeEnabled(subRecord.calloutFeeEnabled, subRecordCalloutFeeMinor) ? (subRecordCalloutFeeMinor ?? 0) : 0,
              minimumChargeMinor: typeof subRecord.minimumChargeMinor === 'number'
                ? subRecord.minimumChargeMinor
                : typeof subRecord.minimumCharge === 'number'
                  ? Math.round(subRecord.minimumCharge * 100)
                  : undefined,
            };
          })
          .filter((subcategory): subcategory is NonNullable<ServiceDefinition['subcategories']>[number] => Boolean(subcategory))
      : undefined,
  };
};

export const normalizeServiceEntries = (entries: unknown, fallbackServices: unknown[] = []): ServiceDefinition[] => {
  const source = Array.isArray(entries) && entries.length ? entries : fallbackServices;
  const map = new Map<string, ServiceDefinition>();

  source.forEach((entry) => {
    const normalized = normalizeServiceEntry(entry);
    if (!normalized) return;

    const existing = map.get(normalized.serviceKey);
    if (!existing || statusPriority[normalized.status] > statusPriority[existing.status]) {
      map.set(normalized.serviceKey, normalized);
    }
  });

  return Array.from(map.values());
};

const buildServiceGroups = (
  services: AvailabilityResult['services']
): ServiceGroupAvailability[] => {
  const groups = new Map<string, ServiceGroupAvailability>();

  services.forEach((service) => {
    const groupKey = service.groupKey || groupKeyForService(service.serviceKey);
    const categoryKey = service.categoryKey || service.serviceKey;
    const groupStatus = service.groupStatus || ServicePublicationStatus.PUBLISHED;
    const group = groups.get(groupKey) ?? {
      groupKey,
      label: service.groupLabel || groupLabelForKey(groupKey),
      description: service.groupDescription || '',
      imageKey: service.groupImageKey || '',
      imageUrl: service.groupImageUrl || '',
      iconKey: service.groupIconKey || '',
      status: groupStatus,
      displayOrder: service.groupDisplayOrder ?? 0,
      categories: [],
    };

    const bookableServices: BookableServiceAvailability[] = (service.subcategories?.length
      ? service.subcategories.map((subcategory) => ({
          serviceKey: subcategory.serviceKey || subcategory.subcategoryKey,
          legacySubcategoryKey: subcategory.subcategoryKey,
          categoryKey,
          groupKey,
          label: subcategory.label,
          description: subcategory.description || '',
          imageKey: subcategory.imageKey || service.imageKey,
          imageUrl: subcategory.imageUrl || service.imageUrl,
          status: subcategory.status,
          canBook: service.canBook && subcategory.status === MarketStatus.ACTIVE,
          message: subcategory.status === MarketStatus.ACTIVE ? service.message : statusMessage(subcategory.label, subcategory.status),
          calloutFeeEnabled: subcategory.calloutFeeEnabled === true,
          calloutFeeMinor: subcategory.calloutFeeMinor ?? 0,
          minimumChargeMinor: subcategory.minimumChargeMinor ?? service.minimumChargeMinor,
          estimatedDurationMinutes: subcategory.estimatedDurationMinutes,
          inspectionRequired: subcategory.inspectionRequired,
          fixedPriceSupported: subcategory.fixedPriceSupported ?? service.fixedPriceSupported,
          requiresCapabilityApproval: subcategory.requiresCapabilityApproval ?? service.requiresCapabilityApproval,
          capabilityRequirements: subcategory.capabilityRequirements ?? service.capabilityRequirements,
          billingModel: subcategory.billingModel || ServiceBillingModel.ON_DEMAND,
          subscriptionEligible: subcategory.subscriptionEligible === true,
          subscriptionCadences: subcategory.subscriptionCadences || [],
          subscriptionNotes: subcategory.subscriptionNotes || '',
          searchKeywords: subcategory.searchKeywords || [],
          synonyms: subcategory.synonyms || [],
          displayOrder: subcategory.displayOrder,
          pricingSource: subcategory.pricingSource,
          socialProof: subcategory.socialProof,
        }))
      : [{
          serviceKey: service.serviceKey,
          categoryKey,
          groupKey,
          label: service.label,
          description: service.description || '',
          imageKey: service.imageKey,
          imageUrl: service.imageUrl,
          status: service.status,
          canBook: service.canBook,
          message: service.message,
          calloutFeeEnabled: service.calloutFeeEnabled === true,
          calloutFeeMinor: service.calloutFeeMinor ?? 0,
          minimumChargeMinor: service.minimumChargeMinor,
          fixedPriceSupported: service.fixedPriceSupported,
          requiresCapabilityApproval: service.requiresCapabilityApproval,
          capabilityRequirements: service.capabilityRequirements,
          searchKeywords: service.searchKeywords || [],
          synonyms: service.synonyms || [],
          displayOrder: service.displayOrder,
          pricingSource: service.pricingSource,
          socialProof: service.socialProof,
        }]).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    group.categories.push({
      categoryKey,
      legacyServiceKey: service.serviceKey,
      groupKey,
      label: service.label,
      description: service.description || '',
      imageKey: service.imageKey,
      imageUrl: service.imageUrl,
      iconKey: service.iconKey,
      status: service.status,
      displayOrder: service.displayOrder,
      searchKeywords: service.searchKeywords || [],
      synonyms: service.synonyms || [],
      services: bookableServices,
    });

    groups.set(groupKey, group);
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      categories: group.categories.sort((a, b) => a.label.localeCompare(b.label)),
    }))
    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
};

const emptySocialProof = (countryCode: string, city: string): ServiceSocialProof => ({
  averageRating: null,
  reviewCount: 0,
  completedJobs: 0,
  countryCode,
  city,
});

const socialProofKey = (serviceKey: string, countryCode: string, city: string): string =>
  `${normalizeServiceKey(serviceKey)}|${String(countryCode || '').trim().toUpperCase()}|${String(city || '').trim().toLowerCase()}`;

const loadServiceSocialProof = async (
  serviceKeys: string[],
  countryCode: string,
  city: string
): Promise<Map<string, ServiceSocialProof>> => {
  const normalizedKeys = Array.from(new Set(serviceKeys.map(normalizeServiceKey).filter(Boolean)));
  const normalizedCountry = String(countryCode || '').trim().toUpperCase();
  const normalizedCity = String(city || '').trim();
  const proof = new Map<string, ServiceSocialProof>();

  if (!normalizedKeys.length || !normalizedCountry || !normalizedCity) return proof;
  if (mongoose.connection.readyState !== 1) {
    normalizedKeys.forEach((serviceKey) => {
      proof.set(socialProofKey(serviceKey, normalizedCountry, normalizedCity), emptySocialProof(normalizedCountry, normalizedCity));
    });
    return proof;
  }

  const [reviewRows, completedRows] = await Promise.all([
    BookingReview.aggregate([
      {
        $match: {
          serviceKey: { $in: normalizedKeys },
          countryCode: normalizedCountry,
          city: normalizedCity,
          status: BookingReviewStatus.PUBLISHED,
        },
      },
      {
        $group: {
          _id: '$serviceKey',
          averageRating: { $avg: '$rating' },
          reviewCount: { $sum: 1 },
        },
      },
    ]),
    Booking.aggregate([
      {
        $match: {
          serviceKey: { $in: normalizedKeys },
          countryCode: normalizedCountry,
          city: normalizedCity,
          status: BookingStatus.COMPLETED,
        },
      },
      {
        $group: {
          _id: '$serviceKey',
          completedJobs: { $sum: 1 },
        },
      },
    ]),
  ]);

  normalizedKeys.forEach((serviceKey) => {
    proof.set(socialProofKey(serviceKey, normalizedCountry, normalizedCity), emptySocialProof(normalizedCountry, normalizedCity));
  });

  reviewRows.forEach((row) => {
    const key = socialProofKey(row._id, normalizedCountry, normalizedCity);
    const current = proof.get(key) || emptySocialProof(normalizedCountry, normalizedCity);
    proof.set(key, {
      ...current,
      averageRating: row.averageRating ? Number(Number(row.averageRating).toFixed(2)) : null,
      reviewCount: Number(row.reviewCount || 0),
    });
  });

  completedRows.forEach((row) => {
    const key = socialProofKey(row._id, normalizedCountry, normalizedCity);
    const current = proof.get(key) || emptySocialProof(normalizedCountry, normalizedCity);
    proof.set(key, {
      ...current,
      completedJobs: Number(row.completedJobs || 0),
    });
  });

  return proof;
};

const proofForService = (
  proof: Map<string, ServiceSocialProof>,
  serviceKey: string,
  countryCode: string,
  city: string
): ServiceSocialProof => proof.get(socialProofKey(serviceKey, countryCode, city)) || emptySocialProof(countryCode, city);

const combineSocialProof = (
  proofs: ServiceSocialProof[],
  countryCode: string,
  city: string
): ServiceSocialProof => {
  const reviewCount = proofs.reduce((sum, proof) => sum + Number(proof.reviewCount || 0), 0);
  const completedJobs = proofs.reduce((sum, proof) => sum + Number(proof.completedJobs || 0), 0);
  const weightedRatingTotal = proofs.reduce(
    (sum, proof) => sum + (Number(proof.averageRating || 0) * Number(proof.reviewCount || 0)),
    0
  );

  return {
    averageRating: reviewCount > 0 ? Number((weightedRatingTotal / reviewCount).toFixed(2)) : null,
    reviewCount,
    completedJobs,
    countryCode,
    city,
  };
};

const attachGroupSocialProof = (
  groups: ServiceGroupAvailability[],
  countryCode: string,
  city: string
): ServiceGroupAvailability[] =>
  groups.map((group) => {
    const categories = group.categories.map((category) => ({
      ...category,
      socialProof: combineSocialProof(
        category.services.map((service) => service.socialProof || emptySocialProof(countryCode, city)),
        countryCode,
        city
      ),
    }));

    return {
      ...group,
      categories,
      socialProof: combineSocialProof(
        categories.map((category) => category.socialProof || emptySocialProof(countryCode, city)),
        countryCode,
        city
      ),
    };
  });

export const normalizeAreaEntries = (entries: unknown): AreaAvailability[] => {
  if (!Array.isArray(entries)) return [];

  return entries
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const record = entry as Record<string, unknown>;
      const name = normalizeText(record.name ?? record.area);
      if (!name) return null;

      return {
        name,
        status: isMarketStatus(record.status) ? record.status : MarketStatus.ACTIVE,
        services: normalizeServiceEntries(record.services),
      };
    })
    .filter((entry): entry is AreaAvailability => Boolean(entry));
};

export const buildCityAvailability = (row: unknown, fallbackServices: unknown[] = []): CityAvailability | null => {
  if (!row || typeof row !== 'object') return null;
  const record = row as Record<string, unknown>;
  const city = normalizeText(record.city);
  if (!city) return null;

  return {
    city,
    status: isMarketStatus(record.status) ? record.status : MarketStatus.ACTIVE,
    services: normalizeServiceEntries(record.services, fallbackServices),
    areas: normalizeAreaEntries(record.areas),
  };
};

const statusMessage = (label: string, status: MarketStatus, city = '', area = ''): string => {
  const location = city || area;
  if (status === MarketStatus.ACTIVE) return '';
  if (status === MarketStatus.COMING_SOON) return location
    ? `Padi is coming soon to ${location}.`
    : `${label} is coming soon.`;
  if (status === MarketStatus.PAUSED) return location
    ? `Padi is temporarily unavailable in ${location}.`
    : `${label} is temporarily unavailable.`;
  return location
    ? `Padi is not available in ${location} yet.`
    : `${label} is not currently available.`;
};

const mergeServiceStatus = (
  baseServices: ServiceDefinition[],
  overrideServices: ServiceDefinition[]
): ServiceDefinition[] => {
  const map = new Map(baseServices.map((service) => [service.serviceKey, service]));
  overrideServices.forEach((service) => {
    const existing = map.get(service.serviceKey);
    map.set(service.serviceKey, {
      ...existing,
      ...service,
      subcategories: mergeSubcategories(existing?.subcategories || [], service.subcategories || []),
    });
  });
  return Array.from(map.values());
};

const mergeSubcategories = (
  base: NonNullable<ServiceDefinition['subcategories']>,
  overrides: NonNullable<ServiceDefinition['subcategories']>
) => {
  const map = new Map(base.map((subcategory) => [subcategory.subcategoryKey, subcategory]));
  overrides.forEach((subcategory) => {
    map.set(subcategory.subcategoryKey, { ...map.get(subcategory.subcategoryKey), ...subcategory });
  });
  return Array.from(map.values());
};

const serviceOverride = (services: ServiceDefinition[], serviceKey: string): ServiceDefinition | undefined =>
  services.find((service) => service.serviceKey === serviceKey);

const subcategoryOverride = (service: ServiceDefinition | undefined, subcategoryKey: string) =>
  service?.subcategories?.find((subcategory) => subcategory.subcategoryKey === subcategoryKey);

const firstNumber = (...values: unknown[]): number | undefined =>
  values.find((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0);

const pricingSourceFor = (
  values: Array<{ value: unknown; source: string }>
): string => values.find((entry) => typeof entry.value === 'number' && Number.isFinite(entry.value) && entry.value >= 0)?.source ?? 'UNRESOLVED';

export const getMarketAvailability = async (
  countryInput: unknown,
  cityInput?: unknown,
  areaInput?: unknown
): Promise<AvailabilityResult> => {
  const countryCode = normalizeCountryCode(countryInput);
  const baseMarket = MARKET_CONFIG[countryCode as CountryCode];
  const setting = await MarketSetting.findOne({ 'identity.countryCode': countryCode }).lean();
  const catalogue = await publishedCatalogue();
  const coverage = (setting?.coverage || {}) as {
    serviceCategories?: unknown[];
    cityServiceAvailability?: unknown[];
  };
  const marketIdentity = (setting?.identity || {}) as {
    countryName?: string;
    currency?: string;
    status?: MarketStatus;
  };
  const defaultCalloutFeeMinor = typeof setting?.pricing?.defaultCalloutFeeMinor === 'number'
    ? setting.pricing.defaultCalloutFeeMinor
    : undefined;
  const city = normalizeText(cityInput);
  const area = normalizeText(areaInput);
  const fallbackServices = normalizeServiceEntries(
    coverage.serviceCategories,
    []
  );
  const cityRows = Array.isArray(coverage.cityServiceAvailability)
    ? coverage.cityServiceAvailability
        .map((row: unknown) => buildCityAvailability(row, fallbackServices))
        .filter((row: CityAvailability | null): row is CityAvailability => Boolean(row))
    : [];
  const cityMatch = city
    ? cityRows.find((row: CityAvailability) => row.city.toLowerCase() === city.toLowerCase())
    : null;

  const countryStatus = setting?.deletionLock?.locked
    ? MarketStatus.DISABLED
    : marketIdentity.status || MarketStatus.DISABLED;
  const cityStatus = cityMatch?.status || (cityRows.length ? MarketStatus.DISABLED : countryStatus);
  const catalogueServices = publicCatalogueDefaults(catalogue);
  const marketServices = fallbackServices;
  let services = mergeServiceStatus(catalogueServices, marketServices);
  services = enrichServiceEntries(services, catalogue);
  services.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  const socialProofServiceKeys = services.flatMap((service) => {
    const subcategoryKeys = (service.subcategories || []).map((subcategory) =>
      subcategory.serviceKey || subcategory.subcategoryKey
    );
    return [service.serviceKey, ...subcategoryKeys];
  });
  const socialProof = await loadServiceSocialProof(socialProofServiceKeys, countryCode, city);

  const effectiveLocationStatus = countryStatus === MarketStatus.ACTIVE ? cityStatus : countryStatus;
  const formattedServices = services.map((service: ServiceDefinition) => {
    const effectiveStatus = effectiveLocationStatus === MarketStatus.ACTIVE ? service.status : effectiveLocationStatus;
    const catalogued = catalogue.get(service.serviceKey);
    const marketOverride = serviceOverride(marketServices, service.serviceKey);
    const serviceCalloutFeeMinor = firstNumber(
      marketOverride?.calloutFeeMinor,
      catalogued?.calloutFeeMinor,
      defaultCalloutFeeMinor
    );
    const serviceCalloutFeeEnabled = isCalloutFeeEnabled(
      service.calloutFeeEnabled,
      serviceCalloutFeeMinor,
      defaultCalloutFeeMinor
    );
    const pricingSource =
      marketOverride?.calloutFeeMinor !== undefined ? 'MARKET_SERVICE_OVERRIDE' :
      catalogued?.calloutFeeMinor !== undefined ? 'CATALOGUE_SERVICE_DEFAULT' :
      defaultCalloutFeeMinor !== undefined ? 'MARKET_DEFAULT_CALLOUT' :
      'UNRESOLVED';
    return {
      ...service,
      subcategories: (service.subcategories || []).map((subcategory) => {
        const marketSubcategory = subcategoryOverride(marketOverride, subcategory.subcategoryKey);
        const pricingCandidates = [
          { value: marketSubcategory?.calloutFeeMinor, source: 'MARKET_SUBCATEGORY_OVERRIDE' },
          { value: subcategory.calloutFeeMinor, source: 'CATALOGUE_SUBCATEGORY_DEFAULT' },
          { value: marketOverride?.calloutFeeMinor, source: 'MARKET_SERVICE_OVERRIDE' },
          { value: catalogued?.calloutFeeMinor, source: 'CATALOGUE_SERVICE_DEFAULT' },
          { value: defaultCalloutFeeMinor, source: 'MARKET_DEFAULT_CALLOUT' },
        ];
        const resolvedSubcategoryFeeMinor = firstNumber(...pricingCandidates.map((entry) => entry.value));
        const subcategoryCalloutFeeEnabled = isCalloutFeeEnabled(
          subcategory.calloutFeeEnabled,
          resolvedSubcategoryFeeMinor,
          serviceCalloutFeeMinor
        );
        return {
          ...subcategory,
          status: effectiveStatus === MarketStatus.ACTIVE ? subcategory.status : effectiveStatus,
          calloutFeeEnabled: subcategoryCalloutFeeEnabled,
          calloutFeeMinor: subcategoryCalloutFeeEnabled ? (resolvedSubcategoryFeeMinor ?? 0) : 0,
          pricingSource: pricingSourceFor(pricingCandidates),
          socialProof: proofForService(
            socialProof,
            subcategory.serviceKey || subcategory.subcategoryKey,
            countryCode,
            city
          ),
        };
      }),
      status: effectiveStatus,
      canBook: effectiveStatus === MarketStatus.ACTIVE,
      message: statusMessage(service.label, effectiveStatus, city, area),
      calloutFeeEnabled: serviceCalloutFeeEnabled,
      calloutFeeMinor: serviceCalloutFeeEnabled ? (serviceCalloutFeeMinor ?? 0) : 0,
      pricingSource,
      socialProof: proofForService(socialProof, service.serviceKey, countryCode, city),
    };
  });
  const servicesWithSocialProof = formattedServices.map((service) => {
    const subcategoryProofs = (service.subcategories || [])
      .map((subcategory) => subcategory.socialProof)
      .filter((proof): proof is ServiceSocialProof => Boolean(proof));
    if (!subcategoryProofs.length) return service;
    return {
      ...service,
      socialProof: combineSocialProof(subcategoryProofs, countryCode, city),
    };
  });

  const market = {
    countryCode,
    countryName: marketIdentity.countryName || baseMarket?.countryName || countryCode,
    currency: marketIdentity.currency || baseMarket?.currency || '',
    city,
    area,
  };

  return {
    ...market,
    market,
    groups: attachGroupSocialProof(buildServiceGroups(servicesWithSocialProof), countryCode, city),
    services: servicesWithSocialProof,
  };
};

export const validateServiceBookable = async (input: {
  countryCode: unknown;
  city?: unknown;
  area?: unknown;
  serviceKey?: unknown;
  subcategoryKey?: unknown;
}): Promise<{ allowed: boolean; message?: string; service?: AvailabilityResult['services'][number] }> => {
  const availability = await getMarketAvailability(input.countryCode, input.city, input.area);
  const serviceKey = normalizeServiceKey(input.serviceKey);
  const subcategoryKey = normalizeServiceKey(input.subcategoryKey);
  if (!serviceKey) {
    return { allowed: false, message: 'Please choose a valid service before booking.' };
  }

  const service = availability.services.find((item) => item.serviceKey === serviceKey);
  if (!service) {
    const parentWithBookable = availability.services.find((item) =>
      item.subcategories?.some((subcategory) =>
        (subcategory.serviceKey || subcategory.subcategoryKey) === serviceKey
      )
    );
    const bookable = parentWithBookable?.subcategories?.find((subcategory) =>
      (subcategory.serviceKey || subcategory.subcategoryKey) === serviceKey
    );
    if (parentWithBookable && bookable) {
      if (!parentWithBookable.canBook || bookable.status !== MarketStatus.ACTIVE) {
        return {
          allowed: false,
          message: `${bookable.label} is not currently bookable in this location.`,
          service: parentWithBookable,
        };
      }
      return {
        allowed: true,
        service: {
          ...parentWithBookable,
          calloutFeeEnabled: bookable.calloutFeeEnabled === true,
          calloutFeeMinor: bookable.calloutFeeMinor ?? 0,
          pricingSource: bookable.pricingSource || 'SUBCATEGORY_RESOLVED_CALLOUT',
        },
      };
    }
    return {
      allowed: false,
      message: `${labelFromServiceKey(serviceKey)} is not available in this location.`,
    };
  }

  if (!service.canBook) {
    return { allowed: false, message: service.message || `${service.label} is not available in this location.`, service };
  }

  if (subcategoryKey) {
    const subcategory = service.subcategories?.find((item) => item.subcategoryKey === subcategoryKey);
    if (!subcategory) {
      return { allowed: false, message: 'This subcategory is not available for the selected service.', service };
    }
    if (subcategory.status !== MarketStatus.ACTIVE) {
      return { allowed: false, message: `${subcategory.label} is not currently bookable.`, service };
    }
    return {
      allowed: true,
      service: {
        ...service,
        calloutFeeEnabled: subcategory.calloutFeeEnabled === true,
        calloutFeeMinor: subcategory.calloutFeeMinor ?? 0,
        pricingSource: subcategory.pricingSource || 'SUBCATEGORY_RESOLVED_CALLOUT',
      },
    };
  }

  return { allowed: true, service };
};
