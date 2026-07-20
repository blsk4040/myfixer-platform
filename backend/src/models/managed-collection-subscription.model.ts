import mongoose, { Document, Schema } from 'mongoose';
import { CountryCode, CurrencyCode } from '../config/market.config';
import {
  ManagedCollectionBinColor,
  ManagedCollectionFrequency,
  ManagedCollectionType,
} from './managed-collection.model';

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  PENDING = 'PENDING',
}

export enum SubscriptionPlanStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  DISABLED = 'DISABLED',
}

export enum BillingFrequency {
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
}

export enum SubscriptionInvoiceStatus {
  DRAFT = 'DRAFT',
  UNPAID = 'UNPAID',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

export interface IManagedCollectionPlanDocument extends Document {
  name: string;
  description: string;
  priceMinor: number;
  currency: string;
  countryCode: string;
  billingFrequency: BillingFrequency;
  collectionFrequency: ManagedCollectionFrequency;
  binPackage: ManagedCollectionBinColor[];
  collectionType: ManagedCollectionType;
  status: SubscriptionPlanStatus;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IManagedCollectionSubscriptionDocument extends Document {
  customerId: mongoose.Types.ObjectId;
  profileId?: mongoose.Types.ObjectId;
  planId: mongoose.Types.ObjectId;
  planName: string;
  customerName: string;
  customerEmail: string;
  countryCode: string;
  city: string;
  area: string;
  currency: string;
  priceMinor: number;
  billingFrequency: BillingFrequency;
  collectionFrequency: ManagedCollectionFrequency;
  binPackage: ManagedCollectionBinColor[];
  collectionType: ManagedCollectionType;
  status: SubscriptionStatus;
  startedAt: Date;
  pausedAt?: Date | null;
  cancelledAt?: Date | null;
  expiresAt?: Date | null;
  previousBillingDate?: Date | null;
  nextBillingDate: Date;
  renewalDate: Date;
  gracePeriodEndsAt: Date;
  recurringPayment: {
    provider: string;
    customerCode: string;
    authorizationReference: string;
    defaultMethodId: string;
    enabled: boolean;
  };
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IManagedCollectionSubscriptionInvoiceDocument extends Document {
  invoiceNumber: string;
  subscriptionId: mongoose.Types.ObjectId;
  planId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  countryCode: string;
  currency: string;
  amountMinor: number;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  dueAt: Date;
  status: SubscriptionInvoiceStatus;
  paidAt?: Date | null;
  cancelledAt?: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const PlanSchema = new Schema<IManagedCollectionPlanDocument>(
  {
    name: { type: String, required: true, trim: true, index: true },
    description: { type: String, default: '', trim: true },
    priceMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, uppercase: true,
      validate: { validator: (value: string) => /^[A-Z]{3}$/.test(value), message: 'Invalid currency code.' }, required: true, index: true },
    countryCode: { type: String, uppercase: true,
      validate: { validator: (value: string) => /^[A-Z]{2}$/.test(value), message: 'Invalid ISO country code.' }, required: true, index: true },
    billingFrequency: { type: String, enum: Object.values(BillingFrequency), required: true, index: true },
    collectionFrequency: { type: String, enum: Object.values(ManagedCollectionFrequency), required: true },
    binPackage: { type: [String], enum: Object.values(ManagedCollectionBinColor), default: [] },
    collectionType: { type: String, enum: Object.values(ManagedCollectionType), required: true, index: true },
    status: { type: String, enum: Object.values(SubscriptionPlanStatus), default: SubscriptionPlanStatus.ACTIVE, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

const SubscriptionSchema = new Schema<IManagedCollectionSubscriptionDocument>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    profileId: { type: Schema.Types.ObjectId, ref: 'ManagedCollectionProfile', index: true },
    planId: { type: Schema.Types.ObjectId, ref: 'ManagedCollectionPlan', required: true, index: true },
    planName: { type: String, required: true, trim: true },
    customerName: { type: String, default: 'Client', trim: true },
    customerEmail: { type: String, required: true, trim: true, lowercase: true },
    countryCode: { type: String, uppercase: true,
      validate: { validator: (value: string) => /^[A-Z]{2}$/.test(value), message: 'Invalid ISO country code.' }, required: true, index: true },
    city: { type: String, required: true, trim: true, index: true },
    area: { type: String, default: '', trim: true, index: true },
    currency: { type: String, uppercase: true,
      validate: { validator: (value: string) => /^[A-Z]{3}$/.test(value), message: 'Invalid currency code.' }, required: true },
    priceMinor: { type: Number, required: true, min: 0 },
    billingFrequency: { type: String, enum: Object.values(BillingFrequency), required: true, index: true },
    collectionFrequency: { type: String, enum: Object.values(ManagedCollectionFrequency), required: true },
    binPackage: { type: [String], enum: Object.values(ManagedCollectionBinColor), default: [] },
    collectionType: { type: String, enum: Object.values(ManagedCollectionType), required: true, index: true },
    status: { type: String, enum: Object.values(SubscriptionStatus), default: SubscriptionStatus.PENDING, index: true },
    startedAt: { type: Date, default: Date.now },
    pausedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    previousBillingDate: { type: Date, default: null },
    nextBillingDate: { type: Date, required: true, index: true },
    renewalDate: { type: Date, required: true, index: true },
    gracePeriodEndsAt: { type: Date, required: true, index: true },
    recurringPayment: {
      provider: { type: String, default: 'paystack', trim: true, lowercase: true },
      customerCode: { type: String, default: '', trim: true },
      authorizationReference: { type: String, default: '', trim: true },
      defaultMethodId: { type: String, default: '', trim: true },
      enabled: { type: Boolean, default: false },
    },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

const SubscriptionInvoiceSchema = new Schema<IManagedCollectionSubscriptionInvoiceDocument>(
  {
    invoiceNumber: { type: String, required: true, unique: true, trim: true, index: true },
    subscriptionId: { type: Schema.Types.ObjectId, ref: 'ManagedCollectionSubscription', required: true, index: true },
    planId: { type: Schema.Types.ObjectId, ref: 'ManagedCollectionPlan', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    countryCode: { type: String, uppercase: true,
      validate: { validator: (value: string) => /^[A-Z]{2}$/.test(value), message: 'Invalid ISO country code.' }, required: true, index: true },
    currency: { type: String, uppercase: true,
      validate: { validator: (value: string) => /^[A-Z]{3}$/.test(value), message: 'Invalid currency code.' }, required: true },
    amountMinor: { type: Number, required: true, min: 0 },
    billingPeriodStart: { type: Date, required: true },
    billingPeriodEnd: { type: Date, required: true },
    dueAt: { type: Date, required: true, index: true },
    status: { type: String, enum: Object.values(SubscriptionInvoiceStatus), default: SubscriptionInvoiceStatus.UNPAID, index: true },
    paidAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

PlanSchema.index({ countryCode: 1, status: 1 });
SubscriptionSchema.index({ customerId: 1, status: 1 });
SubscriptionSchema.index({ status: 1, nextBillingDate: 1 });
SubscriptionInvoiceSchema.index({ subscriptionId: 1, dueAt: -1 });
SubscriptionInvoiceSchema.index({ status: 1, dueAt: 1 });

export const ManagedCollectionPlan =
  (mongoose.models.ManagedCollectionPlan as mongoose.Model<IManagedCollectionPlanDocument> | undefined) ??
  mongoose.model<IManagedCollectionPlanDocument>('ManagedCollectionPlan', PlanSchema);

export const ManagedCollectionSubscription =
  (mongoose.models.ManagedCollectionSubscription as mongoose.Model<IManagedCollectionSubscriptionDocument> | undefined) ??
  mongoose.model<IManagedCollectionSubscriptionDocument>('ManagedCollectionSubscription', SubscriptionSchema);

export const ManagedCollectionSubscriptionInvoice =
  (mongoose.models.ManagedCollectionSubscriptionInvoice as mongoose.Model<IManagedCollectionSubscriptionInvoiceDocument> | undefined) ??
  mongoose.model<IManagedCollectionSubscriptionInvoiceDocument>('ManagedCollectionSubscriptionInvoice', SubscriptionInvoiceSchema);
