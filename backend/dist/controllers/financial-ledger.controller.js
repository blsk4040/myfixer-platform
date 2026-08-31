"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminFinancialLedger = void 0;
const financial_ledger_service_1 = require("../services/financial-ledger.service");
const admin_market_scope_service_1 = require("../services/admin-market-scope.service");
const getAdminFinancialLedger = async (req, res) => {
    try {
        const requestedCountry = String(req.query.countryCode || req.query.country || '').trim().toUpperCase();
        const scope = await (0, admin_market_scope_service_1.getAdminMarketScope)(req, requestedCountry);
        const countryCode = requestedCountry || (scope.effectiveCountryCodes.length === 1 ? scope.effectiveCountryCodes[0] : '');
        const entries = await (0, financial_ledger_service_1.listLedgerEntries)({
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
    }
    catch (error) {
        if ((0, admin_market_scope_service_1.handleAdminMarketScopeError)(res, error))
            return;
        console.error('Failed to load financial ledger:', error);
        res.status(500).json({ message: 'Failed to load financial ledger.' });
    }
};
exports.getAdminFinancialLedger = getAdminFinancialLedger;
//# sourceMappingURL=financial-ledger.controller.js.map