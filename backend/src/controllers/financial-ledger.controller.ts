import { Request, Response } from 'express';
import { listLedgerEntries } from '../services/financial-ledger.service';
import { getAdminMarketScope, handleAdminMarketScopeError } from '../services/admin-market-scope.service';

export const getAdminFinancialLedger = async (req: Request, res: Response): Promise<void> => {
  try {
    const requestedCountry = String(req.query.countryCode || req.query.country || '').trim().toUpperCase();
    const scope = await getAdminMarketScope(req, requestedCountry);
    const countryCode = requestedCountry || (scope.effectiveCountryCodes.length === 1 ? scope.effectiveCountryCodes[0] : '');
    const entries = await listLedgerEntries({
      bookingId: String(req.query.bookingId || ''),
      quoteId: String(req.query.quoteId || ''),
      invoiceId: String(req.query.invoiceId || ''),
      paymentTransactionId: String(req.query.paymentTransactionId || ''),
      settlementId: String(req.query.settlementId || ''),
      countryCode,
      customerId: String(req.query.customerId || ''),
      technicianId: String(req.query.technicianId || ''),
      entryType: String(req.query.entryType || ''),
      status: String(req.query.status || ''),
      occurredFrom: String(req.query.occurredFrom || ''),
      occurredTo: String(req.query.occurredTo || ''),
      limit: Number(req.query.limit || 100),
    });

    res.status(200).json({ success: true, entries });
  } catch (error) {
    if (handleAdminMarketScopeError(res, error)) return;
    console.error('Failed to load financial ledger:', error);
    res.status(500).json({ message: 'Failed to load financial ledger.' });
  }
};
