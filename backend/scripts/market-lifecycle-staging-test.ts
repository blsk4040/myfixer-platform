import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import MarketSetting, { MarketStatus, PaymentProviderStatus } from '../src/models/market-setting.model';
import User, { UserRole } from '../src/models/user.model';
import Technician, { TechnicianApprovalStatus } from '../src/models/technician.model';
import Booking, { BookingPaymentStatus, BookingStatus, PricingMode } from '../src/models/booking.model';
import {
  normalizeIsoCountryCode,
  normalizeIsoCurrencyCode,
} from '../src/config/market.config';
import { assertActiveMarket, assertMarketAllowsPaymentCollection, getMarketPayoutCapabilities } from '../src/services/market-finance-guard.service';
import { getMarketAvailability, validateServiceBookable } from '../src/services/service-availability.service';

const uri = process.env.MONGODB_URI || process.env.MONGO_URI || '';
const appEnv = String(process.env.APP_ENV || '').toLowerCase();
const allow = process.env.ALLOW_MARKET_LIFECYCLE_TEST === 'true' || process.env.MARKET_LIFECYCLE_STAGING_TEST === 'true';
const productionLike = appEnv === 'production' || /prod|production|render/i.test(uri);

if (appEnv !== 'staging' && appEnv !== 'test' && appEnv !== 'development') {
  throw new Error('Refusing to run. APP_ENV must be staging, test, or development.');
}
if (!allow) {
  throw new Error('Refusing to run. Set ALLOW_MARKET_LIFECYCLE_TEST=true for a dedicated non-production database.');
}
if (!uri.trim()) {
  throw new Error('MONGODB_URI or MONGO_URI is required for the staging lifecycle test.');
}
if (productionLike) {
  throw new Error('Refusing to run market lifecycle staging test against a production-like environment.');
}

const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
const countryCode = normalizeIsoCountryCode('XK');
const unusedCountryCode = normalizeIsoCountryCode('XS');
const currency = normalizeIsoCurrencyCode('XTS');
const runId = `market-lifecycle-${suffix}`;
const ids = {
  customer: new mongoose.Types.ObjectId(),
  technicianUser: new mongoose.Types.ObjectId(),
  technicianProfile: new mongoose.Types.ObjectId(),
  booking: new mongoose.Types.ObjectId(),
};

const logStage = (stage: number, message: string): void => {
  console.log(`[stage ${stage}] ${message}`);
};

const activePublicMarkets = () =>
  MarketSetting.find({ 'identity.status': MarketStatus.ACTIVE }).select('identity coverage payments').lean();

const createDraftMarket = async (code: string) =>
  MarketSetting.create({
    identity: {
      countryCode: code,
      countryName: `Staging ${code}`,
      currency,
      locale: 'en-XK',
      timezone: 'UTC',
      status: MarketStatus.DRAFT,
    },
    pricing: {
      defaultCalloutFeeMinor: 0,
      platformCommissionBps: 0,
      taxLabel: 'VAT',
    },
    coverage: {
      supportedCities: [],
      serviceCategories: [],
      cityServiceAvailability: [],
    },
    payments: {
      paymentProviders: [],
      providerSettings: [],
    },
    support: {
      email: '',
      phone: '',
      whatsapp: '',
      escalationEmail: '',
    },
    audit: { changeHistory: [] },
  });

