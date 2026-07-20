import assert from 'assert';
import mongoose from 'mongoose';
import Promotion, {
  PromotionDiscountType,
  PromotionFundingSource,
  PromotionStackingPolicy,
  PromotionStatus,
  PromotionTriggerType,
} from '../src/models/promotion.model';
import Booking from '../src/models/booking.model';
import {
  AppliedPromotionSnapshot,
  redeemPromotions,
  releasePromotionReservations,
  reservePromotions,
  resolvePromotionsForPricing,
  reverseRedeemedPromotions,
} from '../src/services/promotion-campaign.service';
import { calculatePriceBreakdown } from '../src/services/price-breakdown.service';
import {
  buildPromotionAnalyticsSummary,
  promotionMaterialFieldsChanged,
} from '../src/controllers/admin.controller';
import { generateInvoiceHtml } from '../src/services/email/templates/invoiceTemplate';

type Campaign = any;

const customerId = new mongoose.Types.ObjectId().toString();
const otherCustomerId = new mongoose.Types.ObjectId().toString();
let campaigns: Campaign[] = [];
let existingBookings: Array<{ customerId: string; promotionId?: string; cancelled?: boolean }> = [];

const baseContext = (overrides: Record<string, unknown> = {}) => ({
  customerId,
  amountMinor: 10000,
  countryCode: 'ZA',
  currency: 'ZAR',
  city: 'johannesburg',
  area: 'bryanston',
  serviceKey: 'plumbing',
  subcategoryKey: 'geyser',
  ...overrides,
});

const campaign = (overrides: Record<string, unknown> = {}): Campaign => ({
  _id: new mongoose.Types.ObjectId(),
  code: null,
  name: 'Auto launch',
  status: PromotionStatus.ACTIVE,
  triggerType: PromotionTriggerType.AUTOMATIC,
  discountType: PromotionDiscountType.PERCENTAGE,
  discountValue: 10,
  maxDiscountMinor: null,
  minBookingAmountMinor: 0,
  countryCode: null,
  currency: null,
  cityKeys: [],
  areaKeys: [],
  serviceKeys: [],
  subcategoryKeys: [],
  eligibleClientIds: [],
  excludedClientIds: [],
  firstBookingOnly: false,
  priority: 100,
  stackingPolicy: PromotionStackingPolicy.EXCLUSIVE,
  fundingSource: PromotionFundingSource.MYFIXER,
  fundingSplitBps: { platform: 10000, technician: 0, partner: 0 },
  budgetMinor: null,
  reservedBudgetMinor: 0,
  redeemedBudgetMinor: 0,
  reservationCount: 0,
  redemptionCount: 0,
  usageLimit: null,
  usageCount: 0,
  perClientLimit: null,
  startsAt: null,
  expiresAt: null,
  metadata: {},
  createdAt: new Date(),
  ...overrides,
});

const matchesFilter = (item: Campaign, filter: any): boolean => {
  if (filter._id && String(item._id) !== String(filter._id)) return false;
  if (filter.code !== undefined && item.code !== filter.code) return false;
  if (filter.status !== undefined && item.status !== filter.status) return false;
  if (filter.triggerType !== undefined && item.triggerType !== filter.triggerType) return false;
  if (filter.$and) {
    return filter.$and.every((clause: any) => {
      if (clause.$or) {
        return clause.$or.some((candidate: any) => matchesFilter(item, candidate));
      }
      if (clause.$expr) return true;
      return matchesFilter(item, clause);
    });
  }
  if (filter.$or) return filter.$or.some((candidate: any) => matchesFilter(item, candidate));
  if (filter.startsAt?.$lte && item.startsAt && item.startsAt > filter.startsAt.$lte) return false;
  if (filter.expiresAt?.$gt && item.expiresAt && item.expiresAt <= filter.expiresAt.$gt) return false;
  if (Object.prototype.hasOwnProperty.call(filter, 'startsAt') && filter.startsAt === null && item.startsAt !== null) return false;
  if (Object.prototype.hasOwnProperty.call(filter, 'expiresAt') && filter.expiresAt === null && item.expiresAt !== null) return false;
  if (Object.prototype.hasOwnProperty.call(filter, 'countryCode') && filter.countryCode === null && item.countryCode !== null) return false;
  if (Object.prototype.hasOwnProperty.call(filter, 'currency') && filter.currency === null && item.currency !== null) return false;
  if (filter.countryCode && filter.countryCode !== item.countryCode) return false;
  if (filter.currency && filter.currency !== item.currency) return false;
  return true;
};

