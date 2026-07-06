let API_BASE_URL = window.MYFIXER_ADMIN_CONFIG?.API_BASE_URL || '';

const state = {
  token: localStorage.getItem('myfixer_admin_token') || '',
  user: JSON.parse(localStorage.getItem('myfixer_admin_user') || 'null'),
  activeView: 'overview',
  authView: new URLSearchParams(window.location.search).has('resetToken') ? 'reset' : 'login',
  authMessage: '',
  loading: false,
  error: '',
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
    markets: [],
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
  { id: 'technicians', label: 'Technicians', icon: 'T', permission: 'technicians.read' },
  { id: 'bookings', label: 'Bookings', icon: 'B', permission: 'bookings.read' },
  { id: 'managedCollections', label: 'Managed Collection', icon: 'M', permission: 'bookings.read' },
  { id: 'collectionOperations', label: 'Collection Operations', icon: 'C', permission: 'bookings.read' },
  { id: 'notifications', label: 'Notifications', icon: 'N', permission: 'bookings.read' },
  { id: 'subscriptions', label: 'Subscriptions', icon: 'R', permission: 'finance.read' },
  { id: 'quotes', label: 'Quotes', icon: 'Q', permission: 'bookings.read' },
  { id: 'invoices', label: 'Invoices', icon: '$', permission: 'finance.read' },
  { id: 'ledger', label: 'Wallet Ledger', icon: 'L', permission: 'finance.read' },
  { id: 'adminUsers', label: 'Admin Users', icon: 'A', permission: 'admins.read' },
  { id: 'settings', label: 'Settings', icon: 'S', permission: 'markets.read' },
  { id: 'auditLogs', label: 'Audit Logs', icon: 'H', permission: 'admins.read' },
];

const app = document.getElementById('app');

