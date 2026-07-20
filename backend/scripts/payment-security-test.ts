import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Booking, {
  BookingPaymentStatus,
  BookingStatus,
  InspectionStatus,
  PricingMode,
} from '../src/models/booking.model';
import JobQuote, { QuoteStatus } from '../src/models/quote.model';
import PaymentTransaction, { PaymentProvider, PaymentTransactionStatus } from '../src/models/payment-transaction.model';
import PaymentWebhookEvent from '../src/models/payment-webhook-event.model';
import { CurrencyCode } from '../src/config/market.config';
import MarketSetting, { MarketStatus, PaymentProviderStatus } from '../src/models/market-setting.model';
import {
  PaymentWorkflowError,
  initializeBookingPayment,
  processPaystackWebhookPayload,
  verifyAndSecurePayment,
} from '../src/services/payment-workflow.service';
import { calculatePaystackSignature, verifyPaystackSignature, PaystackService } from '../src/services/paystack.service';
import { UserRole } from '../src/models/user.model';

process.env.PAYSTACK_SECRET_KEY = 'sk_test_unit';
process.env.PAYSTACK_WEBHOOK_SECRET = 'whsec_unit';

const originals = {
  bookingFindById: Booking.findById,
  bookingUpdateOne: Booking.updateOne,
  bookingFindOneAndUpdate: Booking.findOneAndUpdate,
  quoteFindOne: JobQuote.findOne,
  txFindOne: PaymentTransaction.findOne,
  txCreate: PaymentTransaction.create,
  txFindOneAndUpdate: PaymentTransaction.findOneAndUpdate,
  txFindById: PaymentTransaction.findById,
  webhookCreate: PaymentWebhookEvent.create,
  webhookFindOne: PaymentWebhookEvent.findOne,
  marketFindOne: MarketSetting.findOne,
  paystackInitialize: PaystackService.initializeTransaction,
  paystackVerify: PaystackService.verifyTransaction,
};

const ids = {
  booking: new mongoose.Types.ObjectId('507f1f77bcf86cd799439201'),
  customer: new mongoose.Types.ObjectId('507f1f77bcf86cd799439202'),
  otherCustomer: new mongoose.Types.ObjectId('507f1f77bcf86cd799439203'),
  technician: new mongoose.Types.ObjectId('507f1f77bcf86cd799439204'),
  quote: new mongoose.Types.ObjectId('507f1f77bcf86cd799439205'),
  tx: new mongoose.Types.ObjectId('507f1f77bcf86cd799439206'),
};

let activeBooking: any;
let activeQuote: any;
let activeTransaction: any;
let bookingUpdate: any = null;
let providerVerification: any;
let duplicateWebhook = false;
let activeMarket: any;

const makeBooking = (overrides: Record<string, unknown> = {}) => ({
  _id: ids.booking,
  id: ids.booking.toString(),
  customerId: ids.customer,
  technicianId: ids.technician,
  customerEmail: 'client@example.com',
  customerName: 'Client',
  applianceType: 'Fridge repair',
  status: BookingStatus.ARRIVED,
  pricingMode: PricingMode.INSPECTION_AND_QUOTE,
  paymentStatus: BookingPaymentStatus.PENDING,
  countryCode: 'ZA',
  currency: CurrencyCode.ZAR,
  priceMinor: 45000,
  inspection: { status: InspectionStatus.COMPLETED, quoteRequired: true },
  set(path: string, value: unknown) {
    const parts = path.split('.');
    let target: any = this;
    while (parts.length > 1) {
      const key = parts.shift()!;
      target[key] = target[key] || {};
      target = target[key];
    }
    target[parts[0]] = value;
  },
  async save() { return this; },
  ...overrides,
});

const makeQuote = (overrides: Record<string, unknown> = {}) => ({
  _id: ids.quote,
  id: ids.quote.toString(),
  bookingId: ids.booking,
  status: QuoteStatus.APPROVED,
  isCurrent: true,
  totalAmountMinor: 65000,
  currency: CurrencyCode.ZAR,
  expiresAt: new Date(Date.now() + 60_000),
  ...overrides,
});

