import { Response } from 'express';
import {
  SettlementError,
  approveSettlement,
  confirmCustomerCompletion,
  holdSettlement,
  listSettlements,
  releaseSettlementHold,
  reportCompletionIssue,
  retrySettlementPayout,
  submitProviderCompletion,
} from '../services/settlement.service';
import { AuthenticatedRequest } from '../types/auth.types';
import { MarketFinanceGuardError } from '../services/market-finance-guard.service';
import { assertAdminCountryAccess, countryScopeFilter, getAdminMarketScope, handleAdminMarketScopeError } from '../services/admin-market-scope.service';
import ProviderSettlement from '../models/provider-settlement.model';

const idempotencyKey = (req: AuthenticatedRequest): string =>
  String(req.headers['idempotency-key'] || req.body?.idempotencyKey || '').trim();

const handleError = (res: Response, error: unknown, fallback: string): void => {
  if (error instanceof SettlementError || error instanceof MarketFinanceGuardError) {
    res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    return;
  }
  console.error(fallback, error);
  res.status(500).json({ success: false, message: fallback });
};

export const submitCompletion = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const result = await submitProviderCompletion(
      String(req.params.bookingId || ''),
      req.user,
      {
        completionNotes: String(req.body?.completionNotes || ''),
        partsUsed: Array.isArray(req.body?.partsUsed) ? req.body.partsUsed : [],
        evidenceMediaIds: Array.isArray(req.body?.evidenceMediaIds) ? req.body.evidenceMediaIds.map(String) : [],
        finalAmountMinor: Number(req.body?.finalAmountMinor),
        idempotencyKey: idempotencyKey(req),
      },
      req
    );
    res.status(result.duplicate ? 200 : 201).json({
      success: true,
      duplicate: result.duplicate,
      bookingId: result.booking.id,
      completion: result.booking.completion,
    });
  } catch (error) {
    handleError(res, error, 'Unable to submit completion.');
  }
};

export const confirmCompletion = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const result = await confirmCustomerCompletion(String(req.params.bookingId || ''), req.user, { idempotencyKey: idempotencyKey(req) }, req);
    res.status(200).json({
      success: true,
      duplicate: result.duplicate,
      bookingId: result.booking.id,
      status: result.booking.status,
      completion: result.booking.completion,
      settlement: result.settlement,
    });
  } catch (error) {
    handleError(res, error, 'Unable to confirm completion.');
  }
};

export const reportCompletionIssueController = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const result = await reportCompletionIssue(String(req.params.bookingId || ''), req.user, { reason: String(req.body?.reason || '') }, req);
    res.status(200).json({ success: true, bookingId: result.booking.id, completion: result.booking.completion });
  } catch (error) {
    handleError(res, error, 'Unable to report completion issue.');
  }
};

const assertSettlementCountryAccess = async (req: AuthenticatedRequest, settlementId: string): Promise<void> => {
  const settlement = await ProviderSettlement.findById(settlementId).select('countryCode').lean();
  if (!settlement) throw new SettlementError('Settlement not found.', 'SETTLEMENT_NOT_FOUND', 404);
  await assertAdminCountryAccess(req, settlement.countryCode);
};

export const getAdminSettlements = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const settlements = await listSettlements(countryScopeFilter(await getAdminMarketScope(req)));
    res.status(200).json({ success: true, settlements });
  } catch (error) {
    if (handleAdminMarketScopeError(res, error)) return;
    handleError(res, error, 'Unable to list settlements.');
  }
};

export const getTechnicianSettlements = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const technicianId = String(req.user.id ?? req.user._id);
    const settlements = await listSettlements({ technicianId });
    res.status(200).json({ success: true, settlements });
  } catch (error) {
    handleError(res, error, 'Unable to list earnings settlements.');
  }
};

export const approveAdminSettlement = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    await assertSettlementCountryAccess(req, String(req.params.settlementId || ''));
    const result = await approveSettlement(String(req.params.settlementId || ''), req.user, {
      reason: String(req.body?.reason || req.body?.note || ''),
      idempotencyKey: idempotencyKey(req),
    }, req);
    res.status(200).json({ success: true, duplicate: result.duplicate, settlement: result.settlement, payout: 'payout' in result ? result.payout : null });
  } catch (error) {
    if (handleAdminMarketScopeError(res, error)) return;
    handleError(res, error, 'Unable to approve settlement.');
  }
};

export const holdAdminSettlement = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    await assertSettlementCountryAccess(req, String(req.params.id || req.params.settlementId || ''));
    const settlement = await holdSettlement(String(req.params.id || req.params.settlementId || ''), req.user, String(req.body?.reason || ''), req);
    res.status(200).json({ success: true, settlement });
  } catch (error) {
    if (handleAdminMarketScopeError(res, error)) return;
    handleError(res, error, 'Unable to place settlement hold.');
  }
};

export const releaseAdminSettlementHold = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    await assertSettlementCountryAccess(req, String(req.params.id || req.params.settlementId || ''));
    const settlement = await releaseSettlementHold(String(req.params.id || req.params.settlementId || ''), req.user, String(req.body?.reason || 'Reviewed'));
    res.status(200).json({ success: true, settlement });
  } catch (error) {
    if (handleAdminMarketScopeError(res, error)) return;
    handleError(res, error, 'Unable to release settlement hold.');
  }
};

export const retryAdminSettlementPayout = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    await assertSettlementCountryAccess(req, String(req.params.id || req.params.settlementId || ''));
    const result = await retrySettlementPayout(String(req.params.id || req.params.settlementId || ''), req.user, String(req.body?.reason || 'Retry payout'), req);
    res.status(200).json({ success: true, settlement: result.settlement, payout: 'payout' in result ? result.payout : null });
  } catch (error) {
    if (handleAdminMarketScopeError(res, error)) return;
    handleError(res, error, 'Unable to retry settlement payout.');
  }
};
