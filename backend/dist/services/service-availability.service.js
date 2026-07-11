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
exports.DEFAULT_SERVICE_DEFINITIONS = [
    { serviceKey: 'appliance_repair', label: 'Appliance Repair', status: market_setting_model_1.MarketStatus.ACTIVE },
    { serviceKey: 'plumbing', label: 'Plumbing', status: market_setting_model_1.MarketStatus.ACTIVE },
    { serviceKey: 'electrical', label: 'Electrical', status: market_setting_model_1.MarketStatus.ACTIVE },
    { serviceKey: 'cleaning', label: 'Cleaning', status: market_setting_model_1.MarketStatus.ACTIVE },
    { serviceKey: 'painting', label: 'Painting', status: market_setting_model_1.MarketStatus.ACTIVE },
    { serviceKey: 'gardening', label: 'Gardening', status: market_setting_model_1.MarketStatus.ACTIVE },
    { serviceKey: 'maintenance', label: 'Maintenance', status: market_setting_model_1.MarketStatus.ACTIVE },
    { serviceKey: 'automotive', label: 'Automotive', status: market_setting_model_1.MarketStatus.ACTIVE },
    { serviceKey: 'managed_collection', label: 'Managed Collection Services', status: market_setting_model_1.MarketStatus.DISABLED },
    { serviceKey: 'rental_property', label: 'Rental Property Listings', status: market_setting_model_1.MarketStatus.DISABLED },
];
const SERVICE_ALIASES = {
    appliances: 'appliance_repair',
    appliance: 'appliance_repair',
    'appliance repair': 'appliance_repair',
    mechanic: 'automotive',
    automotive: 'automotive',
    painter: 'painting',
    painting: 'painting',
    plumber: 'plumbing',
    plumbing: 'plumbing',
    electrician: 'electrical',
    electrical: 'electrical',
    cleaning: 'cleaning',
    gardening: 'gardening',
    maintenance: 'maintenance',
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
const statusPriority = {
    [market_setting_model_1.MarketStatus.ACTIVE]: 4,
    [market_setting_model_1.MarketStatus.COMING_SOON]: 3,
    [market_setting_model_1.MarketStatus.PAUSED]: 2,
    [market_setting_model_1.MarketStatus.DISABLED]: 1,
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
const isMarketStatus = (value) => typeof value === 'string' && Object.values(market_setting_model_1.MarketStatus).includes(value);
exports.isMarketStatus = isMarketStatus;
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
    overrideServices.forEach((service) => map.set(service.serviceKey, { ...map.get(service.serviceKey), ...service }));
    return Array.from(map.values());
};
const getMarketAvailability = async (countryInput, cityInput, areaInput) => {
    const countryCode = (0, market_config_1.normalizeCountryCode)(countryInput);
    const baseMarket = market_config_1.MARKET_CONFIG[countryCode];
    const setting = await market_setting_model_1.default.findOne({ 'identity.countryCode': countryCode }).lean();
    const coverage = (setting?.coverage || {});
    const marketIdentity = (setting?.identity || {});
    const city = (0, exports.normalizeText)(cityInput);
    const area = (0, exports.normalizeText)(areaInput);
    const fallbackServices = (0, exports.normalizeServiceEntries)(coverage.serviceCategories, exports.DEFAULT_SERVICE_DEFINITIONS);
    const cityRows = Array.isArray(coverage.cityServiceAvailability)
        ? coverage.cityServiceAvailability
            .map((row) => (0, exports.buildCityAvailability)(row, fallbackServices))
            .filter((row) => Boolean(row))
        : [];
    const cityMatch = city
        ? cityRows.find((row) => row.city.toLowerCase() === city.toLowerCase())
        : null;
    const countryStatus = marketIdentity.status || (baseMarket?.enabled ? market_setting_model_1.MarketStatus.ACTIVE : market_setting_model_1.MarketStatus.DISABLED);
    const cityStatus = cityMatch?.status || (cityRows.length ? market_setting_model_1.MarketStatus.DISABLED : countryStatus);
    const areaMatch = area && cityMatch?.areas?.length
        ? cityMatch.areas.find((row) => row.name.toLowerCase() === area.toLowerCase())
        : null;
    const areaStatus = areaMatch?.status || cityStatus;
    let services = cityMatch?.services?.length ? cityMatch.services : fallbackServices;
    if (areaMatch?.services?.length)
        services = mergeServiceStatus(services, areaMatch.services);
    if (!services.length)
        services = exports.DEFAULT_SERVICE_DEFINITIONS;
    const effectiveLocationStatus = countryStatus === market_setting_model_1.MarketStatus.ACTIVE ? areaStatus : countryStatus;
    const formattedServices = services.map((service) => {
        const effectiveStatus = effectiveLocationStatus === market_setting_model_1.MarketStatus.ACTIVE ? service.status : effectiveLocationStatus;
        return {
            ...service,
            status: effectiveStatus,
            canBook: effectiveStatus === market_setting_model_1.MarketStatus.ACTIVE,
            message: statusMessage(service.label, effectiveStatus, city, area),
        };
    });
    return {
        countryCode,
        countryName: marketIdentity.countryName || baseMarket?.countryName || countryCode,
        currency: marketIdentity.currency || baseMarket?.currency || 'ZAR',
        city,
        area,
        services: formattedServices,
    };
};
exports.getMarketAvailability = getMarketAvailability;
const validateServiceBookable = async (input) => {
    const availability = await (0, exports.getMarketAvailability)(input.countryCode, input.city, input.area);
    const serviceKey = (0, exports.normalizeServiceKey)(input.serviceKey);
    if (!serviceKey) {
        return { allowed: false, message: 'Please choose a valid service before booking.' };
    }
    const service = availability.services.find((item) => item.serviceKey === serviceKey);
    if (!service) {
        return {
            allowed: false,
            message: `${(0, exports.labelFromServiceKey)(serviceKey)} is not available in this location.`,
        };
    }
    if (!service.canBook) {
        return { allowed: false, message: service.message || `${service.label} is not available in this location.`, service };
    }
    return { allowed: true, service };
};
exports.validateServiceBookable = validateServiceBookable;
//# sourceMappingURL=service-availability.service.js.map