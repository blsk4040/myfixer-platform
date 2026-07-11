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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.disablePayoutMethod = exports.setDefaultPayoutMethod = exports.createMobileMoneyPayoutMethod = exports.createBankPayoutMethod = exports.listTechnicianPayoutMethods = exports.serializePayoutMethod = exports.PayoutMethodError = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const market_config_1 = require("../config/market.config");
const payment_capabilities_config_1 = require("../config/payment-capabilities.config");
const provider_payout_method_model_1 = __importStar(require("../models/provider-payout-method.model"));
const technician_model_1 = __importStar(require("../models/technician.model"));
const paystack_service_1 = require("./paystack.service");
const payout_data_crypto_service_1 = require("./payout-data-crypto.service");
class PayoutMethodError extends Error {
    code;
    statusCode;
    constructor(message, code, statusCode = 400) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
    }
}
exports.PayoutMethodError = PayoutMethodError;
const getPaystackBankRecipientType = () => (process.env.PAYSTACK_BANK_RECIPIENT_TYPE || 'nuban').trim();
const getPaystackMobileMoneyRecipientType = () => (process.env.PAYSTACK_MOBILE_MONEY_RECIPIENT_TYPE || 'mobile_money').trim();
const paystackTransfersEnabled = () => ['1', 'true', 'yes', 'on'].includes(String(process.env.PAYSTACK_TRANSFERS_ENABLED || 'false').toLowerCase());
const ensureTechnicianApproved = async (technicianId) => {
    const profile = await technician_model_1.default.findOne({ userId: technicianId }).lean();
    if (!profile)
        throw new PayoutMethodError('Technician profile not found.', 'TECHNICIAN_PROFILE_NOT_FOUND', 404);
    if (profile.approvalStatus !== technician_model_1.TechnicianApprovalStatus.APPROVED) {
        throw new PayoutMethodError('Technician approval is required before adding payout methods.', 'TECHNICIAN_NOT_APPROVED', 403);
    }
    return profile;
};
const ensurePayoutCountryMatchesTechnician = (profile, countryCode, currency) => {
    const technicianCountryCode = profile.countryCode;
    const technicianMarket = (0, market_config_1.getMarketByCountry)(technicianCountryCode);
    if (countryCode !== technicianCountryCode) {
        throw new PayoutMethodError('Payout country must match your registered technician country.', 'PAYOUT_COUNTRY_MISMATCH', 403);
    }
    if (currency !== technicianMarket.currency) {
        throw new PayoutMethodError('Payout currency must match your registered technician country.', 'PAYOUT_CURRENCY_MISMATCH', 403);
    }
};
const serialize = (method) => ({
    id: method.id,
    type: method.type,
    provider: method.provider,
    countryCode: method.countryCode,
    currency: method.currency,
    accountHolderName: method.accountHolderName,
    bankName: method.bankName || '',
    bankCode: method.bankCode || '',
    mobileProvider: method.mobileProvider || '',
    maskedDestination: method.maskedDestination,
    status: method.status,
    isDefault: method.isDefault,
    verifiedAt: method.verifiedAt,
    disabledAt: method.disabledAt,
});
exports.serializePayoutMethod = serialize;
const listTechnicianPayoutMethods = async (technicianId) => {
    const methods = await provider_payout_method_model_1.default.find({ technicianId, status: { $ne: provider_payout_method_model_1.ProviderPayoutMethodStatus.DISABLED } }).sort({ isDefault: -1, createdAt: -1 });
    return methods.map(serialize);
};
exports.listTechnicianPayoutMethods = listTechnicianPayoutMethods;
const setDefaultIfNeeded = async (method, makeDefault) => {
    const shouldDefault = makeDefault || !(await provider_payout_method_model_1.default.exists({
        technicianId: method.technicianId,
        countryCode: method.countryCode,
        currency: method.currency,
        status: provider_payout_method_model_1.ProviderPayoutMethodStatus.VERIFIED,
        isDefault: true,
    }));
    if (!shouldDefault)
        return method;
    await provider_payout_method_model_1.default.updateMany({ technicianId: method.technicianId, countryCode: method.countryCode, currency: method.currency, _id: { $ne: method._id } }, { $set: { isDefault: false } });
    method.isDefault = true;
    await method.save();
    return method;
};
const createBankPayoutMethod = async (technicianId, input) => {
    if (!mongoose_1.default.Types.ObjectId.isValid(technicianId))
        throw new PayoutMethodError('Invalid technician id.', 'INVALID_TECHNICIAN_ID');
    const profile = await ensureTechnicianApproved(technicianId);
    ensurePayoutCountryMatchesTechnician(profile, input.countryCode, input.currency);
    (0, payment_capabilities_config_1.assertPayoutMethodSupported)(input.countryCode, input.currency, provider_payout_method_model_1.ProviderPayoutMethodType.BANK_ACCOUNT);
    const accountHolderName = input.accountHolderName.trim();
    const accountNumber = input.accountNumber.replace(/\s+/g, '');
    const bankCode = input.bankCode.trim();
    if (!accountHolderName || !input.bankName.trim() || !bankCode || accountNumber.length < 4) {
        throw new PayoutMethodError('Bank account holder, bank and account number are required.', 'INVALID_BANK_DETAILS');
    }
    let providerRecipientCode = '';
    let providerRecipientId = '';
    let verificationStatus = provider_payout_method_model_1.ProviderPayoutMethodStatus.PENDING_VERIFICATION;
    if (paystackTransfersEnabled()) {
        await paystack_service_1.PaystackService.resolveBankAccount(accountNumber, bankCode);
        const recipient = await paystack_service_1.PaystackService.createTransferRecipient({
            type: getPaystackBankRecipientType(),
            name: accountHolderName,
            accountNumber,
            bankCode,
            currency: input.currency,
            metadata: { technicianId, countryCode: input.countryCode },
        });
        providerRecipientCode = String(recipient?.data?.recipient_code || '');
        providerRecipientId = String(recipient?.data?.id || '');
        verificationStatus = providerRecipientCode ? provider_payout_method_model_1.ProviderPayoutMethodStatus.VERIFIED : provider_payout_method_model_1.ProviderPayoutMethodStatus.PENDING_VERIFICATION;
    }
    const method = await provider_payout_method_model_1.default.create({
        technicianId,
        type: provider_payout_method_model_1.ProviderPayoutMethodType.BANK_ACCOUNT,
        provider: provider_payout_method_model_1.ProviderPayoutProvider.PAYSTACK,
        countryCode: input.countryCode,
        currency: input.currency,
        accountHolderName,
        bankName: input.bankName.trim(),
        bankCode,
        encryptedAccountNumber: (0, payout_data_crypto_service_1.encryptPayoutValue)(accountNumber),
        maskedDestination: `${input.bankName.trim()} ${(0, payout_data_crypto_service_1.maskAccountNumber)(accountNumber)}`,
        providerRecipientCode,
        providerRecipientId,
        status: verificationStatus,
        isDefault: false,
        verifiedAt: verificationStatus === provider_payout_method_model_1.ProviderPayoutMethodStatus.VERIFIED ? new Date() : null,
        metadata: { recipientCreationEnabled: paystackTransfersEnabled() },
    });
    await setDefaultIfNeeded(method, Boolean(input.makeDefault));
    return serialize(method);
};
exports.createBankPayoutMethod = createBankPayoutMethod;
const createMobileMoneyPayoutMethod = async (technicianId, input) => {
    const profile = await ensureTechnicianApproved(technicianId);
    ensurePayoutCountryMatchesTechnician(profile, input.countryCode, input.currency);
    (0, payment_capabilities_config_1.assertPayoutMethodSupported)(input.countryCode, input.currency, provider_payout_method_model_1.ProviderPayoutMethodType.MOBILE_MONEY);
    const operatorCode = input.operatorCode.trim();
    const phoneNumber = input.phoneNumber.trim();
    const accountName = (input.accountName || 'Mobile money recipient').trim();
    if (!operatorCode || phoneNumber.length < 4) {
        throw new PayoutMethodError('Mobile-money operator and phone number are required.', 'INVALID_MOBILE_MONEY_DETAILS');
    }
    let providerRecipientCode = '';
    let providerRecipientId = '';
    let verificationStatus = provider_payout_method_model_1.ProviderPayoutMethodStatus.PENDING_VERIFICATION;
    if (paystackTransfersEnabled()) {
        const recipient = await paystack_service_1.PaystackService.createTransferRecipient({
            type: getPaystackMobileMoneyRecipientType(),
            name: accountName,
            mobileNumber: phoneNumber,
            operatorCode,
            currency: input.currency,
            metadata: { technicianId, countryCode: input.countryCode },
        });
        providerRecipientCode = String(recipient?.data?.recipient_code || '');
        providerRecipientId = String(recipient?.data?.id || '');
        verificationStatus = providerRecipientCode ? provider_payout_method_model_1.ProviderPayoutMethodStatus.VERIFIED : provider_payout_method_model_1.ProviderPayoutMethodStatus.PENDING_VERIFICATION;
    }
    const method = await provider_payout_method_model_1.default.create({
        technicianId,
        type: provider_payout_method_model_1.ProviderPayoutMethodType.MOBILE_MONEY,
        provider: provider_payout_method_model_1.ProviderPayoutProvider.PAYSTACK,
        countryCode: input.countryCode,
        currency: input.currency,
        accountHolderName: accountName,
        mobileProvider: operatorCode,
        encryptedMobileNumber: (0, payout_data_crypto_service_1.encryptPayoutValue)(phoneNumber),
        maskedDestination: `${operatorCode} ${(0, payout_data_crypto_service_1.maskPhoneNumber)(phoneNumber)}`,
        providerRecipientCode,
        providerRecipientId,
        status: verificationStatus,
        isDefault: false,
        verifiedAt: verificationStatus === provider_payout_method_model_1.ProviderPayoutMethodStatus.VERIFIED ? new Date() : null,
        metadata: { recipientCreationEnabled: paystackTransfersEnabled() },
    });
    await setDefaultIfNeeded(method, Boolean(input.makeDefault));
    return serialize(method);
};
exports.createMobileMoneyPayoutMethod = createMobileMoneyPayoutMethod;
const setDefaultPayoutMethod = async (technicianId, methodId) => {
    const method = await provider_payout_method_model_1.default.findOne({ _id: methodId, technicianId, status: provider_payout_method_model_1.ProviderPayoutMethodStatus.VERIFIED });
    if (!method)
        throw new PayoutMethodError('Verified payout method not found.', 'PAYOUT_METHOD_NOT_FOUND', 404);
    await provider_payout_method_model_1.default.updateMany({ technicianId, countryCode: method.countryCode, currency: method.currency }, { $set: { isDefault: false } });
    method.isDefault = true;
    await method.save();
    return serialize(method);
};
exports.setDefaultPayoutMethod = setDefaultPayoutMethod;
const disablePayoutMethod = async (technicianId, methodId) => {
    const method = await provider_payout_method_model_1.default.findOneAndUpdate({ _id: methodId, technicianId, status: { $ne: provider_payout_method_model_1.ProviderPayoutMethodStatus.DISABLED } }, { $set: { status: provider_payout_method_model_1.ProviderPayoutMethodStatus.DISABLED, isDefault: false, disabledAt: new Date() } }, { new: true });
    if (!method)
        throw new PayoutMethodError('Payout method not found.', 'PAYOUT_METHOD_NOT_FOUND', 404);
    return serialize(method);
};
exports.disablePayoutMethod = disablePayoutMethod;
//# sourceMappingURL=payout-method.service.js.map