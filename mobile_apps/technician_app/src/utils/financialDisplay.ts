export interface AppliedPromotionSnapshot {
  promotionId?: string;
  campaignName?: string;
  promotionName?: string;
  code?: string | null;
  promoCode?: string | null;
  discountMinor?: number;
  promotionDiscountMinor?: number;
  fundingSource?: string;
  fundingSplitBps?: { platform?: number; technician?: number; partner?: number };
  appliedToInvoice?: boolean;
}

export interface PriceBreakdown {
  currency?: string;
  promotionDiscountMinor?: number;
  promotionPlatformFundedMinor?: number;
  promotionTechnicianFundedMinor?: number;
  promotionPartnerFundedMinor?: number;
  platformCommissionMinor?: number;
  technicianGrossMinor?: number;
  technicianNetMinor?: number;
  partsMinor?: number;
  labourMinor?: number;
  laborMinor?: number;
  appliedPromotions?: AppliedPromotionSnapshot[];
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
  return raw && typeof raw === 'object' ? raw as PriceBreakdown : null;
};

export const promotionSnapshots = (record: any, breakdown?: PriceBreakdown | null): AppliedPromotionSnapshot[] => [
  ...(Array.isArray(record?.promotions) ? record.promotions : []),
  ...(Array.isArray(record?.metadata?.promotions) ? record.metadata.promotions : []),
  ...(Array.isArray(breakdown?.appliedPromotions) ? breakdown.appliedPromotions : []),
  record?.promotion,
  record?.metadata?.promotion,
].filter((item: any) => item && item.appliedToInvoice !== false && asNumber(item.discountMinor ?? item.promotionDiscountMinor) > 0);

export const promotionDiscountMinor = (promotion: AppliedPromotionSnapshot): number =>
  asNumber(promotion.discountMinor ?? promotion.promotionDiscountMinor);
