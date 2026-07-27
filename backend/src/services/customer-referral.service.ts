import crypto from 'crypto';
import mongoose from 'mongoose';
import Booking, { BookingPaymentStatus, BookingStatus, CompletionStatus, IBooking } from '../models/booking.model';
import CustomerReferral, { CustomerReferralStatus } from '../models/customer-referral.model';
import Promotion, {
  PromotionDiscountType,
  PromotionFundingSource,
  PromotionStatus,
  PromotionStackingPolicy,
  PromotionTriggerType,
} from '../models/promotion.model';
import User, { UserRole } from '../models/user.model';
import { NotificationChannel } from '../models/notification.model';
import { createNotifications } from './notification.service';

export const normalizeCustomerReferralCode = (value: unknown): string =>
  typeof value === 'string'
    ? value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 24)
    : '';

const DEFAULT_FRIEND_DISCOUNT_MINOR = Number.isFinite(Number(process.env.CUSTOMER_REFERRAL_FRIEND_DISCOUNT_MINOR))
  ? Math.max(0, Math.round(Number(process.env.CUSTOMER_REFERRAL_FRIEND_DISCOUNT_MINOR)))
  : 5000;
const DEFAULT_CUSTOMER_REWARD_MINOR = Number.isFinite(Number(process.env.CUSTOMER_REFERRAL_REWARD_MINOR))
  ? Math.max(0, Math.round(Number(process.env.CUSTOMER_REFERRAL_REWARD_MINOR)))
  : 5000;
const DEFAULT_EXPIRY_DAYS = Number.isFinite(Number(process.env.CUSTOMER_REFERRAL_EXPIRY_DAYS))
  ? Math.max(1, Math.round(Number(process.env.CUSTOMER_REFERRAL_EXPIRY_DAYS)))
  : 30;

const randomSuffix = (): string => crypto.randomBytes(3).toString('hex').toUpperCase();

const baseCodeFromName = (name: string): string => {
  const cleaned = name.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return (cleaned || 'PADI').slice(0, 6);
};

const promotionExpiry = (): Date =>
  new Date(Date.now() + DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

const generatePromotionCode = (prefix: string, referralCode: string): string =>
  `${prefix}${referralCode.slice(0, 6)}${randomSuffix()}`.replace(/[^A-Z0-9]/g, '').slice(0, 18);

export const getOrCreateCustomerReferralCode = async (customerId: mongoose.Types.ObjectId | string): Promise<string> => {
  const customer = await User.findOne({ _id: customerId, role: UserRole.CUSTOMER });
  if (!customer) throw new Error('Customer account not found.');

  const existing = normalizeCustomerReferralCode(customer.metadata?.customerReferralCode);
  if (existing) return existing;

  const baseCode = baseCodeFromName(customer.name);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = `${baseCode}${randomSuffix()}`.slice(0, 12);
    const duplicate = await User.exists({ 'metadata.customerReferralCode': candidate });
    if (duplicate) continue;
    customer.set('metadata.customerReferralCode', candidate);
    customer.markModified('metadata');
    await customer.save();
    return candidate;
  }

  const fallback = `PADI${Date.now().toString(36).toUpperCase()}`.slice(0, 14);
  customer.set('metadata.customerReferralCode', fallback);
  customer.markModified('metadata');
  await customer.save();
  return fallback;
};

export const findCustomerByReferralCode = async (rawCode: unknown) => {
  const referralCode = normalizeCustomerReferralCode(rawCode);
  if (!referralCode) return null;

  return User.findOne({
    role: UserRole.CUSTOMER,
    isActive: true,
    'metadata.customerReferralCode': referralCode,
  });
};

