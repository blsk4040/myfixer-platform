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
exports.listCustomerLoyaltyRewardsForAdmin = exports.getCustomerLoyaltyProgram = exports.processCustomerLoyaltyRewardForCompletedBooking = exports.serializeCustomerLoyaltyReward = exports.LOYALTY_MILESTONE_JOBS = void 0;
const crypto_1 = __importDefault(require("crypto"));
const mongoose_1 = __importDefault(require("mongoose"));
const booking_model_1 = __importStar(require("../models/booking.model"));
const customer_loyalty_reward_model_1 = __importStar(require("../models/customer-loyalty-reward.model"));
const promotion_model_1 = __importStar(require("../models/promotion.model"));
const notification_service_1 = require("./notification.service");
const notification_model_1 = require("../models/notification.model");
const intEnv = (key, fallback, min = 0) => {
    const parsed = Number(process.env[key]);
    if (!Number.isFinite(parsed))
        return fallback;
    return Math.max(min, Math.round(parsed));
};
exports.LOYALTY_MILESTONE_JOBS = intEnv('CUSTOMER_LOYALTY_MILESTONE_JOBS', 5, 1);
const LOYALTY_EXPIRY_DAYS = intEnv('CUSTOMER_LOYALTY_EXPIRY_DAYS', 45, 1);
const LOYALTY_REWARD_VALUE_MINOR = intEnv('CUSTOMER_LOYALTY_REWARD_VALUE_MINOR', 0, 0);
const LOYALTY_REWARD_TITLE = String(process.env.CUSTOMER_LOYALTY_REWARD_TITLE || 'Free car wash').trim();
const LOYALTY_REWARD_DESCRIPTION = String(process.env.CUSTOMER_LOYALTY_REWARD_DESCRIPTION ||
    'A thank-you reward from Padi after completing eligible paid jobs.').trim();