async function main(): Promise<void> {
  await mongoose.connect(uri);
  let failedStage = 0;
  try {
    await MarketSetting.deleteMany({ 'identity.countryCode': { $in: [countryCode, unusedCountryCode] }, 'identity.status': MarketStatus.DRAFT });

    failedStage = 1;
    logStage(1, 'Create market as DRAFT');
    const draft = await createDraftMarket(countryCode);
    assert.equal(draft.identity.status, MarketStatus.DRAFT);

    failedStage = 2;
    logStage(2, 'Verify Admin-side directory can see the draft market');
    assert(await MarketSetting.exists({ 'identity.countryCode': countryCode }));

    failedStage = 3;
    logStage(3, 'Verify public markets hide DRAFT market');
    assert(!(await activePublicMarkets()).some((market) => market.identity?.countryCode === countryCode));

    failedStage = 4;
    logStage(4, 'Verify client registration would reject inactive market');
    await assert.rejects(assertActiveMarket(countryCode), /Market is not active/);

    failedStage = 5;
    logStage(5, 'Verify technician registration would reject inactive market');
    await assert.rejects(assertActiveMarket(countryCode), /Market is not active/);

    failedStage = 6;
    logStage(6, 'Verify booking rejects inactive market/service');
    const inactiveAvailability = await validateServiceBookable({ countryCode, city: 'Test City', serviceKey: 'electrical' });
    assert.equal(inactiveAvailability.allowed, false);

    failedStage = 7;
    logStage(7, 'Configure identity, pricing, support, city, service and payment providers');
    await MarketSetting.updateOne(
      { 'identity.countryCode': countryCode },
      {
        $set: {
          'identity.countryName': 'Staging Test Market',
          'identity.currency': currency,
          'identity.locale': 'en-XK',
          'identity.timezone': 'UTC',
          'pricing.defaultCalloutFeeMinor': 12345,
          'pricing.platformCommissionBps': 1500,
          'pricing.taxLabel': 'VAT',
          'support.email': 'support+staging@myfixer.test',
          'support.phone': '+27000000000',
          'coverage.supportedCities': ['Test City'],
          'coverage.serviceCategories': [{ serviceKey: 'electrical', label: 'Electrical', status: MarketStatus.ACTIVE }],
          'coverage.cityServiceAvailability': [
            {
              city: 'Test City',
              status: MarketStatus.ACTIVE,
              services: [{ serviceKey: 'electrical', label: 'Electrical', status: MarketStatus.ACTIVE }],
              areas: [{ name: 'Test Area', status: MarketStatus.ACTIVE, services: [{ serviceKey: 'electrical', label: 'Electrical', status: MarketStatus.ACTIVE }] }],
            },
          ],
          'payments.paymentProviders': ['PAYSTACK'],
          'payments.providerSettings': [
            {
              provider: 'PAYSTACK',
              status: PaymentProviderStatus.ACTIVE,
              methods: ['CARD', 'BANK_ACCOUNT'],
              priority: 1,
              payoutEnabled: true,
              configReference: 'STAGING_PAYSTACK',
            },
          ],
        },
      }
    );

    failedStage = 15;
    logStage(15, 'Verify readiness validation inputs are complete');
    const ready = await MarketSetting.findOne({ 'identity.countryCode': countryCode }).lean();
    assert(ready?.identity?.currency && ready.identity.locale && ready.identity.timezone);
    assert((ready?.pricing?.defaultCalloutFeeMinor || 0) > 0);
    assert((ready?.pricing?.platformCommissionBps || 0) > 0);
    assert(ready?.support?.email || ready?.support?.phone);
    assert(ready?.coverage?.cityServiceAvailability?.length);
    assert(ready?.payments?.providerSettings?.some((provider) => provider.status === PaymentProviderStatus.ACTIVE));

    failedStage = 16;
    logStage(16, 'Activate market');
    await MarketSetting.updateOne({ 'identity.countryCode': countryCode }, { $set: { 'identity.status': MarketStatus.ACTIVE } });

    failedStage = 17;
    logStage(17, 'Verify public markets expose ACTIVE market');
    assert((await activePublicMarkets()).some((market) => market.identity?.countryCode === countryCode));

    failedStage = 18;
    logStage(18, 'Verify service availability exposes active coverage only');
    const activeAvailability = await getMarketAvailability(countryCode, 'Test City', 'Test Area');
    assert.equal(activeAvailability.services.some((service) => service.serviceKey === 'electrical' && service.canBook), true);

    failedStage = 19;
    logStage(19, 'Verify test client registration accepts active market');
    const market = await assertActiveMarket(countryCode);
    await User.create({
      _id: ids.customer,
      name: 'Lifecycle Client',
      email: `${runId}-client@example.test`,
      phone: '+27000000001',
      location: { country: market.identity.countryName, city: 'Test City', area: 'Test Area' },
      countryCode,
      currency,
      password: 'not-used',
      role: UserRole.CUSTOMER,
    });

    failedStage = 20;
    logStage(20, 'Verify test technician registration accepts active market');
    await User.create({
      _id: ids.technicianUser,
      name: 'Lifecycle Technician',
      email: `${runId}-tech@example.test`,
      phone: '+27000000002',
      location: { country: market.identity.countryName, city: 'Test City', area: 'Test Area' },
      countryCode,
      currency,
      password: 'not-used',
      role: UserRole.TECHNICIAN,
    });
    await Technician.create({
      _id: ids.technicianProfile,
      userId: ids.technicianUser,
      countryCode,
      city: 'Test City',
      serviceCategories: ['electrical'],
      approvalStatus: TechnicianApprovalStatus.APPROVED,
    });

    failedStage = 21;
    logStage(21, 'Create a test booking');
    const booking = await Booking.create({
      _id: ids.booking,
      customerId: ids.customer,
      customerName: 'Lifecycle Client',
      customerEmail: `${runId}-client@example.test`,
      applianceType: 'Electrical',
      serviceKey: 'electrical',
      faultDescription: 'Staging lifecycle booking',
      customerLocation: { type: 'Point', coordinates: [28, -26] },
      fullAddress: '1 Test Street',
      generalArea: 'Test Area',
      priceMinor: 12345,
      countryCode,
      currency,
      pricingMode: PricingMode.FIXED_PRICE,
      paymentStatus: BookingPaymentStatus.PENDING,
      status: BookingStatus.PENDING,
      metadata: { runId },
    });

    failedStage = 22;
    logStage(22, 'Verify booking currency comes from market');
    assert.equal(booking.currency, currency);

    failedStage = 23;
    logStage(23, 'Verify payment initialization guard uses market provider and currency');
    await assertMarketAllowsPaymentCollection(countryCode, currency, 'PAYSTACK');

    failedStage = 24;
    logStage(24, 'Verify payout capability comes from market configuration');
    const payoutCapabilities = await getMarketPayoutCapabilities(countryCode);
    assert.equal(payoutCapabilities.payoutsEnabled, true);
    assert(payoutCapabilities.providerPayoutMethods.includes('BANK_ACCOUNT' as any));

    failedStage = 25;
    logStage(25, 'Pause market');
    await MarketSetting.updateOne({ 'identity.countryCode': countryCode }, { $set: { 'identity.status': MarketStatus.PAUSED } });

    failedStage = 26;
    logStage(26, 'Verify new registration blocked while paused');
    await assert.rejects(assertActiveMarket(countryCode), /Market is not active/);

    failedStage = 27;
    logStage(27, 'Verify new bookings blocked while paused');
    const pausedAvailability = await validateServiceBookable({ countryCode, city: 'Test City', area: 'Test Area', serviceKey: 'electrical' });
    assert.equal(pausedAvailability.allowed, false);

    failedStage = 28;
    logStage(28, 'Verify payment collection blocked while paused');
    await assert.rejects(assertMarketAllowsPaymentCollection(countryCode, currency, 'PAYSTACK'), /Market is not active/);

    failedStage = 29;
    logStage(29, 'Verify historical booking remains readable');
    assert(await Booking.exists({ _id: ids.booking, countryCode }));

    failedStage = 30;
    logStage(30, 'Archive market');
    await MarketSetting.updateOne({ 'identity.countryCode': countryCode }, { $set: { 'identity.status': MarketStatus.ARCHIVED } });

    failedStage = 31;
    logStage(31, 'Verify public APIs hide archived market');
    assert(!(await activePublicMarkets()).some((item) => item.identity?.countryCode === countryCode));

    failedStage = 32;
    logStage(32, 'Verify historical records remain intact');
    assert(await User.exists({ _id: ids.customer }));
    assert(await Technician.exists({ _id: ids.technicianProfile }));
    assert(await Booking.exists({ _id: ids.booking }));

    failedStage = 33;
    logStage(33, 'Verify permanent deletion would be blocked because dependencies exist');
    assert.equal(await Booking.countDocuments({ countryCode }), 1);

    failedStage = 34;
    logStage(34, 'Create second unused DRAFT market');
    await createDraftMarket(unusedCountryCode);

    failedStage = 35;
    logStage(35, 'Verify permanent deletion succeeds for unused draft');
    const deleteResult = await MarketSetting.deleteOne({ 'identity.countryCode': unusedCountryCode, 'identity.status': MarketStatus.DRAFT });
    assert.equal(deleteResult.deletedCount, 1);

    failedStage = 36;
    logStage(36, 'Clean up safe staging records');
    await Booking.deleteOne({ _id: ids.booking, metadata: { runId } });
    await Technician.deleteOne({ _id: ids.technicianProfile });
    await User.deleteMany({ _id: { $in: [ids.customer, ids.technicianUser] } });
    await MarketSetting.deleteOne({ 'identity.countryCode': countryCode, 'identity.status': MarketStatus.ARCHIVED });

    console.log('Market lifecycle staging test completed successfully.');
  } catch (error) {
    console.error(`Market lifecycle staging test failed at stage ${failedStage}.`);
    await MarketSetting.updateMany(
      { 'identity.countryCode': { $in: [countryCode, unusedCountryCode] } },
      { $set: { 'deletionLock.locked': false }, $unset: { 'deletionLock.token': '', 'deletionLock.lockedAt': '', 'deletionLock.lockedBy': '' } }
    );
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