const createCustomerReferralPromotion = async (input: {
  referralId: mongoose.Types.ObjectId;
  referralCode: string;
  customerId: mongoose.Types.ObjectId;
  countryCode: string;
  currency: string;
  amountMinor: number;
  type: 'FRIEND_DISCOUNT' | 'REFERRER_REWARD';
  qualifyingBookingId?: mongoose.Types.ObjectId;
}) => {
  const prefix = input.type === 'FRIEND_DISCOUNT' ? 'PADIFF' : 'PADICR';
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generatePromotionCode(prefix, input.referralCode);
    try {
      return await Promotion.create({
        code,
        name: input.type === 'FRIEND_DISCOUNT' ? 'Friend referral discount' : 'Customer referral reward',
        description: input.type === 'FRIEND_DISCOUNT'
          ? 'Welcome to Padi. Use this code on your first qualifying booking.'
          : 'Thank you for inviting a friend to Padi.',
        status: PromotionStatus.ACTIVE,
        triggerType: PromotionTriggerType.CODE,
        discountType: PromotionDiscountType.FIXED_AMOUNT,
        discountValue: input.amountMinor,
        maxDiscountMinor: input.amountMinor,
        minBookingAmountMinor: input.amountMinor,
        countryCode: input.countryCode,
        currency: input.currency,
        eligibleClientIds: [input.customerId],
        excludedClientIds: [],
        firstBookingOnly: input.type === 'FRIEND_DISCOUNT',
        priority: input.type === 'FRIEND_DISCOUNT' ? 15 : 10,
        stackingPolicy: PromotionStackingPolicy.EXCLUSIVE,
        fundingSource: PromotionFundingSource.PLATFORM,
        fundingSplitBps: { platform: 10000, technician: 0, partner: 0 },
        usageLimit: 1,
        perClientLimit: 1,
        startsAt: new Date(),
        expiresAt: promotionExpiry(),
        metadata: {
          source: input.type === 'FRIEND_DISCOUNT'
            ? 'CUSTOMER_REFERRAL_FRIEND_DISCOUNT'
            : 'CUSTOMER_REFERRAL_REWARD',
          referralId: input.referralId.toString(),
          referralCode: input.referralCode,
          qualifyingBookingId: input.qualifyingBookingId?.toString() || '',
          rewardType: input.type,
          fraudControls: [
            'ONE_REFERRAL_PER_CUSTOMER',
            'SELF_REFERRAL_BLOCKED',
            'FIRST_BOOKING_DISCOUNT_ONLY',
            'FIRST_PAID_COMPLETED_BOOKING_REWARD_ONLY',
            'CUSTOMER_CONFIRMED_COMPLETION_REQUIRED',
            'CUSTOMER_LOCKED_PROMO',
            'ONE_USE_ONLY',
            'ZERO_VALUE_BOOKINGS_BLOCKED',
          ],
        },
      });
    } catch (error: any) {
      if (error?.code !== 11000) throw error;
    }
  }

  throw new Error('Unable to generate a unique customer referral promotion code.');
};

export const recordCustomerToCustomerReferral = async (input: {
  referralCode?: unknown;
  customerId: mongoose.Types.ObjectId;
  customerEmail: string;
  countryCode: string;
  currency: string;
  city?: string;
  source?: string;
}): Promise<boolean> => {
  const referralCode = normalizeCustomerReferralCode(input.referralCode);
  if (!referralCode) return false;

  const referrer = await findCustomerByReferralCode(referralCode);
  if (!referrer) return false;
  if (String(referrer._id) === String(input.customerId)) return false;

  const existing = await CustomerReferral.findOne({ referredCustomerId: input.customerId });
  if (existing) return true;

  const referral = await CustomerReferral.create({
    referralCode,
    referrerCustomerId: referrer._id,
    referredCustomerId: input.customerId,
    referredCustomerEmail: input.customerEmail.toLowerCase().trim(),
    countryCode: input.countryCode,
    city: input.city || '',
    status: CustomerReferralStatus.REGISTERED,
    registeredAt: new Date(),
    metadata: {
      source: input.source || 'CUSTOMER_SIGNUP',
    },
  });

  const promotion = await createCustomerReferralPromotion({
    referralId: referral._id,
    referralCode,
    customerId: input.customerId,
    countryCode: input.countryCode,
    currency: input.currency,
    amountMinor: DEFAULT_FRIEND_DISCOUNT_MINOR,
    type: 'FRIEND_DISCOUNT',
  });

  await CustomerReferral.updateOne(
    { _id: referral._id, friendDiscountPromotionId: null },
    {
      $set: {
        friendDiscountPromotionId: promotion._id,
        friendDiscountCode: promotion.code || '',
        friendDiscountIssuedAt: new Date(),
      },
    }
  );

  await User.updateOne(
    { _id: input.customerId, 'metadata.referredByCustomerCode': { $exists: false } },
    {
      $set: {
        'metadata.referredByCustomerCode': referralCode,
        'metadata.referredByCustomerId': referrer._id.toString(),
        'metadata.customerReferralFriendDiscountCode': promotion.code || '',
        'metadata.referredAt': new Date(),
      },
    }
  );

  await createNotifications({
    userId: input.customerId,
    channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
    type: 'CUSTOMER_REFERRAL_DISCOUNT_ISSUED',
    title: 'Your Padi discount is ready',
    message: `Use code ${promotion.code} on your first qualifying booking.`,
    metadata: {
      referralId: referral._id.toString(),
      promotionId: promotion._id.toString(),
      rewardCode: promotion.code || '',
    },
  });

  return true;
};

