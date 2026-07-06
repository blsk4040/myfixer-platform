// src/models/jobQuote.model.ts

import mongoose, { Schema, Document } from 'mongoose';
import { CountryCode, CurrencyCode } from '../config/market.config';

export enum QuoteStatus {
  DRAFT = 'DRAFT',
  SENT_TO_CLIENT = 'SENT_TO_CLIENT',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export enum QuoteLineItemType {
  CALLOUT = 'CALLOUT',
  LABOR = 'LABOR',
  PART = 'PART',
  ADD_ON = 'ADD_ON',
  SURCHARGE = 'SURCHARGE',
  DISCOUNT = 'DISCOUNT',
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
  bookingId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  technicianId: mongoose.Types.ObjectId;

  countryCode: CountryCode;
  currency: CurrencyCode;

  status: QuoteStatus;

  lineItems: IQuoteLineItem[];

  subtotalAmountMinor: number;
  discountAmountMinor: number;
  totalAmountMinor: number;

  technicianNotes?: string;
  clientDecisionNote?: string;

  sentAt?: Date | null;
  approvedAt?: Date | null;
  rejectedAt?: Date | null;
  expiredAt?: Date | null;
  cancelledAt?: Date | null;
  expiresAt?: Date | null;

  decisionBy?: mongoose.Types.ObjectId;

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
      required: true,
      index: true,
    },

    currency: {
      type: String,
      enum: Object.values(CurrencyCode),
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: Object.values(QuoteStatus),
      default: QuoteStatus.DRAFT,
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

    approvedAt: {
      type: Date,
      default: null,
    },

    rejectedAt: {
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
JobQuoteSchema.index({ customerId: 1, status: 1 });
JobQuoteSchema.index({ technicianId: 1, status: 1 });
JobQuoteSchema.index({ status: 1, createdAt: -1 });
JobQuoteSchema.index({ expiresAt: 1, status: 1 });

export const JobQuote =
  (mongoose.models.JobQuote as mongoose.Model<IJobQuote> | undefined) ??
  mongoose.model<IJobQuote>('JobQuote', JobQuoteSchema);

export default JobQuote;