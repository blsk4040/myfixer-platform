"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fromMinorUnits = exports.toMinorUnits = exports.getCurrencyMinorUnitFactor = exports.getCurrencyMinorUnit = exports.getMarketByCurrency = exports.getMarketByCountry = exports.isCurrencyCode = exports.normalizeCountryCode = exports.normalizeIsoCurrencyCode = exports.normalizeIsoCountryCode = exports.MARKET_CONFIG = exports.CurrencyCode = exports.CountryCode = void 0;
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
const COUNTRY_ALIASES = {
    ZA: CountryCode.ZA,
    GH: CountryCode.GH,
    NG: CountryCode.NG,
    KE: CountryCode.KE,
    UG: CountryCode.UG,
    TZ: CountryCode.TZ,
    RW: CountryCode.RW,
    ZM: CountryCode.ZM,
};
const CURRENCY_MINOR_UNITS = {
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
const normalizeIsoCountryCode = (value) => {
    if (typeof value !== 'string')
        throw new Error('Invalid ISO country code.');
    const raw = value.trim();
    const aliasKey = raw.toUpperCase().replace(/-/g, '_');
    const normalized = COUNTRY_ALIASES[aliasKey] || raw.toUpperCase();
    if (!/^[A-Z]{2}$/.test(normalized))
        throw new Error('Invalid ISO country code.');
    return normalized;
};
exports.normalizeIsoCountryCode = normalizeIsoCountryCode;
const normalizeIsoCurrencyCode = (value) => {
    if (typeof value !== 'string')
        throw new Error('Invalid currency code.');
    const normalized = value.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(normalized))
        throw new Error('Invalid currency code.');
    return normalized;
};
exports.normalizeIsoCurrencyCode = normalizeIsoCurrencyCode;
exports.normalizeCountryCode = exports.normalizeIsoCountryCode;
const isCurrencyCode = (value) => {
    try {
        (0, exports.normalizeIsoCurrencyCode)(value);
        return true;
    }
    catch {
        return false;
    }
};
exports.isCurrencyCode = isCurrencyCode;
const getMarketByCountry = (countryCode) => exports.MARKET_CONFIG[countryCode] ?? null;
exports.getMarketByCountry = getMarketByCountry;
const getMarketByCurrency = (currency) => Object.values(exports.MARKET_CONFIG).find((market) => market.currency === currency) ?? null;
exports.getMarketByCurrency = getMarketByCurrency;
const getCurrencyMinorUnit = (currency) => {
    const normalized = (0, exports.normalizeIsoCurrencyCode)(currency);
    return CURRENCY_MINOR_UNITS[normalized] ?? 2;
};
exports.getCurrencyMinorUnit = getCurrencyMinorUnit;
const getCurrencyMinorUnitFactor = (currency) => 10 ** (0, exports.getCurrencyMinorUnit)(currency);
exports.getCurrencyMinorUnitFactor = getCurrencyMinorUnitFactor;
const toMinorUnits = (amount, currency) => Math.round(amount * (0, exports.getCurrencyMinorUnitFactor)(currency));
exports.toMinorUnits = toMinorUnits;
const fromMinorUnits = (amountMinor, currency) => amountMinor / (0, exports.getCurrencyMinorUnitFactor)(currency);
exports.fromMinorUnits = fromMinorUnits;
//# sourceMappingURL=market.config.js.map