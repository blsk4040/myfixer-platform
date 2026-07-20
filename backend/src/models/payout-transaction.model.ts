import mongoose, { Document, Schema } from 'mongoose';
import { CountryCode, CurrencyCode } from '../config/market.config';
import { ProviderPayoutProvider } from './provider-payout-method.model';

export enum PayoutTransactionStatus {
  INITIALIZED = 'INITIALIZED',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  REVERSED = 'REVERSED',
  UNDER_REVIEW = 'UNDER_REVIEW',
}

export interface IPayoutTransaction extends Document {
  provider: ProviderPayoutProvider;
  reference: string;
  providerTransferCode?: string;
  settlementId: mongoose.Types.ObjectId;
  bookingId: mongoose.Types.ObjectId;
  technicianId: mongoose.Types.ObjectId;
  payoutMethodId: mongoose.Types.ObjectId;
  countryCode: string;
  currency: string;
  amountMinor: number;
  status: PayoutTransactionStatus;
  providerStatus?: string;
  recipientSnapshot: {
    type: string;
    maskedDestination: string;
    providerRecipientCode?: string;
  };
  initiatedBy?: mongoose.Types.ObjectId | null;
  initiatedAt?: Date | null;
  succeededAt?: Date | null;
  failedAt?: Date | null;
  reversedAt?: Date | null;
  verifiedAt?: Date | null;
  idempotencyKey: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const PayoutTransactionSchema = new Schema<IPayoutTransaction>(
  {
    provider: { type: String, enum: Object.values(ProviderPayoutProvider), default: ProviderPayoutProvider.PAYSTACK, index: true },
    reference: { type: String, required: true, unique: true, trim: true, index: true },
    providerTransferCode: { type: String, default: '', trim: true, index: true },
    settlementId: { type: Schema.Types.ObjectId, ref: 'ProviderSettlement', required: true, index: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    technicianId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    payoutMethodId: { type: Schema.Types.ObjectId, ref: 'ProviderPayoutMethod', required: true, index: true },
    countryCode: { type: String, uppercase: true,
      validate: { validator: (value: string) => /^[A-Z]{2}$/.test(value), message: 'Invalid ISO country code.' }, required: true, index: true },
    currency: { type: String, uppercase: true,
      validate: { validator: (value: string) => /^[A-Z]{3}$/.test(value), message: 'Invalid currency code.' }, required: true, index: true },
    amountMinor: { type: Number, required: true, min: 1 },
    status: { type: String, enum: Object.values(PayoutTransactionStatus), default: PayoutTransactionStatus.INITIALIZED, index: true },
    providerStatus: { type: String, default: '', trim: true },
    recipientSnapshot: {
      type: new Schema(
        {
          type: { type: String, required: true },
          maskedDestination: { type: String, required: true },
          providerRecipientCode: { type: String, default: '' },
        },
        { _id: false }
      ),
      required: true,
    },
    initiatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    initiatedAt: { type: Date, default: null },
    succeededAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    reversedAt: { type: Date, default: null },
    verifiedAt: { type: Date, default: null },
    idempotencyKey: { type: String, required: true, trim: true, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

PayoutTransactionSchema.index({ provider: 1, idempotencyKey: 1 }, { unique: true });
PayoutTransactionSchema.index({ settlementId: 1, status: 1 });
PayoutTransactionSchema.index({ technicianId: 1, createdAt: -1 });

const PayoutTransaction =
  (mongoose.models.PayoutTransaction as mongoose.Model<IPayoutTransaction> | undefined) ??
  mongoose.model<IPayoutTransaction>('PayoutTransaction', PayoutTransactionSchema);

export default PayoutTransaction;
