"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWalletTransactions = exports.requestWalletCashout = exports.getWalletBalance = void 0;
const billing_model_1 = require("../models/billing.model");
const market_config_1 = require("../config/market.config");
const audit_service_1 = require("../services/audit.service");
const technician_model_1 = __importDefault(require("../models/technician.model"));
const user_model_1 = __importDefault(require("../models/user.model"));
const resolveWalletMarket = async (userId) => {
    const technician = await technician_model_1.default.findOne({ userId }).select('countryCode').lean();
    const user = await user_model_1.default.findById(userId).select('countryCode currency').lean();
    const countryCode = (0, market_config_1.normalizeIsoCountryCode)(technician?.countryCode || user?.countryCode || 'ZA');
    const market = (0, market_config_1.getMarketByCountry)(countryCode);
    const currency = (0, market_config_1.normalizeIsoCurrencyCode)(user?.currency || market?.currency || market_config_1.CurrencyCode.ZAR);
    return { countryCode, currency };
};
const getWalletBalance = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ success: false, message: 'Authentication is required.' });
            return;
        }
        let wallet = await billing_model_1.Wallet.findOne({ technicianId: userId });
        // Auto-create an empty wallet collection document if it doesn't exist yet
        if (!wallet) {
            const market = await resolveWalletMarket(userId);
            wallet = await billing_model_1.Wallet.create({
                technicianId: userId,
                countryCode: market.countryCode,
                currency: market.currency,
                availableBalanceMinor: 0,
                pendingBalanceMinor: 0,
                totalEarnedMinor: 0,
                totalWithdrawnMinor: 0,
            });
        }
        res.status(200).json({
            success: true,
            country_code: wallet.countryCode,
            currency: wallet.currency,
            available_balance: (0, market_config_1.fromMinorUnits)(wallet.availableBalanceMinor, wallet.currency),
            available_balance_minor: wallet.availableBalanceMinor,
            pending_balance: (0, market_config_1.fromMinorUnits)(wallet.pendingBalanceMinor, wallet.currency),
            pending_balance_minor: wallet.pendingBalanceMinor
        });
    }
    catch (error) {
        console.error('Error fetching wallet balance:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};
exports.getWalletBalance = getWalletBalance;
const requestWalletCashout = async (req, res) => {
    await (0, audit_service_1.logAuditEvent)(req, {
        action: 'wallet.cashout.blocked',
        module: 'WALLET',
        resourceType: 'Wallet',
        metadata: { reason: 'Phase 4 admin-approved settlement payouts required' },
        success: false,
    }).catch(() => undefined);
    res.status(409).json({
        success: false,
        message: 'Technician payouts are handled through the admin-approved settlement centre. Direct cashout is disabled during the payout pilot.',
        code: 'DIRECT_CASHOUT_DISABLED',
    });
};
exports.requestWalletCashout = requestWalletCashout;
const getWalletTransactions = async (req, res) => {
    try {
        const userId = req.user?.id;
        const transactions = await billing_model_1.WalletTransaction.find({ technicianId: userId })
            .sort({ createdAt: -1 })
            .limit(100);
        res.status(200).json({
            success: true,
            transactions,
        });
    }
    catch (error) {
        console.error('Error fetching wallet transactions:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};
exports.getWalletTransactions = getWalletTransactions;
//# sourceMappingURL=wallet.controller.js.map