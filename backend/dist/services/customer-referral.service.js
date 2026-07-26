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
exports.listCustomerReferralRewardsForAdmin = exports.getCustomerReferralSummary = exports.processCustomerReferralRewardForCompletedBooking = exports.markCustomerReferralFirstBookingCreated = exports.recordCustomerToCustomerReferral = exports.findCustomerByReferralCode = exports.getOrCreateCustomerReferralCode = exports.normalizeCustomerReferralCode = void 0;
const crypto_1 = __importDefault(require("crypto"));
const mongoose_1 = __importDefault(require("mongoose"));
const booking_model_1 = __importStar(require("../models/booking.model"));
const customer_referral_model_1 = __importStar(require("../models/customer-referral.model"));
const promotion_model_1 = __importStar(require("../models/promotion.model"));
const user_model_1 = __importStar(require("../models/user.model"));
const notification_model_1 = require("../models/notification.model");
const notification_service_1 = require("./notification.service");
const normalizeCustomerReferralCode = (value) => typeof value === 'string'
    ? value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 24)
    : '';
exports.normalizeCustomerReferralCode = normalizeCustomerReferralCode;
const DEFAULT_FRIEND_DISCOUNT_MINOR = Number.isFinite(Number(process.env.CUSTOMER_REFERRAL_FRIEND_DISCOUNT_MINOR))
    ? Math.max(0, Math.round(Number(process.env.CUSTOMER_REFERRAL_FRIEND_DISCOUNT_MINOR)))
    : 5000;
const DEFAULT_CUSTOMER_REWARD_MINOR = Number.isFinite(Number(process.env.CUSTOMER_REFERRAL_REWARD_MINOR))
    ? Math.max(0, Math.round(Number(process.env.CUSTOMER_REFERRAL_REWARD_MINOR)))
    : 5000;
const DEFAULT_EXPIRY_DAYS = Number.isFinite(Number(process.env.CUSTOMER_REFERRAL_EXPIRY_DAYS))
    ? Math.max(1, Math.round(Number(process.env.CUSTOMER_REFERRAL_EXPIRY_DAYS)))
    : 30;
