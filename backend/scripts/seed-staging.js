const dns = require('dns').promises;
require('dns').setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '1.1.1.1']);

require('ts-node/register/transpile-only');

const path = require('path');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const User = require('../src/models/user.model').default;
const {
  AccountStatus,
  AdminPermission,
  AdminRole,
  UserRole,
} = require('../src/models/user.model');
const Technician = require('../src/models/technician.model').default;
const {
  TechnicianApprovalStatus,
  VerificationStatus,
} = require('../src/models/technician.model');
const Booking = require('../src/models/booking.model').default;
const { BookingStatus } = require('../src/models/booking.model');
const JobQuote = require('../src/models/quote.model').default;
const { QuoteLineItemType, QuoteStatus } = require('../src/models/quote.model');
const {
  Invoice,
  InvoiceStatus,
  Wallet,
  WalletTransaction,
  WalletTransactionStatus,
  WalletTransactionType,
} = require('../src/models/billing.model');
const MarketSetting = require('../src/models/market-setting.model').default;
const {
  MarketStatus,
  PaymentProviderStatus,
} = require('../src/models/market-setting.model');
const {
  CountryCode,
  CurrencyCode,
  MARKET_CONFIG,
} = require('../src/config/market.config');

const seedKey = process.env.STAGING_SEED_KEY || 'myfixer-staging-seed-v1';
const allowOverwrite = process.env.STAGING_SEED_ALLOW_OVERWRITE === 'true';
const countryCode = (process.env.STAGING_SEED_COUNTRY_CODE || CountryCode.ZM).toUpperCase();
const market = MARKET_CONFIG[countryCode] || MARKET_CONFIG[CountryCode.ZM];
const currency = market.currency || CurrencyCode.ZMW;
const seedPassword = process.env.STAGING_SEED_PASSWORD || '';

const emails = {
  admin: (process.env.STAGING_SEED_ADMIN_EMAIL || 'seed.superadmin@myfixer.test').toLowerCase(),
  customer: (process.env.STAGING_SEED_CUSTOMER_EMAIL || 'seed.customer@myfixer.test').toLowerCase(),
  technician: (process.env.STAGING_SEED_TECHNICIAN_EMAIL || 'seed.technician@myfixer.test').toLowerCase(),
};

const assertSafeToRun = () => {
  if (process.env.STAGING_SEED_ENABLED !== 'true') {
    throw new Error('Refusing to seed. Set STAGING_SEED_ENABLED=true.');
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed while NODE_ENV=production.');
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required.');
  }

  if (!seedPassword || seedPassword.length < 12) {
    throw new Error('STAGING_SEED_PASSWORD is required and must be at least 12 characters.');
  }
};

const assertSeedOwned = (record, label) => {
  if (!record) return;
  if (record.metadata?.seedKey === seedKey) return;
  if (Array.isArray(record.audit?.changeHistory) && record.audit.changeHistory.some((entry) => entry?.after?.seedKey === seedKey)) return;
  if (allowOverwrite) return;
  throw new Error(`${label} already exists but is not marked as ${seedKey}. Set STAGING_SEED_ALLOW_OVERWRITE=true to override intentionally.`);
};

const upsertSeeded = async (Model, query, payload, label, options = {}) => {
  const existing = await Model.findOne(query);
  if (!options.skipOwnershipCheck) {
    assertSeedOwned(existing, label);
  }

  if (existing) {
    await Model.updateOne({ _id: existing._id }, { $set: payload });
    return Model.findById(existing._id);
  }

  return Model.create(payload);
};

const makeSeedMetadata = (label) => ({
  seedKey,
  testData: true,
  label,
  seededAt: new Date().toISOString(),
});

