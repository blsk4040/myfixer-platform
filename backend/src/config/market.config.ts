export enum CountryCode {
  ZA = 'ZA',
  GH = 'GH',
  NG = 'NG',
  KE = 'KE',
  UG = 'UG',
  TZ = 'TZ',
  RW = 'RW',
  ZM = 'ZM',
}

export enum CurrencyCode {
  ZAR = 'ZAR',
  GHS = 'GHS',
  NGN = 'NGN',
  KES = 'KES',
  UGX = 'UGX',
  TZS = 'TZS',
  RWF = 'RWF',
  ZMW = 'ZMW',
  USD = 'USD',
}

export type IsoCountryCode = string;
export type IsoCurrencyCode = string;

export type PaymentProviderCode =
  | 'PAYSTACK'
  | 'FLUTTERWAVE'
  | 'MPESA'
  | 'MTN_MOMO'
  | 'AIRTEL_MONEY'
  | 'YOCO'
  | 'OZOW';

export interface MarketConfig {
  countryCode: IsoCountryCode;
  countryName: string;
  currency: IsoCurrencyCode;
  locale: string;
  defaultCalloutFee: number;
  paymentProviders: PaymentProviderCode[];
  taxLabel: string;
  platformCommissionBps: number;
}

export const MARKET_CONFIG: Record<CountryCode, MarketConfig> = {
  [CountryCode.ZA]: {
    countryCode: CountryCode.ZA,
    countryName: 'South Africa',
    currency: CurrencyCode.ZAR,
    locale: 'en-ZA',
    defaultCalloutFee: 450,
    paymentProviders: ['PAYSTACK', 'YOCO', 'OZOW'],
    taxLabel: 'VAT',
    platformCommissionBps: 1500,
  },
  [CountryCode.GH]: {
    countryCode: CountryCode.GH,
    countryName: 'Ghana',
    currency: CurrencyCode.GHS,
    locale: 'en-GH',
    defaultCalloutFee: 350,
    paymentProviders: ['PAYSTACK', 'FLUTTERWAVE', 'MTN_MOMO'],
    taxLabel: 'VAT',
    platformCommissionBps: 1500,
  },
  [CountryCode.NG]: {
    countryCode: CountryCode.NG,
    countryName: 'Nigeria',
    currency: CurrencyCode.NGN,
    locale: 'en-NG',
    defaultCalloutFee: 25000,
    paymentProviders: ['PAYSTACK', 'FLUTTERWAVE'],
    taxLabel: 'VAT',
    platformCommissionBps: 1500,
  },
  [CountryCode.KE]: {
    countryCode: CountryCode.KE,
    countryName: 'Kenya',
    currency: CurrencyCode.KES,
    locale: 'en-KE',
    defaultCalloutFee: 3500,
    paymentProviders: ['MPESA', 'FLUTTERWAVE'],
    taxLabel: 'VAT',
    platformCommissionBps: 1500,
  },
  [CountryCode.UG]: {
    countryCode: CountryCode.UG,
    countryName: 'Uganda',
    currency: CurrencyCode.UGX,
    locale: 'en-UG',
    defaultCalloutFee: 90000,
    paymentProviders: ['FLUTTERWAVE', 'MTN_MOMO', 'AIRTEL_MONEY'],
    taxLabel: 'VAT',
    platformCommissionBps: 1500,
  },
  [CountryCode.TZ]: {
    countryCode: CountryCode.TZ,
    countryName: 'Tanzania',
    currency: CurrencyCode.TZS,
    locale: 'en-TZ',
    defaultCalloutFee: 60000,
    paymentProviders: ['FLUTTERWAVE', 'AIRTEL_MONEY'],
    taxLabel: 'VAT',
    platformCommissionBps: 1500,
  },
  [CountryCode.RW]: {
    countryCode: CountryCode.RW,
    countryName: 'Rwanda',
    currency: CurrencyCode.RWF,
    locale: 'en-RW',
    defaultCalloutFee: 30000,
    paymentProviders: ['FLUTTERWAVE', 'MTN_MOMO'],
    taxLabel: 'VAT',
    platformCommissionBps: 1500,
  },
  [CountryCode.ZM]: {
    countryCode: CountryCode.ZM,
    countryName: 'Zambia',
    currency: CurrencyCode.ZMW,
    locale: 'en-ZM',
    defaultCalloutFee: 450,
    paymentProviders: ['FLUTTERWAVE', 'MTN_MOMO', 'AIRTEL_MONEY'],
    taxLabel: 'VAT',
    platformCommissionBps: 1500,
  },
};

const COUNTRY_ALIASES: Record<string, IsoCountryCode> = {
  ZA: CountryCode.ZA,
  GH: CountryCode.GH,
  NG: CountryCode.NG,
  KE: CountryCode.KE,
  UG: CountryCode.UG,
  TZ: CountryCode.TZ,
  RW: CountryCode.RW,
  ZM: CountryCode.ZM,
};

const CURRENCY_MINOR_UNITS: Record<string, number> = {
  BHD: 3,
  JOD: 3,
  KWD: 3,
  OMR: 3,
  TND: 3,
  CLP: 0,
  DJF: 0,
  GNF: 0,
  JPY: 0,
  KMF: 0,
  KRW: 0,
  MGA: 0,
  PYG: 0,
  RWF: 0,
  UGX: 0,
  VND: 0,
  VUV: 0,
  XAF: 0,
  XOF: 0,
  XPF: 0,
  TZS: 0,
};

export const normalizeIsoCountryCode = (value: unknown): IsoCountryCode => {
  if (typeof value !== 'string') throw new Error('Invalid ISO country code.');
  const raw = value.trim();
  const aliasKey = raw.toUpperCase().replace(/-/g, '_');
  const normalized = COUNTRY_ALIASES[aliasKey] || raw.toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) throw new Error('Invalid ISO country code.');
  return normalized;
};

export const normalizeIsoCurrencyCode = (value: unknown): IsoCurrencyCode => {
  if (typeof value !== 'string') throw new Error('Invalid currency code.');
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) throw new Error('Invalid currency code.');
  return normalized;
};

export const normalizeCountryCode = normalizeIsoCountryCode;

export const isCurrencyCode = (value: unknown): value is IsoCurrencyCode => {
  try {
    normalizeIsoCurrencyCode(value);
    return true;
  } catch {
    return false;
  }
};

export const getMarketByCountry = (countryCode: IsoCountryCode): MarketConfig | null =>
  MARKET_CONFIG[countryCode as CountryCode] ?? null;

export const getMarketByCurrency = (currency: IsoCurrencyCode): MarketConfig | null =>
  Object.values(MARKET_CONFIG).find((market) => market.currency === currency) ?? null;

export const getCurrencyMinorUnit = (currency: IsoCurrencyCode): number => {
  const normalized = normalizeIsoCurrencyCode(currency);
  return CURRENCY_MINOR_UNITS[normalized] ?? 2;
};

export const getCurrencyMinorUnitFactor = (currency: IsoCurrencyCode): number =>
  10 ** getCurrencyMinorUnit(currency);

export const toMinorUnits = (amount: number, currency: IsoCurrencyCode): number =>
  Math.round(amount * getCurrencyMinorUnitFactor(currency));

export const fromMinorUnits = (amountMinor: number, currency: IsoCurrencyCode): number =>
  amountMinor / getCurrencyMinorUnitFactor(currency);
