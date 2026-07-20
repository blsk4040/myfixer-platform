function resolveApiBaseUrl() {
  const configured = window.MYFIXER_ADMIN_CONFIG?.API_BASE_URL;
  if (configured) return configured;

  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:5000/api/v1`;
}

let API_BASE_URL = resolveApiBaseUrl();

function resolveApiHealthUrl() {
  try {
    const url = new URL(API_BASE_URL);
    url.pathname = url.pathname.replace(/\/api\/v1\/?$/, '/api/health');
    if (!url.pathname.endsWith('/api/health')) url.pathname = '/api/health';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return API_BASE_URL.replace(/\/api\/v1\/?$/, '/api/health');
  }
}

function resolveApiEnvironment() {
  try {
    const url = new URL(API_BASE_URL);
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return 'Local';
    if (host.includes('staging') || host.includes('stage') || host.includes('test') || host.includes('dev')) return 'Staging';
    return 'Production';
  } catch {
    return 'API';
  }
}

const state = {
  token: localStorage.getItem('myfixer_admin_token') || '',
  user: JSON.parse(localStorage.getItem('myfixer_admin_user') || 'null'),
  activeView: 'overview',
  authView: new URLSearchParams(window.location.search).has('resetToken') ? 'reset' : 'login',
  authMessage: '',
  loading: false,
  error: '',
  idleWarning: '',
  apiHealth: {
    status: 'checking',
    environment: resolveApiEnvironment(),
    responseMs: null,
    checkedAt: null,
    message: 'Checking API connection',
  },
  revealedClientContacts: {},
  revealTimers: {},
  marketWorkflow: {
    selectedCountryCode: '',
    tab: 'configure',
    showCreateCountry: false,
    editingCountryCode: '',
    actionMenuCountryCode: '',
    deleteCountryCode: '',
    selectedCityName: '',
    showCreateCity: false,
    editingCityName: '',
    actionMenuCityName: '',
    actionMenuCityDirection: 'down',
    deleteCityName: '',
    selectedAreaName: '',
    showCreateArea: false,
    editingAreaName: '',
    actionMenuAreaName: '',
    actionMenuAreaDirection: 'down',
    deleteAreaName: '',
    message: '',
    error: '',
  },
  promotionWorkspace: {
    tab: 'directory',
    statusTab: 'ALL',
    detailTab: 'overview',
    selectedPromotionId: '',
    filters: {
      search: '',
      mode: '',
      status: '',
      market: '',
      service: '',
      fundingSource: '',
      dateFrom: '',
      dateTo: '',
    },
    createStep: 0,
    draft: {},
    redemptions: [],
    redemptionsState: '',
    audit: [],
    performance: null,
  },
  serviceWorkspace: {
    showCreateGroup: false,
    selectedGroupKey: '',
    selectedCategoryKey: '',
    actionMenuGroupKey: '',
    actionMenuCategoryKey: '',
    renameGroupKey: '',
    renameCategoryKey: '',
    deleteGroupKey: '',
    deleteCategoryKey: '',
    showCreateCategory: false,
    showCreateBookableService: false,
    selectedBookableServiceKey: '',
    drawerOpen: false,
    drawerMode: '',
    categoryDraft: {},
    bookableDraft: {},
    message: '',
    error: '',
  },
  collectionOperationFilters: {
    countryCode: '',
    city: '',
    area: '',
    collectionType: '',
    status: '',
    preferredDay: '',
  },
  notificationFilters: {
    status: '',
    channel: '',
    type: '',
    user: '',
    from: '',
    to: '',
  },
  data: {
    overview: null,
    clients: [],
    clientsContactAccess: false,
    technicians: [],
    bookings: [],
    managedCollections: [],
    managedCollectionReminders: [],
    collectionOperations: {
      jobs: [],
      metrics: {},
      calendar: {},
      meta: {},
    },
    notifications: [],
    notificationCounts: [],
    notificationMeta: {
      statuses: [],
      channels: [],
      enabledChannels: [],
      disabledChannels: [],
      types: [],
    },
    managedCollectionSubscriptions: {
      plans: [],
      subscriptions: [],
      invoices: [],
      reports: {},
      meta: {},
    },
    quotes: [],
    invoices: [],
    ledger: [],
    settlements: [],
    promotions: [],
    promotionSummary: null,
    promotionMeta: {
      discountTypes: [],
      statuses: [],
      triggerTypes: [],
      fundingSources: [],
      stackingPolicies: [],
    },
    markets: [],
    serviceCatalog: [],
    adminUsers: [],
    auditLogs: [],
    marketMeta: {
      availableStatuses: [],
      availablePaymentProviders: [],
      defaultServiceCategories: [],
      serviceDefinitions: [],
      availableMarkets: [],
    },
    adminMeta: {
      roles: [],
      permissionsByRole: {},
    },
  },
  selectedBooking: null,
};

const views = [
  { id: 'overview', label: 'Overview', icon: 'O', permission: 'overview.read' },
  { id: 'clients', label: 'Clients', icon: 'C', permission: 'overview.read' },
  { id: 'technicians', label: 'Technicians', icon: 'T', permission: 'technicians.read' },
  { id: 'bookings', label: 'Bookings', icon: 'B', permission: 'bookings.read' },
  { id: 'managedCollections', label: 'Managed Collection', icon: 'M', permission: 'bookings.read' },
  { id: 'collectionOperations', label: 'Collection Operations', icon: 'C', permission: 'bookings.read' },
  { id: 'notifications', label: 'Notifications', icon: 'N', permission: 'bookings.read' },
  { id: 'subscriptions', label: 'Subscriptions', icon: 'R', permission: 'finance.read' },
  { id: 'quotes', label: 'Quotes', icon: 'Q', permission: 'bookings.read' },
  { id: 'invoices', label: 'Invoices', icon: '$', permission: 'finance.read' },
  { id: 'settlements', label: 'Settlements', icon: 'P', permission: 'finance.read' },
  { id: 'promotions', label: 'Promotions', icon: '%', permission: 'finance.read' },
  { id: 'ledger', label: 'Wallet Ledger', icon: 'L', permission: 'finance.read' },
  { id: 'adminUsers', label: 'Users', icon: 'A', permission: 'admins.read' },
  { id: 'services', label: 'Services', icon: 'S', permission: 'markets.read' },
  { id: 'settings', label: 'Markets', icon: 'S', permission: 'markets.read' },
  { id: 'auditLogs', label: 'Audit Logs', icon: 'H', permission: 'admins.read' },
];

const app = document.getElementById('app');

const rolePermissions = {
  SUPER_ADMIN: ['*'],
  OPERATIONS_MANAGER: ['overview.read', 'bookings.read', 'bookings.update', 'technicians.read', 'clients.contact.read', 'settings.read'],
  DISPATCHER: ['overview.read', 'bookings.read', 'bookings.update'],
  FINANCE_ADMIN: ['overview.read', 'finance.read', 'promotions.read', 'promotions.create', 'promotions.update', 'promotions.activate', 'promotions.pause', 'promotions.archive', 'promotions.performance.read', 'promotions.redemptions.read', 'settings.read'],
  SUPPORT_AGENT: ['overview.read', 'bookings.read', 'technicians.read', 'clients.contact.read'],
  TECHNICIAN_REVIEWER: ['overview.read', 'technicians.read', 'technicians.review'],
  MARKET_MANAGER: ['overview.read', 'markets.read', 'markets.update', 'settings.read'],
  READ_ONLY_ADMIN: ['overview.read', 'bookings.read', 'technicians.read', 'finance.read', 'promotions.read', 'markets.read', 'admins.read', 'settings.read'],
};

const SERVICE_ACTIVATION_PERMISSION = 'markets.services.activate';
const CLIENT_CONTACT_PERMISSION = 'clients.contact.read';
const CLIENT_CONTACT_REVEAL_SECONDS = 15;
const IDLE_TIMEOUT_MS = 8 * 60 * 1000;
const IDLE_WARNING_MS = 60 * 1000;
const API_HEALTH_INTERVAL_MS = 60 * 1000;
const API_HEALTH_SLOW_MS = 1500;
const API_HEALTH_TIMEOUT_MS = 5000;
const DEFAULT_TOP_LEVEL_SERVICE_GROUPS = [
  { groupKey: 'home_services', label: 'Home Services', displayOrder: 10 },
  { groupKey: 'auto_services', label: 'Auto Services', displayOrder: 20 },
  { groupKey: 'business_services', label: 'Business Services', displayOrder: 30 },
];
const DEFAULT_HOME_SERVICE_CATEGORIES = [
  { serviceKey: 'appliance_repair', label: 'Appliance Repair', displayOrder: 10 },
  { serviceKey: 'cleaning', label: 'Cleaning Service', displayOrder: 20 },
  { serviceKey: 'electrical', label: 'Electrical Repair', displayOrder: 30 },
  { serviceKey: 'gardening', label: 'Gardening Service', displayOrder: 40 },
  { serviceKey: 'maintenance', label: 'Maintenance Service', displayOrder: 50 },
  { serviceKey: 'painting', label: 'Painting Service', displayOrder: 60 },
  { serviceKey: 'plumbing', label: 'Plumbing', displayOrder: 70 },
];
let idleWarningTimer = null;
let idleLogoutTimer = null;
let clockTimer = null;
let apiHealthTimer = null;

const FALLBACK_COUNTRIES = [
  ['ZA', 'South Africa'], ['GH', 'Ghana'], ['NG', 'Nigeria'], ['KE', 'Kenya'], ['UG', 'Uganda'], ['TZ', 'Tanzania'], ['RW', 'Rwanda'],
  ['US', 'United States'], ['GB', 'United Kingdom'], ['CA', 'Canada'], ['AU', 'Australia'], ['NZ', 'New Zealand'], ['IE', 'Ireland'],
  ['BW', 'Botswana'], ['NA', 'Namibia'], ['ZW', 'Zimbabwe'], ['MW', 'Malawi'], ['MZ', 'Mozambique'], ['AO', 'Angola'], ['CD', 'Congo - Kinshasa'],
  ['ET', 'Ethiopia'], ['EG', 'Egypt'], ['MA', 'Morocco'], ['CI', "Cote d'Ivoire"], ['SN', 'Senegal'], ['IN', 'India'], ['AE', 'United Arab Emirates'],
];
const COUNTRY_METADATA = [
  { code: 'ZA', name: 'South Africa', currency: 'ZAR', locale: 'en-ZA', timezones: ['Africa/Johannesburg'] },
  { code: 'GH', name: 'Ghana', currency: 'GHS', locale: 'en-GH', timezones: ['Africa/Accra'] },
  { code: 'NG', name: 'Nigeria', currency: 'NGN', locale: 'en-NG', timezones: ['Africa/Lagos'] },
  { code: 'KE', name: 'Kenya', currency: 'KES', locale: 'en-KE', timezones: ['Africa/Nairobi'] },
  { code: 'UG', name: 'Uganda', currency: 'UGX', locale: 'en-UG', timezones: ['Africa/Kampala'] },
  { code: 'TZ', name: 'Tanzania', currency: 'TZS', locale: 'en-TZ', timezones: ['Africa/Dar_es_Salaam'] },
  { code: 'RW', name: 'Rwanda', currency: 'RWF', locale: 'en-RW', timezones: ['Africa/Kigali'] },
  { code: 'ZM', name: 'Zambia', currency: 'ZMW', locale: 'en-ZM', timezones: ['Africa/Lusaka'] },
  { code: 'US', name: 'United States', currency: 'USD', locale: 'en-US', timezones: ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu'] },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', locale: 'en-GB', timezones: ['Europe/London'] },
  { code: 'CA', name: 'Canada', currency: 'CAD', locale: 'en-CA', timezones: ['America/Toronto', 'America/Winnipeg', 'America/Edmonton', 'America/Vancouver', 'America/Halifax', 'America/St_Johns'] },
  { code: 'AU', name: 'Australia', currency: 'AUD', locale: 'en-AU', timezones: ['Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane', 'Australia/Adelaide', 'Australia/Perth', 'Australia/Darwin', 'Australia/Hobart'] },
  { code: 'NZ', name: 'New Zealand', currency: 'NZD', locale: 'en-NZ', timezones: ['Pacific/Auckland', 'Pacific/Chatham'] },
  { code: 'IE', name: 'Ireland', currency: 'EUR', locale: 'en-IE', timezones: ['Europe/Dublin'] },
  { code: 'BW', name: 'Botswana', currency: 'BWP', locale: 'en-BW', timezones: ['Africa/Gaborone'] },
  { code: 'NA', name: 'Namibia', currency: 'NAD', locale: 'en-NA', timezones: ['Africa/Windhoek'] },
  { code: 'ZW', name: 'Zimbabwe', currency: 'ZWL', locale: 'en-ZW', timezones: ['Africa/Harare'] },
  { code: 'MW', name: 'Malawi', currency: 'MWK', locale: 'en-MW', timezones: ['Africa/Blantyre'] },
  { code: 'MZ', name: 'Mozambique', currency: 'MZN', locale: 'pt-MZ', timezones: ['Africa/Maputo'] },
  { code: 'AO', name: 'Angola', currency: 'AOA', locale: 'pt-AO', timezones: ['Africa/Luanda'] },
  { code: 'CD', name: 'Congo - Kinshasa', currency: 'CDF', locale: 'fr-CD', timezones: ['Africa/Kinshasa', 'Africa/Lubumbashi'] },
  { code: 'ET', name: 'Ethiopia', currency: 'ETB', locale: 'en-ET', timezones: ['Africa/Addis_Ababa'] },
  { code: 'EG', name: 'Egypt', currency: 'EGP', locale: 'ar-EG', timezones: ['Africa/Cairo'] },
  { code: 'MA', name: 'Morocco', currency: 'MAD', locale: 'fr-MA', timezones: ['Africa/Casablanca'] },
  { code: 'CI', name: "Cote d'Ivoire", currency: 'XOF', locale: 'fr-CI', timezones: ['Africa/Abidjan'] },
  { code: 'SN', name: 'Senegal', currency: 'XOF', locale: 'fr-SN', timezones: ['Africa/Dakar'] },
  { code: 'IN', name: 'India', currency: 'INR', locale: 'en-IN', timezones: ['Asia/Kolkata'] },
  { code: 'AE', name: 'United Arab Emirates', currency: 'AED', locale: 'en-AE', timezones: ['Asia/Dubai'] },
];
const TIMEZONE_ALIASES = {
  SAST: 'Africa/Johannesburg',
  'GMT+2': 'Africa/Johannesburg',
  'UTC+2': 'Africa/Johannesburg',
  'South Africa Standard Time': 'Africa/Johannesburg',
  'Africa/Pretoria': 'Africa/Johannesburg',
};

function hasPermission(permission) {
  if (!permission) return true;
  const adminRole = state.user?.adminRole || 'READ_ONLY_ADMIN';
  const permissions = new Set([...(rolePermissions[adminRole] || []), ...(state.user?.adminPermissions || [])]);
  return permissions.has('*') || permissions.has(permission);
}

function visibleViews() {
  return views.filter((view) => hasPermission(view.permission));
}

function canMutate(permission) {
  return hasPermission(permission) && state.user?.adminRole !== 'READ_ONLY_ADMIN';
}

function queryStringFrom(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim()) {
      search.set(key, String(value).trim());
    }
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatMoney(amount, currency = '') {
  if (typeof amount !== 'number') return '-';
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function getCountryOptions() {
  const source = FALLBACK_COUNTRIES;
  const knownMarkets = new Map([
    ...state.data.markets.map((market) => {
      const view = getMarketView(market);
      return [view.countryCode, { name: view.countryName || view.countryCode, currency: view.currency || '' }];
    }),
    ...state.data.marketMeta.availableMarkets.map((market) => {
      const view = getMarketView(market);
      const countryCode = view.countryCode || market.countryCode || '';
      return [countryCode, { name: view.countryName || market.countryName || countryCode, currency: view.currency || market.currency || '' }];
    }),
  ]);

  return source
    .map(([code, name]) => ({
      code,
      name: knownMarkets.get(code)?.name || name,
      currency: knownMarkets.get(code)?.currency || '',
      supported: knownMarkets.has(code),
      label: `${knownMarkets.get(code)?.name || name} (${code})${knownMarkets.has(code) ? '' : ' - not configured'}`,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function countryMetadataList() {
  const byCode = new Map(COUNTRY_METADATA.map((country) => [country.code, { ...country, timezones: [...country.timezones] }]));

  (state.data.marketMeta.availableMarkets || []).forEach((market) => {
    const view = getMarketView(market);
    const code = normalizeMarketCountryCode(view.countryCode || market.countryCode);
    if (!code) return;
    const existing = byCode.get(code) || { code, name: view.countryName || code, currency: view.currency || '', locale: view.locale || `en-${code}`, timezones: [] };
    byCode.set(code, {
      ...existing,
      name: view.countryName || existing.name,
      currency: view.currency || existing.currency,
      locale: view.locale || existing.locale,
      timezones: existing.timezones.length ? existing.timezones : (view.timezone ? [view.timezone] : []),
    });
  });

  return Array.from(byCode.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function findCountryMetadata(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  return countryMetadataList().find((country) =>
    country.code.toLowerCase() === normalized ||
    country.name.toLowerCase() === normalized ||
    `${country.name} (${country.code})`.toLowerCase() === normalized
  ) || null;
}

function canonicalTimezoneForCountry(value, countryCode = '') {
  const timezone = String(value || '').trim();
  if (!timezone) return '';
  const alias = TIMEZONE_ALIASES[timezone] || TIMEZONE_ALIASES[timezone.toUpperCase()];
  if (alias) return alias;
  if (countryCode === 'ZA' && /^africa\/(pretoria|johannesburg)$/i.test(timezone)) return 'Africa/Johannesburg';
  return timezone;
}

function timezoneOptionsForCountry(country, selectedTimezone = '') {
  const selected = canonicalTimezoneForCountry(selectedTimezone, country?.code || '');
  const options = [...(country?.timezones || [])];
  if (selected && isValidIanaTimezone(selected) && !options.includes(selected)) options.unshift(selected);
  return {
    selected: options.includes(selected) ? selected : options[0] || selected,
    options,
  };
}

function renderCountryOptions(selected = '') {
  return getCountryOptions()
    .map((country) => `<option value="${escapeHtml(country.code)}" data-currency="${escapeHtml(country.currency || '')}" ${country.code === selected ? 'selected' : ''}>${escapeHtml(country.label)}</option>`)
    .join('');
}

function moneyFromMinor(minor, currency = 'ZAR') {
  if (typeof minor !== 'number') return '-';
  return formatMoney(minor / 100, currency);
}

function getMoney(record, decimalField, minorField, currency = 'ZAR') {
  if (typeof record?.[decimalField] === 'number') {
    return formatMoney(record[decimalField], currency);
  }

  if (typeof record?.[minorField] === 'number') {
    return moneyFromMinor(record[minorField], currency);
  }

  return '-';
}

function getMarketView(market = {}) {
  return {
    countryCode: market.identity?.countryCode || market.countryCode || '',
    countryName: market.identity?.countryName || market.countryName || '',
    currency: market.identity?.currency || market.currency || '',
    locale: market.identity?.locale || market.locale || '',
    timezone: market.identity?.timezone || market.timezone || '',
    status: market.identity?.status || market.status || 'DRAFT',
    defaultCalloutFee: typeof market.pricing?.defaultCalloutFeeMinor === 'number'
      ? market.pricing.defaultCalloutFeeMinor / 100
      : typeof market.pricing?.defaultCalloutFee === 'number'
        ? market.pricing.defaultCalloutFee
      : market.defaultCalloutFee || 0,
    platformCommissionBps: market.pricing?.platformCommissionBps ?? market.platformCommissionBps ?? 0,
    taxLabel: market.pricing?.taxLabel || market.taxLabel || '',
    taxRateBps: market.pricing?.taxRateBps ?? 0,
    taxInclusive: market.pricing?.taxInclusive === true,
    clientServiceFeeType: market.pricing?.clientServiceFeeType || 'NONE',
    clientServiceFeeBps: market.pricing?.clientServiceFeeBps ?? 0,
    clientServiceFeeMinor: market.pricing?.clientServiceFeeMinor ?? 0,
    taxableCallout: market.pricing?.taxableCallout !== false,
    taxableLabour: market.pricing?.taxableLabour !== false,
    taxableParts: market.pricing?.taxableParts !== false,
    taxableAdditionalServices: market.pricing?.taxableAdditionalServices !== false,
    taxableClientServiceFee: market.pricing?.taxableClientServiceFee !== false,
    discountsReduceTaxableValue: market.pricing?.discountsReduceTaxableValue !== false,
    serviceCategories: market.coverage?.serviceCategories || market.serviceCategories || [],
    supportedCities: market.coverage?.supportedCities || market.supportedCities || [],
    cityServiceAvailability: market.coverage?.cityServiceAvailability || market.cityServiceAvailability || [],
    paymentProviders: market.payments?.paymentProviders || market.paymentProviders || [],
    providerSettings: market.payments?.providerSettings || market.paymentProviderSettings || [],
    supportEmail: market.support?.email || market.supportEmail || '',
    supportPhone: market.support?.phone || market.supportPhone || '',
    supportWhatsapp: market.support?.whatsapp || market.supportWhatsapp || '',
    supportEscalationEmail: market.support?.escalationEmail || market.supportEscalationEmail || '',
    hasCustomSettings: market.hasCustomSettings,
  };
}

function serviceKeyFrom(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function serviceGroupIconKey(groupKey = '', label = '') {
  const text = `${groupKey || ''} ${label || ''}`.toLowerCase();
  if (/(auto|car|vehicle|mechanic)/.test(text)) return 'auto';
  if (/(business|office|company|commercial)/.test(text)) return 'business';
  if (/(it|tech|computer|laptop|software|support)/.test(text)) return 'it';
  if (/(health|care|medical|nurse|doctor)/.test(text)) return 'health';
  if (/(rent|rental|lease|property|key)/.test(text)) return 'rent';
  if (/(home|house|clean|plumb|paint|garden|maintenance|appliance)/.test(text)) return 'home';
  return 'service';
}

function serviceGroupIconPath(iconKey) {
  const paths = {
    auto: '<path d="M5 13l2-5h10l2 5" /><path d="M7 17h10" /><path d="M6 13h12v5H6z" /><path d="M8 18v2" /><path d="M16 18v2" />',
    business: '<path d="M8 7V5h8v2" /><path d="M5 8h14v11H5z" /><path d="M9 12h6" />',
    health: '<path d="M12 20s-7-4.5-7-10a4 4 0 017-2 4 4 0 017 2c0 5.5-7 10-7 10z" /><path d="M12 9v6" /><path d="M9 12h6" />',
    home: '<path d="M4 11l8-7 8 7" /><path d="M6 10v10h12V10" /><path d="M10 20v-6h4v6" />',
    it: '<path d="M5 5h14v10H5z" /><path d="M9 19h6" /><path d="M12 15v4" />',
    rent: '<path d="M8 11a4 4 0 118 0 4 4 0 01-8 0z" /><path d="M12 15v6" /><path d="M12 18h4" />',
    service: '<path d="M14 7l3 3-7 7H7v-3z" /><path d="M5 19h14" />',
  };
  return paths[iconKey] || paths.service;
}

function renderServiceGroupIcon(group) {
  const iconKey = serviceGroupIconKey(group?.groupIconKey || group?.groupKey, group?.label);
  return `
    <span class="service-top-level-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
        ${serviceGroupIconPath(iconKey)}
      </svg>
    </span>
  `;
}

function labelFromServiceKey(serviceKey) {
  return String(serviceKey || '')
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatTechnicianServices(services = []) {
  const labels = normalizeServiceEntries(services)
    .map((service) => service.label || labelFromServiceKey(service.serviceKey))
    .filter(Boolean);
  return labels.length ? labels.join(', ') : 'No service selected';
}

function technicianServiceSelections(services = []) {
  const selectedKeys = normalizeServiceEntries(services)
    .map((service) => serviceKeyFrom(service.serviceKey || service.key || service.label))
    .filter(Boolean);
  if (!selectedKeys.length) return [];

  const serviceCatalog = state.data.serviceCatalog || [];
  const groupsByKey = new Map(serviceGroupsFromCatalog().map((group) => [group.groupKey, group]));
  const rowsByKey = new Map();

  serviceCatalog.forEach((service) => {
    const serviceKey = serviceKeyFrom(service.serviceKey || '');
    if (!serviceKey) return;
    rowsByKey.set(serviceKey, service);
  });

  return selectedKeys.map((serviceKey) => {
    const record = rowsByKey.get(serviceKey);
    const groupKey = serviceKeyFrom(record?.groupKey || '');
    const group = groupKey ? groupsByKey.get(groupKey) : null;
    const bookableCount = Array.isArray(record?.subcategories) ? record.subcategories.length : 0;
    return {
      serviceKey,
      label: record?.label || labelFromServiceKey(serviceKey),
      status: record?.status || 'REQUESTED',
      groupKey,
      groupLabel: record?.groupLabel || group?.label || 'Selected Services',
      bookableCount,
    };
  }).sort((a, b) => a.groupLabel.localeCompare(b.groupLabel) || a.label.localeCompare(b.label));
}

function renderTechnicianServiceSelections(services = []) {
  const selections = technicianServiceSelections(services);
  if (!selections.length) {
    return '<div class="technician-service-empty">No service categories selected during signup.</div>';
  }

  const groups = selections.reduce((map, item) => {
    const key = item.groupKey || item.groupLabel;
    if (!map.has(key)) map.set(key, { label: item.groupLabel, items: [] });
    map.get(key).items.push(item);
    return map;
  }, new Map());

  return `
    <div class="technician-service-review" aria-label="Selected service categories">
      ${Array.from(groups.values()).map((group) => `
        <div class="technician-service-group">
          <div class="technician-service-group-header">
            <strong>${escapeHtml(group.label)}</strong>
            <span>${group.items.length} selected</span>
          </div>
          <div class="technician-service-list">
            ${group.items.map((item) => `
              <span class="technician-service-pill">
                <em>${escapeHtml(item.label)}</em>
                <small>${item.bookableCount ? `${item.bookableCount} bookable ${item.bookableCount === 1 ? 'service' : 'services'}` : escapeHtml(item.status)}</small>
              </span>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function formatYearsExperience(years) {
  const value = Number(years);
  if (!Number.isFinite(value) || value <= 0) return 'No experience set';
  return `${value} ${value === 1 ? 'year' : 'years'} experience`;
}

function formatServiceRadius(radiusKm) {
  const value = Number(radiusKm);
  if (!Number.isFinite(value) || value <= 0) return 'No radius set';
  return `${value} km radius`;
}

function formatMaskedId(last4) {
  const value = String(last4 || '').trim();
  return value ? `**** ${value}` : 'Not provided';
}

function normalizeServiceEntry(entry) {
  if (typeof entry === 'string') {
    const serviceKey = serviceKeyFrom(entry);
    return serviceKey ? { serviceKey, label: labelFromServiceKey(serviceKey), status: 'ACTIVE' } : null;
  }

  const serviceKey = serviceKeyFrom(entry?.serviceKey || entry?.key || entry?.label);
  if (!serviceKey) return null;
  return {
    serviceKey,
    label: String(entry?.label || labelFromServiceKey(serviceKey)),
    status: String(entry?.status || 'ACTIVE'),
  };
}

function normalizeServiceEntries(services = [], fallback = []) {
  const source = Array.isArray(services) && services.length ? services : fallback;
  return source.map(normalizeServiceEntry).filter(Boolean);
}

function formatServiceList(services = []) {
  return normalizeServiceEntries(services)
    .map((service) => `${service.serviceKey}:${service.status}`)
    .join(', ');
}

function countStatuses(items = []) {
  return items.reduce((counts, item) => {
    const status = String(item?.status || 'ACTIVE').toUpperCase();
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});
}

function statusSummaryPills(counts = {}) {
  const statuses = ['ACTIVE', 'COMING_SOON', 'PAUSED', 'DISABLED'];
  return statuses
    .filter((status) => counts[status])
    .map((status) => `<span class="status ${statusClass(status)}">${status.replace('_', ' ')} ${counts[status]}</span>`)
    .join('');
}

function marketStatusSummary(marketView) {
  const cityRows = Array.isArray(marketView.cityServiceAvailability) ? marketView.cityServiceAvailability : [];
  const countryServices = normalizeServiceEntries(marketView.serviceCategories || state.data.marketMeta.defaultServiceCategories || []);
  const cityServices = cityRows.flatMap((row) => normalizeServiceEntries(row.services || []));
  const areas = cityRows.flatMap((row) => Array.isArray(row.areas) ? row.areas : []);
  const areaServices = areas.flatMap((area) => normalizeServiceEntries(area.services || []));
  const serviceCounts = countStatuses([...countryServices, ...cityServices, ...areaServices]);
  const cityCounts = countStatuses(cityRows);
  const areaCounts = countStatuses(areas);

  return `
    <div class="market-summary-grid">
      <div>
        <span>Country</span>
        <strong class="status ${statusClass(marketView.status)}">${escapeHtml(String(marketView.status || 'DISABLED').replace('_', ' '))}</strong>
      </div>
      <div>
        <span>Services</span>
        <div class="status-chip-row">${statusSummaryPills(serviceCounts) || '<span class="status info">No services</span>'}</div>
      </div>
      <div>
        <span>Cities</span>
        <div class="status-chip-row">${statusSummaryPills(cityCounts) || '<span class="status info">No cities</span>'}</div>
      </div>
      <div>
        <span>Areas</span>
        <div class="status-chip-row">${statusSummaryPills(areaCounts) || '<span class="status info">No areas</span>'}</div>
      </div>
    </div>
  `;
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function statusClass(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized.includes('active') || normalized.includes('approved') || normalized.includes('paid') || normalized.includes('completed')) return 'good';
  if (normalized.includes('reject') || normalized.includes('fail') || normalized.includes('suspend') || normalized.includes('cancel') || normalized.includes('disabled')) return 'bad';
  if (normalized.includes('pending') || normalized.includes('unpaid') || normalized.includes('review') || normalized.includes('soon') || normalized.includes('paused')) return 'warn';
  return 'info';
}

function apiHealthStatusClass() {
  if (state.apiHealth.status === 'connected') return 'good';
  if (state.apiHealth.status === 'slow') return 'warn';
  if (state.apiHealth.status === 'unreachable') return 'bad';
  return 'info';
}

function apiHealthLabel() {
  const health = state.apiHealth || {};
  const environment = health.environment || resolveApiEnvironment();
  const response = typeof health.responseMs === 'number' ? ` (${health.responseMs}ms)` : '';
  return health.status === 'unreachable'
    ? `${environment} API Unreachable`
    : health.status === 'slow'
      ? `${environment} API Slow${response}`
      : health.status === 'connected'
        ? `${environment} API Connected${response}`
        : `${environment} API Checking`;
}

function renderApiHealthBadge() {
  const health = state.apiHealth || {};
  const label = apiHealthLabel();
  const title = health.message || label;
  return `<span id="api-health-badge" class="status ${apiHealthStatusClass()}" title="${escapeHtml(title)}">${escapeHtml(label)}</span>`;
}

function updateTopbarIndicators() {
  const clock = document.getElementById('topbar-clock');
  if (clock) clock.textContent = state.currentTime || '';

  const badge = document.getElementById('api-health-badge');
  if (badge) {
    const label = apiHealthLabel();
    badge.className = `status ${apiHealthStatusClass()}`;
    badge.textContent = label;
    badge.title = state.apiHealth.message || label;
  }
}

async function checkApiHealth({ shouldRender = true } = {}) {
  const healthUrl = resolveApiHealthUrl();
  const startedAt = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_HEALTH_TIMEOUT_MS);

  try {
    const response = await fetch(healthUrl, {
      cache: 'no-store',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    const responseMs = Math.round(performance.now() - startedAt);

    state.apiHealth = {
      status: response.ok && responseMs <= API_HEALTH_SLOW_MS ? 'connected' : response.ok ? 'slow' : 'unreachable',
      environment: resolveApiEnvironment(),
      responseMs,
      checkedAt: new Date().toISOString(),
      message: response.ok
        ? `Health check passed in ${responseMs}ms at ${healthUrl}`
        : `Health check failed with HTTP ${response.status} at ${healthUrl}`,
    };
  } catch (error) {
    state.apiHealth = {
      status: 'unreachable',
      environment: resolveApiEnvironment(),
      responseMs: null,
      checkedAt: new Date().toISOString(),
      message: error?.name === 'AbortError'
        ? `Health check timed out after ${API_HEALTH_TIMEOUT_MS}ms at ${healthUrl}`
        : `Health check could not reach ${healthUrl}`,
    };
  } finally {
    clearTimeout(timeout);
  }

  if (shouldRender && state.token) updateTopbarIndicators();
}

function startApiHealthTimer() {
  if (apiHealthTimer) return;
  void checkApiHealth();
  apiHealthTimer = setInterval(() => {
    void checkApiHealth();
  }, API_HEALTH_INTERVAL_MS);
}

function stopApiHealthTimer() {
  if (!apiHealthTimer) return;
  clearInterval(apiHealthTimer);
  apiHealthTimer = null;
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {}),
    },
  });

  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      state.error = body?.message || 'Your session is no longer authorized for this action.';
      if (response.status === 401) logout();
    }
    throw new Error(body?.message || body?.error || `Request failed with ${response.status}`);
  }

  return body;
}

async function login(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const email = String(form.get('email') || '').trim();
  const password = String(form.get('password') || '');
  const errorBox = document.querySelector('[data-login-error]');

  try {
    state.loading = true;
    errorBox.textContent = '';
    const result = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (String(result.user?.role || '').toUpperCase() !== 'ADMIN') {
      state.token = '';
      state.user = null;
      localStorage.removeItem('myfixer_admin_token');
      localStorage.removeItem('myfixer_admin_user');
      throw new Error('This account is not an internal admin account.');
    }

    state.token = result.token;
    state.user = result.user;
    localStorage.setItem('myfixer_admin_token', result.token);
    localStorage.setItem('myfixer_admin_user', JSON.stringify(result.user));
    if (result.user?.mustChangePassword) {
      state.authView = 'changePassword';
      render();
      return;
    }
    await loadAllData();
    resetIdleTimer();
    render();
  } catch (error) {
    errorBox.textContent = error.message;
  } finally {
    state.loading = false;
  }
}

async function forgotPassword(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const email = String(form.get('email') || '').trim();
  const messageBox = document.querySelector('[data-auth-message]');
  const errorBox = document.querySelector('[data-login-error]');

  try {
    state.loading = true;
    if (messageBox) messageBox.textContent = '';
    if (errorBox) errorBox.textContent = '';
    const result = await api('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    state.authMessage = result.message || 'If this email exists, reset instructions have been sent.';
    if (messageBox) messageBox.textContent = state.authMessage;
  } catch (error) {
    if (errorBox) errorBox.textContent = error.message;
  } finally {
    state.loading = false;
  }
}

async function resetPassword(event) {
  event.preventDefault();
  const params = new URLSearchParams(window.location.search);
  const form = new FormData(event.currentTarget);
  const email = String(form.get('email') || params.get('email') || '').trim();
  const token = String(form.get('token') || params.get('resetToken') || '');
  const password = String(form.get('password') || '');
  const confirmPassword = String(form.get('confirmPassword') || '');
  const messageBox = document.querySelector('[data-auth-message]');
  const errorBox = document.querySelector('[data-login-error]');

  if (password !== confirmPassword) {
    if (errorBox) errorBox.textContent = 'Passwords do not match.';
    return;
  }

  try {
    state.loading = true;
    if (messageBox) messageBox.textContent = '';
    if (errorBox) errorBox.textContent = '';
    const result = await api('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, token, password }),
    });
    state.authMessage = result.message || 'Password reset complete. You can now sign in.';
    if (messageBox) messageBox.textContent = state.authMessage;
    state.authView = 'login';
    window.history.replaceState({}, document.title, window.location.pathname);
    render();
  } catch (error) {
    if (errorBox) errorBox.textContent = error.message;
  } finally {
    state.loading = false;
  }
}

async function changePassword(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const currentPassword = String(form.get('currentPassword') || '');
  const newPassword = String(form.get('newPassword') || '');
  const confirmPassword = String(form.get('confirmPassword') || '');
  const errorBox = document.querySelector('[data-login-error]');

  if (newPassword !== confirmPassword) {
    if (errorBox) errorBox.textContent = 'New passwords do not match.';
    return;
  }

  try {
    state.loading = true;
    if (errorBox) errorBox.textContent = '';
    const result = await api('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword, forced: true }),
    });
    state.token = result.token;
    state.user = result.user;
    state.authView = 'login';
    localStorage.setItem('myfixer_admin_token', result.token);
    localStorage.setItem('myfixer_admin_user', JSON.stringify(result.user));
    await loadAllData();
    resetIdleTimer();
    render();
  } catch (error) {
    if (errorBox) errorBox.textContent = error.message;
  } finally {
    state.loading = false;
  }
}

function logout() {
  state.token = '';
  state.user = null;
  state.idleWarning = '';
  state.revealedClientContacts = {};
  Object.values(state.revealTimers || {}).forEach((timer) => clearTimeout(timer));
  state.revealTimers = {};
  localStorage.removeItem('myfixer_admin_token');
  localStorage.removeItem('myfixer_admin_user');
  clearIdleTimers();
  stopClockTimer();
  stopApiHealthTimer();
  render();
}

