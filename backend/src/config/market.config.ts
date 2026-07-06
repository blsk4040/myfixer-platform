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

export type PaymentProviderCode =
  | 'PAYSTACK'
  | 'FLUTTERWAVE'
  | 'MPESA'
  | 'MTN_MOMO'
  | 'AIRTEL_MONEY'
  | 'YOCO'
  | 'OZOW';

export interface MarketConfig {
  countryCode: CountryCode;
  countryName: string;
  currency: CurrencyCode;
  locale: string;
  defaultCalloutFee: number;
  paymentProviders: PaymentProviderCode[];
  taxLabel: string;
  platformCommissionBps: number;
  enabled: boolean;
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
    enabled: true,
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
    enabled: true,
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
    enabled: true,
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
    enabled: true,
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
    enabled: false,
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
    enabled: false,
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
    enabled: false,
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
    enabled: false,
  },
};

const COUNTRY_ALIASES: Record<string, CountryCode> = {
  SOUTH_AFRICA: CountryCode.ZA,
  'SOUTH AFRICA': CountryCode.ZA,
  ZA: CountryCode.ZA,
  GHANA: CountryCode.GH,
  GH: CountryCode.GH,
  NIGERIA: CountryCode.NG,
  NG: CountryCode.NG,
  KENYA: CountryCode.KE,
  KE: CountryCode.KE,
  UGANDA: CountryCode.UG,
  UG: CountryCode.UG,
  TANZANIA: CountryCode.TZ,
  TZ: CountryCode.TZ,
  RWANDA: CountryCode.RW,
  RW: CountryCode.RW,
  ZAMBIA: CountryCode.ZM,
  ZM: CountryCode.ZM,
};

const ZERO_DECIMAL_CURRENCIES = new Set<CurrencyCode>([
  CurrencyCode.UGX,
  CurrencyCode.TZS,
  CurrencyCode.RWF,
]);

export const normalizeCountryCode = (value: unknown): CountryCode => {
  if (typeof value !== 'string') return CountryCode.ZA;

  const key = value.trim().toUpperCase().replace(/-/g, '_');
  return COUNTRY_ALIASES[key] ?? CountryCode.ZA;
};

export const isCurrencyCode = (value: unknown): value is CurrencyCode =>
  typeof value === 'string' && Object.values(CurrencyCode).includes(value as CurrencyCode);

export const getMarketByCountry = (countryCode: CountryCode): MarketConfig =>
  MARKET_CONFIG[countryCode] ?? MARKET_CONFIG[CountryCode.ZA];

export const getMarketByCurrency = (currency: CurrencyCode): MarketConfig | null =>
  Object.values(MARKET_CONFIG).find((market) => market.currency === currency) ?? null;

export const getCurrencyMinorUnitFactor = (currency: CurrencyCode): number =>
  ZERO_DECIMAL_CURRENCIES.has(currency) ? 1 : 100;

export const toMinorUnits = (amount: number, currency: CurrencyCode): number =>
  Math.round(amount * getCurrencyMinorUnitFactor(currency));

export const fromMinorUnits = (amountMinor: number, currency: CurrencyCode): number =>
  amountMinor / getCurrencyMinorUnitFactor(currency);
