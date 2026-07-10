import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Booking, {
  BookingPaymentStatus,
  BookingStatus,
  InspectionStatus,
  PricingMode,
} from '../src/models/booking.model';
import JobQuote, { QuoteStatus } from '../src/models/quote.model';
import { CurrencyCode } from '../src/config/market.config';
import {
  evaluateWorkStartEligibility,
  InspectionWorkflowError,
  validateInspectionGpsReading,
} from '../src/services/inspection-workflow.service';
import { calculateQuoteTotals, QuoteWorkflowError } from '../src/services/quote-workflow.service';
import { UserRole } from '../src/models/user.model';

const originalFindOne = JobQuote.findOne;

const ids = {
  booking: new mongoose.Types.ObjectId('507f1f77bcf86cd799439101'),
  customer: new mongoose.Types.ObjectId('507f1f77bcf86cd799439102'),
  technician: new mongoose.Types.ObjectId('507f1f77bcf86cd799439103'),
};

const technicianActor = { id: ids.technician.toString(), role: UserRole.TECHNICIAN };
let latestQuote: any = null;

const installQuoteMock = (): void => {
  (JobQuote.findOne as unknown as (filter: Record<string, unknown>) => { sort: () => { lean: () => Promise<any> } }) =
    () => ({
      sort: () => ({
        lean: async () => latestQuote,
      }),
    });
};

const makeBooking = (overrides: Record<string, unknown> = {}) => ({
  _id: ids.booking,
  id: ids.booking.toString(),
  customerId: ids.customer,
  technicianId: ids.technician,
  status: BookingStatus.ARRIVED,
  arrivedAt: new Date(),
  applianceType: 'Fridge repair',
  pricingMode: PricingMode.INSPECTION_AND_QUOTE,
  paymentStatus: BookingPaymentStatus.PENDING,
  inspection: {
    status: InspectionStatus.COMPLETED,
    quoteRequired: true,
  },
  ...overrides,
});

const expectInspectionError = (fn: () => void, code: string): void => {
  assert.throws(fn, (error: unknown) => error instanceof InspectionWorkflowError && error.code === code);
};

const expectQuoteError = (fn: () => void, code: string): void => {
  assert.throws(fn, (error: unknown) => error instanceof QuoteWorkflowError && error.code === code);
};

async function run(): Promise<void> {
  installQuoteMock();

  const totals = calculateQuoteTotals(
    [
      { type: 'CALL_OUT', label: 'Call-out fee', quantity: 1, unitAmountMinor: 45000 },
      { type: 'LABOUR', label: 'Labour', quantity: 2, unitAmountMinor: 12500 },
      { type: 'DISCOUNT', label: 'Courtesy discount', quantity: 1, unitAmountMinor: 5000 },
    ],
    CurrencyCode.ZAR
  );
  assert.equal(totals.subtotalAmountMinor, 70000);
  assert.equal(totals.discountAmountMinor, 5000);
  assert.equal(totals.totalAmountMinor, 65000);
  assert.equal(totals.lineItems[0].type, 'CALL_OUT');
  assert.equal(totals.lineItems[1].type, 'LABOUR');
  assert.equal(totals.lineItems[2].totalAmountMinor, -5000);

  expectQuoteError(
    () => calculateQuoteTotals([{ type: 'PART', label: 'Relay', quantity: 0, unitAmountMinor: 1000 }], CurrencyCode.ZAR),
    'INVALID_LINE_ITEM_QUANTITY'
  );
  expectQuoteError(
    () => calculateQuoteTotals([{ type: 'PART', label: 'Relay', quantity: 1, unitAmountMinor: -1000 }], CurrencyCode.ZAR),
    'INVALID_LINE_ITEM_AMOUNT'
  );

  validateInspectionGpsReading({
    latitude: -25.8603,
    longitude: 28.1878,
    accuracyMeters: 18,
    recordedAt: new Date(),
  });
  expectInspectionError(
    () => validateInspectionGpsReading({ latitude: -91, longitude: 28.1878, accuracyMeters: 18, recordedAt: new Date() }),
    'INVALID_LATITUDE'
  );
  expectInspectionError(
    () => validateInspectionGpsReading({ latitude: -25.8603, longitude: 28.1878, accuracyMeters: 0, recordedAt: new Date() }),
    'INVALID_GPS_ACCURACY'
  );

  latestQuote = null;
  let eligibility = await evaluateWorkStartEligibility(makeBooking(), technicianActor);
  assert.equal(eligibility.allowed, false);
  assert.equal(eligibility.reasonCode, 'QUOTE_REQUIRED');

  latestQuote = { status: QuoteStatus.SUBMITTED, expiresAt: new Date(Date.now() + 60_000) };
  eligibility = await evaluateWorkStartEligibility(makeBooking(), technicianActor);
  assert.equal(eligibility.allowed, false);
  assert.equal(eligibility.reasonCode, 'QUOTE_NOT_APPROVED');

  latestQuote = { status: QuoteStatus.SENT_TO_CLIENT, expiresAt: new Date(Date.now() + 60_000) };
  eligibility = await evaluateWorkStartEligibility(makeBooking(), technicianActor);
  assert.equal(eligibility.allowed, false);
  assert.equal(eligibility.reasonCode, 'QUOTE_NOT_APPROVED');

  latestQuote = { status: QuoteStatus.APPROVED, expiresAt: new Date(Date.now() - 60_000) };
  eligibility = await evaluateWorkStartEligibility(makeBooking(), technicianActor);
  assert.equal(eligibility.allowed, false);
  assert.equal(eligibility.reasonCode, 'QUOTE_EXPIRED');

  latestQuote = { status: QuoteStatus.APPROVED, expiresAt: new Date(Date.now() + 60_000) };
  eligibility = await evaluateWorkStartEligibility(makeBooking(), technicianActor);
  assert.equal(eligibility.allowed, false);
  assert.equal(eligibility.reasonCode, 'PAYMENT_NOT_SECURED');

  eligibility = await evaluateWorkStartEligibility(
    makeBooking({ paymentStatus: BookingPaymentStatus.SECURED }),
    technicianActor
  );
  assert.equal(eligibility.allowed, true);

  latestQuote = null;
  eligibility = await evaluateWorkStartEligibility(
    makeBooking({
      pricingMode: PricingMode.FIXED_PRICE,
      paymentStatus: BookingPaymentStatus.SECURED,
      inspection: { status: InspectionStatus.NOT_REQUIRED, quoteRequired: false },
    }),
    technicianActor
  );
  assert.equal(eligibility.allowed, true);

  eligibility = await evaluateWorkStartEligibility(
    makeBooking({ technicianId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439199') }),
    technicianActor
  );
  assert.equal(eligibility.allowed, false);
  assert.equal(eligibility.reasonCode, 'UNAUTHORIZED_TECHNICIAN');

  (JobQuote.findOne as any) = originalFindOne;
  console.log('Inspection and quote workflow tests passed.');
}

run().catch((error) => {
  (JobQuote.findOne as any) = originalFindOne;
  console.error(error);
  process.exit(1);
});
