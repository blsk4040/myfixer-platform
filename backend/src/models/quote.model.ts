// src/models/jobQuote.model.ts

import mongoose, { Schema, Document } from 'mongoose';
import { CountryCode, CurrencyCode } from '../config/market.config';

export enum QuoteStatus {
  NOT_REQUIRED = 'NOT_REQUIRED',
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  CLARIFICATION_REQUESTED = 'CLARIFICATION_REQUESTED',
  SENT_TO_CLIENT = 'SENT_TO_CLIENT',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  SUPERSEDED = 'SUPERSEDED',
  CANCELLED = 'CANCELLED',
}

export enum QuoteLineItemType {
  CALL_OUT = 'CALL_OUT',
  CALLOUT = 'CALLOUT',
  LABOUR = 'LABOUR',
  LABOR = 'LABOR',
  PART = 'PART',
  ADD_ON = 'ADD_ON',
  SURCHARGE = 'SURCHARGE',
  DISCOUNT = 'DISCOUNT',
  TAX = 'TAX',
  PLATFORM_FEE = 'PLATFORM_FEE',
}

export interface IQuoteLineItem {
  type: QuoteLineItemType;
  label: string;
  quantity: number;
  unitAmountMinor: number;
  totalAmountMinor: number;
  notes?: string;
}

export interface IJobQuote extends Document {
  quoteNumber: string;
  bookingId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  technicianId: mongoose.Types.ObjectId;

  countryCode: string;
  currency: string;

  status: QuoteStatus;
  version: number;
  parentQuoteId?: mongoose.Types.ObjectId | null;
  isCurrent: boolean;

  lineItems: IQuoteLineItem[];

  subtotalAmountMinor: number;
  discountAmountMinor: number;
  totalAmountMinor: number;

  technicianNotes?: string;
  clientDecisionNote?: string;

  sentAt?: Date | null;
  submittedAt?: Date | null;
  approvedAt?: Date | null;
  rejectedAt?: Date | null;
  clarificationRequestedAt?: Date | null;
  supersededAt?: Date | null;
  expiredAt?: Date | null;
  cancelledAt?: Date | null;
  expiresAt?: Date | null;

  decisionBy?: mongoose.Types.ObjectId;
  createdBy?: mongoose.Types.ObjectId;
  submittedBy?: mongoose.Types.ObjectId;

  metadata: Record<string, unknown>;

  createdAt: Date;
  updatedAt: Date;
}

const QuoteLineItemSchema = new Schema<IQuoteLineItem>(
  {
    type: {
      type: String,
      enum: Object.values(QuoteLineItemType),
      required: true,
      index: true,
    },

    label: {
      type: String,
      required: true,
      trim: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 1,
    },

    unitAmountMinor: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    totalAmountMinor: {
      type: Number,
      required: true,
      default: 0,
    },

    notes: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { _id: false }
);

QuoteLineItemSchema.virtual('unitAmount').get(function () {
  return this.unitAmountMinor / 100;
});

QuoteLineItemSchema.virtual('totalAmount').get(function () {
  return this.totalAmountMinor / 100;
});

QuoteLineItemSchema.set('toJSON', { virtuals: true });
QuoteLineItemSchema.set('toObject', { virtuals: true });

const JobQuoteSchema = new Schema<IJobQuote>(
  {
    quoteNumber: {
      type: String,
      default: '',
      trim: true,
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
      uppercase: true,
      validate: { validator: (value: string) => /^[A-Z]{2}$/.test(value), message: 'Invalid ISO country code.' },
      required: true,
      index: true,
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
      enum: Object.values(QuoteStatus),
      default: QuoteStatus.DRAFT,
      index: true,
    },

    version: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },

    parentQuoteId: {
      type: Schema.Types.ObjectId,
      ref: 'JobQuote',
      default: null,
      index: true,
    },

    isCurrent: {
      type: Boolean,
      default: true,
      index: true,
    },

    lineItems: {
      type: [QuoteLineItemSchema],
      default: [],
    },

    subtotalAmountMinor: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    discountAmountMinor: {
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

    technicianNotes: {
      type: String,
      default: '',
      trim: true,
    },

    clientDecisionNote: {
      type: String,
      default: '',
      trim: true,
    },

    sentAt: {
      type: Date,
      default: null,
    },

    submittedAt: {
      type: Date,
      default: null,
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    rejectedAt: {
      type: Date,
      default: null,
    },

    clarificationRequestedAt: {
      type: Date,
      default: null,
    },

    supersededAt: {
      type: Date,
      default: null,
    },

    expiredAt: {
      type: Date,
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },

    decisionBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },

    submittedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

JobQuoteSchema.virtual('subtotalAmount').get(function () {
  return this.subtotalAmountMinor / 100;
});

JobQuoteSchema.virtual('discountAmount').get(function () {
  return this.discountAmountMinor / 100;
});

JobQuoteSchema.virtual('totalAmount').get(function () {
  return this.totalAmountMinor / 100;
});

JobQuoteSchema.set('toJSON', { virtuals: true });
JobQuoteSchema.set('toObject', { virtuals: true });

JobQuoteSchema.index({ bookingId: 1, createdAt: -1 });
JobQuoteSchema.index({ bookingId: 1, version: -1 });
JobQuoteSchema.index({ bookingId: 1, isCurrent: 1, status: 1 });
JobQuoteSchema.index({ customerId: 1, status: 1 });
JobQuoteSchema.index({ technicianId: 1, status: 1 });
JobQuoteSchema.index({ status: 1, createdAt: -1 });
JobQuoteSchema.index({ expiresAt: 1, status: 1 });
JobQuoteSchema.index(
  { quoteNumber: 1 },
  { unique: true, partialFilterExpression: { quoteNumber: { $type: 'string', $ne: '' } } }
);

export const JobQuote =
  (mongoose.models.JobQuote as mongoose.Model<IJobQuote> | undefined) ??
  mongoose.model<IJobQuote>('JobQuote', JobQuoteSchema);

export default JobQuote;