export const markCustomerReferralFirstBookingCreated = async (input: {
  customerId: mongoose.Types.ObjectId | string;
  bookingId: mongoose.Types.ObjectId | string;
}): Promise<void> => {
  await CustomerReferral.updateOne(
    {
      referredCustomerId: new mongoose.Types.ObjectId(String(input.customerId)),
      firstBookingId: null,
      status: CustomerReferralStatus.REGISTERED,
    },
    {
      $set: {
        firstBookingId: new mongoose.Types.ObjectId(String(input.bookingId)),
        firstBookingAt: new Date(),
        status: CustomerReferralStatus.FIRST_BOOKING_CREATED,
      },
    }
  );
};

const paidCompletedBookingCount = (customerId: mongoose.Types.ObjectId) =>
  Booking.countDocuments({
    customerId,
    status: BookingStatus.COMPLETED,
    paymentStatus: BookingPaymentStatus.SECURED,
    priceMinor: { $gt: 0 },
  });

const blockCustomerReferralReward = async (
  referralId: mongoose.Types.ObjectId | string,
  reason: string,
  metadata: Record<string, unknown> = {}
): Promise<void> => {
  await CustomerReferral.updateOne(
    { _id: referralId, status: { $ne: CustomerReferralStatus.REWARD_ELIGIBLE } },
    {
      $set: {
        status: CustomerReferralStatus.REWARD_BLOCKED,
        rewardBlockedAt: new Date(),
        rewardBlockReason: reason,
      },
      $push: {
        'metadata.fraudChecks': {
          reason,
          checkedAt: new Date(),
          ...metadata,
        },
      } as any,
    }
  );
};

const rewardFraudCheck = async (booking: IBooking, referral: any): Promise<string> => {
  if (booking.status !== BookingStatus.COMPLETED) return 'BOOKING_NOT_COMPLETED';
  if (booking.paymentStatus !== BookingPaymentStatus.SECURED) return 'PAYMENT_NOT_SECURED';
  if (booking.priceMinor <= 0) return 'ZERO_VALUE_BOOKING';
  if (booking.completion?.status !== CompletionStatus.CUSTOMER_CONFIRMED) return 'CUSTOMER_COMPLETION_NOT_CONFIRMED';
  if (String(booking.customerId) !== String(referral.referredCustomerId)) return 'CUSTOMER_MISMATCH';
  if (String(referral.referrerCustomerId) === String(referral.referredCustomerId)) return 'SELF_REFERRAL';
  const completedCount = await paidCompletedBookingCount(booking.customerId);
  if (completedCount !== 1) return 'NOT_FIRST_PAID_COMPLETED_BOOKING';
  return '';
};

