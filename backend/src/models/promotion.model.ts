import mongoose, { Document, Schema } from 'mongoose';
import { CountryCode, CurrencyCode } from '../config/market.config';

export enum PromotionDiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED_AMOUNT = 'FIXED_AMOUNT',
}

export enum PromotionStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  EXPIRED = 'EXPIRED',
}

export interface IPromotion extends Document {
  code: string;
  name: string;
  description: string;
  status: PromotionStatus;
  discountType: PromotionDiscountType;
  discountValue: number;
  maxDiscountMinor?: number | null;
  minBookingAmountMinor: number;
  countryCode?: CountryCode | null;
  currency?: CurrencyCode | null;
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
      required: true,
      uppercase: true,
      trim: true,
      match: /^[A-Z0-9_-]{3,32}$/,
      unique: true,
      index: true,
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
    countryCode: {
      type: String,
      enum: Object.values(CountryCode),
      default: null,
      index: true,
    },
    currency: {
      type: String,
      enum: Object.values(CurrencyCode),
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

const PromotionModel =
  (mongoose.models.Promotion as mongoose.Model<IPromotion> | undefined) ??
  mongoose.model<IPromotion>('Promotion', PromotionSchema);

export default PromotionModel;
