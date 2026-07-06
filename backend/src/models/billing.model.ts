// src/models/billing.model.ts

import mongoose, { Schema, Document } from 'mongoose';
import { CountryCode, CurrencyCode } from '../config/market.config';

export enum InvoiceStatus {
  UNPAID = 'UNPAID',
  PAID = 'PAID',
  REFUNDED = 'REFUNDED',
  CANCELLED = 'CANCELLED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
}

export enum WalletTransactionType {
  CLIENT_PAYMENT = 'CLIENT_PAYMENT',
  PLATFORM_COMMISSION = 'PLATFORM_COMMISSION',
  TECHNICIAN_EARNING_PENDING = 'TECHNICIAN_EARNING_PENDING',
  PENDING_RELEASED = 'PENDING_RELEASED',
  CASHOUT_REQUESTED = 'CASHOUT_REQUESTED',
  CASHOUT_PAID = 'CASHOUT_PAID',
  REFUND = 'REFUND',
  ADJUSTMENT = 'ADJUSTMENT',
}

export enum WalletTransactionStatus {
  PENDING = 'PENDING',
  POSTED = 'POSTED',
  FAILED = 'FAILED',
  REVERSED = 'REVERSED',
}

export interface IInvoice extends Document {
  invoiceNumber: string;
  bookingId: Schema.Types.ObjectId;
  customerId: Schema.Types.ObjectId;
  technicianId: Schema.Types.ObjectId;

  countryCode: CountryCode;
  currency: CurrencyCode;

  baseAmountMinor: number;
  additionalLaborMinor: number;
  partsAmountMinor: number;
  totalAmountMinor: number;

  platformCommissionBps: number;
  platformCommissionAmountMinor: number;
  technicianNetAmountMinor: number;

  paymentGateway?: string;
  paymentReference?: string;

  status: InvoiceStatus;

  paidAt?: Date;
  refundedAt?: Date;
  cancelledAt?: Date;

  metadata: Record<string, unknown>;

  createdAt: Date;
  updatedAt: Date;
}

