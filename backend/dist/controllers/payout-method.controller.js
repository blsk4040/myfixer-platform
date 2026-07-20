"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deletePayoutMethod = exports.makeDefaultPayoutMethod = exports.addMobileMoneyPayoutMethod = exports.addBankPayoutMethod = exports.getMyPayoutMethods = void 0;
const market_config_1 = require("../config/market.config");
const payout_method_service_1 = require("../services/payout-method.service");
const audit_service_1 = require("../services/audit.service");
const technician_model_1 = __importDefault(require("../models/technician.model"));
const market_finance_guard_service_1 = require("../services/market-finance-guard.service");
const handleError = (res, error, fallback) => {
    if (error instanceof payout_method_service_1.PayoutMethodError || error instanceof Error) {
        const statusCode = error instanceof payout_method_service_1.PayoutMethodError || error instanceof market_finance_guard_service_1.MarketFinanceGuardError
            ? error.statusCode
            : 400;
        res.status(statusCode).json({
            success: false,
            message: error.message,
            code: error instanceof payout_method_service_1.PayoutMethodError || error instanceof market_finance_guard_service_1.MarketFinanceGuardError
                ? error.code
                : 'PAYOUT_METHOD_ERROR',
        });
        return;
    }
    res.status(500).json({ success: false, message: fallback });
};
const technicianId = (req) => String(req.user.id ?? req.user._id);
const getTechnicianMarketInput = async (req) => {
    const profile = await technician_model_1.default.findOne({ userId: technicianId(req) }).select('countryCode').lean();
    const countryCode = (0, market_config_1.normalizeCountryCode)(req.body?.countryCode || req.body?.country || profile?.countryCode);
    const market = await (0, market_finance_guard_service_1.assertActiveMarket)(countryCode);
    return {
        countryCode,
        currency: market.identity.currency,
    };
};
const getMyPayoutMethods = async (req, res) => {
    try {
        res.status(200).json({ success: true, methods: await (0, payout_method_service_1.listTechnicianPayoutMethods)(technicianId(req)) });
    }
    catch (error) {
        handleError(res, error, 'Unable to load payout methods.');
    }
};
exports.getMyPayoutMethods = getMyPayoutMethods;
const addBankPayoutMethod = async (req, res) => {
    try {
        const { countryCode, currency } = await getTechnicianMarketInput(req);
        if (!(0, market_config_1.isCurrencyCode)(currency)) {
            res.status(409).json({ success: false, message: 'Technician payout currency is not configured.', code: 'PAYOUT_CURRENCY_REQUIRED' });
            return;
        }
        const method = await (0, payout_method_service_1.createBankPayoutMethod)(technicianId(req), {
            countryCode,
            currency,
            accountHolderName: String(req.body?.accountHolderName || ''),
            bankName: String(req.body?.bankName || ''),
            bankCode: String(req.body?.bankCode || ''),
            accountNumber: String(req.body?.accountNumber || ''),
            makeDefault: req.body?.makeDefault !== false,
        });
        await (0, audit_service_1.logAuditEvent)(req, {
            action: 'payout_method.bank.create',
            module: 'PAYMENTS',
            resourceType: 'ProviderPayoutMethod',
            resourceId: method.id,
            metadata: { countryCode, currency, maskedDestination: method.maskedDestination },
        });
        res.status(201).json({ success: true, method });
    }
    catch (error) {
        handleError(res, error, 'Unable to add bank payout method.');
    }
};
exports.addBankPayoutMethod = addBankPayoutMethod;
const addMobileMoneyPayoutMethod = async (req, res) => {
    try {
        const { countryCode, currency } = await getTechnicianMarketInput(req);
        if (!(0, market_config_1.isCurrencyCode)(currency)) {
            res.status(409).json({ success: false, message: 'Technician payout currency is not configured.', code: 'PAYOUT_CURRENCY_REQUIRED' });
            return;
        }
        const method = await (0, payout_method_service_1.createMobileMoneyPayoutMethod)(technicianId(req), {
            countryCode,
            currency,
            operatorCode: String(req.body?.operatorCode || ''),
            phoneNumber: String(req.body?.phoneNumber || ''),
            accountName: String(req.body?.accountName || ''),
            makeDefault: req.body?.makeDefault !== false,
        });
        res.status(201).json({ success: true, method });
    }
    catch (error) {
        handleError(res, error, 'Unable to add mobile-money payout method.');
    }
};
exports.addMobileMoneyPayoutMethod = addMobileMoneyPayoutMethod;
const makeDefaultPayoutMethod = async (req, res) => {
    try {
        const method = await (0, payout_method_service_1.setDefaultPayoutMethod)(technicianId(req), String(req.params.id || ''));
        res.status(200).json({ success: true, method });
    }
    catch (error) {
        handleError(res, error, 'Unable to update default payout method.');
    }
};
exports.makeDefaultPayoutMethod = makeDefaultPayoutMethod;
const deletePayoutMethod = async (req, res) => {
    try {
        const method = await (0, payout_method_service_1.disablePayoutMethod)(technicianId(req), String(req.params.id || ''));
        res.status(200).json({ success: true, method });
    }
    catch (error) {
        handleError(res, error, 'Unable to disable payout method.');
    }
};
exports.deletePayoutMethod = deletePayoutMethod;
//# sourceMappingURL=payout-method.controller.js.map