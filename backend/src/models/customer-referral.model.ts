import mongoose, { Document, Schema } from 'mongoose';

export enum CustomerReferralStatus {
  REGISTERED = 'REGISTERED',
  FIRST_BOOKING_CREATED = 'FIRST_BOOKING_CREATED',
  FIRST_JOB_COMPLETED = 'FIRST_JOB_COMPLETED',
  REWARD_ELIGIBLE = 'REWARD_ELIGIBLE',
  REWARD_BLOCKED = 'REWARD_BLOCKED',
}

export interface ICustomerReferralDocument extends Document {
  referralCode: string;
  referrerCustomerId: mongoose.Types.ObjectId;
  referredCustomerId: mongoose.Types.ObjectId;
  referredCustomerEmail: string;
  countryCode: string;
  city: string;
  status: CustomerReferralStatus;
  friendDiscountPromotionId?: mongoose.Types.ObjectId | null;
  friendDiscountCode?: string;
  friendDiscountIssuedAt?: Date | null;
  firstBookingId?: mongoose.Types.ObjectId | null;
  firstCompletedBookingId?: mongoose.Types.ObjectId | null;
  rewardPromotionId?: mongoose.Types.ObjectId | null;
  rewardCode?: string;
  registeredAt: Date;
  firstBookingAt?: Date | null;
  firstCompletedAt?: Date | null;
  rewardEligibleAt?: Date | null;
  rewardIssuedAt?: Date | null;
  rewardBlockedAt?: Date | null;
  rewardBlockReason?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerReferralSchema = new Schema<ICustomerReferralDocument>(
  {
    referralCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    referrerCustomerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    referredCustomerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    referredCustomerEmail: {
      type: String,
      default: '',
      lowercase: true,
      trim: true,
      index: true,
    },
    countryCode: {
      type: String,
      required: true,
      uppercase: true,
      validate: { validator: (value: string) => /^[A-Z]{2}$/.test(value), message: 'Invalid ISO country code.' },
      index: true,
    },
    city: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(CustomerReferralStatus),
      default: CustomerReferralStatus.REGISTERED,
      index: true,
    },
    friendDiscountPromotionId: {
      type: Schema.Types.ObjectId,
      ref: 'Promotion',
      default: null,
      index: true,
    },
    friendDiscountCode: {
      type: String,
      default: '',
      trim: true,
      uppercase: true,
      index: true,
    },
    friendDiscountIssuedAt: {
      type: Date,
      default: null,
    },
    firstBookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
    },
    firstCompletedBookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
    },
    rewardPromotionId: {
      type: Schema.Types.ObjectId,
      ref: 'Promotion',
      default: null,
      index: true,
    },
    rewardCode: {
      type: String,
      default: '',
      trim: true,
      uppercase: true,
      index: true,
    },
    registeredAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    firstBookingAt: {
      type: Date,
      default: null,
    },
    firstCompletedAt: {
      type: Date,
      default: null,
    },
    rewardEligibleAt: {
      type: Date,
      default: null,
    },
    rewardIssuedAt: {
      type: Date,
      default: null,
    },
    rewardBlockedAt: {
      type: Date,
      default: null,
    },
    rewardBlockReason: {
      type: String,
      default: '',
      trim: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

CustomerReferralSchema.index({ referrerCustomerId: 1, status: 1 });
CustomerReferralSchema.index({ referralCode: 1, registeredAt: -1 });

const CustomerReferralModel =
  (mongoose.models.CustomerReferral as mongoose.Model<ICustomerReferralDocument> | undefined) ??
  mongoose.model<ICustomerReferralDocument>('CustomerReferral', CustomerReferralSchema);

export default CustomerReferralModel;