const randomSuffix = () => crypto_1.default.randomBytes(3).toString('hex').toUpperCase();
const baseCodeFromName = (name) => {
    const cleaned = name.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return (cleaned || 'PADI').slice(0, 6);
};
const promotionExpiry = () => new Date(Date.now() + DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
const generatePromotionCode = (prefix, referralCode) => `${prefix}${referralCode.slice(0, 6)}${randomSuffix()}`.replace(/[^A-Z0-9]/g, '').slice(0, 18);
const getOrCreateCustomerReferralCode = async (customerId) => {
    const customer = await user_model_1.default.findOne({ _id: customerId, role: user_model_1.UserRole.CUSTOMER });
    if (!customer)
        throw new Error('Customer account not found.');
    const existing = (0, exports.normalizeCustomerReferralCode)(customer.metadata?.customerReferralCode);
    if (existing)
        return existing;
    const baseCode = baseCodeFromName(customer.name);
    for (let attempt = 0; attempt < 8; attempt += 1) {
        const candidate = `${baseCode}${randomSuffix()}`.slice(0, 12);
        const duplicate = await user_model_1.default.exists({ 'metadata.customerReferralCode': candidate });
        if (duplicate)
            continue;
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
exports.getOrCreateCustomerReferralCode = getOrCreateCustomerReferralCode;
const findCustomerByReferralCode = async (rawCode) => {
    const referralCode = (0, exports.normalizeCustomerReferralCode)(rawCode);
    if (!referralCode)
        return null;
    return user_model_1.default.findOne({
        role: user_model_1.UserRole.CUSTOMER,
        isActive: true,
        'metadata.customerReferralCode': referralCode,
    });
};
exports.findCustomerByReferralCode = findCustomerByReferralCode;
const createCustomerReferralPromotion = async (input) => {
    const prefix = input.type === 'FRIEND_DISCOUNT' ? 'PADIFF' : 'PADICR';
    for (let attempt = 0; attempt < 8; attempt += 1) {
        const code = generatePromotionCode(prefix, input.referralCode);
        try {
            return await promotion_model_1.default.create({
                code,
                name: input.type === 'FRIEND_DISCOUNT' ? 'Friend referral discount' : 'Customer referral reward',
                description: input.type === 'FRIEND_DISCOUNT'
                    ? 'Welcome to Padi. Use this code on your first qualifying booking.'
                    : 'Thank you for inviting a friend to Padi.',
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
                firstBookingOnly: input.type === 'FRIEND_DISCOUNT',
                priority: input.type === 'FRIEND_DISCOUNT' ? 15 : 10,
                stackingPolicy: promotion_model_1.PromotionStackingPolicy.EXCLUSIVE,
                fundingSource: promotion_model_1.PromotionFundingSource.PLATFORM,
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
        }
        catch (error) {
            if (error?.code !== 11000)
                throw error;
        }
    }
    throw new Error('Unable to generate a unique customer referral promotion code.');
};
const recordCustomerToCustomerReferral = async (input) => {
    const referralCode = (0, exports.normalizeCustomerReferralCode)(input.referralCode);
    if (!referralCode)
        return false;
    const referrer = await (0, exports.findCustomerByReferralCode)(referralCode);
    if (!referrer)
        return false;
    if (String(referrer._id) === String(input.customerId))
        return false;
    const existing = await customer_referral_model_1.default.findOne({ referredCustomerId: input.customerId });
    if (existing)
        return true;
    const referral = await customer_referral_model_1.default.create({
        referralCode,
        referrerCustomerId: referrer._id,
        referredCustomerId: input.customerId,
        referredCustomerEmail: input.customerEmail.toLowerCase().trim(),
        countryCode: input.countryCode,
        city: input.city || '',
        status: customer_referral_model_1.CustomerReferralStatus.REGISTERED,
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
    await customer_referral_model_1.default.updateOne({ _id: referral._id, friendDiscountPromotionId: null }, {
        $set: {
            friendDiscountPromotionId: promotion._id,
            friendDiscountCode: promotion.code || '',
            friendDiscountIssuedAt: new Date(),
        },
    });
    await user_model_1.default.updateOne({ _id: input.customerId, 'metadata.referredByCustomerCode': { $exists: false } }, {
        $set: {
            'metadata.referredByCustomerCode': referralCode,
            'metadata.referredByCustomerId': referrer._id.toString(),
            'metadata.customerReferralFriendDiscountCode': promotion.code || '',
            'metadata.referredAt': new Date(),
        },
    });
    await (0, notification_service_1.createNotifications)({
        userId: input.customerId,
        channels: [notification_model_1.NotificationChannel.IN_APP, notification_model_1.NotificationChannel.PUSH],
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
exports.recordCustomerToCustomerReferral = recordCustomerToCustomerReferral;
const markCustomerReferralFirstBookingCreated = async (input) => {
    await customer_referral_model_1.default.updateOne({
        referredCustomerId: new mongoose_1.default.Types.ObjectId(String(input.customerId)),
        firstBookingId: null,
        status: customer_referral_model_1.CustomerReferralStatus.REGISTERED,
    }, {
        $set: {
            firstBookingId: new mongoose_1.default.Types.ObjectId(String(input.bookingId)),
            firstBookingAt: new Date(),
            status: customer_referral_model_1.CustomerReferralStatus.FIRST_BOOKING_CREATED,
        },
    });
};
exports.markCustomerReferralFirstBookingCreated = markCustomerReferralFirstBookingCreated;
const paidCompletedBookingCount = (customerId) => booking_model_1.default.countDocuments({
    customerId,
    status: booking_model_1.BookingStatus.COMPLETED,
    paymentStatus: booking_model_1.BookingPaymentStatus.SECURED,
    priceMinor: { $gt: 0 },
});
const blockCustomerReferralReward = async (referralId, reason, metadata = {}) => {
    await customer_referral_model_1.default.updateOne({ _id: referralId, status: { $ne: customer_referral_model_1.CustomerReferralStatus.REWARD_ELIGIBLE } }, {
        $set: {
            status: customer_referral_model_1.CustomerReferralStatus.REWARD_BLOCKED,
            rewardBlockedAt: new Date(),
            rewardBlockReason: reason,
        },
        $push: {
            'metadata.fraudChecks': {
                reason,
                checkedAt: new Date(),
                ...metadata,
            },
        },
    });
};
const rewardFraudCheck = async (booking, referral) => {
    if (booking.status !== booking_model_1.BookingStatus.COMPLETED)
        return 'BOOKING_NOT_COMPLETED';
    if (booking.paymentStatus !== booking_model_1.BookingPaymentStatus.SECURED)
        return 'PAYMENT_NOT_SECURED';
    if (booking.priceMinor <= 0)
        return 'ZERO_VALUE_BOOKING';
    if (booking.completion?.status !== booking_model_1.CompletionStatus.CUSTOMER_CONFIRMED)
        return 'CUSTOMER_COMPLETION_NOT_CONFIRMED';
    if (String(booking.customerId) !== String(referral.referredCustomerId))
        return 'CUSTOMER_MISMATCH';
    if (String(referral.referrerCustomerId) === String(referral.referredCustomerId))
        return 'SELF_REFERRAL';
    const completedCount = await paidCompletedBookingCount(booking.customerId);
    if (completedCount !== 1)
        return 'NOT_FIRST_PAID_COMPLETED_BOOKING';
    return '';
};
const processCustomerReferralRewardForCompletedBooking = async (booking) => {
    const referral = await customer_referral_model_1.default.findOne({
        referredCustomerId: booking.customerId,
        rewardPromotionId: null,
        status: { $in: [customer_referral_model_1.CustomerReferralStatus.REGISTERED, customer_referral_model_1.CustomerReferralStatus.FIRST_BOOKING_CREATED, customer_referral_model_1.CustomerReferralStatus.FIRST_JOB_COMPLETED] },
    });
    if (!referral)
        return;
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
    const updateResult = await customer_referral_model_1.default.updateOne({
        _id: referral._id,
        rewardPromotionId: null,
        status: { $ne: customer_referral_model_1.CustomerReferralStatus.REWARD_ELIGIBLE },
    }, {
        $set: {
            status: customer_referral_model_1.CustomerReferralStatus.REWARD_ELIGIBLE,
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
                'metadata.archivedReason': 'CUSTOMER_REFERRAL_REWARD_RACE_LOST',
            },
        });
        return;
    }
    await (0, notification_service_1.createNotifications)({
        userId: referral.referrerCustomerId,
        channels: [notification_model_1.NotificationChannel.IN_APP, notification_model_1.NotificationChannel.PUSH],
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
exports.processCustomerReferralRewardForCompletedBooking = processCustomerReferralRewardForCompletedBooking;
const getCustomerReferralSummary = async (customerId) => {
    const referrals = await customer_referral_model_1.default.aggregate([
        { $match: { referrerCustomerId: new mongoose_1.default.Types.ObjectId(String(customerId)) } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const counts = referrals.reduce((acc, item) => {
        acc[String(item._id)] = Number(item.count || 0);
        return acc;
    }, {});
    return {
        registeredCount: counts[customer_referral_model_1.CustomerReferralStatus.REGISTERED] || 0,
        firstBookingCount: counts[customer_referral_model_1.CustomerReferralStatus.FIRST_BOOKING_CREATED] || 0,
        completedCount: (counts[customer_referral_model_1.CustomerReferralStatus.FIRST_JOB_COMPLETED] || 0) + (counts[customer_referral_model_1.CustomerReferralStatus.REWARD_ELIGIBLE] || 0),
        rewardEligibleCount: counts[customer_referral_model_1.CustomerReferralStatus.REWARD_ELIGIBLE] || 0,
        rewardBlockedCount: counts[customer_referral_model_1.CustomerReferralStatus.REWARD_BLOCKED] || 0,
    };
};
exports.getCustomerReferralSummary = getCustomerReferralSummary;
const listCustomerReferralRewardsForAdmin = async (filter = {}) => {
    const referrals = await customer_referral_model_1.default.find(filter)
        .populate('referrerCustomerId', 'name email phone countryCode')
        .populate('referredCustomerId', 'name email phone countryCode')
        .populate('friendDiscountPromotionId', 'code status usageCount redemptionCount expiresAt redeemedBudgetMinor')
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
exports.listCustomerReferralRewardsForAdmin = listCustomerReferralRewardsForAdmin;
//# sourceMappingURL=customer-referral.service.js.map