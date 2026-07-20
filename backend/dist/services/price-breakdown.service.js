"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculatePriceBreakdown = void 0;
const positiveMinor = (value) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
const bps = (value, fallback = 0) => {
    const next = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
    return Math.min(Math.max(next, 0), 10000);
};
const calculatePriceBreakdown = (input) => {
    const pricing = input.marketPricing || {};
    const calloutFeeMinor = positiveMinor(input.calloutFeeMinor);
    const labourMinor = positiveMinor(input.labourMinor);
    const partsMinor = positiveMinor(input.partsMinor);
    const additionalServicesMinor = positiveMinor(input.additionalServicesMinor);
    const surchargeMinor = positiveMinor(input.surchargeMinor);
    const explicitPromotionDiscountMinor = positiveMinor(input.promotionDiscountMinor);
    const explicitOtherDiscountMinor = positiveMinor(input.otherDiscountMinor);
    const legacyDiscountMinor = positiveMinor(input.discountMinor);
    const promotionDiscountMinor = explicitPromotionDiscountMinor;
    const otherDiscountMinor = explicitOtherDiscountMinor || (promotionDiscountMinor > 0 ? 0 : legacyDiscountMinor);
    const discountMinor = promotionDiscountMinor + otherDiscountMinor;
    const subtotalBeforeDiscount = calloutFeeMinor + labourMinor + partsMinor + additionalServicesMinor + surchargeMinor;
    const subtotalMinor = Math.max(subtotalBeforeDiscount - discountMinor, 0);
    const promotionTechnicianFundedMinor = Math.min(promotionDiscountMinor, positiveMinor(input.promotionTechnicianFundedMinor));
    const explicitPartnerFundedMinor = Math.min(Math.max(promotionDiscountMinor - promotionTechnicianFundedMinor, 0), positiveMinor(input.promotionPartnerFundedMinor));
    const fundingSource = input.promotionFundingSource === 'PLATFORM'
        ? 'MYFIXER'
        : input.promotionFundingSource === 'TECHNICIAN'
            ? 'PROVIDER'
            : input.promotionFundingSource || 'MYFIXER';
    const promotionPartnerFundedMinor = fundingSource === 'PARTNER'
        ? Math.max(promotionDiscountMinor - promotionTechnicianFundedMinor, 0)
        : fundingSource === 'SHARED'
            ? explicitPartnerFundedMinor
            : 0;
    const promotionPlatformFundedMinor = fundingSource === 'MYFIXER'
        ? Math.max(promotionDiscountMinor - promotionTechnicianFundedMinor - promotionPartnerFundedMinor, 0)
        : fundingSource === 'SHARED'
            ? Math.max(promotionDiscountMinor - promotionTechnicianFundedMinor - promotionPartnerFundedMinor, 0)
            : 0;
    const clientServiceFeeType = pricing.clientServiceFeeType || 'NONE';
    const clientServiceFeeMinor = clientServiceFeeType === 'FIXED'
        ? positiveMinor(pricing.clientServiceFeeMinor)
        : clientServiceFeeType === 'PERCENTAGE'
            ? Math.round((subtotalMinor * bps(pricing.clientServiceFeeBps)) / 10000)
            : 0;
    const taxableBaseBeforeDiscount = (pricing.taxableCallout === false ? 0 : calloutFeeMinor) +
        (pricing.taxableLabour === false ? 0 : labourMinor) +
        (pricing.taxableParts === false ? 0 : partsMinor) +
        (pricing.taxableAdditionalServices === false ? 0 : additionalServicesMinor + surchargeMinor) +
        (pricing.taxableClientServiceFee === false ? 0 : clientServiceFeeMinor);
    const taxableBase = Math.max(taxableBaseBeforeDiscount - (pricing.discountsReduceTaxableValue === false ? 0 : discountMinor), 0);
    const taxRateBps = bps(pricing.taxRateBps);
    const taxInclusive = pricing.taxInclusive === true;
    const taxMinor = taxRateBps > 0
        ? taxInclusive
            ? Math.round(taxableBase - taxableBase / (1 + taxRateBps / 10000))
            : Math.round((taxableBase * taxRateBps) / 10000)
        : 0;
    const totalMinor = subtotalMinor + clientServiceFeeMinor + (taxInclusive ? 0 : taxMinor);
    const platformCommissionBps = bps(pricing.platformCommissionBps);
    const technicianGrossMinor = Math.max(subtotalBeforeDiscount - otherDiscountMinor - promotionTechnicianFundedMinor, 0);
    const platformCommissionMinor = Math.round((technicianGrossMinor * platformCommissionBps) / 10000);
    const technicianNetMinor = Math.max(technicianGrossMinor - platformCommissionMinor, 0);
    return {
        currency: input.currency,
        calloutFeeMinor,
        labourMinor,
        partsMinor,
        additionalServicesMinor,
        surchargeMinor,
        promotionDiscountMinor,
        otherDiscountMinor,
        discountMinor,
        subtotalMinor,
        clientServiceFeeMinor,
        taxMinor,
        totalMinor,
        promotionPlatformFundedMinor,
        promotionTechnicianFundedMinor,
        promotionPartnerFundedMinor,
        platformCommissionMinor,
        technicianGrossMinor,
        technicianNetMinor,
        taxLabel: pricing.taxLabel || 'Tax',
        taxRateBps,
        taxInclusive,
        platformCommissionBps,
        clientServiceFeeType,
    };
};
exports.calculatePriceBreakdown = calculatePriceBreakdown;
//# sourceMappingURL=price-breakdown.service.js.map