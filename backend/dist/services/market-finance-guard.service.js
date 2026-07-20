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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMarketPayoutCapabilities = exports.assertMarketAllowsNewPayout = exports.assertMarketAllowsPaymentCollection = exports.assertActiveMarket = exports.MarketFinanceGuardError = void 0;
const market_setting_model_1 = __importStar(require("../models/market-setting.model"));
const provider_payout_method_model_1 = require("../models/provider-payout-method.model");
class MarketFinanceGuardError extends Error {
    code;
    statusCode;
    constructor(message, code, statusCode = 409) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
    }
}
exports.MarketFinanceGuardError = MarketFinanceGuardError;
const normalize = (value) => String(value || '').trim().toUpperCase();
const methodAliases = {
    [provider_payout_method_model_1.ProviderPayoutMethodType.BANK_ACCOUNT]: ['BANK_ACCOUNT', 'BANK', 'BANK_TRANSFER'],
    [provider_payout_method_model_1.ProviderPayoutMethodType.MOBILE_MONEY]: ['MOBILE_MONEY', 'MOMO', 'WALLET'],
};
const findProvider = (market, provider, usage) => {
    const providerCode = normalize(provider);
    const configured = market.payments?.providerSettings || [];
    const match = configured.find((setting) => normalize(setting.provider) === providerCode);
    if (!match)
        return null;
    if (match.status !== market_setting_model_1.PaymentProviderStatus.ACTIVE)
        return null;
    if (usage === 'payout' && match.payoutEnabled !== true)
        return null;
    return match;
};
const assertActiveMarket = async (countryCode) => {
    const normalizedCountryCode = normalize(countryCode);
    if (!normalizedCountryCode) {
        throw new MarketFinanceGuardError('Market country is required.', 'MARKET_COUNTRY_REQUIRED', 400);
    }
    const market = await market_setting_model_1.default.findOne({ 'identity.countryCode': normalizedCountryCode });
    if (!market) {
        throw new MarketFinanceGuardError('Market is not configured.', 'MARKET_NOT_CONFIGURED', 404);
    }
    if (market.deletionLock?.locked) {
        throw new MarketFinanceGuardError('Market is temporarily locked for administrative deletion.', 'MARKET_DELETE_PENDING', 423);
    }
    if (market.identity.status !== market_setting_model_1.MarketStatus.ACTIVE) {
        throw new MarketFinanceGuardError('Market is not active for this operation.', 'MARKET_NOT_ACTIVE', 409);
    }
    return market;
};
exports.assertActiveMarket = assertActiveMarket;
const assertMarketAllowsPaymentCollection = async (countryCode, currency, provider = 'PAYSTACK') => {
    const market = await (0, exports.assertActiveMarket)(countryCode);
    const expectedCurrency = normalize(market.identity.currency);
    if (normalize(currency) !== expectedCurrency) {
        throw new MarketFinanceGuardError('Payment currency must match the active booking market.', 'PAYMENT_CURRENCY_MISMATCH', 409);
    }
    const providerSetting = findProvider(market, provider, 'collection');
    if (!providerSetting) {
        throw new MarketFinanceGuardError('Payment provider is not active for this market.', 'PAYMENT_PROVIDER_INACTIVE', 409);
    }
    return { market, provider: providerSetting };
};
exports.assertMarketAllowsPaymentCollection = assertMarketAllowsPaymentCollection;
const assertMarketAllowsNewPayout = async (countryCode, currency, provider = 'PAYSTACK', methodType) => {
    const market = await (0, exports.assertActiveMarket)(countryCode);
    const expectedCurrency = normalize(market.identity.currency);
    if (normalize(currency) !== expectedCurrency) {
        throw new MarketFinanceGuardError('Payout currency must match the active technician market.', 'PAYOUT_CURRENCY_MISMATCH', 409);
    }
    const providerSetting = findProvider(market, provider, 'payout');
    if (!providerSetting) {
        throw new MarketFinanceGuardError('Payout provider is not active for this market.', 'PAYOUT_PROVIDER_INACTIVE', 409);
    }
    if (methodType) {
        const aliases = methodAliases[methodType] || [methodType];
        const enabledMethods = (providerSetting.methods || []).map(normalize);
        if (!aliases.some((alias) => enabledMethods.includes(alias))) {
            throw new MarketFinanceGuardError('Payout method is not enabled for this market provider.', 'PAYOUT_METHOD_DISABLED', 409);
        }
    }
    return { market, provider: providerSetting };
};
exports.assertMarketAllowsNewPayout = assertMarketAllowsNewPayout;
const getMarketPayoutCapabilities = async (countryCode) => {
    try {
        const market = await (0, exports.assertActiveMarket)(countryCode);
        const payoutProviders = (market.payments?.providerSettings || [])
            .filter((setting) => setting.status === market_setting_model_1.PaymentProviderStatus.ACTIVE && setting.payoutEnabled === true);
        const methodSet = new Set();
        payoutProviders.forEach((setting) => {
            const methods = (setting.methods || []).map(normalize);
            if (methodAliases.BANK_ACCOUNT.some((alias) => methods.includes(alias)))
                methodSet.add(provider_payout_method_model_1.ProviderPayoutMethodType.BANK_ACCOUNT);
            if (methodAliases.MOBILE_MONEY.some((alias) => methods.includes(alias)))
                methodSet.add(provider_payout_method_model_1.ProviderPayoutMethodType.MOBILE_MONEY);
        });
        const providerPayoutMethods = Array.from(methodSet);
        return {
            countryCode: market.identity.countryCode,
            currency: market.identity.currency,
            providerPayoutMethods,
            defaultProviderPayoutMethod: providerPayoutMethods[0] || provider_payout_method_model_1.ProviderPayoutMethodType.BANK_ACCOUNT,
            payoutsEnabled: providerPayoutMethods.length > 0,
            adminApprovalRequired: true,
        };
    }
    catch {
        return {
            countryCode: normalize(countryCode),
            currency: '',
            providerPayoutMethods: [],
            defaultProviderPayoutMethod: provider_payout_method_model_1.ProviderPayoutMethodType.BANK_ACCOUNT,
            payoutsEnabled: false,
            adminApprovalRequired: true,
        };
    }
};
exports.getMarketPayoutCapabilities = getMarketPayoutCapabilities;
//# sourceMappingURL=market-finance-guard.service.js.map