const LOYALTY_PARTNER_NAME = String(process.env.CUSTOMER_LOYALTY_PARTNER_NAME || 'Padi partner').trim();
const configuredRewardType = () => {
    const raw = String(process.env.CUSTOMER_LOYALTY_REWARD_TYPE || customer_loyalty_reward_model_1.CustomerLoyaltyRewardType.FREE_SERVICE).toUpperCase();
    return Object.values(customer_loyalty_reward_model_1.CustomerLoyaltyRewardType).includes(raw)
        ? raw
        : customer_loyalty_reward_model_1.CustomerLoyaltyRewardType.FREE_SERVICE;
};
const randomSuffix = () => crypto_1.default.randomBytes(3).toString('hex').toUpperCase();
const rewardExpiry = () => new Date(Date.now() + LOYALTY_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
const isQualifyingBooking = (booking) => booking.status === booking_model_1.BookingStatus.COMPLETED &&
    booking.paymentStatus === booking_model_1.BookingPaymentStatus.SECURED &&
    booking.completion?.status === booking_model_1.CompletionStatus.CUSTOMER_CONFIRMED &&
    Number(booking.priceMinor || 0) > 0;
const qualifyingBookingQuery = (customerId) => ({
    customerId: new mongoose_1.default.Types.ObjectId(String(customerId)),
    status: booking_model_1.BookingStatus.COMPLETED,
    paymentStatus: booking_model_1.BookingPaymentStatus.SECURED,
    'completion.status': booking_model_1.CompletionStatus.CUSTOMER_CONFIRMED,
    priceMinor: { $gt: 0 },
    cancelledAt: null,
});
const buildFraudSignals = async (bookings, completedBooking) => {
    const signals = [];
    if (!isQualifyingBooking(completedBooking))
        signals.push('BOOKING_NOT_QUALIFYING');
    const providerCounts = new Map();
    const addressCounts = new Map();
    for (const booking of bookings) {
        if (booking.technicianId) {
            const key = booking.technicianId.toString();
            providerCounts.set(key, (providerCounts.get(key) || 0) + 1);
        }
        const address = String(booking.fullAddress || '').trim().toLowerCase();
        if (address)
            addressCounts.set(address, (addressCounts.get(address) || 0) + 1);
    }
    if ([...providerCounts.values()].some((count) => count >= exports.LOYALTY_MILESTONE_JOBS)) {
        signals.push('SAME_PROVIDER_MILESTONE_PATTERN');
    }
    if ([...addressCounts.values()].some((count) => count >= exports.LOYALTY_MILESTONE_JOBS)) {
        signals.push('SAME_ADDRESS_MILESTONE_PATTERN');
    }
    const first = bookings[0]?.completedAt || bookings[0]?.completion?.customerConfirmedAt;
    const last = bookings[bookings.length - 1]?.completedAt || bookings[bookings.length - 1]?.completion?.customerConfirmedAt;
    if (first && last && last.getTime() - first.getTime() < 24 * 60 * 60 * 1000) {
        signals.push('MILESTONE_REACHED_WITHIN_24_HOURS');
    }
    return signals;
};
const createLoyaltyPromotion = async (input) => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
        const code = `PADILOY${input.milestone}${randomSuffix()}`.replace(/[^A-Z0-9]/g, '').slice(0, 18);
        try {
            return await promotion_model_1.default.create({
                code,
                name: `Padi loyalty reward - ${input.milestone} jobs`,
                description: LOYALTY_REWARD_DESCRIPTION,
                status: promotion_model_1.PromotionStatus.ACTIVE,
                triggerType: promotion_model_1.PromotionTriggerType.CODE,
                discountType: promotion_model_1.PromotionDiscountType.FIXED_AMOUNT,
                discountValue: input.amountMinor,
                maxDiscountMinor: input.amountMinor,
                minBookingAmountMinor: input.amountMinor,
                countryCode: input.countryCode,
                currency: input.currency,
                eligibleClientIds: [input.customerId],
                excludedClientIds: [],
                firstBookingOnly: false,
                priority: 12,
                stackingPolicy: promotion_model_1.PromotionStackingPolicy.EXCLUSIVE,
                fundingSource: promotion_model_1.PromotionFundingSource.PLATFORM,
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
        }
        catch (error) {
            if (error?.code !== 11000)
                throw error;
        }
    }
    throw new Error('Unable to generate a unique loyalty promotion code.');
};
const serializeReward = (reward) => ({
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
exports.serializeCustomerLoyaltyReward = serializeReward;
const processCustomerLoyaltyRewardForCompletedBooking = async (booking) => {
    if (!isQualifyingBooking(booking))
        return;
    const qualifyingBookings = await booking_model_1.default.find(qualifyingBookingQuery(booking.customerId))
        .sort({ completedAt: 1, updatedAt: 1 })
        .limit(exports.LOYALTY_MILESTONE_JOBS)
        .exec();
    if (qualifyingBookings.length < exports.LOYALTY_MILESTONE_JOBS)
        return;
    const milestoneBooking = qualifyingBookings[exports.LOYALTY_MILESTONE_JOBS - 1];
    if (String(milestoneBooking._id) !== String(booking._id))
        return;
    const rewardType = configuredRewardType();
    const fraudSignals = await buildFraudSignals(qualifyingBookings, booking);
    const shouldBlock = fraudSignals.includes('BOOKING_NOT_QUALIFYING');
    const now = new Date();
    const reward = await customer_loyalty_reward_model_1.default.findOneAndUpdate({
        customerId: booking.customerId,
        milestone: exports.LOYALTY_MILESTONE_JOBS,
    }, {
        $setOnInsert: {
            customerId: booking.customerId,
            countryCode: booking.countryCode,
            city: booking.generalArea || '',
            milestone: exports.LOYALTY_MILESTONE_JOBS,
            rewardType,
            title: LOYALTY_REWARD_TITLE,
            description: LOYALTY_REWARD_DESCRIPTION,
            status: shouldBlock ? customer_loyalty_reward_model_1.CustomerLoyaltyRewardStatus.BLOCKED : customer_loyalty_reward_model_1.CustomerLoyaltyRewardStatus.EARNED,
            qualifyingBookingIds: qualifyingBookings.map((item) => item._id),
            earnedFromBookingId: booking._id,
            partnerName: rewardType === customer_loyalty_reward_model_1.CustomerLoyaltyRewardType.PARTNER_VOUCHER || rewardType === customer_loyalty_reward_model_1.CustomerLoyaltyRewardType.FREE_SERVICE
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
    }, { new: true, upsert: true, setDefaultsOnInsert: true });
    if (!reward || reward.status === customer_loyalty_reward_model_1.CustomerLoyaltyRewardStatus.BLOCKED)
        return;
    if (rewardType === customer_loyalty_reward_model_1.CustomerLoyaltyRewardType.PADI_DISCOUNT && !reward.promotionId && LOYALTY_REWARD_VALUE_MINOR > 0) {
        const promotion = await createLoyaltyPromotion({
            rewardId: reward._id,
            customerId: booking.customerId,
            milestone: exports.LOYALTY_MILESTONE_JOBS,
            countryCode: booking.countryCode,
            currency: booking.currency,
            amountMinor: LOYALTY_REWARD_VALUE_MINOR,
        });
        await customer_loyalty_reward_model_1.default.updateOne({ _id: reward._id, promotionId: null }, {
            $set: {
                promotionId: promotion._id,
                promotionCode: promotion.code || '',
            },
        });
    }
    await (0, notification_service_1.createNotifications)({
        userId: booking.customerId,
        email: booking.customerEmail,
        name: booking.customerName,
        channels: [notification_model_1.NotificationChannel.IN_APP, notification_model_1.NotificationChannel.PUSH],
        type: 'CUSTOMER_LOYALTY_REWARD_EARNED',
        title: 'You earned a Padi reward',
        message: `${LOYALTY_REWARD_TITLE} is ready after ${exports.LOYALTY_MILESTONE_JOBS} completed paid jobs.`,
        metadata: {
            rewardId: reward._id.toString(),
            milestone: exports.LOYALTY_MILESTONE_JOBS,
            rewardType,
        },
    });
};
exports.processCustomerLoyaltyRewardForCompletedBooking = processCustomerLoyaltyRewardForCompletedBooking;
const getCustomerLoyaltyProgram = async (customerId) => {
    const [qualifyingCount, rewards] = await Promise.all([
        booking_model_1.default.countDocuments(qualifyingBookingQuery(customerId)),
        customer_loyalty_reward_model_1.default.find({ customerId: new mongoose_1.default.Types.ObjectId(String(customerId)) })
            .populate('promotionId', 'code status redemptionCount expiresAt')
            .sort({ milestone: 1, createdAt: -1 })
            .lean(),
    ]);
    return {
        milestone: exports.LOYALTY_MILESTONE_JOBS,
        completedCount: qualifyingCount,
        remainingCount: Math.max(exports.LOYALTY_MILESTONE_JOBS - qualifyingCount, 0),
        nextRewardTitle: LOYALTY_REWARD_TITLE,
        nextRewardDescription: LOYALTY_REWARD_DESCRIPTION,
        nextRewardType: configuredRewardType(),
        rewards: rewards.map(serializeReward),
    };
};
exports.getCustomerLoyaltyProgram = getCustomerLoyaltyProgram;
const listCustomerLoyaltyRewardsForAdmin = async (filter = {}) => {
    const rewards = await customer_loyalty_reward_model_1.default.find(filter)
        .populate('customerId', 'name email phone countryCode')
        .populate('promotionId', 'code status redemptionCount expiresAt')
        .sort({ updatedAt: -1 })
        .limit(200)
        .lean();
    return rewards.map((reward) => ({
        ...serializeReward(reward),
        customer: reward.customerId
            ? {
                id: reward.customerId._id?.toString(),
                name: reward.customerId.name || '',
                email: reward.customerId.email || '',
                phone: reward.customerId.phone || '',
            }
            : null,
        rewardRedeemed: reward.status === customer_loyalty_reward_model_1.CustomerLoyaltyRewardStatus.REDEEMED || Number(reward.promotionId?.redemptionCount || 0) > 0,
    }));
};
exports.listCustomerLoyaltyRewardsForAdmin = listCustomerLoyaltyRewardsForAdmin;
//# sourceMappingURL=customer-loyalty-reward.service.js.map