async function loadAllData() {
  state.loading = true;
  state.error = '';

  try {
    const requests = {
      overview: hasPermission('overview.read') ? api('/admin/overview') : Promise.resolve({ overview: null }),
      clients: hasPermission('overview.read')
        ? api('/admin/clients?limit=200').catch(() => ({ clients: [] }))
        : Promise.resolve({ clients: [] }),
      technicians: hasPermission('technicians.read') ? api('/admin/technicians') : Promise.resolve({ technicians: [] }),
      bookings: hasPermission('bookings.read') ? api('/admin/bookings?limit=100') : Promise.resolve({ bookings: [] }),
      managedCollections: hasPermission('bookings.read') ? api('/admin/managed-collections') : Promise.resolve({ profiles: [], reminders: [] }),
      collectionOperations: hasPermission('bookings.read') ? api(`/admin/collection-operations${queryStringFrom(state.collectionOperationFilters)}`) : Promise.resolve({ jobs: [], metrics: {}, calendar: {}, meta: {} }),
      notifications: hasPermission('bookings.read') ? api(`/admin/notifications${queryStringFrom(state.notificationFilters)}`) : Promise.resolve({ notifications: [], counts: [], meta: {} }),
      subscriptions: hasPermission('finance.read') ? api('/admin/managed-collection-subscriptions') : Promise.resolve({ plans: [], subscriptions: [], invoices: [], reports: {}, meta: {} }),
      quotes: hasPermission('bookings.read') ? api('/admin/quotes?limit=100') : Promise.resolve({ quotes: [] }),
      invoices: hasPermission('finance.read') ? api('/admin/invoices?limit=100') : Promise.resolve({ invoices: [] }),
      settlements: hasPermission('finance.read') ? api('/admin/settlements') : Promise.resolve({ settlements: [] }),
      promotions: hasPermission('promotions.read') ? api('/admin/promotions') : Promise.resolve({ promotions: [], discountTypes: [], statuses: [] }),
      promotionSummary: hasPermission('promotions.performance.read') ? api('/admin/promotions/summary') : Promise.resolve({ summary: null }),
      ledger: hasPermission('finance.read') ? api('/admin/wallet-transactions?limit=100') : Promise.resolve({ transactions: [] }),
      markets: hasPermission('markets.read') ? api('/admin/markets') : Promise.resolve({ markets: [], availableStatuses: [], availablePaymentProviders: [], defaultServiceCategories: [], availableMarkets: [] }),
      services: hasPermission('markets.read') ? api('/admin/services') : Promise.resolve({ services: [], statuses: [] }),
      adminUsers: hasPermission('admins.read') ? api('/admin/users') : Promise.resolve({ admins: [], roles: [], permissionsByRole: {} }),
      auditLogs: hasPermission('admins.read') ? api('/admin/audit-logs?limit=100') : Promise.resolve({ logs: [] }),
    };

    const [overview, clients, technicians, bookings, managedCollections, collectionOperations, notifications, subscriptions, quotes, invoices, settlements, promotions, promotionSummary, ledger, markets, services, adminUsers, auditLogs] = await Promise.all(Object.values(requests));

    state.data.overview = overview.overview;
    state.data.clients = clients.clients || [];
    state.data.clientsContactAccess = hasPermission(CLIENT_CONTACT_PERMISSION);
    state.data.technicians = technicians.technicians || [];
    state.data.bookings = bookings.bookings || [];
    state.data.managedCollections = managedCollections.profiles || [];
    state.data.managedCollectionReminders = managedCollections.reminders || [];
    state.data.collectionOperations = {
      jobs: collectionOperations.jobs || [],
      metrics: collectionOperations.metrics || {},
      calendar: collectionOperations.calendar || {},
      meta: collectionOperations.meta || {},
    };
    state.data.notifications = notifications.notifications || [];
    state.data.notificationCounts = notifications.counts || [];
    state.data.notificationMeta = {
      statuses: notifications.meta?.statuses || [],
      channels: notifications.meta?.channels || [],
      enabledChannels: notifications.meta?.enabledChannels || [],
      disabledChannels: notifications.meta?.disabledChannels || [],
      types: notifications.meta?.types || [],
    };
    state.data.managedCollectionSubscriptions = {
      plans: subscriptions.plans || [],
      subscriptions: subscriptions.subscriptions || [],
      invoices: subscriptions.invoices || [],
      reports: subscriptions.reports || {},
      meta: subscriptions.meta || {},
    };
    state.data.quotes = quotes.quotes || [];
    state.data.invoices = invoices.invoices || [];
    state.data.settlements = settlements.settlements || [];
    state.data.promotions = promotions.promotions || [];
    state.data.promotionSummary = promotionSummary.summary || null;
    state.data.promotionMeta = {
      discountTypes: promotions.discountTypes || [],
      statuses: promotions.statuses || [],
      triggerTypes: promotions.triggerTypes || [],
      fundingSources: promotions.fundingSources || [],
      stackingPolicies: promotions.stackingPolicies || [],
    };
    state.data.ledger = ledger.transactions || [];
    state.data.markets = markets.markets || [];
    state.data.serviceCatalog = services.services || [];
    state.data.marketMeta = {
      availableStatuses: markets.availableStatuses || [],
    availablePaymentProviders: markets.availablePaymentProviders || [],
    defaultServiceCategories: markets.defaultServiceCategories || [],
    serviceDefinitions: markets.serviceDefinitions || [],
    availableMarkets: markets.availableMarkets || [],
  };
    state.data.adminUsers = adminUsers.admins || [];
    state.data.adminMeta = {
      roles: adminUsers.roles || [],
      permissionsByRole: adminUsers.permissionsByRole || {},
    };
    state.data.auditLogs = auditLogs.logs || [];

    const allowedViews = visibleViews();
    if (!allowedViews.some((view) => view.id === state.activeView)) {
      state.activeView = allowedViews[0]?.id || 'overview';
    }
  } finally {
    state.loading = false;
  }
}

async function refresh() {
  const button = document.querySelector('[data-refresh]');
  if (button) button.textContent = 'Refreshing...';
  try {
    await checkApiHealth({ shouldRender: false });
    await loadAllData();
    render();
  } catch (error) {
    alert(error.message);
  }
}

async function reviewTechnician(id, status) {
  if (!canMutate('technicians.review')) {
    alert('You do not have permission to review technicians.');
    return;
  }
  if (!confirm(`Confirm technician status change to ${status}?`)) return;
  const rejectionReason = status === 'REJECTED' ? prompt('Reason for rejection?') || '' : '';
  try {
    await api(`/admin/technicians/${id}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ status, rejectionReason }),
    });
    await refresh();
  } catch (error) {
    alert(error.message);
  }
}

async function reviewTechnicianProfilePhoto(id, status) {
  if (!canMutate('technicians.review')) {
    alert('You do not have permission to review technician photos.');
    return;
  }
  const rejectionReason = status === 'REJECTED' ? prompt('Reason for photo rejection?') || '' : '';
  if (!confirm(`Confirm technician profile photo status change to ${status}?`)) return;
  try {
    await api(`/admin/technicians/${id}/profile-photo`, {
      method: 'PATCH',
      body: JSON.stringify({ status, rejectionReason }),
    });
    await refresh();
  } catch (error) {
    alert(error.message);
  }
}

async function openBooking(id) {
  try {
    const result = await api(`/admin/bookings/${id}`);
    state.selectedBooking = result;
    render();
  } catch (error) {
    alert(error.message);
  }
}

async function createAdminUser(event) {
  event.preventDefault();
  if (!canMutate('admins.create')) {
    alert('You do not have permission to create admin users.');
    return;
  }
  const form = new FormData(event.currentTarget);
  const payload = {
    name: String(form.get('name') || '').trim(),
    email: String(form.get('email') || '').trim(),
    phone: String(form.get('phone') || '').trim(),
    adminRole: String(form.get('adminRole') || 'READ_ONLY_ADMIN'),
    adminPermissions: [
      ...(form.get('canActivateServices') === 'on' ? [SERVICE_ACTIVATION_PERMISSION] : []),
      ...(form.get('canViewClientContact') === 'on' ? [CLIENT_CONTACT_PERMISSION] : []),
    ],
    countryCode: String(form.get('countryCode') || 'ZA'),
    location: { city: String(form.get('city') || 'Head Office') },
  };

  try {
    const result = await api('/admin/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    alert(result.onboardingEmailSent
      ? 'User created and onboarding email sent.'
      : 'User created. Onboarding email was not sent; check ADMIN_PORTAL_URL, RESEND_API_KEY, and RESEND_FROM_EMAIL.');
    event.currentTarget.reset();
    await refresh();
  } catch (error) {
    alert(error.message);
  }
}

async function updateAdminUser(id, patch) {
  if (!canMutate('admins.update')) {
    alert('You do not have permission to update admin users.');
    return;
  }
  if (!confirm('Confirm this admin account change?')) return;
  try {
    await api(`/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    await refresh();
  } catch (error) {
    alert(error.message);
  }
}

function renderLogin() {
  const params = new URLSearchParams(window.location.search);
  const resetToken = params.get('resetToken') || '';
  const resetEmail = params.get('email') || '';
  const authForm = state.authView === 'changePassword'
    ? `
        <form class="login-card" onsubmit="changePassword(event)">
          <div class="login-heading">
            <span class="eyebrow">First sign-in</span>
            <h2>Change temporary password</h2>
            <p>Create a permanent password before opening the internal dashboard.</p>
          </div>
          <label>Temporary Password</label>
          <input name="currentPassword" type="password" autocomplete="current-password" required />
          <label>New Password</label>
          <input name="newPassword" type="password" autocomplete="new-password" minlength="8" required />
          <label>Confirm New Password</label>
          <input name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required />
          <p class="form-error" data-login-error></p>
          <button class="primary-button" type="submit">${state.loading ? 'Updating...' : 'Update Password'}</button>
          <button class="text-button" type="button" onclick="logout()">Sign out</button>
        </form>
      `
    : state.authView === 'forgot'
    ? `
        <form class="login-card" onsubmit="forgotPassword(event)">
          <div class="login-heading">
            <span class="eyebrow">Password reset</span>
            <h2>Reset admin access</h2>
            <p>Enter your admin email. If the account exists, reset instructions will be sent.</p>
          </div>
          <label>Email</label>
          <input name="email" type="email" autocomplete="email" required />
          <p class="form-message" data-auth-message></p>
          <p class="form-error" data-login-error></p>
          <button class="primary-button" type="submit">${state.loading ? 'Sending...' : 'Send Reset Instructions'}</button>
          <button class="text-button" type="button" onclick="setAuthView('login')">Back to sign in</button>
        </form>
      `
    : state.authView === 'reset'
      ? `
          <form class="login-card" onsubmit="resetPassword(event)">
            <div class="login-heading">
              <span class="eyebrow">Set new password</span>
              <h2>Create a new password</h2>
              <p>Use the email that received the reset link.</p>
            </div>
            <input name="token" type="hidden" value="${escapeHtml(resetToken)}" />
            <label>Email</label>
            <input name="email" type="email" autocomplete="email" value="${escapeHtml(resetEmail)}" required />
            <label>New Password</label>
            <input name="password" type="password" autocomplete="new-password" minlength="6" required />
            <label>Confirm Password</label>
            <input name="confirmPassword" type="password" autocomplete="new-password" minlength="6" required />
            <p class="form-message" data-auth-message></p>
            <p class="form-error" data-login-error></p>
            <button class="primary-button" type="submit">${state.loading ? 'Resetting...' : 'Reset Password'}</button>
            <button class="text-button" type="button" onclick="setAuthView('login')">Back to sign in</button>
          </form>
        `
      : `
          <form class="login-card" onsubmit="login(event)">
            <div class="login-heading">
              <span class="eyebrow">Admin access</span>
              <h2>Sign in to operations</h2>
              <p>Internal staff only. Customer and technician accounts are blocked from this portal.</p>
            </div>

            <label>Email</label>
            <input name="email" type="email" autocomplete="username" required />

            <label>Password</label>
            <input name="password" type="password" autocomplete="current-password" required />

            <div class="login-row">
              <button class="text-button" type="button" onclick="setAuthView('forgot')">Forgot password?</button>
            </div>
            <p class="form-error" data-login-error></p>
            <p class="form-message" data-auth-message>${escapeHtml(state.authMessage)}</p>
            <button class="primary-button" type="submit">${state.loading ? 'Signing in...' : 'Sign In'}</button>
          </form>
        `;

  app.innerHTML = `
    <main class="login-page">
      <section class="login-media" aria-label="MyFixer operations image">
        <div class="media-overlay">
          <div class="brand-lockup">
            <img
              src="https://res.cloudinary.com/dz7dr3wku/image/upload/v1784232641/final_logo_main_xx1y3f.png"
              alt="MyFixer logo"
              class="brand-logo"
            />
              <div>
                <h1 class="login-product-title">
                  <span class="admin-padi-wordmark" aria-label="Padi">
                    <span class="admin-padi-pad">Pad</span><span class="admin-padi-i"><span class="admin-padi-dot"></span><span class="admin-padi-stem"></span></span>
                  </span>
                  <span>BackOffice</span>
                </h1>
                <p>A secure operations workspace for managing Padi markets, providers, dispatch, payments, and platform trust.</p>
              </div>
          </div>
          <div class="media-stats">
            <div><strong>Secure</strong><span>Internal access only</span></div>
            <div><strong>Live</strong><span>Connected API data</span></div>
            <div><strong>Audit</strong><span>Tracked admin actions</span></div>
          </div>
        </div>
      </section>

      <section class="login-panel">
        ${authForm}
      </section>
    </main>
  `;
}

function setAuthView(view) {
  state.authView = view;
  state.authMessage = '';
  if (view === 'login') {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
  render();
}

function formatClockTime() {
  const now = new Date();
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(now);
}

function startClockTimer() {
  if (clockTimer) return;
  state.currentTime = formatClockTime();
  clockTimer = setInterval(() => {
    state.currentTime = formatClockTime();
    updateTopbarIndicators();
  }, 60 * 1000);
}

function stopClockTimer() {
  if (!clockTimer) return;
  clearInterval(clockTimer);
  clockTimer = null;
}

function renderShell() {
  startClockTimer();
  startApiHealthTimer();
  const navViews = visibleViews();
  const activeView = navViews.find((view) => view.id === state.activeView) || navViews[0];
  if (activeView && activeView.id !== state.activeView) state.activeView = activeView.id;

  app.innerHTML = `
    <div class="admin-shell">
      <aside class="sidebar">
        <div class="sidebar-brand">
          <img
            src="https://res.cloudinary.com/dz7dr3wku/image/upload/v1784232641/final_logo_main_xx1y3f.png"
            alt="Padi logo"
            class="brand-logo small"
          />
        </div>
        <div class="sidebar-user">
          <strong>${escapeHtml(state.user?.adminRole || 'ADMIN')}</strong>
          <span>${escapeHtml(state.user?.email || '')}</span>
        </div>
        <nav>
          ${navViews.map((view) => `
            <button class="nav-item ${state.activeView === view.id ? 'active' : ''}" onclick="setView('${view.id}')">
              ${view.label}
            </button>
          `).join('')}
        </nav>
      </aside>

      <main class="workspace">
        <header class="topbar">
          <div>
            <span class="eyebrow">Operations console</span>
            <h1>${navViews.find((view) => view.id === state.activeView)?.label || 'Overview'}</h1>
          </div>
          <div class="topbar-actions">
            ${renderApiHealthBadge()}
            <span id="topbar-clock" class="topbar-clock">${escapeHtml(state.currentTime || '')}</span>
            <button class="ghost-button" data-refresh onclick="refresh()" ${state.loading ? 'disabled' : ''}>${state.loading ? 'Refreshing...' : 'Refresh'}</button>
            <button class="danger-button" onclick="logout()">Sign Out</button>
          </div>
        </header>
        <section class="content" aria-busy="${state.loading ? 'true' : 'false'}">
          ${state.loading ? '<div class="notice">Loading live operations data...</div>' : ''}
          ${state.error ? `<div class="notice error">${escapeHtml(state.error)}</div>` : ''}
          ${state.idleWarning ? `<div class="notice warn">${escapeHtml(state.idleWarning)}</div>` : ''}
          ${renderActiveView()}
        </section>
      </main>
      ${state.selectedBooking ? renderBookingDrawer() : ''}
    </div>
  `;
}

function clearIdleTimers() {
  if (idleWarningTimer) clearTimeout(idleWarningTimer);
  if (idleLogoutTimer) clearTimeout(idleLogoutTimer);
  idleWarningTimer = null;
  idleLogoutTimer = null;
}

function resetIdleTimer() {
  clearIdleTimers();
  if (!state.token) return;

  if (state.idleWarning) {
    state.idleWarning = '';
    render();
  }

  idleWarningTimer = setTimeout(() => {
    if (!state.token) return;
    state.idleWarning = 'Security timeout: you will be signed out in 60 seconds unless activity continues.';
    render();
  }, IDLE_TIMEOUT_MS - IDLE_WARNING_MS);

  idleLogoutTimer = setTimeout(() => {
    if (!state.token) return;
    alert('You have been signed out because the admin portal was inactive.');
    logout();
  }, IDLE_TIMEOUT_MS);
}

function setupIdleSecurity() {
  ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'].forEach((eventName) => {
    window.addEventListener(eventName, resetIdleTimer, { passive: true });
  });
  window.addEventListener('keydown', handleGlobalKeydown);
  resetIdleTimer();
}

function handleGlobalKeydown(event) {
  if (event.key === 'Escape' && state.activeView === 'services' && state.serviceWorkspace.drawerOpen) {
    requestCloseBookableServiceDrawer();
  }
}

function setView(view) {
  if (!visibleViews().some((item) => item.id === view)) return;
  state.activeView = view;
  state.selectedBooking = null;
  render();
}

function renderActiveView() {
  if (!visibleViews().some((view) => view.id === state.activeView)) {
    return '<section class="panel"><p class="empty">You do not have access to this section.</p></section>';
  }
  if (state.activeView === 'overview') return renderOverview();
  if (state.activeView === 'clients') return renderClients();
  if (state.activeView === 'technicians') return renderTechnicians();
  if (state.activeView === 'bookings') return renderBookings();
  if (state.activeView === 'managedCollections') return renderManagedCollections();
  if (state.activeView === 'collectionOperations') return renderCollectionOperations();
  if (state.activeView === 'notifications') return renderNotifications();
  if (state.activeView === 'subscriptions') return renderSubscriptions();
  if (state.activeView === 'quotes') return renderQuotes();
  if (state.activeView === 'invoices') return renderInvoices();
  if (state.activeView === 'settlements') return renderSettlements();
  if (state.activeView === 'promotions') return renderPromotions();
  if (state.activeView === 'ledger') return renderLedger();
  if (state.activeView === 'adminUsers') return renderAdminUsers();
  if (state.activeView === 'services') return renderServices();
  if (state.activeView === 'settings') return renderSettings();
  if (state.activeView === 'auditLogs') return renderAuditLogs();
  return '';
}

function getOverviewNumber(primary, fallback = 0) {
  return Number.isFinite(Number(primary)) ? Number(primary) : fallback;
}

function isPendingProvider(tech = {}) {
  const status = String(tech.approvalStatus || '').toUpperCase();
  return status.includes('PENDING') || status.includes('REVIEW');
}

function isApprovedProvider(tech = {}) {
  return String(tech.approvalStatus || '').toUpperCase() === 'APPROVED';
}

function renderProviderReviewQueue() {
  const pendingProviders = (state.data.technicians || []).filter(isPendingProvider).slice(0, 5);
  if (!pendingProviders.length) return renderEmpty('No provider applications are waiting for review.');

  return `
    <div class="overview-list">
      ${pendingProviders.map((tech) => {
        const user = tech.userId || {};
        const serviceLabel = formatTechnicianServices(tech.serviceCategories || []);
        const location = [tech.city, tech.countryCode].filter(Boolean).join(', ') || '-';
        return `
          <article class="overview-row">
            <div>
              <strong>${escapeHtml(user.name || 'Provider')}</strong>
              <span>${escapeHtml(serviceLabel)}</span>
              <small>${escapeHtml(location)} • ${escapeHtml(formatYearsExperience(tech.yearsExperience))}</small>
            </div>
            <span class="status ${statusClass(tech.approvalStatus)}">${escapeHtml(tech.approvalStatus || 'PENDING')}</span>
          </article>
        `;
      }).join('')}
    </div>
  `;
}

function renderMarketCoverage() {
  const markets = (state.data.markets || [])
    .map(getMarketView)
    .filter((market) => String(market.status || '').toUpperCase() === 'ACTIVE');
  if (!markets.length) return renderEmpty('No active markets yet.');

  return `
    <div class="coverage-grid">
      ${markets.slice(0, 6).map((market) => {
        const activeCities = (market.cityServiceAvailability || [])
          .filter((city) => String(city.status || '').toUpperCase() === 'ACTIVE');
        const serviceCount = normalizeServiceEntries(market.serviceCategories || []).length;
        const providerCount = (market.providerSettings || market.paymentProviders || []).length;
        return `
          <article class="coverage-tile">
            <div class="coverage-tile-head">
              <strong>${escapeHtml(market.countryName || market.countryCode || 'Market')}</strong>
              <span class="status ${statusClass(market.status)}">${escapeHtml(market.status || '-')}</span>
            </div>
            <span>${escapeHtml(market.currency || '-')} • ${activeCities.length} active ${activeCities.length === 1 ? 'city' : 'cities'}</span>
            <span>${serviceCount} ${serviceCount === 1 ? 'service' : 'services'} • ${providerCount} payment ${providerCount === 1 ? 'provider' : 'providers'}</span>
          </article>
        `;
      }).join('')}
    </div>
  `;
}

function renderPlatformReadiness() {
  const markets = (state.data.markets || []).map(getMarketView);
  const hasActiveMarket = markets.some((market) => String(market.status || '').toUpperCase() === 'ACTIVE');
  const hasPaymentProvider = markets.some((market) => (market.paymentProviders || []).length || (market.providerSettings || []).length);
  const pendingProviders = (state.data.technicians || []).filter(isPendingProvider).length;
  const unpaidInvoices = getOverviewNumber(state.data.overview?.unpaidInvoices, state.data.invoices.filter((invoice) => String(invoice.status || '').toUpperCase() === 'UNPAID').length);
  const checks = [
    {
      label: 'Backend API',
      value: apiHealthLabel(),
      status: state.apiHealth.status === 'connected' ? 'good' : state.apiHealth.status === 'slow' ? 'warn' : 'bad',
    },
    {
      label: 'Active markets',
      value: hasActiveMarket ? `${markets.filter((market) => String(market.status || '').toUpperCase() === 'ACTIVE').length} active` : 'Needs setup',
      status: hasActiveMarket ? 'good' : 'warn',
    },
    {
      label: 'Payment providers',
      value: hasPaymentProvider ? 'Configured' : 'Needs provider',
      status: hasPaymentProvider ? 'good' : 'warn',
    },
    {
      label: 'Provider reviews',
      value: pendingProviders ? `${pendingProviders} pending` : 'Clear',
      status: pendingProviders ? 'warn' : 'good',
    },
    {
      label: 'Unpaid invoices',
      value: unpaidInvoices ? `${unpaidInvoices} open` : 'Clear',
      status: unpaidInvoices ? 'warn' : 'good',
    },
  ];

  return `
    <div class="readiness-list">
      ${checks.map((check) => `
        <div class="readiness-row">
          <span>${escapeHtml(check.label)}</span>
          <strong>${escapeHtml(check.value)}</strong>
          <span class="status ${check.status}">${check.status === 'good' ? 'OK' : check.status === 'warn' ? 'WATCH' : 'ISSUE'}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function renderRecentAdminActivity() {
  const logs = (state.data.auditLogs || []).slice(0, 5);
  if (!logs.length) return renderEmpty('No admin actions have been recorded yet.');

  return `
    <div class="overview-list">
      ${logs.map((log) => {
        const action = log.event?.action || log.action || '-';
        const actorEmail = log.actor?.email || log.actorEmail || '-';
        const resourceType = log.event?.resourceType || log.resourceType || '-';
        return `
          <article class="overview-row">
            <div>
              <strong>${escapeHtml(action)}</strong>
              <span>${escapeHtml(actorEmail)}</span>
              <small>${escapeHtml(resourceType)} • ${escapeHtml(formatDate(log.createdAt))}</small>
            </div>
          </article>
        `;
      }).join('')}
    </div>
  `;
}

function getActiveOperatingMarkets() {
  return (state.data.markets || [])
    .map(getMarketView)
    .filter((market) => String(market.status || '').toUpperCase() === 'ACTIVE');
}

function moneyMinorFrom(record = {}, decimalField, minorField) {
  if (typeof record[minorField] === 'number') return record[minorField];
  if (typeof record[decimalField] === 'number') return Math.round(record[decimalField] * 100);
  return 0;
}

function invoiceCountryCode(invoice = {}) {
  return String(
    invoice.countryCode ||
    invoice.bookingId?.countryCode ||
    invoice.bookingId?.identity?.countryCode ||
    ''
  ).toUpperCase();
}

function bookingCountryCode(booking = {}) {
  return String(booking.countryCode || booking.identity?.countryCode || '').toUpperCase();
}

function invoiceTotalMinor(invoice = {}) {
  return moneyMinorFrom(invoice, 'totalAmount', 'totalAmountMinor');
}

function invoiceCommissionMinor(invoice = {}) {
  return moneyMinorFrom(invoice, 'platformCommissionAmount', 'platformCommissionAmountMinor');
}

function invoiceTechnicianNetMinor(invoice = {}) {
  return moneyMinorFrom(invoice, 'technicianNetAmount', 'technicianNetAmountMinor');
}

function bookingValueMinor(booking = {}) {
  return moneyMinorFrom(booking, 'price', 'priceMinor') ||
    moneyMinorFrom(booking.finalBilling || {}, 'totalAmount', 'totalAmountMinor');
}

function sumMinor(rows, selector) {
  return rows.reduce((total, row) => total + selector(row), 0);
}

function rowsForActiveMarkets(rows, getCountryCode, activeMarkets) {
  const activeCodes = new Set(activeMarkets.map((market) => market.countryCode).filter(Boolean));
  if (!activeCodes.size) return [];
  return rows.filter((row) => activeCodes.has(getCountryCode(row)));
}

function overviewDataset() {
  const overview = state.data.overview || {};
  const activeMarkets = getActiveOperatingMarkets();
  const activeInvoices = rowsForActiveMarkets(state.data.invoices || [], invoiceCountryCode, activeMarkets);
  const activeBookings = rowsForActiveMarkets(state.data.bookings || [], bookingCountryCode, activeMarkets);
  const primaryCurrency = activeMarkets[0]?.currency || activeInvoices[0]?.currency || 'ZAR';
  const paidInvoices = activeInvoices.filter((invoice) => String(invoice.status || '').toUpperCase() === 'PAID');
  const unpaidInvoices = activeInvoices.filter((invoice) => String(invoice.status || '').toUpperCase() === 'UNPAID');
  const refundedInvoices = activeInvoices.filter((invoice) => String(invoice.status || '').toUpperCase().includes('REFUND'));
  const failedInvoices = activeInvoices.filter((invoice) => String(invoice.status || '').toUpperCase().includes('FAIL'));
  const completedBookings = activeBookings.filter((booking) => String(booking.status || '').toUpperCase() === 'COMPLETED');
  const acceptedBookings = activeBookings.filter((booking) => ['ACCEPTED', 'IN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'DIAGNOSTIC_DONE', 'COMPLETED'].includes(String(booking.status || '').toUpperCase()));
  const approvedQuotes = (state.data.quotes || []).filter((quote) => String(quote.status || '').toUpperCase().includes('APPROVED'));
  const escrowMinor = (state.data.ledger || [])
    .filter((row) => ['CLIENT_PAYMENT', 'TECHNICIAN_EARNING_PENDING'].includes(String(row.type || '').toUpperCase()))
    .reduce((total, row) => total + moneyMinorFrom(row, 'amount', 'amountMinor'), 0);

  return {
    overview,
    activeMarkets,
    activeInvoices,
    activeBookings,
    paidInvoices,
    unpaidInvoices,
    refundedInvoices,
    failedInvoices,
    completedBookings,
    acceptedBookings,
    approvedQuotes,
    primaryCurrency,
    grossRevenueMinor: sumMinor(paidInvoices, invoiceTotalMinor),
    platformFeesMinor: sumMinor(paidInvoices, invoiceCommissionMinor),
    technicianPayoutsMinor: sumMinor(paidInvoices, invoiceTechnicianNetMinor),
    pendingPaymentsMinor: sumMinor(unpaidInvoices, invoiceTotalMinor),
    escrowMinor,
    activeProviderCount: getOverviewNumber(overview.approvedTechnicians, (state.data.technicians || []).filter(isApprovedProvider).length),
  };
}

function formatTrend(value = 0) {
  if (!value) return '0% vs previous period';
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value}% vs previous period`;
}

function sparklineSvg(points = [], tone = 'blue') {
  const safePoints = points.length ? points : [0, 0, 0, 0, 0, 0, 0];
  const max = Math.max(...safePoints, 1);
  const step = 72 / Math.max(safePoints.length - 1, 1);
  const path = safePoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${index * step} ${24 - ((point / max) * 20)}`)
    .join(' ');
  return `<svg class="sparkline ${tone}" viewBox="0 0 72 28" aria-hidden="true"><path d="${path}" /></svg>`;
}

function buildRevenueTrendRows(invoices, days = 7) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - index - 1));
    const key = date.toISOString().slice(0, 10);
    const totalMinor = invoices
      .filter((invoice) => String(invoice.createdAt || '').slice(0, 10) === key)
      .reduce((total, invoice) => total + invoiceTotalMinor(invoice), 0);
    return { label: date.toLocaleDateString(undefined, { weekday: 'short' }), key, totalMinor };
  });
}

function renderOverviewFilterBar(data) {
  return `
    <div class="overview-filter-bar">
      <label><span>Date Range</span><select><option>7 Days</option><option>Today</option><option>30 Days</option><option>90 Days</option><option>This Year</option><option>Custom Range</option></select></label>
      <label><span>Active Market</span><select><option value="">All active markets</option>${data.activeMarkets.map((market) => `<option value="${escapeHtml(market.countryCode)}">${escapeHtml(market.countryName || market.countryCode)}</option>`).join('')}</select></label>
      <button class="ghost-button compact" onclick="refresh()">Refresh</button>
      <button class="ghost-button compact" title="TODO: Connect to analytics export endpoint.">Export</button>
    </div>
  `;
}

function renderKpiCard({ label, value, trend = 0, icon = '$', tone = 'blue', spark = [] }) {
  const trendClass = trend < 0 ? 'down' : trend > 0 ? 'up' : 'flat';
  const trendSymbol = trend < 0 ? '&#9660;' : trend > 0 ? '&#9650;' : '&#8212;';
  return `
    <article class="business-kpi ${tone}">
      <div class="business-kpi-head"><span>${escapeHtml(label)}</span><strong>${escapeHtml(icon)}</strong></div>
      <div class="business-kpi-value">${value}</div>
      <div class="business-kpi-trend ${trendClass}">${trendSymbol} ${escapeHtml(formatTrend(trend))}</div>
      ${sparklineSvg(spark, tone)}
    </article>
  `;
}

function renderBusinessKpis(data) {
  const revenueSpark = buildRevenueTrendRows(data.paidInvoices).map((row) => row.totalMinor);
  const bookingSpark = buildRevenueTrendRows(data.activeBookings.map((booking) => ({
    createdAt: booking.createdAt,
    totalAmountMinor: bookingValueMinor(booking),
  }))).map((row) => row.totalMinor);
  const cards = [
    { label: 'Gross Revenue', value: moneyFromMinor(data.grossRevenueMinor, data.primaryCurrency), icon: 'R', tone: 'green', spark: revenueSpark },
    { label: 'Platform Fees', value: moneyFromMinor(data.platformFeesMinor, data.primaryCurrency), icon: '%', tone: 'blue', spark: revenueSpark },
    { label: 'Technician Payouts', value: moneyFromMinor(data.technicianPayoutsMinor, data.primaryCurrency), icon: 'P', tone: 'purple', spark: revenueSpark },
    { label: 'Pending Payments', value: moneyFromMinor(data.pendingPaymentsMinor, data.primaryCurrency), icon: '!', tone: 'amber', spark: revenueSpark },
    { label: 'Active Bookings', value: data.activeBookings.length, icon: 'B', tone: 'blue', spark: bookingSpark },
    { label: 'Active Providers', value: data.activeProviderCount, icon: 'T', tone: 'green', spark: [0, 0, data.activeProviderCount] },
  ];
  return `<div class="business-kpi-grid">${cards.map(renderKpiCard).join('')}</div>`;
}

function renderRevenueTrend(data) {
  const rows = buildRevenueTrendRows(data.paidInvoices, 7);
  const max = Math.max(...rows.map((row) => row.totalMinor), 1);
  const points = rows
    .map((row, index) => `${(index / Math.max(rows.length - 1, 1)) * 100},${100 - ((row.totalMinor / max) * 82 + 8)}`)
    .join(' ');
  return `
    <section class="panel business-panel hero-chart">
      <div class="panel-header"><div><h2>Revenue Trend</h2><span>Primary business revenue over the selected period</span></div><span class="status info">7 DAYS</span></div>
      <div class="line-chart-wrap">
        <svg class="line-chart" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Revenue trend chart">
          <polyline class="line-chart-fill" points="0,100 ${points} 100,100" />
          <polyline class="line-chart-line" points="${points}" />
        </svg>
        ${rows.every((row) => row.totalMinor === 0) ? '<div class="chart-empty-note">No paid revenue recorded for this period.</div>' : ''}
      </div>
      <div class="chart-axis">${rows.map((row) => `<span>${escapeHtml(row.label)}</span>`).join('')}</div>
    </section>
  `;
}

function rankedEntries(map, limit = 6) {
  return Array.from(map.values())
    .sort((a, b) => (b.amountMinor || b.count || 0) - (a.amountMinor || a.count || 0))
    .slice(0, limit);
}

function revenueByCategory(data) {
  const rows = new Map();
  data.activeInvoices.forEach((invoice) => {
    const label = invoice.bookingId?.applianceType || invoice.serviceKey || invoice.category || 'Uncategorized';
    const key = serviceKeyFrom(label);
    const current = rows.get(key) || { label: labelFromServiceKey(key) || label, amountMinor: 0 };
    current.amountMinor += invoiceTotalMinor(invoice);
    rows.set(key, current);
  });
  return rankedEntries(rows);
}

function renderHorizontalBars(rows, currency) {
  if (!rows.length || rows.every((row) => !row.amountMinor)) return renderEmpty('No revenue breakdown is available yet.');
  const max = Math.max(...rows.map((row) => row.amountMinor), 1);
  return `
    <div class="bar-list">
      ${rows.map((row) => `
        <div class="bar-row">
          <div><strong>${escapeHtml(row.label)}</strong><span>${moneyFromMinor(row.amountMinor, currency)}</span></div>
          <div class="bar-track"><span style="width: ${Math.max(4, Math.round((row.amountMinor / max) * 100))}%"></span></div>
        </div>
      `).join('')}
    </div>
  `;
}

function revenueByActiveCountry(data) {
  return data.activeMarkets.map((market) => {
    const amountMinor = data.activeInvoices
      .filter((invoice) => invoiceCountryCode(invoice) === market.countryCode)
      .reduce((total, invoice) => total + invoiceTotalMinor(invoice), 0);
    return {
      label: market.countryName || market.countryCode,
      countryCode: market.countryCode,
      currency: market.currency || data.primaryCurrency,
      amountMinor,
    };
  });
}

function renderRevenueByCountryDonut(rows, currency) {
  if (!rows.length) return renderEmpty('No active operating markets are configured.');
  const total = rows.reduce((sum, row) => sum + row.amountMinor, 0);
  const colors = ['#00ff87', '#38bdf8', '#a78bfa', '#f59e0b', '#f472b6', '#22d3ee'];
  let offset = 0;
  const segments = rows.map((row, index) => {
    const percent = total > 0 ? row.amountMinor / total : rows.length === 1 ? 1 : 1 / rows.length;
    const dash = `${percent * 100} ${100 - (percent * 100)}`;
    const segment = `<circle r="15.9" cx="18" cy="18" style="stroke:${colors[index % colors.length]};stroke-dasharray:${dash};stroke-dashoffset:${-offset};"></circle>`;
    offset += percent * 100;
    return segment;
  }).join('');
  return `
    <div class="donut-layout">
      <div class="donut-chart">
        <svg viewBox="0 0 36 36" aria-label="Revenue by active country"><circle class="donut-bg" r="15.9" cx="18" cy="18"></circle>${segments}</svg>
        <div><strong>${total > 0 ? moneyFromMinor(total, currency) : '0%'}</strong><span>Total</span></div>
      </div>
      <div class="donut-legend">
        ${rows.map((row, index) => {
          const percent = total > 0 ? Math.round((row.amountMinor / total) * 100) : rows.length === 1 ? 100 : Math.round(100 / rows.length);
          return `<div><i style="background:${colors[index % colors.length]}"></i><span>${escapeHtml(row.label)}</span><strong>${percent}%</strong></div>`;
        }).join('')}
      </div>
    </div>
  `;
}

function renderFinancialDistribution(data) {
  return `
    <div class="overview-grid two">
      <section class="panel business-panel"><div class="panel-header"><div><h2>Platform Fees</h2><span>Commission retained by MyFixer</span></div></div><div class="financial-total">${moneyFromMinor(data.platformFeesMinor, data.primaryCurrency)}</div>${sparklineSvg(buildRevenueTrendRows(data.paidInvoices).map((row) => row.totalMinor), 'blue')}<p class="business-note">TODO: Replace with finance analytics endpoint for period-over-period growth.</p></section>
      <section class="panel business-panel"><div class="panel-header"><div><h2>Technician Payouts</h2><span>Net earnings owed or paid to providers</span></div></div><div class="financial-total">${moneyFromMinor(data.technicianPayoutsMinor, data.primaryCurrency)}</div>${sparklineSvg(buildRevenueTrendRows(data.paidInvoices).map((row) => row.totalMinor), 'purple')}<p class="business-note">TODO: Connect settlement analytics for paid vs pending payout timing.</p></section>
    </div>
  `;
}

function renderPaymentHealth(data) {
  const items = [
    ['Successful Payments', data.paidInvoices.length, 'green'],
    ['Pending Payments', data.unpaidInvoices.length, 'amber'],
    ['Escrow Balance', moneyFromMinor(data.escrowMinor, data.primaryCurrency), 'blue'],
    ['Failed Payments', data.failedInvoices.length, 'red'],
    ['Refunds', data.refundedInvoices.length, 'purple'],
  ];
  return `
    <section class="panel business-panel">
      <div class="panel-header"><div><h2>Payment Health</h2><span>Payment flow and exception status</span></div></div>
      <div class="payment-health-grid">${items.map(([label, value, tone]) => `<article class="${tone}"><span>${escapeHtml(label)}</span><strong>${value}</strong></article>`).join('')}</div>
    </section>
  `;
}

function renderRevenueFunnel(data) {
  const funnel = [
    ['Bookings', data.activeBookings.length],
    ['Accepted', data.acceptedBookings.length],
    ['Quote Approved', data.approvedQuotes.length],
    ['Payment Received', data.paidInvoices.length],
    ['Completed', data.completedBookings.length],
    ['Revenue', moneyFromMinor(data.grossRevenueMinor, data.primaryCurrency)],
  ];
  const max = Math.max(...funnel.map((item) => typeof item[1] === 'number' ? item[1] : 0), 1);
  return `
    <section class="panel business-panel">
      <div class="panel-header"><div><h2>Revenue Funnel</h2><span>Where bookings convert into revenue</span></div></div>
      <div class="funnel-list">${funnel.map(([label, value]) => {
        const width = typeof value === 'number' ? Math.max(18, Math.round((value / max) * 100)) : 100;
        return `<div class="funnel-step"><span style="width:${width}%"><strong>${escapeHtml(label)}</strong><em>${value}</em></span></div>`;
      }).join('')}</div>
    </section>
  `;
}

