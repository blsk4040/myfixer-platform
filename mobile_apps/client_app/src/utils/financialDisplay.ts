export interface AppliedPromotionSnapshot {
  promotionId?: string;
  promotionName?: string;
  campaignName?: string;
  promotionMode?: 'AUTOMATIC' | 'PROMO_CODE' | 'CODE';
  triggerType?: 'AUTOMATIC' | 'CODE';
  code?: string | null;
  promoCode?: string | null;
  discountType?: string;
  discountMinor?: number;
  promotionDiscountMinor?: number;
  fundingSource?: 'MYFIXER' | 'PROVIDER' | 'PARTNER' | 'SHARED' | string;
  myfixerFundedDiscountMinor?: number;
  providerFundedDiscountMinor?: number;
  partnerFundedDiscountMinor?: number;
  promotionPlatformFundedMinor?: number;
  promotionTechnicianFundedMinor?: number;
  promotionPartnerFundedMinor?: number;
  appliedAt?: string;
  appliedToInvoice?: boolean;
  promotionVersion?: string | number;
}

export interface PriceBreakdown {
  currency?: string;
  calloutFeeMinor?: number;
  labourMinor?: number;
  laborMinor?: number;
  partsMinor?: number;
  additionalServicesMinor?: number;
  surchargeMinor?: number;
  promotionDiscountMinor?: number;
  otherDiscountMinor?: number;
  discountMinor?: number;
  subtotalMinor?: number;
  clientServiceFeeMinor?: number;
  taxMinor?: number;
  totalMinor?: number;
  platformCommissionMinor?: number;
  technicianGrossMinor?: number;
  technicianNetMinor?: number;
  promotionPlatformFundedMinor?: number;
  promotionTechnicianFundedMinor?: number;
  promotionPartnerFundedMinor?: number;
  appliedPromotions?: AppliedPromotionSnapshot[];
  promotions?: AppliedPromotionSnapshot[];
}

const currencyMinorDigits: Record<string, number> = {
  BHD: 3,
  JOD: 3,
  KWD: 3,
  OMR: 3,
  TND: 3,
  CLP: 0,
  JPY: 0,
  KRW: 0,
  RWF: 0,
  UGX: 0,
  VND: 0,
  XOF: 0,
  XAF: 0,
};

export const minorToMajor = (amountMinor = 0, currency = ''): number => {
  const digits = currencyMinorDigits[String(currency || '').toUpperCase()] ?? 2;
  return amountMinor / Math.pow(10, digits);
};

export const formatMinorMoney = (currency = '', amountMinor = 0): string => {
  if (!currency) return 'Unavailable';
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
    }).format(minorToMajor(amountMinor, currency));
  } catch {
    return `${currency} ${minorToMajor(amountMinor, currency).toFixed(2)}`;
  }
};

export const asNumber = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

export const normalizePriceBreakdown = (record: any): PriceBreakdown | null => {
  const raw = record?.priceBreakdown || record?.price_breakdown || record?.metadata?.priceBreakdown || null;
  if (!raw || typeof raw !== 'object') return null;
  return raw as PriceBreakdown;
};

export const promotionSnapshots = (record: any, breakdown?: PriceBreakdown | null): AppliedPromotionSnapshot[] => {
  const raw = [
    ...(Array.isArray(record?.promotions) ? record.promotions : []),
    ...(Array.isArray(record?.promotionSnapshots) ? record.promotionSnapshots : []),
    ...(Array.isArray(breakdown?.appliedPromotions) ? breakdown.appliedPromotions : []),
    ...(Array.isArray(breakdown?.promotions) ? breakdown.promotions : []),
    record?.promotion,
  ].filter(Boolean);
  const seen = new Set<string>();
  return raw.filter((item: any) => {
    const discount = asNumber(item.discountMinor ?? item.promotionDiscountMinor);
    if (item.appliedToInvoice === false || discount <= 0) return false;
    const key = String(item.reservationId || item.promotionId || item.code || item.campaignName || JSON.stringify(item));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }) as AppliedPromotionSnapshot[];
};

export const promotionLabel = (promotion: AppliedPromotionSnapshot): string => {
  const code = String(promotion.promoCode || promotion.code || '').trim();
  if (code) return `Promotion - ${code}`;
  return String(promotion.promotionName || promotion.campaignName || 'Promotion').trim();
};

export const promotionDiscountMinor = (promotion: AppliedPromotionSnapshot): number =>
  asNumber(promotion.discountMinor ?? promotion.promotionDiscountMinor);
