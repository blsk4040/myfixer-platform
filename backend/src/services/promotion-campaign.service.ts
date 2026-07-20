import crypto from 'crypto';
import mongoose from 'mongoose';
import Booking, { BookingStatus } from '../models/booking.model';
import Promotion, {
  IPromotion,
  PromotionDiscountType,
  PromotionFundingSource,
  PromotionStackingPolicy,
  PromotionStatus,
  PromotionTriggerType,
} from '../models/promotion.model';

export interface PromotionContext {
  promoCode?: string;
  customerId: string;
  amountMinor: number;
  countryCode: string;
  currency: string;
  city?: string;
  area?: string;
  serviceKey?: string;
  subcategoryKey?: string;
}

export type PromotionReservationStatus = 'RESERVED' | 'REDEEMED' | 'RELEASED' | 'REVERSED';

export interface AppliedPromotionSnapshot {
  code: string;
  promotionId: string;
  campaignName: string;
  triggerType: PromotionTriggerType;
  discountType: PromotionDiscountType;
  discountValue: number;
  originalPriceMinor: number;
  discountMinor: number;
  fundingSource: PromotionFundingSource;
  fundingSplitBps: {
    platform: number;
    technician: number;
    partner: number;
  };
  priority: number;
  stackingPolicy: PromotionStackingPolicy;
  reservationId: string;
  reservationStatus: PromotionReservationStatus;
  reservedAt: string;
  redeemedAt?: string;
  releasedAt?: string;
  reversedAt?: string;
  releaseReason?: string;
  serviceKey?: string;
  subcategoryKey?: string;
  city?: string;
  area?: string;
  appliedToInvoice?: boolean;
}

export interface PromotionResolution {
  promotionDiscountMinor: number;
  promotions: AppliedPromotionSnapshot[];
}

export class PromotionCampaignError extends Error {
  constructor(message: string, public readonly code = 'PROMOTION_NOT_APPLICABLE') {
    super(message);
  }
}

const normalizeKey = (value: unknown): string => String(value || '').trim().toLowerCase();

const hasObjectId = (values: mongoose.Types.ObjectId[] = [], id: string): boolean =>
  values.some((value) => value.toString() === id);