function topServices(data) {
  const rows = new Map();
  data.activeBookings.forEach((booking) => {
    const label = booking.applianceType || booking.serviceKey || booking.category || 'Uncategorized';
    const key = serviceKeyFrom(label);
    const current = rows.get(key) || { label: labelFromServiceKey(key) || label, count: 0, amountMinor: 0 };
    current.count += 1;
    current.amountMinor += bookingValueMinor(booking);
    rows.set(key, current);
  });
  return rankedEntries(rows, 5);
}

function topTechnicians(data) {
  const rows = new Map();
  data.completedBookings.forEach((booking) => {
    const id = booking.technicianId?._id || booking.technicianId || booking.assignedTechnicianId || 'unassigned';
    const name = booking.technicianName || booking.technicianId?.name || (id === 'unassigned' ? 'Unassigned' : 'Technician');
    const current = rows.get(String(id)) || { label: name, count: 0, amountMinor: 0 };
    current.count += 1;
    current.amountMinor += bookingValueMinor(booking);
    rows.set(String(id), current);
  });
  return rankedEntries(rows, 5);
}

function renderRankedList(rows, currency, emptyMessage) {
  if (!rows.length) return renderEmpty(emptyMessage);
  return `
    <div class="ranked-list">
      ${rows.map((row, index) => `<article><span>${index + 1}</span><div><strong>${escapeHtml(row.label)}</strong><small>${row.count || 0} ${row.count === 1 ? 'job' : 'jobs'}</small></div><em>${moneyFromMinor(row.amountMinor || 0, currency)}</em></article>`).join('')}
    </div>
  `;
}

function renderAiInsights(data) {
  const insights = [];
  if (!data.grossRevenueMinor) insights.push('No revenue recorded for the selected period.');
  if (!data.failedInvoices.length) insights.push('No failed payments detected.');
  if (data.pendingPaymentsMinor) insights.push(`Pending payments total ${moneyFromMinor(data.pendingPaymentsMinor, data.primaryCurrency)}.`);
  if ((state.data.technicians || []).filter(isPendingProvider).length === 0) insights.push('Provider approval queue is clear.');
  if (data.activeMarkets.length === 1) insights.push(`${data.activeMarkets[0].countryName || data.activeMarkets[0].countryCode} is currently 100% of active-market revenue.`);
  return `
    <section class="panel business-panel ai-insights">
      <div class="panel-header"><div><h2>AI Business Insights</h2><span>Rule-based now, AI-ready later</span></div></div>
      <div class="insight-list">${insights.map((insight) => `<p>${escapeHtml(insight)}</p>`).join('')}</div>
    </section>
  `;
}

function renderOverview() {
  const data = overviewDataset();
  return `
    <div class="business-command-center">
      ${renderOverviewFilterBar(data)}
      ${renderBusinessKpis(data)}
      ${renderRevenueTrend(data)}
      <div class="overview-grid two">
        <section class="panel business-panel"><div class="panel-header"><div><h2>Revenue by Category</h2><span>Highest earning service lines</span></div></div>${renderHorizontalBars(revenueByCategory(data), data.primaryCurrency)}</section>
        <section class="panel business-panel"><div class="panel-header"><div><h2>Revenue by Country</h2><span>Active operating markets only</span></div></div>${renderRevenueByCountryDonut(revenueByActiveCountry(data), data.primaryCurrency)}</section>
      </div>
      ${renderFinancialDistribution(data)}
      <div class="overview-grid two">${renderPaymentHealth(data)}${renderRevenueFunnel(data)}</div>
      <div class="overview-grid two">
        <section class="panel business-panel"><div class="panel-header"><div><h2>Top Services</h2><span>Ranked by booking value</span></div></div>${renderRankedList(topServices(data), data.primaryCurrency, 'No service performance data yet.')}</section>
        <section class="panel business-panel"><div class="panel-header"><div><h2>Top Technicians</h2><span>Completed jobs and revenue</span></div></div>${renderRankedList(topTechnicians(data), data.primaryCurrency, 'No technician revenue ranking yet.')}</section>
      </div>
      ${renderAiInsights(data)}
    </div>
  `;
}

function renderClients() {
  const rows = state.data.clients || [];
  const contactAccess = state.data.clientsContactAccess === true;
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>Clients</h2>
          <span>${rows.length} customer accounts - contact details masked by default</span>
        </div>
      </div>
      ${renderGenericTable(rows, ['Name', 'Contact', 'Country', 'Location', 'Status', 'Verified', 'Joined', 'Actions'], (client) => {
        const revealed = state.revealedClientContacts?.[client._id];
        return [
        `${escapeHtml(client.name || 'Unnamed client')}<span>${escapeHtml(client._id || '')}</span>`,
        `${escapeHtml(revealed?.email || client.email || '-')}<span>${escapeHtml(revealed?.phone || client.phone || '-')}</span>`,
        escapeHtml(client.countryCode || '-'),
        `${escapeHtml(client.location?.city || '-')}<span>${escapeHtml(client.location?.area || '')}</span>`,
        `<span class="status ${statusClass(client.accountStatus || 'ACTIVE')}">${escapeHtml(client.accountStatus || 'ACTIVE')}</span>`,
        client.isEmailVerified ? '<span class="status good">EMAIL VERIFIED</span>' : '<span class="status warn">EMAIL PENDING</span>',
        formatDate(client.createdAt),
        contactAccess
          ? `<button class="ghost-button compact" onclick="${revealed ? `hideClientContact('${client._id}')` : `revealClientContact('${client._id}')`}">${revealed ? 'Hide Contact' : 'View Contact'}</button>${revealed ? '<span>Auto-hides soon</span>' : ''}`
          : '<span class="status info">Masked</span>',
      ];
      })}
    </section>
  `;
}

async function revealClientContact(clientId) {
  if (!clientId || !hasPermission(CLIENT_CONTACT_PERMISSION)) {
    alert('You do not have permission to view client contact details.');
    return;
  }

  try {
    const result = await api(`/admin/clients/${clientId}/contact`);
    state.revealedClientContacts = {
      ...state.revealedClientContacts,
      [clientId]: result.contact,
    };

    if (state.revealTimers?.[clientId]) clearTimeout(state.revealTimers[clientId]);
    state.revealTimers = {
      ...state.revealTimers,
      [clientId]: setTimeout(() => hideClientContact(clientId), (result.contact?.expiresInSeconds || CLIENT_CONTACT_REVEAL_SECONDS) * 1000),
    };
    render();
  } catch (error) {
    alert(error.message || 'Unable to reveal client contact.');
  }
}

function hideClientContact(clientId) {
  if (state.revealTimers?.[clientId]) clearTimeout(state.revealTimers[clientId]);
  const nextContacts = { ...(state.revealedClientContacts || {}) };
  const nextTimers = { ...(state.revealTimers || {}) };
  delete nextContacts[clientId];
  delete nextTimers[clientId];
  state.revealedClientContacts = nextContacts;
  state.revealTimers = nextTimers;
  render();
}

function renderCurrencyTotals(totals) {
  const entries = Object.entries(totals);
  if (!entries.length) return renderEmpty('No ledger activity yet.');
  return `
    <div class="currency-list">
      ${entries.map(([currency, total]) => `
        <div class="currency-row">
          <strong>${currency}</strong>
          <span>Commission ${getMoney(total, 'commission', 'commissionMinor', currency)}</span>
          <span>Tech pending ${getMoney(total, 'technicianPending', 'technicianPendingMinor', currency)}</span>
          <span>Client due ${getMoney(total, 'clientDue', 'clientDueMinor', currency)}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function renderTechnicians() {
  const rows = state.data.technicians;
  const canReview = canMutate('technicians.review');
  return `
    <section class="panel">
      <div class="panel-header">
        <h2>Technician Applications</h2>
        <span>${rows.length} records</span>
      </div>
      <div class="card-list">
        ${rows.map((tech) => {
          const user = tech.userId || {};
          const photoUrl = tech.documents?.profilePhotoUrl || user.profilePhotoUrl || '';
          const photoStatus = tech.documents?.profilePhotoStatus || 'NOT_SUBMITTED';
          const serviceLabel = formatTechnicianServices(tech.serviceCategories || []);
          const serviceSelections = renderTechnicianServiceSelections(tech.serviceCategories || []);
          const experienceLabel = formatYearsExperience(tech.yearsExperience);
          const radiusLabel = formatServiceRadius(tech.serviceRadiusKm);
          const providerLabel = tech.businessName || 'Independent provider';
          const transportLabel = tech.vehicleType || 'Transport not set';
          const idLabel = formatMaskedId(tech.idNumberLast4);
          return `
            <article class="review-card">
              <div class="technician-review-main">
                <a class="technician-photo" href="${escapeHtml(photoUrl || '#')}" target="_blank" rel="noopener noreferrer">
                  ${photoUrl
                    ? `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(user.name || 'Technician')} profile photo" />`
                    : '<span>No photo</span>'}
                </a>
                <div>
                  <div class="row-title">
                    ${escapeHtml(user.name || 'Provider')}
                    <span class="status ${statusClass(tech.approvalStatus)}">${escapeHtml(tech.approvalStatus)}</span>
                    <span class="status ${photoStatus === 'VERIFIED' ? 'success' : photoStatus === 'REJECTED' ? 'danger' : 'info'}">Photo ${escapeHtml(photoStatus)}</span>
                  </div>
                  <p>${escapeHtml(user.email || '-')} - ${escapeHtml(user.phone || '-')} - ${escapeHtml(tech.city)}, ${escapeHtml(tech.countryCode)}</p>
                  <div class="technician-summary">
                    <strong>${escapeHtml(serviceLabel)}</strong>
                    <span>${escapeHtml(experienceLabel)} • ${escapeHtml(radiusLabel)}</span>
                    <span>${escapeHtml(providerLabel)} • ${escapeHtml(transportLabel)}</span>
                    <span>ID / Registration: ${escapeHtml(idLabel)}</span>
                  </div>
                  <div class="technician-service-section">
                    <div class="technician-service-section-header">
                      <strong>Signup Service Categories</strong>
                      <span>${escapeHtml(serviceLabel)}</span>
                    </div>
                    ${serviceSelections}
                  </div>
                  ${tech.review?.rejectionReason ? `<p class="warning-text">${escapeHtml(tech.review.rejectionReason)}</p>` : ''}
                </div>
              </div>
              ${canReview ? `
                <div class="review-actions">
                  <button class="success-button" onclick="reviewTechnicianProfilePhoto('${tech._id}', 'VERIFIED')" ${photoUrl ? '' : 'disabled'}>Approve Photo</button>
                  <button class="ghost-button" onclick="reviewTechnicianProfilePhoto('${tech._id}', 'REJECTED')" ${photoUrl ? '' : 'disabled'}>Reject Photo</button>
                  <button class="success-button" onclick="reviewTechnician('${tech._id}', 'APPROVED')" ${photoStatus === 'VERIFIED' ? '' : 'disabled'}>Approve</button>
                  <button class="ghost-button" onclick="reviewTechnician('${tech._id}', 'REJECTED')">Reject</button>
                  <button class="danger-button" onclick="reviewTechnician('${tech._id}', 'SUSPENDED')">Suspend</button>
                </div>
              ` : '<span class="status info">Read only</span>'}
            </article>
          `;
        }).join('') || renderEmpty('No technician applications yet.')}
      </div>
    </section>
  `;
}

function renderBookings() {
  return `
    <section class="panel">
      <div class="panel-header"><h2>Bookings</h2><span>${state.data.bookings.length} latest</span></div>
      ${renderBookingTable(state.data.bookings)}
    </section>
  `;
}

async function updateManagedCollectionReminder(id, patch) {
  if (!canMutate('bookings.update')) {
    alert('You do not have permission to update reminders.');
    return;
  }

  try {
    await api(`/admin/managed-collection-reminders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    await refresh();
  } catch (error) {
    alert(error.message);
  }
}

function rescheduleManagedCollectionReminder(id) {
  const scheduledFor = prompt('New reminder date/time (YYYY-MM-DDTHH:mm):');
  if (!scheduledFor) return;
  updateManagedCollectionReminder(id, { scheduledFor });
}

function remindersForProfile(profileId) {
  return state.data.managedCollectionReminders.filter((reminder) => String(reminder.targetId) === String(profileId));
}

async function updateCollectionJob(id, action, extra = {}) {
  if (!canMutate('bookings.update')) {
    alert('You do not have permission to manage collection operations.');
    return;
  }

  const labels = {
    MARK_COMPLETED: 'mark this collection completed',
    MARK_MISSED: 'mark this collection missed',
    RESCHEDULE: 'reschedule this collection',
    CANCEL: 'cancel this collection',
  };

  if (!confirm(`Confirm you want to ${labels[action] || 'update this collection'}?`)) return;

  try {
    await api(`/admin/collection-jobs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ action, ...extra }),
    });
    await refresh();
  } catch (error) {
    alert(error.message);
  }
}

function markCollectionCompleted(id) {
  const notes = prompt('Completion notes (optional):') || '';
  updateCollectionJob(id, 'MARK_COMPLETED', { notes });
}

function markCollectionMissed(id) {
  const missedReason = prompt('Reason this collection was missed?') || '';
  if (!missedReason.trim()) return;
  const notes = prompt('Additional notes (optional):') || '';
  updateCollectionJob(id, 'MARK_MISSED', { missedReason, notes });
}

function rescheduleCollectionJob(id) {
  const scheduledFor = prompt('New collection date/time (YYYY-MM-DDTHH:mm):');
  if (!scheduledFor) return;
  const notes = prompt('Reschedule notes (optional):') || '';
  updateCollectionJob(id, 'RESCHEDULE', { scheduledFor, notes });
}

function cancelCollectionJob(id) {
  const notes = prompt('Cancellation notes (optional):') || '';
  updateCollectionJob(id, 'CANCEL', { notes });
}

async function applyCollectionOperationFilters(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  state.collectionOperationFilters = {
    countryCode: String(form.get('countryCode') || '').trim(),
    city: String(form.get('city') || '').trim(),
    area: String(form.get('area') || '').trim(),
    collectionType: String(form.get('collectionType') || '').trim(),
    status: String(form.get('status') || '').trim(),
    preferredDay: String(form.get('preferredDay') || '').trim(),
  };
  await refresh();
}

async function resetCollectionOperationFilters() {
  state.collectionOperationFilters = {
    countryCode: '',
    city: '',
    area: '',
    collectionType: '',
    status: '',
    preferredDay: '',
  };
  await refresh();
}

function jobsByWindow(from, to) {
  const start = from ? new Date(from).getTime() : 0;
  const end = to ? new Date(to).getTime() : Number.MAX_SAFE_INTEGER;
  return (state.data.collectionOperations.jobs || []).filter((job) => {
    const scheduled = new Date(job.scheduledFor).getTime();
    return scheduled >= start && scheduled <= end;
  });
}

function renderCollectionJobActions(job, canUpdate) {
  if (!canUpdate || ['COMPLETED', 'MISSED', 'CANCELLED'].includes(job.status)) {
    return '<span class="status info">Read only</span>';
  }

  return `
    <div class="review-actions compact-actions">
      <button class="success-button compact" onclick="markCollectionCompleted('${job._id}')">Complete</button>
      <button class="ghost-button compact" onclick="rescheduleCollectionJob('${job._id}')">Reschedule</button>
      <button class="ghost-button compact" onclick="markCollectionMissed('${job._id}')">Missed</button>
      <button class="danger-button compact" onclick="cancelCollectionJob('${job._id}')">Cancel</button>
    </div>
  `;
}

function renderCollectionJobTable(rows, canUpdate) {
  return renderGenericTable(rows, ['Customer', 'Location', 'Schedule', 'Collection', 'Status', 'Actions'], (job) => [
    `<strong>${escapeHtml(job.customerName || 'Client')}</strong><span>${escapeHtml(job.customerEmail || '-')}</span>`,
    `${escapeHtml(job.city || '-')}<span>${escapeHtml(job.area || job.fullAddress || '')}</span>`,
    `${formatDate(job.scheduledFor)}<span>${escapeHtml(job.preferredCollectionDay || '-')}</span>`,
    `${escapeHtml(job.collectionType || '-')}<span>${escapeHtml((job.binPackage || []).join(', '))} - ${escapeHtml(job.frequency || '-')}</span>`,
    `<span class="status ${statusClass(job.status)}">${escapeHtml(job.status || '-')}</span>`,
    renderCollectionJobActions(job, canUpdate),
  ]);
}

