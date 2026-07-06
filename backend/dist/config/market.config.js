"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fromMinorUnits = exports.toMinorUnits = exports.getCurrencyMinorUnitFactor = exports.getMarketByCurrency = exports.getMarketByCountry = exports.isCurrencyCode = exports.normalizeCountryCode = exports.MARKET_CONFIG = exports.CurrencyCode = exports.CountryCode = void 0;
var CountryCode;
(function (CountryCode) {
    CountryCode["ZA"] = "ZA";
    CountryCode["GH"] = "GH";
    CountryCode["NG"] = "NG";
    CountryCode["KE"] = "KE";
    CountryCode["UG"] = "UG";
    CountryCode["TZ"] = "TZ";
    CountryCode["RW"] = "RW";
    CountryCode["ZM"] = "ZM";
})(CountryCode || (exports.CountryCode = CountryCode = {}));
var CurrencyCode;
(function (CurrencyCode) {
    CurrencyCode["ZAR"] = "ZAR";
    CurrencyCode["GHS"] = "GHS";
    CurrencyCode["NGN"] = "NGN";
    CurrencyCode["KES"] = "KES";
    CurrencyCode["UGX"] = "UGX";
    CurrencyCode["TZS"] = "TZS";
    CurrencyCode["RWF"] = "RWF";
    CurrencyCode["ZMW"] = "ZMW";
    CurrencyCode["USD"] = "USD";
})(CurrencyCode || (exports.CurrencyCode = CurrencyCode = {}));
exports.MARKET_CONFIG = {
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
const COUNTRY_ALIASES = {
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
const ZERO_DECIMAL_CURRENCIES = new Set([
    CurrencyCode.UGX,
    CurrencyCode.TZS,
    CurrencyCode.RWF,
]);
const normalizeCountryCode = (value) => {
    if (typeof value !== 'string')
        return CountryCode.ZA;
    const key = value.trim().toUpperCase().replace(/-/g, '_');
    return COUNTRY_ALIASES[key] ?? CountryCode.ZA;
};
exports.normalizeCountryCode = normalizeCountryCode;
const isCurrencyCode = (value) => typeof value === 'string' && Object.values(CurrencyCode).includes(value);
exports.isCurrencyCode = isCurrencyCode;
const getMarketByCountry = (countryCode) => exports.MARKET_CONFIG[countryCode] ?? exports.MARKET_CONFIG[CountryCode.ZA];
exports.getMarketByCountry = getMarketByCountry;
const getMarketByCurrency = (currency) => Object.values(exports.MARKET_CONFIG).find((market) => market.currency === currency) ?? null;
exports.getMarketByCurrency = getMarketByCurrency;
const getCurrencyMinorUnitFactor = (currency) => ZERO_DECIMAL_CURRENCIES.has(currency) ? 1 : 100;
exports.getCurrencyMinorUnitFactor = getCurrencyMinorUnitFactor;
const toMinorUnits = (amount, currency) => Math.round(amount * (0, exports.getCurrencyMinorUnitFactor)(currency));
exports.toMinorUnits = toMinorUnits;
const fromMinorUnits = (amountMinor, currency) => amountMinor / (0, exports.getCurrencyMinorUnitFactor)(currency);
exports.fromMinorUnits = fromMinorUnits;
//# sourceMappingURL=market.config.js.map