import { CountryCode, MARKET_CONFIG, normalizeCountryCode } from '../config/market.config';
import MarketSetting, { MarketStatus } from '../models/market-setting.model';

export interface ServiceDefinition {
  serviceKey: string;
  label: string;
  status: MarketStatus;
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
  services: Array<ServiceDefinition & {
    canBook: boolean;
    message: string;
  }>;
}

export const DEFAULT_SERVICE_DEFINITIONS: ServiceDefinition[] = [
  { serviceKey: 'appliance_repair', label: 'Appliance Repair', status: MarketStatus.ACTIVE },
  { serviceKey: 'plumbing', label: 'Plumbing', status: MarketStatus.ACTIVE },
  { serviceKey: 'electrical', label: 'Electrical', status: MarketStatus.ACTIVE },
  { serviceKey: 'cleaning', label: 'Cleaning', status: MarketStatus.ACTIVE },
  { serviceKey: 'painting', label: 'Painting', status: MarketStatus.ACTIVE },
  { serviceKey: 'gardening', label: 'Gardening', status: MarketStatus.ACTIVE },
  { serviceKey: 'maintenance', label: 'Maintenance', status: MarketStatus.ACTIVE },
  { serviceKey: 'automotive', label: 'Automotive', status: MarketStatus.ACTIVE },
  { serviceKey: 'managed_collection', label: 'Managed Collection Services', status: MarketStatus.COMING_SOON },
];

const SERVICE_ALIASES: Record<string, string> = {
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
};

const statusPriority: Record<MarketStatus, number> = {
  [MarketStatus.ACTIVE]: 4,
  [MarketStatus.COMING_SOON]: 3,
  [MarketStatus.PAUSED]: 2,
  [MarketStatus.DISABLED]: 1,
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

export const isMarketStatus = (value: unknown): value is MarketStatus =>
  typeof value === 'string' && Object.values(MarketStatus).includes(value as MarketStatus);

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

  return {
    serviceKey,
    label: normalizeText(record.label) || labelFromServiceKey(serviceKey),
    status: isMarketStatus(record.status) ? record.status : MarketStatus.ACTIVE,
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
  const location = area || city;
  if (status === MarketStatus.ACTIVE) return '';
  if (status === MarketStatus.COMING_SOON) return `${label} is coming soon${location ? ` in ${location}` : ''}.`;
  if (status === MarketStatus.PAUSED) return `${label} is temporarily unavailable${location ? ` in ${location}` : ''}.`;
  return `${label} is not available${location ? ` in ${location}` : ''}.`;
};

const mergeServiceStatus = (
  baseServices: ServiceDefinition[],
  overrideServices: ServiceDefinition[]
): ServiceDefinition[] => {
  const map = new Map(baseServices.map((service) => [service.serviceKey, service]));
  overrideServices.forEach((service) => map.set(service.serviceKey, { ...map.get(service.serviceKey), ...service }));
  return Array.from(map.values());
};

export const getMarketAvailability = async (
  countryInput: unknown,
  cityInput?: unknown,
  areaInput?: unknown
): Promise<AvailabilityResult> => {
  const countryCode = normalizeCountryCode(countryInput);
  const baseMarket = MARKET_CONFIG[countryCode as CountryCode];
  const setting = await MarketSetting.findOne({ 'identity.countryCode': countryCode }).lean();
  const coverage = (setting?.coverage || {}) as {
    serviceCategories?: unknown[];
    cityServiceAvailability?: unknown[];
  };
  const marketIdentity = (setting?.identity || {}) as {
    countryName?: string;
    currency?: string;
    status?: MarketStatus;
  };
  const city = normalizeText(cityInput);
  const area = normalizeText(areaInput);
  const fallbackServices = normalizeServiceEntries(
    coverage.serviceCategories,
    DEFAULT_SERVICE_DEFINITIONS
  );
  const cityRows = Array.isArray(coverage.cityServiceAvailability)
    ? coverage.cityServiceAvailability
        .map((row: unknown) => buildCityAvailability(row, fallbackServices))
        .filter((row: CityAvailability | null): row is CityAvailability => Boolean(row))
    : [];
  const cityMatch = city
    ? cityRows.find((row: CityAvailability) => row.city.toLowerCase() === city.toLowerCase())
    : null;

  const countryStatus = marketIdentity.status || (baseMarket?.enabled ? MarketStatus.ACTIVE : MarketStatus.DISABLED);
  const cityStatus = cityMatch?.status || (cityRows.length ? MarketStatus.DISABLED : countryStatus);
  const areaMatch = area && cityMatch?.areas?.length
    ? cityMatch.areas.find((row: AreaAvailability) => row.name.toLowerCase() === area.toLowerCase())
    : null;
  const areaStatus = areaMatch?.status || cityStatus;

  let services = cityMatch?.services?.length ? cityMatch.services : fallbackServices;
  if (areaMatch?.services?.length) services = mergeServiceStatus(services, areaMatch.services);
  if (!services.length) services = DEFAULT_SERVICE_DEFINITIONS;

  const effectiveLocationStatus = countryStatus === MarketStatus.ACTIVE ? areaStatus : countryStatus;
  const formattedServices = services.map((service: ServiceDefinition) => {
    const effectiveStatus = effectiveLocationStatus === MarketStatus.ACTIVE ? service.status : effectiveLocationStatus;
    return {
      ...service,
      status: effectiveStatus,
      canBook: effectiveStatus === MarketStatus.ACTIVE,
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

export const validateServiceBookable = async (input: {
  countryCode: unknown;
  city?: unknown;
  area?: unknown;
  serviceKey?: unknown;
}): Promise<{ allowed: boolean; message?: string; service?: AvailabilityResult['services'][number] }> => {
  const availability = await getMarketAvailability(input.countryCode, input.city, input.area);
  const serviceKey = normalizeServiceKey(input.serviceKey);
  if (!serviceKey) {
    return { allowed: false, message: 'Please choose a valid service before booking.' };
  }

  const service = availability.services.find((item) => item.serviceKey === serviceKey);
  if (!service) {
    return {
      allowed: false,
      message: `${labelFromServiceKey(serviceKey)} is not available in this location.`,
    };
  }

  if (!service.canBook) {
    return { allowed: false, message: service.message || `${service.label} is not available in this location.`, service };
  }

  return { allowed: true, service };
};
