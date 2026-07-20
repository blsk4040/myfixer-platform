import mongoose, { Document, Schema } from 'mongoose';
import { CountryCode, CurrencyCode } from '../config/market.config';

export enum PromotionDiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED_AMOUNT = 'FIXED_AMOUNT',
  FREE_CALLOUT = 'FREE_CALLOUT',
}

export enum PromotionStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  EXPIRED = 'EXPIRED',
  ENDED = 'ENDED',
  ARCHIVED = 'ARCHIVED',
}

export enum PromotionTriggerType {
  AUTOMATIC = 'AUTOMATIC',
  CODE = 'CODE',
}

export enum PromotionFundingSource {
  MYFIXER = 'MYFIXER',
  PROVIDER = 'PROVIDER',
  PARTNER = 'PARTNER',
  SHARED = 'SHARED',
  PLATFORM = 'PLATFORM',
  TECHNICIAN = 'TECHNICIAN',
}

export enum PromotionStackingPolicy {
  EXCLUSIVE = 'EXCLUSIVE',
  STACKABLE = 'STACKABLE',
}

export interface IPromotion extends Document {
  code?: string | null;
  name: string;
  description: string;
  status: PromotionStatus;
  triggerType: PromotionTriggerType;
  discountType: PromotionDiscountType;
  discountValue: number;
  maxDiscountMinor?: number | null;
  minBookingAmountMinor: number;
  countryCode?: string | null;
  currency?: string | null;
  cityKeys: string[];
  areaKeys: string[];
  serviceKeys: string[];
  subcategoryKeys: string[];
  eligibleClientIds: mongoose.Types.ObjectId[];
  excludedClientIds: mongoose.Types.ObjectId[];
  firstBookingOnly: boolean;
  priority: number;
  stackingPolicy: PromotionStackingPolicy;
  fundingSource: PromotionFundingSource;
  fundingSplitBps: {
    platform: number;
    technician: number;
    partner: number;
  };
  budgetMinor?: number | null;
  reservedBudgetMinor: number;
  redeemedBudgetMinor: number;
  reservationCount: number;
  redemptionCount: number;
  startsAt?: Date | null;
  expiresAt?: Date | null;
  usageLimit?: number | null;
  usageCount: number;
  perClientLimit?: number | null;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const PromotionSchema = new Schema<IPromotion>(
  {
    code: {
      type: String,
      uppercase: true,
      trim: true,
      match: /^[A-Z0-9_-]{3,32}$/,
      default: null,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: Object.values(PromotionStatus),
      default: PromotionStatus.ACTIVE,
      index: true,
    },
    triggerType: {
      type: String,
      enum: Object.values(PromotionTriggerType),
      default: PromotionTriggerType.CODE,
      index: true,
    },
    discountType: {
      type: String,
      enum: Object.values(PromotionDiscountType),
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    maxDiscountMinor: {
      type: Number,
      default: null,
      min: 0,
    },
    minBookingAmountMinor: {
      type: Number,
      default: 0,
      min: 0,
    },
    serviceKeys: {
      type: [String],
      default: [],
      index: true,
    },
    cityKeys: {
      type: [String],
      default: [],
      index: true,
    },
    areaKeys: {
      type: [String],
      default: [],
      index: true,
    },
    subcategoryKeys: {
      type: [String],
      default: [],
      index: true,
    },
    eligibleClientIds: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    excludedClientIds: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    firstBookingOnly: {
      type: Boolean,
      default: false,
    },
    priority: {
      type: Number,
      default: 100,
      min: 0,
      index: true,
    },
    stackingPolicy: {
      type: String,
      enum: Object.values(PromotionStackingPolicy),
      default: PromotionStackingPolicy.EXCLUSIVE,
    },
    fundingSource: {
      type: String,
      enum: Object.values(PromotionFundingSource),
      default: PromotionFundingSource.PLATFORM,
    },
    fundingSplitBps: {
      platform: { type: Number, default: 10000, min: 0, max: 10000 },
      technician: { type: Number, default: 0, min: 0, max: 10000 },
      partner: { type: Number, default: 0, min: 0, max: 10000 },
    },
    budgetMinor: {
      type: Number,
      default: null,
      min: 0,
    },
    reservedBudgetMinor: {
      type: Number,
      default: 0,
      min: 0,
    },
    redeemedBudgetMinor: {
      type: Number,
      default: 0,
      min: 0,
    },
    reservationCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    redemptionCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    countryCode: {
      type: String,
      uppercase: true,
      validate: { validator: (value: string) => /^[A-Z]{2}$/.test(value), message: 'Invalid ISO country code.' },
      default: null,
      index: true,
    },
    currency: {
      type: String,
      uppercase: true,
      validate: { validator: (value: string) => /^[A-Z]{3}$/.test(value), message: 'Invalid currency code.' },
      default: null,
      index: true,
    },
    startsAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    usageLimit: {
      type: Number,
      default: null,
      min: 0,
    },
    usageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    perClientLimit: {
      type: Number,
      default: null,
      min: 0,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
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

PromotionSchema.index({ status: 1, startsAt: 1, expiresAt: 1 });
PromotionSchema.index({ countryCode: 1, status: 1 });
PromotionSchema.index(
  { code: 1 },
  { unique: true, partialFilterExpression: { code: { $type: 'string' } } }
);
PromotionSchema.index({ triggerType: 1, status: 1, priority: 1 });
PromotionSchema.index({ countryCode: 1, serviceKeys: 1, subcategoryKeys: 1, status: 1 });

const PromotionModel =
  (mongoose.models.Promotion as mongoose.Model<IPromotion> | undefined) ??
  mongoose.model<IPromotion>('Promotion', PromotionSchema);

export default PromotionModel;
