import mongoose, { Document, Schema } from 'mongoose';

export enum CustomerLoyaltyRewardType {
  PADI_DISCOUNT = 'PADI_DISCOUNT',
  FREE_SERVICE = 'FREE_SERVICE',
  PARTNER_VOUCHER = 'PARTNER_VOUCHER',
  PADI_CREDIT = 'PADI_CREDIT',
  BENEFIT = 'BENEFIT',
}

export enum CustomerLoyaltyRewardStatus {
  EARNED = 'EARNED',
  CLAIMED = 'CLAIMED',
  REDEEMED = 'REDEEMED',
  EXPIRED = 'EXPIRED',
  BLOCKED = 'BLOCKED',
}

export interface ICustomerLoyaltyReward extends Document {
  customerId: mongoose.Types.ObjectId;
  countryCode: string;
  city: string;
  milestone: number;
  rewardType: CustomerLoyaltyRewardType;
  title: string;
  description: string;
  status: CustomerLoyaltyRewardStatus;
  qualifyingBookingIds: mongoose.Types.ObjectId[];
  earnedFromBookingId?: mongoose.Types.ObjectId | null;
  promotionId?: mongoose.Types.ObjectId | null;
  promotionCode?: string;
  partnerName?: string;
  partnerVoucherCode?: string;
  rewardValueMinor?: number | null;
  currency?: string | null;
  expiresAt?: Date | null;
  claimedAt?: Date | null;
  redeemedAt?: Date | null;
  blockedAt?: Date | null;
  blockReason?: string;
  fraudSignals: string[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerLoyaltyRewardSchema = new Schema<ICustomerLoyaltyReward>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    countryCode: {
      type: String,
      required: true,
      uppercase: true,
      validate: { validator: (value: string) => /^[A-Z]{2}$/.test(value), message: 'Invalid ISO country code.' },
      index: true,
    },
    city: { type: String, default: '', trim: true, index: true },
    milestone: { type: Number, required: true, min: 1, index: true },
    rewardType: {
      type: String,
      enum: Object.values(CustomerLoyaltyRewardType),
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, default: '', trim: true, maxlength: 600 },
    status: {
      type: String,
      enum: Object.values(CustomerLoyaltyRewardStatus),
      default: CustomerLoyaltyRewardStatus.EARNED,
      index: true,
    },
    qualifyingBookingIds: [{ type: Schema.Types.ObjectId, ref: 'Booking' }],
    earnedFromBookingId: { type: Schema.Types.ObjectId, ref: 'Booking', default: null, index: true },
    promotionId: { type: Schema.Types.ObjectId, ref: 'Promotion', default: null, index: true },
    promotionCode: { type: String, default: '', trim: true, uppercase: true, index: true },
    partnerName: { type: String, default: '', trim: true, maxlength: 120 },
    partnerVoucherCode: { type: String, default: '', trim: true, maxlength: 120 },
    rewardValueMinor: { type: Number, default: null, min: 0 },
    currency: {
      type: String,
      uppercase: true,
      validate: { validator: (value: string) => !value || /^[A-Z]{3}$/.test(value), message: 'Invalid currency code.' },
      default: null,
    },
    expiresAt: { type: Date, default: null, index: true },
    claimedAt: { type: Date, default: null },
    redeemedAt: { type: Date, default: null },
    blockedAt: { type: Date, default: null },
    blockReason: { type: String, default: '', trim: true, maxlength: 240 },
    fraudSignals: { type: [String], default: [] },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

CustomerLoyaltyRewardSchema.index({ customerId: 1, milestone: 1 }, { unique: true });
CustomerLoyaltyRewardSchema.index({ countryCode: 1, status: 1, createdAt: -1 });

const CustomerLoyaltyRewardModel =
  (mongoose.models.CustomerLoyaltyReward as mongoose.Model<ICustomerLoyaltyReward> | undefined) ??
  mongoose.model<ICustomerLoyaltyReward>('CustomerLoyaltyReward', CustomerLoyaltyRewardSchema);

export default CustomerLoyaltyRewardModel;
