import mongoose, { Document, Schema } from 'mongoose';
import { CurrencyCode } from '../config/market.config';

export enum PaymentProvider {
  PAYSTACK = 'PAYSTACK',
}

export enum PaymentTransactionStatus {
  INITIALIZED = 'INITIALIZED',
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  ABANDONED = 'ABANDONED',
  REVERSED = 'REVERSED',
  REFUNDED = 'REFUNDED',
  UNDER_REVIEW = 'UNDER_REVIEW',
}

export interface IPaymentTransaction extends Document {
  provider: PaymentProvider;
  reference: string;
  bookingId: mongoose.Types.ObjectId;
  quoteId?: mongoose.Types.ObjectId | null;
  customerId: mongoose.Types.ObjectId;
  technicianId?: mongoose.Types.ObjectId | null;
  amountMinor: number;
  currency: string;
  status: PaymentTransactionStatus;
  providerStatus?: string;
  authorizationUrl?: string;
  accessCode?: string;
  providerTransactionId?: string;
  initializedAt?: Date;
  paidAt?: Date | null;
  verifiedAt?: Date | null;
  failedAt?: Date | null;
  refundedAt?: Date | null;
  reversedAt?: Date | null;
  idempotencyKey: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentTransactionSchema = new Schema<IPaymentTransaction>(
  {
    provider: {
      type: String,
      enum: Object.values(PaymentProvider),
      default: PaymentProvider.PAYSTACK,
      index: true,
    },
    reference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true,
    },
    quoteId: {
      type: Schema.Types.ObjectId,
      ref: 'JobQuote',
      default: null,
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    technicianId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    amountMinor: {
      type: Number,
      required: true,
      min: 1,
    },
    currency: {
      type: String,
      uppercase: true,
      validate: { validator: (value: string) => /^[A-Z]{3}$/.test(value), message: 'Invalid currency code.' },
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(PaymentTransactionStatus),
      default: PaymentTransactionStatus.INITIALIZED,
      index: true,
    },
    providerStatus: {
      type: String,
      default: '',
      trim: true,
    },
    authorizationUrl: {
      type: String,
      default: '',
      trim: true,
    },
    accessCode: {
      type: String,
      default: '',
      trim: true,
    },
    providerTransactionId: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    initializedAt: {
      type: Date,
      default: Date.now,
    },
    paidAt: { type: Date, default: null },
    verifiedAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    refundedAt: { type: Date, default: null },
    reversedAt: { type: Date, default: null },
    idempotencyKey: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

PaymentTransactionSchema.index({ provider: 1, idempotencyKey: 1 }, { unique: true });
PaymentTransactionSchema.index({ bookingId: 1, status: 1, createdAt: -1 });
PaymentTransactionSchema.index({ quoteId: 1, status: 1 });
PaymentTransactionSchema.index({ customerId: 1, createdAt: -1 });

const PaymentTransaction =
  (mongoose.models.PaymentTransaction as mongoose.Model<IPaymentTransaction> | undefined) ??
  mongoose.model<IPaymentTransaction>('PaymentTransaction', PaymentTransactionSchema);

export default PaymentTransaction;