const activeCampaignFilter = (now: Date, context: PromotionContext) => ({
  status: PromotionStatus.ACTIVE,
  $and: [
    { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
    { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
    { $or: [{ countryCode: null }, { countryCode: context.countryCode }] },
    { $or: [{ currency: null }, { currency: context.currency }] },
  ],
});

const calculateCampaignDiscount = (promotion: IPromotion, amountMinor: number): number => {
  let discountMinor = promotion.discountType === PromotionDiscountType.FREE_CALLOUT
    ? amountMinor
    : promotion.discountType === PromotionDiscountType.PERCENTAGE
      ? Math.floor((amountMinor * promotion.discountValue) / 100)
      : Math.round(promotion.discountValue);

  if (promotion.maxDiscountMinor !== null && promotion.maxDiscountMinor !== undefined) {
    discountMinor = Math.min(discountMinor, promotion.maxDiscountMinor);
  }

  return Math.min(Math.max(discountMinor, 0), amountMinor);
};

const clientUsageCount = (customerId: string, promotionId: mongoose.Types.ObjectId) =>
  Booking.countDocuments({
    customerId: new mongoose.Types.ObjectId(customerId),
    'metadata.promotion.promotionId': promotionId.toString(),
    status: { $ne: BookingStatus.CANCELLED },
  });

const clientBookingCount = (customerId: string) =>
  Booking.countDocuments({
    customerId: new mongoose.Types.ObjectId(customerId),
    status: { $ne: BookingStatus.CANCELLED },
  });

const isEligible = async (promotion: IPromotion, context: PromotionContext): Promise<boolean> => {
  if (promotion.usageLimit !== null && promotion.usageLimit !== undefined && promotion.usageCount >= promotion.usageLimit) {
    return false;
  }
  if (context.amountMinor < promotion.minBookingAmountMinor) return false;
  if (promotion.budgetMinor !== null && promotion.budgetMinor !== undefined) {
    const committed = promotion.reservedBudgetMinor + promotion.redeemedBudgetMinor;
    if (committed >= promotion.budgetMinor) return false;
  }

  const serviceKeys = (promotion.serviceKeys || []).map(normalizeKey).filter(Boolean);
  const subcategoryKeys = (promotion.subcategoryKeys || []).map(normalizeKey).filter(Boolean);
  const cityKeys = (promotion.cityKeys || []).map(normalizeKey).filter(Boolean);
  const areaKeys = (promotion.areaKeys || []).map(normalizeKey).filter(Boolean);
  if (cityKeys.length && !cityKeys.includes(normalizeKey(context.city))) return false;
  if (areaKeys.length && !areaKeys.includes(normalizeKey(context.area))) return false;
  if (serviceKeys.length && !serviceKeys.includes(normalizeKey(context.serviceKey))) return false;
  if (subcategoryKeys.length && !subcategoryKeys.includes(normalizeKey(context.subcategoryKey))) return false;
  if (hasObjectId(promotion.excludedClientIds, context.customerId)) return false;
  if (promotion.eligibleClientIds?.length && !hasObjectId(promotion.eligibleClientIds, context.customerId)) return false;
  if (promotion.firstBookingOnly && (await clientBookingCount(context.customerId)) > 0) return false;
  if (promotion.perClientLimit !== null && promotion.perClientLimit !== undefined) {
    const usage = await clientUsageCount(context.customerId, promotion._id);
    if (usage >= promotion.perClientLimit) return false;
  }

  return true;
};

const snapshotPromotion = (
  promotion: IPromotion,
  context: PromotionContext,
  discountMinor: number
): AppliedPromotionSnapshot => ({
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
  reservationId: crypto.randomUUID(),
  reservationStatus: 'RESERVED',
  reservedAt: new Date().toISOString(),
  city: context.city,
  area: context.area,
  serviceKey: context.serviceKey,
  subcategoryKey: context.subcategoryKey,
});

export const resolvePromotionsForPricing = async (context: PromotionContext): Promise<PromotionResolution> => {
  if (!mongoose.Types.ObjectId.isValid(context.customerId)) {
    throw new PromotionCampaignError('Invalid customer identity.', 'INVALID_CUSTOMER');
  }

  const now = new Date();
  const promoCode = String(context.promoCode || '').trim().toUpperCase();
  const query = promoCode
    ? { ...activeCampaignFilter(now, context), code: promoCode, triggerType: PromotionTriggerType.CODE }
    : { ...activeCampaignFilter(now, context), triggerType: PromotionTriggerType.AUTOMATIC };

  const candidates = await Promotion.find(query).sort({ priority: 1, createdAt: -1 });
  if (promoCode && candidates.length === 0) {
    throw new PromotionCampaignError('Promo code is invalid or expired.', 'PROMO_CODE_INVALID');
  }

  const applied: AppliedPromotionSnapshot[] = [];
  let remainingAmountMinor = context.amountMinor;

  for (const promotion of candidates) {
    if (!(await isEligible(promotion, context))) continue;
    const discountMinor = calculateCampaignDiscount(promotion, remainingAmountMinor);
    if (discountMinor <= 0) continue;

    applied.push(snapshotPromotion(promotion, { ...context, amountMinor: remainingAmountMinor }, discountMinor));
    remainingAmountMinor = Math.max(remainingAmountMinor - discountMinor, 0);

    if (promotion.stackingPolicy !== PromotionStackingPolicy.STACKABLE || remainingAmountMinor <= 0) break;
  }

  if (promoCode && applied.length === 0) {
    throw new PromotionCampaignError('Promo code is not eligible for this booking.', 'PROMO_CODE_NOT_ELIGIBLE');
  }

  return {
    promotionDiscountMinor: applied.reduce((sum, item) => sum + item.discountMinor, 0),
    promotions: applied,
  };
};

export const reservePromotions = async (promotions: AppliedPromotionSnapshot[]): Promise<void> => {
  const reserved: AppliedPromotionSnapshot[] = [];
  for (const promotion of promotions) {
    const result = await Promotion.updateOne(
      {
        _id: promotion.promotionId,
        $and: [
          { $or: [{ usageLimit: null }, { usageLimit: { $exists: false } }, { $expr: { $lt: ['$usageCount', '$usageLimit'] } }] },
          { $or: [{ budgetMinor: null }, { budgetMinor: { $exists: false } }, { $expr: { $lte: [{ $add: ['$reservedBudgetMinor', '$redeemedBudgetMinor', promotion.discountMinor] }, '$budgetMinor'] } }] },
          { [`metadata.reservationIds.${promotion.reservationId}`]: { $exists: false } },
        ],
      },
      {
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
      }
    );
    if (result.modifiedCount !== 1) {
      await releasePromotionReservations(reserved, 'RESERVATION_ROLLBACK');
      throw new PromotionCampaignError('Promotion capacity has been exhausted.', 'PROMOTION_CAPACITY_EXHAUSTED');
    }
    reserved.push(promotion);
  }
};

export const releasePromotionReservations = async (
  promotions: AppliedPromotionSnapshot[],
  reason = 'RELEASED'
): Promise<AppliedPromotionSnapshot[]> => {
  const releasedAt = new Date().toISOString();
  await Promise.all(promotions
    .filter((promotion) => promotion.reservationStatus === 'RESERVED')
    .map((promotion) =>
      Promotion.updateOne(
      {
        _id: promotion.promotionId,
        [`metadata.reservationIds.${promotion.reservationId}.status`]: 'RESERVED',
        reservedBudgetMinor: { $gte: promotion.discountMinor },
      },
      {
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
      }
    )
  ));

  return promotions.map((promotion) => promotion.reservationStatus === 'RESERVED'
    ? { ...promotion, reservationStatus: 'RELEASED', releasedAt, releaseReason: reason }
    : promotion);
};

export const redeemPromotions = async (promotions: AppliedPromotionSnapshot[]): Promise<AppliedPromotionSnapshot[]> => {
  const now = new Date().toISOString();
  await Promise.all(promotions
    .filter((promotion) => promotion.reservationStatus === 'RESERVED' && !promotion.redeemedAt)
    .map((promotion) =>
      Promotion.updateOne(
        {
          _id: promotion.promotionId,
          [`metadata.reservationIds.${promotion.reservationId}.status`]: 'RESERVED',
          reservedBudgetMinor: { $gte: promotion.discountMinor },
        },
        {
          $inc: {
            redemptionCount: 1,
            redeemedBudgetMinor: promotion.discountMinor,
            reservedBudgetMinor: -promotion.discountMinor,
          },
          $set: {
            [`metadata.reservationIds.${promotion.reservationId}.status`]: 'REDEEMED',
            [`metadata.reservationIds.${promotion.reservationId}.redeemedAt`]: now,
          },
        }
      )
    ));

  return promotions.map((promotion) => ({
    ...promotion,
    reservationStatus: promotion.reservationStatus === 'RESERVED' ? 'REDEEMED' : promotion.reservationStatus,
    redeemedAt: promotion.redeemedAt || (promotion.reservationStatus === 'RESERVED' ? now : undefined),
  }));
};

export const reverseRedeemedPromotions = async (
  promotions: AppliedPromotionSnapshot[],
  reason = 'REVERSED'
): Promise<AppliedPromotionSnapshot[]> => {
  const reversedAt = new Date().toISOString();
  await Promise.all(promotions
    .filter((promotion) => promotion.reservationStatus === 'REDEEMED')
    .map((promotion) =>
      Promotion.updateOne(
        {
          _id: promotion.promotionId,
          [`metadata.reservationIds.${promotion.reservationId}.status`]: 'REDEEMED',
          redeemedBudgetMinor: { $gte: promotion.discountMinor },
        },
        {
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
        }
      )
    ));

  return promotions.map((promotion) => promotion.reservationStatus === 'REDEEMED'
    ? { ...promotion, reservationStatus: 'REVERSED', reversedAt, releaseReason: reason }
    : promotion);
};