function renderCollectionOperations() {
  const operations = state.data.collectionOperations || {};
  const jobs = operations.jobs || [];
  const metrics = operations.metrics || {};
  const calendar = operations.calendar || {};
  const meta = operations.meta || {};
  const filters = state.collectionOperationFilters || {};
  const canUpdate = canMutate('bookings.update');
  const now = new Date();
  const overdueJobs = jobs.filter((job) => {
    const scheduled = new Date(job.scheduledFor);
    return scheduled < now && ['SCHEDULED', 'ASSIGNED', 'IN_PROGRESS'].includes(job.status);
  });
  const completedJobs = jobs.filter((job) => job.status === 'COMPLETED');
  const upcomingJobs = jobs.filter((job) => {
    const scheduled = new Date(job.scheduledFor);
    return scheduled >= now && ['SCHEDULED', 'ASSIGNED', 'IN_PROGRESS'].includes(job.status);
  });
  const todayJobs = jobsByWindow(calendar.today?.from, calendar.today?.to);
  const tomorrowJobs = jobsByWindow(calendar.tomorrow?.from, calendar.tomorrow?.to);
  const weekJobs = jobsByWindow(calendar.week?.from, calendar.week?.to);
  const monthJobs = jobsByWindow(calendar.month?.from, calendar.month?.to);
  const metricCards = [
    ['Active Customers', metrics.activeCollectionCustomers || 0],
    ['Today', metrics.collectionsToday || 0],
    ['This Week', metrics.collectionsThisWeek || 0],
    ['Completed Month', metrics.completedThisMonth || 0],
    ['Missed', metrics.missedCollections || 0],
    ['Upcoming', metrics.upcomingCollections || 0],
  ];

  return `
    <section class="panel">
      <div class="panel-header"><div><h2>Filters</h2><span>Country, city, area, collection type, status, and preferred day.</span></div></div>
      <form class="settings-form" onsubmit="applyCollectionOperationFilters(event)">
        <div class="form-grid">
          <div>
            <label>Country</label>
            <input name="countryCode" value="${escapeHtml(filters.countryCode || '')}" placeholder="ZA" />
          </div>
          <div>
            <label>City</label>
            <input name="city" value="${escapeHtml(filters.city || '')}" placeholder="City" />
          </div>
          <div>
            <label>Area</label>
            <input name="area" value="${escapeHtml(filters.area || '')}" placeholder="Neighbourhood" />
          </div>
          <div>
            <label>Collection Type</label>
            <select name="collectionType">
              <option value="">All</option>
              ${(meta.collectionTypes || ['GENERAL_WASTE']).map((type) => `<option value="${type}" ${filters.collectionType === type ? 'selected' : ''}>${type}</option>`).join('')}
            </select>
          </div>
          <div>
            <label>Status</label>
            <select name="status">
              <option value="">All</option>
              ${(meta.statuses || ['SCHEDULED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'MISSED', 'CANCELLED']).map((status) => `<option value="${status}" ${filters.status === status ? 'selected' : ''}>${status}</option>`).join('')}
            </select>
          </div>
          <div>
            <label>Preferred Day</label>
            <select name="preferredDay">
              <option value="">All</option>
              ${(meta.days || ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']).map((day) => `<option value="${day}" ${filters.preferredDay === day ? 'selected' : ''}>${day}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="review-actions">
          <button class="primary-button compact" type="submit">Apply Filters</button>
          <button class="ghost-button compact" type="button" onclick="resetCollectionOperationFilters()">Reset</button>
        </div>
      </form>
    </section>
    <div class="metric-grid">
      ${metricCards.map(([label, value]) => `
        <article class="metric-card">
          <span>${label}</span>
          <strong>${value}</strong>
        </article>
      `).join('')}
    </div>
    <section class="panel">
      <div class="panel-header"><div><h2>Today's Collections</h2><span>${todayJobs.length} scheduled</span></div></div>
      ${renderCollectionJobTable(todayJobs, canUpdate)}
    </section>
    <section class="panel">
      <div class="panel-header"><div><h2>Tomorrow's Collections</h2><span>${tomorrowJobs.length} scheduled</span></div></div>
      ${renderCollectionJobTable(tomorrowJobs, canUpdate)}
    </section>
    <section class="panel">
      <div class="panel-header"><div><h2>This Week</h2><span>${weekJobs.length} scheduled</span></div></div>
      ${renderCollectionJobTable(weekJobs, canUpdate)}
    </section>
    <section class="panel">
      <div class="panel-header"><div><h2>Overdue & Missed</h2><span>${overdueJobs.length + jobs.filter((job) => job.status === 'MISSED').length} records</span></div></div>
      ${renderCollectionJobTable([...overdueJobs, ...jobs.filter((job) => job.status === 'MISSED')], canUpdate)}
    </section>
    <section class="panel">
      <div class="panel-header"><div><h2>Monthly Calendar</h2><span>${monthJobs.length} collections</span></div></div>
      ${renderCollectionJobTable(monthJobs, canUpdate)}
    </section>
    <section class="panel">
      <div class="panel-header"><div><h2>Upcoming Collections</h2><span>${upcomingJobs.length} scheduled</span></div></div>
      ${renderCollectionJobTable(upcomingJobs.slice(0, 100), canUpdate)}
    </section>
    <section class="panel">
      <div class="panel-header"><div><h2>Completed Collections</h2><span>${completedJobs.length} records</span></div></div>
      ${renderCollectionJobTable(completedJobs.slice(0, 100), canUpdate)}
    </section>
  `;
}

async function applyNotificationFilters(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  state.notificationFilters = {
    status: String(form.get('status') || '').trim(),
    channel: String(form.get('channel') || '').trim(),
    type: String(form.get('type') || '').trim(),
    user: String(form.get('user') || '').trim(),
    from: String(form.get('from') || '').trim(),
    to: String(form.get('to') || '').trim(),
  };
  await refresh();
}

async function resetNotificationFilters() {
  state.notificationFilters = {
    status: '',
    channel: '',
    type: '',
    user: '',
    from: '',
    to: '',
  };
  await refresh();
}

async function processDueNotifications() {
  if (!canMutate('bookings.update')) {
    alert('You do not have permission to process notifications.');
    return;
  }
  try {
    await api('/admin/notifications/process-due', { method: 'POST' });
    await refresh();
  } catch (error) {
    alert(error.message);
  }
}

async function retryNotification(id) {
  if (!canMutate('bookings.update')) {
    alert('You do not have permission to retry notifications.');
    return;
  }
  try {
    await api(`/admin/notifications/${id}/retry`, { method: 'POST' });
    await refresh();
  } catch (error) {
    alert(error.message);
  }
}

async function cancelNotification(id) {
  if (!canMutate('bookings.update')) {
    alert('You do not have permission to cancel notifications.');
    return;
  }
  if (!confirm('Cancel this scheduled notification?')) return;
  try {
    await api(`/admin/notifications/${id}/cancel`, { method: 'POST' });
    await refresh();
  } catch (error) {
    alert(error.message);
  }
}

async function sendClientNotification(event) {
  event.preventDefault();
  if (!canMutate('bookings.update')) {
    alert('You do not have permission to send client notifications.');
    return;
  }

  const form = new FormData(event.currentTarget);
  const payload = {
    audience: String(form.get('audience') || 'CLIENTS').trim(),
    title: String(form.get('title') || '').trim(),
    message: String(form.get('message') || '').trim(),
  };

  if (!payload.title || !payload.message) {
    alert('Enter both a title and message.');
    return;
  }

  try {
    await api('/admin/notifications', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    event.currentTarget.reset();
    await refresh();
    alert('Client alert broadcast sent.');
  } catch (error) {
    alert(error.message);
  }
}

function renderNotifications() {
  const rows = state.data.notifications || [];
  const meta = state.data.notificationMeta || {};
  const filters = state.notificationFilters || {};
  const counts = Object.fromEntries((state.data.notificationCounts || []).map((item) => [item._id, item.count]));
  const canUpdate = canMutate('bookings.update');
  const metricCards = ['PENDING', 'SCHEDULED', 'SENT', 'FAILED', 'CANCELLED', 'READ'].map((status) => [status, counts[status] || 0]);

  return `
    <section class="panel notification-hero">
      <div class="panel-header">
        <div><h2>Notification Center</h2><span>Broadcast alerts go to the app bell. Inbox remains for invoices, quotes, receipts and payment documents.</span></div>
        ${canUpdate ? '<button class="primary-button compact" onclick="processDueNotifications()">Process Due</button>' : ''}
      </div>
      ${canUpdate ? `
        <form class="notification-composer" onsubmit="sendClientNotification(event)">
          <div>
            <span class="eyebrow">Send Broadcast Alert</span>
            <h3>Broadcast bell notification</h3>
            <p>Send one in-app alert to the selected audience. It appears under the bell/Alerts, not Inbox.</p>
          </div>
          <div class="form-grid">
            <div>
              <label>Audience</label>
              <select name="audience" required>
                <option value="CLIENTS">Clients</option>
                <option value="TECHNICIANS">Padi Pro Providers</option>
                <option value="ALL">Everyone</option>
              </select>
            </div>
            <div>
              <label>Title</label>
              <input name="title" maxlength="120" placeholder="Short alert title" required />
            </div>
            <div class="span-2">
              <label>Message</label>
              <textarea name="message" maxlength="600" rows="6" placeholder="Write the client-facing alert" required></textarea>
            </div>
          </div>
          <div class="review-actions">
            <button class="primary-button compact" type="submit">Send Alert</button>
            <button class="ghost-button compact" type="reset">Clear</button>
          </div>
        </form>
      ` : '<div class="empty-state">You have read-only access to notifications.</div>'}
    </section>
    <section class="panel">
      <div class="panel-header">
        <div><h2>Delivery Queue</h2><span>Review delivery status, retry failed messages and process due notifications.</span></div>
      </div>
      <form class="settings-form" onsubmit="applyNotificationFilters(event)">
        <div class="form-grid">
          <div>
            <label>Status</label>
            <select name="status">
              <option value="">All</option>
              ${(meta.statuses || []).map((status) => `<option value="${status}" ${filters.status === status ? 'selected' : ''}>${status}</option>`).join('')}
            </select>
          </div>
          <div>
            <label>Channel</label>
            <select name="channel">
              <option value="">All</option>
              ${(meta.channels || []).map((channel) => `<option value="${channel}" ${filters.channel === channel ? 'selected' : ''}>${channel}</option>`).join('')}
            </select>
          </div>
          <div>
            <label>Type</label>
            <select name="type">
              <option value="">All</option>
              ${(meta.types || []).map((type) => `<option value="${type}" ${filters.type === type ? 'selected' : ''}>${type}</option>`).join('')}
            </select>
          </div>
          <div>
            <label>User</label>
            <input name="user" value="${escapeHtml(filters.user || '')}" placeholder="email or user id" />
          </div>
          <div>
            <label>From</label>
            <input name="from" type="date" value="${escapeHtml(filters.from || '')}" />
          </div>
          <div>
            <label>To</label>
            <input name="to" type="date" value="${escapeHtml(filters.to || '')}" />
          </div>
        </div>
        <div class="review-actions">
          <button class="primary-button compact" type="submit">Apply Filters</button>
          <button class="ghost-button compact" type="button" onclick="resetNotificationFilters()">Reset</button>
        </div>
      </form>
    </section>
    <div class="metric-grid">
      ${metricCards.map(([label, value]) => `
        <article class="metric-card">
          <span>${label}</span>
          <strong>${value}</strong>
        </article>
      `).join('')}
    </div>
    <section class="panel">
      <div class="panel-header"><h2>Notifications</h2><span>${rows.length} latest</span></div>
      ${renderGenericTable(rows, ['Recipient', 'Message', 'Channel', 'Status', 'Schedule', 'Actions'], (notification) => [
        `<strong>${escapeHtml(notification.recipient?.name || 'User')}</strong><span>${escapeHtml(notification.recipient?.email || '-')}</span>`,
        `<strong>${escapeHtml(notification.title || '-')}</strong><span>${escapeHtml(notification.message || '')}</span>`,
        `${escapeHtml(notification.channel || '-')}<span>${escapeHtml(notification.type || '-')}</span>`,
        `<span class="status ${statusClass(notification.status)}">${escapeHtml(notification.status || '-')}</span>${notification.lastError ? `<span>${escapeHtml(notification.lastError)}</span>` : ''}`,
        `${formatDate(notification.scheduledAt)}<span>Sent ${formatDate(notification.sentAt)}</span>`,
        canUpdate
          ? `
              ${notification.status === 'FAILED' ? `<button class="ghost-button compact" onclick="retryNotification('${notification._id}')">Retry</button>` : ''}
              ${['PENDING', 'SCHEDULED'].includes(notification.status) ? `<button class="danger-button compact" onclick="cancelNotification('${notification._id}')">Cancel</button>` : ''}
            `
          : '<span class="status info">Read only</span>',
      ])}
    </section>
  `;
}

async function createSubscriptionPlan(event) {
  event.preventDefault();
  if (!canMutate('markets.update')) {
    alert('You do not have permission to manage subscription plans.');
    return;
  }
  const form = new FormData(event.currentTarget);
  const payload = {
    name: String(form.get('name') || '').trim(),
    description: String(form.get('description') || '').trim(),
    countryCode: String(form.get('countryCode') || '').trim().toUpperCase(),
    currency: String(form.get('currency') || '').trim().toUpperCase(),
    price: Number(form.get('price') || 0),
    billingFrequency: String(form.get('billingFrequency') || 'MONTHLY'),
    collectionFrequency: String(form.get('collectionFrequency') || 'WEEKLY'),
    collectionType: String(form.get('collectionType') || 'GENERAL_WASTE'),
    status: String(form.get('status') || 'ACTIVE'),
    binPackage: String(form.get('binPackage') || '')
      .split(',')
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean),
  };

  try {
    await api('/admin/managed-collection-subscription-plans', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    event.currentTarget.reset();
    syncPromotionCurrency(event.currentTarget.elements.countryCode);
    await refresh();
  } catch (error) {
    alert(error.message);
  }
}

async function generateSubscriptionInvoices() {
  if (!canMutate('bookings.update') && !hasPermission('finance.read')) {
    alert('You do not have permission to generate subscription invoices.');
    return;
  }
  try {
    const result = await api('/admin/managed-collection-subscriptions/generate-invoices', { method: 'POST' });
    alert(`${result.invoices?.length || 0} subscription invoices generated.`);
    await refresh();
  } catch (error) {
    alert(error.message);
  }
}

function renderSubscriptions() {
  const data = state.data.managedCollectionSubscriptions || {};
  const plans = data.plans || [];
  const subscriptions = data.subscriptions || [];
  const invoices = data.invoices || [];
  const reports = data.reports || {};
  const meta = data.meta || {};
  const canManagePlans = canMutate('markets.update');
  const mrr = (reports.monthlyRecurringRevenue || [])
    .map((row) => `${row._id}: ${moneyFromMinor(row.monthlyRecurringRevenueMinor || 0, row._id)}`)
    .join(', ') || '-';
  const cards = [
    ['MRR', mrr],
    ['Active', reports.activeSubscriptions || 0],
    ['Renewals', reports.renewals || 0],
    ['Cancelled', reports.cancelled || 0],
    ['Overdue', reports.overdue || 0],
    ['Churn', `${Math.round((reports.churn || 0) * 100)}%`],
  ];

  return `
    <div class="metric-grid">
      ${cards.map(([label, value]) => `
        <article class="metric-card">
          <span>${label}</span>
          <strong>${value}</strong>
        </article>
      `).join('')}
    </div>
    <section class="panel">
      <div class="panel-header">
        <div><h2>Renewals & Billing</h2><span>Invoices are generated only. Automatic charging is disabled.</span></div>
        <button class="primary-button compact" onclick="generateSubscriptionInvoices()">Generate Due Invoices</button>
      </div>
      ${renderGenericTable(invoices, ['Invoice', 'Customer', 'Amount', 'Status', 'Due'], (invoice) => [
        escapeHtml(invoice.invoiceNumber || '-'),
        escapeHtml(invoice.customerId || '-'),
        moneyFromMinor(invoice.amountMinor, invoice.currency),
        `<span class="status ${statusClass(invoice.status)}">${escapeHtml(invoice.status || '-')}</span>`,
        formatDate(invoice.dueAt),
      ])}
    </section>
    <section class="panel">
      <div class="panel-header"><div><h2>Plans</h2><span>${plans.length} configured</span></div></div>
      ${renderGenericTable(plans, ['Plan', 'Price', 'Billing', 'Collection', 'Status'], (plan) => [
        `<strong>${escapeHtml(plan.name || '-')}</strong><span>${escapeHtml(plan.description || '')}</span>`,
        moneyFromMinor(plan.priceMinor, plan.currency),
        `${escapeHtml(plan.billingFrequency || '-')}<span>${escapeHtml(plan.countryCode || '-')}</span>`,
        `${escapeHtml(plan.collectionFrequency || '-')}<span>${escapeHtml((plan.binPackage || []).join(', '))} - ${escapeHtml(plan.collectionType || '-')}</span>`,
        `<span class="status ${statusClass(plan.status)}">${escapeHtml(plan.status || '-')}</span>`,
      ])}
    </section>
    ${canManagePlans ? `
      <section class="panel">
        <div class="panel-header"><div><h2>Create Plan</h2><span>Managed Collection Services only.</span></div></div>
        <form class="settings-form" onsubmit="createSubscriptionPlan(event)">
          <label>Plan Name</label>
          <input name="name" required placeholder="General Waste Monthly" />
          <label>Description</label>
          <input name="description" placeholder="Weekly pickup with red, green, and blue bins" />
          <div class="form-grid">
            <div><label>Country</label><input name="countryCode" required placeholder="ZA" /></div>
            <div><label>Currency</label><input name="currency" required placeholder="ZAR" /></div>
            <div><label>Price</label><input name="price" type="number" min="0" step="0.01" required /></div>
            <div>
              <label>Billing Frequency</label>
              <select name="billingFrequency">${(meta.billingFrequencies || ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']).map((item) => `<option value="${item}">${item}</option>`).join('')}</select>
            </div>
            <div>
              <label>Collection Frequency</label>
              <select name="collectionFrequency">${(meta.collectionFrequencies || ['WEEKLY', 'TWICE_WEEKLY', 'MONTHLY']).map((item) => `<option value="${item}">${item}</option>`).join('')}</select>
            </div>
            <div>
              <label>Status</label>
              <select name="status">${(meta.planStatuses || ['ACTIVE', 'PAUSED', 'DISABLED']).map((item) => `<option value="${item}">${item}</option>`).join('')}</select>
            </div>
          </div>
          <input name="collectionType" type="hidden" value="GENERAL_WASTE" />
          <label>Bin Package</label>
          <input name="binPackage" value="RED, GREEN, BLUE" />
          <button class="primary-button compact" type="submit">Create Plan</button>
        </form>
      </section>
    ` : ''}
    <section class="panel">
      <div class="panel-header"><div><h2>Customers</h2><span>${subscriptions.length} subscriptions</span></div></div>
      ${renderGenericTable(subscriptions, ['Customer', 'Plan', 'Billing', 'Status', 'Renewal'], (subscription) => [
        `<strong>${escapeHtml(subscription.customerName || 'Client')}</strong><span>${escapeHtml(subscription.customerEmail || '-')}</span>`,
        `${escapeHtml(subscription.planName || '-')}<span>${escapeHtml(subscription.collectionType || '-')}</span>`,
        `${moneyFromMinor(subscription.priceMinor, subscription.currency)}<span>${escapeHtml(subscription.billingFrequency || '-')}</span>`,
        `<span class="status ${statusClass(subscription.status)}">${escapeHtml(subscription.status || '-')}</span>`,
        `${formatDate(subscription.renewalDate)}<span>Grace ${formatDate(subscription.gracePeriodEndsAt)}</span>`,
      ])}
    </section>
  `;
}

function renderManagedCollections() {
  const rows = state.data.managedCollections;
  const canUpdate = canMutate('bookings.update');
  return `
    <section class="panel">
      <div class="panel-header">
        <div><h2>Managed Collection Customers</h2><span>${rows.length} signups</span></div>
      </div>
      ${renderGenericTable(rows, ['Customer', 'Location', 'Collection', 'Schedule', 'Status', 'Reminders'], (profile) => {
        const reminders = remindersForProfile(profile._id);
        return [
          `<strong>${escapeHtml(profile.customerName || 'Client')}</strong><span>${escapeHtml(profile.customerEmail || '-')}</span>`,
          `${escapeHtml(profile.countryCode || '-')} - ${escapeHtml(profile.city || '-')}<span>${escapeHtml(profile.area || '')}</span>`,
          `${escapeHtml(profile.collectionType || '-')}<span>${escapeHtml((profile.binPackage || []).join(', '))} - ${escapeHtml(profile.propertyType || '-')}</span>`,
          `${escapeHtml(profile.frequency || '-')}<span>${escapeHtml(profile.preferredCollectionDay || '-')} - Next ${formatDate(profile.nextCollectionDate)}</span>`,
          `<span class="status ${statusClass(profile.status)}">${escapeHtml(profile.status || '-')}</span>`,
          reminders.length
            ? reminders.map((reminder) => `
                <div class="mini-row">
                  <span>${escapeHtml(reminder.reminderType)} - ${formatDate(reminder.scheduledFor)}</span>
                  <span class="status ${statusClass(reminder.status)}">${escapeHtml(reminder.status)}</span>
                  ${canUpdate && reminder.status !== 'CANCELLED' ? `
                    <button class="ghost-button compact" onclick="rescheduleManagedCollectionReminder('${reminder._id}')">Reschedule</button>
                    <button class="ghost-button compact" onclick="updateManagedCollectionReminder('${reminder._id}', { status: 'CANCELLED' })">Cancel</button>
                  ` : ''}
                </div>
              `).join('')
            : '<span>-</span>',
        ];
      })}
    </section>
  `;
}

function renderBookingTable(bookings) {
  if (!bookings.length) return renderEmpty('No bookings found.');
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Job</th><th>Client</th><th>Market</th><th>Status</th><th>Value</th><th>Updated</th><th></th></tr>
        </thead>
        <tbody>
          ${bookings.map((booking) => {
            const countryCode = booking.identity?.countryCode || booking.countryCode || '-';
            const currency = booking.identity?.currency || booking.currency || 'ZAR';
            return `
              <tr>
                <td><strong>${escapeHtml(booking.applianceType || '-')}</strong><span>${escapeHtml(booking.generalArea || '-')}</span></td>
                <td>${escapeHtml(booking.customerName || '-')}</td>
                <td>${escapeHtml(countryCode)} - ${escapeHtml(currency || '-')}</td>
                <td><span class="status ${statusClass(booking.status)}">${escapeHtml(booking.status)}</span></td>
                <td>${getMoney(booking, 'price', 'priceMinor', currency)}</td>
                <td>${formatDate(booking.updatedAt)}</td>
                <td><button class="ghost-button compact" onclick="openBooking('${booking._id}')">Open</button></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderQuotes() {
  const quotes = state.data.quotes;
  return `
    <section class="panel">
      <div class="panel-header"><h2>Quotes & Work Orders</h2><span>${quotes.length} latest</span></div>
      ${renderGenericTable(quotes, ['Status', 'Booking', 'Technician', 'Total', 'Sent'], (quote) => [
        `<span class="status ${statusClass(quote.status)}">${escapeHtml(quote.status)}</span>`,
        escapeHtml(quote.bookingId?.applianceType || quote.bookingId || '-'),
        escapeHtml(quote.technicianId?.name || '-'),
        getMoney(quote, 'totalAmount', 'totalAmountMinor', quote.currency),
        formatDate(quote.sentAt || quote.createdAt),
      ])}
    </section>
  `;
}

function renderInvoices() {
  const invoices = state.data.invoices;
  return `
    <section class="panel">
      <div class="panel-header"><h2>Payments & Invoices</h2><span>${invoices.length} latest</span></div>
      ${renderGenericTable(invoices, ['Invoice', 'Status', 'Total', 'Commission', 'Tech Net', 'Created'], (invoice) => [
        escapeHtml(invoice.invoiceNumber),
        `<span class="status ${statusClass(invoice.status)}">${escapeHtml(invoice.status)}</span>`,
        getMoney(invoice, 'totalAmount', 'totalAmountMinor', invoice.currency),
        getMoney(invoice, 'platformCommissionAmount', 'platformCommissionAmountMinor', invoice.currency),
        getMoney(invoice, 'technicianNetAmount', 'technicianNetAmountMinor', invoice.currency),
        formatDate(invoice.createdAt),
      ])}
    </section>
  `;
}

function renderSettlements() {
  const rows = state.data.settlements || [];
  const settlementPromotionSummary = (settlement) => {
    const breakdown = settlement.metadata?.priceBreakdown || {};
    const promotions = Array.isArray(settlement.metadata?.promotions)
      ? settlement.metadata.promotions
      : settlement.metadata?.promotion
        ? [settlement.metadata.promotion]
        : [];
    const promotionDiscountMinor = Number(breakdown.promotionDiscountMinor || promotions.reduce((sum, promotion) => sum + Number(promotion.discountMinor || 0), 0));
    if (!promotionDiscountMinor) return '<span class="status info">No promotion</span>';
    const firstPromotion = promotions[0] || {};
    const label = firstPromotion.code || firstPromotion.campaignName || firstPromotion.promotionName || 'Promotion';
    const funding = firstPromotion.fundingSource || breakdown.promotionFundingSource || 'Stored snapshot';
    return `
      <strong>${escapeHtml(label)}</strong>
      <span>${moneyFromMinor(promotionDiscountMinor, settlement.currency || 'ZAR')} discount · ${escapeHtml(funding)}</span>
      <span>MyFixer ${moneyFromMinor(Number(breakdown.promotionPlatformFundedMinor || 0), settlement.currency || 'ZAR')} · Provider ${moneyFromMinor(Number(breakdown.promotionTechnicianFundedMinor || 0), settlement.currency || 'ZAR')} · Partner ${moneyFromMinor(Number(breakdown.promotionPartnerFundedMinor || 0), settlement.currency || 'ZAR')}</span>
    `;
  };
  return `
    <section class="panel">
      <div class="panel-header"><h2>Settlement Centre</h2><span>${rows.length} latest</span></div>
      ${renderGenericTable(rows, ['Settlement', 'Booking', 'Currency', 'Gross', 'Promotion', 'Commission', 'Net', 'Status', 'Payout', 'Actions'], (settlement) => [
        escapeHtml(settlement.id || settlement._id || '-'),
        escapeHtml(settlement.bookingId || '-'),
        escapeHtml(settlement.currency || '-'),
        moneyFromMinor(settlement.grossAmountMinor || 0, settlement.currency || 'ZAR'),
        settlementPromotionSummary(settlement),
        moneyFromMinor(settlement.commissionAmountMinor || 0, settlement.currency || 'ZAR'),
        moneyFromMinor(settlement.netAmountMinor || 0, settlement.currency || 'ZAR'),
        `<span class="status ${statusClass(settlement.status)}">${escapeHtml(settlement.status || '-')}</span>`,
        escapeHtml(settlement.metadata?.payoutDestinationSnapshot?.maskedDestination || 'Not selected'),
        renderSettlementActions(settlement),
      ])}
    </section>
  `;
}

function renderSettlementActions(settlement) {
  const id = settlement.id || settlement._id;
  if (!id || !canMutate('finance.read')) return '<span class="status info">Read only</span>';
  const status = settlement.status || '';
  const approve = ['APPROVAL_REQUIRED', 'READY_FOR_PAYOUT', 'PAYOUT_FAILED'].includes(status)
    ? `<button class="ghost-button compact" onclick="approveSettlement('${id}')">Approve</button>`
    : '';
  const hold = !['PAID', 'PAYOUT_PROCESSING'].includes(status)
    ? `<button class="ghost-button compact" onclick="holdSettlement('${id}')">Hold</button>`
    : '';
  const release = status === 'ON_HOLD'
    ? `<button class="ghost-button compact" onclick="releaseSettlementHold('${id}')">Release</button>`
    : '';
  const retry = status === 'PAYOUT_FAILED'
    ? `<button class="ghost-button compact" onclick="retrySettlementPayout('${id}')">Retry</button>`
    : '';
  return `<div class="inline-actions">${approve}${hold}${release}${retry}</div>`;
}

async function approveSettlement(id) {
  const reason = window.prompt('Approval note for payout review');
  if (!reason) return;
  await api(`/admin/settlements/${id}/approve`, { method: 'POST', body: JSON.stringify({ reason }) });
  await loadAllData();
  render();
}

async function holdSettlement(id) {
  const reason = window.prompt('Reason for settlement hold');
  if (!reason) return;
  await api(`/admin/settlements/${id}/hold`, { method: 'POST', body: JSON.stringify({ reason }) });
  await loadAllData();
  render();
}

async function releaseSettlementHold(id) {
  const reason = window.prompt('Reason for releasing hold') || 'Reviewed';
  await api(`/admin/settlements/${id}/release-hold`, { method: 'POST', body: JSON.stringify({ reason }) });
  await loadAllData();
  render();
}

async function retrySettlementPayout(id) {
  const reason = window.prompt('Reason for payout retry') || 'Retry reviewed payout';
  await api(`/admin/settlements/${id}/retry-payout`, { method: 'POST', body: JSON.stringify({ reason }) });
  await loadAllData();
  render();
}

async function createPromotion(event) {
  event.preventDefault();
  await savePromotionDraft('draft');
}

function syncPromotionCurrency(select) {
  const form = select?.form;
  const currencyInput = form?.elements?.currency;
  if (!currencyInput) return;

  const selectedCurrency = select.selectedOptions?.[0]?.dataset?.currency || '';
  currencyInput.value = selectedCurrency;
  currencyInput.placeholder = selectedCurrency || 'Optional, e.g. ZAR';
}

function updatePromotionFormVisibility(form) {
  if (!form) return;
  const triggerType = String(form.elements.triggerType?.value || 'CODE').toUpperCase();
  const discountType = String(form.elements.discountType?.value || 'PERCENTAGE').toUpperCase();
  const fundingSource = String(form.elements.fundingSource?.value || 'MYFIXER').toUpperCase();
  form.querySelectorAll('[data-promo-field]').forEach((field) => {
    const key = field.dataset.promoField;
    const visible =
      (key === 'code' && triggerType === 'CODE') ||
      (key === 'discountValue' && discountType !== 'FREE_CALLOUT') ||
      (key === 'maxDiscount' && discountType === 'PERCENTAGE') ||
      (key === 'currency' && discountType !== 'PERCENTAGE') ||
      (key === 'freeCallout' && discountType === 'FREE_CALLOUT') ||
      (key === 'fundingSplit' && fundingSource === 'SHARED') ||
      !['code', 'discountValue', 'maxDiscount', 'currency', 'freeCallout', 'fundingSplit'].includes(key || '');
    field.hidden = !visible;
  });
  if (form.elements.code) form.elements.code.required = triggerType === 'CODE';
  if (form.elements.discountValue) form.elements.discountValue.required = discountType !== 'FREE_CALLOUT';
}

async function updatePromotion(id, patch) {
  if (!patch || typeof patch !== 'object') return;
  try {
    await api(`/admin/promotions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    await refresh();
  } catch (error) {
    alert(error.message);
  }
}

function getActivePromotionMarkets() {
  return (state.data.markets || []).filter((market) => getMarketView(market).status === 'ACTIVE');
}

function defaultPromotionDraft(overrides = {}) {
  const market = getActivePromotionMarkets()[0];
  const marketView = market ? getMarketView(market) : {};
  return {
    name: '',
    customerTitle: '',
    description: '',
    internalNotes: '',
    triggerType: 'AUTOMATIC',
    code: '',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    maxDiscount: '',
    minBookingAmount: '',
    countryCode: marketView.countryCode || '',
    currency: marketView.currency || '',
    cityKeys: '',
    areaKeys: '',
    serviceKeys: '',
    subcategoryKeys: '',
    firstBookingOnly: false,
    clientSegment: '',
    paymentMethod: '',
    daysOfWeek: '',
    timeWindow: '',
    fundingSource: 'MYFIXER',
    platformFundingPercent: 100,
    technicianFundingPercent: 0,
    partnerFundingPercent: 0,
    partnerReference: '',
    startsAt: '',
    expiresAt: '',
    timezone: marketView.timezone || '',
    usageLimit: '',
    perClientLimit: '',
    budget: '',
    priority: 100,
    stackingPolicy: 'EXCLUSIVE',
    maxPromotionsPerBooking: 1,
    ...overrides,
  };
}

function selectedPromotion() {
  return (state.data.promotions || []).find((promotion) => String(promotion._id) === String(state.promotionWorkspace.selectedPromotionId));
}

function setPromotionWorkspaceTab(tab) {
  state.promotionWorkspace.tab = tab;
  render();
}

function setPromotionStatusTab(tab) {
  state.promotionWorkspace.statusTab = tab;
  render();
}

function setPromotionFilter(key, value) {
  state.promotionWorkspace.filters[key] = value;
  render();
}

function clearPromotionFilters() {
  state.promotionWorkspace.statusTab = 'ALL';
  state.promotionWorkspace.filters = { search: '', mode: '', status: '', market: '', service: '', fundingSource: '', dateFrom: '', dateTo: '' };
  render();
}

function setPromotionDraftField(key, value, type = 'text') {
  const draft = { ...defaultPromotionDraft(), ...(state.promotionWorkspace.draft || {}) };
  draft[key] = type === 'checkbox' ? Boolean(value) : value;
  if (key === 'countryCode') {
    const market = getActivePromotionMarkets().find((item) => getMarketView(item).countryCode === value);
    const view = market ? getMarketView(market) : {};
    draft.currency = view.currency || '';
    draft.timezone = view.timezone || '';
  }
  if (key === 'triggerType' && value === 'AUTOMATIC') draft.code = '';
  if (key === 'fundingSource' && value !== 'SHARED') {
    draft.platformFundingPercent = value === 'MYFIXER' ? 100 : 0;
    draft.technicianFundingPercent = value === 'PROVIDER' ? 100 : 0;
    draft.partnerFundingPercent = value === 'PARTNER' ? 100 : 0;
  }
  if (key === 'stackingPolicy' && value === 'EXCLUSIVE') draft.maxPromotionsPerBooking = 1;
  state.promotionWorkspace.draft = draft;
  render();
}

function startCreatePromotion(sourceId = '') {
  const source = (state.data.promotions || []).find((promotion) => String(promotion._id) === String(sourceId));
  state.promotionWorkspace.draft = source
    ? defaultPromotionDraft({
        name: `${source.name || 'Promotion'} Copy`,
        customerTitle: source.metadata?.customerTitle || source.name || '',
        description: source.description || '',
        internalNotes: source.metadata?.internalNotes || '',
        triggerType: source.triggerType || 'AUTOMATIC',
        code: '',
        discountType: source.discountType || 'PERCENTAGE',
        discountValue: source.discountType === 'FIXED_AMOUNT' ? Number(source.discountValue || 0) / 100 : Number(source.discountValue || 0),
        maxDiscount: source.maxDiscountMinor ? Number(source.maxDiscountMinor) / 100 : '',
        minBookingAmount: source.minBookingAmountMinor ? Number(source.minBookingAmountMinor) / 100 : '',
        countryCode: source.countryCode || '',
        currency: source.currency || '',
        cityKeys: (source.cityKeys || []).join(', '),
        areaKeys: (source.areaKeys || []).join(', '),
        serviceKeys: (source.serviceKeys || []).join(', '),
        subcategoryKeys: (source.subcategoryKeys || []).join(', '),
        firstBookingOnly: source.firstBookingOnly === true,
        fundingSource: source.fundingSource || 'MYFIXER',
        platformFundingPercent: Math.round((source.fundingSplitBps?.platform || 0) / 100),
        technicianFundingPercent: Math.round((source.fundingSplitBps?.technician || 0) / 100),
        partnerFundingPercent: Math.round((source.fundingSplitBps?.partner || 0) / 100),
        budget: source.budgetMinor ? Number(source.budgetMinor) / 100 : '',
        priority: source.priority || 100,
        stackingPolicy: source.stackingPolicy || 'EXCLUSIVE',
      })
    : defaultPromotionDraft();
  state.promotionWorkspace.createStep = 0;
  state.promotionWorkspace.tab = 'create';
  render();
}

function setPromotionWizardStep(step) {
  state.promotionWorkspace.createStep = Math.max(0, Math.min(5, Number(step) || 0));
  render();
}

function buildPromotionPayload(status = 'DRAFT') {
  const draft = { ...defaultPromotionDraft(), ...(state.promotionWorkspace.draft || {}) };
  const discountType = String(draft.discountType || 'PERCENTAGE').toUpperCase();
  return {
    code: draft.triggerType === 'CODE' ? String(draft.code || '').trim().toUpperCase() : '',
    name: String(draft.name || '').trim(),
    customerTitle: String(draft.customerTitle || '').trim(),
    description: String(draft.description || '').trim(),
    internalNotes: String(draft.internalNotes || '').trim(),
    triggerType: String(draft.triggerType || 'AUTOMATIC').toUpperCase(),
    status,
    discountType,
    discountValue: discountType === 'FIXED_AMOUNT' ? Math.round(Number(draft.discountValue || 0) * 100) : Number(draft.discountValue || (discountType === 'FREE_CALLOUT' ? 1 : 0)),
    maxDiscountMinor: Math.round(Number(draft.maxDiscount || 0) * 100) || null,
    minBookingAmountMinor: Math.round(Number(draft.minBookingAmount || 0) * 100) || 0,
    countryCode: String(draft.countryCode || '').trim().toUpperCase(),
    currency: String(draft.currency || '').trim().toUpperCase(),
    cityKeys: String(draft.cityKeys || ''),
    areaKeys: String(draft.areaKeys || ''),
    serviceKeys: String(draft.serviceKeys || ''),
    subcategoryKeys: String(draft.subcategoryKeys || ''),
    firstBookingOnly: draft.firstBookingOnly === true,
    priority: Number(draft.priority || 100),
    stackingPolicy: String(draft.stackingPolicy || 'EXCLUSIVE').toUpperCase(),
    fundingSource: String(draft.fundingSource || 'MYFIXER').toUpperCase(),
    fundingSplitBps: {
      platform: Math.round(Number(draft.platformFundingPercent || 0) * 100),
      technician: Math.round(Number(draft.technicianFundingPercent || 0) * 100),
      partner: Math.round(Number(draft.partnerFundingPercent || 0) * 100),
    },
    budgetMinor: Math.round(Number(draft.budget || 0) * 100) || null,
    startsAt: String(draft.startsAt || '') || null,
    expiresAt: String(draft.expiresAt || '') || null,
    usageLimit: Number(draft.usageLimit || 0) || null,
    perClientLimit: Number(draft.perClientLimit || 0) || null,
    partnerReference: String(draft.partnerReference || ''),
  };
}

function promotionReadinessIssues() {
  const draft = { ...defaultPromotionDraft(), ...(state.promotionWorkspace.draft || {}) };
  const issues = [];
  if (!String(draft.name || '').trim()) issues.push('Campaign name');
  if (draft.triggerType === 'CODE' && !String(draft.code || '').trim()) issues.push('Promo code');
  if (!draft.countryCode) issues.push('Active market');
  if (!getActivePromotionMarkets().length) issues.push('No active market is available');
  const splitTotal = Number(draft.platformFundingPercent || 0) + Number(draft.technicianFundingPercent || 0) + Number(draft.partnerFundingPercent || 0);
  if (draft.fundingSource === 'SHARED' && Math.round(splitTotal * 100) !== 10000) issues.push('Funding split must equal 100%');
  if (draft.stackingPolicy === 'EXCLUSIVE' && Number(draft.maxPromotionsPerBooking || 1) > 1) issues.push('Exclusive campaigns cannot allow multiple promotions');
  return issues;
}

async function savePromotionDraft(action = 'draft') {
  if (!canMutate('promotions.create')) {
    alert('You do not have permission to create promotions.');
    return;
  }
  const issues = promotionReadinessIssues();
  if (action !== 'draft' && issues.length) {
    alert(`Cannot ${action} yet: ${issues.join(', ')}`);
    return;
  }
  try {
    const payload = buildPromotionPayload('DRAFT');
    const result = await api('/admin/promotions', { method: 'POST', body: JSON.stringify(payload) });
    if (action === 'activate') await api(`/admin/promotions/${result.promotion._id}/activate`, { method: 'POST' });
    state.promotionWorkspace.draft = {};
    state.promotionWorkspace.tab = 'directory';
    await refresh();
  } catch (error) {
    alert(error.message);
  }
}

async function duplicatePromotion(id) {
  if (!canMutate('promotions.create')) return;
  if (!confirm('Create a new draft copy of this campaign?')) return;
  try {
    await api(`/admin/promotions/${id}/duplicate`, { method: 'POST' });
    await refresh();
  } catch (error) {
    alert(error.message);
  }
}

async function runPromotionLifecycle(id, action) {
  const permission = action === 'activate' ? 'promotions.activate' : action === 'pause' ? 'promotions.pause' : 'promotions.archive';
  if (!canMutate(permission)) return;
  if (!confirm(`${action[0].toUpperCase()}${action.slice(1)} this promotion?`)) return;
  try {
    await api(`/admin/promotions/${id}/${action}`, { method: 'POST' });
    await refresh();
  } catch (error) {
    alert(error.message);
  }
}

async function openPromotionDetails(id, tab = 'overview') {
  state.promotionWorkspace.selectedPromotionId = id;
  state.promotionWorkspace.detailTab = tab;
  state.promotionWorkspace.tab = 'details';
  try {
    const [performance, redemptions, audit] = await Promise.all([
      hasPermission('promotions.performance.read') ? api(`/admin/promotions/${id}/performance`) : Promise.resolve({ performance: null }),
      hasPermission('promotions.redemptions.read') ? api(`/admin/promotions/${id}/redemptions`) : Promise.resolve({ redemptions: [] }),
      hasPermission('admins.read') ? api(`/admin/promotions/${id}/audit`) : Promise.resolve({ logs: [] }),
    ]);
    state.promotionWorkspace.performance = performance.performance || null;
    state.promotionWorkspace.redemptions = redemptions.redemptions || [];
    state.promotionWorkspace.audit = audit.logs || [];
  } catch (error) {
    alert(error.message);
  }
  render();
}

function promotionOffer(promotion) {
  const currency = promotion.currency || 'ZAR';
  if (promotion.discountType === 'PERCENTAGE') return `${promotion.discountValue}% off${promotion.maxDiscountMinor ? `, max ${moneyFromMinor(promotion.maxDiscountMinor, currency)}` : ''}`;
  if (promotion.discountType === 'FIXED_AMOUNT') return `${moneyFromMinor(promotion.discountValue || 0, currency)} off`;
  if (promotion.discountType === 'FREE_CALLOUT') return 'Free Call-out Fee';
  if (promotion.discountType === 'SERVICE_FEE_WAIVER') return 'Service Fee Waiver';
  if (promotion.discountType === 'CAPPED_PERCENTAGE') return `${promotion.discountValue}% capped`;
  return escapeHtml(promotion.discountType || '-');
}

function promotionScope(promotion) {
  return [promotion.countryCode || 'All markets', ...(promotion.cityKeys || []).slice(0, 2), ...(promotion.serviceKeys || []).slice(0, 2), promotion.firstBookingOnly ? 'First booking' : ''].filter(Boolean).join(' / ');
}

function promotionFundingSummary(promotion) {
  if (promotion.fundingSource === 'SHARED') {
    const split = promotion.fundingSplitBps || {};
    return `Shared ${Math.round((split.platform || 0) / 100)}%/${Math.round((split.technician || 0) / 100)}%/${Math.round((split.partner || 0) / 100)}%`;
  }
  return promotion.fundingSource || 'MYFIXER';
}

function filteredPromotions() {
  const workspace = state.promotionWorkspace;
  const filters = workspace.filters;
  return (state.data.promotions || []).filter((promotion) => {
    const displayStatus = promotion.displayStatus || promotion.status || 'DRAFT';
    const haystack = `${promotion.name || ''} ${promotion.metadata?.customerTitle || ''} ${promotion.code || ''}`.toLowerCase();
    if (workspace.statusTab !== 'ALL' && displayStatus !== workspace.statusTab) return false;
    if (filters.search && !haystack.includes(filters.search.toLowerCase())) return false;
    if (filters.mode && promotion.triggerType !== filters.mode) return false;
    if (filters.status && displayStatus !== filters.status) return false;
    if (filters.market && promotion.countryCode !== filters.market) return false;
    if (filters.service && !(promotion.serviceKeys || []).includes(filters.service)) return false;
    if (filters.fundingSource && promotion.fundingSource !== filters.fundingSource) return false;
    if (filters.dateFrom && promotion.expiresAt && new Date(promotion.expiresAt) < new Date(filters.dateFrom)) return false;
    if (filters.dateTo && promotion.startsAt && new Date(promotion.startsAt) > new Date(filters.dateTo)) return false;
    return true;
  });
}

function renderPromotionSummary() {
  const summary = state.data.promotionSummary;
  const cards = [
    ['Active Promotions', summary?.activePromotions ?? 'Not available yet'],
    ['Scheduled Promotions', summary?.scheduledPromotions ?? 'Not available yet'],
    ['Total Redemptions', summary?.totalRedemptions ?? 'Not available yet'],
    ['Total Discount Granted', summary ? moneyFromMinor(summary.totalDiscountGrantedMinor || 0, 'ZAR') : 'Not available yet'],
    ['Revenue Influenced', summary ? moneyFromMinor(summary.revenueInfluencedMinor || 0, 'ZAR') : 'Not available yet'],
    ['Remaining Campaign Budget', summary ? moneyFromMinor(summary.remainingCampaignBudgetMinor || 0, 'ZAR') : 'Not available yet'],
  ];
  return `<div class="metric-grid">${cards.map(([label, value]) => `<article class="metric-card"><span>${label}</span><strong>${value}</strong></article>`).join('')}</div>`;
}

function renderPromotionFilters() {
  const filters = state.promotionWorkspace.filters;
  const statuses = ['ALL', 'DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'EXPIRED', 'EXHAUSTED', 'ARCHIVED'];
  const markets = getActivePromotionMarkets().map((market) => getMarketView(market));
  const services = state.data.serviceCatalog || [];
  const modes = state.data.promotionMeta.triggerTypes?.length ? state.data.promotionMeta.triggerTypes : ['AUTOMATIC', 'CODE'];
  const fundingSources = state.data.promotionMeta.fundingSources?.length ? state.data.promotionMeta.fundingSources : ['MYFIXER', 'PROVIDER', 'PARTNER', 'SHARED'];
  return `
    <div class="tab-row">
      ${statuses.map((status) => `<button class="ghost-button compact ${state.promotionWorkspace.statusTab === status ? 'active' : ''}" onclick="setPromotionStatusTab('${status}')">${status === 'ALL' ? 'All' : status[0] + status.slice(1).toLowerCase()}</button>`).join('')}
    </div>
    <div class="filter-grid">
      <input aria-label="Search promotions" placeholder="Search name or code" value="${escapeHtml(filters.search)}" oninput="setPromotionFilter('search', this.value)" />
      <select aria-label="Mode" onchange="setPromotionFilter('mode', this.value)"><option value="">All modes</option>${modes.map((mode) => `<option value="${mode}" ${filters.mode === mode ? 'selected' : ''}>${mode === 'AUTOMATIC' ? 'Automatic' : 'Promo Code'}</option>`).join('')}</select>
      <select aria-label="Status" onchange="setPromotionFilter('status', this.value)"><option value="">All statuses</option>${statuses.filter((item) => item !== 'ALL').map((status) => `<option value="${status}" ${filters.status === status ? 'selected' : ''}>${status}</option>`).join('')}</select>
      <select aria-label="Market" onchange="setPromotionFilter('market', this.value)"><option value="">All active markets</option>${markets.map((market) => `<option value="${market.countryCode}" ${filters.market === market.countryCode ? 'selected' : ''}>${escapeHtml(market.countryName || market.countryCode)}</option>`).join('')}</select>
      <select aria-label="Service" onchange="setPromotionFilter('service', this.value)"><option value="">All services</option>${services.map((service) => `<option value="${escapeHtml(service.serviceKey)}" ${filters.service === service.serviceKey ? 'selected' : ''}>${escapeHtml(service.label || service.serviceKey)}</option>`).join('')}</select>
      <select aria-label="Funding" onchange="setPromotionFilter('fundingSource', this.value)"><option value="">All funding</option>${fundingSources.map((source) => `<option value="${source}" ${filters.fundingSource === source ? 'selected' : ''}>${source}</option>`).join('')}</select>
      <input aria-label="Date from" type="date" value="${escapeHtml(filters.dateFrom)}" onchange="setPromotionFilter('dateFrom', this.value)" />
      <input aria-label="Date to" type="date" value="${escapeHtml(filters.dateTo)}" onchange="setPromotionFilter('dateTo', this.value)" />
      <button class="ghost-button compact" onclick="clearPromotionFilters()">Clear Filters</button>
    </div>
  `;
}

function renderPromotionActions(promotion) {
  const id = promotion._id;
  const displayStatus = promotion.displayStatus || promotion.status || 'DRAFT';
  const actions = [`<button class="ghost-button compact" onclick="openPromotionDetails('${id}')">View</button>`];
  if (canMutate('promotions.create')) actions.push(`<button class="ghost-button compact" onclick="duplicatePromotion('${id}')">Duplicate</button>`);
  if (canMutate('promotions.activate') && ['DRAFT', 'PAUSED'].includes(displayStatus)) actions.push(`<button class="ghost-button compact" onclick="runPromotionLifecycle('${id}', 'activate')">Activate</button>`);
  if (canMutate('promotions.pause') && displayStatus === 'ACTIVE') actions.push(`<button class="ghost-button compact" onclick="runPromotionLifecycle('${id}', 'pause')">Pause</button>`);
  if (canMutate('promotions.archive') && !['ARCHIVED', 'ENDED'].includes(displayStatus)) actions.push(`<button class="ghost-button compact" onclick="runPromotionLifecycle('${id}', 'end')">End</button>`);
  if (canMutate('promotions.archive') && displayStatus !== 'ARCHIVED') actions.push(`<button class="ghost-button compact" onclick="runPromotionLifecycle('${id}', 'archive')">Archive</button>`);
  if (hasPermission('promotions.performance.read')) actions.push(`<button class="ghost-button compact" onclick="openPromotionDetails('${id}', 'performance')">Performance</button>`);
  if (hasPermission('promotions.redemptions.read')) actions.push(`<button class="ghost-button compact" onclick="openPromotionDetails('${id}', 'redemptions')">Redemptions</button>`);
  if (hasPermission('admins.read')) actions.push(`<button class="ghost-button compact" onclick="openPromotionDetails('${id}', 'audit')">Audit</button>`);
  return `<div class="action-cluster">${actions.join('')}</div>`;
}

function renderPromotionDirectory() {
  const promotions = filteredPromotions();
  return `
    <section class="panel">
      <div class="panel-header">
        <div><h2>Campaign Directory</h2><span>${promotions.length} campaigns</span></div>
        ${canMutate('promotions.create') ? '<button class="primary-button compact" onclick="startCreatePromotion()">Create Promotion</button>' : ''}
      </div>
      ${renderPromotionFilters()}
      ${promotions.length ? renderGenericTable(promotions, ['Promotion', 'Mode', 'Offer', 'Scope', 'Schedule', 'Usage', 'Budget', 'Funding', 'Status', 'Actions'], (promotion) => [
        `<strong>${escapeHtml(promotion.metadata?.customerTitle || promotion.name || '-')}</strong><span>${promotion.metadata?.customerTitle && promotion.metadata.customerTitle !== promotion.name ? escapeHtml(promotion.name) : ''}${promotion.triggerType === 'CODE' && promotion.code ? ` ${escapeHtml(promotion.code)}` : ''}</span>`,
        `<span class="status info">${promotion.triggerType === 'AUTOMATIC' ? 'Automatic' : 'Promo Code'}</span>`,
        promotionOffer(promotion),
        escapeHtml(promotionScope(promotion)),
        `${formatDate(promotion.startsAt)}<span>${formatDate(promotion.expiresAt)} ${promotion.metadata?.timezone ? escapeHtml(promotion.metadata.timezone) : ''}</span>`,
        `${promotion.usageCount || 0}${promotion.usageLimit ? ` of ${promotion.usageLimit}` : ' redemptions'}<span>${promotion.usageLimit ? '' : 'Unlimited'}</span>`,
        `${promotion.budgetMinor ? `${moneyFromMinor(promotion.redeemedBudgetMinor || 0, promotion.currency || 'ZAR')} of ${moneyFromMinor(promotion.budgetMinor, promotion.currency || 'ZAR')} used` : 'Unlimited'}<span>${promotion.budgetMinor ? `${Math.min(100, Math.round(((promotion.redeemedBudgetMinor || 0) / promotion.budgetMinor) * 100))}% used` : 'No budget cap'}</span>`,
        escapeHtml(promotionFundingSummary(promotion)),
        `<span class="status ${statusClass(promotion.displayStatus || promotion.status)}">${escapeHtml(promotion.displayStatus || promotion.status || 'DRAFT')}</span>`,
        renderPromotionActions(promotion),
      ]) : `<div class="empty"><strong>No promotions have been created yet.</strong><p>Create an automatic offer or promo-code campaign to encourage bookings.</p>${canMutate('promotions.create') ? '<button class="primary-button compact" onclick="startCreatePromotion()">Create Promotion</button>' : ''}</div>`}
    </section>
  `;
}

function renderPromotionWizard() {
  const draft = { ...defaultPromotionDraft(), ...(state.promotionWorkspace.draft || {}) };
  const steps = ['Basics', 'Discount', 'Eligibility', 'Funding', 'Schedule & Limits', 'Preview & Save'];
  const step = state.promotionWorkspace.createStep;
  const activeMarkets = getActivePromotionMarkets().map((market) => getMarketView(market));
  const services = state.data.serviceCatalog || [];
  const selectedService = services.find((service) => service.serviceKey === draft.serviceKeys);
  const issues = promotionReadinessIssues();
  return `
    <section class="panel">
      <div class="panel-header"><div><h2>Create Promotion</h2><span>New campaigns save as DRAFT first.</span></div><button class="ghost-button compact" onclick="setPromotionWorkspaceTab('directory')">Back to Directory</button></div>
      <div class="tab-row">${steps.map((label, index) => `<button class="ghost-button compact ${step === index ? 'active' : ''}" onclick="setPromotionWizardStep(${index})">${index + 1}. ${label}</button>`).join('')}</div>
      <form class="settings-form" data-promotion-form onsubmit="createPromotion(event)">
        ${step === 0 ? `
          <label>Internal Campaign Name</label><input required value="${escapeHtml(draft.name)}" oninput="setPromotionDraftField('name', this.value)" />
          <label>Customer-facing Title</label><input value="${escapeHtml(draft.customerTitle)}" oninput="setPromotionDraftField('customerTitle', this.value)" />
          <label>Customer-facing Description</label><textarea rows="3" oninput="setPromotionDraftField('description', this.value)">${escapeHtml(draft.description)}</textarea>
          <label>Internal Admin Notes</label><textarea rows="3" oninput="setPromotionDraftField('internalNotes', this.value)">${escapeHtml(draft.internalNotes)}</textarea>
          <div class="form-grid"><div><label>Promotion Mode</label><select onchange="setPromotionDraftField('triggerType', this.value)"><option value="AUTOMATIC" ${draft.triggerType === 'AUTOMATIC' ? 'selected' : ''}>Apply Automatically</option><option value="CODE" ${draft.triggerType === 'CODE' ? 'selected' : ''}>Promo Code</option></select></div>${draft.triggerType === 'CODE' ? `<div><label>Promo Code</label><input required value="${escapeHtml(draft.code)}" oninput="setPromotionDraftField('code', this.value.toUpperCase().replace(/\\\\s+/g, ''))" /><p class="setting-help tight">Codes are normalized and matched case-insensitively.</p></div>` : ''}</div>
        ` : ''}
        ${step === 1 ? `
          <div class="form-grid"><div><label>Discount Type</label><select onchange="setPromotionDraftField('discountType', this.value)">${['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_CALLOUT', 'SERVICE_FEE_WAIVER', 'CAPPED_PERCENTAGE'].map((type) => `<option value="${type}" ${draft.discountType === type ? 'selected' : ''}>${type}</option>`).join('')}</select></div>${!['FREE_CALLOUT', 'SERVICE_FEE_WAIVER'].includes(draft.discountType) ? `<div><label>${draft.discountType === 'FIXED_AMOUNT' ? 'Amount' : 'Percentage'}</label><input type="number" min="0" step="0.01" value="${escapeHtml(draft.discountValue)}" oninput="setPromotionDraftField('discountValue', this.value)" /></div>` : ''}</div>
          ${['PERCENTAGE', 'CAPPED_PERCENTAGE'].includes(draft.discountType) ? `<label>Maximum Discount Cap</label><input type="number" min="0" step="0.01" value="${escapeHtml(draft.maxDiscount)}" oninput="setPromotionDraftField('maxDiscount', this.value)" /><p class="setting-help tight">Eligible line items are resolved by backend pricing.</p>` : ''}
          ${draft.discountType === 'FREE_CALLOUT' ? '<p class="setting-help">This promotion waives the eligible Call-out Fee.</p>' : ''}
          ${draft.discountType === 'SERVICE_FEE_WAIVER' ? '<p class="setting-help">This affects the client service fee, not provider earnings automatically.</p>' : ''}
        ` : ''}
        ${step === 2 ? `
          ${activeMarkets.length ? '' : '<p class="empty">No active market exists. You can save a DRAFT, but activation is blocked until a market is active.</p>'}
          <div class="form-grid"><div><label>Active Market</label><select onchange="setPromotionDraftField('countryCode', this.value)"><option value="">Select active market</option>${activeMarkets.map((market) => `<option value="${market.countryCode}" ${draft.countryCode === market.countryCode ? 'selected' : ''}>${escapeHtml(market.countryName || market.countryCode)}</option>`).join('')}</select></div><div><label>Currency</label><input value="${escapeHtml(draft.currency)}" readonly /></div></div>
          <div class="form-grid"><div><label>Cities</label><input value="${escapeHtml(draft.cityKeys)}" placeholder="city keys" oninput="setPromotionDraftField('cityKeys', this.value)" /></div><div><label>Areas</label><input value="${escapeHtml(draft.areaKeys)}" placeholder="area keys" oninput="setPromotionDraftField('areaKeys', this.value)" /></div></div>
          <div class="form-grid"><div><label>Service</label><select onchange="setPromotionDraftField('serviceKeys', this.value)"><option value="">All published services</option>${services.map((service) => `<option value="${escapeHtml(service.serviceKey)}" ${draft.serviceKeys === service.serviceKey ? 'selected' : ''}>${escapeHtml(service.label || service.serviceKey)}</option>`).join('')}</select></div><div><label>Subcategory</label><select onchange="setPromotionDraftField('subcategoryKeys', this.value)"><option value="">All subcategories</option>${(selectedService?.subcategories || []).map((sub) => `<option value="${escapeHtml(sub.subcategoryKey)}" ${draft.subcategoryKeys === sub.subcategoryKey ? 'selected' : ''}>${escapeHtml(sub.label || sub.subcategoryKey)}</option>`).join('')}</select></div></div>
          <div class="form-grid"><label class="inline-check"><input type="checkbox" ${draft.firstBookingOnly ? 'checked' : ''} onchange="setPromotionDraftField('firstBookingOnly', this.checked, 'checkbox')" /> First booking</label><div><label>Minimum Subtotal</label><input type="number" min="0" step="0.01" value="${escapeHtml(draft.minBookingAmount)}" oninput="setPromotionDraftField('minBookingAmount', this.value)" /></div></div>
          <div class="form-grid"><div><label>Client Segment</label><select onchange="setPromotionDraftField('clientSegment', this.value)"><option value="">Any clients</option><option value="NEW" ${draft.clientSegment === 'NEW' ? 'selected' : ''}>New clients</option><option value="RETURNING" ${draft.clientSegment === 'RETURNING' ? 'selected' : ''}>Returning clients</option></select></div><div><label>Payment Method</label><input value="${escapeHtml(draft.paymentMethod)}" oninput="setPromotionDraftField('paymentMethod', this.value)" /></div></div>
          <div class="form-grid"><div><label>Days of Week</label><input value="${escapeHtml(draft.daysOfWeek)}" placeholder="MON,TUE" oninput="setPromotionDraftField('daysOfWeek', this.value)" /></div><div><label>Time Window</label><input value="${escapeHtml(draft.timeWindow)}" placeholder="09:00-17:00" oninput="setPromotionDraftField('timeWindow', this.value)" /></div></div>
        ` : ''}
        ${step === 3 ? `
          <label>Funding Source</label><select onchange="setPromotionDraftField('fundingSource', this.value)">${['MYFIXER', 'PROVIDER', 'PARTNER', 'SHARED'].map((source) => `<option value="${source}" ${draft.fundingSource === source ? 'selected' : ''}>${source}</option>`).join('')}</select>
          ${draft.fundingSource === 'MYFIXER' ? '<p class="setting-help">Technician earnings are not reduced by this promotion.</p>' : ''}
          ${draft.fundingSource === 'PROVIDER' ? '<p class="setting-help">The provider-funded portion may reduce provider earnings.</p>' : ''}
          ${draft.fundingSource === 'PARTNER' ? `<label>Partner Reference</label><input value="${escapeHtml(draft.partnerReference)}" oninput="setPromotionDraftField('partnerReference', this.value)" />` : ''}
          ${draft.fundingSource === 'SHARED' ? `<div class="form-grid"><div><label>MyFixer %</label><input type="number" min="0" max="100" value="${escapeHtml(draft.platformFundingPercent)}" oninput="setPromotionDraftField('platformFundingPercent', this.value)" /></div><div><label>Provider %</label><input type="number" min="0" max="100" value="${escapeHtml(draft.technicianFundingPercent)}" oninput="setPromotionDraftField('technicianFundingPercent', this.value)" /></div><div><label>Partner %</label><input type="number" min="0" max="100" value="${escapeHtml(draft.partnerFundingPercent)}" oninput="setPromotionDraftField('partnerFundingPercent', this.value)" /></div></div><p class="setting-help tight">Shared funding splits must total 100%.</p>` : ''}
        ` : ''}
        ${step === 4 ? `
          <div class="form-grid"><div><label>Start Date/Time</label><input type="datetime-local" value="${escapeHtml(draft.startsAt)}" oninput="setPromotionDraftField('startsAt', this.value)" /></div><div><label>End Date/Time</label><input type="datetime-local" value="${escapeHtml(draft.expiresAt)}" oninput="setPromotionDraftField('expiresAt', this.value)" /></div></div>
          <label>Timezone</label><input value="${escapeHtml(draft.timezone)}" oninput="setPromotionDraftField('timezone', this.value)" />
          <div class="form-grid"><div><label>Total Usage Limit</label><input type="number" min="0" value="${escapeHtml(draft.usageLimit)}" oninput="setPromotionDraftField('usageLimit', this.value)" /></div><div><label>Per-client Usage Limit</label><input type="number" min="0" value="${escapeHtml(draft.perClientLimit)}" oninput="setPromotionDraftField('perClientLimit', this.value)" /></div></div>
          <div class="form-grid"><div><label>Campaign Budget</label><input type="number" min="0" step="0.01" value="${escapeHtml(draft.budget)}" oninput="setPromotionDraftField('budget', this.value)" /></div><div><label>Priority</label><input type="number" min="0" value="${escapeHtml(draft.priority)}" oninput="setPromotionDraftField('priority', this.value)" /><p class="setting-help tight">Higher priority campaigns are selected before lower priority ones.</p></div></div>
          <div class="form-grid"><div><label>Stacking</label><select onchange="setPromotionDraftField('stackingPolicy', this.value)"><option value="EXCLUSIVE" ${draft.stackingPolicy === 'EXCLUSIVE' ? 'selected' : ''}>Stacking disabled</option><option value="STACKABLE" ${draft.stackingPolicy === 'STACKABLE' ? 'selected' : ''}>Stackable</option></select></div><div><label>Maximum Promotions per Booking</label><input type="number" min="1" value="${escapeHtml(draft.maxPromotionsPerBooking)}" oninput="setPromotionDraftField('maxPromotionsPerBooking', this.value)" /></div></div>
        ` : ''}
        ${step === 5 ? `
          <div class="metric-grid"><article class="metric-card"><span>Original amount</span><strong>Not available yet</strong></article><article class="metric-card"><span>Promotion discount</span><strong>${promotionOffer(buildPromotionPayload('DRAFT'))}</strong></article><article class="metric-card"><span>Service fee</span><strong>Backend preview</strong></article><article class="metric-card"><span>Tax</span><strong>Backend preview</strong></article><article class="metric-card"><span>Total</span><strong>Backend approved at pricing</strong></article></div>
          <div class="metric-grid"><article class="metric-card"><span>MyFixer contribution</span><strong>${draft.platformFundingPercent || 0}%</strong></article><article class="metric-card"><span>Provider contribution</span><strong>${draft.technicianFundingPercent || 0}%</strong></article><article class="metric-card"><span>Partner contribution</span><strong>${draft.partnerFundingPercent || 0}%</strong></article><article class="metric-card"><span>Estimated technician impact</span><strong>${['MYFIXER', 'PARTNER'].includes(draft.fundingSource) ? 'No reduction' : 'Provider portion only'}</strong></article></div>
          <div class="mini-card"><strong>Activation Readiness</strong><p>${issues.length ? escapeHtml(issues.join(', ')) : 'Ready for lifecycle validation.'}</p></div>
        ` : ''}
        <div class="action-cluster">
          ${step > 0 ? `<button class="ghost-button" type="button" onclick="setPromotionWizardStep(${step - 1})">Previous</button>` : ''}
          ${step < 5 ? `<button class="ghost-button" type="button" onclick="setPromotionWizardStep(${step + 1})">Next</button>` : ''}
          <button class="primary-button" type="submit">Save Draft</button>
          ${step === 5 && canMutate('promotions.activate') ? `<button class="ghost-button" type="button" onclick="savePromotionDraft('activate')" ${issues.length ? 'disabled' : ''}>Activate</button>` : ''}
        </div>
      </form>
    </section>
  `;
}

function renderPromotionDetails() {
  const promotion = selectedPromotion();
  if (!promotion) return '<section class="panel"><div class="empty">Promotion not found.</div></section>';
  const tabs = ['overview', 'eligibility', 'funding', 'performance', 'redemptions', 'audit'];
  const tab = state.promotionWorkspace.detailTab || 'overview';
  const performance = state.promotionWorkspace.performance;
  const redemptions = state.promotionWorkspace.redemptions || [];
  const audit = state.promotionWorkspace.audit || [];
  return `
    <section class="panel">
      <div class="panel-header"><div><h2>${escapeHtml(promotion.metadata?.customerTitle || promotion.name)}</h2><span>${promotion.triggerType === 'CODE' && promotion.code ? escapeHtml(promotion.code) : promotion.triggerType === 'AUTOMATIC' ? 'Automatic campaign' : ''}</span></div><button class="ghost-button compact" onclick="setPromotionWorkspaceTab('directory')">Back to Directory</button></div>
      <div class="tab-row">${tabs.map((item) => `<button class="ghost-button compact ${tab === item ? 'active' : ''}" onclick="openPromotionDetails('${promotion._id}', '${item}')">${item[0].toUpperCase()}${item.slice(1)}</button>`).join('')}</div>
      ${tab === 'overview' ? `<div class="metric-grid"><article class="metric-card"><span>Offer</span><strong>${promotionOffer(promotion)}</strong></article><article class="metric-card"><span>Status</span><strong>${escapeHtml(promotion.displayStatus || promotion.status)}</strong></article><article class="metric-card"><span>Usage</span><strong>${promotion.usageCount || 0}${promotion.usageLimit ? ` / ${promotion.usageLimit}` : ''}</strong></article><article class="metric-card"><span>Budget</span><strong>${promotion.budgetMinor ? moneyFromMinor(promotion.redeemedBudgetMinor || 0, promotion.currency || 'ZAR') : 'Unlimited'}</strong></article></div>` : ''}
      ${tab === 'eligibility' ? `<div class="mini-card"><strong>Readable Rules</strong><p>${escapeHtml(promotionScope(promotion))}</p><p>Minimum subtotal: ${moneyFromMinor(promotion.minBookingAmountMinor || 0, promotion.currency || 'ZAR')}</p><p>${promotion.firstBookingOnly ? 'First booking only' : 'All eligible clients'}</p></div>` : ''}
      ${tab === 'funding' ? `<div class="metric-grid"><article class="metric-card"><span>Funding Source</span><strong>${escapeHtml(promotion.fundingSource || 'MYFIXER')}</strong></article><article class="metric-card"><span>Split</span><strong>${escapeHtml(promotionFundingSummary(promotion))}</strong></article><article class="metric-card"><span>Total Funded Discount</span><strong>${moneyFromMinor(promotion.redeemedBudgetMinor || 0, promotion.currency || 'ZAR')}</strong></article><article class="metric-card"><span>Provider Impact</span><strong>${['MYFIXER', 'PARTNER'].includes(promotion.fundingSource) ? 'No reduction' : 'Provider portion only'}</strong></article></div>` : ''}
      ${tab === 'performance' ? (performance ? `<div class="metric-grid">${Object.entries(performance).map(([key, value]) => `<article class="metric-card"><span>${escapeHtml(key)}</span><strong>${value === null ? 'Not available yet' : key.toLowerCase().includes('minor') ? moneyFromMinor(value, promotion.currency || 'ZAR') : escapeHtml(value)}</strong></article>`).join('')}</div>` : '<div class="empty">No campaign performance data is available yet.</div>') : ''}
      ${tab === 'redemptions' ? (redemptions.length ? renderGenericTable(redemptions, ['Client', 'Booking', 'State', 'Discount', 'Funding', 'Reserved At', 'Redeemed At'], (row) => [escapeHtml(row.clientId || '-'), escapeHtml(row.bookingId || '-'), `<span class="status ${statusClass(row.state)}">${escapeHtml(row.state || '-')}</span>`, moneyFromMinor(row.discountMinor || 0, promotion.currency || 'ZAR'), escapeHtml(row.fundingSource || '-'), formatDate(row.reservedAt), formatDate(row.redeemedAt)]) : '<div class="empty">No clients have redeemed this promotion yet.</div>') : ''}
      ${tab === 'audit' ? (audit.length ? renderGenericTable(audit, ['Administrator', 'Action', 'Timestamp', 'Result'], (log) => [escapeHtml(log.actor?.email || '-'), escapeHtml(log.event?.action || '-'), formatDate(log.createdAt), log.success === false ? '<span class="status bad">Failed</span>' : '<span class="status good">Success</span>']) : '<div class="empty">No audit history is available yet.</div>') : ''}
      ${promotion.hasActivity ? '<p class="setting-help">This campaign has redemptions. Material financial changes require a new version.</p>' : ''}
    </section>
  `;
}

function renderPromotionsWorkspace() {
  const tab = state.promotionWorkspace.tab || 'directory';
  return `
    <section class="panel">
      <div class="panel-header"><div><h2>Promotions</h2><span>Campaign management workspace</span></div></div>
      <div class="tab-row">
        <button class="ghost-button compact ${tab === 'directory' ? 'active' : ''}" onclick="setPromotionWorkspaceTab('directory')">Campaign Directory</button>
        ${canMutate('promotions.create') ? `<button class="ghost-button compact ${tab === 'create' ? 'active' : ''}" onclick="startCreatePromotion()">Create Promotion</button>` : ''}
        ${state.promotionWorkspace.selectedPromotionId ? `<button class="ghost-button compact ${tab === 'details' ? 'active' : ''}" onclick="setPromotionWorkspaceTab('details')">Promotion Details</button>` : ''}
      </div>
    </section>
    ${renderPromotionSummary()}
    ${tab === 'create' ? renderPromotionWizard() : tab === 'details' ? renderPromotionDetails() : renderPromotionDirectory()}
  `;
}

function renderPromotions() {
  return renderPromotionsWorkspace();
  const promotions = state.data.promotions || [];
  const discountTypes = state.data.promotionMeta.discountTypes.length
    ? state.data.promotionMeta.discountTypes
    : ['PERCENTAGE', 'FIXED_AMOUNT'];
  const triggerTypes = state.data.promotionMeta.triggerTypes?.length ? state.data.promotionMeta.triggerTypes : ['AUTOMATIC', 'CODE'];
  const fundingSources = state.data.promotionMeta.fundingSources?.length ? state.data.promotionMeta.fundingSources : ['MYFIXER', 'PROVIDER', 'PARTNER', 'SHARED'];
  const stackingPolicies = state.data.promotionMeta.stackingPolicies?.length ? state.data.promotionMeta.stackingPolicies : ['EXCLUSIVE', 'STACKABLE'];
  return `
    <div class="two-column">
      <section class="panel">
        <div class="panel-header"><h2>Promotions</h2><span>${promotions.length} campaigns</span></div>
        ${renderGenericTable(promotions, ['Campaign', 'Discount', 'Targeting', 'Budget', 'Usage', 'Status', 'Actions'], (promotion) => [
          `<strong>${escapeHtml(promotion.name || '-')}</strong><span>${escapeHtml(promotion.triggerType || 'CODE')}${promotion.code ? ` · ${escapeHtml(promotion.code)}` : ''}</span>`,
          promotion.discountType === 'PERCENTAGE'
            ? `${escapeHtml(promotion.discountValue)}%<span>Max ${promotion.maxDiscountMinor ? moneyFromMinor(promotion.maxDiscountMinor, promotion.currency || 'ZAR') : 'No cap'}</span>`
            : `${moneyFromMinor(promotion.discountValue, promotion.currency || 'ZAR')}<span>Fixed amount</span>`,
          `${escapeHtml(promotion.countryCode || 'All countries')}<span>${escapeHtml([...(promotion.cityKeys || []), ...(promotion.areaKeys || []), ...(promotion.serviceKeys || [])].join(', ') || 'All scopes')}</span>`,
          `${promotion.budgetMinor ? moneyFromMinor(promotion.budgetMinor, promotion.currency || 'ZAR') : 'No cap'}<span>Redeemed ${moneyFromMinor(promotion.redeemedBudgetMinor || 0, promotion.currency || 'ZAR')}</span>`,
          `${promotion.usageCount || 0}<span>${promotion.usageLimit ? `of ${promotion.usageLimit}` : 'unlimited'} · ${escapeHtml(promotion.fundingSource || 'MYFIXER')}</span>`,
          `<span class="status ${statusClass(promotion.status)}">${escapeHtml(promotion.status)}</span>`,
          `<div class="action-cluster"><button class="ghost-button compact" onclick="updatePromotion('${promotion._id}', { status: '${promotion.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'}' })">${promotion.status === 'ACTIVE' ? 'Pause' : 'Activate'}</button><button class="ghost-button compact" onclick="updatePromotion('${promotion._id}', { status: 'ENDED' })">End</button><button class="ghost-button compact" onclick="updatePromotion('${promotion._id}', { status: 'ARCHIVED' })">Archive</button></div>`,
        ])}
      </section>
      <section class="panel">
        <div class="panel-header"><h2>Create Campaign</h2><span>Automatic or code-based discounts</span></div>
        <form class="settings-form" data-promotion-form onsubmit="createPromotion(event)" oninput="updatePromotionFormVisibility(this)" onchange="updatePromotionFormVisibility(this)">
          <div class="form-grid">
            <div>
              <label>Trigger</label>
              <select name="triggerType">
                ${triggerTypes.map((type) => `<option value="${type}">${type}</option>`).join('')}
              </select>
            </div>
            <div data-promo-field="code">
              <label>Promo Code</label>
              <input name="code" placeholder="Required for CODE campaigns" />
            </div>
          </div>
          <label>Name</label>
          <input name="name" required placeholder="Launch discount" />
          <label>Description</label>
          <input name="description" placeholder="Optional internal note" />
          <div class="form-grid">
            <div>
              <label>Discount Type</label>
              <select name="discountType">
                ${discountTypes.map((type) => `<option value="${type}">${type}</option>`).join('')}
              </select>
            </div>
            <div data-promo-field="discountValue">
              <label>Discount Value</label>
              <input name="discountValue" type="number" min="0" step="0.01" required placeholder="10" />
            </div>
          </div>
          <div class="form-grid">
            <div>
              <label>Status</label>
              <select name="status">
                <option value="DRAFT">DRAFT</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="PAUSED">PAUSED</option>
                <option value="EXPIRED">EXPIRED</option>
                <option value="ENDED">ENDED</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>
            </div>
            <div data-promo-field="maxDiscount">
              <label>Max Discount Amount</label>
              <input name="maxDiscount" type="number" min="0" step="0.01" placeholder="0 for no cap" />
            </div>
          </div>
          <p class="setting-help tight" data-promo-field="freeCallout">Free call-out campaigns discount the configured call-out fee only. Repairs and parts still follow quote approval.</p>
          <div class="form-grid">
            <div>
              <label>Minimum Booking Amount</label>
              <input name="minBookingAmount" type="number" min="0" step="0.01" placeholder="0" />
            </div>
            <div>
              <label>Applies to Booking Country</label>
              <select name="countryCode" onchange="syncPromotionCurrency(this)">
                <option value="">All configured countries</option>
                ${renderCountryOptions('')}
              </select>
              <p class="setting-help tight">Checked against the booking market/location, not just the client profile.</p>
            </div>
          </div>
          <div data-promo-field="currency">
            <label>Currency</label>
            <input name="currency" placeholder="Optional, e.g. ZAR" />
            <p class="setting-help tight">Auto-filled from the selected country. Leave blank only for multi-currency/global promos.</p>
          </div>
          <div class="form-grid">
            <div>
              <label>City Keys</label>
              <input name="cityKeys" placeholder="Optional CSV, e.g. johannesburg" />
            </div>
            <div>
              <label>Area Keys</label>
              <input name="areaKeys" placeholder="Optional CSV, e.g. bryanston" />
            </div>
          </div>
          <div class="form-grid">
            <div>
              <label>Service Keys</label>
              <input name="serviceKeys" placeholder="Optional CSV, e.g. plumbing,electrical" />
            </div>
            <div>
              <label>Subcategory Keys</label>
              <input name="subcategoryKeys" placeholder="Optional CSV" />
            </div>
          </div>
          <div class="form-grid">
            <div>
              <label>Priority</label>
              <input name="priority" type="number" min="0" step="1" value="100" />
            </div>
            <div>
              <label>Stacking</label>
              <select name="stackingPolicy">
                ${stackingPolicies.map((policy) => `<option value="${policy}">${policy}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-grid">
            <div>
              <label>Campaign Budget</label>
              <input name="budget" type="number" min="0" step="0.01" placeholder="0 for uncapped" />
            </div>
            <div>
              <label>Funding Source</label>
              <select name="fundingSource">
                ${fundingSources.map((source) => `<option value="${source}">${source}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-grid" data-promo-field="fundingSplit">
            <div><label>MyFixer Funding %</label><input name="platformFundingPercent" type="number" min="0" max="100" step="0.01" value="100" /></div>
            <div><label>Provider Funding %</label><input name="technicianFundingPercent" type="number" min="0" max="100" step="0.01" value="0" /></div>
          </div>
          <div data-promo-field="fundingSplit"><label>Partner Funding %</label><input name="partnerFundingPercent" type="number" min="0" max="100" step="0.01" value="0" /><p class="setting-help tight">Shared funding splits must total 100%.</p></div>
          <label>Eligible Client IDs</label>
          <input name="eligibleClientIds" placeholder="Optional CSV of client IDs" />
          <label>Excluded Client IDs</label>
          <input name="excludedClientIds" placeholder="Optional CSV of client IDs" />
          <label class="inline-check"><input name="firstBookingOnly" type="checkbox" /> First booking only</label>
          <div class="form-grid">
            <div>
              <label>Starts At</label>
              <input name="startsAt" type="datetime-local" />
            </div>
            <div>
              <label>Expires At</label>
              <input name="expiresAt" type="datetime-local" />
            </div>
          </div>
          <div class="form-grid">
            <div>
              <label>Total Usage Limit</label>
              <input name="usageLimit" type="number" min="0" step="1" placeholder="0 for unlimited" />
            </div>
            <div>
              <label>Per Client Limit</label>
              <input name="perClientLimit" type="number" min="0" step="1" placeholder="0 for unlimited" />
            </div>
          </div>
          <button class="primary-button" type="submit">Create Promo</button>
        </form>
      </section>
    </div>
  `;
}

function renderLedger() {
  const rows = state.data.ledger;
  return `
    <section class="panel">
      <div class="panel-header"><h2>Wallet Ledger</h2><span>${rows.length} latest</span></div>
      ${renderGenericTable(rows, ['Type', 'Status', 'Technician', 'Amount', 'Description', 'Created'], (row) => [
        escapeHtml(row.type),
        `<span class="status ${statusClass(row.status)}">${escapeHtml(row.status)}</span>`,
        escapeHtml(row.technicianId?.name || '-'),
        getMoney(row, 'amount', 'amountMinor', row.currency),
        escapeHtml(row.description || '-'),
        formatDate(row.createdAt),
      ])}
    </section>
  `;
}

function renderAdminUsers() {
  const roles = state.data.adminMeta.roles.length ? state.data.adminMeta.roles : ['READ_ONLY_ADMIN'];
  const canCreateAdmins = canMutate('admins.create');
  const canUpdateAdmins = canMutate('admins.update');
  return `
    <div class="two-column admin-users-layout">
      <section class="panel">
        <div class="panel-header">
          <h2>Internal Staff</h2>
          <span>${state.data.adminUsers.length} users</span>
        </div>
        ${renderGenericTable(state.data.adminUsers, ['Name', 'Role', 'Status', 'Email', 'Actions'], (admin) => [
          `<strong>${escapeHtml(admin.name)}</strong><span>${escapeHtml(admin.phone || '-')}</span>`,
          `<span class="status info">${escapeHtml(admin.adminRole || 'SUPER_ADMIN')}</span>`,
          admin.isActive === false ? '<span class="status bad">INACTIVE</span>' : '<span class="status good">ACTIVE</span>',
          escapeHtml(admin.email),
          canUpdateAdmins
            ? `
              <select onchange="updateAdminUser('${admin._id}', { adminRole: this.value })">
                ${roles.map((role) => `<option value="${role}" ${role === admin.adminRole ? 'selected' : ''}>${role}</option>`).join('')}
              </select>
              ${renderServiceActivationToggle(admin)}
              ${renderClientContactToggle(admin)}
              <button class="ghost-button compact" onclick="updateAdminUser('${admin._id}', { isActive: ${admin.isActive === false ? 'true' : 'false'} })">${admin.isActive === false ? 'Activate' : 'Deactivate'}</button>
            `
            : '<span class="status info">Read only</span>',
        ])}
      </section>

      <section class="panel">
        <div class="panel-header"><h2>Create Users</h2><span>${canCreateAdmins ? 'Super admin only' : 'Admin access required'}</span></div>
        <form class="settings-form" onsubmit="${canCreateAdmins ? 'createAdminUser(event)' : 'event.preventDefault()'}">
          <label>Name</label>
          <input name="name" required placeholder="Operations Manager" ${canCreateAdmins ? '' : 'disabled'} />
          <label>Email</label>
          <input name="email" type="email" required placeholder="ops@myfixer.com" ${canCreateAdmins ? '' : 'disabled'} />
          <label>Phone</label>
          <input name="phone" required placeholder="+27000000000" ${canCreateAdmins ? '' : 'disabled'} />
          <p class="setting-help">A secure temporary password is generated automatically and sent by onboarding email.</p>
          <div class="form-grid">
            <div>
              <label>Role</label>
              <select name="adminRole" ${canCreateAdmins ? '' : 'disabled'}>
                ${roles.map((role) => `<option value="${role}">${role}</option>`).join('')}
              </select>
            </div>
            <div>
              <label>Country</label>
              <select name="countryCode" ${canCreateAdmins ? '' : 'disabled'}>
                ${renderCountryOptions('ZA')}
              </select>
            </div>
          </div>
          <label>City</label>
          <input name="city" placeholder="Head Office" ${canCreateAdmins ? '' : 'disabled'} />
          <label class="inline-check"><input name="canActivateServices" type="checkbox" ${canCreateAdmins ? '' : 'disabled'} /> Can activate market services</label>
          <label class="inline-check"><input name="canViewClientContact" type="checkbox" ${canCreateAdmins ? '' : 'disabled'} /> Can view client contact details</label>
          <button class="primary-button" type="submit" ${canCreateAdmins ? '' : 'disabled'}>${canCreateAdmins ? 'Create Users' : 'Create Users (permission required)'}</button>
          ${canCreateAdmins ? '' : '<p class="empty">Only a super admin or an admin with create permissions can add new internal staff.</p>'}
        </form>
      </section>
    </div>
    <section class="panel">
      <div class="panel-header"><h2>Role Access</h2><span>Portal visibility map</span></div>
      <div class="role-grid">
        ${roles.map((role) => `
          <article class="mini-card">
            <strong>${role}</strong>
            <p>${escapeHtml((state.data.adminMeta.permissionsByRole[role] || []).join(', ') || 'No permissions assigned')}</p>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function renderServiceActivationToggle(admin) {
  const currentPermissions = Array.isArray(admin.adminPermissions) ? admin.adminPermissions : [];
  const hasActivation = currentPermissions.includes(SERVICE_ACTIVATION_PERMISSION);
  const nextPermissions = hasActivation
    ? currentPermissions.filter((permission) => permission !== SERVICE_ACTIVATION_PERMISSION)
    : Array.from(new Set([...currentPermissions, SERVICE_ACTIVATION_PERMISSION]));

  return `
    <button class="ghost-button compact" onclick='updateAdminUser("${admin._id}", { adminPermissions: ${JSON.stringify(nextPermissions)} })'>
      ${hasActivation ? 'Remove Service Activation' : 'Allow Service Activation'}
    </button>
  `;
}

function renderClientContactToggle(admin) {
  const currentPermissions = Array.isArray(admin.adminPermissions) ? admin.adminPermissions : [];
  const roleGrantsContact = (rolePermissions[admin.adminRole || 'READ_ONLY_ADMIN'] || []).includes(CLIENT_CONTACT_PERMISSION);
  if (roleGrantsContact) {
    return '<span class="status good">Role grants client contact</span>';
  }

  const hasContactAccess = currentPermissions.includes(CLIENT_CONTACT_PERMISSION);
  const nextPermissions = hasContactAccess
    ? currentPermissions.filter((permission) => permission !== CLIENT_CONTACT_PERMISSION)
    : Array.from(new Set([...currentPermissions, CLIENT_CONTACT_PERMISSION]));

  return `
    <button class="ghost-button compact" onclick='updateAdminUser("${admin._id}", { adminPermissions: ${JSON.stringify(nextPermissions)} })'>
      ${hasContactAccess ? 'Remove Client Contact' : 'Allow Client Contact'}
    </button>
  `;
}

function serviceGroupsFromCatalog() {
  const groups = new Map();

  DEFAULT_TOP_LEVEL_SERVICE_GROUPS.forEach((group) => {
    groups.set(group.groupKey, {
      groupKey: group.groupKey,
      label: group.label,
      displayOrder: group.displayOrder,
      source: 'default',
      persisted: false,
      groupIconKey: group.groupIconKey || group.groupKey,
      categoryCount: 0,
      bookableCount: 0,
    });
  });

  (state.data.serviceCatalog || []).forEach((service) => {
    const groupKey = serviceKeyFrom(service.groupKey || '');
    const label = String(service.groupLabel || '').trim();
    if (!groupKey || !label) return;

    const existing = groups.get(groupKey);
    groups.set(groupKey, {
      groupKey,
      label,
      displayOrder: Number.isFinite(Number(service.groupDisplayOrder))
        ? Number(service.groupDisplayOrder)
        : existing?.displayOrder ?? 999,
      source: 'catalog',
      persisted: true,
      groupIconKey: service.groupIconKey || service.groupKey || groupKey,
      categoryCount: (existing?.categoryCount || 0) + (service.serviceKey === groupKey ? 0 : 1),
      bookableCount: (existing?.bookableCount || 0) + (service.subcategories || []).length,
    });
  });

  return Array.from(groups.values()).sort((a, b) => {
    const orderDelta = (a.displayOrder || 999) - (b.displayOrder || 999);
    return orderDelta || a.label.localeCompare(b.label);
  });
}

function renderServiceGroupList(groups) {
  if (!groups.length) {
    return '<p class="empty"><span>No groups</span>No top-level service groups have been created yet.</p>';
  }

  const workspace = state.serviceWorkspace || {};
  const canUpdateGroups = canMutate('markets.update');

  return `
    <div class="service-builder-list">
      ${groups.map((group) => `
        <article class="service-builder-item ${workspace.selectedGroupKey === group.groupKey ? 'selected' : ''}" tabindex="0" aria-label="${escapeHtml(group.label)} top-level group" onclick="selectTopLevelServiceGroup('${escapeHtml(group.groupKey)}')" onkeydown="handleServiceGroupCardKey(event, '${escapeHtml(group.groupKey)}')">
          ${renderServiceGroupIcon(group)}
          <span class="service-group-card-copy">
            <strong>${escapeHtml(group.label)}</strong>
            <small>Top-Level Group</small>
            <em>${group.categoryCount ? `${group.categoryCount} ${group.categoryCount === 1 ? 'Category' : 'Categories'}` : 'No Categories Yet'}</em>
          </span>
          ${canUpdateGroups ? `
            <span class="service-group-actions">
              <button class="icon-button compact" type="button" aria-label="Actions for ${escapeHtml(group.label)}" onclick="toggleServiceGroupActions(event, '${escapeHtml(group.groupKey)}')">...</button>
              ${workspace.actionMenuGroupKey === group.groupKey ? `
                <span class="service-group-menu">
                  <button type="button" onclick="startRenameTopLevelServiceGroup(event, '${escapeHtml(group.groupKey)}')">Rename</button>
                  ${group.persisted
                    ? `<button type="button" onclick="startDeleteTopLevelServiceGroup(event, '${escapeHtml(group.groupKey)}')">Delete</button>`
                    : `<button class="disabled" type="button" aria-disabled="true" onclick="showServiceGroupDeleteUnavailable(event, '${escapeHtml(group.groupKey)}')">Delete unavailable</button>`}
                </span>
              ` : ''}
            </span>
          ` : ''}
          <span class="service-group-card-arrow" aria-hidden="true">&gt;</span>
        </article>
      `).join('')}
    </div>
  `;
}

function findServiceGroup(groupKey) {
  return serviceGroupsFromCatalog().find((group) => group.groupKey === groupKey) || null;
}

function serviceCategoriesForGroup(groupKey) {
  const categories = new Map();
  let persistedCategoryCount = 0;

  (state.data.serviceCatalog || []).forEach((service) => {
    const serviceGroupKey = serviceKeyFrom(service.groupKey || '');
    const serviceKey = serviceKeyFrom(service.serviceKey || '');
    if (serviceGroupKey !== groupKey || !serviceKey || serviceKey === groupKey) return;

    const label = String(service.label || '').trim();
    persistedCategoryCount += 1;
    const existing = categories.get(serviceKey);
    categories.set(serviceKey, {
      serviceKey,
      label: label || existing?.label || serviceKey,
      displayOrder: Number.isFinite(Number(service.displayOrder))
        ? Number(service.displayOrder)
        : existing?.displayOrder ?? 999,
      persisted: true,
      bookableCount: (service.subcategories || []).length,
      status: service.status || 'DRAFT',
      imageKey: service.imageKey || '',
      imageUrl: service.imageUrl || '',
    });
  });

  if (!persistedCategoryCount && groupKey === 'home_services') {
    DEFAULT_HOME_SERVICE_CATEGORIES.forEach((category) => {
      categories.set(category.serviceKey, {
        serviceKey: category.serviceKey,
        label: category.label,
        displayOrder: category.displayOrder,
        persisted: false,
        bookableCount: 0,
        status: 'DRAFT',
        imageKey: category.serviceKey,
        imageUrl: '',
      });
    });
  }

  return Array.from(categories.values()).sort((a, b) => {
    return a.label.localeCompare(b.label);
  });
}

function findServiceCategory(groupKey, serviceKey) {
  return serviceCategoriesForGroup(groupKey).find((category) => category.serviceKey === serviceKey) || null;
}

function serviceCatalogRecord(serviceKey) {
  const normalized = serviceKeyFrom(serviceKey);
  return (state.data.serviceCatalog || []).find((service) => serviceKeyFrom(service.serviceKey || '') === normalized) || null;
}

async function ensureSelectedServiceCategoryPersisted() {
  const groupKey = state.serviceWorkspace.selectedGroupKey;
  const categoryKey = state.serviceWorkspace.selectedCategoryKey;
  const group = findServiceGroup(groupKey);
  const category = findServiceCategory(groupKey, categoryKey);
  const existing = serviceCatalogRecord(categoryKey);

  if (existing && category?.persisted) return existing;
  if (!group || !category) throw new Error('Select a persisted Service Category before creating a bookable service.');
  if (!canMutate('markets.update')) throw new Error('You do not have permission to save this service category.');

  try {
    await api('/admin/services', {
      method: 'POST',
      body: JSON.stringify({
        serviceKey: category.serviceKey,
        categoryKey: category.serviceKey,
        groupKey: group.groupKey,
        groupLabel: group.label,
        groupStatus: 'DRAFT',
        groupDisplayOrder: group.displayOrder || 0,
        label: category.label,
        description: '',
        imageKey: category.serviceKey,
        searchKeywords: [category.label],
        synonyms: [],
        requiresCapabilityApproval: true,
        fixedPriceSupported: false,
        subcategories: [],
      }),
    });
  } catch (error) {
    if (!/already exists|already uses|duplicate/i.test(error.message || '')) throw error;
  }

  await loadAllData();
  state.activeView = 'services';
  state.serviceWorkspace.selectedGroupKey = group.groupKey;
  state.serviceWorkspace.selectedCategoryKey = category.serviceKey;

  const persisted = serviceCatalogRecord(category.serviceKey);
  if (!persisted) throw new Error(`${category.label} could not be saved before adding a bookable service.`);
  return persisted;
}

function serviceBuilderCurrency() {
  const activeMarket = (state.data.markets || [])
    .map((market) => getMarketView(market))
    .find((market) => market.status === 'ACTIVE' && market.currency);
  const configuredMarket = (state.data.markets || [])
    .map((market) => getMarketView(market))
    .find((market) => market.currency);
  const availableMarket = (state.data.marketMeta.availableMarkets || [])
    .map((market) => getMarketView(market))
    .find((market) => market.currency);
  return activeMarket?.currency || configuredMarket?.currency || availableMarket?.currency || 'ZAR';
}

function decimalToMinor(value) {
  const normalized = String(value || '').replace(/,/g, '').trim();
  if (!normalized) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return NaN;
  const [whole, fraction = ''] = normalized.split('.');
  const minor = (Number(whole) * 100) + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(minor) ? minor : NaN;
}

function minorToDecimal(minor) {
  return typeof minor === 'number' && Number.isFinite(minor) ? (minor / 100).toFixed(2) : '';
}

function bookableServicesForCategory(serviceKey) {
  const category = serviceCatalogRecord(serviceKey);
  return (category?.subcategories || []).map((service, index) => ({
    serviceKey: service.serviceKey || service.subcategoryKey || '',
    subcategoryKey: service.subcategoryKey || service.serviceKey || '',
    label: service.label || service.serviceKey || service.subcategoryKey || 'Unnamed Service',
    description: service.description || '',
    calloutFeeMinor: service.calloutFeeMinor ?? category.defaultCalloutFeeMinor,
    status: service.publicationStatus || service.status || category.status || 'DRAFT',
    inspectionRequired: service.inspectionRequired === true,
    imageKey: service.imageKey || '',
    imageUrl: service.imageUrl || '',
    displayOrder: Number.isFinite(Number(service.displayOrder)) ? Number(service.displayOrder) : index,
  })).sort((a, b) => {
    const orderDelta = (a.displayOrder || 999) - (b.displayOrder || 999);
    return orderDelta || a.label.localeCompare(b.label);
  });
}

function findBookableService(categoryKey, bookableServiceKey) {
  const normalized = serviceKeyFrom(bookableServiceKey);
  const category = serviceCatalogRecord(categoryKey);
  const service = (category?.subcategories || []).find((subcategory) =>
    serviceKeyFrom(subcategory.serviceKey || subcategory.subcategoryKey || '') === normalized
  );
  return service || null;
}

function renderBookableServiceList(bookableServices) {
  if (!bookableServices.length) {
    return '<p class="empty"><span>No Bookable Services Yet</span>Create a bookable service to start building this category.</p>';
  }

  const currency = serviceBuilderCurrency();
  const workspace = state.serviceWorkspace || {};
  return `
    <div class="service-builder-list">
      ${bookableServices.map((service) => `
        <article class="service-builder-item ${workspace.selectedBookableServiceKey === service.serviceKey ? 'selected' : ''}" tabindex="0" aria-label="${escapeHtml(service.label)} bookable service" onclick="openBookableServiceDrawer('edit', '${escapeHtml(service.serviceKey)}')" onkeydown="handleBookableServiceCardKey(event, '${escapeHtml(service.serviceKey)}')">
          <span class="service-group-card-copy">
            <strong>${escapeHtml(service.label)}</strong>
            <small>${typeof service.calloutFeeMinor === 'number' ? `${moneyFromMinor(service.calloutFeeMinor, currency)} call-out` : 'Call-out fee not set'}</small>
            <em>${escapeHtml(String(service.status || 'DRAFT').replace('_', ' '))}${service.inspectionRequired ? ' - Inspection required' : ''}</em>
          </span>
          <span class="service-group-card-arrow" aria-hidden="true">&gt;</span>
        </article>
      `).join('')}
    </div>
  `;
}

function renderBookableServiceDrawer(category, bookableService) {
  const workspace = state.serviceWorkspace || {};
  if (!workspace.drawerOpen || !category) return '';
  const isEdit = workspace.drawerMode === 'edit';
  const canUpdate = canMutate('markets.update');
  const currency = serviceBuilderCurrency();
  const draft = workspace.bookableDraft || {};
  const title = isEdit
    ? canUpdate
      ? `Edit ${bookableService?.label || 'Bookable Service'}`
      : `${bookableService?.label || 'Bookable Service'} Details`
    : 'Create Bookable Service';
  const feeMinor = bookableService?.calloutFeeMinor ?? serviceCatalogRecord(category.serviceKey)?.defaultCalloutFeeMinor;
  const serviceNameValue = draft.serviceName !== undefined ? draft.serviceName : bookableService?.label || '';
  const descriptionValue = draft.description !== undefined ? draft.description : bookableService?.description || '';
  const calloutFeeValue = draft.calloutFee !== undefined ? draft.calloutFee : minorToDecimal(feeMinor);
  const inspectionRequiredValue = draft.inspectionRequired !== undefined ? draft.inspectionRequired : bookableService?.inspectionRequired === true;

  return `
    <div class="service-drawer-overlay" onclick="requestCloseBookableServiceDrawer('overlay')"></div>
    <aside class="service-details-drawer" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <div class="service-drawer-header">
        <div>
          <small>Step 3</small>
          <h3>${escapeHtml(title)}</h3>
          <span>${escapeHtml(category.label || 'Service Category')}</span>
        </div>
        <button class="icon-button compact" type="button" aria-label="Close drawer" onclick="requestCloseBookableServiceDrawer()">x</button>
      </div>
      <form class="service-bookable-form drawer-form" data-bookable-drawer-form onsubmit="saveBookableService(event, 'DRAFT')">
        <label>
          Service Name
          <input name="serviceName" value="${escapeHtml(serviceNameValue)}" placeholder="Fridge Repair" autocomplete="off" required ${canUpdate ? '' : 'disabled'} />
        </label>
        <label>
          Description
          <textarea name="description" rows="3" placeholder="Short customer-facing description" ${canUpdate ? '' : 'disabled'}>${escapeHtml(descriptionValue)}</textarea>
        </label>
        <label>
          Default Call-out Fee
          <span class="currency-input">
            <em>${escapeHtml(currency)}</em>
            <input name="calloutFee" value="${escapeHtml(calloutFeeValue)}" type="number" min="0" max="1000000" step="0.01" placeholder="350.00" inputmode="decimal" required ${canUpdate ? '' : 'disabled'} />
          </span>
        </label>
        <label class="checkbox-line">
          <input name="inspectionRequired" type="checkbox" ${inspectionRequiredValue ? 'checked' : ''} ${canUpdate ? '' : 'disabled'} />
          Inspection Required
        </label>
        ${!canUpdate ? '<p class="setting-help">Read-only admins can view bookable service details but cannot change them.</p>' : ''}
        ${isEdit && canUpdate ? '<p class="setting-help tight">Delete is allowed only when this bookable service has no bookings, provider capabilities, market references, promotions, waitlists, or operational history.</p>' : ''}
        <div class="button-row">
          ${canUpdate ? `<button class="primary-button compact" type="submit">${isEdit ? 'Update Draft' : 'Save Draft'}</button>` : ''}
          <button class="ghost-button compact" type="button" onclick="requestCloseBookableServiceDrawer()">Cancel</button>
          ${canUpdate ? `<button class="ghost-button compact" type="button" onclick="saveBookableService(event, 'PUBLISHED')">${isEdit ? 'Publish Changes' : 'Publish'}</button>` : ''}
          ${isEdit && canUpdate ? `<button class="danger-button compact" type="button" onclick="deleteBookableService('${escapeHtml(category.serviceKey)}', '${escapeHtml(bookableService?.serviceKey || bookableService?.subcategoryKey || '')}', '${escapeHtml(bookableService?.label || 'Bookable Service')}')">Delete Bookable Service</button>` : ''}
        </div>
      </form>
    </aside>
  `;
}

function renderServiceCategoryList(group, categories) {
  if (!categories.length) {
    return '<p class="empty"><span>No categories</span>No service categories have been created for this group yet.</p>';
  }

  const workspace = state.serviceWorkspace || {};
  const canUpdateCategories = canMutate('markets.update');

  return `
    <div class="service-builder-list">
      ${categories.map((category) => `
        <article class="service-builder-item ${workspace.selectedCategoryKey === category.serviceKey ? 'selected' : ''}" tabindex="0" aria-label="${escapeHtml(category.label)} service category" onclick="selectServiceCategory('${escapeHtml(category.serviceKey)}')" onkeydown="handleServiceCategoryCardKey(event, '${escapeHtml(category.serviceKey)}')">
          <span class="service-category-thumb" aria-hidden="true">
            ${category.imageUrl
              ? `<img src="${escapeHtml(category.imageUrl)}" alt="" />`
              : `<span>${escapeHtml((category.label || 'S').trim().slice(0, 1).toUpperCase())}</span>`}
          </span>
          <span class="service-group-card-copy">
            <strong>${escapeHtml(category.label)}</strong>
            <small>Service Category</small>
            <em>${category.bookableCount ? `${category.bookableCount} ${category.bookableCount === 1 ? 'Service' : 'Services'}` : '0 Services'}</em>
          </span>
          ${canUpdateCategories ? `
            <span class="service-group-actions">
              <button class="icon-button compact" type="button" aria-label="Actions for ${escapeHtml(category.label)}" onclick="toggleServiceCategoryActions(event, '${escapeHtml(category.serviceKey)}')">...</button>
              ${workspace.actionMenuCategoryKey === category.serviceKey ? `
                <span class="service-group-menu">
                  ${category.persisted
                    ? `<button type="button" onclick="startRenameServiceCategory(event, '${escapeHtml(category.serviceKey)}')">Rename</button>
                       <button type="button" onclick="startDeleteServiceCategory(event, '${escapeHtml(category.serviceKey)}')">Delete</button>`
                    : `<button class="disabled" type="button" aria-disabled="true" onclick="showServiceCategoryPersistenceUnavailable(event, '${escapeHtml(category.serviceKey)}')">Not saved yet</button>`}
                </span>
              ` : ''}
            </span>
          ` : ''}
          <span class="service-group-card-arrow" aria-hidden="true">&gt;</span>
        </article>
      `).join('')}
    </div>
  `;
}

function renderCreateServiceCategoryForm(group) {
  if (!group) return '';
  const draft = state.serviceWorkspace.categoryDraft || {};
  const imageUrlValue = draft.imageUrl || '';
  const previewUrl = draft.selectedImageDataUri || imageUrlValue || '';
  const previewName = draft.selectedImageName || (imageUrlValue ? 'Selected category image' : '');

  return `
    <form class="service-group-form service-category-form" data-service-category-form onsubmit="createServiceCategory(event, '${escapeHtml(group.groupKey)}')">
      <label>
        Category Name
        <input name="categoryName" value="${escapeHtml(draft.categoryName || '')}" placeholder="Appliance Repair" autocomplete="off" required />
      </label>
      <div class="service-image-field">
        <span>Category Image</span>
        <input name="imageUrl" type="hidden" value="${escapeHtml(imageUrlValue)}" />
        <input id="service-category-image-input" type="file" accept="image/jpeg,image/png,image/webp" onchange="handleServiceCategoryImageSelection(event)" />
        <div class="service-image-picker">
          ${previewUrl
            ? `<img src="${escapeHtml(previewUrl)}" alt="${escapeHtml(previewName || 'Selected category image')}" />`
            : '<div class="service-image-placeholder">No image selected</div>'}
          <div>
            <strong>${escapeHtml(previewName || 'Category image')}</strong>
            <p>${previewUrl ? 'This image will be used for the Service Category card.' : 'Choose a JPG, PNG, or WebP image up to 5 MB.'}</p>
            <div class="button-row">
              <button class="ghost-button compact" type="button" onclick="document.getElementById('service-category-image-input')?.click()">Select Image</button>
              ${previewUrl ? '<button class="ghost-button compact" type="button" onclick="removeServiceCategoryImage()">Remove</button>' : ''}
            </div>
          </div>
        </div>
      </div>
      <div class="button-row">
        <button class="primary-button compact" type="submit">Save</button>
        <button class="ghost-button compact" type="button" onclick="cancelServiceCategoryManagement()">Cancel</button>
      </div>
    </form>
  `;
}

function renderRenameServiceCategoryForm(group, category) {
  if (!group || !category) return '';
  const draft = state.serviceWorkspace.categoryDraft || {};
  const categoryRecord = serviceCatalogRecord(category.serviceKey) || {};
  const imageUrlValue = draft.imageUrl !== undefined ? draft.imageUrl : categoryRecord.imageUrl || '';
  const previewUrl = draft.selectedImageDataUri || imageUrlValue || '';
  const previewName = draft.selectedImageName || (imageUrlValue ? 'Saved category image' : '');

  return `
    <form class="service-group-form service-category-form" data-service-category-form onsubmit="renameServiceCategory(event, '${escapeHtml(category.serviceKey)}')">
      <label>
        Category Name
        <input name="categoryName" value="${escapeHtml(category.label)}" autocomplete="off" required />
      </label>
      <div class="service-image-field">
        <span>Category Image</span>
        <input name="imageUrl" type="hidden" value="${escapeHtml(imageUrlValue)}" />
        <input id="service-category-image-input" type="file" accept="image/jpeg,image/png,image/webp" onchange="handleServiceCategoryImageSelection(event)" />
        <div class="service-image-picker">
          ${previewUrl
            ? `<img src="${escapeHtml(previewUrl)}" alt="${escapeHtml(previewName || 'Selected category image')}" />`
            : '<div class="service-image-placeholder">No image selected</div>'}
          <div>
            <strong>${escapeHtml(previewName || 'Category image')}</strong>
            <p>${previewUrl ? 'This image will be used for the Service Category card.' : 'Choose a JPG, PNG, or WebP image up to 5 MB.'}</p>
            <div class="button-row">
              <button class="ghost-button compact" type="button" onclick="document.getElementById('service-category-image-input')?.click()">Select Image</button>
              ${previewUrl ? '<button class="ghost-button compact" type="button" onclick="removeServiceCategoryImage()">Remove</button>' : ''}
            </div>
          </div>
        </div>
      </div>
      <div class="button-row">
        <button class="primary-button compact" type="submit">Save</button>
        <button class="ghost-button compact" type="button" onclick="cancelServiceCategoryManagement()">Cancel</button>
      </div>
    </form>
  `;
}

function renderDeleteServiceCategoryConfirmation(category) {
  if (!category) return '';

  return `
    <div class="service-group-confirm">
      <strong>Delete &quot;${escapeHtml(category.label)}&quot;?</strong>
      <p>This action is permanent and is allowed only because the category is empty and unused.</p>
      <div class="button-row">
        <button class="ghost-button compact" type="button" onclick="cancelServiceCategoryManagement()">Cancel</button>
        <button class="danger-button compact" type="button" onclick="deleteServiceCategory('${escapeHtml(category.serviceKey)}')">Delete Category</button>
      </div>
    </div>
  `;
}

function renderRenameServiceGroupForm(group) {
  if (!group) return '';

  return `
    <form class="service-group-form" onsubmit="renameTopLevelServiceGroup(event, '${escapeHtml(group.groupKey)}')">
      <p class="setting-help">The Top-Level Group icon updates automatically from the group name.</p>
      <label>
        Group Name
        <input name="groupName" value="${escapeHtml(group.label)}" autocomplete="off" required />
      </label>
      <div class="button-row">
        <button class="primary-button compact" type="submit">Save</button>
        <button class="ghost-button compact" type="button" onclick="cancelServiceGroupManagement()">Cancel</button>
      </div>
    </form>
  `;
}

function renderDeleteServiceGroupConfirmation(group) {
  if (!group) return '';

  return `
    <div class="service-group-confirm">
      <strong>Delete &quot;${escapeHtml(group.label)}&quot;?</strong>
      <p>This action is permanent and is allowed only because the group is empty and unused.</p>
      <div class="button-row">
        <button class="ghost-button compact" type="button" onclick="cancelServiceGroupManagement()">Cancel</button>
        <button class="danger-button compact" type="button" onclick="deleteTopLevelServiceGroup('${escapeHtml(group.groupKey)}')">Delete Group</button>
      </div>
    </div>
  `;
}
function renderCreateServiceGroupForm() {
  return `
    <form class="service-group-form" onsubmit="createTopLevelServiceGroup(event)">
      <p class="setting-help">The Top-Level Group icon is generated automatically from the group name using the Padi icon style.</p>
      <label>
        Group Name
        <input name="groupName" placeholder="Rental Services" autocomplete="off" required />
      </label>
      <div class="button-row">
        <button class="primary-button compact" type="submit">Save</button>
        <button class="ghost-button compact" type="button" onclick="cancelTopLevelServiceGroup()">Cancel</button>
      </div>
    </form>
  `;
}

function renderServiceManagementDrawer({ renameGroup, deleteGroup, selectedGroup, renameCategory, deleteCategory } = {}) {
  const workspace = state.serviceWorkspace || {};
  let title = '';
  let eyebrow = 'Services';
  let body = '';

  if (workspace.showCreateGroup) {
    title = 'Create Top-Level Group';
    eyebrow = 'Step 1';
    body = renderCreateServiceGroupForm();
  } else if (workspace.renameGroupKey) {
    title = `Rename ${renameGroup?.label || 'Top-Level Group'}`;
    eyebrow = 'Step 1';
    body = renderRenameServiceGroupForm(renameGroup);
  } else if (workspace.deleteGroupKey) {
    title = `Delete ${deleteGroup?.label || 'Top-Level Group'}`;
    eyebrow = 'Step 1';
    body = renderDeleteServiceGroupConfirmation(deleteGroup);
  } else if (workspace.showCreateCategory && selectedGroup) {
    title = 'Create Service Category';
    eyebrow = selectedGroup.label || 'Step 2';
    body = renderCreateServiceCategoryForm(selectedGroup);
  } else if (workspace.renameCategoryKey) {
    title = `Edit ${renameCategory?.label || 'Service Category'}`;
    eyebrow = selectedGroup?.label || 'Step 2';
    body = renderRenameServiceCategoryForm(selectedGroup, renameCategory);
  } else if (workspace.deleteCategoryKey) {
    title = `Delete ${deleteCategory?.label || 'Service Category'}`;
    eyebrow = selectedGroup?.label || 'Step 2';
    body = renderDeleteServiceCategoryConfirmation(deleteCategory);
  }

  if (!body) return '';

  return `
    <div class="service-drawer-overlay" onclick="cancelServiceManagementDrawer()"></div>
    <aside class="service-details-drawer service-management-drawer" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <div class="service-drawer-header">
        <div>
          <small>${escapeHtml(eyebrow)}</small>
          <h3>${escapeHtml(title)}</h3>
          <span>Changes save through the Services catalogue.</span>
        </div>
        <button class="icon-button compact" type="button" aria-label="Close drawer" onclick="cancelServiceManagementDrawer()">x</button>
      </div>
      <div class="service-management-drawer-body">
        ${body}
      </div>
    </aside>
  `;
}

function renderServices() {
  const canCreateGroups = canMutate('markets.update');
  const groups = serviceGroupsFromCatalog();
  const workspace = state.serviceWorkspace || {};
  const selectedGroup = findServiceGroup(workspace.selectedGroupKey);
  const categories = selectedGroup ? serviceCategoriesForGroup(selectedGroup.groupKey) : [];
  const renameGroup = findServiceGroup(workspace.renameGroupKey);
  const deleteGroup = findServiceGroup(workspace.deleteGroupKey);
  const renameCategory = selectedGroup ? findServiceCategory(selectedGroup.groupKey, workspace.renameCategoryKey) : null;
  const deleteCategory = selectedGroup ? findServiceCategory(selectedGroup.groupKey, workspace.deleteCategoryKey) : null;
  const selectedCategory = selectedGroup ? findServiceCategory(selectedGroup.groupKey, workspace.selectedCategoryKey) : null;
  const bookableServices = selectedCategory ? bookableServicesForCategory(selectedCategory.serviceKey) : [];
  const selectedBookableService = selectedCategory ? findBookableService(selectedCategory.serviceKey, workspace.selectedBookableServiceKey) : null;

  return `
    <section class="services-page-shell">
      <div class="service-builder-heading">
        <h2>Services</h2>
        <span>Build the service hierarchy from top-level groups to categories and bookable services.</span>
      </div>
      ${workspace.message ? `<div class="notice service-builder-notice">${escapeHtml(workspace.message)}</div>` : ''}
      ${workspace.error ? `<div class="notice error service-builder-notice">${escapeHtml(workspace.error)}</div>` : ''}
      <div class="services-builder-grid">
        <article class="services-builder-card step-groups">
          <div class="services-builder-card-header">
            <div>
              <small>Step 1</small>
              <h3>Top-Level Groups</h3>
            </div>
            ${canCreateGroups && !workspace.showCreateGroup ? '<button class="primary-button compact" onclick="showTopLevelServiceGroupForm()">+ Create Top-Level Group</button>' : ''}
          </div>
          <div class="services-builder-actions">
            ${!canCreateGroups ? '<p class="setting-help">Read-only admins can view groups but cannot create them.</p>' : ''}
          </div>
          <div class="services-builder-scroll">
            ${renderServiceGroupList(groups)}
          </div>
        </article>

        <article class="services-builder-card step-categories ${selectedGroup ? '' : 'disabled'}">
          <div class="services-builder-card-header">
            <div>
              <small>Step 2</small>
              <h3>Service Categories</h3>
              ${selectedGroup ? `<span>${escapeHtml(selectedGroup.label)}</span>` : ''}
            </div>
            ${canCreateGroups && !workspace.showCreateCategory
              ? `<button class="primary-button compact" ${selectedGroup ? 'onclick="showCreateServiceCategoryForm()"' : 'type="button" disabled'}>+ Create Service Category</button>`
              : ''}
          </div>
          <div class="services-builder-actions">
            ${selectedGroup && !canCreateGroups ? '<p class="setting-help">Read-only admins can view and select categories but cannot create or edit them.</p>' : ''}
          </div>
          <div class="services-builder-scroll">
            ${selectedGroup ? renderServiceCategoryList(selectedGroup, categories) : '<p class="empty"><span>Service Categories</span>Select a Top-Level Group to view its categories.</p>'}
          </div>
        </article>

        <article class="services-builder-card step-bookables ${selectedCategory ? '' : 'disabled'}">
          <div class="services-builder-card-header">
            <div>
              <small>Step 3</small>
              <h3>Bookable Services</h3>
              ${selectedCategory ? `<span>${escapeHtml(selectedCategory.label)}</span>` : ''}
            </div>
            ${canCreateGroups && !workspace.showCreateBookableService
              ? `<button class="primary-button compact" ${selectedCategory ? 'onclick="openBookableServiceDrawer(\'create\')"' : 'type="button" disabled'}>+ Create Bookable Service</button>`
              : ''}
          </div>
          <div class="services-builder-actions">
            ${selectedCategory && !canCreateGroups ? '<p class="setting-help">Read-only admins can view bookable services but cannot create them.</p>' : ''}
          </div>
          <div class="services-builder-scroll bookables">
            ${selectedCategory ? renderBookableServiceList(bookableServices) : '<p class="empty"><span>Bookable Services</span>Select a Service Category to view its services.</p>'}
          </div>
        </article>
      </div>
    </section>
    ${renderServiceManagementDrawer({ renameGroup, deleteGroup, selectedGroup, renameCategory, deleteCategory })}
    ${renderBookableServiceDrawer(selectedCategory, selectedBookableService)}
  `;
}

function showTopLevelServiceGroupForm() {
  if (!canMutate('markets.update')) {
    state.serviceWorkspace.error = 'You do not have permission to create top-level groups.';
    state.serviceWorkspace.message = '';
    render();
    return;
  }

  state.serviceWorkspace.showCreateGroup = true;
  state.serviceWorkspace.showCreateCategory = false;
  state.serviceWorkspace.renameGroupKey = '';
  state.serviceWorkspace.deleteGroupKey = '';
  state.serviceWorkspace.renameCategoryKey = '';
  state.serviceWorkspace.deleteCategoryKey = '';
  state.serviceWorkspace.showCreateBookableService = false;
  state.serviceWorkspace.selectedBookableServiceKey = '';
  state.serviceWorkspace.drawerOpen = false;
  state.serviceWorkspace.drawerMode = '';
  state.serviceWorkspace.categoryDraft = {};
  state.serviceWorkspace.bookableDraft = {};
  state.serviceWorkspace.message = '';
  state.serviceWorkspace.error = '';
  render();
}

function cancelTopLevelServiceGroup() {
  state.serviceWorkspace.showCreateGroup = false;
  state.serviceWorkspace.message = '';
  state.serviceWorkspace.error = '';
  render();
}

function selectTopLevelServiceGroup(groupKey) {
  state.serviceWorkspace.selectedGroupKey = groupKey;
  state.serviceWorkspace.selectedCategoryKey = '';
  state.serviceWorkspace.actionMenuGroupKey = '';
  state.serviceWorkspace.actionMenuCategoryKey = '';
  state.serviceWorkspace.showCreateGroup = false;
  state.serviceWorkspace.showCreateCategory = false;
  state.serviceWorkspace.renameGroupKey = '';
  state.serviceWorkspace.deleteGroupKey = '';
  state.serviceWorkspace.renameCategoryKey = '';
  state.serviceWorkspace.deleteCategoryKey = '';
  state.serviceWorkspace.showCreateBookableService = false;
  state.serviceWorkspace.selectedBookableServiceKey = '';
  state.serviceWorkspace.drawerOpen = false;
  state.serviceWorkspace.drawerMode = '';
  state.serviceWorkspace.categoryDraft = {};
  state.serviceWorkspace.bookableDraft = {};
  state.serviceWorkspace.message = '';
  state.serviceWorkspace.error = '';
  render();
}

function handleServiceGroupCardKey(event, groupKey) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  selectTopLevelServiceGroup(groupKey);
}

function toggleServiceGroupActions(event, groupKey) {
  event.stopPropagation();
  state.serviceWorkspace.selectedGroupKey = groupKey;
  state.serviceWorkspace.actionMenuGroupKey = state.serviceWorkspace.actionMenuGroupKey === groupKey ? '' : groupKey;
  render();
}

function startRenameTopLevelServiceGroup(event, groupKey) {
  event.stopPropagation();
  const group = findServiceGroup(groupKey);
  if (!group?.persisted) {
    state.serviceWorkspace.error = 'This top-level group is shown as a fallback and is not persisted yet, so it cannot be renamed here.';
    state.serviceWorkspace.message = '';
    state.serviceWorkspace.actionMenuGroupKey = '';
    render();
    return;
  }

  state.serviceWorkspace.selectedGroupKey = groupKey;
  state.serviceWorkspace.renameGroupKey = groupKey;
  state.serviceWorkspace.deleteGroupKey = '';
  state.serviceWorkspace.showCreateGroup = false;
  state.serviceWorkspace.actionMenuGroupKey = '';
  state.serviceWorkspace.message = '';
  state.serviceWorkspace.error = '';
  render();
}

function startDeleteTopLevelServiceGroup(event, groupKey) {
  event.stopPropagation();
  const group = findServiceGroup(groupKey);
  if (!group?.persisted) {
    state.serviceWorkspace.error = 'This top-level group is shown as a fallback and is not persisted as an empty draft group, so it cannot be deleted.';
    state.serviceWorkspace.message = '';
    state.serviceWorkspace.actionMenuGroupKey = '';
    render();
    return;
  }

  state.serviceWorkspace.selectedGroupKey = groupKey;
  state.serviceWorkspace.deleteGroupKey = groupKey;
  state.serviceWorkspace.renameGroupKey = '';
  state.serviceWorkspace.showCreateGroup = false;
  state.serviceWorkspace.actionMenuGroupKey = '';
  state.serviceWorkspace.message = '';
  state.serviceWorkspace.error = '';
  render();
}

function showServiceGroupDeleteUnavailable(event, groupKey) {
  event.stopPropagation();
  const group = findServiceGroup(groupKey);
  state.serviceWorkspace.selectedGroupKey = groupKey;
  state.serviceWorkspace.actionMenuGroupKey = '';
  state.serviceWorkspace.message = '';
  state.serviceWorkspace.error = `${group?.label || 'This group'} is shown from default service hierarchy metadata and has no standalone empty draft record to delete. Archive support will be handled in a later hierarchy step.`;
  render();
}

function cancelServiceGroupManagement() {
  state.serviceWorkspace.renameGroupKey = '';
  state.serviceWorkspace.deleteGroupKey = '';
  state.serviceWorkspace.actionMenuGroupKey = '';
  state.serviceWorkspace.message = '';
  state.serviceWorkspace.error = '';
  render();
}

function showCreateServiceCategoryForm() {
  if (!canMutate('markets.update')) {
    state.serviceWorkspace.error = 'You do not have permission to create service categories.';
    state.serviceWorkspace.message = '';
    render();
    return;
  }

  if (!state.serviceWorkspace.selectedGroupKey) {
    state.serviceWorkspace.error = 'Select a Top-Level Group before creating a service category.';
    state.serviceWorkspace.message = '';
    render();
    return;
  }

  state.serviceWorkspace.showCreateCategory = true;
  state.serviceWorkspace.renameCategoryKey = '';
  state.serviceWorkspace.deleteCategoryKey = '';
  state.serviceWorkspace.actionMenuCategoryKey = '';
  state.serviceWorkspace.showCreateBookableService = false;
  state.serviceWorkspace.categoryDraft = {};
  state.serviceWorkspace.message = '';
  state.serviceWorkspace.error = '';
  render();
}

function cancelServiceCategoryManagement() {
  state.serviceWorkspace.showCreateCategory = false;
  state.serviceWorkspace.renameCategoryKey = '';
  state.serviceWorkspace.deleteCategoryKey = '';
  state.serviceWorkspace.actionMenuCategoryKey = '';
  state.serviceWorkspace.categoryDraft = {};
  state.serviceWorkspace.message = '';
  state.serviceWorkspace.error = '';
  render();
}

function cancelServiceManagementDrawer() {
  state.serviceWorkspace.showCreateGroup = false;
  state.serviceWorkspace.renameGroupKey = '';
  state.serviceWorkspace.deleteGroupKey = '';
  state.serviceWorkspace.showCreateCategory = false;
  state.serviceWorkspace.renameCategoryKey = '';
  state.serviceWorkspace.deleteCategoryKey = '';
  state.serviceWorkspace.actionMenuGroupKey = '';
  state.serviceWorkspace.actionMenuCategoryKey = '';
  state.serviceWorkspace.categoryDraft = {};
  state.serviceWorkspace.message = '';
  state.serviceWorkspace.error = '';
  render();
}

function selectServiceCategory(serviceKey) {
  state.serviceWorkspace.selectedCategoryKey = serviceKey;
  state.serviceWorkspace.actionMenuCategoryKey = '';
  state.serviceWorkspace.showCreateCategory = false;
  state.serviceWorkspace.renameCategoryKey = '';
  state.serviceWorkspace.deleteCategoryKey = '';
  state.serviceWorkspace.showCreateBookableService = false;
  state.serviceWorkspace.selectedBookableServiceKey = '';
  state.serviceWorkspace.drawerOpen = false;
  state.serviceWorkspace.drawerMode = '';
  state.serviceWorkspace.categoryDraft = {};
  state.serviceWorkspace.bookableDraft = {};
  state.serviceWorkspace.message = '';
  state.serviceWorkspace.error = '';
  render();
}

async function openBookableServiceDrawer(mode = 'create', bookableServiceKey = '') {
  const creating = mode !== 'edit';
  if (!canMutate('markets.update')) {
    if (creating) {
      state.serviceWorkspace.error = 'You do not have permission to create bookable services.';
      state.serviceWorkspace.message = '';
      render();
      return;
    }
  }

  if (!state.serviceWorkspace.selectedCategoryKey) {
    state.serviceWorkspace.error = 'Select a Service Category before creating a bookable service.';
    state.serviceWorkspace.message = '';
    render();
    return;
  }

  if (creating) {
    try {
      await ensureSelectedServiceCategoryPersisted();
    } catch (error) {
      state.serviceWorkspace.message = '';
      state.serviceWorkspace.error = error.message || 'This category must be saved before adding bookable services.';
      render();
      return;
    }
  }

  if (!creating && !findBookableService(state.serviceWorkspace.selectedCategoryKey, bookableServiceKey)) {
    state.serviceWorkspace.error = 'Bookable service not found.';
    state.serviceWorkspace.message = '';
    render();
    return;
  }

  state.serviceWorkspace.showCreateBookableService = true;
  state.serviceWorkspace.drawerOpen = true;
  state.serviceWorkspace.drawerMode = creating ? 'create' : 'edit';
  state.serviceWorkspace.selectedBookableServiceKey = creating ? '' : serviceKeyFrom(bookableServiceKey);
  state.serviceWorkspace.bookableDraft = {};
  state.serviceWorkspace.showCreateCategory = false;
  state.serviceWorkspace.renameCategoryKey = '';
  state.serviceWorkspace.deleteCategoryKey = '';
  state.serviceWorkspace.actionMenuCategoryKey = '';
  state.serviceWorkspace.message = '';
  state.serviceWorkspace.error = '';
  render();
}

function isBookableDrawerDirty() {
  const form = document.querySelector('[data-bookable-drawer-form]');
  if (!form) return false;
  return Array.from(form.elements || []).some((element) => {
    if (!element.name || element.disabled) return false;
    if (element.type === 'checkbox') return element.checked !== element.defaultChecked;
    return String(element.value || '') !== String(element.defaultValue || '');
  });
}

function requestCloseBookableServiceDrawer(source = '') {
  if (source === 'overlay' && isBookableDrawerDirty() && !window.confirm('Discard unsaved bookable service changes?')) return;
  if (source !== 'overlay' && isBookableDrawerDirty() && !window.confirm('Discard unsaved bookable service changes?')) return;
  closeBookableServiceDrawer();
}

function closeBookableServiceDrawer() {
  state.serviceWorkspace.showCreateBookableService = false;
  state.serviceWorkspace.drawerOpen = false;
  state.serviceWorkspace.drawerMode = '';
  state.serviceWorkspace.selectedBookableServiceKey = '';
  state.serviceWorkspace.bookableDraft = {};
  state.serviceWorkspace.message = '';
  state.serviceWorkspace.error = '';
  render();
}

function captureBookableDraftFromForm() {
  const form = document.querySelector('[data-bookable-drawer-form]');
  const existingDraft = state.serviceWorkspace.bookableDraft || {};
  if (!form) return existingDraft;
  const data = new FormData(form);
  return {
    ...existingDraft,
    serviceName: String(data.get('serviceName') || ''),
    description: String(data.get('description') || ''),
    calloutFee: String(data.get('calloutFee') || ''),
    inspectionRequired: data.get('inspectionRequired') === 'on',
  };
}

function captureServiceCategoryDraftFromForm() {
  const form = document.querySelector('[data-service-category-form]');
  const existingDraft = state.serviceWorkspace.categoryDraft || {};
  if (!form) return existingDraft;
  const data = new FormData(form);
  return {
    ...existingDraft,
    categoryName: String(data.get('categoryName') || ''),
    imageUrl: String(data.get('imageUrl') || ''),
  };
}

function handleServiceCategoryImageSelection(event) {
  const file = event.target?.files?.[0];
  if (!file) return;

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    state.serviceWorkspace.categoryDraft = captureServiceCategoryDraftFromForm();
    state.serviceWorkspace.error = 'Choose a JPG, PNG, or WebP image.';
    state.serviceWorkspace.message = '';
    render();
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    state.serviceWorkspace.categoryDraft = captureServiceCategoryDraftFromForm();
    state.serviceWorkspace.error = 'Category images must be 5 MB or smaller.';
    state.serviceWorkspace.message = '';
    render();
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    state.serviceWorkspace.categoryDraft = {
      ...captureServiceCategoryDraftFromForm(),
      selectedImageDataUri: String(reader.result || ''),
      selectedImageName: file.name,
      selectedImageMimeType: file.type,
      imageRemoved: false,
    };
    state.serviceWorkspace.message = '';
    state.serviceWorkspace.error = '';
    render();
  };
  reader.onerror = () => {
    state.serviceWorkspace.categoryDraft = captureServiceCategoryDraftFromForm();
    state.serviceWorkspace.error = 'Unable to preview the selected image.';
    state.serviceWorkspace.message = '';
    render();
  };
  reader.readAsDataURL(file);
}

function removeServiceCategoryImage() {
  state.serviceWorkspace.categoryDraft = {
    ...captureServiceCategoryDraftFromForm(),
    imageUrl: '',
    selectedImageDataUri: '',
    selectedImageName: '',
    selectedImageMimeType: '',
    imageRemoved: true,
  };
  state.serviceWorkspace.message = '';
  state.serviceWorkspace.error = '';
  render();
}

async function uploadPendingServiceCategoryImage(serviceKey, label) {
  const draft = state.serviceWorkspace.categoryDraft || {};
  if (!draft.selectedImageDataUri) return null;

  const result = await api('/admin/services/images', {
    method: 'POST',
    body: JSON.stringify({
      serviceKey,
      label,
      fileName: draft.selectedImageName || `${serviceKey}.jpg`,
      mimeType: draft.selectedImageMimeType || '',
      dataUri: draft.selectedImageDataUri,
    }),
  });

  return result.image || null;
}

function handleBookableServiceCardKey(event, bookableServiceKey) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  openBookableServiceDrawer('edit', bookableServiceKey);
}

async function saveBookableService(event, publicationStatus) {
  event.preventDefault();

  if (!canMutate('markets.update')) {
    state.serviceWorkspace.error = 'You do not have permission to create bookable services.';
    state.serviceWorkspace.message = '';
    render();
    return;
  }

  const formElement = event.currentTarget?.tagName === 'FORM'
    ? event.currentTarget
    : event.currentTarget?.closest?.('form');
  if (!formElement) return;

  const groupKey = state.serviceWorkspace.selectedGroupKey;
  const categoryKey = state.serviceWorkspace.selectedCategoryKey;
  let category = serviceCatalogRecord(categoryKey);
  let visibleCategory = findServiceCategory(groupKey, categoryKey);
  const editing = state.serviceWorkspace.drawerMode === 'edit';
  const editingKey = serviceKeyFrom(state.serviceWorkspace.selectedBookableServiceKey);
  const existingBookable = editing ? findBookableService(categoryKey, editingKey) : null;
  const form = new FormData(formElement);
  const serviceName = String(form.get('serviceName') || '').trim().replace(/\s+/g, ' ');
  const serviceKey = editing
    ? serviceKeyFrom(existingBookable?.serviceKey || existingBookable?.subcategoryKey || editingKey)
    : serviceKeyFrom(serviceName);
  const subcategoryKey = editing
    ? serviceKeyFrom(existingBookable?.subcategoryKey || existingBookable?.serviceKey || editingKey)
    : serviceKey;
  const description = String(form.get('description') || '').trim();
  const calloutFeeMinor = decimalToMinor(form.get('calloutFee'));
  const inspectionRequired = form.get('inspectionRequired') === 'on';
  let existingSubcategories = Array.isArray(category?.subcategories) ? category.subcategories : [];
  const draftSnapshot = {
    serviceName,
    description,
    calloutFee: String(form.get('calloutFee') || ''),
    inspectionRequired,
  };
  const fail = (message) => {
    state.serviceWorkspace.bookableDraft = draftSnapshot;
    state.serviceWorkspace.error = message;
    state.serviceWorkspace.message = '';
    render();
  };

  if (!category || !visibleCategory?.persisted) {
    try {
      category = await ensureSelectedServiceCategoryPersisted();
      visibleCategory = findServiceCategory(groupKey, categoryKey);
      existingSubcategories = Array.isArray(category?.subcategories) ? category.subcategories : [];
    } catch (error) {
      fail(error.message || 'This category must be persisted before adding bookable services.');
      return;
    }
  }

  if (editing && !existingBookable) {
    fail('Bookable service not found.');
    return;
  }

  if (!serviceName) {
    fail('Service name is required.');
    return;
  }

  if (!serviceKey) {
    fail('Service name must include letters or numbers.');
    return;
  }

  if (!Number.isFinite(calloutFeeMinor) || calloutFeeMinor === null) {
    fail('Default call-out fee must be a valid amount with no more than two decimal places.');
    return;
  }

  if (calloutFeeMinor < 0 || calloutFeeMinor > 100000000) {
    fail('Default call-out fee must be between 0.00 and 1,000,000.00.');
    return;
  }

  const duplicate = existingSubcategories.some((service) => {
    const existingName = String(service.label || '').trim().toLowerCase();
    const existingKey = serviceKeyFrom(service.serviceKey || service.subcategoryKey || '');
    const sameEditedService = editing && existingKey === editingKey;
    return !sameEditedService && (existingName === serviceName.toLowerCase() || existingKey === serviceKey);
  });
  if (duplicate) {
    fail('A bookable service with this name already exists in this category.');
    return;
  }

  const nextSubcategory = {
    ...(existingBookable || {}),
    subcategoryKey,
    serviceKey,
    label: serviceName,
    description,
    status: existingBookable?.status || 'ACTIVE',
    publicationStatus: publicationStatus === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
    displayOrder: Number.isFinite(Number(existingBookable?.displayOrder))
      ? Number(existingBookable.displayOrder)
      : existingSubcategories.length * 10 + 10,
    imageKey: existingBookable?.imageKey || serviceKey,
    imageUrl: existingBookable?.imageUrl || '',
    searchKeywords: [serviceName, visibleCategory.label].filter(Boolean),
    synonyms: existingBookable?.synonyms || [],
    inspectionRequired,
    fixedPriceSupported: existingBookable?.fixedPriceSupported === true,
    requiresCapabilityApproval: existingBookable?.requiresCapabilityApproval === undefined ? true : existingBookable.requiresCapabilityApproval !== false,
    calloutFeeMinor,
  };
  const nextSubcategories = editing
    ? existingSubcategories.map((service) =>
        serviceKeyFrom(service.serviceKey || service.subcategoryKey || '') === editingKey ? nextSubcategory : service
      )
    : [...existingSubcategories, nextSubcategory];

  try {
    await api(`/admin/services/${encodeURIComponent(category.serviceKey)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ...(publicationStatus === 'PUBLISHED' ? { status: 'PUBLISHED', groupStatus: 'PUBLISHED' } : {}),
        subcategories: nextSubcategories,
      }),
    });

    await loadAllData();
    state.activeView = 'services';
    state.serviceWorkspace.selectedGroupKey = groupKey;
    state.serviceWorkspace.selectedCategoryKey = categoryKey;
    state.serviceWorkspace.selectedBookableServiceKey = serviceKey;
    state.serviceWorkspace.showCreateBookableService = false;
    state.serviceWorkspace.drawerOpen = false;
    state.serviceWorkspace.drawerMode = '';
    state.serviceWorkspace.bookableDraft = {};
    state.serviceWorkspace.message = publicationStatus === 'PUBLISHED'
      ? `${serviceName} was published successfully. It can appear in the Client App when the full hierarchy is published and the customer is in an active Padi market.`
      : `${serviceName} was ${editing ? 'updated as a draft' : 'saved as a draft'}.`;
    state.serviceWorkspace.error = '';
    render();
  } catch (error) {
    state.serviceWorkspace.bookableDraft = draftSnapshot;
    state.serviceWorkspace.message = '';
    state.serviceWorkspace.error = error.message || 'Unable to save bookable service.';
    render();
  }
}

async function deleteBookableService(categoryKey, bookableServiceKey, label = 'Bookable Service') {
  if (!canMutate('markets.update')) {
    state.serviceWorkspace.error = 'You do not have permission to delete bookable services.';
    state.serviceWorkspace.message = '';
    render();
    return;
  }

  const normalizedCategoryKey = serviceKeyFrom(categoryKey);
  const normalizedBookableKey = serviceKeyFrom(bookableServiceKey);
  const displayLabel = String(label || 'Bookable Service').trim();
  if (!normalizedCategoryKey || !normalizedBookableKey) {
    state.serviceWorkspace.error = 'Bookable service could not be identified for deletion.';
    state.serviceWorkspace.message = '';
    render();
    return;
  }

  if (!window.confirm(`Delete ${displayLabel}? This is permanent and only allowed when the bookable service is unused.`)) return;

  try {
    await api(`/admin/services/${encodeURIComponent(normalizedCategoryKey)}/bookable/${encodeURIComponent(normalizedBookableKey)}`, {
      method: 'DELETE',
    });
    await loadAllData();
    state.activeView = 'services';
    state.serviceWorkspace.selectedCategoryKey = normalizedCategoryKey;
    state.serviceWorkspace.selectedBookableServiceKey = '';
    state.serviceWorkspace.showCreateBookableService = false;
    state.serviceWorkspace.drawerOpen = false;
    state.serviceWorkspace.drawerMode = '';
    state.serviceWorkspace.bookableDraft = {};
    state.serviceWorkspace.message = `${displayLabel} was deleted.`;
    state.serviceWorkspace.error = '';
    render();
  } catch (error) {
    state.serviceWorkspace.message = '';
    state.serviceWorkspace.error = error.message || 'Unable to delete bookable service.';
    render();
  }
}

function handleServiceCategoryCardKey(event, serviceKey) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  selectServiceCategory(serviceKey);
}

function toggleServiceCategoryActions(event, serviceKey) {
  event.stopPropagation();
  state.serviceWorkspace.selectedCategoryKey = serviceKey;
  state.serviceWorkspace.actionMenuCategoryKey = state.serviceWorkspace.actionMenuCategoryKey === serviceKey ? '' : serviceKey;
  state.serviceWorkspace.message = '';
  state.serviceWorkspace.error = '';
  render();
}

function startRenameServiceCategory(event, serviceKey) {
  event.stopPropagation();
  const groupKey = state.serviceWorkspace.selectedGroupKey;
  const category = findServiceCategory(groupKey, serviceKey);
  if (!category?.persisted) {
    state.serviceWorkspace.error = 'This service category is shown from fallback metadata and is not persisted yet, so it cannot be renamed here.';
    state.serviceWorkspace.message = '';
    state.serviceWorkspace.actionMenuCategoryKey = '';
    render();
    return;
  }

  state.serviceWorkspace.selectedCategoryKey = serviceKey;
  state.serviceWorkspace.renameCategoryKey = serviceKey;
  state.serviceWorkspace.deleteCategoryKey = '';
  state.serviceWorkspace.showCreateCategory = false;
  state.serviceWorkspace.actionMenuCategoryKey = '';
  state.serviceWorkspace.categoryDraft = {};
  state.serviceWorkspace.message = '';
  state.serviceWorkspace.error = '';
  render();
}

function startDeleteServiceCategory(event, serviceKey) {
  event.stopPropagation();
  const groupKey = state.serviceWorkspace.selectedGroupKey;
  const category = findServiceCategory(groupKey, serviceKey);
  if (!category?.persisted) {
    state.serviceWorkspace.error = 'This service category is shown from fallback metadata and has no persisted draft record to delete.';
    state.serviceWorkspace.message = '';
    state.serviceWorkspace.actionMenuCategoryKey = '';
    render();
    return;
  }

  state.serviceWorkspace.selectedCategoryKey = serviceKey;
  state.serviceWorkspace.deleteCategoryKey = serviceKey;
  state.serviceWorkspace.renameCategoryKey = '';
  state.serviceWorkspace.showCreateCategory = false;
  state.serviceWorkspace.actionMenuCategoryKey = '';
  state.serviceWorkspace.message = '';
  state.serviceWorkspace.error = '';
  render();
}

function showServiceCategoryPersistenceUnavailable(event, serviceKey) {
  event.stopPropagation();
  const groupKey = state.serviceWorkspace.selectedGroupKey;
  const category = findServiceCategory(groupKey, serviceKey);
  state.serviceWorkspace.selectedCategoryKey = serviceKey;
  state.serviceWorkspace.actionMenuCategoryKey = '';
  state.serviceWorkspace.message = '';
  state.serviceWorkspace.error = `${category?.label || 'This category'} is a starter category and has not been saved as a catalogue record yet. Create a Bookable Service under it to save the category first.`;
  render();
}

async function createServiceCategory(event, groupKey) {
  event.preventDefault();

  if (!canMutate('markets.update')) {
    state.serviceWorkspace.error = 'You do not have permission to create service categories.';
    state.serviceWorkspace.message = '';
    render();
    return;
  }

  const group = findServiceGroup(groupKey);
  const form = new FormData(event.currentTarget);
  const categoryName = String(form.get('categoryName') || '').trim().replace(/\s+/g, ' ');
  const imageUrl = String(form.get('imageUrl') || '').trim();
  const serviceKey = serviceKeyFrom(categoryName);
  const categories = serviceCategoriesForGroup(groupKey);
  const draftSnapshot = {
    ...captureServiceCategoryDraftFromForm(),
    categoryName,
    imageUrl,
  };
  const fail = (message) => {
    state.serviceWorkspace.categoryDraft = draftSnapshot;
    state.serviceWorkspace.error = message;
    state.serviceWorkspace.message = '';
    render();
  };

  if (!group) {
    fail('Select a top-level group before creating a category.');
    return;
  }

  if (!categoryName) {
    fail('Category name is required.');
    return;
  }

  if (categories.some((category) => category.label.trim().toLowerCase() === categoryName.toLowerCase())) {
    fail('A service category with this name already exists in this group.');
    return;
  }

  if (!serviceKey) {
    fail('Category name must include letters or numbers.');
    return;
  }

  if ((state.data.serviceCatalog || []).some((service) => serviceKeyFrom(service.serviceKey) === serviceKey)) {
    fail('A catalogue record already uses this generated category key. Choose a different category name.');
    return;
  }

  if (imageUrl && !/^https:\/\/[^\s]+$/i.test(imageUrl)) {
    fail('Image must be a valid HTTPS URL.');
    return;
  }

  let uploadedImage = null;
  try {
    uploadedImage = await uploadPendingServiceCategoryImage(serviceKey, categoryName);
  } catch (error) {
    fail(error.message || 'Unable to upload category image.');
    return;
  }

  const finalImageUrl = uploadedImage?.imageUrl || imageUrl;
  const finalImageKey = uploadedImage?.imageKey || serviceKey;

  try {
    await api('/admin/services', {
      method: 'POST',
      body: JSON.stringify({
        serviceKey,
        categoryKey: serviceKey,
        groupKey: group.groupKey,
        groupLabel: group.label,
        groupStatus: 'DRAFT',
        groupDisplayOrder: group.displayOrder || 0,
        label: categoryName,
        description: '',
        imageKey: finalImageKey,
        imageUrl: finalImageUrl,
        searchKeywords: [categoryName],
        synonyms: [],
        requiresCapabilityApproval: true,
        fixedPriceSupported: false,
        subcategories: [],
      }),
    });

    await loadAllData();
    state.activeView = 'services';
    state.serviceWorkspace.selectedGroupKey = group.groupKey;
    state.serviceWorkspace.selectedCategoryKey = serviceKey;
    state.serviceWorkspace.showCreateCategory = false;
    state.serviceWorkspace.categoryDraft = {};
    state.serviceWorkspace.message = `${categoryName} was created.`;
    state.serviceWorkspace.error = '';
    render();
  } catch (error) {
    state.serviceWorkspace.message = '';
    state.serviceWorkspace.error = error.message || 'Unable to create service category.';
    render();
  }
}

async function renameServiceCategory(event, serviceKey) {
  event.preventDefault();

  if (!canMutate('markets.update')) {
    state.serviceWorkspace.error = 'You do not have permission to rename service categories.';
    state.serviceWorkspace.message = '';
    render();
    return;
  }

  const groupKey = state.serviceWorkspace.selectedGroupKey;
  const form = new FormData(event.currentTarget);
  const categoryName = String(form.get('categoryName') || '').trim().replace(/\s+/g, ' ');
  const imageUrl = String(form.get('imageUrl') || '').trim();
  const categories = serviceCategoriesForGroup(groupKey);
  const categoryRecord = serviceCatalogRecord(serviceKey) || {};
  const draftSnapshot = {
    ...captureServiceCategoryDraftFromForm(),
    categoryName,
    imageUrl,
  };
  const fail = (message) => {
    state.serviceWorkspace.categoryDraft = draftSnapshot;
    state.serviceWorkspace.error = message;
    state.serviceWorkspace.message = '';
    render();
  };

  if (!categoryName) {
    fail('Category name is required.');
    return;
  }

  if (categories.some((category) => category.serviceKey !== serviceKey && category.label.trim().toLowerCase() === categoryName.toLowerCase())) {
    fail('A service category with this name already exists in this group.');
    return;
  }

  if (imageUrl && !/^https:\/\/[^\s]+$/i.test(imageUrl)) {
    fail('Image must be a valid HTTPS URL.');
    return;
  }

  let uploadedImage = null;
  try {
    uploadedImage = await uploadPendingServiceCategoryImage(serviceKey, categoryName);
  } catch (error) {
    fail(error.message || 'Unable to upload category image.');
    return;
  }

  const imageRemoved = state.serviceWorkspace.categoryDraft?.imageRemoved === true;
  const finalImageUrl = uploadedImage?.imageUrl || imageUrl || (imageRemoved ? '' : categoryRecord.imageUrl || '');
  const finalImageKey = uploadedImage?.imageKey || (imageRemoved ? serviceKey : categoryRecord.imageKey || serviceKey);

  try {
    await api(`/admin/services/${encodeURIComponent(serviceKey)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        label: categoryName,
        imageKey: finalImageKey,
        imageUrl: finalImageUrl,
      }),
    });
    await loadAllData();
    state.activeView = 'services';
    state.serviceWorkspace.selectedGroupKey = groupKey;
    state.serviceWorkspace.selectedCategoryKey = serviceKey;
    state.serviceWorkspace.renameCategoryKey = '';
    state.serviceWorkspace.categoryDraft = {};
    state.serviceWorkspace.message = `${categoryName} was renamed.`;
    state.serviceWorkspace.error = '';
    render();
  } catch (error) {
    state.serviceWorkspace.message = '';
    state.serviceWorkspace.error = error.message || 'Unable to rename service category.';
    render();
  }
}

async function deleteServiceCategory(serviceKey) {
  if (!canMutate('markets.update')) {
    state.serviceWorkspace.error = 'You do not have permission to delete service categories.';
    state.serviceWorkspace.message = '';
    render();
    return;
  }

  const groupKey = state.serviceWorkspace.selectedGroupKey;

  try {
    const result = await api(`/admin/services/${encodeURIComponent(serviceKey)}`, {
      method: 'DELETE',
    });
    await loadAllData();
    state.activeView = 'services';
    state.serviceWorkspace.selectedGroupKey = groupKey;
    state.serviceWorkspace.selectedCategoryKey = '';
    state.serviceWorkspace.deleteCategoryKey = '';
    state.serviceWorkspace.message = result.message || 'Service category was deleted.';
    state.serviceWorkspace.error = '';
    render();
  } catch (error) {
    state.serviceWorkspace.message = '';
    state.serviceWorkspace.error = error.message || 'Unable to delete service category.';
    render();
  }
}

async function renameTopLevelServiceGroup(event, groupKey) {
  event.preventDefault();

  if (!canMutate('markets.update')) {
    state.serviceWorkspace.error = 'You do not have permission to rename top-level groups.';
    state.serviceWorkspace.message = '';
    render();
    return;
  }

  const form = new FormData(event.currentTarget);
  const groupName = String(form.get('groupName') || '').trim().replace(/\s+/g, ' ');
  const groups = serviceGroupsFromCatalog();

  if (!groupName) {
    state.serviceWorkspace.error = 'Group name is required.';
    state.serviceWorkspace.message = '';
    render();
    return;
  }

  if (groups.some((group) => group.groupKey !== groupKey && group.label.trim().toLowerCase() === groupName.toLowerCase())) {
    state.serviceWorkspace.error = 'A top-level group with this name already exists.';
    state.serviceWorkspace.message = '';
    render();
    return;
  }

  try {
    await api(`/admin/service-groups/${encodeURIComponent(groupKey)}`, {
      method: 'PATCH',
      body: JSON.stringify({ groupLabel: groupName }),
    });
    await loadAllData();
    state.activeView = 'services';
    state.serviceWorkspace.selectedGroupKey = groupKey;
    state.serviceWorkspace.renameGroupKey = '';
    state.serviceWorkspace.message = `${groupName} was renamed.`;
    state.serviceWorkspace.error = '';
    render();
  } catch (error) {
    state.serviceWorkspace.message = '';
    state.serviceWorkspace.error = error.message || 'Unable to rename top-level group.';
    render();
  }
}

async function deleteTopLevelServiceGroup(groupKey) {
  if (!canMutate('markets.update')) {
    state.serviceWorkspace.error = 'You do not have permission to delete top-level groups.';
    state.serviceWorkspace.message = '';
    render();
    return;
  }

  try {
    const result = await api(`/admin/service-groups/${encodeURIComponent(groupKey)}`, {
      method: 'DELETE',
    });
    await loadAllData();
    state.activeView = 'services';
    state.serviceWorkspace.selectedGroupKey = '';
    state.serviceWorkspace.deleteGroupKey = '';
    state.serviceWorkspace.message = result.message || 'Top-level group was deleted.';
    state.serviceWorkspace.error = '';
    render();
  } catch (error) {
    state.serviceWorkspace.message = '';
    state.serviceWorkspace.error = error.message || 'Unable to delete top-level group.';
    render();
  }
}

async function createTopLevelServiceGroup(event) {
  event.preventDefault();

  if (!canMutate('markets.update')) {
    state.serviceWorkspace.error = 'You do not have permission to create top-level groups.';
    state.serviceWorkspace.message = '';
    render();
    return;
  }

  const form = new FormData(event.currentTarget);
  const groupName = String(form.get('groupName') || '').trim().replace(/\s+/g, ' ');
  const groupKey = serviceKeyFrom(groupName);
  const groups = serviceGroupsFromCatalog();

  if (!groupName) {
    state.serviceWorkspace.error = 'Group name is required.';
    state.serviceWorkspace.message = '';
    render();
    return;
  }

  if (groups.some((group) => group.label.trim().toLowerCase() === groupName.toLowerCase())) {
    state.serviceWorkspace.error = 'A top-level group with this name already exists.';
    state.serviceWorkspace.message = '';
    render();
    return;
  }

  if (!groupKey) {
    state.serviceWorkspace.error = 'Group name must include letters or numbers.';
    state.serviceWorkspace.message = '';
    render();
    return;
  }

  if ((state.data.serviceCatalog || []).some((service) => serviceKeyFrom(service.serviceKey) === groupKey)) {
    state.serviceWorkspace.error = 'A catalogue record already uses this generated key. Choose a different group name.';
    state.serviceWorkspace.message = '';
    render();
    return;
  }

  try {
    await api('/admin/services', {
      method: 'POST',
      body: JSON.stringify({
        serviceKey: groupKey,
        categoryKey: groupKey,
        groupKey,
        groupLabel: groupName,
        groupIconKey: serviceGroupIconKey(groupKey, groupName),
        groupStatus: 'DRAFT',
        groupDisplayOrder: Math.max(10, (groups.length + 1) * 10),
        label: groupName,
        description: '',
        imageKey: groupKey,
        searchKeywords: [groupName],
        synonyms: [],
        requiresCapabilityApproval: false,
        fixedPriceSupported: false,
        subcategories: [],
      }),
    });

    await loadAllData();
    state.activeView = 'services';
    state.serviceWorkspace.showCreateGroup = false;
    state.serviceWorkspace.message = `${groupName} was created.`;
    state.serviceWorkspace.error = '';
    render();
  } catch (error) {
    state.serviceWorkspace.message = '';
    state.serviceWorkspace.error = error.message || 'Unable to create top-level group.';
    render();
  }
}

function normalizeMarketCountryCode(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeMarketCurrency(value) {
  return String(value || '').trim().toUpperCase();
}

function isValidIanaTimezone(value) {
  const timezone = String(value || '').trim();
  if (!timezone) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function marketLocaleForCountry(countryCode, existingMarket = null) {
  const existingView = existingMarket ? getMarketView(existingMarket) : null;
  if (existingView?.locale) return existingView.locale;
  const country = findCountryMetadata(countryCode);
  if (country?.locale) return country.locale;
  const template = (state.data.marketMeta.availableMarkets || [])
    .map(getMarketView)
    .find((market) => market.countryCode === countryCode);
  if (template?.locale) return template.locale;
  return `en-${countryCode}`;
}

function getMarketCountryCards() {
  return (state.data.markets || [])
    .map((market) => ({ source: market, view: getMarketView(market) }))
    .filter(({ view }) => view.countryCode)
    .sort((a, b) => (a.view.countryName || a.view.countryCode).localeCompare(b.view.countryName || b.view.countryCode));
}

function normalizeMarketCityName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function marketCityKey(value) {
  return normalizeMarketCityName(value).toLowerCase();
}

function getMarketCities(market = null) {
  if (!market) return [];
  const view = getMarketView(market);
  const byKey = new Map();
  (view.supportedCities || []).forEach((city) => {
    const name = normalizeMarketCityName(city);
    if (name) byKey.set(marketCityKey(name), { name, countryName: view.countryName || view.countryCode });
  });
  (view.cityServiceAvailability || []).forEach((row) => {
    const name = normalizeMarketCityName(row?.city);
    if (name && !byKey.has(marketCityKey(name))) byKey.set(marketCityKey(name), { name, countryName: view.countryName || view.countryCode });
  });
  return Array.from(byKey.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function normalizeMarketAreaName(value) {
  return normalizeMarketCityName(value);
}

function marketAreaKey(value) {
  return marketCityKey(value);
}

function getMarketAreas(market = null, cityName = '') {
  if (!market || !cityName) return [];
  const view = getMarketView(market);
  const cityRow = (view.cityServiceAvailability || []).find((row) => marketCityKey(row?.city) === marketCityKey(cityName));
  return (cityRow?.areas || [])
    .map((area) => ({ name: normalizeMarketAreaName(area?.name), cityName: normalizeMarketCityName(cityRow.city), countryName: view.countryName || view.countryCode }))
    .filter((area) => area.name)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function renderMarketCountryForm(mode = 'create', market = null) {
  const isEdit = mode === 'edit';
  const marketView = market ? getMarketView(market) : {};
  const countryCode = normalizeMarketCountryCode(marketView.countryCode);
  const selectedCountry = isEdit ? findCountryMetadata(countryCode || marketView.countryName) : null;
  const countryName = isEdit ? marketView.countryName || selectedCountry?.name || '' : '';
  const currency = isEdit ? marketView.currency || selectedCountry?.currency || '' : '';
  const timezone = timezoneOptionsForCountry(selectedCountry, isEdit ? marketView.timezone || selectedCountry?.timezones?.[0] || '' : '');
  return `
    <form class="market-country-form drawer-form" onsubmit="saveMarketCountry(event, '${isEdit ? 'edit' : 'create'}', '${escapeHtml(countryCode)}')">
      <div>
        <strong>${isEdit ? `Edit ${escapeHtml(marketView.countryName || countryCode)}` : 'Create Country'}</strong>
        <p>Only core country identity is configured in this step.</p>
      </div>
      <label>
        Country
        <input name="countryName" required list="market-country-options" value="${escapeHtml(countryName)}" placeholder="Search countries" ${isEdit ? 'readonly' : ''} oninput="syncMarketCountrySelection(this)" onchange="syncMarketCountrySelection(this)" />
      </label>
      <datalist id="market-country-options">
        ${countryMetadataList().map((country) => `<option value="${escapeHtml(country.name)}">${escapeHtml(`${country.name} (${country.code})`)}</option>`).join('')}
      </datalist>
      <label>
        Country Code
        <input name="countryCode" required readonly maxlength="2" value="${escapeHtml(countryCode || selectedCountry?.code || '')}" placeholder="UG" data-country-code />
      </label>
      <label>
        Currency
        <input name="currency" required readonly maxlength="3" value="${escapeHtml(currency)}" placeholder="UGX" data-country-currency />
      </label>
      <label>
        Time Zone
        <select name="timezone" required data-country-timezone>
          ${timezone.options.length
            ? timezone.options.map((option) => `<option value="${escapeHtml(option)}" ${option === timezone.selected ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')
            : '<option value="">Select a country first</option>'}
        </select>
      </label>
      <div class="form-actions">
        <button class="primary-button compact" type="submit">Save</button>
        <button class="ghost-button compact" type="button" onclick="cancelMarketCountryForm()">Cancel</button>
      </div>
    </form>
  `;
}

function renderMarketCountryDeleteConfirmation(market) {
  if (!market) return '';
  const marketView = getMarketView(market);
  return `
    <div class="market-country-confirm">
      <strong>Delete ${escapeHtml(marketView.countryName || marketView.countryCode)}?</strong>
      <p>This is permanent and is allowed only for an unused draft country. The backend will block deletion if cities, services, bookings, payments, promotions, or operational history exist.</p>
      <div class="form-actions">
        <button class="danger-button compact" type="button" onclick="deleteMarketCountry('${escapeHtml(marketView.countryCode)}')">Delete Country</button>
        <button class="ghost-button compact" type="button" onclick="cancelMarketCountryForm()">Cancel</button>
      </div>
    </div>
  `;
}

function renderMarketCountryCard(market, selectedCountryCode, canUpdateMarkets) {
  const marketView = getMarketView(market);
  const isSelected = marketView.countryCode === selectedCountryCode;
  const actionMenuOpen = state.marketWorkflow.actionMenuCountryCode === marketView.countryCode;
  return `
    <article class="market-country-card ${isSelected ? 'selected' : ''}" role="button" tabindex="0" onclick="selectMarketCountry('${escapeHtml(marketView.countryCode)}')" onkeydown="handleMarketCountryCardKey(event, '${escapeHtml(marketView.countryCode)}')">
      <div class="market-country-card-copy">
        <strong>${escapeHtml(marketView.countryName || marketView.countryCode)}</strong>
        <small>Country</small>
        <em>${escapeHtml(marketView.currency || '-')}</em>
        ${marketView.timezone ? `<span>${escapeHtml(marketView.timezone)}</span>` : ''}
      </div>
      <div class="market-country-card-meta">
        <span class="status ${statusClass(marketView.status)}">${escapeHtml(String(marketView.status || 'DRAFT').replace('_', ' '))}</span>
        <span class="market-country-arrow">›</span>
      </div>
      ${canUpdateMarkets ? `
        <div class="market-country-actions" onclick="event.stopPropagation()">
          <button class="icon-button" type="button" aria-label="Country actions" onclick="toggleMarketCountryActions('${escapeHtml(marketView.countryCode)}')">...</button>
          ${actionMenuOpen ? `
            <div class="market-country-menu">
              <button type="button" onclick="startEditMarketCountry('${escapeHtml(marketView.countryCode)}')">Edit</button>
              <button type="button" onclick="startDeleteMarketCountry('${escapeHtml(marketView.countryCode)}')">Delete</button>
            </div>
          ` : ''}
        </div>
      ` : ''}
    </article>
  `;
}

function renderMarketCityForm(mode = 'create', market = null, city = '') {
  const marketView = getMarketView(market || {});
  const isEdit = mode === 'edit';
  const cityName = isEdit ? city : '';
  return `
    <form class="market-city-form drawer-form" onsubmit="saveMarketCity(event, '${isEdit ? 'edit' : 'create'}', '${escapeHtml(marketView.countryCode || '')}', '${escapeHtml(cityName)}')">
      <div>
        <strong>${isEdit ? `Rename ${escapeHtml(cityName)}` : 'Create City'}</strong>
        <p>Country: ${escapeHtml(marketView.countryName || marketView.countryCode || 'Selected country')}</p>
      </div>
      <label>
        City Name
        <input name="cityName" required value="${escapeHtml(cityName)}" placeholder="Kampala" />
      </label>
      <div class="form-actions">
        <button class="primary-button compact" type="submit">Save</button>
        <button class="ghost-button compact" type="button" onclick="cancelMarketCityForm()">Cancel</button>
      </div>
    </form>
  `;
}

function renderMarketCityDeleteConfirmation(market, cityName) {
  const marketView = getMarketView(market || {});
  if (!cityName) return '';
  return `
    <div class="market-city-confirm">
      <strong>Delete ${escapeHtml(cityName)}?</strong>
      <p>This is permanent and only allowed when the backend confirms the city has no service availability, areas, bookings, technicians, promotions, or operational history.</p>
      <div class="form-actions">
        <button class="danger-button compact" type="button" onclick="deleteMarketCity('${escapeHtml(marketView.countryCode)}', '${escapeHtml(cityName)}')">Delete City</button>
        <button class="ghost-button compact" type="button" onclick="cancelMarketCityForm()">Cancel</button>
      </div>
    </div>
  `;
}

function renderMarketCityCard(city, selectedCityName, canUpdateMarkets) {
  const isSelected = marketCityKey(city.name) === marketCityKey(selectedCityName);
  const actionMenuOpen = marketCityKey(state.marketWorkflow.actionMenuCityName) === marketCityKey(city.name);
  return `
    <article class="market-city-card ${isSelected ? 'selected' : ''} ${actionMenuOpen ? 'menu-open' : ''}" role="button" tabindex="0" onclick="selectMarketCity('${escapeHtml(city.name)}')" onkeydown="handleMarketCityCardKey(event, '${escapeHtml(city.name)}')">
      <div class="market-city-card-copy">
        <strong>${escapeHtml(city.name)}</strong>
        <small>City</small>
        <em>${escapeHtml(city.countryName)}</em>
      </div>
      <span class="market-country-arrow">›</span>
      ${canUpdateMarkets ? `
        <div class="market-city-actions" onclick="event.stopPropagation()">
          <button class="icon-button" type="button" aria-label="City actions" onclick="toggleMarketCityActions('${escapeHtml(city.name)}', this)">...</button>
          ${actionMenuOpen ? `
            <div class="market-city-menu ${state.marketWorkflow.actionMenuCityDirection === 'up' ? 'menu-up' : 'menu-down'}">
              <button type="button" onclick="startEditMarketCity('${escapeHtml(city.name)}')">Rename</button>
              <button type="button" onclick="startDeleteMarketCity('${escapeHtml(city.name)}')">Delete</button>
            </div>
          ` : ''}
        </div>
      ` : ''}
    </article>
  `;
}

function renderMarketCitiesCard(selectedMarket, canUpdateMarkets) {
  const marketView = selectedMarket ? getMarketView(selectedMarket) : {};
  const cities = getMarketCities(selectedMarket);
  const selectedCity = cities.find((city) => marketCityKey(city.name) === marketCityKey(state.marketWorkflow.selectedCityName));

  return `
    <div class="market-step-card market-step-card-cities">
      <div class="market-step-header">
        <div>
          <small>Market Step 2</small>
          <h3>Cities</h3>
          <span>${selectedMarket ? `Selected Country: ${escapeHtml(marketView.countryName || marketView.countryCode)}` : 'Select a Country to view its Cities.'}</span>
        </div>
        ${canUpdateMarkets ? `<button class="primary-button compact" type="button" onclick="showCreateMarketCityForm()" ${selectedMarket ? '' : 'disabled'}>+ Create City</button>` : ''}
      </div>
      ${!selectedMarket ? renderEmpty('Select a Country to view its Cities.') : ''}
      ${selectedMarket && !canUpdateMarkets ? '<p class="setting-help">Read-only admins can view and select cities but cannot create or edit them.</p>' : ''}
      ${selectedMarket ? `
        <div class="market-city-scroll">
          ${cities.length
            ? `<div class="market-city-grid">${cities.map((city) => renderMarketCityCard(city, state.marketWorkflow.selectedCityName, canUpdateMarkets)).join('')}</div>`
            : renderEmpty(`No Cities have been added to ${marketView.countryName || marketView.countryCode} yet.`)}
        </div>
      ` : ''}
      ${selectedCity ? `<div class="market-step-note inline"><strong>${escapeHtml(selectedCity.name)} selected</strong><p>This city can operate with GPS-based dispatch. Areas remain optional labels.</p></div>` : ''}
    </div>
  `;
}

function renderMarketAreaForm(mode = 'create', market = null, cityName = '', areaName = '') {
  const marketView = getMarketView(market || {});
  const isEdit = mode === 'edit';
  return `
    <form class="market-area-form drawer-form" onsubmit="saveMarketArea(event, '${isEdit ? 'edit' : 'create'}', '${escapeHtml(marketView.countryCode || '')}', '${escapeHtml(cityName)}', '${escapeHtml(areaName)}')">
      <div>
        <strong>${isEdit ? `Rename ${escapeHtml(areaName)}` : 'Create Area'}</strong>
        <p>Country: ${escapeHtml(marketView.countryName || marketView.countryCode || 'Selected country')}</p>
        <p>City: ${escapeHtml(cityName || 'Selected city')}</p>
      </div>
      <label>
        Area Name
        <input name="areaName" required value="${escapeHtml(isEdit ? areaName : '')}" placeholder="Kololo" />
      </label>
      <div class="form-actions">
        <button class="primary-button compact" type="submit">Save</button>
        <button class="ghost-button compact" type="button" onclick="cancelMarketAreaForm()">Cancel</button>
      </div>
    </form>
  `;
}

function renderMarketAreaDeleteConfirmation(market, cityName, areaName) {
  const marketView = getMarketView(market || {});
  if (!areaName) return '';
  return `
    <div class="market-area-confirm">
      <strong>Delete ${escapeHtml(areaName)}?</strong>
      <p>This action cannot be undone.</p>
      <p>The Area can only be deleted if it is not currently being used by any services, technicians, bookings, promotions or other operational records.</p>
      <div class="form-actions">
        <button class="danger-button compact" type="button" onclick="deleteMarketArea('${escapeHtml(marketView.countryCode)}', '${escapeHtml(cityName)}', '${escapeHtml(areaName)}')">Delete Area</button>
        <button class="ghost-button compact" type="button" onclick="cancelMarketAreaForm()">Cancel</button>
      </div>
    </div>
  `;
}

function renderMarketAreaCard(area, selectedAreaName, canUpdateMarkets) {
  const isSelected = marketAreaKey(area.name) === marketAreaKey(selectedAreaName);
  const actionMenuOpen = marketAreaKey(state.marketWorkflow.actionMenuAreaName) === marketAreaKey(area.name);
  return `
    <article class="market-area-card ${isSelected ? 'selected' : ''} ${actionMenuOpen ? 'menu-open' : ''}" role="button" tabindex="0" onclick="selectMarketArea('${escapeHtml(area.name)}')" onkeydown="handleMarketAreaCardKey(event, '${escapeHtml(area.name)}')">
      <div class="market-area-card-copy">
        <strong>${escapeHtml(area.name)}</strong>
        <small>Area</small>
        <em>${escapeHtml(area.cityName)}, ${escapeHtml(area.countryName)}</em>
      </div>
      <span class="market-country-arrow">›</span>
      ${canUpdateMarkets ? `
        <div class="market-area-actions" onclick="event.stopPropagation()">
          <button class="icon-button" type="button" aria-label="Area actions" onclick="toggleMarketAreaActions('${escapeHtml(area.name)}', this)">...</button>
          ${actionMenuOpen ? `
            <div class="market-area-menu ${state.marketWorkflow.actionMenuAreaDirection === 'up' ? 'menu-up' : 'menu-down'}">
              <button type="button" onclick="startEditMarketArea('${escapeHtml(area.name)}')">Rename</button>
              <button type="button" onclick="startDeleteMarketArea('${escapeHtml(area.name)}')">Delete</button>
            </div>
          ` : ''}
        </div>
      ` : ''}
    </article>
  `;
}

function renderMarketAreasCard(selectedMarket, canUpdateMarkets) {
  const marketView = selectedMarket ? getMarketView(selectedMarket) : {};
  const cityName = state.marketWorkflow.selectedCityName;
  const areas = getMarketAreas(selectedMarket, cityName);
  const selectedArea = areas.find((area) => marketAreaKey(area.name) === marketAreaKey(state.marketWorkflow.selectedAreaName));

  return `
    <div class="market-step-card market-step-card-areas">
      <div class="market-step-header">
        <div>
          <small>Market Step 3</small>
          <h3>Areas</h3>
          <span>${selectedMarket && cityName ? `Optional Areas for ${escapeHtml(cityName)}` : selectedMarket ? 'Select a City to view optional Areas.' : 'Select a Country and City to view optional Areas.'}</span>
        </div>
        ${canUpdateMarkets ? `<button class="primary-button compact" type="button" onclick="showCreateMarketAreaForm()" ${selectedMarket && cityName ? '' : 'disabled'}>+ Create Area</button>` : ''}
      </div>
      ${!selectedMarket ? renderEmpty('Select a Country and City to view optional Areas.') : ''}
      ${selectedMarket && !cityName ? renderEmpty('Select a City to view optional Areas.') : ''}
      ${selectedMarket && cityName && !canUpdateMarkets ? '<p class="setting-help">Read-only admins can view and select areas but cannot create or edit them.</p>' : ''}
      ${selectedMarket && cityName ? `
        <div class="market-area-scroll">
          ${areas.length
            ? `<div class="market-area-grid">${areas.map((area) => renderMarketAreaCard(area, state.marketWorkflow.selectedAreaName, canUpdateMarkets)).join('')}</div>`
            : renderEmpty(
              'City-wide GPS dispatch remains available.',
              'No Areas configured.',
              'Areas can be added later for reporting, pricing, promotions and operational management.'
            )}
        </div>
      ` : ''}
      ${selectedArea ? `<div class="market-step-note inline"><strong>${escapeHtml(selectedArea.name)} selected</strong><p>Areas are optional administrative labels. They are not required for service availability or technician dispatch.</p></div>` : ''}
    </div>
  `;
}

function renderMarketManagementDrawer(selectedMarket) {
  const workflow = state.marketWorkflow;
  const editingMarket = (state.data.markets || []).find((market) => getMarketView(market).countryCode === workflow.editingCountryCode) || null;
  const deletingMarket = (state.data.markets || []).find((market) => getMarketView(market).countryCode === workflow.deleteCountryCode) || null;
  const selectedCityName = workflow.selectedCityName;
  let eyebrow = '';
  let title = '';
  let subtitle = '';
  let content = '';

  if (workflow.showCreateCountry) {
    eyebrow = 'Market Step 1';
    title = 'Create Country';
    subtitle = 'Add the country identity Padi operates under.';
    content = renderMarketCountryForm('create');
  } else if (workflow.editingCountryCode) {
    const view = getMarketView(editingMarket || {});
    eyebrow = 'Market Step 1';
    title = `Edit ${view.countryName || workflow.editingCountryCode}`;
    subtitle = 'Update country identity details.';
    content = renderMarketCountryForm('edit', editingMarket);
  } else if (workflow.deleteCountryCode) {
    const view = getMarketView(deletingMarket || {});
    eyebrow = 'Market Step 1';
    title = `Delete ${view.countryName || workflow.deleteCountryCode}`;
    subtitle = 'The backend will only allow this when the country is unused.';
    content = renderMarketCountryDeleteConfirmation(deletingMarket);
  } else if (workflow.showCreateCity) {
    const view = getMarketView(selectedMarket || {});
    eyebrow = 'Market Step 2';
    title = 'Create City';
    subtitle = view.countryName ? `Add a city under ${view.countryName}.` : 'Add a city under the selected country.';
    content = renderMarketCityForm('create', selectedMarket);
  } else if (workflow.editingCityName) {
    eyebrow = 'Market Step 2';
    title = `Rename ${workflow.editingCityName}`;
    subtitle = 'Keep the city under the selected country.';
    content = renderMarketCityForm('edit', selectedMarket, workflow.editingCityName);
  } else if (workflow.deleteCityName) {
    eyebrow = 'Market Step 2';
    title = `Delete ${workflow.deleteCityName}`;
    subtitle = 'The backend will block deletion when operational data exists.';
    content = renderMarketCityDeleteConfirmation(selectedMarket, workflow.deleteCityName);
  } else if (workflow.showCreateArea) {
    eyebrow = 'Market Step 3';
    title = 'Create Area';
    subtitle = selectedCityName ? `Add an optional area under ${selectedCityName}.` : 'Add an optional area under the selected city.';
    content = renderMarketAreaForm('create', selectedMarket, selectedCityName);
  } else if (workflow.editingAreaName) {
    eyebrow = 'Market Step 3';
    title = `Rename ${workflow.editingAreaName}`;
    subtitle = selectedCityName ? `Optional area under ${selectedCityName}.` : 'Optional area under the selected city.';
    content = renderMarketAreaForm('edit', selectedMarket, selectedCityName, workflow.editingAreaName);
  } else if (workflow.deleteAreaName) {
    eyebrow = 'Market Step 3';
    title = `Delete ${workflow.deleteAreaName}`;
    subtitle = 'The backend will only allow deletion when the area is unused.';
    content = renderMarketAreaDeleteConfirmation(selectedMarket, selectedCityName, workflow.deleteAreaName);
  }

  if (!content) return '';

  return `
    <div class="service-drawer-overlay market-drawer-overlay" onclick="cancelMarketManagementDrawer()"></div>
    <aside class="service-details-drawer market-details-drawer" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <div class="service-drawer-header">
        <div>
          <small>${escapeHtml(eyebrow)}</small>
          <h3>${escapeHtml(title)}</h3>
          <span>${escapeHtml(subtitle)}</span>
        </div>
        <button class="icon-button" type="button" aria-label="Close Market editor" onclick="cancelMarketManagementDrawer()">x</button>
      </div>
      ${content}
    </aside>
  `;
}

function renderSettings() {
  const canUpdateMarkets = canMutate('markets.update');
  const marketCards = getMarketCountryCards();
  const selectedCountryCode = state.marketWorkflow.selectedCountryCode;
  const selectedMarket = (state.data.markets || []).find((market) => getMarketView(market).countryCode === selectedCountryCode) || null;

  return `
    <section class="markets-page-shell">
      <div class="markets-page-heading">
        <h2>Markets</h2>
        <span>Manage countries, cities, and optional areas for Padi operations.</span>
      </div>
      ${state.marketWorkflow.message ? `<div class="notice success">${escapeHtml(state.marketWorkflow.message)}</div>` : ''}
      ${state.marketWorkflow.error ? `<div class="notice error">${escapeHtml(state.marketWorkflow.error)}</div>` : ''}
      <div class="markets-builder-grid">
        <div class="market-step-card">
          <div class="market-step-header">
            <div>
              <small>Market Step 1</small>
              <h3>Countries</h3>
              <span>${marketCards.length} configured ${marketCards.length === 1 ? 'country' : 'countries'}</span>
            </div>
            ${canUpdateMarkets ? '<button class="primary-button compact" type="button" onclick="showCreateMarketCountryForm()">+ Create Country</button>' : ''}
          </div>
          ${!canUpdateMarkets ? '<p class="setting-help">Read-only admins can view and select countries but cannot create or edit them.</p>' : ''}
          <div class="market-country-scroll">
            ${marketCards.length
              ? `<div class="market-country-grid">${marketCards.map(({ source }) => renderMarketCountryCard(source, selectedCountryCode, canUpdateMarkets)).join('')}</div>`
              : renderEmpty('No countries have been configured yet.')}
          </div>
        </div>
        ${renderMarketCitiesCard(selectedMarket, canUpdateMarkets)}
        ${renderMarketAreasCard(selectedMarket, canUpdateMarkets)}
      </div>
      ${renderMarketManagementDrawer(selectedMarket)}
    </section>
  `;
}

function showCreateMarketCountryForm() {
  if (!canMutate('markets.update')) return;
  state.marketWorkflow.showCreateCountry = true;
  state.marketWorkflow.editingCountryCode = '';
  state.marketWorkflow.deleteCountryCode = '';
  state.marketWorkflow.actionMenuCountryCode = '';
  state.marketWorkflow.message = '';
  state.marketWorkflow.error = '';
  render();
}

function cancelMarketManagementDrawer() {
  const hasUnsavedForm = state.marketWorkflow.showCreateCountry ||
    state.marketWorkflow.editingCountryCode ||
    state.marketWorkflow.showCreateCity ||
    state.marketWorkflow.editingCityName ||
    state.marketWorkflow.showCreateArea ||
    state.marketWorkflow.editingAreaName;
  if (hasUnsavedForm && !window.confirm('Discard unsaved market changes?')) return;

  state.marketWorkflow.showCreateCountry = false;
  state.marketWorkflow.editingCountryCode = '';
  state.marketWorkflow.deleteCountryCode = '';
  state.marketWorkflow.actionMenuCountryCode = '';
  state.marketWorkflow.showCreateCity = false;
  state.marketWorkflow.editingCityName = '';
  state.marketWorkflow.deleteCityName = '';
  state.marketWorkflow.actionMenuCityName = '';
  state.marketWorkflow.showCreateArea = false;
  state.marketWorkflow.editingAreaName = '';
  state.marketWorkflow.deleteAreaName = '';
  state.marketWorkflow.actionMenuAreaName = '';
  state.marketWorkflow.error = '';
  render();
}

function cancelMarketCountryForm() {
  const hasOpenForm = state.marketWorkflow.showCreateCountry || state.marketWorkflow.editingCountryCode;
  if (hasOpenForm && !window.confirm('Discard unsaved country changes?')) return;
  state.marketWorkflow.showCreateCountry = false;
  state.marketWorkflow.editingCountryCode = '';
  state.marketWorkflow.deleteCountryCode = '';
  state.marketWorkflow.actionMenuCountryCode = '';
  state.marketWorkflow.error = '';
  render();
}

function selectMarketCountry(countryCode) {
  const previousCountryCode = state.marketWorkflow.selectedCountryCode;
  state.marketWorkflow.selectedCountryCode = countryCode;
  if (previousCountryCode !== countryCode) {
    state.marketWorkflow.selectedCityName = '';
    state.marketWorkflow.showCreateCity = false;
    state.marketWorkflow.editingCityName = '';
    state.marketWorkflow.deleteCityName = '';
    state.marketWorkflow.actionMenuCityName = '';
    state.marketWorkflow.selectedAreaName = '';
    state.marketWorkflow.showCreateArea = false;
    state.marketWorkflow.editingAreaName = '';
    state.marketWorkflow.deleteAreaName = '';
    state.marketWorkflow.actionMenuAreaName = '';
  }
  state.marketWorkflow.actionMenuCountryCode = '';
  state.marketWorkflow.message = '';
  state.marketWorkflow.error = '';
  render();
}

function handleMarketCountryCardKey(event, countryCode) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    selectMarketCountry(countryCode);
  }
}

function toggleMarketCountryActions(countryCode) {
  state.marketWorkflow.actionMenuCountryCode = state.marketWorkflow.actionMenuCountryCode === countryCode ? '' : countryCode;
  render();
}

function startEditMarketCountry(countryCode) {
  if (!canMutate('markets.update')) return;
  state.marketWorkflow.editingCountryCode = countryCode;
  state.marketWorkflow.showCreateCountry = false;
  state.marketWorkflow.deleteCountryCode = '';
  state.marketWorkflow.actionMenuCountryCode = '';
  state.marketWorkflow.message = '';
  state.marketWorkflow.error = '';
  render();
}

function startDeleteMarketCountry(countryCode) {
  if (!canMutate('markets.update')) return;
  state.marketWorkflow.deleteCountryCode = countryCode;
  state.marketWorkflow.showCreateCountry = false;
  state.marketWorkflow.editingCountryCode = '';
  state.marketWorkflow.actionMenuCountryCode = '';
  state.marketWorkflow.message = '';
  state.marketWorkflow.error = '';
  render();
}

function showCreateMarketCityForm() {
  if (!canMutate('markets.update') || !state.marketWorkflow.selectedCountryCode) return;
  state.marketWorkflow.showCreateCity = true;
  state.marketWorkflow.editingCityName = '';
  state.marketWorkflow.deleteCityName = '';
  state.marketWorkflow.actionMenuCityName = '';
  state.marketWorkflow.showCreateArea = false;
  state.marketWorkflow.editingAreaName = '';
  state.marketWorkflow.deleteAreaName = '';
  state.marketWorkflow.actionMenuAreaName = '';
  state.marketWorkflow.message = '';
  state.marketWorkflow.error = '';
  render();
}

function cancelMarketCityForm() {
  const hasOpenForm = state.marketWorkflow.showCreateCity || state.marketWorkflow.editingCityName;
  if (hasOpenForm && !window.confirm('Discard unsaved city changes?')) return;
  state.marketWorkflow.showCreateCity = false;
  state.marketWorkflow.editingCityName = '';
  state.marketWorkflow.deleteCityName = '';
  state.marketWorkflow.actionMenuCityName = '';
  state.marketWorkflow.error = '';
  render();
}

async function selectMarketCity(cityName) {
  const previousCityName = state.marketWorkflow.selectedCityName;
  state.marketWorkflow.selectedCityName = cityName;
  if (marketCityKey(previousCityName) !== marketCityKey(cityName)) {
    state.marketWorkflow.selectedAreaName = '';
    state.marketWorkflow.showCreateArea = false;
    state.marketWorkflow.editingAreaName = '';
    state.marketWorkflow.deleteAreaName = '';
    state.marketWorkflow.actionMenuAreaName = '';
  }
  state.marketWorkflow.actionMenuCityName = '';
  state.marketWorkflow.message = '';
  state.marketWorkflow.error = '';
  render();
}

function handleMarketCityCardKey(event, cityName) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    selectMarketCity(cityName);
  }
}

function toggleMarketCityActions(cityName, button = null) {
  const isOpen = marketCityKey(state.marketWorkflow.actionMenuCityName) === marketCityKey(cityName);
  if (isOpen) {
    state.marketWorkflow.actionMenuCityName = '';
    render();
    return;
  }
  let direction = 'down';
  const scrollContainer = button?.closest?.('.market-city-scroll');
  if (button && scrollContainer) {
    const buttonRect = button.getBoundingClientRect();
    const containerRect = scrollContainer.getBoundingClientRect();
    const estimatedMenuHeight = 92;
    const spaceBelow = containerRect.bottom - buttonRect.bottom;
    const spaceAbove = buttonRect.top - containerRect.top;
    direction = spaceBelow >= estimatedMenuHeight || spaceBelow >= spaceAbove ? 'down' : 'up';
  }
  state.marketWorkflow.actionMenuCityDirection = direction;
  state.marketWorkflow.actionMenuCityName = cityName;
  render();
}

function startEditMarketCity(cityName) {
  if (!canMutate('markets.update')) return;
  state.marketWorkflow.editingCityName = cityName;
  state.marketWorkflow.showCreateCity = false;
  state.marketWorkflow.deleteCityName = '';
  state.marketWorkflow.actionMenuCityName = '';
  state.marketWorkflow.message = '';
  state.marketWorkflow.error = '';
  render();
}

function startDeleteMarketCity(cityName) {
  if (!canMutate('markets.update')) return;
  state.marketWorkflow.deleteCityName = cityName;
  state.marketWorkflow.showCreateCity = false;
  state.marketWorkflow.editingCityName = '';
  state.marketWorkflow.actionMenuCityName = '';
  state.marketWorkflow.message = '';
  state.marketWorkflow.error = '';
  render();
}

function validateMarketCityForm(form, mode, currentCityName = '') {
  const cityName = normalizeMarketCityName(form.get('cityName'));
  const selectedCountryCode = state.marketWorkflow.selectedCountryCode;
  const selectedMarket = (state.data.markets || []).find((market) => getMarketView(market).countryCode === selectedCountryCode) || null;
  if (!selectedMarket) return { error: 'Select a persisted Country before adding Cities.' };
  if (!cityName) return { error: 'City name is required.' };
  const duplicate = getMarketCities(selectedMarket).some((city) =>
    marketCityKey(city.name) === marketCityKey(cityName) &&
    (mode !== 'edit' || marketCityKey(city.name) !== marketCityKey(currentCityName))
  );
  if (duplicate) return { error: 'A city with this name already exists in this country.' };
  return { cityName, countryCode: selectedCountryCode, selectedMarket };
}

async function saveMarketCity(event, mode = 'create', countryCode = '', currentCityName = '') {
  event.preventDefault();
  if (!canMutate('markets.update')) {
    alert('You do not have permission to update markets.');
    return;
  }
  const form = new FormData(event.currentTarget);
  const validation = validateMarketCityForm(form, mode, currentCityName);
  if (validation.error) {
    state.marketWorkflow.error = validation.error;
    state.marketWorkflow.message = '';
    render();
    return;
  }

  try {
    const encodedCity = encodeURIComponent(currentCityName);
    await api(mode === 'edit'
      ? `/admin/markets/${validation.countryCode}/cities/${encodedCity}`
      : `/admin/markets/${validation.countryCode}/cities`, {
      method: mode === 'edit' ? 'PATCH' : 'POST',
      body: JSON.stringify({ cityName: validation.cityName }),
    });
    await loadAllData();
    state.activeView = 'settings';
    state.marketWorkflow.selectedCountryCode = validation.countryCode;
    state.marketWorkflow.selectedCityName = validation.cityName;
    state.marketWorkflow.selectedAreaName = '';
    state.marketWorkflow.showCreateCity = false;
    state.marketWorkflow.editingCityName = '';
    state.marketWorkflow.deleteCityName = '';
    state.marketWorkflow.actionMenuCityName = '';
    state.marketWorkflow.showCreateArea = false;
    state.marketWorkflow.editingAreaName = '';
    state.marketWorkflow.deleteAreaName = '';
    state.marketWorkflow.actionMenuAreaName = '';
    state.marketWorkflow.message = `${validation.cityName} was saved.`;
    state.marketWorkflow.error = '';
    render();
  } catch (error) {
    state.marketWorkflow.message = '';
    state.marketWorkflow.error = error.message || 'Unable to save city.';
    render();
  }
}

async function deleteMarketCity(countryCode, cityName) {
  if (!canMutate('markets.update')) {
    alert('You do not have permission to update markets.');
    return;
  }
  if (!window.confirm(`Delete ${cityName}? This is permanent and only allowed when the city is unused.`)) return;
  try {
    await api(`/admin/markets/${countryCode}/cities/${encodeURIComponent(cityName)}`, { method: 'DELETE' });
    await loadAllData();
    state.marketWorkflow.selectedCountryCode = countryCode;
    state.marketWorkflow.selectedCityName = marketCityKey(state.marketWorkflow.selectedCityName) === marketCityKey(cityName) ? '' : state.marketWorkflow.selectedCityName;
    if (!state.marketWorkflow.selectedCityName) {
      state.marketWorkflow.selectedAreaName = '';
      state.marketWorkflow.showCreateArea = false;
      state.marketWorkflow.editingAreaName = '';
      state.marketWorkflow.deleteAreaName = '';
      state.marketWorkflow.actionMenuAreaName = '';
    }
    state.marketWorkflow.deleteCityName = '';
    state.marketWorkflow.actionMenuCityName = '';
    state.marketWorkflow.message = `${cityName} was deleted.`;
    state.marketWorkflow.error = '';
    render();
  } catch (error) {
    state.marketWorkflow.message = '';
    state.marketWorkflow.error = error.message || 'Unable to delete city.';
    render();
  }
}

function showCreateMarketAreaForm() {
  if (!canMutate('markets.update') || !state.marketWorkflow.selectedCountryCode || !state.marketWorkflow.selectedCityName) return;
  state.marketWorkflow.showCreateArea = true;
  state.marketWorkflow.editingAreaName = '';
  state.marketWorkflow.deleteAreaName = '';
  state.marketWorkflow.actionMenuAreaName = '';
  state.marketWorkflow.message = '';
  state.marketWorkflow.error = '';
  render();
}

function cancelMarketAreaForm() {
  const hasOpenForm = state.marketWorkflow.showCreateArea || state.marketWorkflow.editingAreaName;
  if (hasOpenForm && !window.confirm('Discard unsaved area changes?')) return;
  state.marketWorkflow.showCreateArea = false;
  state.marketWorkflow.editingAreaName = '';
  state.marketWorkflow.deleteAreaName = '';
  state.marketWorkflow.actionMenuAreaName = '';
  state.marketWorkflow.error = '';
  render();
}

function selectMarketArea(areaName) {
  state.marketWorkflow.selectedAreaName = areaName;
  state.marketWorkflow.actionMenuAreaName = '';
  state.marketWorkflow.message = '';
  state.marketWorkflow.error = '';
  render();
}

function handleMarketAreaCardKey(event, areaName) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    selectMarketArea(areaName);
  }
}

