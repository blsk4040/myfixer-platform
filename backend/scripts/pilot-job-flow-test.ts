// @ts-nocheck
const dns = require('dns');
const dnsPromises = require('dns').promises;

dns.setDefaultResultOrder?.('ipv4first');
dns.setServers(['8.8.8.8', '1.1.1.1']);
dnsPromises.setServers(['8.8.8.8', '1.1.1.1']);

const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const { loadLocalEnvFile, loadPlatformConfig } = require('../../config/load-platform-config');
const userModel = require('../src/models/user.model');
const User = userModel.default || userModel;
const { AccountStatus, AdminPermission, AdminRole, UserRole } = userModel;
const technicianModel = require('../src/models/technician.model');
const Technician = technicianModel.default || technicianModel;
const { TechnicianApprovalStatus, VerificationStatus } = technicianModel;
const capabilityModel = require('../src/models/technician-capability.model');
const TechnicianCapability = capabilityModel.default || capabilityModel;
const { CapabilityStatus } = capabilityModel;
const telemetryModel = require('../src/models/technician-telemetry.model');
const TechnicianTelemetry = telemetryModel.default || telemetryModel;
const marketModel = require('../src/models/market-setting.model');
const MarketSetting = marketModel.default || marketModel;
const { PaymentProviderStatus } = marketModel;
const { MARKET_CONFIG, toMinorUnits } = require('../src/config/market.config');
const bookingModel = require('../src/models/booking.model');
const Booking = bookingModel.default || bookingModel;
const quoteModel = require('../src/models/quote.model');
const JobQuote = quoteModel.default || quoteModel;
const billingModel = require('../src/models/billing.model');
const Invoice = billingModel.Invoice;
const notificationModel = require('../src/models/notification.model');
const Notification = notificationModel.default || notificationModel;

const apiBase = (process.env.PILOT_API_BASE_URL || 'http://127.0.0.1:5000/api/v1').replace(/\/$/, '');
const runId = `pilot-${Date.now()}`;
const password = `Pilot-${Date.now()}!`;
const countryCode = process.env.PILOT_TEST_COUNTRY_CODE || 'ZA';
const city = process.env.PILOT_TEST_CITY || 'Johannesburg';
const area = process.env.PILOT_TEST_AREA || 'Sandton';
const coords = { latitude: -26.1076, longitude: 28.0567 };
const results = [];
let marketIdentity = { countryName: 'South Africa', currency: 'ZAR' };

const defaultTimezoneByCountry = {
  GH: 'Africa/Accra',
  ZA: 'Africa/Johannesburg',
  NG: 'Africa/Lagos',
  KE: 'Africa/Nairobi',
  UG: 'Africa/Kampala',
  TZ: 'Africa/Dar_es_Salaam',
  RW: 'Africa/Kigali',
  ZM: 'Africa/Lusaka',
};