const rolePermissions = {
  SUPER_ADMIN: ['*'],
  OPERATIONS_MANAGER: ['overview.read', 'bookings.read', 'bookings.update', 'technicians.read', 'settings.read'],
  DISPATCHER: ['overview.read', 'bookings.read', 'bookings.update'],
  FINANCE_ADMIN: ['overview.read', 'finance.read', 'settings.read'],
  SUPPORT_AGENT: ['overview.read', 'bookings.read', 'technicians.read'],
  TECHNICIAN_REVIEWER: ['overview.read', 'technicians.read', 'technicians.review'],
  MARKET_MANAGER: ['overview.read', 'markets.read', 'markets.update', 'settings.read'],
  READ_ONLY_ADMIN: ['overview.read', 'bookings.read', 'technicians.read', 'finance.read', 'markets.read', 'admins.read', 'settings.read'],
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
    status: market.identity?.status || market.status || (market.identity?.enabled ?? market.enabled ? 'ACTIVE' : 'DISABLED'),
    enabled: market.identity?.enabled ?? market.enabled,
    defaultCalloutFee: typeof market.pricing?.defaultCalloutFeeMinor === 'number'
      ? market.pricing.defaultCalloutFeeMinor / 100
      : typeof market.pricing?.defaultCalloutFee === 'number'
        ? market.pricing.defaultCalloutFee
      : market.defaultCalloutFee || 0,
    platformCommissionBps: market.pricing?.platformCommissionBps ?? market.platformCommissionBps ?? 0,
    taxLabel: market.pricing?.taxLabel || market.taxLabel || '',
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

function labelFromServiceKey(serviceKey) {
  return String(serviceKey || '')
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
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
    await loadAllData();
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

function logout() {
  state.token = '';
  state.user = null;
  localStorage.removeItem('myfixer_admin_token');
  localStorage.removeItem('myfixer_admin_user');
  render();
}

async function loadAllData() {
  state.loading = true;
  state.error = '';

  try {
    const requests = {
      overview: hasPermission('overview.read') ? api('/admin/overview') : Promise.resolve({ overview: null }),
      technicians: hasPermission('technicians.read') ? api('/admin/technicians') : Promise.resolve({ technicians: [] }),
      bookings: hasPermission('bookings.read') ? api('/admin/bookings?limit=100') : Promise.resolve({ bookings: [] }),
      managedCollections: hasPermission('bookings.read') ? api('/admin/managed-collections') : Promise.resolve({ profiles: [], reminders: [] }),
      collectionOperations: hasPermission('bookings.read') ? api(`/admin/collection-operations${queryStringFrom(state.collectionOperationFilters)}`) : Promise.resolve({ jobs: [], metrics: {}, calendar: {}, meta: {} }),
      notifications: hasPermission('bookings.read') ? api(`/admin/notifications${queryStringFrom(state.notificationFilters)}`) : Promise.resolve({ notifications: [], counts: [], meta: {} }),
      subscriptions: hasPermission('finance.read') ? api('/admin/managed-collection-subscriptions') : Promise.resolve({ plans: [], subscriptions: [], invoices: [], reports: {}, meta: {} }),
      quotes: hasPermission('bookings.read') ? api('/admin/quotes?limit=100') : Promise.resolve({ quotes: [] }),
      invoices: hasPermission('finance.read') ? api('/admin/invoices?limit=100') : Promise.resolve({ invoices: [] }),
      ledger: hasPermission('finance.read') ? api('/admin/wallet-transactions?limit=100') : Promise.resolve({ transactions: [] }),
      markets: hasPermission('markets.read') ? api('/admin/markets') : Promise.resolve({ markets: [], availableStatuses: [], availablePaymentProviders: [], defaultServiceCategories: [], availableMarkets: [] }),
      adminUsers: hasPermission('admins.read') ? api('/admin/users') : Promise.resolve({ admins: [], roles: [], permissionsByRole: {} }),
      auditLogs: hasPermission('admins.read') ? api('/admin/audit-logs?limit=100') : Promise.resolve({ logs: [] }),
    };

    const [overview, technicians, bookings, managedCollections, collectionOperations, notifications, subscriptions, quotes, invoices, ledger, markets, adminUsers, auditLogs] = await Promise.all(Object.values(requests));

    state.data.overview = overview.overview;
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
    state.data.ledger = ledger.transactions || [];
    state.data.markets = markets.markets || [];
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

async function openBooking(id) {
  try {
    const result = await api(`/admin/bookings/${id}`);
    state.selectedBooking = result;
    render();
  } catch (error) {
    alert(error.message);
  }
}

async function saveMarket(event, countryCode) {
  event.preventDefault();
  if (!canMutate('markets.update')) {
    alert('You do not have permission to update market settings.');
    return;
  }
  const formElement = event.currentTarget;
  const form = new FormData(formElement);
  const formCountryCode = String(form.get('countryCode') || '').trim();
  const customCountryCode = String(form.get('customCountryCode') || '').trim().toUpperCase();
  const selectedCountryCode = countryCode || customCountryCode || (formCountryCode === '__CUSTOM__' ? '' : formCountryCode);
  if (!selectedCountryCode) {
    alert('Please choose a country to add.');
    return;
  }

  const paymentProviderSettings = collectPaymentProviderRows(formElement);
  const cityServiceAvailability = collectCityServiceRows(formElement);
  const paymentProviders = paymentProviderSettings.map((row) => row.provider);
  const supportedCities = cityServiceAvailability.map((row) => row.city);
  const serviceCategoryMap = new Map();
  cityServiceAvailability
    .flatMap((row) => row.services || [])
    .forEach((service) => {
      const normalized = normalizeServiceEntry(service);
      if (normalized) serviceCategoryMap.set(normalized.serviceKey, normalized);
    });
  const serviceCategories = Array.from(serviceCategoryMap.values());
  const taxLabel = form.get('taxLabel');
  const supportWhatsapp = form.get('supportWhatsapp');
  const supportEscalationEmail = form.get('supportEscalationEmail');

  const payload = {
    countryName: String(form.get('countryName') || '').trim(),
    status: String(form.get('status') || 'DISABLED'),
    currency: String(form.get('currency') || ''),
    defaultCalloutFee: Number(form.get('defaultCalloutFee') || 0),
    platformCommissionBps: Math.round(Number(form.get('commissionPercent') || 0) * 100),
    taxLabel: taxLabel === null ? undefined : String(taxLabel).trim(),
    supportedCities,
    serviceCategories,
    cityServiceAvailability,
    paymentProviders,
    paymentProviderSettings,
    supportEmail: String(form.get('supportEmail') || ''),
    supportPhone: String(form.get('supportPhone') || ''),
    supportWhatsapp: supportWhatsapp === null ? undefined : String(supportWhatsapp),
    supportEscalationEmail: supportEscalationEmail === null ? undefined : String(supportEscalationEmail),
    identity: {
      countryName: String(form.get('countryName') || '').trim(),
      status: String(form.get('status') || 'DISABLED'),
      currency: String(form.get('currency') || ''),
    },
    pricing: {
      defaultCalloutFeeMinor: Math.round(Number(form.get('defaultCalloutFee') || 0) * 100),
      platformCommissionBps: Math.round(Number(form.get('commissionPercent') || 0) * 100),
      taxLabel: taxLabel === null ? undefined : String(taxLabel).trim(),
    },
    coverage: {
      supportedCities,
      serviceCategories,
      cityServiceAvailability,
    },
    payments: {
      paymentProviders,
      providerSettings: paymentProviderSettings,
    },
    support: {
      email: String(form.get('supportEmail') || ''),
      phone: String(form.get('supportPhone') || ''),
      whatsapp: supportWhatsapp === null ? undefined : String(supportWhatsapp),
      escalationEmail: supportEscalationEmail === null ? undefined : String(supportEscalationEmail),
    },
  };

  try {
    await api(`/admin/markets/${selectedCountryCode}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    event.currentTarget.reset();
    await refresh();
  } catch (error) {
    alert(error.message);
  }
}

function collectCityServiceRows(form) {
  return Array.from(form.querySelectorAll('[data-city-service-row]'))
    .map((row) => {
      const services = Array.from(row.querySelectorAll('[data-service-entry-row]'))
        .map((serviceRow) => ({
          serviceKey: serviceKeyFrom(serviceRow.querySelector('[data-service-key]')?.value || ''),
          label: serviceRow.querySelector('[data-service-label]')?.value.trim() || '',
          status: serviceRow.querySelector('[data-service-status]')?.value || 'ACTIVE',
        }))
        .filter((service) => service.serviceKey)
        .map((service) => ({
          ...service,
          label: service.label || labelFromServiceKey(service.serviceKey),
        }));
      const legacyServices = String(row.querySelector('[data-city-services]')?.value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .map(normalizeServiceEntry)
        .filter(Boolean);
      const areas = Array.from(row.querySelectorAll('[data-area-entry-row]'))
        .map((areaRow) => ({
          name: areaRow.querySelector('[data-area-name]')?.value.trim() || '',
          status: areaRow.querySelector('[data-area-status]')?.value || 'ACTIVE',
          services: String(areaRow.querySelector('[data-area-services]')?.value || '')
            .split(',')
            .map((item) => {
              const [rawKey, rawStatus] = item.split(':').map((part) => part.trim());
              const serviceKey = serviceKeyFrom(rawKey);
              return serviceKey
                ? { serviceKey, label: labelFromServiceKey(serviceKey), status: rawStatus || 'ACTIVE' }
                : null;
            })
            .filter(Boolean),
        }))
        .filter((area) => area.name);
      return {
        city: row.querySelector('[data-city]')?.value.trim() || '',
        status: row.querySelector('[data-city-status]')?.value || 'ACTIVE',
        services: services.length ? services : legacyServices,
        areas,
      };
    })
    .filter((row) => row.city);
}

function collectPaymentProviderRows(form) {
  return Array.from(form.querySelectorAll('[data-provider-row]'))
    .map((row, index) => ({
      provider: row.querySelector('[data-provider]')?.value.trim().toUpperCase() || '',
      status: row.querySelector('[data-provider-status]')?.value || 'DISABLED',
      methods: String(row.querySelector('[data-provider-methods]')?.value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      priority: Number(row.querySelector('[data-provider-priority]')?.value || index + 1),
      payoutEnabled: Boolean(row.querySelector('[data-provider-payout]')?.checked),
      configReference: row.querySelector('[data-provider-config]')?.value.trim() || '',
    }))
    .filter((row) => row.provider);
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
    password: String(form.get('password') || ''),
    adminRole: String(form.get('adminRole') || 'READ_ONLY_ADMIN'),
    countryCode: String(form.get('countryCode') || 'ZA'),
    location: { city: String(form.get('city') || 'Head Office') },
  };

  try {
    await api('/admin/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
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
  const authForm = state.authView === 'forgot'
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
            <span class="brand-mark">MF</span>
            <div>
              <h1>MyFixer Backoffice</h1>
              <p>Internal control for markets, staff, dispatch, payouts, and provider trust.</p>
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

function renderShell() {
  const navViews = visibleViews();
  const activeView = navViews.find((view) => view.id === state.activeView) || navViews[0];
  if (activeView && activeView.id !== state.activeView) state.activeView = activeView.id;

  app.innerHTML = `
    <div class="admin-shell">
      <aside class="sidebar">
        <div class="sidebar-brand">
          <span class="brand-mark small">MF</span>
          <div>
            <strong>MyFixer</strong>
            <span>Backoffice</span>
          </div>
        </div>
        <div class="sidebar-user">
          <strong>${escapeHtml(state.user?.adminRole || 'ADMIN')}</strong>
          <span>${escapeHtml(state.user?.email || '')}</span>
        </div>
        <nav>
          ${navViews.map((view) => `
            <button class="nav-item ${state.activeView === view.id ? 'active' : ''}" onclick="setView('${view.id}')">
              <span>${view.icon}</span>${view.label}
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
            <span class="status good">Live API</span>
            <button class="ghost-button" data-refresh onclick="refresh()" ${state.loading ? 'disabled' : ''}>${state.loading ? 'Refreshing...' : 'Refresh'}</button>
            <button class="danger-button" onclick="logout()">Sign Out</button>
          </div>
        </header>
        <section class="content" aria-busy="${state.loading ? 'true' : 'false'}">
          ${state.loading ? '<div class="notice">Loading live operations data...</div>' : ''}
          ${state.error ? `<div class="notice error">${escapeHtml(state.error)}</div>` : ''}
          ${renderActiveView()}
        </section>
      </main>
      ${state.selectedBooking ? renderBookingDrawer() : ''}
    </div>
  `;
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
  if (state.activeView === 'technicians') return renderTechnicians();
  if (state.activeView === 'bookings') return renderBookings();
  if (state.activeView === 'managedCollections') return renderManagedCollections();
  if (state.activeView === 'collectionOperations') return renderCollectionOperations();
  if (state.activeView === 'notifications') return renderNotifications();
  if (state.activeView === 'subscriptions') return renderSubscriptions();
  if (state.activeView === 'quotes') return renderQuotes();
  if (state.activeView === 'invoices') return renderInvoices();
  if (state.activeView === 'ledger') return renderLedger();
  if (state.activeView === 'adminUsers') return renderAdminUsers();
  if (state.activeView === 'settings') return renderSettings();
  if (state.activeView === 'auditLogs') return renderAuditLogs();
  return '';
}

function renderOverview() {
  const overview = state.data.overview || {};
  const cards = [
    ['Active bookings', overview.activeBookings || 0],
    ['Pending providers', overview.pendingTechnicians || 0],
    ['Pending quotes', overview.pendingQuotes || 0],
    ['Unpaid invoices', overview.unpaidInvoices || 0],
    ['Clients', overview.clients || 0],
    ['Completed jobs', overview.completedBookings || 0],
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
    <div class="two-column">
      <section class="panel">
        <div class="panel-header"><h2>Revenue Snapshot</h2></div>
        ${renderCurrencyTotals(overview.totalsByCurrency || {})}
      </section>
      <section class="panel">
        <div class="panel-header"><h2>Recent Bookings</h2></div>
        ${renderBookingTable(state.data.bookings.slice(0, 6))}
      </section>
    </div>
  `;
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
          return `
            <article class="review-card">
              <div>
                <div class="row-title">${escapeHtml(user.name || 'Provider')} <span class="status ${statusClass(tech.approvalStatus)}">${escapeHtml(tech.approvalStatus)}</span></div>
                <p>${escapeHtml(user.email || '-')} - ${escapeHtml(user.phone || '-')} - ${escapeHtml(tech.city)}, ${escapeHtml(tech.countryCode)}</p>
                <p>${escapeHtml((tech.serviceCategories || []).join(', '))} - ${tech.yearsExperience || 0} yrs - ${tech.serviceRadiusKm || 0}km radius</p>
                <p>${escapeHtml(tech.businessName || 'Independent provider')} - ${escapeHtml(tech.vehicleType || 'Transport not set')}</p>
              </div>
              ${canReview ? `
                <div class="review-actions">
                  <button class="success-button" onclick="reviewTechnician('${tech._id}', 'APPROVED')">Approve</button>
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
            <input name="countryCode" value="${escapeHtml(filters.countryCode || '')}" placeholder="ZA, ZM, GH" />
          </div>
          <div>
            <label>City</label>
            <input name="city" value="${escapeHtml(filters.city || '')}" placeholder="Lusaka" />
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

function renderNotifications() {
  const rows = state.data.notifications || [];
  const meta = state.data.notificationMeta || {};
  const filters = state.notificationFilters || {};
  const counts = Object.fromEntries((state.data.notificationCounts || []).map((item) => [item._id, item.count]));
  const canUpdate = canMutate('bookings.update');
  const metricCards = ['PENDING', 'SCHEDULED', 'SENT', 'FAILED', 'CANCELLED', 'READ'].map((status) => [status, counts[status] || 0]);

  return `
    <section class="panel">
      <div class="panel-header">
        <div><h2>Notification Center</h2><span>In-App and Email are enabled. Push, SMS, and WhatsApp are foundation-only.</span></div>
        ${canUpdate ? '<button class="primary-button compact" onclick="processDueNotifications()">Process Due</button>' : ''}
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
            <div><label>Country</label><input name="countryCode" required placeholder="ZM" /></div>
            <div><label>Currency</label><input name="currency" required placeholder="ZMW" /></div>
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
          <span>${state.data.adminUsers.length} admins</span>
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
              <button class="ghost-button compact" onclick="updateAdminUser('${admin._id}', { isActive: ${admin.isActive === false ? 'true' : 'false'} })">${admin.isActive === false ? 'Activate' : 'Deactivate'}</button>
            `
            : '<span class="status info">Read only</span>',
        ])}
      </section>

      ${canCreateAdmins ? `<section class="panel">
        <div class="panel-header"><h2>Create Admin</h2><span>Super admin only</span></div>
        <form class="settings-form" onsubmit="createAdminUser(event)">
          <label>Name</label>
          <input name="name" required placeholder="Operations Manager" />
          <label>Email</label>
          <input name="email" type="email" required placeholder="ops@myfixer.com" />
          <label>Phone</label>
          <input name="phone" required placeholder="+27000000000" />
          <label>Temporary Password</label>
          <input name="password" type="password" required minlength="6" placeholder="Minimum 6 characters" />
          <div class="form-grid">
            <div>
              <label>Role</label>
              <select name="adminRole">
                ${roles.map((role) => `<option value="${role}">${role}</option>`).join('')}
              </select>
            </div>
            <div>
              <label>Country</label>
              <select name="countryCode">
                ${state.data.markets.map((market) => {
                  const marketView = getMarketView(market);
                  return `<option value="${marketView.countryCode}">${marketView.countryCode}</option>`;
                }).join('')}
              </select>
            </div>
          </div>
          <label>City</label>
          <input name="city" placeholder="Head Office" />
          <button class="primary-button" type="submit">Create Admin</button>
        </form>
      </section>` : ''}
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

function renderSettings() {
  const canUpdateMarkets = canMutate('markets.update');
  return `
    <div class="two-column settings-layout">
      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>Configured Markets</h2>
            <span>Only countries MyFixer is operating in or preparing to launch.</span>
          </div>
        </div>
        <div class="settings-list">
          ${state.data.markets.map(renderMarketForm).join('') || renderEmpty('No configured markets yet.')}
        </div>
      </section>
      ${canUpdateMarkets ? `<section class="panel">
        <div class="panel-header">
          <div>
            <h2>Add Market</h2>
            <span>Add one country when MyFixer is ready to configure it.</span>
          </div>
        </div>
        ${renderAddMarketForm()}
      </section>` : ''}
    </div>
  `;
}

function renderAddMarketForm() {
  const availableMarkets = state.data.marketMeta.availableMarkets || [];
  const statuses = state.data.marketMeta.availableStatuses.length
    ? state.data.marketMeta.availableStatuses
    : ['COMING_SOON', 'ACTIVE', 'PAUSED', 'DISABLED'];

  if (!availableMarkets.length) {
    return `
      ${renderEmpty('All preloaded launch countries have been added. Use Custom Country for a country that is not listed yet.')}
      <form class="settings-form" onsubmit="saveMarket(event, '')">
        <input name="countryCode" type="hidden" value="__CUSTOM__" />
        <label>Country Code</label>
        <input name="customCountryCode" required placeholder="CI, SN, BW" />
        <label>Country Name</label>
        <input name="countryName" required placeholder="Country name" />
        <label>Status</label>
        <select name="status">
          ${statuses.map((status) => `<option value="${status}" ${status === 'COMING_SOON' ? 'selected' : ''}>${status}</option>`).join('')}
        </select>
        <div class="form-grid">
          <div>
            <label>Currency</label>
            <input name="currency" required placeholder="USD" />
          </div>
          <div>
            <label>Callout Fee</label>
            <input name="defaultCalloutFee" type="number" min="0" step="0.01" value="0" />
          </div>
          <div>
            <label>Commission %</label>
            <input name="commissionPercent" type="number" min="0" max="100" step="0.01" value="15" />
          </div>
          <div>
            <label>Support Phone</label>
            <input name="supportPhone" />
          </div>
        </div>
        ${renderCityServiceEditor([], state.data.marketMeta.defaultServiceCategories || [])}
        ${renderProviderEditor([])}
        <div class="form-grid">
          <div>
            <label>Support Email</label>
            <input name="supportEmail" type="email" />
          </div>
          <div>
            <label>WhatsApp</label>
            <input name="supportWhatsapp" />
          </div>
          <div>
            <label>Escalation Email</label>
            <input name="supportEscalationEmail" type="email" />
          </div>
        </div>
        <button class="primary-button" type="submit">Add Market</button>
      </form>
    `;
  }

  return `
    <form class="settings-form" onsubmit="saveMarket(event, '')">
      <label>Country</label>
      <select name="countryCode" onchange="prefillMarketDefaults(this)">
        <option value="">Choose country</option>
        <option value="__CUSTOM__">Custom country not listed</option>
        ${availableMarkets.map((market) => {
          const marketView = getMarketView(market);
          return `
            <option
              value="${marketView.countryCode}"
              data-country-name="${escapeHtml(marketView.countryName)}"
              data-currency="${marketView.currency}"
              data-callout="${marketView.defaultCalloutFee}"
              data-commission="${marketView.platformCommissionBps / 100}"
              data-providers="${escapeHtml((marketView.paymentProviders || []).join(', '))}"
            >${escapeHtml(marketView.countryName)} (${escapeHtml(marketView.countryCode)})</option>
          `;
        }).join('')}
      </select>
      <div class="custom-country-fields" data-custom-country-fields hidden>
        <label>Country Code</label>
        <input name="customCountryCode" placeholder="CI, SN, BW" />
        <label>Country Name</label>
        <input name="countryName" placeholder="Country name" />
      </div>
      <label>Status</label>
      <select name="status">
        ${statuses.map((status) => `<option value="${status}" ${status === 'COMING_SOON' ? 'selected' : ''}>${status}</option>`).join('')}
      </select>
      <div class="form-grid">
        <div>
          <label>Currency</label>
          <input name="currency" />
        </div>
        <div>
          <label>Callout Fee</label>
          <input name="defaultCalloutFee" type="number" min="0" step="0.01" />
        </div>
        <div>
          <label>Commission %</label>
          <input name="commissionPercent" type="number" min="0" max="100" step="0.01" />
        </div>
        <div>
          <label>Support Phone</label>
          <input name="supportPhone" />
        </div>
      </div>
      ${renderCityServiceEditor([], state.data.marketMeta.defaultServiceCategories || [])}
      ${renderProviderEditor([])}
      <div class="form-grid">
        <div>
          <label>Support Email</label>
          <input name="supportEmail" type="email" />
        </div>
        <div>
          <label>WhatsApp</label>
          <input name="supportWhatsapp" />
        </div>
        <div>
          <label>Escalation Email</label>
          <input name="supportEscalationEmail" type="email" />
        </div>
      </div>
      <button class="primary-button" type="submit">Add Market</button>
    </form>
  `;
}

function prefillMarketDefaults(select) {
  const option = select.selectedOptions[0];
  const form = select.closest('form');
  if (!option || !form) return;

  const isCustom = option.value === '__CUSTOM__';
  const customFields = form.querySelector('[data-custom-country-fields]');
  if (customFields) customFields.hidden = !isCustom;
  if (isCustom) {
    form.elements.currency.value = '';
    form.elements.defaultCalloutFee.value = '';
    form.elements.commissionPercent.value = '15';
    setProviderRows(form, []);
    return;
  }

  form.elements.countryName.value = option.dataset.countryName || '';
  form.elements.currency.value = option.dataset.currency || '';
  form.elements.defaultCalloutFee.value = option.dataset.callout || '';
  form.elements.commissionPercent.value = option.dataset.commission || '';
  setProviderRows(
    form,
    String(option.dataset.providers || '')
      .split(',')
      .map((provider, index) => ({
        provider: provider.trim(),
        status: index === 0 ? 'ACTIVE' : 'FALLBACK',
        methods: '',
        priority: index + 1,
        payoutEnabled: false,
        configReference: `${provider.trim()}_CONFIG_REF`,
      }))
      .filter((row) => row.provider)
  );
}

function renderCityServiceEditor(rows = [], defaultServices = [], disabled = false) {
  const normalizedRows = rows.length
    ? rows
    : [{ city: '', status: 'ACTIVE', services: normalizeServiceEntries(defaultServices) }];

  return `
    <details class="nested-settings" open>
      <summary>Cities & Services</summary>
      <p class="setting-help">Add cities and choose exactly which services are available in each city.</p>
      <div data-city-service-list>
        ${normalizedRows.map((row) => renderCityServiceRow(row, disabled)).join('')}
      </div>
      ${disabled ? '' : '<button class="ghost-button compact" type="button" onclick="addCityServiceRow(this)">Add City</button>'}
    </details>
  `;
}

function renderCityServiceRow(row, disabled = false) {
  const disabledAttr = disabled ? 'disabled' : '';
  const services = normalizeServiceEntries(row.services, state.data.marketMeta.serviceDefinitions || []);
  const legacyServices = Array.isArray(row.services) && row.services.every((service) => typeof service === 'string')
    ? row.services.join(', ')
    : '';
  const areas = Array.isArray(row.areas) ? row.areas : [];
  return `
    <div class="nested-row" data-city-service-row>
      <input data-city placeholder="City" value="${escapeHtml(row.city || '')}" ${disabledAttr} />
      <select data-city-status ${disabledAttr}>
        ${['ACTIVE', 'COMING_SOON', 'PAUSED', 'DISABLED'].map((status) => `<option value="${status}" ${status === row.status ? 'selected' : ''}>${status}</option>`).join('')}
      </select>
      <input data-city-services placeholder="Legacy services CSV" value="${escapeHtml(legacyServices)}" ${disabledAttr} />
      ${disabled ? '' : '<button class="danger-button compact" type="button" onclick="removeNestedRow(this)">Remove</button>'}
      <div class="nested-sublist" data-service-entry-list>
        ${services.map((service) => renderServiceEntryRow(service, disabled)).join('') || renderServiceEntryRow({ serviceKey: '', label: '', status: 'ACTIVE' }, disabled)}
      </div>
      ${disabled ? '' : '<button class="ghost-button compact" type="button" onclick="addServiceEntryRow(this)">Add Service</button>'}
      <div class="nested-sublist" data-area-entry-list>
        ${areas.map((area) => renderAreaEntryRow(area, disabled)).join('')}
      </div>
      ${disabled ? '' : '<button class="ghost-button compact" type="button" onclick="addAreaEntryRow(this)">Add Area</button>'}
    </div>
  `;
}

function renderServiceEntryRow(service, disabled = false) {
  const disabledAttr = disabled ? 'disabled' : '';
  const serviceKey = serviceKeyFrom(service.serviceKey || service.label || '');
  const label = service.label || labelFromServiceKey(serviceKey);
  return `
    <div class="nested-row service-entry-row" data-service-entry-row>
      <input data-service-key placeholder="service_key" value="${escapeHtml(serviceKey)}" ${disabledAttr} />
      <input data-service-label placeholder="Display label" value="${escapeHtml(label)}" ${disabledAttr} />
      <select data-service-status ${disabledAttr}>
        ${['ACTIVE', 'COMING_SOON', 'PAUSED', 'DISABLED'].map((status) => `<option value="${status}" ${status === service.status ? 'selected' : ''}>${status}</option>`).join('')}
      </select>
      ${disabled ? '' : '<button class="danger-button compact" type="button" onclick="removeNestedRow(this)">Remove</button>'}
    </div>
  `;
}

function renderAreaEntryRow(area, disabled = false) {
  const disabledAttr = disabled ? 'disabled' : '';
  return `
    <div class="nested-row area-entry-row" data-area-entry-row>
      <input data-area-name placeholder="Area / Neighbourhood" value="${escapeHtml(area.name || '')}" ${disabledAttr} />
      <select data-area-status ${disabledAttr}>
        ${['ACTIVE', 'COMING_SOON', 'PAUSED', 'DISABLED'].map((status) => `<option value="${status}" ${status === area.status ? 'selected' : ''}>${status}</option>`).join('')}
      </select>
      <input data-area-services placeholder="appliance_repair:ACTIVE, cleaning:COMING_SOON" value="${escapeHtml(formatServiceList(area.services || []))}" ${disabledAttr} />
      ${disabled ? '' : '<button class="danger-button compact" type="button" onclick="removeNestedRow(this)">Remove</button>'}
    </div>
  `;
}

function renderProviderEditor(rows = [], disabled = false) {
  const normalizedRows = rows.length
    ? rows
    : [{ provider: '', status: 'DISABLED', methods: '', priority: 1, payoutEnabled: false, configReference: '' }];

  return `
    <details class="nested-settings" open>
      <summary>Payment Providers</summary>
      <p class="setting-help">Configure collection/payout providers without storing raw secret keys in the portal.</p>
      <div data-provider-list>
        ${normalizedRows.map((row) => renderProviderRow(row, disabled)).join('')}
      </div>
      ${disabled ? '' : '<button class="ghost-button compact" type="button" onclick="addProviderRow(this)">Add Provider</button>'}
    </details>
  `;
}

function renderProviderRow(row, disabled = false) {
  const methods = Array.isArray(row.methods) ? row.methods.join(', ') : row.methods || '';
  const disabledAttr = disabled ? 'disabled' : '';
  return `
    <div class="nested-row provider-row" data-provider-row>
      <input data-provider placeholder="PAYSTACK" value="${escapeHtml(row.provider || '')}" ${disabledAttr} />
      <select data-provider-status ${disabledAttr}>
        ${['ACTIVE', 'FALLBACK', 'TESTING', 'DISABLED'].map((status) => `<option value="${status}" ${status === row.status ? 'selected' : ''}>${status}</option>`).join('')}
      </select>
      <input data-provider-methods placeholder="card, bank, mobile_money" value="${escapeHtml(methods)}" ${disabledAttr} />
      <input data-provider-priority type="number" min="1" value="${row.priority || 1}" ${disabledAttr} />
      <label class="inline-check"><input data-provider-payout type="checkbox" ${row.payoutEnabled ? 'checked' : ''} ${disabledAttr} /> Payout</label>
      <input data-provider-config placeholder="PAYSTACK_CONFIG_REF" value="${escapeHtml(row.configReference || '')}" ${disabledAttr} />
      ${disabled ? '' : '<button class="danger-button compact" type="button" onclick="removeNestedRow(this)">Remove</button>'}
    </div>
  `;
}

function addCityServiceRow(button) {
  const list = button.closest('.nested-settings')?.querySelector('[data-city-service-list]');
  if (!list) return;
  list.insertAdjacentHTML('beforeend', renderCityServiceRow({ city: '', status: 'ACTIVE', services: '' }));
}

function addServiceEntryRow(button) {
  const list = button.closest('[data-city-service-row]')?.querySelector('[data-service-entry-list]');
  if (!list) return;
  list.insertAdjacentHTML('beforeend', renderServiceEntryRow({ serviceKey: '', label: '', status: 'ACTIVE' }));
}

function addAreaEntryRow(button) {
  const list = button.closest('[data-city-service-row]')?.querySelector('[data-area-entry-list]');
  if (!list) return;
  list.insertAdjacentHTML('beforeend', renderAreaEntryRow({ name: '', status: 'ACTIVE', services: [] }));
}

function addProviderRow(button) {
  const list = button.closest('.nested-settings')?.querySelector('[data-provider-list]');
  if (!list) return;
  const priority = list.querySelectorAll('[data-provider-row]').length + 1;
  list.insertAdjacentHTML('beforeend', renderProviderRow({ provider: '', status: 'DISABLED', methods: '', priority, payoutEnabled: false, configReference: '' }));
}

function removeNestedRow(button) {
  button.closest('.nested-row')?.remove();
}

function setProviderRows(form, rows) {
  const list = form.querySelector('[data-provider-list]');
  if (!list) return;
  list.innerHTML = rows.length
    ? rows.map(renderProviderRow).join('')
    : renderProviderRow({ provider: '', status: 'DISABLED', methods: '', priority: 1, payoutEnabled: false, configReference: '' });
}

function renderMarketForm(market) {
  const marketView = getMarketView(market);
  const canUpdateMarkets = canMutate('markets.update');
  const disabled = canUpdateMarkets ? '' : 'disabled';
  const statuses = state.data.marketMeta.availableStatuses.length
    ? state.data.marketMeta.availableStatuses
    : ['COMING_SOON', 'ACTIVE', 'PAUSED', 'DISABLED'];
  const commissionPercent = (marketView.platformCommissionBps / 100).toFixed(2);

  return `
    <form class="market-card" onsubmit="saveMarket(event, '${marketView.countryCode}')">
      <input name="countryName" type="hidden" value="${escapeHtml(marketView.countryName)}" />
      <input name="taxLabel" type="hidden" value="${escapeHtml(marketView.taxLabel)}" />
      <input name="supportWhatsapp" type="hidden" value="${escapeHtml(marketView.supportWhatsapp)}" />
      <input name="supportEscalationEmail" type="hidden" value="${escapeHtml(marketView.supportEscalationEmail)}" />
      <div class="market-card-header">
        <div>
          <strong>${escapeHtml(marketView.countryName)} (${escapeHtml(marketView.countryCode)})</strong>
          <span>${escapeHtml(marketView.currency)} - ${marketView.hasCustomSettings ? 'custom settings' : 'default config'}</span>
        </div>
        <span class="status ${statusClass(marketView.status)}">${escapeHtml(marketView.status || (marketView.enabled ? 'ACTIVE' : 'DISABLED'))}</span>
      </div>
      <div class="form-grid">
        <div>
          <label>Status</label>
          <select name="status" ${disabled}>
            ${statuses.map((status) => `<option value="${status}" ${status === marketView.status ? 'selected' : ''}>${status}</option>`).join('')}
          </select>
        </div>
        <div>
          <label>Currency</label>
          <input name="currency" value="${escapeHtml(marketView.currency)}" ${disabled} />
        </div>
        <div>
          <label>Callout Fee</label>
          <input name="defaultCalloutFee" type="number" min="0" step="0.01" value="${marketView.defaultCalloutFee}" ${disabled} />
        </div>
        <div>
          <label>Commission %</label>
          <input name="commissionPercent" type="number" min="0" max="100" step="0.01" value="${commissionPercent}" ${disabled} />
        </div>
      </div>
      ${renderCityServiceEditor(marketView.cityServiceAvailability || [], marketView.serviceCategories || state.data.marketMeta.defaultServiceCategories || [], !canUpdateMarkets)}
      ${renderProviderEditor(marketView.providerSettings || [], !canUpdateMarkets)}
      <div class="form-grid">
        <div>
          <label>Support Email</label>
          <input name="supportEmail" value="${escapeHtml(marketView.supportEmail)}" ${disabled} />
        </div>
        <div>
          <label>Support Phone</label>
          <input name="supportPhone" value="${escapeHtml(marketView.supportPhone)}" ${disabled} />
        </div>
      </div>
      ${canUpdateMarkets ? '<button class="primary-button compact" type="submit">Save Market</button>' : '<span class="status info">Read only</span>'}
    </form>
  `;
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

function renderEmpty(message) {
  return `<p class="empty"><span>No data</span>${escapeHtml(message)}</p>`;
}

function renderBookingDrawer() {
  const data = state.selectedBooking;
  const booking = data.booking;
  const countryCode = booking.identity?.countryCode || booking.countryCode || '-';
  const currency = booking.identity?.currency || booking.currency || 'ZAR';
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
}

window.login = login;
window.forgotPassword = forgotPassword;
window.resetPassword = resetPassword;
window.setAuthView = setAuthView;
window.logout = logout;
window.refresh = refresh;
window.setView = setView;
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
window.createSubscriptionPlan = createSubscriptionPlan;
window.generateSubscriptionInvoices = generateSubscriptionInvoices;
window.saveMarket = saveMarket;
window.createAdminUser = createAdminUser;
window.updateAdminUser = updateAdminUser;
window.prefillMarketDefaults = prefillMarketDefaults;
window.addCityServiceRow = addCityServiceRow;
window.addServiceEntryRow = addServiceEntryRow;
window.addAreaEntryRow = addAreaEntryRow;
window.addProviderRow = addProviderRow;
window.removeNestedRow = removeNestedRow;
window.state = state;
window.render = render;

if (state.token) {
  loadAllData().catch(() => {
    state.token = '';
    localStorage.removeItem('myfixer_admin_token');
  }).finally(render);
} else {
  render();
}
