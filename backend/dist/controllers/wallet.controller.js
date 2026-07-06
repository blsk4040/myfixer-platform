"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWalletTransactions = exports.requestWalletCashout = exports.getWalletBalance = void 0;
const billing_model_1 = require("../models/billing.model");
const market_config_1 = require("../config/market.config");
const audit_service_1 = require("../services/audit.service");
const getWalletBalance = async (req, res) => {
    try {
        const userId = req.user?.id;
        let wallet = await billing_model_1.Wallet.findOne({ technicianId: userId });
        // Auto-create an empty wallet collection document if it doesn't exist yet
        if (!wallet) {
            wallet = await billing_model_1.Wallet.create({
                technicianId: userId,
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
    try {
        const userId = req.user?.id;
        const { amount, amountMinor } = req.body;
        const wallet = await billing_model_1.Wallet.findOne({ technicianId: userId });
        const currency = wallet?.currency || market_config_1.CurrencyCode.ZAR;
        const requestedAmountMinor = Number.isFinite(Number(amountMinor))
            ? Number(amountMinor)
            : Number.isFinite(Number(amount))
                ? (0, market_config_1.toMinorUnits)(Number(amount), currency)
                : 0;
        if (requestedAmountMinor <= 0) {
            res.status(400).json({ success: false, message: 'Invalid cashout calculation amount requested.' });
            return;
        }
        if (!wallet || wallet.availableBalanceMinor < requestedAmountMinor) {
            res.status(400).json({ success: false, message: 'Insufficient cleared funds available for cashout.' });
            return;
        }
        const before = {
            availableBalanceMinor: wallet.availableBalanceMinor,
            totalWithdrawnMinor: wallet.totalWithdrawnMinor,
        };
        // Deduct atomic amounts cleanly via Mongoose document memory save hooks
        wallet.availableBalanceMinor -= requestedAmountMinor;
        wallet.totalWithdrawnMinor += requestedAmountMinor;
        wallet.lastTransactionAt = new Date();
        await wallet.save();
        await (0, audit_service_1.logAuditEvent)(req, {
            action: 'wallet.cashout.request',
            module: 'WALLET',
            resourceType: 'Wallet',
            resourceId: wallet._id.toString(),
            changes: {
                before,
                after: {
                    availableBalanceMinor: wallet.availableBalanceMinor,
                    totalWithdrawnMinor: wallet.totalWithdrawnMinor,
                },
            },
            metadata: {
                technicianId: String(wallet.technicianId),
                amountMinor: requestedAmountMinor,
                currency: wallet.currency,
            },
        });
        res.status(200).json({
            success: true,
            amount_minor: requestedAmountMinor,
            amount: (0, market_config_1.fromMinorUnits)(requestedAmountMinor, wallet.currency),
            message: 'Cashout processing request approved. Electronic transfer initiated.'
        });
    }
    catch (error) {
        console.error('Error updating document cashout data balances:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
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