function toggleMarketAreaActions(areaName, button = null) {
  const isOpen = marketAreaKey(state.marketWorkflow.actionMenuAreaName) === marketAreaKey(areaName);
  if (isOpen) {
    state.marketWorkflow.actionMenuAreaName = '';
    render();
    return;
  }
  let direction = 'down';
  const scrollContainer = button?.closest?.('.market-area-scroll');
  if (button && scrollContainer) {
    const buttonRect = button.getBoundingClientRect();
    const containerRect = scrollContainer.getBoundingClientRect();
    const estimatedMenuHeight = 92;
    const spaceBelow = containerRect.bottom - buttonRect.bottom;
    const spaceAbove = buttonRect.top - containerRect.top;
    direction = spaceBelow >= estimatedMenuHeight || spaceBelow >= spaceAbove ? 'down' : 'up';
  }
  state.marketWorkflow.actionMenuAreaDirection = direction;
  state.marketWorkflow.actionMenuAreaName = areaName;
  render();
}

function startEditMarketArea(areaName) {
  if (!canMutate('markets.update')) return;
  state.marketWorkflow.editingAreaName = areaName;
  state.marketWorkflow.showCreateArea = false;
  state.marketWorkflow.deleteAreaName = '';
  state.marketWorkflow.actionMenuAreaName = '';
  state.marketWorkflow.message = '';
  state.marketWorkflow.error = '';
  render();
}