const getReservation = (item: Campaign, reservationId: string) =>
  item.metadata?.reservationIds?.[reservationId];

const setReservation = (item: Campaign, reservationId: string, value: Record<string, unknown>) => {
  item.metadata = item.metadata || {};
  item.metadata.reservationIds = item.metadata.reservationIds || {};
  item.metadata.reservationIds[reservationId] = {
    ...(item.metadata.reservationIds[reservationId] || {}),
    ...value,
  };
};

(Promotion as any).find = (filter: any) => ({
  sort: () => campaigns
    .filter((item) => matchesFilter(item, filter))
    .sort((a, b) => a.priority - b.priority || b.createdAt.getTime() - a.createdAt.getTime()),
});

(Promotion as any).updateOne = async (filter: any, update: any) => {
  const item = campaigns.find((candidate) => String(candidate._id) === String(filter._id));
  if (!item) return { modifiedCount: 0 };

  const reservationId = Object.keys(filter)
    .find((key) => key.startsWith('metadata.reservationIds.') && key.endsWith('.status'))
    ?.split('.')[2];
  if (reservationId && getReservation(item, reservationId)?.status !== filter[`metadata.reservationIds.${reservationId}.status`]) {
    return { modifiedCount: 0 };
  }
  if (filter.reservedBudgetMinor?.$gte !== undefined && item.reservedBudgetMinor < filter.reservedBudgetMinor.$gte) {
    return { modifiedCount: 0 };
  }
  if (filter.redeemedBudgetMinor?.$gte !== undefined && item.redeemedBudgetMinor < filter.redeemedBudgetMinor.$gte) {
    return { modifiedCount: 0 };
  }

  const inc = update.$inc || {};
  const projectedUsage = item.usageCount + (inc.usageCount || 0);
  const projectedReserved = item.reservedBudgetMinor + (inc.reservedBudgetMinor || 0);
  const projectedRedeemed = item.redeemedBudgetMinor + (inc.redeemedBudgetMinor || 0);
  if (item.usageLimit !== null && item.usageLimit !== undefined && projectedUsage > item.usageLimit) return { modifiedCount: 0 };
  if (item.budgetMinor !== null && item.budgetMinor !== undefined && projectedReserved + projectedRedeemed > item.budgetMinor) return { modifiedCount: 0 };
  if (projectedUsage < 0 || projectedReserved < 0 || projectedRedeemed < 0) return { modifiedCount: 0 };

  Object.entries(inc).forEach(([key, value]) => {
    item[key] = (item[key] || 0) + Number(value);
  });
  Object.entries(update.$set || {}).forEach(([key, value]) => {
    const match = key.match(/^metadata\.reservationIds\.([^.]*)\.(.*)$/);
    if (match) setReservation(item, match[1], { [match[2]]: value });
    const wholeReservationMatch = key.match(/^metadata\.reservationIds\.([^.]*)$/);
    if (wholeReservationMatch && value && typeof value === 'object') {
      setReservation(item, wholeReservationMatch[1], value as Record<string, unknown>);
    }
  });
  return { modifiedCount: 1 };
};

(Booking as any).countDocuments = async (filter: any) => {
  if (filter['metadata.promotion.promotionId']) {
    return existingBookings.filter((booking) =>
      booking.customerId === String(filter.customerId) &&
      booking.promotionId === filter['metadata.promotion.promotionId'] &&
      !booking.cancelled
    ).length;
  }
  return existingBookings.filter((booking) => booking.customerId === String(filter.customerId) && !booking.cancelled).length;
};

const reset = (...items: Campaign[]) => {
  campaigns = items;
  existingBookings = [];
};

const expectCodeRejects = async (code: string, message: string) => {
  await assert.rejects(
    () => resolvePromotionsForPricing(baseContext({ promoCode: code })),
    (error: any) => error.message.includes(message)
  );
};

const reserveOne = async (snapshot: AppliedPromotionSnapshot) => {
  await reservePromotions([snapshot]);
  return campaigns.find((item) => String(item._id) === snapshot.promotionId)!;
};