const makeTransaction = (overrides: Record<string, unknown> = {}) => ({
  _id: ids.tx,
  id: ids.tx.toString(),
  provider: PaymentProvider.PAYSTACK,
  reference: 'mfx_ref_unit',
  bookingId: ids.booking,
  quoteId: ids.quote,
  customerId: ids.customer,
  technicianId: ids.technician,
  amountMinor: 65000,
  currency: CurrencyCode.ZAR,
  status: PaymentTransactionStatus.INITIALIZED,
  metadata: {},
  async save() { return this; },
  ...overrides,
});

const makeMarket = (overrides: Record<string, unknown> = {}) => ({
  identity: {
    countryCode: 'ZA',
    countryName: 'South Africa',
    currency: CurrencyCode.ZAR,
    locale: 'en-ZA',
    status: MarketStatus.ACTIVE,
  },
  payments: {
    providerSettings: [
      {
        provider: 'PAYSTACK',
        status: PaymentProviderStatus.ACTIVE,
        methods: ['CARD', 'INSTANT_EFT'],
        priority: 1,
        payoutEnabled: true,
        configReference: 'paystack-test',
      },
    ],
  },
  pricing: {
    platformCommissionBps: 1500,
  },
  deletionLock: { locked: false },
  ...overrides,
});

const installMocks = () => {
  (MarketSetting.findOne as any) = () => ({
    select: () => ({
      lean: async () => activeMarket,
    }),
    lean: async () => activeMarket,
    then: (resolve: (value: unknown) => void) => resolve(activeMarket),
  });
  (Booking.findById as any) = async () => activeBooking;
  (Booking.updateOne as any) = async (_filter: any, update: any) => {
    bookingUpdate = update;
    if (update?.$set?.paymentStatus) activeBooking.paymentStatus = update.$set.paymentStatus;
    return { modifiedCount: 1 };
  };
  (Booking.findOneAndUpdate as any) = async (_filter: any, update: any) => {
    bookingUpdate = update;
    activeBooking.paymentStatus = update.$set.paymentStatus;
    activeBooking.paymentSecurity = update.$set.paymentSecurity;
    return activeBooking;
  };
  (JobQuote.findOne as any) = (filter: any) => ({
    sort: async () => {
      if (!activeQuote) return null;
      if (filter?.status && activeQuote.status !== filter.status) return null;
      if (filter?._id && String(filter._id) !== String(activeQuote._id)) return null;
      return activeQuote;
    },
  });
  (PaymentTransaction.findOne as any) = async (filter: any) => {
    if (filter?.idempotencyKey && activeTransaction?.idempotencyKey !== filter.idempotencyKey) return null;
    return activeTransaction;
  };
  (PaymentTransaction.create as any) = async (payload: any) => {
    activeTransaction = makeTransaction({ ...payload, _id: ids.tx, id: ids.tx.toString() });
    return activeTransaction;
  };
  (PaymentTransaction.findOneAndUpdate as any) = async (_filter: any, update: any) => {
    activeTransaction = { ...activeTransaction, ...update.$set, status: update.$set.status };
    return activeTransaction;
  };
  (PaymentTransaction.findById as any) = async () => activeTransaction;
  (PaymentWebhookEvent.create as any) = async (payload: any) => {
    if (duplicateWebhook) {
      const error: any = new Error('duplicate');
      error.code = 11000;
      throw error;
    }
    return { ...payload, id: 'evt_unit', async save() { return this; } };
  };
  (PaymentWebhookEvent.findOne as any) = async () => ({ processed: true, async save() { return this; } });
  (PaystackService.initializeTransaction as any) = async (input: any) => ({
    status: true,
    data: {
      authorization_url: `https://checkout.paystack.test/${input.reference}`,
      access_code: 'access_unit',
      reference: input.reference,
    },
  });
  (PaystackService.verifyTransaction as any) = async () => providerVerification;
};