function startDeleteMarketArea(areaName) {
  if (!canMutate('markets.update')) return;
  state.marketWorkflow.deleteAreaName = areaName;
  state.marketWorkflow.showCreateArea = false;
  state.marketWorkflow.editingAreaName = '';
  state.marketWorkflow.actionMenuAreaName = '';
  state.marketWorkflow.message = '';
  state.marketWorkflow.error = '';
  render();
}

function validateMarketAreaForm(form, mode, currentAreaName = '') {
  const areaName = normalizeMarketAreaName(form.get('areaName'));
  const selectedCountryCode = state.marketWorkflow.selectedCountryCode;
  const selectedCityName = state.marketWorkflow.selectedCityName;
  const selectedMarket = (state.data.markets || []).find((market) => getMarketView(market).countryCode === selectedCountryCode) || null;
  if (!selectedMarket) return { error: 'Select a persisted Country before adding Areas.' };
  if (!selectedCityName) return { error: 'Select a City before adding Areas.' };
  if (!areaName) return { error: 'Area name is required.' };
  const duplicate = getMarketAreas(selectedMarket, selectedCityName).some((area) =>
    marketAreaKey(area.name) === marketAreaKey(areaName) &&
    (mode !== 'edit' || marketAreaKey(area.name) !== marketAreaKey(currentAreaName))
  );
  if (duplicate) return { error: 'An area with this name already exists in this city.' };
  return { areaName, countryCode: selectedCountryCode, cityName: selectedCityName, selectedMarket };
}

