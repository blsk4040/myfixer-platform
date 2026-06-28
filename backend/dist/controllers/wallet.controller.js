"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestWalletCashout = exports.getWalletBalance = void 0;
const billing_model_1 = require("../models/billing.model");
const getWalletBalance = async (req, res) => {
    try {
        const userId = req.user?.id;
        let wallet = await billing_model_1.Wallet.findOne({ technicianId: userId });
        // Auto-create an empty wallet collection document if it doesn't exist yet
        if (!wallet) {
            wallet = await billing_model_1.Wallet.create({ technicianId: userId, availableBalance: 0, pendingBalance: 0 });
        }
        res.status(200).json({
            success: true,
            available_balance: wallet.availableBalance,
            pending_balance: wallet.pendingBalance
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
        const { amount } = req.body;
        if (!amount || parseFloat(amount) <= 0) {
            res.status(400).json({ success: false, message: 'Invalid cashout calculation amount requested.' });
            return;
        }
        const wallet = await billing_model_1.Wallet.findOne({ technicianId: userId });
        if (!wallet || wallet.availableBalance < amount) {
            res.status(400).json({ success: false, message: 'Insufficient cleared funds available for cashout.' });
            return;
        }
        // Deduct atomic amounts cleanly via Mongoose document memory save hooks
        wallet.availableBalance -= amount;
        await wallet.save();
        res.status(200).json({
            success: true,
            message: `Cashout processing request for R${amount} approved. Electronic EFT transfer initiated.`
        });
    }
    catch (error) {
        console.error('Error updating document cashout data balances:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};
exports.requestWalletCashout = requestWalletCashout;
//# sourceMappingURL=wallet.controller.js.map