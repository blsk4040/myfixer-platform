"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ledgerType = exports.listLedgerEntries = exports.recordLedgerEntries = exports.recordLedgerEntry = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const financial_ledger_entry_model_1 = __importStar(require("../models/financial-ledger-entry.model"));
const toObjectId = (value) => {
    const raw = String(value || '').trim();
    return mongoose_1.default.Types.ObjectId.isValid(raw) ? new mongoose_1.default.Types.ObjectId(raw) : null;
};
const cleanCode = (value, length) => {
    const next = String(value || '').trim().toUpperCase();
    return next.length === length ? next : '';
};
const normalizeAmount = (value) => typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 0;
const duplicateKey = (error) => typeof error === 'object' && error !== null && error.code === 11000;
const recordLedgerEntry = async (input) => {
    const idempotencyKey = String(input.idempotencyKey || '').trim();
    if (!idempotencyKey) {
        throw new Error('Ledger idempotency key is required.');
    }
    const payload = {
        idempotencyKey,
        entryType: input.entryType,
        status: financial_ledger_entry_model_1.FinancialLedgerEntryStatus.POSTED,
        bookingId: toObjectId(input.bookingId),
        quoteId: toObjectId(input.quoteId),
        invoiceId: toObjectId(input.invoiceId),
        paymentTransactionId: toObjectId(input.paymentTransactionId),
        settlementId: toObjectId(input.settlementId),
        customerId: toObjectId(input.customerId),
        technicianId: toObjectId(input.technicianId),
        countryCode: cleanCode(input.countryCode, 2),
        currency: cleanCode(input.currency, 3),
        amountMinor: normalizeAmount(input.amountMinor),
        direction: input.direction || 'MEMO',
        component: input.component || 'MEMO',
        description: input.description,
        occurredAt: input.occurredAt || new Date(),
        metadata: input.metadata || {},
    };
    try {
        return await financial_ledger_entry_model_1.default.findOneAndUpdate({ idempotencyKey }, { $setOnInsert: payload }, { new: true, upsert: true });
    }
    catch (error) {
        if (duplicateKey(error)) {
            return financial_ledger_entry_model_1.default.findOne({ idempotencyKey });
        }
        throw error;
    }
};
exports.recordLedgerEntry = recordLedgerEntry;
const recordLedgerEntries = async (entries) => {
    const results = [];
    for (const entry of entries) {
        results.push(await (0, exports.recordLedgerEntry)(entry));
    }
    return results;
};
exports.recordLedgerEntries = recordLedgerEntries;
const listLedgerEntries = async (filter) => {
    const query = {};
    const applyObjectIdFilter = (field, value) => {
        if (!value)
            return true;
        if (!mongoose_1.default.Types.ObjectId.isValid(value))
            return false;
        query[field] = new mongoose_1.default.Types.ObjectId(value);
        return true;
    };
    if (!applyObjectIdFilter('bookingId', filter.bookingId))
        return [];
    if (!applyObjectIdFilter('quoteId', filter.quoteId))
        return [];
    if (!applyObjectIdFilter('invoiceId', filter.invoiceId))
        return [];
    if (!applyObjectIdFilter('paymentTransactionId', filter.paymentTransactionId))
        return [];
    if (!applyObjectIdFilter('settlementId', filter.settlementId))
        return [];
    if (!applyObjectIdFilter('customerId', filter.customerId))
        return [];
    if (!applyObjectIdFilter('technicianId', filter.technicianId))
        return [];
    if (filter.countryCode) {
        const countryCode = cleanCode(filter.countryCode, 2);
        if (!countryCode)
            return [];
        query.countryCode = countryCode;
    }
    if (filter.entryType && Object.values(financial_ledger_entry_model_1.FinancialLedgerEntryType).includes(filter.entryType)) {
        query.entryType = filter.entryType;
    }
    if (filter.status && Object.values(financial_ledger_entry_model_1.FinancialLedgerEntryStatus).includes(filter.status)) {
        query.status = filter.status;
    }
    const occurredAt = {};
    const occurredFrom = filter.occurredFrom ? new Date(filter.occurredFrom) : null;
    const occurredTo = filter.occurredTo ? new Date(filter.occurredTo) : null;
    if (occurredFrom && !Number.isNaN(occurredFrom.getTime()))
        occurredAt.$gte = occurredFrom;
    if (occurredTo && !Number.isNaN(occurredTo.getTime()))
        occurredAt.$lte = occurredTo;
    if (Object.keys(occurredAt).length)
        query.occurredAt = occurredAt;
    const limit = Math.min(Math.max(Number(filter.limit) || 100, 1), 500);
    return financial_ledger_entry_model_1.default.find(query).sort({ occurredAt: -1, createdAt: -1 }).limit(limit).lean();
};
exports.listLedgerEntries = listLedgerEntries;
exports.ledgerType = financial_ledger_entry_model_1.FinancialLedgerEntryType;
//# sourceMappingURL=financial-ledger.service.js.map