async function saveMarketArea(event, mode = 'create', countryCode = '', cityName = '', currentAreaName = '') {
  event.preventDefault();
  if (!canMutate('markets.update')) {
    alert('You do not have permission to update markets.');
    return;
  }
  const form = new FormData(event.currentTarget);
  const validation = validateMarketAreaForm(form, mode, currentAreaName);
  if (validation.error) {
    state.marketWorkflow.error = validation.error;
    state.marketWorkflow.message = '';
    render();
    return;
  }

  try {
    const encodedCity = encodeURIComponent(validation.cityName);
    const encodedArea = encodeURIComponent(currentAreaName);
    await api(mode === 'edit'
      ? `/admin/markets/${validation.countryCode}/cities/${encodedCity}/areas/${encodedArea}`
      : `/admin/markets/${validation.countryCode}/cities/${encodedCity}/areas`, {
      method: mode === 'edit' ? 'PATCH' : 'POST',
      body: JSON.stringify({ areaName: validation.areaName }),
    });
    await loadAllData();
    state.activeView = 'settings';
    state.marketWorkflow.selectedCountryCode = validation.countryCode;
    state.marketWorkflow.selectedCityName = validation.cityName;
    state.marketWorkflow.selectedAreaName = validation.areaName;
    state.marketWorkflow.showCreateArea = false;
    state.marketWorkflow.editingAreaName = '';
    state.marketWorkflow.deleteAreaName = '';
    state.marketWorkflow.actionMenuAreaName = '';
    state.marketWorkflow.message = `${validation.areaName} was saved.`;
    state.marketWorkflow.error = '';
    render();
  } catch (error) {
    state.marketWorkflow.message = '';
    state.marketWorkflow.error = error.message || 'Unable to save area.';
    render();
  }
}

