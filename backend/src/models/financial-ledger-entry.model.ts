import mongoose, { Document, Schema } from 'mongoose';

export enum FinancialLedgerEntryType {
  BOOKING_CALLOUT_CHARGE_CREATED = 'BOOKING_CALLOUT_CHARGE_CREATED',
  QUOTE_SUBMITTED = 'QUOTE_SUBMITTED',
  QUOTE_APPROVED = 'QUOTE_APPROVED',
  QUOTE_REJECTED = 'QUOTE_REJECTED',
  REPAIR_BALANCE_CHARGE_CREATED = 'REPAIR_BALANCE_CHARGE_CREATED',
  PAYMENT_SUCCEEDED = 'PAYMENT_SUCCEEDED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  PAYMENT_REVERSED = 'PAYMENT_REVERSED',
  CALLOUT_CREDIT_APPLIED = 'CALLOUT_CREDIT_APPLIED',
  INVOICE_ISSUED = 'INVOICE_ISSUED',
  PROVIDER_EARNING_RECOGNIZED = 'PROVIDER_EARNING_RECOGNIZED',
  PLATFORM_REVENUE_RECOGNIZED = 'PLATFORM_REVENUE_RECOGNIZED',
  SETTLEMENT_CREATED = 'SETTLEMENT_CREATED',
  SETTLEMENT_PAID = 'SETTLEMENT_PAID',
  SETTLEMENT_ON_HOLD = 'SETTLEMENT_ON_HOLD',
  SETTLEMENT_PAYOUT_FAILED = 'SETTLEMENT_PAYOUT_FAILED',
  SETTLEMENT_REVERSED = 'SETTLEMENT_REVERSED',
}

export enum FinancialLedgerEntryStatus {
  POSTED = 'POSTED',
  VOIDED = 'VOIDED',
}

export interface IFinancialLedgerEntry extends Document {
  idempotencyKey: string;
  entryType: FinancialLedgerEntryType;
  status: FinancialLedgerEntryStatus;
  bookingId?: mongoose.Types.ObjectId | null;
  quoteId?: mongoose.Types.ObjectId | null;
  invoiceId?: mongoose.Types.ObjectId | null;
  paymentTransactionId?: mongoose.Types.ObjectId | null;
  settlementId?: mongoose.Types.ObjectId | null;
  customerId?: mongoose.Types.ObjectId | null;
  technicianId?: mongoose.Types.ObjectId | null;
  countryCode: string;
  currency: string;
  amountMinor: number;
  direction: 'DEBIT' | 'CREDIT' | 'MEMO';
  component: 'CALLOUT' | 'LABOUR' | 'PARTS' | 'ADDITIONAL_SERVICES' | 'SURCHARGE' | 'PLATFORM_FEE' | 'TAX' | 'DISCOUNT' | 'CREDIT' | 'PAYMENT' | 'PAYOUT' | 'MEMO';
  description: string;
  occurredAt: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const FinancialLedgerEntrySchema = new Schema<IFinancialLedgerEntry>(
  {
    idempotencyKey: { type: String, required: true, unique: true, trim: true, index: true },
    entryType: { type: String, enum: Object.values(FinancialLedgerEntryType), required: true, index: true },
    status: { type: String, enum: Object.values(FinancialLedgerEntryStatus), default: FinancialLedgerEntryStatus.POSTED, index: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', default: null, index: true },
    quoteId: { type: Schema.Types.ObjectId, ref: 'JobQuote', default: null, index: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', default: null, index: true },
    paymentTransactionId: { type: Schema.Types.ObjectId, ref: 'PaymentTransaction', default: null, index: true },
    settlementId: { type: Schema.Types.ObjectId, ref: 'ProviderSettlement', default: null, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    technicianId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    countryCode: {
      type: String,
      uppercase: true,
      trim: true,
      validate: { validator: (value: string) => !value || /^[A-Z]{2}$/.test(value), message: 'Invalid ISO country code.' },
      default: '',
      index: true,
    },
    currency: {
      type: String,
      uppercase: true,
      trim: true,
      validate: { validator: (value: string) => !value || /^[A-Z]{3}$/.test(value), message: 'Invalid currency code.' },
      default: '',
      index: true,
    },
    amountMinor: { type: Number, required: true, default: 0 },
    direction: { type: String, enum: ['DEBIT', 'CREDIT', 'MEMO'], required: true, default: 'MEMO', index: true },
    component: {
      type: String,
      enum: ['CALLOUT', 'LABOUR', 'PARTS', 'ADDITIONAL_SERVICES', 'SURCHARGE', 'PLATFORM_FEE', 'TAX', 'DISCOUNT', 'CREDIT', 'PAYMENT', 'PAYOUT', 'MEMO'],
      required: true,
      default: 'MEMO',
      index: true,
    },
    description: { type: String, required: true, trim: true, maxlength: 500 },
    occurredAt: { type: Date, required: true, default: Date.now, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

FinancialLedgerEntrySchema.index({ bookingId: 1, occurredAt: -1 });
FinancialLedgerEntrySchema.index({ countryCode: 1, occurredAt: -1 });
FinancialLedgerEntrySchema.index({ customerId: 1, occurredAt: -1 });
FinancialLedgerEntrySchema.index({ technicianId: 1, occurredAt: -1 });

const FinancialLedgerEntry =
  (mongoose.models.FinancialLedgerEntry as mongoose.Model<IFinancialLedgerEntry> | undefined) ??
  mongoose.model<IFinancialLedgerEntry>('FinancialLedgerEntry', FinancialLedgerEntrySchema);

export default FinancialLedgerEntry;