const main = async () => {
  assertSafeToRun();
  await mongoose.connect(process.env.MONGODB_URI);

  const passwordHash = await bcrypt.hash(seedPassword, 10);
  const now = new Date();
  const baseUserFields = {
    password: passwordHash,
    accountStatus: AccountStatus.ACTIVE,
    isActive: true,
    emailVerified: true,
    phoneVerified: true,
    countryCode: market.countryCode,
    currency,
  };

  const admin = await upsertSeeded(
    User,
    { email: emails.admin },
    {
      ...baseUserFields,
      name: 'Seed Super Admin',
      email: emails.admin,
      phone: '+260970000001',
      location: { country: market.countryName, city: 'Lusaka' },
      role: UserRole.ADMIN,
      adminRole: AdminRole.SUPER_ADMIN,
      adminPermissions: Object.values(AdminPermission),
      metadata: makeSeedMetadata('super-admin'),
    },
    `Admin user ${emails.admin}`
  );

  const customer = await upsertSeeded(
    User,
    { email: emails.customer },
    {
      ...baseUserFields,
      name: 'Seed Customer',
      email: emails.customer,
      phone: '+260970000002',
      location: { country: market.countryName, city: 'Lusaka', area: 'Lusaka Central' },
      role: UserRole.CUSTOMER,
      adminRole: undefined,
      adminPermissions: [],
      metadata: makeSeedMetadata('customer'),
    },
    `Customer user ${emails.customer}`
  );

  const technicianUser = await upsertSeeded(
    User,
    { email: emails.technician },
    {
      ...baseUserFields,
      name: 'Seed Technician',
      email: emails.technician,
      phone: '+260970000003',
      location: { country: market.countryName, city: 'Lusaka' },
      role: UserRole.TECHNICIAN,
      adminRole: undefined,
      adminPermissions: [],
      metadata: makeSeedMetadata('technician-user'),
    },
    `Technician user ${emails.technician}`
  );

  const technician = await upsertSeeded(
    Technician,
    { userId: technicianUser._id },
    {
      userId: technicianUser._id,
      approvalStatus: TechnicianApprovalStatus.APPROVED,
      countryCode: market.countryCode,
      city: 'Lusaka',
      serviceCategories: ['Appliance Repair'],
      yearsExperience: 5,
      businessName: 'MyFixer Seed Repairs',
      idNumberLast4: '0003',
      vehicleType: 'Van',
      vehicleRegistration: 'SEED-03',
      serviceRadiusKm: 30,
      bio: 'Seed technician profile for staging smoke tests only.',
      documents: {
        idDocumentUrl: 'https://example.test/myfixer/seed-id.pdf',
        idDocumentStatus: VerificationStatus.VERIFIED,
        tradeCertificateUrl: 'https://example.test/myfixer/seed-trade.pdf',
        tradeCertificateStatus: VerificationStatus.VERIFIED,
        policeClearanceUrl: 'https://example.test/myfixer/seed-police.pdf',
        policeClearanceStatus: VerificationStatus.VERIFIED,
        profilePhotoUrl: 'https://example.test/myfixer/seed-photo.jpg',
        profilePhotoStatus: VerificationStatus.VERIFIED,
      },
      banking: {
        accountHolder: 'Seed Technician',
        bankName: 'Seed Bank',
        accountNumberLast4: '0003',
        payoutEnabled: true,
      },
      stats: {
        averageRating: 4.8,
        completedJobs: 3,
        cancelledJobs: 0,
        lifetimeEarningsMinor: 382500,
      },
      availability: {
        isOnline: true,
        acceptsEmergencyJobs: true,
        lastSeenAt: now,
      },
      lastLocation: {
        type: 'Point',
        coordinates: [28.3228, -15.3875],
      },
      review: {
        reviewedAt: now,
        reviewedBy: admin._id,
        rejectionReason: '',
        suspensionReason: '',
      },
      metadata: makeSeedMetadata('technician-profile'),
    },
    `Technician profile for ${emails.technician}`
  );

  const booking = await upsertSeeded(
    Booking,
    { 'metadata.seedKey': seedKey, 'metadata.label': 'booking' },
    {
      customerId: customer._id,
      customerName: customer.name,
      customerEmail: customer.email,
      technicianId: technicianUser._id,
      technicianName: technicianUser.name,
      applianceType: 'Washing Machine',
      faultDescription: 'Seed booking for staging integration tests.',
      customerLocation: {
        type: 'Point',
        coordinates: [28.3228, -15.3875],
      },
      fullAddress: 'Seed Test Address, Lusaka',
      complexDetails: 'Staging data only',
      generalArea: 'Lusaka Central',
      priceMinor: 45000,
      countryCode: market.countryCode,
      currency,
      status: BookingStatus.ACCEPTED,
      acceptedAt: now,
      finalBilling: {
        baseAmountMinor: 45000,
        additionalLaborMinor: 15000,
        partsAmountMinor: 25000,
        totalAmountMinor: 85000,
        proofPhoto: '',
        notes: 'Seed invoice-ready billing.',
      },
      metadata: makeSeedMetadata('booking'),
    },
    'Seed booking'
  );

  const quoteTotalMinor = 85000;
  const quote = await upsertSeeded(
    JobQuote,
    { bookingId: booking._id, 'metadata.seedKey': seedKey },
    {
      bookingId: booking._id,
      customerId: customer._id,
      technicianId: technicianUser._id,
      countryCode: market.countryCode,
      currency,
      status: QuoteStatus.SENT_TO_CLIENT,
      lineItems: [
        {
          type: QuoteLineItemType.CALLOUT,
          label: 'Seed callout',
          quantity: 1,
          unitAmountMinor: 45000,
          totalAmountMinor: 45000,
          notes: 'Seed test item',
        },
        {
          type: QuoteLineItemType.LABOR,
          label: 'Seed labor',
          quantity: 1,
          unitAmountMinor: 15000,
          totalAmountMinor: 15000,
          notes: 'Seed test item',
        },
        {
          type: QuoteLineItemType.PART,
          label: 'Seed replacement part',
          quantity: 1,
          unitAmountMinor: 25000,
          totalAmountMinor: 25000,
          notes: 'Seed test item',
        },
      ],
      subtotalAmountMinor: quoteTotalMinor,
      discountAmountMinor: 0,
      totalAmountMinor: quoteTotalMinor,
      technicianNotes: 'Seed quote for staging integration tests.',
      sentAt: now,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      metadata: makeSeedMetadata('quote'),
    },
    'Seed quote'
  );

  const platformCommissionBps = 1500;
  const platformCommissionAmountMinor = Math.round(quoteTotalMinor * platformCommissionBps / 10000);
  const technicianNetAmountMinor = quoteTotalMinor - platformCommissionAmountMinor;

  const invoice = await upsertSeeded(
    Invoice,
    { invoiceNumber: `SEED-${seedKey}` },
    {
      invoiceNumber: `SEED-${seedKey}`,
      bookingId: booking._id,
      customerId: customer._id,
      technicianId: technicianUser._id,
      countryCode: market.countryCode,
      currency,
      baseAmountMinor: 45000,
      additionalLaborMinor: 15000,
      partsAmountMinor: 25000,
      totalAmountMinor: quoteTotalMinor,
      platformCommissionBps,
      platformCommissionAmountMinor,
      technicianNetAmountMinor,
      paymentGateway: 'seed',
      paymentReference: `seed-payment-${seedKey}`,
      status: InvoiceStatus.UNPAID,
      metadata: makeSeedMetadata('invoice'),
    },
    'Seed invoice'
  );

  const wallet = await upsertSeeded(
    Wallet,
    { technicianId: technicianUser._id },
    {
      technicianId: technicianUser._id,
      countryCode: market.countryCode,
      currency,
      availableBalanceMinor: 50000,
      pendingBalanceMinor: technicianNetAmountMinor,
      totalEarnedMinor: 382500,
      totalWithdrawnMinor: 0,
      lastTransactionAt: now,
    },
    `Seed wallet for ${emails.technician}`,
    { skipOwnershipCheck: true }
  );

  const walletTransaction = await upsertSeeded(
    WalletTransaction,
    { externalReference: `seed-wallet-${seedKey}` },
    {
      type: WalletTransactionType.TECHNICIAN_EARNING_PENDING,
      status: WalletTransactionStatus.POSTED,
      bookingId: booking._id,
      invoiceId: invoice._id,
      customerId: customer._id,
      technicianId: technicianUser._id,
      countryCode: market.countryCode,
      currency,
      amountMinor: technicianNetAmountMinor,
      externalReference: `seed-wallet-${seedKey}`,
      description: 'Seed pending technician earning for staging integration tests.',
      metadata: makeSeedMetadata('wallet-transaction'),
    },
    'Seed wallet transaction'
  );

  const marketSetting = await upsertSeeded(
    MarketSetting,
    { 'identity.countryCode': market.countryCode },
    {
      identity: {
        countryCode: market.countryCode,
        countryName: market.countryName,
        currency,
        locale: market.locale,
        status: MarketStatus.ACTIVE,
        enabled: true,
      },
      pricing: {
        defaultCalloutFeeMinor: Math.round(market.defaultCalloutFee * 100),
        platformCommissionBps,
        taxLabel: market.taxLabel,
      },
      coverage: {
        supportedCities: ['Lusaka'],
        serviceCategories: [
          { serviceKey: 'appliance_repair', label: 'Appliance Repair', status: MarketStatus.ACTIVE },
          { serviceKey: 'managed_collection', label: 'Managed Collection Services', status: MarketStatus.COMING_SOON },
        ],
        cityServiceAvailability: [
          {
            city: 'Lusaka',
            status: MarketStatus.ACTIVE,
            services: [
              { serviceKey: 'appliance_repair', label: 'Appliance Repair', status: MarketStatus.ACTIVE },
              { serviceKey: 'managed_collection', label: 'Managed Collection Services', status: MarketStatus.COMING_SOON },
            ],
            areas: [
              {
                name: 'Lusaka Central',
                status: MarketStatus.ACTIVE,
                services: [
                  { serviceKey: 'appliance_repair', label: 'Appliance Repair', status: MarketStatus.ACTIVE },
                  { serviceKey: 'managed_collection', label: 'Managed Collection Services', status: MarketStatus.COMING_SOON },
                ],
              },
            ],
          },
        ],
      },
      payments: {
        paymentProviders: market.paymentProviders,
        providerSettings: market.paymentProviders.map((provider, index) => ({
          provider,
          status: index === 0 ? PaymentProviderStatus.TESTING : PaymentProviderStatus.FALLBACK,
          methods: ['card'],
          priority: index + 1,
          payoutEnabled: true,
          configReference: `${provider}_STAGING_CONFIG_REF`,
        })),
      },
      support: {
        email: 'seed-support@myfixer.test',
        phone: '+260970000000',
        whatsapp: '+260970000000',
        escalationEmail: 'seed-escalation@myfixer.test',
      },
      audit: {
        updatedBy: admin._id,
        changeHistory: [
          {
            changedBy: admin._id,
            changedAt: now,
            section: 'seed',
            action: 'staging.seed.upsert',
            after: { seedKey },
          },
        ],
      },
    },
    `Seed market setting ${market.countryCode}`
  );

  console.log('Staging seed completed.');
  console.table([
    { label: 'SUPER_ADMIN', email: admin.email, id: admin._id.toString() },
    { label: 'CUSTOMER', email: customer.email, id: customer._id.toString() },
    { label: 'TECHNICIAN', email: technicianUser.email, id: technicianUser._id.toString() },
    { label: 'TechnicianProfile', email: technicianUser.email, id: technician._id.toString() },
    { label: 'Booking', email: customer.email, id: booking._id.toString() },
    { label: 'Quote', email: technicianUser.email, id: quote._id.toString() },
    { label: 'Invoice', email: customer.email, id: invoice._id.toString() },
    { label: 'Wallet', email: technicianUser.email, id: wallet._id.toString() },
    { label: 'WalletTransaction', email: technicianUser.email, id: walletTransaction._id.toString() },
    { label: 'MarketSetting', email: '', id: marketSetting._id.toString() },
  ]);

  console.log('\nUse these for deeper smoke tests:');
  console.log(`ADMIN_TEST_EMAIL=${emails.admin}`);
  console.log(`CUSTOMER_TEST_EMAIL=${emails.customer}`);
  console.log(`TECHNICIAN_TEST_EMAIL=${emails.technician}`);
  console.log('ADMIN_TEST_PASSWORD/CUSTOMER_TEST_PASSWORD/TECHNICIAN_TEST_PASSWORD should all equal STAGING_SEED_PASSWORD.');
};

let failed = false;

main()
  .catch((error) => {
    failed = true;
    console.error(`Staging seed failed: ${error.message}`);
  })
  .finally(async () => {
    await mongoose.disconnect();
    if (failed) {
      process.exit(1);
    }
  });
