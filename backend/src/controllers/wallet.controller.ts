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
  await logAuditEvent(req, {
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
