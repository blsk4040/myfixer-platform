import crypto from 'crypto';
import mongoose from 'mongoose';
import Booking, {
  BookingPaymentStatus,
  BookingStatus,
  CompletionStatus,
  IBooking,
} from '../models/booking.model';
import CustomerLoyaltyReward, {
  CustomerLoyaltyRewardStatus,
  CustomerLoyaltyRewardType,
  ICustomerLoyaltyReward,
} from '../models/customer-loyalty-reward.model';
import Promotion, {
  PromotionDiscountType,
  PromotionFundingSource,
  PromotionStackingPolicy,
  PromotionStatus,
  PromotionTriggerType,
} from '../models/promotion.model';
import { createNotifications } from './notification.service';
import { NotificationChannel } from '../models/notification.model';

const intEnv = (key: string, fallback: number, min = 0): number => {
  const parsed = Number(process.env[key]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.round(parsed));
};

export const LOYALTY_MILESTONE_JOBS = intEnv('CUSTOMER_LOYALTY_MILESTONE_JOBS', 5, 1);
const LOYALTY_EXPIRY_DAYS = intEnv('CUSTOMER_LOYALTY_EXPIRY_DAYS', 45, 1);
const LOYALTY_REWARD_VALUE_MINOR = intEnv('CUSTOMER_LOYALTY_REWARD_VALUE_MINOR', 0, 0);
const LOYALTY_REWARD_TITLE = String(process.env.CUSTOMER_LOYALTY_REWARD_TITLE || 'Free car wash').trim();
const LOYALTY_REWARD_DESCRIPTION = String(
  process.env.CUSTOMER_LOYALTY_REWARD_DESCRIPTION ||
    'A thank-you reward from Padi after completing eligible paid jobs.'
).trim();
const LOYALTY_PARTNER_NAME = String(process.env.CUSTOMER_LOYALTY_PARTNER_NAME || 'Padi partner').trim();

const configuredRewardType = (): CustomerLoyaltyRewardType => {
  const raw = String(process.env.CUSTOMER_LOYALTY_REWARD_TYPE || CustomerLoyaltyRewardType.FREE_SERVICE).toUpperCase();
  return Object.values(CustomerLoyaltyRewardType).includes(raw as CustomerLoyaltyRewardType)
    ? raw as CustomerLoyaltyRewardType
    : CustomerLoyaltyRewardType.FREE_SERVICE;
};

