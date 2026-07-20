"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePayoutStartupConfiguration = exports.assertPayoutMethodSupported = exports.getCountryPaymentFeatureFlags = exports.getCountryPaymentCapabilities = exports.COUNTRY_PAYMENT_CAPABILITIES = void 0;
const market_config_1 = require("./market.config");
const provider_payout_method_model_1 = require("../models/provider-payout-method.model");
const envFlag = (name, fallback) => {
    const raw = process.env[name];
    if (raw === undefined)
        return fallback;
    return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
};
exports.COUNTRY_PAYMENT_CAPABILITIES = {
    [market_config_1.CountryCode.ZA]: {
        countryCode: market_config_1.CountryCode.ZA,
        currency: market_config_1.CurrencyCode.ZAR,
        collectionProvider: 'PAYSTACK',
        payoutProvider: 'PAYSTACK',
        customerPaymentMethods: ['CARD', 'INSTANT_EFT', 'CAPITEC_PAY', 'SCAN_TO_PAY'],
        providerPayoutMethods: [provider_payout_method_model_1.ProviderPayoutMethodType.BANK_ACCOUNT],
        defaultProviderPayoutMethod: provider_payout_method_model_1.ProviderPayoutMethodType.BANK_ACCOUNT,
        collectionEnabled: true,
        payoutsEnabled: false,
        adminApprovalRequired: true,
    },
    [market_config_1.CountryCode.GH]: {
        countryCode: market_config_1.CountryCode.GH,
        currency: market_config_1.CurrencyCode.GHS,
        collectionProvider: 'PAYSTACK',
        payoutProvider: 'PAYSTACK',
        customerPaymentMethods: ['CARD', 'MOBILE_MONEY'],
        providerPayoutMethods: [provider_payout_method_model_1.ProviderPayoutMethodType.BANK_ACCOUNT, provider_payout_method_model_1.ProviderPayoutMethodType.MOBILE_MONEY],
        defaultProviderPayoutMethod: provider_payout_method_model_1.ProviderPayoutMethodType.MOBILE_MONEY,
        collectionEnabled: false,
        payoutsEnabled: false,
        adminApprovalRequired: true,
    },
    [market_config_1.CountryCode.KE]: {
        countryCode: market_config_1.CountryCode.KE,
        currency: market_config_1.CurrencyCode.KES,
        collectionProvider: 'PAYSTACK',
        payoutProvider: 'PAYSTACK',
        customerPaymentMethods: ['CARD', 'MOBILE_MONEY'],
        providerPayoutMethods: [provider_payout_method_model_1.ProviderPayoutMethodType.BANK_ACCOUNT, provider_payout_method_model_1.ProviderPayoutMethodType.MOBILE_MONEY],
        defaultProviderPayoutMethod: provider_payout_method_model_1.ProviderPayoutMethodType.MOBILE_MONEY,
        collectionEnabled: false,
        payoutsEnabled: false,
        adminApprovalRequired: true,
    },
    [market_config_1.CountryCode.NG]: disabled(market_config_1.CountryCode.NG, market_config_1.CurrencyCode.NGN),
    [market_config_1.CountryCode.UG]: disabled(market_config_1.CountryCode.UG, market_config_1.CurrencyCode.UGX),
    [market_config_1.CountryCode.TZ]: disabled(market_config_1.CountryCode.TZ, market_config_1.CurrencyCode.TZS),
    [market_config_1.CountryCode.RW]: disabled(market_config_1.CountryCode.RW, market_config_1.CurrencyCode.RWF),
    [market_config_1.CountryCode.ZM]: disabled(market_config_1.CountryCode.ZM, market_config_1.CurrencyCode.ZMW),
};
function disabled(countryCode, currency) {
    return {
        countryCode,
        currency,
        collectionProvider: 'PAYSTACK',
        payoutProvider: 'PAYSTACK',
        customerPaymentMethods: [],
        providerPayoutMethods: [],
        defaultProviderPayoutMethod: provider_payout_method_model_1.ProviderPayoutMethodType.BANK_ACCOUNT,
        collectionEnabled: false,
        payoutsEnabled: false,
        adminApprovalRequired: true,
    };
}
const getCountryPaymentCapabilities = (countryCode) => exports.COUNTRY_PAYMENT_CAPABILITIES[countryCode] ?? disabled(countryCode, '');
exports.getCountryPaymentCapabilities = getCountryPaymentCapabilities;
const getCountryPaymentFeatureFlags = (countryCode) => {
    const capabilities = (0, exports.getCountryPaymentCapabilities)(countryCode);
    const globalPayouts = envFlag('PROVIDER_PAYOUTS_ENABLED', false);
    return {
        countryCode,
        customerCollectionsEnabled: capabilities.collectionEnabled && envFlag(`${countryCode}_CUSTOMER_COLLECTIONS_ENABLED`, capabilities.collectionEnabled),
        providerPayoutsEnabled: globalPayouts && envFlag(`${countryCode}_PROVIDER_PAYOUTS_ENABLED`, capabilities.payoutsEnabled),
        bankPayoutsEnabled: capabilities.providerPayoutMethods.includes(provider_payout_method_model_1.ProviderPayoutMethodType.BANK_ACCOUNT) &&
            globalPayouts &&
            envFlag(`${countryCode}_BANK_PAYOUTS_ENABLED`, false),
        mobileMoneyCollectionsEnabled: capabilities.customerPaymentMethods.includes('MOBILE_MONEY') &&
            envFlag(`${countryCode}_MOBILE_MONEY_COLLECTIONS_ENABLED`, false),
        mobileMoneyPayoutsEnabled: capabilities.providerPayoutMethods.includes(provider_payout_method_model_1.ProviderPayoutMethodType.MOBILE_MONEY) &&
            globalPayouts &&
            envFlag(`${countryCode}_MOBILE_MONEY_PAYOUTS_ENABLED`, false),
        automaticPayoutsEnabled: envFlag('AUTOMATIC_PAYOUTS_ENABLED', false),
        adminApprovalRequired: envFlag('ADMIN_PAYOUT_APPROVAL_REQUIRED', capabilities.adminApprovalRequired),
    };
};
exports.getCountryPaymentFeatureFlags = getCountryPaymentFeatureFlags;
const assertPayoutMethodSupported = (countryCode, currency, methodType) => {
    const capabilities = (0, exports.getCountryPaymentCapabilities)(countryCode);
    if (capabilities.currency !== currency) {
        throw new Error(`Payout currency ${currency} is not supported for ${countryCode}.`);
    }
    if (!capabilities.providerPayoutMethods.includes(methodType)) {
        throw new Error(`${methodType} payouts are not supported for ${countryCode}.`);
    }
};
exports.assertPayoutMethodSupported = assertPayoutMethodSupported;
const validatePayoutStartupConfiguration = () => {
    const payoutsEnabled = envFlag('PROVIDER_PAYOUTS_ENABLED', false);
    const transfersEnabled = envFlag('PAYSTACK_TRANSFERS_ENABLED', false);
    const automaticPayoutsEnabled = envFlag('AUTOMATIC_PAYOUTS_ENABLED', false);
    const adminApprovalRequired = envFlag('ADMIN_PAYOUT_APPROVAL_REQUIRED', true);
    if (automaticPayoutsEnabled && adminApprovalRequired) {
        throw new Error('AUTOMATIC_PAYOUTS_ENABLED cannot be true while ADMIN_PAYOUT_APPROVAL_REQUIRED=true.');
    }
    if (!payoutsEnabled && !transfersEnabled)
        return;
    if (!process.env.PAYOUT_DATA_ENCRYPTION_KEY?.trim()) {
        throw new Error('PAYOUT_DATA_ENCRYPTION_KEY must be configured when provider payouts are enabled.');
    }
    if (!process.env.PAYSTACK_SECRET_KEY?.trim()) {
        throw new Error('PAYSTACK_SECRET_KEY must be configured when Paystack transfers are enabled.');
    }
    if (!process.env.PAYSTACK_TRANSFER_SOURCE?.trim()) {
        throw new Error('PAYSTACK_TRANSFER_SOURCE must be configured when Paystack transfers are enabled.');
    }
};
exports.validatePayoutStartupConfiguration = validatePayoutStartupConfiguration;
//# sourceMappingURL=payment-capabilities.config.js.map