import crypto from 'crypto';
import mongoose from 'mongoose';
import Booking, { BookingPaymentStatus, BookingStatus, CompletionStatus, IBooking } from '../models/booking.model';
import ProviderReferral, { ProviderReferralStatus } from '../models/provider-referral.model';
import Promotion, {
  PromotionDiscountType,
  PromotionFundingSource,
  PromotionStackingPolicy,
  PromotionStatus,
  PromotionTriggerType,
} from '../models/promotion.model';
import Technician, { ITechnicianDocument, TechnicianApprovalStatus, VerificationStatus } from '../models/technician.model';
import User from '../models/user.model';
import { createNotifications } from './notification.service';
import { NotificationChannel } from '../models/notification.model';

export const normalizeReferralCode = (value: unknown): string =>
  typeof value === 'string'
    ? value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 24)
    : '';

const baseCodeFromName = (name: string): string => {
  const cleaned = name.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return (cleaned || 'PADI').slice(0, 6);
};

const randomSuffix = (): string => crypto.randomBytes(3).toString('hex').toUpperCase();
const DEFAULT_REWARD_AMOUNT_MINOR = Number.isFinite(Number(process.env.REFERRAL_REWARD_AMOUNT_MINOR))
  ? Math.max(0, Math.round(Number(process.env.REFERRAL_REWARD_AMOUNT_MINOR)))
  : 5000;
const DEFAULT_REWARD_EXPIRY_DAYS = Number.isFinite(Number(process.env.REFERRAL_REWARD_EXPIRY_DAYS))
  ? Math.max(1, Math.round(Number(process.env.REFERRAL_REWARD_EXPIRY_DAYS)))
  : 30;
export const PROVIDER_REFERRAL_REQUIRED_COMPLETED_JOBS = Number.isFinite(Number(process.env.PROVIDER_REFERRAL_REQUIRED_COMPLETED_JOBS))
  ? Math.max(0, Math.round(Number(process.env.PROVIDER_REFERRAL_REQUIRED_COMPLETED_JOBS)))
  : 3;
export const PROVIDER_REFERRAL_MIN_RELIABILITY_SCORE = Number.isFinite(Number(process.env.PROVIDER_REFERRAL_MIN_RELIABILITY_SCORE))
  ? Math.min(100, Math.max(0, Math.round(Number(process.env.PROVIDER_REFERRAL_MIN_RELIABILITY_SCORE))))
  : 80;

export interface ProviderReferralEligibility {
  eligible: boolean;
  status: 'ELIGIBLE' | 'LOCKED';
  reason: string;
  reasons: string[];
  completedJobs: number;
  requiredCompletedJobs: number;
  accountApproved: boolean;
  profilePhotoApproved: boolean;
  marketReady: boolean;
  trustReady: boolean;
}

const providerPaidCompletedBookingCount = (technicianId: mongoose.Types.ObjectId | string) =>
  Booking.countDocuments({
    technicianId: new mongoose.Types.ObjectId(String(technicianId)),
    status: BookingStatus.COMPLETED,
    paymentStatus: BookingPaymentStatus.SECURED,
    priceMinor: { $gt: 0 },
  });

export const getProviderReferralEligibility = async (
  technician: ITechnicianDocument
): Promise<ProviderReferralEligibility> => {
  const populatedUser = technician.userId as any;
  const userActive = populatedUser?.isActive !== false;
  const accountApproved = userActive && technician.approvalStatus === TechnicianApprovalStatus.APPROVED;
  const profilePhotoApproved = technician.documents?.profilePhotoStatus === VerificationStatus.VERIFIED;
  const marketReady = Boolean(String(technician.countryCode || '').trim() && String(technician.city || '').trim());
  const trustReady =
    Number(technician.strikesCount || 0) === 0 &&
    Number(technician.reliabilityScore ?? 100) >= PROVIDER_REFERRAL_MIN_RELIABILITY_SCORE;
  const completedJobs = Math.max(
    Number(technician.stats?.completedJobs || 0),
    await providerPaidCompletedBookingCount(technician._id)
  );

  const reasons: string[] = [];
  if (!accountApproved) reasons.push('Your Padi Pro account must be approved and active.');
  if (!profilePhotoApproved) reasons.push('Your profile photo must be approved.');
  if (!marketReady) reasons.push('Your operating country and city must be set.');
  if (!trustReady) reasons.push('Your account must have no active trust restrictions.');
  if (completedJobs < PROVIDER_REFERRAL_REQUIRED_COMPLETED_JOBS) {
    reasons.push(`Complete ${PROVIDER_REFERRAL_REQUIRED_COMPLETED_JOBS} paid jobs to unlock customer invites.`);
  }

  const eligible = reasons.length === 0;
  return {
    eligible,
    status: eligible ? 'ELIGIBLE' : 'LOCKED',
    reason: eligible
      ? 'You can invite customers. Rewards are issued only after a legitimate paid completed booking.'
      : reasons[0],
    reasons,
    completedJobs,
    requiredCompletedJobs: PROVIDER_REFERRAL_REQUIRED_COMPLETED_JOBS,
    accountApproved,
    profilePhotoApproved,
    marketReady,
    trustReady,
  };
};

export const getOrCreateProviderReferralCode = async (
  technician: ITechnicianDocument,
  providerName = ''
): Promise<string> => {
  const existing = normalizeReferralCode(technician.referralCode);
  if (existing) return existing;

  const baseCode = baseCodeFromName(providerName);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = `${baseCode}${randomSuffix()}`.slice(0, 12);
    const duplicate = await Technician.exists({ referralCode: candidate });
    if (duplicate) continue;

    technician.referralCode = candidate;
    await technician.save();
    return candidate;
  }

  const fallback = `PADI${Date.now().toString(36).toUpperCase()}`.slice(0, 14);
  technician.referralCode = fallback;
  await technician.save();
  return fallback;
};

export const findProviderByReferralCode = async (rawCode: unknown) => {
  const referralCode = normalizeReferralCode(rawCode);
  if (!referralCode) return null;

  return Technician.findOne({ referralCode })
    .populate('userId', 'name email isActive countryCode location')
    .exec();
};

export const recordCustomerReferral = async (input: {
  referralCode?: unknown;
  customerId: mongoose.Types.ObjectId;
  customerEmail: string;
  countryCode: string;
  city?: string;
  source?: string;
}): Promise<boolean> => {
  const referralCode = normalizeReferralCode(input.referralCode);
  if (!referralCode) return false;

  const referrer = await findProviderByReferralCode(referralCode);
  if (!referrer) return false;

  const referrerUserId = referrer.userId?._id || referrer.userId;
  if (!referrerUserId || String(referrerUserId) === String(input.customerId)) return false;

  await ProviderReferral.updateOne(
    { referredCustomerId: input.customerId },
    {
      $setOnInsert: {
        referralCode,
        referrerUserId,
        referrerTechnicianId: referrer._id,
        referredCustomerId: input.customerId,
        referredCustomerEmail: input.customerEmail.toLowerCase().trim(),
        countryCode: input.countryCode,
        city: input.city || '',
        status: ProviderReferralStatus.REGISTERED,
        registeredAt: new Date(),
        metadata: {
          source: input.source || 'CUSTOMER_SIGNUP',
        },
      },
    },
    { upsert: true }
  );

  await User.updateOne(
    { _id: input.customerId, 'metadata.referredByCode': { $exists: false } },
    {
      $set: {
        'metadata.referredByCode': referralCode,
        'metadata.referredByTechnicianId': referrer._id.toString(),
        'metadata.referredByUserId': String(referrerUserId),
        'metadata.referredAt': new Date(),
      },
    }
  );

  return true;
};

export const markReferralFirstBookingCreated = async (input: {
  customerId: mongoose.Types.ObjectId | string;
  bookingId: mongoose.Types.ObjectId | string;
}): Promise<void> => {
  const customerObjectId = new mongoose.Types.ObjectId(String(input.customerId));
  const bookingObjectId = new mongoose.Types.ObjectId(String(input.bookingId));
  const now = new Date();

  await ProviderReferral.updateOne(
    {
      referredCustomerId: customerObjectId,
      firstBookingId: null,
      status: ProviderReferralStatus.REGISTERED,
    },
    {
      $set: {
        firstBookingId: bookingObjectId,
        firstBookingAt: now,
        status: ProviderReferralStatus.FIRST_BOOKING_CREATED,
      },
    }
  );
};

