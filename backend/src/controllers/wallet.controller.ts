// c:/myfixer-platform/backend/src/controllers/wallet.controller.ts
import { Request, Response } from 'express';
import { Wallet, WalletTransaction } from '../models/billing.model';
import { CurrencyCode, fromMinorUnits, toMinorUnits } from '../config/market.config';
import { logAuditEvent } from '../services/audit.service';

export const getWalletBalance = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;

    let wallet = await Wallet.findOne({ technicianId: userId });
    
    // Auto-create an empty wallet collection document if it doesn't exist yet
    if (!wallet) {
      wallet = await Wallet.create({
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
      available_balance: fromMinorUnits(wallet.availableBalanceMinor, wallet.currency),
      available_balance_minor: wallet.availableBalanceMinor,
      pending_balance: fromMinorUnits(wallet.pendingBalanceMinor, wallet.currency),
      pending_balance_minor: wallet.pendingBalanceMinor
    });
  } catch (error) {
    console.error('Error fetching wallet balance:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

export const requestWalletCashout = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { amount, amountMinor } = req.body;
    const wallet = await Wallet.findOne({ technicianId: userId });
    const currency = wallet?.currency || CurrencyCode.ZAR;
    const requestedAmountMinor = Number.isFinite(Number(amountMinor))
      ? Number(amountMinor)
      : Number.isFinite(Number(amount))
        ? toMinorUnits(Number(amount), currency)
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

    await logAuditEvent(req, {
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
      amount: fromMinorUnits(requestedAmountMinor, wallet.currency),
      message: 'Cashout processing request approved. Electronic transfer initiated.'
    });
  } catch (error) {
    console.error('Error updating document cashout data balances:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

export const getWalletTransactions = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;

    const transactions = await WalletTransaction.find({ technicianId: userId })
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json({
      success: true,
      transactions,
    });
  } catch (error) {
    console.error('Error fetching wallet transactions:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};
