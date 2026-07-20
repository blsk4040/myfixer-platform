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
exports.reverseRedeemedPromotions = exports.redeemPromotions = exports.releasePromotionReservations = exports.reservePromotions = exports.resolvePromotionsForPricing = exports.PromotionCampaignError = void 0;
const crypto_1 = __importDefault(require("crypto"));
const mongoose_1 = __importDefault(require("mongoose"));
const booking_model_1 = __importStar(require("../models/booking.model"));
const promotion_model_1 = __importStar(require("../models/promotion.model"));
class PromotionCampaignError extends Error {
    code;
    constructor(message, code = 'PROMOTION_NOT_APPLICABLE') {
        super(message);
        this.code = code;
    }
}
exports.PromotionCampaignError = PromotionCampaignError;
const normalizeKey = (value) => String(value || '').trim().toLowerCase();
const hasObjectId = (values = [], id) => values.some((value) => value.toString() === id);
const activeCampaignFilter = (now, context) => ({
    status: promotion_model_1.PromotionStatus.ACTIVE,
    $and: [
        { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
        { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
        { $or: [{ countryCode: null }, { countryCode: context.countryCode }] },
        { $or: [{ currency: null }, { currency: context.currency }] },
    ],
});
const calculateCampaignDiscount = (promotion, amountMinor) => {
    let discountMinor = promotion.discountType === promotion_model_1.PromotionDiscountType.FREE_CALLOUT
        ? amountMinor
        : promotion.discountType === promotion_model_1.PromotionDiscountType.PERCENTAGE
            ? Math.floor((amountMinor * promotion.discountValue) / 100)
            : Math.round(promotion.discountValue);
    if (promotion.maxDiscountMinor !== null && promotion.maxDiscountMinor !== undefined) {
        discountMinor = Math.min(discountMinor, promotion.maxDiscountMinor);
    }
    return Math.min(Math.max(discountMinor, 0), amountMinor);
};
const clientUsageCount = (customerId, promotionId) => booking_model_1.default.countDocuments({
    customerId: new mongoose_1.default.Types.ObjectId(customerId),
    'metadata.promotion.promotionId': promotionId.toString(),
    status: { $ne: booking_model_1.BookingStatus.CANCELLED },
});
const clientBookingCount = (customerId) => booking_model_1.default.countDocuments({
    customerId: new mongoose_1.default.Types.ObjectId(customerId),
    status: { $ne: booking_model_1.BookingStatus.CANCELLED },
});
const isEligible = async (promotion, context) => {
    if (promotion.usageLimit !== null && promotion.usageLimit !== undefined && promotion.usageCount >= promotion.usageLimit) {
        return false;
    }
    if (context.amountMinor < promotion.minBookingAmountMinor)
        return false;
    if (promotion.budgetMinor !== null && promotion.budgetMinor !== undefined) {
        const committed = promotion.reservedBudgetMinor + promotion.redeemedBudgetMinor;
        if (committed >= promotion.budgetMinor)
            return false;
    }
    const serviceKeys = (promotion.serviceKeys || []).map(normalizeKey).filter(Boolean);
    const subcategoryKeys = (promotion.subcategoryKeys || []).map(normalizeKey).filter(Boolean);
    const cityKeys = (promotion.cityKeys || []).map(normalizeKey).filter(Boolean);
    const areaKeys = (promotion.areaKeys || []).map(normalizeKey).filter(Boolean);
    if (cityKeys.length && !cityKeys.includes(normalizeKey(context.city)))
        return false;
    if (areaKeys.length && !areaKeys.includes(normalizeKey(context.area)))
        return false;
    if (serviceKeys.length && !serviceKeys.includes(normalizeKey(context.serviceKey)))
        return false;
    if (subcategoryKeys.length && !subcategoryKeys.includes(normalizeKey(context.subcategoryKey)))
        return false;
    if (hasObjectId(promotion.excludedClientIds, context.customerId))
        return false;
    if (promotion.eligibleClientIds?.length && !hasObjectId(promotion.eligibleClientIds, context.customerId))
        return false;
    if (promotion.firstBookingOnly && (await clientBookingCount(context.customerId)) > 0)
        return false;
    if (promotion.perClientLimit !== null && promotion.perClientLimit !== undefined) {
        const usage = await clientUsageCount(context.customerId, promotion._id);
        if (usage >= promotion.perClientLimit)
            return false;
    }
    return true;
};
const snapshotPromotion = (promotion, context, discountMinor) => ({
    code: promotion.code || '',
    promotionId: promotion._id.toString(),
    campaignName: promotion.name,
    triggerType: promotion.triggerType,
    discountType: promotion.discountType,
    discountValue: promotion.discountValue,
    originalPriceMinor: context.amountMinor,
    discountMinor,
    fundingSource: promotion.fundingSource,
    fundingSplitBps: {
        platform: promotion.fundingSplitBps?.platform ?? 10000,
        technician: promotion.fundingSplitBps?.technician ?? 0,
        partner: promotion.fundingSplitBps?.partner ?? 0,
    },
    priority: promotion.priority,
    stackingPolicy: promotion.stackingPolicy,
    reservationId: crypto_1.default.randomUUID(),
    reservationStatus: 'RESERVED',
    reservedAt: new Date().toISOString(),
    city: context.city,
    area: context.area,
    serviceKey: context.serviceKey,
    subcategoryKey: context.subcategoryKey,
});
const resolvePromotionsForPricing = async (context) => {
    if (!mongoose_1.default.Types.ObjectId.isValid(context.customerId)) {
        throw new PromotionCampaignError('Invalid customer identity.', 'INVALID_CUSTOMER');
    }
    const now = new Date();
    const promoCode = String(context.promoCode || '').trim().toUpperCase();
    const query = promoCode
        ? { ...activeCampaignFilter(now, context), code: promoCode, triggerType: promotion_model_1.PromotionTriggerType.CODE }
        : { ...activeCampaignFilter(now, context), triggerType: promotion_model_1.PromotionTriggerType.AUTOMATIC };
    const candidates = await promotion_model_1.default.find(query).sort({ priority: 1, createdAt: -1 });
    if (promoCode && candidates.length === 0) {
        throw new PromotionCampaignError('Promo code is invalid or expired.', 'PROMO_CODE_INVALID');
    }
    const applied = [];
    let remainingAmountMinor = context.amountMinor;
    for (const promotion of candidates) {
        if (!(await isEligible(promotion, context)))
            continue;
        const discountMinor = calculateCampaignDiscount(promotion, remainingAmountMinor);
        if (discountMinor <= 0)
            continue;
        applied.push(snapshotPromotion(promotion, { ...context, amountMinor: remainingAmountMinor }, discountMinor));
        remainingAmountMinor = Math.max(remainingAmountMinor - discountMinor, 0);
        if (promotion.stackingPolicy !== promotion_model_1.PromotionStackingPolicy.STACKABLE || remainingAmountMinor <= 0)
            break;
    }
    if (promoCode && applied.length === 0) {
        throw new PromotionCampaignError('Promo code is not eligible for this booking.', 'PROMO_CODE_NOT_ELIGIBLE');
    }
    return {
        promotionDiscountMinor: applied.reduce((sum, item) => sum + item.discountMinor, 0),
        promotions: applied,
    };
};
exports.resolvePromotionsForPricing = resolvePromotionsForPricing;
const reservePromotions = async (promotions) => {
    const reserved = [];
    for (const promotion of promotions) {
        const result = await promotion_model_1.default.updateOne({
            _id: promotion.promotionId,
            $and: [
                { $or: [{ usageLimit: null }, { usageLimit: { $exists: false } }, { $expr: { $lt: ['$usageCount', '$usageLimit'] } }] },
                { $or: [{ budgetMinor: null }, { budgetMinor: { $exists: false } }, { $expr: { $lte: [{ $add: ['$reservedBudgetMinor', '$redeemedBudgetMinor', promotion.discountMinor] }, '$budgetMinor'] } }] },
                { [`metadata.reservationIds.${promotion.reservationId}`]: { $exists: false } },
            ],
        }, {
            $inc: {
                usageCount: 1,
                reservationCount: 1,
                reservedBudgetMinor: promotion.discountMinor,
            },
            $set: {
                [`metadata.reservationIds.${promotion.reservationId}`]: {
                    status: 'RESERVED',
                    discountMinor: promotion.discountMinor,
                    reservedAt: promotion.reservedAt,
                },
            },
        });
        if (result.modifiedCount !== 1) {
            await (0, exports.releasePromotionReservations)(reserved, 'RESERVATION_ROLLBACK');
            throw new PromotionCampaignError('Promotion capacity has been exhausted.', 'PROMOTION_CAPACITY_EXHAUSTED');
        }
        reserved.push(promotion);
    }
};
exports.reservePromotions = reservePromotions;
const releasePromotionReservations = async (promotions, reason = 'RELEASED') => {
    const releasedAt = new Date().toISOString();
    await Promise.all(promotions
        .filter((promotion) => promotion.reservationStatus === 'RESERVED')
        .map((promotion) => promotion_model_1.default.updateOne({
        _id: promotion.promotionId,
        [`metadata.reservationIds.${promotion.reservationId}.status`]: 'RESERVED',
        reservedBudgetMinor: { $gte: promotion.discountMinor },
    }, {
        $inc: {
            usageCount: -1,
            reservationCount: -1,
            reservedBudgetMinor: -promotion.discountMinor,
        },
        $set: {
            [`metadata.reservationIds.${promotion.reservationId}.status`]: 'RELEASED',
            [`metadata.reservationIds.${promotion.reservationId}.releasedAt`]: releasedAt,
            [`metadata.reservationIds.${promotion.reservationId}.releaseReason`]: reason,
        },
    })));
    return promotions.map((promotion) => promotion.reservationStatus === 'RESERVED'
        ? { ...promotion, reservationStatus: 'RELEASED', releasedAt, releaseReason: reason }
        : promotion);
};
exports.releasePromotionReservations = releasePromotionReservations;
const redeemPromotions = async (promotions) => {
    const now = new Date().toISOString();
    await Promise.all(promotions
        .filter((promotion) => promotion.reservationStatus === 'RESERVED' && !promotion.redeemedAt)
        .map((promotion) => promotion_model_1.default.updateOne({
        _id: promotion.promotionId,
        [`metadata.reservationIds.${promotion.reservationId}.status`]: 'RESERVED',
        reservedBudgetMinor: { $gte: promotion.discountMinor },
    }, {
        $inc: {
            redemptionCount: 1,
            redeemedBudgetMinor: promotion.discountMinor,
            reservedBudgetMinor: -promotion.discountMinor,
        },
        $set: {
            [`metadata.reservationIds.${promotion.reservationId}.status`]: 'REDEEMED',
            [`metadata.reservationIds.${promotion.reservationId}.redeemedAt`]: now,
        },
    })));
    return promotions.map((promotion) => ({
        ...promotion,
        reservationStatus: promotion.reservationStatus === 'RESERVED' ? 'REDEEMED' : promotion.reservationStatus,
        redeemedAt: promotion.redeemedAt || (promotion.reservationStatus === 'RESERVED' ? now : undefined),
    }));
};
exports.redeemPromotions = redeemPromotions;
const reverseRedeemedPromotions = async (promotions, reason = 'REVERSED') => {
    const reversedAt = new Date().toISOString();
    await Promise.all(promotions
        .filter((promotion) => promotion.reservationStatus === 'REDEEMED')
        .map((promotion) => promotion_model_1.default.updateOne({
        _id: promotion.promotionId,
        [`metadata.reservationIds.${promotion.reservationId}.status`]: 'REDEEMED',
        redeemedBudgetMinor: { $gte: promotion.discountMinor },
    }, {
        $inc: {
            usageCount: -1,
            redemptionCount: -1,
            redeemedBudgetMinor: -promotion.discountMinor,
        },
        $set: {
            [`metadata.reservationIds.${promotion.reservationId}.status`]: 'REVERSED',
            [`metadata.reservationIds.${promotion.reservationId}.reversedAt`]: reversedAt,
            [`metadata.reservationIds.${promotion.reservationId}.releaseReason`]: reason,
        },
    })));
    return promotions.map((promotion) => promotion.reservationStatus === 'REDEEMED'
        ? { ...promotion, reservationStatus: 'REVERSED', reversedAt, releaseReason: reason }
        : promotion);
};
exports.reverseRedeemedPromotions = reverseRedeemedPromotions;
//# sourceMappingURL=promotion-campaign.service.js.map