const restore = () => {
  (Booking.findById as any) = originals.bookingFindById;
  (Booking.updateOne as any) = originals.bookingUpdateOne;
  (Booking.findOneAndUpdate as any) = originals.bookingFindOneAndUpdate;
  (JobQuote.findOne as any) = originals.quoteFindOne;
  (PaymentTransaction.findOne as any) = originals.txFindOne;
  (PaymentTransaction.create as any) = originals.txCreate;
  (PaymentTransaction.findOneAndUpdate as any) = originals.txFindOneAndUpdate;
  (PaymentTransaction.findById as any) = originals.txFindById;
  (PaymentWebhookEvent.create as any) = originals.webhookCreate;
  (PaymentWebhookEvent.findOne as any) = originals.webhookFindOne;
  (MarketSetting.findOne as any) = originals.marketFindOne;
  (PaystackService.initializeTransaction as any) = originals.paystackInitialize;
  (PaystackService.verifyTransaction as any) = originals.paystackVerify;
};

const expectPaymentError = async (promise: Promise<unknown>, code: string) => {
  await assert.rejects(promise, (error: unknown) => error instanceof PaymentWorkflowError && error.code === code);
};

async function run(): Promise<void> {
  installMocks();
  activeMarket = makeMarket();

  const raw = Buffer.from(JSON.stringify({ event: 'charge.success', data: { reference: 'mfx_ref_unit' } }));
  const signature = calculatePaystackSignature(raw, 'whsec_unit');
  assert.equal(verifyPaystackSignature(raw, signature), true);
  assert.equal(verifyPaystackSignature(Buffer.from(raw.toString().replace('success', 'failed')), signature), false);

  activeBooking = makeBooking();
  activeQuote = makeQuote();
  activeTransaction = null;
  const init = await initializeBookingPayment(
    { bookingId: ids.booking.toString(), quoteId: ids.quote.toString(), idempotencyKey: 'pay_once' },
    { id: ids.customer.toString(), role: UserRole.CUSTOMER }
  );
  assert.equal(init.reused, false);
  assert.equal(init.response.amountMinor, 65000);
  assert.equal(activeTransaction.idempotencyKey, 'pay_once');
  assert.equal(bookingUpdate.$set.paymentStatus, BookingPaymentStatus.PENDING);

  const reused = await initializeBookingPayment(
    { bookingId: ids.booking.toString(), quoteId: ids.quote.toString(), idempotencyKey: 'pay_once' },
    { id: ids.customer.toString(), role: UserRole.CUSTOMER }
  );
  assert.equal(reused.reused, true);
  assert.equal(reused.transaction.reference, activeTransaction.reference);

  await expectPaymentError(
    initializeBookingPayment(
      { bookingId: ids.booking.toString(), quoteId: ids.quote.toString(), idempotencyKey: 'other' },
      { id: ids.otherCustomer.toString(), role: UserRole.CUSTOMER }
    ),
    'PAYMENT_UNAUTHORIZED'
  );

  activeQuote = makeQuote();
  activeMarket = makeMarket({
    identity: {
      countryCode: 'ZA',
      countryName: 'South Africa',
      currency: CurrencyCode.ZAR,
      locale: 'en-ZA',
      status: MarketStatus.PAUSED,
    },
  });
  await assert.rejects(
    initializeBookingPayment(
      { bookingId: ids.booking.toString(), quoteId: ids.quote.toString(), idempotencyKey: 'paused_market' },
      { id: ids.customer.toString(), role: UserRole.CUSTOMER }
    ),
    (error: unknown) => error instanceof Error && (error as any).code === 'MARKET_NOT_ACTIVE'
  );

  activeMarket = makeMarket({
    payments: {
      providerSettings: [
        {
          provider: 'PAYSTACK',
          status: PaymentProviderStatus.DISABLED,
          methods: ['CARD'],
          priority: 1,
          payoutEnabled: true,
          configReference: '',
        },
      ],
    },
  });
  await assert.rejects(
    initializeBookingPayment(
      { bookingId: ids.booking.toString(), quoteId: ids.quote.toString(), idempotencyKey: 'disabled_provider' },
      { id: ids.customer.toString(), role: UserRole.CUSTOMER }
    ),
    (error: unknown) => error instanceof Error && (error as any).code === 'PAYMENT_PROVIDER_INACTIVE'
  );

  activeMarket = makeMarket();
  activeQuote = makeQuote({ status: QuoteStatus.REJECTED });
  await expectPaymentError(
    initializeBookingPayment(
      { bookingId: ids.booking.toString(), quoteId: ids.quote.toString(), idempotencyKey: 'rejected' },
      { id: ids.customer.toString(), role: UserRole.CUSTOMER }
    ),
    'APPROVED_QUOTE_REQUIRED'
  );

  activeBooking = makeBooking({ pricingMode: PricingMode.FIXED_PRICE, inspection: { status: InspectionStatus.NOT_REQUIRED, quoteRequired: false }, priceMinor: 45000 });
  activeQuote = null;
  activeTransaction = null;
  const fixed = await initializeBookingPayment(
    { bookingId: ids.booking.toString(), idempotencyKey: 'fixed_once' },
    { id: ids.customer.toString(), role: UserRole.CUSTOMER }
  );
  assert.equal(fixed.response.amountMinor, 45000);

  activeBooking = makeBooking({ pricingMode: PricingMode.FIXED_PRICE, inspection: { status: InspectionStatus.NOT_REQUIRED, quoteRequired: false } });
  activeTransaction = makeTransaction({ status: PaymentTransactionStatus.PENDING, quoteId: null });
  providerVerification = {
    status: true,
    data: {
      id: 123,
      status: 'success',
      reference: activeTransaction.reference,
      amount: activeTransaction.amountMinor,
      currency: activeTransaction.currency,
      paid_at: new Date().toISOString(),
      customer: { email: 'client@example.com' },
    },
  };
  const verified = await verifyAndSecurePayment(activeTransaction.reference);
  assert.equal(verified.transaction.status, PaymentTransactionStatus.SUCCESS);
  assert.equal(activeBooking.paymentStatus, BookingPaymentStatus.SECURED);
  assert.equal(activeBooking.paymentSecurity.reference, activeTransaction.reference);
  assert.equal(activeBooking.status, BookingStatus.ARRIVED);

  activeBooking = makeBooking();
  activeTransaction = makeTransaction({ status: PaymentTransactionStatus.PENDING });
  providerVerification = {
    status: true,
    data: {
      status: 'success',
      reference: activeTransaction.reference,
      amount: activeTransaction.amountMinor + 1,
      currency: activeTransaction.currency,
    },
  };
  const mismatch = await verifyAndSecurePayment(activeTransaction.reference);
  assert.equal(mismatch.transaction.status, PaymentTransactionStatus.UNDER_REVIEW);
  assert.equal(activeBooking.paymentStatus, BookingPaymentStatus.UNDER_REVIEW);

  activeTransaction = makeTransaction({ status: PaymentTransactionStatus.PENDING });
  providerVerification = {
    status: true,
    data: {
      status: 'failed',
      reference: activeTransaction.reference,
      amount: activeTransaction.amountMinor,
      currency: activeTransaction.currency,
    },
  };
  const failed = await verifyAndSecurePayment(activeTransaction.reference);
  assert.equal(failed.transaction.status, PaymentTransactionStatus.FAILED);

  duplicateWebhook = false;
  activeTransaction = makeTransaction({ status: PaymentTransactionStatus.PENDING });
  providerVerification.data.status = 'failed';
  const webhook = await processPaystackWebhookPayload(
    { event: 'charge.failed', data: { reference: activeTransaction.reference, status: 'failed' } },
    Buffer.from('{"event":"charge.failed"}')
  );
  assert.equal(webhook.processed, true);
  assert.equal(activeTransaction.status, PaymentTransactionStatus.FAILED);

  duplicateWebhook = true;
  const duplicate = await processPaystackWebhookPayload(
    { event: 'charge.failed', data: { reference: activeTransaction.reference, status: 'failed' } },
    Buffer.from('{"event":"charge.failed"}')
  );
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.processed, true);

  restore();
  console.log('Payment security tests passed.');
}

run().catch((error) => {
  restore();
  console.error(error);
  process.exit(1);
});