export const processCustomerReferralRewardForCompletedBooking = async (booking: IBooking): Promise<void> => {
  const referral = await CustomerReferral.findOne({
    referredCustomerId: booking.customerId,
    rewardPromotionId: null,
    status: { $in: [CustomerReferralStatus.REGISTERED, CustomerReferralStatus.FIRST_BOOKING_CREATED, CustomerReferralStatus.FIRST_JOB_COMPLETED] },
  });

  if (!referral) return;

  const blockReason = await rewardFraudCheck(booking, referral);
  if (blockReason) {
    await blockCustomerReferralReward(referral._id, blockReason, { bookingId: booking._id.toString() });
    return;
  }

  const promotion = await createCustomerReferralPromotion({
    referralId: referral._id,
    referralCode: referral.referralCode,
    customerId: referral.referrerCustomerId,
    countryCode: booking.countryCode,
    currency: booking.currency,
    amountMinor: DEFAULT_CUSTOMER_REWARD_MINOR,
    type: 'REFERRER_REWARD',
    qualifyingBookingId: booking._id,
  });

  const updateResult = await CustomerReferral.updateOne(
    {
      _id: referral._id,
      rewardPromotionId: null,
      status: { $ne: CustomerReferralStatus.REWARD_ELIGIBLE },
    },
    {
      $set: {
        status: CustomerReferralStatus.REWARD_ELIGIBLE,
        firstCompletedBookingId: booking._id,
        firstCompletedAt: booking.completedAt || new Date(),
        rewardEligibleAt: new Date(),
        rewardIssuedAt: new Date(),
        rewardPromotionId: promotion._id,
        rewardCode: promotion.code || '',
        rewardBlockReason: '',
      },
      $push: {
        'metadata.fraudChecks': {
          result: 'PASSED',
          checkedAt: new Date(),
          bookingId: booking._id.toString(),
        },
      } as any,
    }
  );

  if (updateResult.modifiedCount !== 1) {
    await Promotion.updateOne(
      { _id: promotion._id },
      {
        $set: {
          status: PromotionStatus.ARCHIVED,
          'metadata.archivedReason': 'CUSTOMER_REFERRAL_REWARD_RACE_LOST',
        },
      }
    );
    return;
  }

  await createNotifications({
    userId: referral.referrerCustomerId,
    channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
    type: 'CUSTOMER_REFERRAL_REWARD_ISSUED',
    title: 'Your Padi referral reward is ready',
    message: `Use code ${promotion.code} on your next qualifying booking.`,
    metadata: {
      referralId: referral._id.toString(),
      promotionId: promotion._id.toString(),
      rewardCode: promotion.code || '',
      qualifyingBookingId: booking._id.toString(),
    },
  });
};