const InvoiceSchema = new Schema<IInvoice>(
  {
    invoiceNumber: {
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

    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    technicianId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    countryCode: {
      type: String,
      enum: Object.values(CountryCode),
      default: CountryCode.ZA,
      index: true,
    },

    currency: {
      type: String,
      enum: Object.values(CurrencyCode),
      default: CurrencyCode.ZAR,
      index: true,
    },

    baseAmountMinor: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    additionalLaborMinor: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    partsAmountMinor: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    totalAmountMinor: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    platformCommissionBps: {
      type: Number,
      required: true,
      default: 1500,
      min: 0,
      max: 10000,
    },

    platformCommissionAmountMinor: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    technicianNetAmountMinor: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    paymentGateway: {
      type: String,
      default: '',
      trim: true,
      lowercase: true,
    },

    paymentReference: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },

    status: {
      type: String,
      enum: Object.values(InvoiceStatus),
      default: InvoiceStatus.UNPAID,
      index: true,
    },

    paidAt: {
      type: Date,
    },

    refundedAt: {
      type: Date,
    },

    cancelledAt: {
      type: Date,
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

InvoiceSchema.virtual('baseAmount').get(function () {
  return this.baseAmountMinor / 100;
});

InvoiceSchema.virtual('additionalLabor').get(function () {
  return this.additionalLaborMinor / 100;
});

InvoiceSchema.virtual('partsAmount').get(function () {
  return this.partsAmountMinor / 100;
});

InvoiceSchema.virtual('totalAmount').get(function () {
  return this.totalAmountMinor / 100;
});

InvoiceSchema.virtual('platformCommissionAmount').get(function () {
  return this.platformCommissionAmountMinor / 100;
});

InvoiceSchema.virtual('technicianNetAmount').get(function () {
  return this.technicianNetAmountMinor / 100;
});

InvoiceSchema.set('toJSON', { virtuals: true });
InvoiceSchema.set('toObject', { virtuals: true });

InvoiceSchema.index({ status: 1, createdAt: -1 });
InvoiceSchema.index({ technicianId: 1, status: 1 });
InvoiceSchema.index({ customerId: 1, createdAt: -1 });

export interface IWallet extends Document {
  technicianId: Schema.Types.ObjectId;

  countryCode: CountryCode;
  currency: CurrencyCode;

  availableBalanceMinor: number;
  pendingBalanceMinor: number;
  totalEarnedMinor: number;
  totalWithdrawnMinor: number;

  lastTransactionAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const WalletSchema = new Schema<IWallet>(
  {
    technicianId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    countryCode: {
      type: String,
      enum: Object.values(CountryCode),
      default: CountryCode.ZA,
      index: true,
    },

    currency: {
      type: String,
      enum: Object.values(CurrencyCode),
      default: CurrencyCode.ZAR,
      index: true,
    },

    availableBalanceMinor: {
      type: Number,
      required: true,
      default: 0,
    },

    pendingBalanceMinor: {
      type: Number,
      required: true,
      default: 0,
    },

    totalEarnedMinor: {
      type: Number,
      required: true,
      default: 0,
    },

    totalWithdrawnMinor: {
      type: Number,
      required: true,
      default: 0,
    },

    lastTransactionAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

WalletSchema.virtual('availableBalance').get(function () {
  return this.availableBalanceMinor / 100;
});

WalletSchema.virtual('pendingBalance').get(function () {
  return this.pendingBalanceMinor / 100;
});

WalletSchema.virtual('totalEarned').get(function () {
  return this.totalEarnedMinor / 100;
});

WalletSchema.virtual('totalWithdrawn').get(function () {
  return this.totalWithdrawnMinor / 100;
});

WalletSchema.set('toJSON', { virtuals: true });
WalletSchema.set('toObject', { virtuals: true });

export interface IWalletTransaction extends Document {
  type: WalletTransactionType;
  status: WalletTransactionStatus;

  bookingId?: Schema.Types.ObjectId;
  invoiceId?: Schema.Types.ObjectId;
  customerId?: Schema.Types.ObjectId;
  technicianId?: Schema.Types.ObjectId;

  countryCode: CountryCode;
  currency: CurrencyCode;

  amountMinor: number;

  externalReference?: string;
  description: string;
  metadata: Record<string, unknown>;

  createdAt: Date;
  updatedAt: Date;
}

const WalletTransactionSchema = new Schema<IWalletTransaction>(
  {
    type: {
      type: String,
      enum: Object.values(WalletTransactionType),
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: Object.values(WalletTransactionStatus),
      default: WalletTransactionStatus.POSTED,
      index: true,
    },

    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      index: true,
    },

    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: 'Invoice',
      index: true,
    },

    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },

    technicianId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },

    countryCode: {
      type: String,
      enum: Object.values(CountryCode),
      required: true,
      index: true,
    },

    currency: {
      type: String,
      enum: Object.values(CurrencyCode),
      required: true,
      index: true,
    },

    amountMinor: {
      type: Number,
      required: true,
    },

    externalReference: {
      type: String,
      default: '',
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

WalletTransactionSchema.virtual('amount').get(function () {
  return this.amountMinor / 100;
});

WalletTransactionSchema.set('toJSON', { virtuals: true });
WalletTransactionSchema.set('toObject', { virtuals: true });

WalletTransactionSchema.index({ technicianId: 1, createdAt: -1 });
WalletTransactionSchema.index({ customerId: 1, createdAt: -1 });
WalletTransactionSchema.index({ bookingId: 1, type: 1 });
WalletTransactionSchema.index({ invoiceId: 1, type: 1 });
WalletTransactionSchema.index({ status: 1, createdAt: -1 });
WalletTransactionSchema.index(
  { externalReference: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: {
      externalReference: { $type: 'string', $ne: '' },
    },
  }
);

export const Invoice =
  (mongoose.models.Invoice as mongoose.Model<IInvoice> | undefined) ??
  mongoose.model<IInvoice>('Invoice', InvoiceSchema);

export const Wallet =
  (mongoose.models.Wallet as mongoose.Model<IWallet> | undefined) ??
  mongoose.model<IWallet>('Wallet', WalletSchema);

export const WalletTransaction =
  (mongoose.models.WalletTransaction as mongoose.Model<IWalletTransaction> | undefined) ??
  mongoose.model<IWalletTransaction>('WalletTransaction', WalletTransactionSchema);