const randomSuffix = (): string => crypto.randomBytes(3).toString('hex').toUpperCase();
const rewardExpiry = (): Date => new Date(Date.now() + LOYALTY_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

const isQualifyingBooking = (booking: IBooking): boolean =>
  booking.status === BookingStatus.COMPLETED &&
  booking.paymentStatus === BookingPaymentStatus.SECURED &&
  booking.completion?.status === CompletionStatus.CUSTOMER_CONFIRMED &&
  Number(booking.priceMinor || 0) > 0;

const qualifyingBookingQuery = (customerId: mongoose.Types.ObjectId | string) => ({
  customerId: new mongoose.Types.ObjectId(String(customerId)),
  status: BookingStatus.COMPLETED,
  paymentStatus: BookingPaymentStatus.SECURED,
  'completion.status': CompletionStatus.CUSTOMER_CONFIRMED,
  priceMinor: { $gt: 0 },
  cancelledAt: null,
});

const buildFraudSignals = async (bookings: IBooking[], completedBooking: IBooking): Promise<string[]> => {
  const signals: string[] = [];
  if (!isQualifyingBooking(completedBooking)) signals.push('BOOKING_NOT_QUALIFYING');

  const providerCounts = new Map<string, number>();
  const addressCounts = new Map<string, number>();
  for (const booking of bookings) {
    if (booking.technicianId) {
      const key = booking.technicianId.toString();
      providerCounts.set(key, (providerCounts.get(key) || 0) + 1);
    }
    const address = String(booking.fullAddress || '').trim().toLowerCase();
    if (address) addressCounts.set(address, (addressCounts.get(address) || 0) + 1);
  }

  if ([...providerCounts.values()].some((count) => count >= LOYALTY_MILESTONE_JOBS)) {
    signals.push('SAME_PROVIDER_MILESTONE_PATTERN');
  }
  if ([...addressCounts.values()].some((count) => count >= LOYALTY_MILESTONE_JOBS)) {
    signals.push('SAME_ADDRESS_MILESTONE_PATTERN');
  }

  const first = bookings[0]?.completedAt || bookings[0]?.completion?.customerConfirmedAt;
  const last = bookings[bookings.length - 1]?.completedAt || bookings[bookings.length - 1]?.completion?.customerConfirmedAt;
  if (first && last && last.getTime() - first.getTime() < 24 * 60 * 60 * 1000) {
    signals.push('MILESTONE_REACHED_WITHIN_24_HOURS');
  }

  return signals;
};

const createLoyaltyPromotion = async (input: {
  rewardId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  milestone: number;
  countryCode: string;
  currency: string;
  amountMinor: number;
}) => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = `PADILOY${input.milestone}${randomSuffix()}`.replace(/[^A-Z0-9]/g, '').slice(0, 18);
    try {
      return await Promotion.create({
        code,
        name: `Padi loyalty reward - ${input.milestone} jobs`,
        description: LOYALTY_REWARD_DESCRIPTION,
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
        firstBookingOnly: false,
        priority: 12,
        stackingPolicy: PromotionStackingPolicy.EXCLUSIVE,
        fundingSource: PromotionFundingSource.PLATFORM,
        fundingSplitBps: { platform: 10000, technician: 0, partner: 0 },
        usageLimit: 1,
        perClientLimit: 1,
        startsAt: new Date(),
        expiresAt: rewardExpiry(),
        metadata: {
          source: 'CUSTOMER_LOYALTY_REWARD',
          rewardId: input.rewardId.toString(),
          milestone: input.milestone,
          fraudControls: [
            'PAID_COMPLETED_CUSTOMER_CONFIRMED_BOOKINGS_ONLY',
            'ONE_REWARD_PER_MILESTONE',
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
  throw new Error('Unable to generate a unique loyalty promotion code.');
};

const serializeReward = (reward: any) => ({
  id: reward._id?.toString() || reward.id,
  milestone: Number(reward.milestone || 0),
  rewardType: reward.rewardType,
  title: reward.title || '',
  description: reward.description || '',
  status: reward.status,
  countryCode: reward.countryCode || '',
  city: reward.city || '',
  promotionCode: reward.promotionCode || reward.promotionId?.code || '',
  partnerName: reward.partnerName || '',
  partnerVoucherCode: reward.partnerVoucherCode || '',
  rewardValueMinor: reward.rewardValueMinor ?? null,
  currency: reward.currency || null,
  expiresAt: reward.expiresAt || null,
  claimedAt: reward.claimedAt || null,
  redeemedAt: reward.redeemedAt || null,
  blockedAt: reward.blockedAt || null,
  blockReason: reward.blockReason || '',
  fraudSignals: reward.fraudSignals || [],
  earnedFromBookingId: reward.earnedFromBookingId?.toString?.() || '',
  qualifyingBookingCount: Array.isArray(reward.qualifyingBookingIds) ? reward.qualifyingBookingIds.length : 0,
  createdAt: reward.createdAt,
  updatedAt: reward.updatedAt,
});

export const serializeCustomerLoyaltyReward = serializeReward;

export const processCustomerLoyaltyRewardForCompletedBooking = async (booking: IBooking): Promise<void> => {
  if (!isQualifyingBooking(booking)) return;

  const qualifyingBookings = await Booking.find(qualifyingBookingQuery(booking.customerId))
    .sort({ completedAt: 1, updatedAt: 1 })
    .limit(LOYALTY_MILESTONE_JOBS)
    .exec();

  if (qualifyingBookings.length < LOYALTY_MILESTONE_JOBS) return;

  const milestoneBooking = qualifyingBookings[LOYALTY_MILESTONE_JOBS - 1];
  if (String(milestoneBooking._id) !== String(booking._id)) return;

  const rewardType = configuredRewardType();
  const fraudSignals = await buildFraudSignals(qualifyingBookings, booking);
  const shouldBlock = fraudSignals.includes('BOOKING_NOT_QUALIFYING');
  const now = new Date();

  const reward = await CustomerLoyaltyReward.findOneAndUpdate(
    {
      customerId: booking.customerId,
      milestone: LOYALTY_MILESTONE_JOBS,
    },
    {
      $setOnInsert: {
        customerId: booking.customerId,
        countryCode: booking.countryCode,
        city: booking.generalArea || '',
        milestone: LOYALTY_MILESTONE_JOBS,
        rewardType,
        title: LOYALTY_REWARD_TITLE,
        description: LOYALTY_REWARD_DESCRIPTION,
        status: shouldBlock ? CustomerLoyaltyRewardStatus.BLOCKED : CustomerLoyaltyRewardStatus.EARNED,
        qualifyingBookingIds: qualifyingBookings.map((item) => item._id),
        earnedFromBookingId: booking._id,
        partnerName: rewardType === CustomerLoyaltyRewardType.PARTNER_VOUCHER || rewardType === CustomerLoyaltyRewardType.FREE_SERVICE
          ? LOYALTY_PARTNER_NAME
          : '',
        rewardValueMinor: LOYALTY_REWARD_VALUE_MINOR || null,
        currency: booking.currency,
        expiresAt: rewardExpiry(),
        blockedAt: shouldBlock ? now : null,
        blockReason: shouldBlock ? fraudSignals.join(', ') : '',
        fraudSignals,
        metadata: {
          source: 'CUSTOMER_LOYALTY_MILESTONE',
          rewardPolicy: 'first_milestone_only',
          milestoneCompletedAt: now,
        },
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  if (!reward || reward.status === CustomerLoyaltyRewardStatus.BLOCKED) return;

  if (rewardType === CustomerLoyaltyRewardType.PADI_DISCOUNT && !reward.promotionId && LOYALTY_REWARD_VALUE_MINOR > 0) {
    const promotion = await createLoyaltyPromotion({
      rewardId: reward._id,
      customerId: booking.customerId,
      milestone: LOYALTY_MILESTONE_JOBS,
      countryCode: booking.countryCode,
      currency: booking.currency,
      amountMinor: LOYALTY_REWARD_VALUE_MINOR,
    });
    await CustomerLoyaltyReward.updateOne(
      { _id: reward._id, promotionId: null },
      {
        $set: {
          promotionId: promotion._id,
          promotionCode: promotion.code || '',
        },
      }
    );
  }

  await createNotifications({
    userId: booking.customerId,
    email: booking.customerEmail,
    name: booking.customerName,
    channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
    type: 'CUSTOMER_LOYALTY_REWARD_EARNED',
    title: 'You earned a Padi reward',
    message: `${LOYALTY_REWARD_TITLE} is ready after ${LOYALTY_MILESTONE_JOBS} completed paid jobs.`,
    metadata: {
      rewardId: reward._id.toString(),
      milestone: LOYALTY_MILESTONE_JOBS,
      rewardType,
    },
  });
};

export const getCustomerLoyaltyProgram = async (customerId: mongoose.Types.ObjectId | string) => {
  const [qualifyingCount, rewards] = await Promise.all([
    Booking.countDocuments(qualifyingBookingQuery(customerId)),
    CustomerLoyaltyReward.find({ customerId: new mongoose.Types.ObjectId(String(customerId)) })
      .populate('promotionId', 'code status redemptionCount expiresAt')
      .sort({ milestone: 1, createdAt: -1 })
      .lean(),
  ]);

  return {
    milestone: LOYALTY_MILESTONE_JOBS,
    completedCount: qualifyingCount,
    remainingCount: Math.max(LOYALTY_MILESTONE_JOBS - qualifyingCount, 0),
    nextRewardTitle: LOYALTY_REWARD_TITLE,
    nextRewardDescription: LOYALTY_REWARD_DESCRIPTION,
    nextRewardType: configuredRewardType(),
    rewards: rewards.map(serializeReward),
  };
};

export const listCustomerLoyaltyRewardsForAdmin = async (filter: Record<string, unknown> = {}) => {
  const rewards = await CustomerLoyaltyReward.find(filter)
    .populate('customerId', 'name email phone countryCode')
    .populate('promotionId', 'code status redemptionCount expiresAt')
    .sort({ updatedAt: -1 })
    .limit(200)
    .lean();
  return rewards.map((reward: any) => ({
    ...serializeReward(reward),
    customer: reward.customerId
      ? {
          id: reward.customerId._id?.toString(),
          name: reward.customerId.name || '',
          email: reward.customerId.email || '',
          phone: reward.customerId.phone || '',
        }
      : null,
    rewardRedeemed: reward.status === CustomerLoyaltyRewardStatus.REDEEMED || Number(reward.promotionId?.redemptionCount || 0) > 0,
  }));
};
