"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateServiceBookable = exports.getMarketAvailability = exports.buildCityAvailability = exports.normalizeAreaEntries = exports.normalizeServiceEntries = exports.normalizeServiceEntry = exports.isMarketStatus = exports.labelFromServiceKey = exports.normalizeServiceKey = exports.normalizeText = exports.DEFAULT_SERVICE_DEFINITIONS = void 0;
const market_config_1 = require("../config/market.config");
const market_setting_model_1 = __importStar(require("../models/market-setting.model"));
const service_catalog_model_1 = __importStar(require("../models/service-catalog.model"));
exports.DEFAULT_SERVICE_DEFINITIONS = [
    { serviceKey: 'appliance_repair', categoryKey: 'appliance_repair', groupKey: 'home_services', groupLabel: 'Home Services', label: 'Appliance Repair', status: market_setting_model_1.MarketStatus.ACTIVE, displayOrder: 10 },
    { serviceKey: 'cleaning', categoryKey: 'cleaning', groupKey: 'home_services', groupLabel: 'Home Services', label: 'Cleaning Service', status: market_setting_model_1.MarketStatus.ACTIVE, displayOrder: 20 },
    { serviceKey: 'electrical', categoryKey: 'electrical', groupKey: 'home_services', groupLabel: 'Home Services', label: 'Electrical Repair', status: market_setting_model_1.MarketStatus.ACTIVE, displayOrder: 30 },
    { serviceKey: 'gardening', categoryKey: 'gardening', groupKey: 'home_services', groupLabel: 'Home Services', label: 'Gardening Service', status: market_setting_model_1.MarketStatus.ACTIVE, displayOrder: 40 },
    { serviceKey: 'maintenance', categoryKey: 'maintenance', groupKey: 'home_services', groupLabel: 'Home Services', label: 'Maintenance Service', status: market_setting_model_1.MarketStatus.ACTIVE, displayOrder: 50 },
    { serviceKey: 'painting', categoryKey: 'painting', groupKey: 'home_services', groupLabel: 'Home Services', label: 'Painting Service', status: market_setting_model_1.MarketStatus.ACTIVE, displayOrder: 60 },
    { serviceKey: 'plumbing', categoryKey: 'plumbing', groupKey: 'home_services', groupLabel: 'Home Services', label: 'Plumbing', status: market_setting_model_1.MarketStatus.ACTIVE, displayOrder: 70 },
    { serviceKey: 'automotive', label: 'Automotive', status: market_setting_model_1.MarketStatus.ACTIVE },
    { serviceKey: 'managed_collection', label: 'Managed Collection Services', status: market_setting_model_1.MarketStatus.DISABLED },
    { serviceKey: 'rental_property', label: 'Rental Property Listings', status: market_setting_model_1.MarketStatus.DISABLED },
];
const PUBLIC_SERVICE_FIELDS = 'serviceKey categoryKey groupKey groupLabel groupDescription groupImageKey groupImageUrl groupIconKey groupStatus groupDisplayOrder label description imageKey imageUrl iconKey searchKeywords synonyms status displayOrder defaultCalloutFeeMinor minimumChargeMinor fixedPriceSupported requiresCapabilityApproval capabilityRequirements subcategories';
const publishedCatalogue = async () => {
    const services = await service_catalog_model_1.default.find({ status: service_catalog_model_1.ServicePublicationStatus.PUBLISHED })
        .select(PUBLIC_SERVICE_FIELDS)
        .lean();
    return new Map(services.map((service) => [
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
            status: market_setting_model_1.MarketStatus.ACTIVE,
            displayOrder: service.displayOrder,
            calloutFeeMinor: service.defaultCalloutFeeMinor,
            minimumChargeMinor: service.minimumChargeMinor,
            fixedPriceSupported: service.fixedPriceSupported,
            requiresCapabilityApproval: service.requiresCapabilityApproval,
            capabilityRequirements: service.capabilityRequirements,
            subcategories: (service.subcategories || [])
                .filter((subcategory) => subcategory.status !== market_setting_model_1.MarketStatus.ARCHIVED &&
                subcategory.status !== market_setting_model_1.MarketStatus.DISABLED &&
                (!subcategory.publicationStatus || subcategory.publicationStatus === service_catalog_model_1.ServicePublicationStatus.PUBLISHED))
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
                billingModel: subcategory.billingModel || service_catalog_model_1.ServiceBillingModel.ON_DEMAND,
                subscriptionEligible: subcategory.subscriptionEligible === true,
                subscriptionCadences: subcategory.subscriptionCadences || [],
                subscriptionNotes: subcategory.subscriptionNotes || '',
                calloutFeeMinor: subcategory.calloutFeeMinor,
                minimumChargeMinor: subcategory.minimumChargeMinor,
            })),
        },
    ]));
};
const SERVICE_ALIASES = {
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
const groupKeyForService = (serviceKey) => {
    if (serviceKey === 'automotive')
        return 'auto_services';
    if (serviceKey === 'rental_property')
        return 'rental_services';
    if (serviceKey === 'managed_collection')
        return 'property_services';
    return 'home_services';
};
const groupLabelForKey = (groupKey) => {
    const labels = {
        home_services: 'Home Services',
        auto_services: 'Auto Services',
        business_services: 'Business Services',
        rental_services: 'Rental Services',
        property_services: 'Property Services',
    };
    return labels[groupKey] ?? (0, exports.labelFromServiceKey)(groupKey);
};
const statusPriority = {
    [market_setting_model_1.MarketStatus.DRAFT]: 0,
    [market_setting_model_1.MarketStatus.ACTIVE]: 4,
    [market_setting_model_1.MarketStatus.COMING_SOON]: 3,
    [market_setting_model_1.MarketStatus.PAUSED]: 2,
    [market_setting_model_1.MarketStatus.DISABLED]: 1,
    [market_setting_model_1.MarketStatus.ARCHIVED]: 0,
};
const normalizeText = (value) => typeof value === 'string' ? value.trim() : '';
exports.normalizeText = normalizeText;
const normalizeServiceKey = (value) => {
    const raw = (0, exports.normalizeText)(value).toLowerCase();
    if (!raw)
        return '';
    return SERVICE_ALIASES[raw] ?? raw.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
};
exports.normalizeServiceKey = normalizeServiceKey;
const labelFromServiceKey = (serviceKey) => exports.DEFAULT_SERVICE_DEFINITIONS.find((item) => item.serviceKey === serviceKey)?.label ??
    serviceKey
        .split('_')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
exports.labelFromServiceKey = labelFromServiceKey;
const enrichServiceEntries = (entries, catalogue) => {
    const enriched = [];
    entries.forEach((entry) => {
        const catalogued = catalogue.get(entry.serviceKey);
        if (!catalogued)
            return;
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
const publicCatalogueDefaults = (catalogue) => Array.from(catalogue.values()).filter((service) => (service.subcategories || []).length > 0 || typeof service.calloutFeeMinor === 'number');
const isMarketStatus = (value) => typeof value === 'string' && Object.values(market_setting_model_1.MarketStatus).includes(value);
exports.isMarketStatus = isMarketStatus;
const isServiceBillingModel = (value) => typeof value === 'string' && Object.values(service_catalog_model_1.ServiceBillingModel).includes(value);
const normalizeSubscriptionCadences = (value) => (Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [])
    .map((item) => String(item || '').trim().toUpperCase())
    .filter((item) => Object.values(service_catalog_model_1.ServiceSubscriptionCadence).includes(item))
    .filter((item, index, values) => values.indexOf(item) === index);
const normalizeServiceEntry = (entry) => {
    if (typeof entry === 'string') {
        const serviceKey = (0, exports.normalizeServiceKey)(entry);
        if (!serviceKey)
            return null;
        return { serviceKey, label: (0, exports.labelFromServiceKey)(serviceKey), status: market_setting_model_1.MarketStatus.ACTIVE };
    }
    if (!entry || typeof entry !== 'object')
        return null;
    const record = entry;
    const serviceKey = (0, exports.normalizeServiceKey)(record.serviceKey ?? record.key ?? record.value ?? record.label);
    if (!serviceKey)
        return null;
    return {
        serviceKey,
        label: (0, exports.normalizeText)(record.label) || (0, exports.labelFromServiceKey)(serviceKey),
        status: (0, exports.isMarketStatus)(record.status) ? record.status : market_setting_model_1.MarketStatus.ACTIVE,
        calloutFeeMinor: typeof record.calloutFeeMinor === 'number'
            ? record.calloutFeeMinor
            : typeof record.calloutFee === 'number'
                ? Math.round(record.calloutFee * 100)
                : undefined,
        imageKey: (0, exports.normalizeText)(record.imageKey),
        imageUrl: (0, exports.normalizeText)(record.imageUrl),
        description: (0, exports.normalizeText)(record.description),
        minimumChargeMinor: typeof record.minimumChargeMinor === 'number' ? record.minimumChargeMinor : undefined,
        fixedPriceSupported: record.fixedPriceSupported === true,
        displayOrder: Number.isFinite(Number(record.displayOrder)) ? Number(record.displayOrder) : undefined,
        subcategories: Array.isArray(record.subcategories)
            ? record.subcategories
                .map((subcategory) => {
                if (!subcategory || typeof subcategory !== 'object')
                    return null;
                const subRecord = subcategory;
                const subcategoryKey = (0, exports.normalizeServiceKey)(subRecord.subcategoryKey ?? subRecord.key ?? subRecord.label);
                const serviceKey = (0, exports.normalizeServiceKey)(subRecord.serviceKey ?? subRecord.subcategoryKey ?? subRecord.key ?? subRecord.label);
                const label = (0, exports.normalizeText)(subRecord.label);
                if (!subcategoryKey)
                    return null;
                return {
                    subcategoryKey,
                    serviceKey,
                    label: label || (0, exports.labelFromServiceKey)(subcategoryKey),
                    description: (0, exports.normalizeText)(subRecord.description),
                    status: (0, exports.isMarketStatus)(subRecord.status) ? subRecord.status : market_setting_model_1.MarketStatus.ACTIVE,
                    publicationStatus: (0, exports.normalizeText)(subRecord.publicationStatus),
                    imageKey: (0, exports.normalizeText)(subRecord.imageKey),
                    imageUrl: (0, exports.normalizeText)(subRecord.imageUrl),
                    estimatedDurationMinutes: Number.isFinite(Number(subRecord.estimatedDurationMinutes)) ? Number(subRecord.estimatedDurationMinutes) : undefined,
                    inspectionRequired: subRecord.inspectionRequired === true,
                    fixedPriceSupported: subRecord.fixedPriceSupported === true,
                    billingModel: isServiceBillingModel(subRecord.billingModel) ? subRecord.billingModel : service_catalog_model_1.ServiceBillingModel.ON_DEMAND,
                    subscriptionEligible: subRecord.subscriptionEligible === true,
                    subscriptionCadences: normalizeSubscriptionCadences(subRecord.subscriptionCadences),
                    subscriptionNotes: (0, exports.normalizeText)(subRecord.subscriptionNotes).slice(0, 800),
                    calloutFeeMinor: typeof subRecord.calloutFeeMinor === 'number'
                        ? subRecord.calloutFeeMinor
                        : typeof subRecord.calloutFee === 'number'
                            ? Math.round(subRecord.calloutFee * 100)
                            : undefined,
                    minimumChargeMinor: typeof subRecord.minimumChargeMinor === 'number'
                        ? subRecord.minimumChargeMinor
                        : typeof subRecord.minimumCharge === 'number'
                            ? Math.round(subRecord.minimumCharge * 100)
                            : undefined,
                };
            })
                .filter((subcategory) => Boolean(subcategory))
            : undefined,
    };
};
exports.normalizeServiceEntry = normalizeServiceEntry;
const normalizeServiceEntries = (entries, fallbackServices = []) => {
    const source = Array.isArray(entries) && entries.length ? entries : fallbackServices;
    const map = new Map();
    source.forEach((entry) => {
        const normalized = (0, exports.normalizeServiceEntry)(entry);
        if (!normalized)
            return;
        const existing = map.get(normalized.serviceKey);
        if (!existing || statusPriority[normalized.status] > statusPriority[existing.status]) {
            map.set(normalized.serviceKey, normalized);
        }
    });
    return Array.from(map.values());
};
exports.normalizeServiceEntries = normalizeServiceEntries;
const buildServiceGroups = (services) => {
    const groups = new Map();
    services.forEach((service) => {
        const groupKey = service.groupKey || groupKeyForService(service.serviceKey);
        const categoryKey = service.categoryKey || service.serviceKey;
        const groupStatus = service.groupStatus || service_catalog_model_1.ServicePublicationStatus.PUBLISHED;
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
        const bookableServices = (service.subcategories?.length
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
                canBook: service.canBook && subcategory.status === market_setting_model_1.MarketStatus.ACTIVE && typeof subcategory.calloutFeeMinor === 'number',
                message: subcategory.status === market_setting_model_1.MarketStatus.ACTIVE ? service.message : statusMessage(subcategory.label, subcategory.status),
                calloutFeeMinor: subcategory.calloutFeeMinor,
                minimumChargeMinor: subcategory.minimumChargeMinor ?? service.minimumChargeMinor,
                estimatedDurationMinutes: subcategory.estimatedDurationMinutes,
                inspectionRequired: subcategory.inspectionRequired,
                fixedPriceSupported: subcategory.fixedPriceSupported ?? service.fixedPriceSupported,
                requiresCapabilityApproval: subcategory.requiresCapabilityApproval ?? service.requiresCapabilityApproval,
                capabilityRequirements: subcategory.capabilityRequirements ?? service.capabilityRequirements,
                billingModel: subcategory.billingModel || service_catalog_model_1.ServiceBillingModel.ON_DEMAND,
                subscriptionEligible: subcategory.subscriptionEligible === true,
                subscriptionCadences: subcategory.subscriptionCadences || [],
                subscriptionNotes: subcategory.subscriptionNotes || '',
                searchKeywords: subcategory.searchKeywords || [],
                synonyms: subcategory.synonyms || [],
                displayOrder: subcategory.displayOrder,
                pricingSource: subcategory.pricingSource,
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
                    calloutFeeMinor: service.calloutFeeMinor,
                    minimumChargeMinor: service.minimumChargeMinor,
                    fixedPriceSupported: service.fixedPriceSupported,
                    requiresCapabilityApproval: service.requiresCapabilityApproval,
                    capabilityRequirements: service.capabilityRequirements,
                    searchKeywords: service.searchKeywords || [],
                    synonyms: service.synonyms || [],
                    displayOrder: service.displayOrder,
                    pricingSource: service.pricingSource,
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
const normalizeAreaEntries = (entries) => {
    if (!Array.isArray(entries))
        return [];
    return entries
        .map((entry) => {
        if (!entry || typeof entry !== 'object')
            return null;
        const record = entry;
        const name = (0, exports.normalizeText)(record.name ?? record.area);
        if (!name)
            return null;
        return {
            name,
            status: (0, exports.isMarketStatus)(record.status) ? record.status : market_setting_model_1.MarketStatus.ACTIVE,
            services: (0, exports.normalizeServiceEntries)(record.services),
        };
    })
        .filter((entry) => Boolean(entry));
};
exports.normalizeAreaEntries = normalizeAreaEntries;
const buildCityAvailability = (row, fallbackServices = []) => {
    if (!row || typeof row !== 'object')
        return null;
    const record = row;
    const city = (0, exports.normalizeText)(record.city);
    if (!city)
        return null;
    return {
        city,
        status: (0, exports.isMarketStatus)(record.status) ? record.status : market_setting_model_1.MarketStatus.ACTIVE,
        services: (0, exports.normalizeServiceEntries)(record.services, fallbackServices),
        areas: (0, exports.normalizeAreaEntries)(record.areas),
    };
};
exports.buildCityAvailability = buildCityAvailability;
const statusMessage = (label, status, city = '', area = '') => {
    const location = area || city;
    if (status === market_setting_model_1.MarketStatus.ACTIVE)
        return '';
    if (status === market_setting_model_1.MarketStatus.COMING_SOON)
        return `${label} is coming soon${location ? ` in ${location}` : ''}.`;
    if (status === market_setting_model_1.MarketStatus.PAUSED)
        return `${label} is temporarily unavailable${location ? ` in ${location}` : ''}.`;
    return `${label} is not available${location ? ` in ${location}` : ''}.`;
};
const mergeServiceStatus = (baseServices, overrideServices) => {
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
const mergeSubcategories = (base, overrides) => {
    const map = new Map(base.map((subcategory) => [subcategory.subcategoryKey, subcategory]));
    overrides.forEach((subcategory) => {
        map.set(subcategory.subcategoryKey, { ...map.get(subcategory.subcategoryKey), ...subcategory });
    });
    return Array.from(map.values());
};
const serviceOverride = (services, serviceKey) => services.find((service) => service.serviceKey === serviceKey);
const subcategoryOverride = (service, subcategoryKey) => service?.subcategories?.find((subcategory) => subcategory.subcategoryKey === subcategoryKey);
const firstNumber = (...values) => values.find((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0);
const pricingSourceFor = (values) => values.find((entry) => typeof entry.value === 'number' && Number.isFinite(entry.value) && entry.value >= 0)?.source ?? 'UNRESOLVED';
const getMarketAvailability = async (countryInput, cityInput, areaInput) => {
    const countryCode = (0, market_config_1.normalizeCountryCode)(countryInput);
    const baseMarket = market_config_1.MARKET_CONFIG[countryCode];
    const setting = await market_setting_model_1.default.findOne({ 'identity.countryCode': countryCode }).lean();
    const catalogue = await publishedCatalogue();
    const coverage = (setting?.coverage || {});
    const marketIdentity = (setting?.identity || {});
    const defaultCalloutFeeMinor = typeof setting?.pricing?.defaultCalloutFeeMinor === 'number'
        ? setting.pricing.defaultCalloutFeeMinor
        : undefined;
    const city = (0, exports.normalizeText)(cityInput);
    const area = (0, exports.normalizeText)(areaInput);
    const fallbackServices = (0, exports.normalizeServiceEntries)(coverage.serviceCategories, []);
    const cityRows = Array.isArray(coverage.cityServiceAvailability)
        ? coverage.cityServiceAvailability
            .map((row) => (0, exports.buildCityAvailability)(row, fallbackServices))
            .filter((row) => Boolean(row))
        : [];
    const cityMatch = city
        ? cityRows.find((row) => row.city.toLowerCase() === city.toLowerCase())
        : null;
    const countryStatus = setting?.deletionLock?.locked
        ? market_setting_model_1.MarketStatus.DISABLED
        : marketIdentity.status || market_setting_model_1.MarketStatus.DISABLED;
    const cityStatus = cityMatch?.status || (cityRows.length ? market_setting_model_1.MarketStatus.DISABLED : countryStatus);
    const catalogueServices = publicCatalogueDefaults(catalogue);
    const marketServices = fallbackServices;
    let services = mergeServiceStatus(catalogueServices, marketServices);
    services = enrichServiceEntries(services, catalogue);
    services.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    const effectiveLocationStatus = countryStatus === market_setting_model_1.MarketStatus.ACTIVE ? cityStatus : countryStatus;
    const formattedServices = services.map((service) => {
        const effectiveStatus = effectiveLocationStatus === market_setting_model_1.MarketStatus.ACTIVE ? service.status : effectiveLocationStatus;
        const catalogued = catalogue.get(service.serviceKey);
        const marketOverride = serviceOverride(marketServices, service.serviceKey);
        const serviceCalloutFeeMinor = firstNumber(marketOverride?.calloutFeeMinor, catalogued?.calloutFeeMinor, defaultCalloutFeeMinor);
        const pricingSource = marketOverride?.calloutFeeMinor !== undefined ? 'MARKET_SERVICE_OVERRIDE' :
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
                return {
                    ...subcategory,
                    status: effectiveStatus === market_setting_model_1.MarketStatus.ACTIVE ? subcategory.status : effectiveStatus,
                    calloutFeeMinor: firstNumber(...pricingCandidates.map((entry) => entry.value)),
                    pricingSource: pricingSourceFor(pricingCandidates),
                };
            }),
            status: effectiveStatus,
            canBook: effectiveStatus === market_setting_model_1.MarketStatus.ACTIVE && serviceCalloutFeeMinor !== undefined,
            message: statusMessage(service.label, effectiveStatus, city, area),
            calloutFeeMinor: serviceCalloutFeeMinor,
            pricingSource,
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
        groups: buildServiceGroups(formattedServices),
        services: formattedServices,
    };
};
exports.getMarketAvailability = getMarketAvailability;
const validateServiceBookable = async (input) => {
    const availability = await (0, exports.getMarketAvailability)(input.countryCode, input.city, input.area);
    const serviceKey = (0, exports.normalizeServiceKey)(input.serviceKey);
    const subcategoryKey = (0, exports.normalizeServiceKey)(input.subcategoryKey);
    if (!serviceKey) {
        return { allowed: false, message: 'Please choose a valid service before booking.' };
    }
    const service = availability.services.find((item) => item.serviceKey === serviceKey);
    if (!service) {
        const parentWithBookable = availability.services.find((item) => item.subcategories?.some((subcategory) => (subcategory.serviceKey || subcategory.subcategoryKey) === serviceKey));
        const bookable = parentWithBookable?.subcategories?.find((subcategory) => (subcategory.serviceKey || subcategory.subcategoryKey) === serviceKey);
        if (parentWithBookable && bookable) {
            if (!parentWithBookable.canBook || bookable.status !== market_setting_model_1.MarketStatus.ACTIVE || typeof bookable.calloutFeeMinor !== 'number') {
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
                    calloutFeeMinor: bookable.calloutFeeMinor,
                    pricingSource: bookable.pricingSource || 'SUBCATEGORY_RESOLVED_CALLOUT',
                },
            };
        }
        return {
            allowed: false,
            message: `${(0, exports.labelFromServiceKey)(serviceKey)} is not available in this location.`,
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
        if (subcategory.status !== market_setting_model_1.MarketStatus.ACTIVE || typeof subcategory.calloutFeeMinor !== 'number') {
            return { allowed: false, message: `${subcategory.label} is not currently bookable.`, service };
        }
        return {
            allowed: true,
            service: {
                ...service,
                calloutFeeMinor: subcategory.calloutFeeMinor,
                pricingSource: subcategory.pricingSource || 'SUBCATEGORY_RESOLVED_CALLOUT',
            },
        };
    }
    return { allowed: true, service };
};
exports.validateServiceBookable = validateServiceBookable;
//# sourceMappingURL=service-availability.service.js.map