export const getCustomerReferralSummary = async (customerId: mongoose.Types.ObjectId | string) => {
  const referrals = await CustomerReferral.aggregate([
    { $match: { referrerCustomerId: new mongoose.Types.ObjectId(String(customerId)) } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const counts = referrals.reduce<Record<string, number>>((acc, item) => {
    acc[String(item._id)] = Number(item.count || 0);
    return acc;
  }, {});

  return {
    registeredCount: counts[CustomerReferralStatus.REGISTERED] || 0,
    firstBookingCount: counts[CustomerReferralStatus.FIRST_BOOKING_CREATED] || 0,
    completedCount: (counts[CustomerReferralStatus.FIRST_JOB_COMPLETED] || 0) + (counts[CustomerReferralStatus.REWARD_ELIGIBLE] || 0),
    rewardEligibleCount: counts[CustomerReferralStatus.REWARD_ELIGIBLE] || 0,
    rewardBlockedCount: counts[CustomerReferralStatus.REWARD_BLOCKED] || 0,
  };
};

export const listActiveCustomerReferralPromotions = async (customerId: mongoose.Types.ObjectId | string) => {
  const now = new Date();
  const promotions = await Promotion.find({
    status: PromotionStatus.ACTIVE,
    triggerType: PromotionTriggerType.CODE,
    eligibleClientIds: new mongoose.Types.ObjectId(String(customerId)),
    $or: [
      { expiresAt: null },
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: now } },
    ],
    'metadata.source': {
      $in: [
        'CUSTOMER_REFERRAL_FRIEND_DISCOUNT',
        'CUSTOMER_REFERRAL_REWARD',
        'PROVIDER_REFERRAL_REWARD',
      ],
    },
  })
    .select('code name description discountType discountValue maxDiscountMinor minBookingAmountMinor currency expiresAt usageLimit usageCount redemptionCount metadata')
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  return promotions
    .filter((promotion) => {
      const usageLimit = promotion.usageLimit === null || promotion.usageLimit === undefined
        ? null
        : Number(promotion.usageLimit);
      return usageLimit === null || Number(promotion.usageCount || 0) < usageLimit;
    })
    .map((promotion: any) => {
      const source = String(promotion.metadata?.source || '');
      return {
        id: promotion._id?.toString(),
        code: promotion.code || '',
        title: source === 'CUSTOMER_REFERRAL_FRIEND_DISCOUNT'
          ? 'First booking discount'
          : source === 'CUSTOMER_REFERRAL_REWARD'
            ? 'Friend invite reward'
            : 'Padi Pro invite reward',
        description: promotion.description || promotion.name || 'Use this code on your next qualifying booking.',
        discountType: promotion.discountType,
        discountValue: Number(promotion.discountValue || 0),
        maxDiscountMinor: promotion.maxDiscountMinor === null || promotion.maxDiscountMinor === undefined
          ? null
          : Number(promotion.maxDiscountMinor),
        minBookingAmountMinor: Number(promotion.minBookingAmountMinor || 0),
        currency: promotion.currency || 'ZAR',
        expiresAt: promotion.expiresAt || null,
        status: Number(promotion.redemptionCount || 0) > 0 ? 'USED' : 'AVAILABLE',
        source,
      };
    });
};

export const listCustomerReferralRewardsForAdmin = async (filter: Record<string, unknown> = {}) => {
  const referrals = await CustomerReferral.find(filter)
    .populate('referrerCustomerId', 'name email phone countryCode')
    .populate('referredCustomerId', 'name email phone countryCode')
    .populate('friendDiscountPromotionId', 'code status usageCount redemptionCount expiresAt redeemedBudgetMinor')
    .populate('rewardPromotionId', 'code status usageCount redemptionCount expiresAt redeemedBudgetMinor')
    .sort({ updatedAt: -1 })
    .limit(200)
    .lean();

  return referrals.map((referral: any) => ({
    id: referral._id?.toString(),
    referralCode: referral.referralCode,
    status: referral.status,
    countryCode: referral.countryCode,
    city: referral.city,
    type: 'CUSTOMER',
    referrer: referral.referrerCustomerId
      ? {
          id: referral.referrerCustomerId._id?.toString(),
          name: referral.referrerCustomerId.name,
          email: referral.referrerCustomerId.email,
        }
      : null,
    customer: referral.referredCustomerId
      ? {
          id: referral.referredCustomerId._id?.toString(),
          name: referral.referredCustomerId.name,
          email: referral.referredCustomerId.email,
        }
      : null,
    friendDiscountCode: referral.friendDiscountCode || referral.friendDiscountPromotionId?.code || '',
    friendDiscountPromotionId: referral.friendDiscountPromotionId?._id?.toString() || '',
    friendDiscountRedeemed: Number(referral.friendDiscountPromotionId?.redemptionCount || 0) > 0,
    firstBookingId: referral.firstBookingId?.toString() || '',
    firstCompletedBookingId: referral.firstCompletedBookingId?.toString() || '',
    rewardCode: referral.rewardCode || referral.rewardPromotionId?.code || '',
    rewardPromotionId: referral.rewardPromotionId?._id?.toString() || '',
    rewardPromotionStatus: referral.rewardPromotionId?.status || '',
    rewardRedeemed: Number(referral.rewardPromotionId?.redemptionCount || 0) > 0,
    rewardBlockReason: referral.rewardBlockReason || '',
    registeredAt: referral.registeredAt,
    firstBookingAt: referral.firstBookingAt,
    firstCompletedAt: referral.firstCompletedAt,
    rewardEligibleAt: referral.rewardEligibleAt,
    rewardIssuedAt: referral.rewardIssuedAt,
    rewardBlockedAt: referral.rewardBlockedAt,
    createdAt: referral.createdAt,
    updatedAt: referral.updatedAt,
  }));
};