const add = (name, status, detail = '') => {
  results.push({ name, status, detail });
  console.log(`${status} ${name}${detail ? ` - ${detail}` : ''}`);
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const request = async (path, options = {}) => {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { response, body };
};

const login = async (email) => {
  const { response, body } = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  assert(response.ok, `login ${email} returned ${response.status}: ${JSON.stringify(body)}`);
  assert(body?.token, `login ${email} missing token`);
  return body;
};

const pickService = async () => {
  const { response, body } = await request(`/markets/${countryCode}/availability?city=${encodeURIComponent(city)}`);
  assert(response.ok, `availability returned ${response.status}: ${JSON.stringify(body)}`);
  const groups = body?.availability?.groups || body?.groups || [];
  for (const group of groups) {
    for (const category of group.categories || []) {
      for (const service of category.services || []) {
        if (service?.canBook && service?.serviceKey && service?.status === 'ACTIVE' && Number.isInteger(service.calloutFeeMinor)) {
          return {
            groupLabel: group.label,
            categoryLabel: category.label,
            categoryKey: category.categoryKey || category.serviceKey,
            serviceKey: service.serviceKey,
            label: service.label,
            calloutFeeMinor: service.calloutFeeMinor,
          };
        }
      }
    }
  }
  throw new Error('No published, bookable catalogue service found in local availability response.');
};

const createUser = async (role, email, extra = {}) => {
  const hashedPassword = await bcrypt.hash(password, 10);
  return User.findOneAndUpdate(
    { email },
    {
      $set: {
        name: role === UserRole.TECHNICIAN ? 'Pilot Padi Pro' : role === UserRole.ADMIN ? 'Pilot Admin' : 'Pilot Client',
        email,
        phone: role === UserRole.TECHNICIAN ? '+27119990002' : role === UserRole.ADMIN ? '+27119990003' : '+27119990001',
        password: hashedPassword,
        role,
        accountStatus: AccountStatus.ACTIVE,
        isActive: true,
        emailVerified: true,
        isEmailVerified: true,
        phoneVerified: true,
        profileCompleted: true,
        countryCode,
        currency: marketIdentity.currency,
        location: { country: marketIdentity.countryName, city, area },
        defaultServiceAddress: {
          streetAddress: 'Pilot Street 1',
          suburb: area,
          city,
          countryCode,
          fullAddress: `Pilot Street 1, ${area}, ${city}`,
          coordinates: { type: 'Point', coordinates: [coords.longitude, coords.latitude] },
          updatedAt: new Date(),
        },
        metadata: { pilotRunId: runId },
        ...extra,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

const setupAccounts = async (service) => {
  const suffix = Date.now();
  const customer = await createUser(UserRole.CUSTOMER, `pilot.client.${suffix}@example.com`);
  const providerUser = await createUser(UserRole.TECHNICIAN, `pilot.pro.${suffix}@example.com`);
  const admin = await createUser(UserRole.ADMIN, `pilot.admin.${suffix}@example.com`, {
    adminRole: AdminRole.SUPER_ADMIN,
    adminPermissions: Object.values(AdminPermission),
    mustChangePassword: false,
  });

  const technician = await Technician.findOneAndUpdate(
    { userId: providerUser._id },
    {
      $set: {
        userId: providerUser._id,
        approvalStatus: TechnicianApprovalStatus.APPROVED,
        countryCode,
        city,
        serviceCategories: [service.serviceKey, service.categoryKey],
        yearsExperience: 5,
        businessName: 'Pilot Padi Pro',
        serviceRadiusKm: 50,
        documents: {
          idDocumentStatus: VerificationStatus.VERIFIED,
          tradeCertificateStatus: VerificationStatus.VERIFIED,
          policeClearanceStatus: VerificationStatus.VERIFIED,
          profilePhotoUrl: 'https://example.test/padi-pro.jpg',
          profilePhotoStatus: VerificationStatus.VERIFIED,
        },
        availability: { isOnline: true, acceptsEmergencyJobs: true, lastSeenAt: new Date() },
        lastLocation: { type: 'Point', coordinates: [coords.longitude, coords.latitude] },
        metadata: { pilotRunId: runId },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await TechnicianCapability.findOneAndUpdate(
    { technicianId: technician._id, categorySlug: service.serviceKey },
    {
      $set: {
        verificationStatus: CapabilityStatus.APPROVED,
        approvedSpecialties: [service.serviceKey],
        serviceRadiusKm: 50,
        rejectionReason: null,
      },
      $setOnInsert: { technicianId: technician._id, categorySlug: service.serviceKey },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await TechnicianTelemetry.findOneAndUpdate(
    { technicianId: technician._id },
    {
      $set: {
        technicianId: technician._id,
        isOnDuty: true,
        connectionStatus: 'CONNECTED',
        location: { type: 'Point', coordinates: [coords.longitude, coords.latitude] },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return { customer, providerUser, admin, technician };
};

const ensureLocalPaymentCollection = async () => {
  let market = await MarketSetting.findOne({ 'identity.countryCode': countryCode });
  if (!market) {
    const template = MARKET_CONFIG[countryCode];
    assert(template, `${countryCode} market is not configured and has no bundled market template.`);
    market = new MarketSetting({
      identity: {
        countryCode,
        countryName: template.countryName,
        currency: template.currency,
        locale: template.locale,
        timezone: defaultTimezoneByCountry[countryCode] || '',
        status: 'ACTIVE',
      },
      pricing: {
        defaultCalloutFeeMinor: toMinorUnits(Number(template.defaultCalloutFee || 0), template.currency),
        marketCalloutFeeMinor: toMinorUnits(Number(template.defaultCalloutFee || 0), template.currency),
        platformCommissionBps: template.platformCommissionBps || 1500,
        taxLabel: template.taxLabel || 'VAT',
        taxRateBps: 0,
        taxInclusive: false,
        clientServiceFeeType: 'NONE',
        clientServiceFeeBps: 0,
        clientServiceFeeMinor: 0,
        taxableCallout: true,
        taxableLabour: true,
        taxableParts: true,
        taxableAdditionalServices: true,
        taxableClientServiceFee: true,
        discountsReduceTaxableValue: true,
      },
      coverage: {
        supportedCities: [city],
        serviceCategories: [],
        cityServiceAvailability: [{ city, status: 'ACTIVE', services: [], areas: [] }],
      },
      payments: {
        paymentProviders: ['PAYSTACK'],
        providerSettings: [],
      },
      support: {
        email: 'support@example.com',
        phone: '+233000000000',
        whatsapp: '',
        escalationEmail: '',
      },
      audit: { changeHistory: [] },
    });
    add('local market created', 'PASS', `${countryCode}/${city} created from bundled market template for pilot`);
  }
  marketIdentity = {
    countryName: market.identity?.countryName || countryCode,
    currency: market.identity?.currency || '',
  };
  market.identity.status = 'ACTIVE';
  const providers = new Set([...(market.payments?.paymentProviders || []), 'PAYSTACK']);
  const existingSettings = market.payments?.providerSettings || [];
  const providerSettings = existingSettings.filter((setting) => String(setting.provider).toUpperCase() !== 'PAYSTACK');
  providerSettings.push({
    provider: 'PAYSTACK',
    status: PaymentProviderStatus.ACTIVE,
    methods: ['CARD'],
    priority: 1,
    payoutEnabled: false,
    configReference: 'local-pilot-paystack-test',
  });
  market.payments = {
    paymentProviders: Array.from(providers),
    providerSettings,
  };
  const cityRows = market.coverage?.cityServiceAvailability || [];
  const existingCity = cityRows.find((row) => String(row.city || '').toLowerCase() === city.toLowerCase());
  if (existingCity) {
    existingCity.status = 'ACTIVE';
  } else {
    cityRows.push({ city, status: 'ACTIVE', services: [], areas: [] });
  }
  const supportedCities = new Set([...(market.coverage?.supportedCities || []), city]);
  market.coverage = {
    ...(market.coverage || {}),
    supportedCities: Array.from(supportedCities),
    cityServiceAvailability: cityRows,
  };
  await market.save();
  add('local market payment collection ready', 'PASS', `${countryCode}/${city} PAYSTACK ACTIVE for local pilot`);
};

const main = async () => {
  loadLocalEnvFile({ override: false });
  loadPlatformConfig({ override: false });
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  assert(mongoUri, 'Missing local MongoDB URI.');
  await mongoose.connect(mongoUri);

  await ensureLocalPaymentCollection();
  const service = await pickService();
  add('catalogue available', 'PASS', `${service.groupLabel} > ${service.categoryLabel} > ${service.label}`);

  const accounts = await setupAccounts(service);
  add('pilot local accounts ready', 'PASS', runId);

  const customerSession = await login(accounts.customer.email);
  const providerSession = await login(accounts.providerUser.email);
  const adminSession = await login(accounts.admin.email);
  add('client/provider/admin login', 'PASS', 'all local pilot users authenticated');

  const bookingPayload = {
    customer_name: accounts.customer.name,
    appliance_type: service.label,
    fault_description: `Local pilot booking ${runId}`,
    latitude: coords.latitude,
    longitude: coords.longitude,
    country_code: countryCode,
    full_address: `Pilot Street 1, ${area}, ${city}`,
    complex_details: 'Local pilot test',
    city,
    area,
    general_area: area,
    service_key: service.serviceKey,
    category: service.serviceKey,
    call_out_fee: service.calloutFeeMinor / 100,
  };

  const created = await request('/bookings', {
    method: 'POST',
    token: customerSession.token,
    body: JSON.stringify(bookingPayload),
  });
  assert(created.response.status === 201, `create booking returned ${created.response.status}: ${JSON.stringify(created.body)}`);
  const bookingId = created.body.bookingId;
  add('client books service', 'PASS', bookingId);

  const available = await request('/technician/available-jobs', { token: providerSession.token });
  const availableJobs = [
    ...(Array.isArray(available.body?.jobs) ? available.body.jobs : []),
    ...(Array.isArray(available.body?.bookings) ? available.body.bookings : []),
  ];
  const sawJob = available.response.ok && availableJobs.some((job) => String(job.id || job.bookingId || job._id) === String(bookingId));
  add('provider receives job listing', sawJob ? 'PASS' : 'WARN', sawJob ? 'job visible' : `available-jobs=${available.response.status}`);

  const accepted = await request(`/bookings/${bookingId}/accept`, {
    method: 'POST',
    token: providerSession.token,
    body: JSON.stringify({}),
  });
  assert(accepted.response.ok, `accept returned ${accepted.response.status}: ${JSON.stringify(accepted.body)}`);
  add('provider accepts', 'PASS', `status=${accepted.body.status}`);

  const route = await request(`/bookings/${bookingId}/start-route`, {
    method: 'POST',
    token: providerSession.token,
    body: JSON.stringify({}),
  });
  assert(route.response.ok, `start-route returned ${route.response.status}: ${JSON.stringify(route.body)}`);

  const firstArrival = await request(`/bookings/${bookingId}/arrival`, {
    method: 'POST',
    token: providerSession.token,
    body: JSON.stringify({
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracyMeters: 10,
      recordedAt: new Date(Date.now() - 11000).toISOString(),
    }),
  });
  assert(firstArrival.response.ok || firstArrival.response.status === 202, `first arrival returned ${firstArrival.response.status}: ${JSON.stringify(firstArrival.body)}`);

  const arrived = await request(`/bookings/${bookingId}/arrival`, {
    method: 'POST',
    token: providerSession.token,
    body: JSON.stringify({
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracyMeters: 10,
      recordedAt: new Date().toISOString(),
    }),
  });
  assert(arrived.response.ok, `arrival returned ${arrived.response.status}: ${JSON.stringify(arrived.body)}`);
  add('provider arrival flow', 'PASS', `arrival=${arrived.response.status}`);

  const inspectionReading = {
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracyMeters: 10,
    recordedAt: new Date().toISOString(),
  };
  const inspectionStarted = await request(`/bookings/${bookingId}/start-inspection`, {
    method: 'POST',
    token: providerSession.token,
    body: JSON.stringify({ ...inspectionReading, acknowledgePlatformRules: true }),
  });
  assert(inspectionStarted.response.ok, `start inspection returned ${inspectionStarted.response.status}: ${JSON.stringify(inspectionStarted.body)}`);

  const inspectionCompleted = await request(`/bookings/${bookingId}/complete-inspection`, {
    method: 'POST',
    token: providerSession.token,
    body: JSON.stringify({
      ...inspectionReading,
      recordedAt: new Date().toISOString(),
      diagnosisNotes: 'Pilot diagnosis completed.',
      technicalObservations: 'Pilot technical observation.',
      quoteRequired: true,
      partsRequired: [],
      evidenceMediaIds: [],
    }),
  });
  assert(inspectionCompleted.response.ok, `complete inspection returned ${inspectionCompleted.response.status}: ${JSON.stringify(inspectionCompleted.body)}`);
  add('provider inspection flow', 'PASS', 'inspection started and completed');

  const quote = await request(`/bookings/${bookingId}/quotes`, {
    method: 'POST',
    token: providerSession.token,
    body: JSON.stringify({
      submit: true,
      technicianNotes: 'Pilot quote for approval.',
      lineItems: [
        { type: 'CALLOUT', label: 'Call-out fee', quantity: 1, unitAmount: service.calloutFeeMinor / 100 },
        { type: 'LABOR', label: 'Pilot labour', quantity: 1, unitAmount: 120 },
      ],
    }),
  });
  assert(quote.response.status === 201, `quote returned ${quote.response.status}: ${JSON.stringify(quote.body)}`);
  const quoteId = quote.body.quote.id;
  assert(quote.body.quote.quoteNumber, 'quote number missing');
  add('provider sends quote', 'PASS', `${quote.body.quote.quoteNumber}`);

  const customerQuotes = await request(`/bookings/${bookingId}/quotes`, { token: customerSession.token });
  assert(customerQuotes.response.ok, `customer quote list returned ${customerQuotes.response.status}`);
  assert((customerQuotes.body.quotes || []).some((item) => item.id === quoteId && item.status === 'SUBMITTED'), 'client cannot see submitted quote');
  add('client sees quote', 'PASS', 'quote visible for approval/rejection');

  const approved = await request(`/quotes/${quoteId}/approve`, {
    method: 'POST',
    token: customerSession.token,
    body: JSON.stringify({}),
  });
  assert(approved.response.ok, `approve returned ${approved.response.status}: ${JSON.stringify(approved.body)}`);
  add('client approves quote', 'PASS', `status=${approved.body.quote.status}`);

  const payment = await request('/payments/initialize', {
    method: 'POST',
    token: customerSession.token,
    body: JSON.stringify({ bookingId, quoteId, idempotencyKey: `pilot:${runId}:payment` }),
  });
  add(
    'payment continuation after quote approval',
    payment.response.ok ? 'PASS' : 'WARN',
    payment.response.ok ? `paymentStatus=${payment.body.payment?.status || 'created'}` : `payment initialize=${payment.response.status}: ${JSON.stringify(payment.body)}`
  );

  const workStart = await request(`/bookings/${bookingId}/start-job`, {
    method: 'POST',
    token: providerSession.token,
    body: JSON.stringify({}),
  });
  add(
    'work start after approval/payment check',
    workStart.response.ok ? 'PASS' : 'WARN',
    workStart.response.ok ? `status=${workStart.body.status}` : `start-job=${workStart.response.status}: ${JSON.stringify(workStart.body)}`
  );

  const invoice = await request('/bookings/finalize-invoice', {
    method: 'POST',
    token: providerSession.token,
    body: JSON.stringify({ bookingId, proofPhoto: 'https://example.test/padi/local-pilot-proof.jpg' }),
  });
  add(
    'invoice/receipt generation',
    invoice.response.ok ? 'PASS' : 'WARN',
    invoice.response.ok ? 'finalize-invoice succeeded' : `finalize-invoice=${invoice.response.status}: ${JSON.stringify(invoice.body)}`
  );

  const clientNotifications = await request('/notifications', { token: customerSession.token });
  assert(clientNotifications.response.ok, `client notifications returned ${clientNotifications.response.status}`);
  const clientItems = clientNotifications.body.notifications || [];
  const quoteInbox = clientItems.find((item) => item.metadata?.quoteId === quoteId && String(item.metadata?.feed).toLowerCase() === 'inbox');
  const invoiceInbox = clientItems.find((item) => item.type === 'INVOICE_GENERATED' && item.metadata?.bookingId === bookingId && String(item.metadata?.feed).toLowerCase() === 'inbox');
  assert(quoteInbox, 'client quote notification missing from Inbox feed');
  add('client Inbox receives quote', 'PASS', quoteInbox.metadata.quoteNumber || quote.body.quote.quoteNumber);
  add('client Inbox receives invoice/receipt', invoiceInbox ? 'PASS' : 'WARN', invoiceInbox ? invoiceInbox.metadata.invoiceNumber || 'invoice notice present' : 'no invoice notice because invoice finalize did not complete');

  const providerNotifications = await request('/notifications', { token: providerSession.token });
  assert(providerNotifications.response.ok, `provider notifications returned ${providerNotifications.response.status}`);
  const providerQuoteDecision = (providerNotifications.body.notifications || []).find((item) => item.type === 'QUOTE_APPROVED' && String(item.metadata?.feed).toLowerCase() === 'inbox');
  assert(providerQuoteDecision, 'provider quote approval missing from Padi Pro Inbox feed');
  add('Padi Pro Inbox receives quote decision', 'PASS', providerQuoteDecision.type);

  const adminBooking = await request(`/admin/bookings/${bookingId}`, { token: adminSession.token });
  assert(adminBooking.response.ok, `admin booking detail returned ${adminBooking.response.status}: ${JSON.stringify(adminBooking.body)}`);
  assert((adminBooking.body.quotes || []).some((item) => String(item.id || item._id) === String(quoteId)), 'admin booking detail missing quote');
  add('admin sees booking trail', 'PASS', 'booking detail includes quote trail');

  const adminQuotes = await request('/admin/quotes?limit=25', { token: adminSession.token });
  assert(adminQuotes.response.ok, `admin quotes returned ${adminQuotes.response.status}`);
  assert((adminQuotes.body.quotes || []).some((item) => String(item.id || item._id) === String(quoteId)), 'admin quotes list missing pilot quote');
  add('admin sees quote list', 'PASS', 'pilot quote listed');

  const storedBooking = await Booking.findById(bookingId).lean();
  const storedQuote = await JobQuote.findById(quoteId).lean();
  const storedInvoice = await Invoice.findOne({ bookingId: new mongoose.Types.ObjectId(bookingId) }).lean();
  const bookingNotifications = await Notification.find({ 'metadata.bookingId': bookingId }).lean();
  assert(storedBooking?.technicianId?.toString() === accounts.providerUser._id.toString(), 'stored booking technician assignment missing');
  assert(storedQuote?.quoteNumber, 'stored quote number missing');
  add('database persistence trail', 'PASS', `${bookingNotifications.length} booking notification(s); invoice=${storedInvoice?.invoiceNumber || 'not finalized'}`);

  console.log('\nPilot flow summary');
  console.table(results);
  if (results.some((result) => result.status === 'FAIL')) process.exitCode = 1;
};

main()
  .catch((error) => {
    add('pilot flow', 'FAIL', error instanceof Error ? error.message : String(error));
    console.log('\nPilot flow summary');
    console.table(results);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });
