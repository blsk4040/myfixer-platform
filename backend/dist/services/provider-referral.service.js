"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listReferralRewardsForAdmin = exports.getProviderReferralSummary = exports.processReferralRewardForCompletedBooking = exports.markReferralFirstBookingCreated = exports.recordCustomerReferral = exports.findProviderByReferralCode = exports.getOrCreateProviderReferralCode = exports.getProviderReferralEligibility = exports.PROVIDER_REFERRAL_MIN_RELIABILITY_SCORE = exports.PROVIDER_REFERRAL_REQUIRED_COMPLETED_JOBS = exports.normalizeReferralCode = void 0;
const crypto_1 = __importDefault(require("crypto"));
const mongoose_1 = __importDefault(require("mongoose"));
const booking_model_1 = __importStar(require("../models/booking.model"));
const provider_referral_model_1 = __importStar(require("../models/provider-referral.model"));
const promotion_model_1 = __importStar(require("../models/promotion.model"));
const technician_model_1 = __importStar(require("../models/technician.model"));
const user_model_1 = __importDefault(require("../models/user.model"));
const notification_service_1 = require("./notification.service");
const notification_model_1 = require("../models/notification.model");
const normalizeReferralCode = (value) => typeof value === 'string'
    ? value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 24)
    : '';
exports.normalizeReferralCode = normalizeReferralCode;
const baseCodeFromName = (name) => {
    const cleaned = name.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return (cleaned || 'PADI').slice(0, 6);
};
const randomSuffix = () => crypto_1.default.randomBytes(3).toString('hex').toUpperCase();
const DEFAULT_REWARD_AMOUNT_MINOR = Number.isFinite(Number(process.env.REFERRAL_REWARD_AMOUNT_MINOR))
    ? Math.max(0, Math.round(Number(process.env.REFERRAL_REWARD_AMOUNT_MINOR)))
    : 5000;
const DEFAULT_REWARD_EXPIRY_DAYS = Number.isFinite(Number(process.env.REFERRAL_REWARD_EXPIRY_DAYS))
    ? Math.max(1, Math.round(Number(process.env.REFERRAL_REWARD_EXPIRY_DAYS)))
    : 30;
exports.PROVIDER_REFERRAL_REQUIRED_COMPLETED_JOBS = Number.isFinite(Number(process.env.PROVIDER_REFERRAL_REQUIRED_COMPLETED_JOBS))
    ? Math.max(0, Math.round(Number(process.env.PROVIDER_REFERRAL_REQUIRED_COMPLETED_JOBS)))
    : 3;
exports.PROVIDER_REFERRAL_MIN_RELIABILITY_SCORE = Number.isFinite(Number(process.env.PROVIDER_REFERRAL_MIN_RELIABILITY_SCORE))
    ? Math.min(100, Math.max(0, Math.round(Number(process.env.PROVIDER_REFERRAL_MIN_RELIABILITY_SCORE))))
    : 80;
const providerPaidCompletedBookingCount = (technicianId) => booking_model_1.default.countDocuments({
    technicianId: new mongoose_1.default.Types.ObjectId(String(technicianId)),
    status: booking_model_1.BookingStatus.COMPLETED,
    paymentStatus: booking_model_1.BookingPaymentStatus.SECURED,
    priceMinor: { $gt: 0 },
});
const getProviderReferralEligibility = async (technician) => {
    const populatedUser = technician.userId;
    const userActive = populatedUser?.isActive !== false;
    const accountApproved = userActive && technician.approvalStatus === technician_model_1.TechnicianApprovalStatus.APPROVED;
    const profilePhotoApproved = technician.documents?.profilePhotoStatus === technician_model_1.VerificationStatus.VERIFIED;
    const marketReady = Boolean(String(technician.countryCode || '').trim() && String(technician.city || '').trim());
    const trustReady = Number(technician.strikesCount || 0) === 0 &&
        Number(technician.reliabilityScore ?? 100) >= exports.PROVIDER_REFERRAL_MIN_RELIABILITY_SCORE;
    const completedJobs = Math.max(Number(technician.stats?.completedJobs || 0), await providerPaidCompletedBookingCount(technician._id));
    const reasons = [];
    if (!accountApproved)
        reasons.push('Your Padi Pro account must be approved and active.');
    if (!profilePhotoApproved)
        reasons.push('Your profile photo must be approved.');
    if (!marketReady)
        reasons.push('Your operating country and city must be set.');
    if (!trustReady)
        reasons.push('Your account must have no active trust restrictions.');
    if (completedJobs < exports.PROVIDER_REFERRAL_REQUIRED_COMPLETED_JOBS) {
        reasons.push(`Complete ${exports.PROVIDER_REFERRAL_REQUIRED_COMPLETED_JOBS} paid jobs to unlock customer invites.`);
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
        requiredCompletedJobs: exports.PROVIDER_REFERRAL_REQUIRED_COMPLETED_JOBS,
        accountApproved,
        profilePhotoApproved,
        marketReady,
        trustReady,
    };
};
exports.getProviderReferralEligibility = getProviderReferralEligibility;
const getOrCreateProviderReferralCode = async (technician, providerName = '') => {
    const existing = (0, exports.normalizeReferralCode)(technician.referralCode);
    if (existing)
        return existing;
    const baseCode = baseCodeFromName(providerName);
    for (let attempt = 0; attempt < 8; attempt += 1) {
        const candidate = `${baseCode}${randomSuffix()}`.slice(0, 12);
        const duplicate = await technician_model_1.default.exists({ referralCode: candidate });
        if (duplicate)
            continue;
        technician.referralCode = candidate;
        await technician.save();
        return candidate;
    }
    const fallback = `PADI${Date.now().toString(36).toUpperCase()}`.slice(0, 14);
    technician.referralCode = fallback;
    await technician.save();
    return fallback;
};
exports.getOrCreateProviderReferralCode = getOrCreateProviderReferralCode;
const findProviderByReferralCode = async (rawCode) => {
    const referralCode = (0, exports.normalizeReferralCode)(rawCode);
    if (!referralCode)
        return null;
    return technician_model_1.default.findOne({ referralCode })
        .populate('userId', 'name email isActive countryCode location')
        .exec();
};
exports.findProviderByReferralCode = findProviderByReferralCode;
const recordCustomerReferral = async (input) => {
    const referralCode = (0, exports.normalizeReferralCode)(input.referralCode);
    if (!referralCode)
        return false;
    const referrer = await (0, exports.findProviderByReferralCode)(referralCode);
    if (!referrer)
        return false;
    const referrerUserId = referrer.userId?._id || referrer.userId;
    if (!referrerUserId || String(referrerUserId) === String(input.customerId))
        return false;
    await provider_referral_model_1.default.updateOne({ referredCustomerId: input.customerId }, {
        $setOnInsert: {
            referralCode,
            referrerUserId,
            referrerTechnicianId: referrer._id,
            referredCustomerId: input.customerId,
            referredCustomerEmail: input.customerEmail.toLowerCase().trim(),
            countryCode: input.countryCode,
            city: input.city || '',
            status: provider_referral_model_1.ProviderReferralStatus.REGISTERED,
            registeredAt: new Date(),
            metadata: {
                source: input.source || 'CUSTOMER_SIGNUP',
            },
        },
    }, { upsert: true });
    await user_model_1.default.updateOne({ _id: input.customerId, 'metadata.referredByCode': { $exists: false } }, {
        $set: {
            'metadata.referredByCode': referralCode,
            'metadata.referredByTechnicianId': referrer._id.toString(),
            'metadata.referredByUserId': String(referrerUserId),
            'metadata.referredAt': new Date(),
        },
    });
    return true;
};
exports.recordCustomerReferral = recordCustomerReferral;
const markReferralFirstBookingCreated = async (input) => {
    const customerObjectId = new mongoose_1.default.Types.ObjectId(String(input.customerId));
    const bookingObjectId = new mongoose_1.default.Types.ObjectId(String(input.bookingId));
    const now = new Date();
    await provider_referral_model_1.default.updateOne({
        referredCustomerId: customerObjectId,
        firstBookingId: null,
        status: provider_referral_model_1.ProviderReferralStatus.REGISTERED,
    }, {
        $set: {
            firstBookingId: bookingObjectId,
            firstBookingAt: now,
            status: provider_referral_model_1.ProviderReferralStatus.FIRST_BOOKING_CREATED,
        },
    });
};
exports.markReferralFirstBookingCreated = markReferralFirstBookingCreated;
const generateRewardCode = (referralCode) => `PADI${referralCode.slice(0, 6)}${randomSuffix()}`.replace(/[^A-Z0-9]/g, '').slice(0, 18);
const blockReferralReward = async (referralId, reason, metadata = {}) => {
    await provider_referral_model_1.default.updateOne({ _id: referralId, status: { $ne: provider_referral_model_1.ProviderReferralStatus.REWARD_ELIGIBLE } }, {
        $set: {
            status: provider_referral_model_1.ProviderReferralStatus.REWARD_BLOCKED,
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
        },
    });
};
const paidCompletedBookingCount = (customerId) => booking_model_1.default.countDocuments({
    customerId,
    status: booking_model_1.BookingStatus.COMPLETED,
    paymentStatus: booking_model_1.BookingPaymentStatus.SECURED,
    priceMinor: { $gt: 0 },
});
const rewardFraudCheck = async (booking, referral) => {
    if (booking.status !== booking_model_1.BookingStatus.COMPLETED)
        return 'BOOKING_NOT_COMPLETED';
    if (booking.paymentStatus !== booking_model_1.BookingPaymentStatus.SECURED)
        return 'PAYMENT_NOT_SECURED';
    if (booking.priceMinor <= 0)
        return 'ZERO_VALUE_BOOKING';
    if (booking.completion?.status !== booking_model_1.CompletionStatus.CUSTOMER_CONFIRMED)
        return 'CUSTOMER_COMPLETION_NOT_CONFIRMED';
    if (!booking.technicianId)
        return 'NO_ASSIGNED_PROVIDER';
    if (String(booking.customerId) !== String(referral.referredCustomerId))
        return 'CUSTOMER_MISMATCH';
    if (String(referral.referrerUserId) === String(referral.referredCustomerId))
        return 'SELF_REFERRAL';
    const completedCount = await paidCompletedBookingCount(booking.customerId);
    if (completedCount !== 1)
        return 'NOT_FIRST_PAID_COMPLETED_BOOKING';
    return '';
};
const createReferralRewardPromotion = async (input) => {
    const expiresAt = new Date(Date.now() + DEFAULT_REWARD_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    for (let attempt = 0; attempt < 8; attempt += 1) {
        const code = generateRewardCode(input.referralCode);
        try {
            const promotion = await promotion_model_1.default.create({
                code,
                name: 'Referral reward',
                description: 'Thank you for joining Padi through a Padi Pro invite.',
                status: promotion_model_1.PromotionStatus.ACTIVE,
                triggerType: promotion_model_1.PromotionTriggerType.CODE,
                discountType: promotion_model_1.PromotionDiscountType.FIXED_AMOUNT,
                discountValue: DEFAULT_REWARD_AMOUNT_MINOR,
                maxDiscountMinor: DEFAULT_REWARD_AMOUNT_MINOR,
                minBookingAmountMinor: DEFAULT_REWARD_AMOUNT_MINOR,
                countryCode: input.countryCode,
                currency: input.currency,
                eligibleClientIds: [input.customerId],
                excludedClientIds: [],
                firstBookingOnly: false,
                priority: 10,
                stackingPolicy: promotion_model_1.PromotionStackingPolicy.EXCLUSIVE,
                fundingSource: promotion_model_1.PromotionFundingSource.PLATFORM,
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
        }
        catch (error) {
            if (error?.code !== 11000)
                throw error;
        }
    }
    throw new Error('Unable to generate a unique referral reward code.');
};
const processReferralRewardForCompletedBooking = async (booking) => {
    const referral = await provider_referral_model_1.default.findOne({
        referredCustomerId: booking.customerId,
        rewardPromotionId: null,
        status: { $in: [provider_referral_model_1.ProviderReferralStatus.REGISTERED, provider_referral_model_1.ProviderReferralStatus.FIRST_BOOKING_CREATED, provider_referral_model_1.ProviderReferralStatus.FIRST_JOB_COMPLETED] },
    });
    if (!referral)
        return;
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
    const updateResult = await provider_referral_model_1.default.updateOne({
        _id: referral._id,
        rewardPromotionId: null,
        status: { $ne: provider_referral_model_1.ProviderReferralStatus.REWARD_ELIGIBLE },
    }, {
        $set: {
            status: provider_referral_model_1.ProviderReferralStatus.REWARD_ELIGIBLE,
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
        },
    });
    if (updateResult.modifiedCount !== 1) {
        await promotion_model_1.default.updateOne({ _id: promotion._id }, {
            $set: {
                status: promotion_model_1.PromotionStatus.ARCHIVED,
                'metadata.archivedReason': 'REFERRAL_REWARD_RACE_LOST',
            },
        });
        return;
    }
    await (0, notification_service_1.createNotifications)({
        userId: booking.customerId,
        channels: [notification_model_1.NotificationChannel.IN_APP, notification_model_1.NotificationChannel.PUSH],
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
exports.processReferralRewardForCompletedBooking = processReferralRewardForCompletedBooking;
const getProviderReferralSummary = async (technicianId) => {
    const referrals = await provider_referral_model_1.default.aggregate([
        { $match: { referrerTechnicianId: new mongoose_1.default.Types.ObjectId(String(technicianId)) } },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
            },
        },
    ]);
    const counts = referrals.reduce((acc, item) => {
        acc[String(item._id)] = Number(item.count || 0);
        return acc;
    }, {});
    return {
        registeredCount: counts[provider_referral_model_1.ProviderReferralStatus.REGISTERED] || 0,
        firstBookingCount: counts[provider_referral_model_1.ProviderReferralStatus.FIRST_BOOKING_CREATED] || 0,
        completedCount: (counts[provider_referral_model_1.ProviderReferralStatus.FIRST_JOB_COMPLETED] || 0) + (counts[provider_referral_model_1.ProviderReferralStatus.REWARD_ELIGIBLE] || 0),
        rewardEligibleCount: counts[provider_referral_model_1.ProviderReferralStatus.REWARD_ELIGIBLE] || 0,
        rewardBlockedCount: counts[provider_referral_model_1.ProviderReferralStatus.REWARD_BLOCKED] || 0,
    };
};
exports.getProviderReferralSummary = getProviderReferralSummary;
const listReferralRewardsForAdmin = async (filter = {}) => {
    const referrals = await provider_referral_model_1.default.find(filter)
        .populate('referrerUserId', 'name email phone countryCode')
        .populate('referredCustomerId', 'name email phone countryCode')
        .populate('rewardPromotionId', 'code status usageCount redemptionCount expiresAt redeemedBudgetMinor')
        .sort({ updatedAt: -1 })
        .limit(200)
        .lean();
    return referrals.map((referral) => ({
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
exports.listReferralRewardsForAdmin = listReferralRewardsForAdmin;
//# sourceMappingURL=provider-referral.service.js.map