const run = async () => {
  reset(campaign());
  let result = await resolvePromotionsForPricing(baseContext());
  assert.strictEqual(result.promotionDiscountMinor, 1000, 'automatic promotion applies without code');

  reset(campaign({ serviceKeys: ['electrical'] }));
  result = await resolvePromotionsForPricing(baseContext());
  assert.strictEqual(result.promotions.length, 0, 'ineligible automatic promotion does not apply');

  reset(campaign({ triggerType: PromotionTriggerType.CODE, code: 'SAVE10' }));
  result = await resolvePromotionsForPricing(baseContext());
  assert.strictEqual(result.promotions.length, 0, 'promo-code campaign requires code');
  result = await resolvePromotionsForPricing(baseContext({ promoCode: 'save10' }));
  assert.strictEqual(result.promotionDiscountMinor, 1000, 'promo code is case-insensitive');

  reset(campaign({ triggerType: PromotionTriggerType.CODE, code: 'OLD', expiresAt: new Date(Date.now() - 1000) }));
  await expectCodeRejects('OLD', 'invalid or expired');

  reset(campaign({ triggerType: PromotionTriggerType.CODE, code: 'PAUSED', status: PromotionStatus.PAUSED }));
  await expectCodeRejects('PAUSED', 'invalid or expired');

  reset(campaign({ triggerType: PromotionTriggerType.CODE, code: 'USED', usageLimit: 1, usageCount: 1 }));
  await expectCodeRejects('USED', 'not eligible');

  reset(campaign({ countryCode: 'KE' }));
  result = await resolvePromotionsForPricing(baseContext());
  assert.strictEqual(result.promotions.length, 0, 'market targeting blocks other countries');

  reset(campaign({ cityKeys: ['cape-town'] }), campaign({ areaKeys: ['bryanston'], priority: 10 }));
  result = await resolvePromotionsForPricing(baseContext());
  assert.strictEqual(result.promotions[0].area, 'bryanston', 'city and area targeting is honored');

  reset(campaign({ serviceKeys: ['plumbing'], subcategoryKeys: ['geyser'] }));
  result = await resolvePromotionsForPricing(baseContext());
  assert.strictEqual(result.promotions.length, 1, 'service and subcategory targeting applies');

  reset(campaign({ firstBookingOnly: true }));
  existingBookings = [{ customerId }];
  result = await resolvePromotionsForPricing(baseContext());
  assert.strictEqual(result.promotions.length, 0, 'first-booking targeting blocks repeat clients');

  reset(campaign({ minBookingAmountMinor: 20000 }));
  result = await resolvePromotionsForPricing(baseContext());
  assert.strictEqual(result.promotions.length, 0, 'minimum subtotal is enforced');

  reset(campaign({ discountType: PromotionDiscountType.PERCENTAGE, discountValue: 25 }));
  result = await resolvePromotionsForPricing(baseContext());
  assert.strictEqual(result.promotionDiscountMinor, 2500, 'percentage discount');

  reset(campaign({ discountType: PromotionDiscountType.FIXED_AMOUNT, discountValue: 750 }));
  result = await resolvePromotionsForPricing(baseContext());
  assert.strictEqual(result.promotionDiscountMinor, 750, 'fixed discount');

  reset(campaign({ discountType: PromotionDiscountType.FREE_CALLOUT, discountValue: 0 }));
  result = await resolvePromotionsForPricing(baseContext());
  assert.strictEqual(result.promotionDiscountMinor, 10000, 'free call-out fee');

  reset(campaign({ discountType: PromotionDiscountType.PERCENTAGE, discountValue: 50, maxDiscountMinor: 1200 }));
  result = await resolvePromotionsForPricing(baseContext());
  assert.strictEqual(result.promotionDiscountMinor, 1200, 'maximum discount cap');

  reset(campaign({ name: 'low', priority: 50 }), campaign({ name: 'high', priority: 1 }));
  result = await resolvePromotionsForPricing(baseContext());
  assert.strictEqual(result.promotions[0].campaignName, 'high', 'priority selection');
  assert.strictEqual(result.promotions.length, 1, 'non-stacking default');

  reset(
    campaign({ priority: 1, stackingPolicy: PromotionStackingPolicy.STACKABLE }),
    campaign({ priority: 2, stackingPolicy: PromotionStackingPolicy.STACKABLE, discountType: PromotionDiscountType.FIXED_AMOUNT, discountValue: 500 })
  );
  result = await resolvePromotionsForPricing(baseContext());
  assert.strictEqual(result.promotions.length, 2, 'explicit stacking');
  assert.strictEqual(new Set(result.promotions.map((item) => item.promotionId)).size, 2, 'same campaign not applied twice');

  reset(campaign({ budgetMinor: 999 }));
  result = await resolvePromotionsForPricing(baseContext());
  assert.strictEqual(result.promotions.length, 1);
  await assert.rejects(() => reservePromotions(result.promotions), /capacity/, 'budget enforcement at reservation');

  reset(campaign({ usageLimit: 1 }));
  result = await resolvePromotionsForPricing(baseContext());
  await reserveOne(result.promotions[0]);
  assert.strictEqual(campaigns[0].usageCount, 1, 'reservation increments usage');
  await assert.rejects(() => reservePromotions([{ ...result.promotions[0], reservationId: new mongoose.Types.ObjectId().toString() }]), /capacity/, 'usage-limit enforcement');

  reset(campaign({ perClientLimit: 1 }));
  existingBookings = [{ customerId, promotionId: campaigns[0]._id.toString() }];
  result = await resolvePromotionsForPricing(baseContext());
  assert.strictEqual(result.promotions.length, 0, 'per-client limit');

  reset(campaign());
  result = await resolvePromotionsForPricing(baseContext());
  const reserved = await reserveOne(result.promotions[0]);
  assert.strictEqual(reserved.reservedBudgetMinor, 1000, 'reservation reserves budget');
  const redeemed = await redeemPromotions(result.promotions);
  assert.strictEqual(campaigns[0].redemptionCount, 1, 'redemption increments once');
  await redeemPromotions(redeemed);
  assert.strictEqual(campaigns[0].redemptionCount, 1, 'duplicate redemption prevention');

  const reversed = await reverseRedeemedPromotions(redeemed);
  assert.strictEqual(campaigns[0].redemptionCount, 0, 'reversal decrements once');
  await reverseRedeemedPromotions(reversed);
  assert.strictEqual(campaigns[0].redemptionCount, 0, 'duplicate reversal prevention');

  reset(campaign());
  result = await resolvePromotionsForPricing(baseContext());
  await reserveOne(result.promotions[0]);
  const released = await releasePromotionReservations(result.promotions, 'PAYMENT_FAILED');
  assert.strictEqual(campaigns[0].reservedBudgetMinor, 0, 'reservation release');
  await releasePromotionReservations(released, 'PAYMENT_FAILED');
  assert.strictEqual(campaigns[0].usageCount, 0, 'duplicate release prevention');

  reset(campaign({ usageLimit: 1 }));
  const first = await resolvePromotionsForPricing(baseContext({ customerId }));
  const second = await resolvePromotionsForPricing(baseContext({ customerId: otherCustomerId }));
  await Promise.allSettled([reservePromotions(first.promotions), reservePromotions(second.promotions)]);
  assert.strictEqual(campaigns[0].usageCount, 1, 'only one request consumes final usage slot');

  reset(campaign({ budgetMinor: 1000 }));
  const budgetA = await resolvePromotionsForPricing(baseContext({ customerId }));
  const budgetB = await resolvePromotionsForPricing(baseContext({ customerId: otherCustomerId }));
  await Promise.allSettled([reservePromotions(budgetA.promotions), reservePromotions(budgetB.promotions)]);
  assert.strictEqual(campaigns[0].reservedBudgetMinor, 1000, 'only one request consumes remaining budget');

  const myfixer = calculatePriceBreakdown({ currency: 'ZAR', calloutFeeMinor: 10000, promotionDiscountMinor: 1000, promotionFundingSource: 'MYFIXER', marketPricing: { platformCommissionBps: 1500 } });
  assert.strictEqual(myfixer.technicianGrossMinor, 10000, 'MyFixer-funded promotion does not reduce technician gross');
  assert.strictEqual(myfixer.promotionPlatformFundedMinor, 1000, 'MyFixer-funded amount stored');

  const provider = calculatePriceBreakdown({ currency: 'ZAR', calloutFeeMinor: 10000, promotionDiscountMinor: 1000, promotionFundingSource: 'PROVIDER', promotionTechnicianFundedMinor: 1000, marketPricing: { platformCommissionBps: 1500 } });
  assert.strictEqual(provider.technicianGrossMinor, 9000, 'provider-funded amount affects provider earnings only by provider portion');

  const partner = calculatePriceBreakdown({ currency: 'ZAR', calloutFeeMinor: 10000, promotionDiscountMinor: 1000, promotionFundingSource: 'PARTNER', marketPricing: { platformCommissionBps: 1500 } });
  assert.strictEqual(partner.technicianGrossMinor, 10000, 'partner-funded promotion does not reduce technician gross');
  assert.strictEqual(partner.promotionPartnerFundedMinor, 1000, 'partner-funded amount stored');

  const shared = calculatePriceBreakdown({ currency: 'ZAR', calloutFeeMinor: 10000, promotionDiscountMinor: 1000, promotionFundingSource: 'SHARED', promotionTechnicianFundedMinor: 250, promotionPartnerFundedMinor: 250, marketPricing: { platformCommissionBps: 1500 } });
  assert.strictEqual(shared.promotionPlatformFundedMinor + shared.promotionTechnicianFundedMinor + shared.promotionPartnerFundedMinor, 1000, 'shared split totals equal discount');
  assert.strictEqual(shared.technicianGrossMinor, 9750, 'shared provider contribution reduces only provider portion');

  assert.strictEqual(shared.discountMinor, shared.promotionDiscountMinor + shared.otherDiscountMinor, 'discountMinor equals promotion plus other discounts');

  const adminSummary = buildPromotionAnalyticsSummary([
    campaign({ status: PromotionStatus.ACTIVE, redemptionCount: 3, redeemedBudgetMinor: 1200, reservedBudgetMinor: 300, budgetMinor: 5000 }),
    campaign({ status: PromotionStatus.ACTIVE, startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000), redemptionCount: 1, redeemedBudgetMinor: 200, budgetMinor: 1000 }),
    campaign({ status: PromotionStatus.ARCHIVED, redemptionCount: 2, redeemedBudgetMinor: 500, budgetMinor: 500 }),
  ], 25000);
  assert.strictEqual(adminSummary.activePromotions, 1, 'admin summary counts currently active promotions');
  assert.strictEqual(adminSummary.scheduledPromotions, 1, 'admin summary counts scheduled promotions');
  assert.strictEqual(adminSummary.totalRedemptions, 6, 'admin summary uses redemption counters only');
  assert.strictEqual(adminSummary.totalDiscountGrantedMinor, 1900, 'admin summary totals redeemed discount');
  assert.strictEqual(adminSummary.revenueInfluencedMinor, 25000, 'admin summary uses paid invoice revenue input');
  assert.strictEqual(adminSummary.remainingCampaignBudgetMinor, 4300, 'admin summary subtracts redeemed and reserved budget');

  assert.deepStrictEqual(
    promotionMaterialFieldsChanged({ description: 'safe', metadata: { internalNotes: 'ok' } }),
    [],
    'safe metadata edits are not treated as material promotion changes'
  );
  assert.deepStrictEqual(
    promotionMaterialFieldsChanged({ discountValue: 15, fundingSource: PromotionFundingSource.PROVIDER }),
    ['discountValue', 'fundingSource'],
    'financial and funding edits are locked after promotion activity'
  );

  const invoiceHtml = generateInvoiceHtml({
    customerName: 'Client',
    bookingId: 'booking-1',
    baseAmount: 450,
    additionalLabor: 0,
    partsAmount: 0,
    discountAmount: 50,
    promotionLabel: 'New Market Launch Offer',
    subtotalAmount: 400,
    clientServiceFee: 12,
    taxAmount: 60,
    totalAmount: 472,
    currency: 'ZAR',
  });
  assert.ok(invoiceHtml.includes('New Market Launch Offer'), 'invoice email uses customer-facing promotion label');
  assert.ok(!invoiceHtml.includes('Promo Discount ()'), 'invoice email never renders empty promo-code parentheses');
  assert.ok(invoiceHtml.includes('Client Service Fee'), 'invoice email includes client service fee from breakdown');
  assert.ok(invoiceHtml.includes('Tax'), 'invoice email includes tax from breakdown');
};

run()
  .then(() => {
    console.log('Promotion campaign tests passed.');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
