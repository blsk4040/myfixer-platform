import mongoose, { Document, Schema } from 'mongoose';
import { CountryCode, CurrencyCode } from '../config/market.config';

export enum ProviderSettlementStatus {
  PENDING_COMPLETION = 'PENDING_COMPLETION',
  AWAITING_CUSTOMER_CONFIRMATION = 'AWAITING_CUSTOMER_CONFIRMATION',
  ON_HOLD = 'ON_HOLD',
  READY_FOR_PAYOUT = 'READY_FOR_PAYOUT',
  APPROVAL_REQUIRED = 'APPROVAL_REQUIRED',
  APPROVED = 'APPROVED',
  PAYOUT_QUEUED = 'PAYOUT_QUEUED',
  PAYOUT_PROCESSING = 'PAYOUT_PROCESSING',
  PAID = 'PAID',
  PAYOUT_FAILED = 'PAYOUT_FAILED',
  REVERSED = 'REVERSED',
  CANCELLED = 'CANCELLED',
  UNDER_REVIEW = 'UNDER_REVIEW',
}

export interface IProviderSettlement extends Document {
  bookingId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  technicianId: mongoose.Types.ObjectId;
  quoteId?: mongoose.Types.ObjectId | null;
  paymentTransactionId?: mongoose.Types.ObjectId | null;
  countryCode: CountryCode;
  currency: CurrencyCode;
  grossAmountMinor: number;
  commissionBps: number;
  commissionAmountMinor: number;
  processingFeeMinor: number;
  netAmountMinor: number;
  status: ProviderSettlementStatus;
  completionConfirmedAt?: Date | null;
  readyForPayoutAt?: Date | null;
  approvedAt?: Date | null;
  approvedBy?: mongoose.Types.ObjectId | null;
  holdReason?: string;
  heldAt?: Date | null;
  heldBy?: mongoose.Types.ObjectId | null;
  releasedFromHoldAt?: Date | null;
  paidAt?: Date | null;
  payoutMethodId?: mongoose.Types.ObjectId | null;
  payoutTransactionId?: mongoose.Types.ObjectId | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const ProviderSettlementSchema = new Schema<IProviderSettlement>(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    technicianId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    quoteId: { type: Schema.Types.ObjectId, ref: 'JobQuote', default: null, index: true },
    paymentTransactionId: { type: Schema.Types.ObjectId, ref: 'PaymentTransaction', default: null, index: true },
    countryCode: { type: String, enum: Object.values(CountryCode), required: true, index: true },
    currency: { type: String, enum: Object.values(CurrencyCode), required: true, index: true },
    grossAmountMinor: { type: Number, required: true, min: 0 },
    commissionBps: { type: Number, required: true, min: 0, max: 10000 },
    commissionAmountMinor: { type: Number, required: true, min: 0 },
    processingFeeMinor: { type: Number, required: true, default: 0, min: 0 },
    netAmountMinor: { type: Number, required: true, min: 0 },
    status: { type: String, enum: Object.values(ProviderSettlementStatus), required: true, index: true },
    completionConfirmedAt: { type: Date, default: null },
    readyForPayoutAt: { type: Date, default: null },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    holdReason: { type: String, default: '', trim: true, maxlength: 1000 },
    heldAt: { type: Date, default: null },
    heldBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    releasedFromHoldAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    payoutMethodId: { type: Schema.Types.ObjectId, ref: 'ProviderPayoutMethod', default: null },
    payoutTransactionId: { type: Schema.Types.ObjectId, ref: 'PayoutTransaction', default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

ProviderSettlementSchema.index({ technicianId: 1, status: 1, createdAt: -1 });
ProviderSettlementSchema.index({ status: 1, readyForPayoutAt: -1 });

const ProviderSettlement =
  (mongoose.models.ProviderSettlement as mongoose.Model<IProviderSettlement> | undefined) ??
  mongoose.model<IProviderSettlement>('ProviderSettlement', ProviderSettlementSchema);

export default ProviderSettlement;