async function deleteMarketArea(countryCode, cityName, areaName) {
  if (!canMutate('markets.update')) {
    alert('You do not have permission to update markets.');
    return;
  }
  if (!window.confirm(`Delete ${areaName}? This is permanent and only allowed when the area is unused.`)) return;
  try {
    await api(`/admin/markets/${countryCode}/cities/${encodeURIComponent(cityName)}/areas/${encodeURIComponent(areaName)}`, { method: 'DELETE' });
    await loadAllData();
    state.marketWorkflow.selectedCountryCode = countryCode;
    state.marketWorkflow.selectedCityName = cityName;
    state.marketWorkflow.selectedAreaName = marketAreaKey(state.marketWorkflow.selectedAreaName) === marketAreaKey(areaName) ? '' : state.marketWorkflow.selectedAreaName;
    state.marketWorkflow.deleteAreaName = '';
    state.marketWorkflow.actionMenuAreaName = '';
    state.marketWorkflow.message = `${areaName} was deleted.`;
    state.marketWorkflow.error = '';
    render();
  } catch (error) {
    state.marketWorkflow.message = '';
    state.marketWorkflow.error = error.message || 'Unable to delete area.';
    render();
  }
}

function syncMarketCountrySelection(input) {
  const form = input.closest('form');
  if (!form) return;
  const country = findCountryMetadata(input.value);
  const codeInput = form.querySelector('[data-country-code]');
  const currencyInput = form.querySelector('[data-country-currency]');
  const timezoneSelect = form.querySelector('[data-country-timezone]');

  if (!country) {
    if (codeInput) codeInput.value = '';
    if (currencyInput) currencyInput.value = '';
    if (timezoneSelect) {
      timezoneSelect.innerHTML = '';
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Select a country first';
      timezoneSelect.appendChild(option);
    }
    return;
  }

  input.value = country.name;
  if (codeInput) codeInput.value = country.code;
  if (currencyInput) currencyInput.value = country.currency;
  if (timezoneSelect) {
    timezoneSelect.innerHTML = '';
    country.timezones.forEach((timezone, index) => {
      const option = document.createElement('option');
      option.value = timezone;
      option.textContent = timezone;
      option.selected = index === 0;
      timezoneSelect.appendChild(option);
    });
  }
}

function validateMarketCountryForm(form, mode, currentCountryCode) {
  const countryName = String(form.get('countryName') || '').trim();
  const countryCode = normalizeMarketCountryCode(mode === 'edit' ? currentCountryCode : form.get('countryCode'));
  const currency = normalizeMarketCurrency(form.get('currency'));
  const country = mode === 'edit'
    ? findCountryMetadata(currentCountryCode) || findCountryMetadata(countryName)
    : findCountryMetadata(countryName);
  const timezone = canonicalTimezoneForCountry(form.get('timezone'), countryCode);
  const existingMarkets = (state.data.markets || []).map(getMarketView);

  if (!country) return { error: 'Select a supported country from the list.' };
  if (!countryName) return { error: 'Country name is required.' };
  if (!/^[A-Z]{2}$/.test(countryCode)) return { error: 'Country code must be a two-letter uppercase code.' };
  if (!/^[A-Z]{3}$/.test(currency)) return { error: 'Currency must be a three-letter uppercase code.' };
  if (!isValidIanaTimezone(timezone)) return { error: 'Select a valid timezone from the available options.' };
  if (!timezoneOptionsForCountry(country, timezone).options.includes(timezone)) {
    return { error: 'Select a valid timezone from the available options.' };
  }
  if (mode !== 'edit' && country.code !== countryCode) return { error: 'Select a supported country from the list.' };

  const duplicateName = existingMarkets.some((market) =>
    market.countryCode !== currentCountryCode &&
    String(market.countryName || '').trim().toLowerCase() === countryName.toLowerCase()
  );
  if (duplicateName) return { error: 'A country with this name already exists.' };

  const duplicateCode = existingMarkets.some((market) => market.countryCode !== currentCountryCode && market.countryCode === countryCode);
  if (duplicateCode) return { error: 'A country with this country code already exists.' };

  return { countryName: mode === 'edit' ? countryName : country.name, countryCode, currency, timezone };
}

async function saveMarketCountry(event, mode = 'create', currentCountryCode = '') {
  event.preventDefault();
  if (!canMutate('markets.update')) {
    alert('You do not have permission to update markets.');
    return;
  }

  const form = new FormData(event.currentTarget);
  const validation = validateMarketCountryForm(form, mode, normalizeMarketCountryCode(currentCountryCode));
  if (validation.error) {
    state.marketWorkflow.error = validation.error;
    state.marketWorkflow.message = '';
    render();
    return;
  }

  const existingMarket = (state.data.markets || []).find((market) => getMarketView(market).countryCode === validation.countryCode) || null;
  try {
    await api(`/admin/markets/${validation.countryCode}`, {
      method: 'PATCH',
      body: JSON.stringify({
        identity: {
          countryName: validation.countryName,
          currency: validation.currency,
          timezone: validation.timezone,
          locale: marketLocaleForCountry(validation.countryCode, existingMarket),
          status: mode === 'edit' ? getMarketView(existingMarket || {}).status || 'DRAFT' : 'DRAFT',
        },
      }),
    });
    await loadAllData();
    state.activeView = 'settings';
    state.marketWorkflow.selectedCountryCode = validation.countryCode;
    state.marketWorkflow.showCreateCountry = false;
    state.marketWorkflow.editingCountryCode = '';
    state.marketWorkflow.deleteCountryCode = '';
    state.marketWorkflow.actionMenuCountryCode = '';
    state.marketWorkflow.message = `${validation.countryName} was saved.`;
    state.marketWorkflow.error = '';
    render();
  } catch (error) {
    state.marketWorkflow.message = '';
    state.marketWorkflow.error = error.message || 'Unable to save country.';
    render();
  }
}

async function deleteMarketCountry(countryCode) {
  if (!canMutate('markets.update')) {
    alert('You do not have permission to update markets.');
    return;
  }
  const market = (state.data.markets || []).find((item) => getMarketView(item).countryCode === countryCode);
  const marketView = getMarketView(market || {});
  if (!window.confirm(`Delete ${marketView.countryName || countryCode}? This is permanent and only allowed for an unused draft country.`)) return;

  try {
    await api(`/admin/markets/${countryCode}`, { method: 'DELETE' });
    await loadAllData();
    state.marketWorkflow.selectedCountryCode = state.marketWorkflow.selectedCountryCode === countryCode ? '' : state.marketWorkflow.selectedCountryCode;
    state.marketWorkflow.deleteCountryCode = '';
    state.marketWorkflow.actionMenuCountryCode = '';
    state.marketWorkflow.message = `${marketView.countryName || countryCode} was deleted.`;
    state.marketWorkflow.error = '';
    render();
  } catch (error) {
    state.marketWorkflow.message = '';
    state.marketWorkflow.error = error.message || 'Unable to delete country.';
    render();
  }
}

function renderAuditLogs() {
  return `
    <section class="panel">
      <div class="panel-header"><h2>Audit Logs</h2><span>${state.data.auditLogs.length} latest</span></div>
      ${renderGenericTable(state.data.auditLogs, ['Action', 'Actor', 'Resource', 'Metadata', 'Created'], (log) => {
        const action = log.event?.action || log.action || '-';
        const actorEmail = log.actor?.email || log.actorEmail || '-';
        const resourceType = log.event?.resourceType || log.resourceType || '-';
        const resourceId = log.event?.resourceId || log.resourceId || '-';
        return [
          escapeHtml(action),
          escapeHtml(actorEmail),
          `${escapeHtml(resourceType)}<span>${escapeHtml(resourceId)}</span>`,
          `<code>${escapeHtml(JSON.stringify(log.metadata || {}))}</code>`,
          formatDate(log.createdAt),
        ];
      })}
    </section>
  `;
}

function renderGenericTable(rows, headers, mapRow) {
  if (!rows.length) return renderEmpty('No records found.');
  return `
    <div class="table-wrap">
      <table>
        <thead><tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows.map((row) => `<tr>${mapRow(row).map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderEmpty(message, title = 'No data', helper = '') {
  return `<p class="empty"><span>${escapeHtml(title)}</span>${escapeHtml(message)}${helper ? `<small>${escapeHtml(helper)}</small>` : ''}</p>`;
}

function mediaById(media = []) {
  return new Map(media.map((item) => [String(item._id || item.id), item]));
}

function renderMediaGallery(media = []) {
  if (!media.length) return renderEmpty('No images have been uploaded for this booking yet.');
  return `
    <div class="media-gallery">
      ${media.map((item) => `
        <a class="media-tile" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">
          <img src="${escapeHtml(item.thumbnailUrl || item.url)}" alt="${escapeHtml(item.purpose || 'Job image')}" />
          <span class="status ${statusClass(item.purpose)}">${escapeHtml(item.purpose || 'IMAGE')}</span>
          <small>${escapeHtml(item.uploadedByRole || 'UNKNOWN')} - ${formatDate(item.createdAt)}</small>
        </a>
      `).join('')}
    </div>
  `;
}

function renderChatLog(messages = [], media = []) {
  if (!messages.length) return renderEmpty('No chat messages have been saved for this booking yet.');
  const lookup = mediaById(media);

  return `
    <div class="chat-log">
      ${messages.map((message) => {
        const attachedMedia = (message.mediaIds || [])
          .map((id) => lookup.get(String(id)))
          .filter(Boolean);
        return `
          <article class="chat-row ${message.senderRole === 'CUSTOMER' ? 'customer' : 'provider'}">
            <div class="chat-row-header">
              <strong>${escapeHtml(message.senderRole || 'UNKNOWN')}</strong>
              <span>${formatDate(message.createdAt)}</span>
            </div>
            ${message.text ? `<p>${escapeHtml(message.text)}</p>` : ''}
            ${attachedMedia.length ? renderMediaGallery(attachedMedia) : ''}
          </article>
        `;
      }).join('')}
    </div>
  `;
}

function renderBookingDrawer() {
  const data = state.selectedBooking;
  const booking = data.booking;
  const countryCode = booking.identity?.countryCode || booking.countryCode || '-';
  const currency = booking.identity?.currency || booking.currency || 'ZAR';
  const media = data.media || [];
  const messages = data.messages || [];
  const participants = data.participants || {};
  const technician = participants.technician || {};
  const customer = participants.customer || {};
  const proofMedia = media.filter((item) => String(item.purpose || '').includes('PROOF') || String(item.purpose || '').includes('AFTER'));
  return `
    <aside class="drawer">
      <div class="drawer-header">
        <div>
          <span class="eyebrow">Booking detail</span>
          <h2>${escapeHtml(booking.applianceType)}</h2>
        </div>
        <button class="ghost-button compact" onclick="state.selectedBooking=null; render()">Close</button>
      </div>
      <div class="drawer-body">
        <div class="detail-grid">
          <div><span>Status</span><strong>${escapeHtml(booking.status)}</strong></div>
          <div><span>Customer</span><strong>${escapeHtml(booking.customerName)}</strong></div>
          <div><span>Market</span><strong>${escapeHtml(countryCode)} - ${escapeHtml(currency)}</strong></div>
          <div><span>Callout</span><strong>${getMoney(booking, 'price', 'priceMinor', currency)}</strong></div>
        </div>
        <h3>Address</h3>
        <p>${escapeHtml(booking.fullAddress || '-')} ${escapeHtml(booking.complexDetails || '')}</p>
        <h3>Fault</h3>
        <p>${escapeHtml(booking.faultDescription || '-')}</p>
        <h3>People Involved</h3>
        <div class="participant-grid">
          <article class="participant-card">
            <div class="participant-avatar">${customer.profilePhotoUrl ? `<img src="${escapeHtml(customer.profilePhotoUrl)}" alt="Customer" />` : 'C'}</div>
            <div>
              <strong>${escapeHtml(customer.name || booking.customerName || 'Customer')}</strong>
              <p>${escapeHtml(customer.email || '')}</p>
              <p>${escapeHtml(customer.phone || '')}</p>
            </div>
          </article>
          <article class="participant-card">
            <div class="participant-avatar">${technician.profilePhotoUrl ? `<img src="${escapeHtml(technician.profilePhotoUrl)}" alt="Technician" />` : 'T'}</div>
            <div>
              <strong>${escapeHtml(technician.name || 'Assigned technician')}</strong>
              <p>${escapeHtml(technician.email || '')}</p>
              <p>${escapeHtml(technician.phone || '')}</p>
              <span class="status ${technician.photoStatus === 'VERIFIED' ? 'success' : 'info'}">Photo ${escapeHtml(technician.photoStatus || 'NOT_SUBMITTED')}</span>
            </div>
          </article>
        </div>
        <h3>Uploaded Images</h3>
        ${renderMediaGallery(media)}
        <h3>Completion Proof</h3>
        ${renderMediaGallery(proofMedia)}
        <h3>Chat History</h3>
        ${renderChatLog(messages, media)}
        <h3>Quotes</h3>
        ${renderGenericTable(data.quotes || [], ['Status', 'Total', 'Items'], (quote) => [
          `<span class="status ${statusClass(quote.status)}">${escapeHtml(quote.status)}</span>`,
          getMoney(quote, 'totalAmount', 'totalAmountMinor', quote.currency),
          quote.lineItems?.length || 0,
        ])}
        <h3>Ledger</h3>
        ${renderGenericTable(data.ledger || [], ['Type', 'Amount', 'Status'], (row) => [
          escapeHtml(row.type),
          getMoney(row, 'amount', 'amountMinor', row.currency),
          `<span class="status ${statusClass(row.status)}">${escapeHtml(row.status)}</span>`,
        ])}
      </div>
    </aside>
  `;
}

function render() {
  if (!state.token) {
    renderLogin();
    return;
  }
  renderShell();
  if (state.activeView === 'promotions') {
    document.querySelectorAll('form[data-promotion-form]').forEach(updatePromotionFormVisibility);
  }
}

window.login = login;
window.forgotPassword = forgotPassword;
window.resetPassword = resetPassword;
window.changePassword = changePassword;
window.setAuthView = setAuthView;
window.logout = logout;
window.refresh = refresh;
window.setView = setView;
window.revealClientContact = revealClientContact;
window.hideClientContact = hideClientContact;
window.reviewTechnician = reviewTechnician;
window.openBooking = openBooking;
window.updateManagedCollectionReminder = updateManagedCollectionReminder;
window.rescheduleManagedCollectionReminder = rescheduleManagedCollectionReminder;
window.updateCollectionJob = updateCollectionJob;
window.markCollectionCompleted = markCollectionCompleted;
window.markCollectionMissed = markCollectionMissed;
window.rescheduleCollectionJob = rescheduleCollectionJob;
window.cancelCollectionJob = cancelCollectionJob;
window.applyCollectionOperationFilters = applyCollectionOperationFilters;
window.resetCollectionOperationFilters = resetCollectionOperationFilters;
window.applyNotificationFilters = applyNotificationFilters;
window.resetNotificationFilters = resetNotificationFilters;
window.processDueNotifications = processDueNotifications;
window.retryNotification = retryNotification;
window.cancelNotification = cancelNotification;
window.sendClientNotification = sendClientNotification;
window.createSubscriptionPlan = createSubscriptionPlan;
window.generateSubscriptionInvoices = generateSubscriptionInvoices;
window.createPromotion = createPromotion;
window.updatePromotion = updatePromotion;
window.updatePromotionFormVisibility = updatePromotionFormVisibility;
window.setPromotionWorkspaceTab = setPromotionWorkspaceTab;
window.setPromotionStatusTab = setPromotionStatusTab;
window.setPromotionFilter = setPromotionFilter;
window.clearPromotionFilters = clearPromotionFilters;
window.setPromotionDraftField = setPromotionDraftField;
window.startCreatePromotion = startCreatePromotion;
window.setPromotionWizardStep = setPromotionWizardStep;
window.savePromotionDraft = savePromotionDraft;
window.duplicatePromotion = duplicatePromotion;
window.runPromotionLifecycle = runPromotionLifecycle;
window.openPromotionDetails = openPromotionDetails;
window.createAdminUser = createAdminUser;
window.updateAdminUser = updateAdminUser;
window.showTopLevelServiceGroupForm = showTopLevelServiceGroupForm;
window.cancelTopLevelServiceGroup = cancelTopLevelServiceGroup;
window.createTopLevelServiceGroup = createTopLevelServiceGroup;
window.selectTopLevelServiceGroup = selectTopLevelServiceGroup;
window.handleServiceGroupCardKey = handleServiceGroupCardKey;
window.toggleServiceGroupActions = toggleServiceGroupActions;
window.startRenameTopLevelServiceGroup = startRenameTopLevelServiceGroup;
window.startDeleteTopLevelServiceGroup = startDeleteTopLevelServiceGroup;
window.showServiceGroupDeleteUnavailable = showServiceGroupDeleteUnavailable;
window.cancelServiceGroupManagement = cancelServiceGroupManagement;
window.renameTopLevelServiceGroup = renameTopLevelServiceGroup;
window.deleteTopLevelServiceGroup = deleteTopLevelServiceGroup;
window.showCreateServiceCategoryForm = showCreateServiceCategoryForm;
window.cancelServiceCategoryManagement = cancelServiceCategoryManagement;
window.selectServiceCategory = selectServiceCategory;
window.handleServiceCategoryCardKey = handleServiceCategoryCardKey;
window.toggleServiceCategoryActions = toggleServiceCategoryActions;
window.startRenameServiceCategory = startRenameServiceCategory;
window.startDeleteServiceCategory = startDeleteServiceCategory;
window.showServiceCategoryPersistenceUnavailable = showServiceCategoryPersistenceUnavailable;
window.cancelServiceManagementDrawer = cancelServiceManagementDrawer;
window.handleServiceCategoryImageSelection = handleServiceCategoryImageSelection;
window.removeServiceCategoryImage = removeServiceCategoryImage;
window.createServiceCategory = createServiceCategory;
window.renameServiceCategory = renameServiceCategory;
window.deleteServiceCategory = deleteServiceCategory;
window.openBookableServiceDrawer = openBookableServiceDrawer;
window.requestCloseBookableServiceDrawer = requestCloseBookableServiceDrawer;
window.closeBookableServiceDrawer = closeBookableServiceDrawer;
window.handleBookableServiceCardKey = handleBookableServiceCardKey;
window.saveBookableService = saveBookableService;
window.deleteBookableService = deleteBookableService;
window.showCreateMarketCountryForm = showCreateMarketCountryForm;
window.cancelMarketManagementDrawer = cancelMarketManagementDrawer;
window.cancelMarketCountryForm = cancelMarketCountryForm;
window.selectMarketCountry = selectMarketCountry;
window.handleMarketCountryCardKey = handleMarketCountryCardKey;
window.toggleMarketCountryActions = toggleMarketCountryActions;
window.startEditMarketCountry = startEditMarketCountry;
window.startDeleteMarketCountry = startDeleteMarketCountry;
window.showCreateMarketCityForm = showCreateMarketCityForm;
window.cancelMarketCityForm = cancelMarketCityForm;
window.selectMarketCity = selectMarketCity;
window.handleMarketCityCardKey = handleMarketCityCardKey;
window.toggleMarketCityActions = toggleMarketCityActions;
window.startEditMarketCity = startEditMarketCity;
window.startDeleteMarketCity = startDeleteMarketCity;
window.saveMarketCity = saveMarketCity;
window.deleteMarketCity = deleteMarketCity;
window.showCreateMarketAreaForm = showCreateMarketAreaForm;
window.cancelMarketAreaForm = cancelMarketAreaForm;
window.selectMarketArea = selectMarketArea;
window.handleMarketAreaCardKey = handleMarketAreaCardKey;
window.toggleMarketAreaActions = toggleMarketAreaActions;
window.startEditMarketArea = startEditMarketArea;
window.startDeleteMarketArea = startDeleteMarketArea;
window.saveMarketArea = saveMarketArea;
window.deleteMarketArea = deleteMarketArea;
window.syncMarketCountrySelection = syncMarketCountrySelection;
window.saveMarketCountry = saveMarketCountry;
window.deleteMarketCountry = deleteMarketCountry;
window.state = state;
window.render = render;

setupIdleSecurity();

if (state.token && state.user?.mustChangePassword) {
  state.authView = 'changePassword';
  render();
} else if (state.token) {
  loadAllData().catch(() => {
    state.token = '';
    localStorage.removeItem('myfixer_admin_token');
  }).finally(() => {
    resetIdleTimer();
    render();
  });
} else {
  render();
}

