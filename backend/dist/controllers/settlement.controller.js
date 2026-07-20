"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retryAdminSettlementPayout = exports.releaseAdminSettlementHold = exports.holdAdminSettlement = exports.approveAdminSettlement = exports.getTechnicianSettlements = exports.getAdminSettlements = exports.reportCompletionIssueController = exports.confirmCompletion = exports.submitCompletion = void 0;
const settlement_service_1 = require("../services/settlement.service");
const market_finance_guard_service_1 = require("../services/market-finance-guard.service");
const idempotencyKey = (req) => String(req.headers['idempotency-key'] || req.body?.idempotencyKey || '').trim();
const handleError = (res, error, fallback) => {
    if (error instanceof settlement_service_1.SettlementError || error instanceof market_finance_guard_service_1.MarketFinanceGuardError) {
        res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
        return;
    }
    console.error(fallback, error);
    res.status(500).json({ success: false, message: fallback });
};
const submitCompletion = async (req, res) => {
    try {
        const result = await (0, settlement_service_1.submitProviderCompletion)(String(req.params.bookingId || ''), req.user, {
            completionNotes: String(req.body?.completionNotes || ''),
            partsUsed: Array.isArray(req.body?.partsUsed) ? req.body.partsUsed : [],
            evidenceMediaIds: Array.isArray(req.body?.evidenceMediaIds) ? req.body.evidenceMediaIds.map(String) : [],
            finalAmountMinor: Number(req.body?.finalAmountMinor),
            idempotencyKey: idempotencyKey(req),
        }, req);
        res.status(result.duplicate ? 200 : 201).json({
            success: true,
            duplicate: result.duplicate,
            bookingId: result.booking.id,
            completion: result.booking.completion,
        });
    }
    catch (error) {
        handleError(res, error, 'Unable to submit completion.');
    }
};
exports.submitCompletion = submitCompletion;
const confirmCompletion = async (req, res) => {
    try {
        const result = await (0, settlement_service_1.confirmCustomerCompletion)(String(req.params.bookingId || ''), req.user, { idempotencyKey: idempotencyKey(req) }, req);
        res.status(200).json({
            success: true,
            duplicate: result.duplicate,
            bookingId: result.booking.id,
            status: result.booking.status,
            completion: result.booking.completion,
            settlement: result.settlement,
        });
    }
    catch (error) {
        handleError(res, error, 'Unable to confirm completion.');
    }
};
exports.confirmCompletion = confirmCompletion;
const reportCompletionIssueController = async (req, res) => {
    try {
        const result = await (0, settlement_service_1.reportCompletionIssue)(String(req.params.bookingId || ''), req.user, { reason: String(req.body?.reason || '') }, req);
        res.status(200).json({ success: true, bookingId: result.booking.id, completion: result.booking.completion });
    }
    catch (error) {
        handleError(res, error, 'Unable to report completion issue.');
    }
};
exports.reportCompletionIssueController = reportCompletionIssueController;
const getAdminSettlements = async (_req, res) => {
    try {
        const settlements = await (0, settlement_service_1.listSettlements)();
        res.status(200).json({ success: true, settlements });
    }
    catch (error) {
        handleError(res, error, 'Unable to list settlements.');
    }
};
exports.getAdminSettlements = getAdminSettlements;
const getTechnicianSettlements = async (req, res) => {
    try {
        const technicianId = String(req.user.id ?? req.user._id);
        const settlements = await (0, settlement_service_1.listSettlements)({ technicianId });
        res.status(200).json({ success: true, settlements });
    }
    catch (error) {
        handleError(res, error, 'Unable to list earnings settlements.');
    }
};
exports.getTechnicianSettlements = getTechnicianSettlements;
const approveAdminSettlement = async (req, res) => {
    try {
        const result = await (0, settlement_service_1.approveSettlement)(String(req.params.settlementId || ''), req.user, {
            reason: String(req.body?.reason || req.body?.note || ''),
            idempotencyKey: idempotencyKey(req),
        }, req);
        res.status(200).json({ success: true, duplicate: result.duplicate, settlement: result.settlement, payout: 'payout' in result ? result.payout : null });
    }
    catch (error) {
        handleError(res, error, 'Unable to approve settlement.');
    }
};
exports.approveAdminSettlement = approveAdminSettlement;
const holdAdminSettlement = async (req, res) => {
    try {
        const settlement = await (0, settlement_service_1.holdSettlement)(String(req.params.id || req.params.settlementId || ''), req.user, String(req.body?.reason || ''), req);
        res.status(200).json({ success: true, settlement });
    }
    catch (error) {
        handleError(res, error, 'Unable to place settlement hold.');
    }
};
exports.holdAdminSettlement = holdAdminSettlement;
const releaseAdminSettlementHold = async (req, res) => {
    try {
        const settlement = await (0, settlement_service_1.releaseSettlementHold)(String(req.params.id || req.params.settlementId || ''), req.user, String(req.body?.reason || 'Reviewed'));
        res.status(200).json({ success: true, settlement });
    }
    catch (error) {
        handleError(res, error, 'Unable to release settlement hold.');
    }
};
exports.releaseAdminSettlementHold = releaseAdminSettlementHold;
const retryAdminSettlementPayout = async (req, res) => {
    try {
        const result = await (0, settlement_service_1.retrySettlementPayout)(String(req.params.id || req.params.settlementId || ''), req.user, String(req.body?.reason || 'Retry payout'), req);
        res.status(200).json({ success: true, settlement: result.settlement, payout: 'payout' in result ? result.payout : null });
    }
    catch (error) {
        handleError(res, error, 'Unable to retry settlement payout.');
    }
};
exports.retryAdminSettlementPayout = retryAdminSettlementPayout;
//# sourceMappingURL=settlement.controller.js.map