const generateRewardCode = (referralCode: string): string =>
  `PADI${referralCode.slice(0, 6)}${randomSuffix()}`.replace(/[^A-Z0-9]/g, '').slice(0, 18);

const blockReferralReward = async (
  referralId: mongoose.Types.ObjectId | string,
  reason: string,
  metadata: Record<string, unknown> = {}
): Promise<void> => {
  await ProviderReferral.updateOne(
    { _id: referralId, status: { $ne: ProviderReferralStatus.REWARD_ELIGIBLE } },
    {
      $set: {
        status: ProviderReferralStatus.REWARD_BLOCKED,
        rewardBlockedAt: new Date(),
        rewardBlockReason: reason,
      },
      $setOnInsert: {},
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

const paidCompletedBookingCount = (customerId: mongoose.Types.ObjectId) =>
  Booking.countDocuments({
    customerId,
    status: BookingStatus.COMPLETED,
    paymentStatus: BookingPaymentStatus.SECURED,
    priceMinor: { $gt: 0 },
  });

const rewardFraudCheck = async (booking: IBooking, referral: any): Promise<string> => {
  if (booking.status !== BookingStatus.COMPLETED) return 'BOOKING_NOT_COMPLETED';
  if (booking.paymentStatus !== BookingPaymentStatus.SECURED) return 'PAYMENT_NOT_SECURED';
  if (booking.priceMinor <= 0) return 'ZERO_VALUE_BOOKING';
  if (booking.completion?.status !== CompletionStatus.CUSTOMER_CONFIRMED) return 'CUSTOMER_COMPLETION_NOT_CONFIRMED';
  if (!booking.technicianId) return 'NO_ASSIGNED_PROVIDER';
  if (String(booking.customerId) !== String(referral.referredCustomerId)) return 'CUSTOMER_MISMATCH';
  if (String(referral.referrerUserId) === String(referral.referredCustomerId)) return 'SELF_REFERRAL';
  const completedCount = await paidCompletedBookingCount(booking.customerId);
  if (completedCount !== 1) return 'NOT_FIRST_PAID_COMPLETED_BOOKING';
  return '';
};

const createReferralRewardPromotion = async (input: {
  referralId: mongoose.Types.ObjectId;
  referralCode: string;
  customerId: mongoose.Types.ObjectId;
  countryCode: string;
  currency: string;
  bookingId: mongoose.Types.ObjectId;
}) => {
  const expiresAt = new Date(Date.now() + DEFAULT_REWARD_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateRewardCode(input.referralCode);
    try {
      const promotion = await Promotion.create({
        code,
        name: 'Referral reward',
        description: 'Thank you for joining Padi through a Padi Pro invite.',
        status: PromotionStatus.ACTIVE,
        triggerType: PromotionTriggerType.CODE,
        discountType: PromotionDiscountType.FIXED_AMOUNT,
        discountValue: DEFAULT_REWARD_AMOUNT_MINOR,
        maxDiscountMinor: DEFAULT_REWARD_AMOUNT_MINOR,
        minBookingAmountMinor: DEFAULT_REWARD_AMOUNT_MINOR,
        countryCode: input.countryCode,
        currency: input.currency,
        eligibleClientIds: [input.customerId],
        excludedClientIds: [],
        firstBookingOnly: false,
        priority: 10,
        stackingPolicy: PromotionStackingPolicy.EXCLUSIVE,
        fundingSource: PromotionFundingSource.PLATFORM,
        fundingSplitBps: { platform: 10000, technician: 0, partner: 0 },
        usageLimit: 1,
        perClientLimit: 1,
        startsAt: new Date(),
        expiresAt,
        metadata: {
          source: 'PROVIDER_REFERRAL_REWARD',
          referralId: input.referralId.toString(),
          referralCode: input.referralCode,
          qualifyingBookingId: input.bookingId.toString(),
          rewardType: 'CUSTOMER_NEXT_BOOKING_PROMO',
          fraudControls: [
            'ONE_REFERRAL_PER_CUSTOMER',
            'FIRST_PAID_COMPLETED_BOOKING_ONLY',
            'CUSTOMER_CONFIRMED_COMPLETION_REQUIRED',
            'CUSTOMER_LOCKED_PROMO',
            'ONE_USE_ONLY',
            'ZERO_VALUE_BOOKINGS_BLOCKED',
          ],
        },
      });
      return promotion;
    } catch (error: any) {
      if (error?.code !== 11000) throw error;
    }
  }

  throw new Error('Unable to generate a unique referral reward code.');
};

export const processReferralRewardForCompletedBooking = async (booking: IBooking): Promise<void> => {
  const referral = await ProviderReferral.findOne({
    referredCustomerId: booking.customerId,
    rewardPromotionId: null,
    status: { $in: [ProviderReferralStatus.REGISTERED, ProviderReferralStatus.FIRST_BOOKING_CREATED, ProviderReferralStatus.FIRST_JOB_COMPLETED] },
  });

  if (!referral) return;

  const blockReason = await rewardFraudCheck(booking, referral);
  if (blockReason) {
    await blockReferralReward(referral._id, blockReason, { bookingId: booking._id.toString() });
    return;
  }

  const promotion = await createReferralRewardPromotion({
    referralId: referral._id,
    referralCode: referral.referralCode,
    customerId: booking.customerId,
    countryCode: booking.countryCode,
    currency: booking.currency,
    bookingId: booking._id,
  });

  const updateResult = await ProviderReferral.updateOne(
    {
      _id: referral._id,
      rewardPromotionId: null,
      status: { $ne: ProviderReferralStatus.REWARD_ELIGIBLE },
    },
    {
      $set: {
        status: ProviderReferralStatus.REWARD_ELIGIBLE,
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
          'metadata.archivedReason': 'REFERRAL_REWARD_RACE_LOST',
        },
      }
    );
    return;
  }

  await createNotifications({
    userId: booking.customerId,
    channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
    type: 'REFERRAL_REWARD_ISSUED',
    title: 'Your Padi reward is ready',
    message: `Use code ${promotion.code} on your next qualifying booking.`,
    metadata: {
      referralId: referral._id.toString(),
      promotionId: promotion._id.toString(),
      rewardCode: promotion.code || '',
      qualifyingBookingId: booking._id.toString(),
    },
  });
};

export const getProviderReferralSummary = async (technicianId: mongoose.Types.ObjectId | string) => {
  const referrals = await ProviderReferral.aggregate([
    { $match: { referrerTechnicianId: new mongoose.Types.ObjectId(String(technicianId)) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  const counts = referrals.reduce<Record<string, number>>((acc, item) => {
    acc[String(item._id)] = Number(item.count || 0);
    return acc;
  }, {});

  return {
    registeredCount: counts[ProviderReferralStatus.REGISTERED] || 0,
    firstBookingCount: counts[ProviderReferralStatus.FIRST_BOOKING_CREATED] || 0,
    completedCount: (counts[ProviderReferralStatus.FIRST_JOB_COMPLETED] || 0) + (counts[ProviderReferralStatus.REWARD_ELIGIBLE] || 0),
    rewardEligibleCount: counts[ProviderReferralStatus.REWARD_ELIGIBLE] || 0,
    rewardBlockedCount: counts[ProviderReferralStatus.REWARD_BLOCKED] || 0,
  };
};

export const listReferralRewardsForAdmin = async (filter: Record<string, unknown> = {}) => {
  const referrals = await ProviderReferral.find(filter)
    .populate('referrerUserId', 'name email phone countryCode')
    .populate('referredCustomerId', 'name email phone countryCode')
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
    referrer: referral.referrerUserId
      ? {
          id: referral.referrerUserId._id?.toString(),
          name: referral.referrerUserId.name,
          email: referral.referrerUserId.email,
        }
      : null,
    customer: referral.referredCustomerId
      ? {
          id: referral.referredCustomerId._id?.toString(),
          name: referral.referredCustomerId.name,
          email: referral.referredCustomerId.email,
        }
      : null,
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
