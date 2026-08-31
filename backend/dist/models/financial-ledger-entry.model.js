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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinancialLedgerEntryStatus = exports.FinancialLedgerEntryType = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var FinancialLedgerEntryType;
(function (FinancialLedgerEntryType) {
    FinancialLedgerEntryType["BOOKING_CALLOUT_CHARGE_CREATED"] = "BOOKING_CALLOUT_CHARGE_CREATED";
    FinancialLedgerEntryType["QUOTE_SUBMITTED"] = "QUOTE_SUBMITTED";
    FinancialLedgerEntryType["QUOTE_APPROVED"] = "QUOTE_APPROVED";
    FinancialLedgerEntryType["QUOTE_REJECTED"] = "QUOTE_REJECTED";
    FinancialLedgerEntryType["REPAIR_BALANCE_CHARGE_CREATED"] = "REPAIR_BALANCE_CHARGE_CREATED";
    FinancialLedgerEntryType["PAYMENT_SUCCEEDED"] = "PAYMENT_SUCCEEDED";
    FinancialLedgerEntryType["PAYMENT_FAILED"] = "PAYMENT_FAILED";
    FinancialLedgerEntryType["PAYMENT_REVERSED"] = "PAYMENT_REVERSED";
    FinancialLedgerEntryType["CALLOUT_CREDIT_APPLIED"] = "CALLOUT_CREDIT_APPLIED";
    FinancialLedgerEntryType["INVOICE_ISSUED"] = "INVOICE_ISSUED";
    FinancialLedgerEntryType["PROVIDER_EARNING_RECOGNIZED"] = "PROVIDER_EARNING_RECOGNIZED";
    FinancialLedgerEntryType["PLATFORM_REVENUE_RECOGNIZED"] = "PLATFORM_REVENUE_RECOGNIZED";
    FinancialLedgerEntryType["SETTLEMENT_CREATED"] = "SETTLEMENT_CREATED";
    FinancialLedgerEntryType["SETTLEMENT_PAID"] = "SETTLEMENT_PAID";
    FinancialLedgerEntryType["SETTLEMENT_ON_HOLD"] = "SETTLEMENT_ON_HOLD";
    FinancialLedgerEntryType["SETTLEMENT_PAYOUT_FAILED"] = "SETTLEMENT_PAYOUT_FAILED";
    FinancialLedgerEntryType["SETTLEMENT_REVERSED"] = "SETTLEMENT_REVERSED";
})(FinancialLedgerEntryType || (exports.FinancialLedgerEntryType = FinancialLedgerEntryType = {}));
var FinancialLedgerEntryStatus;
(function (FinancialLedgerEntryStatus) {
    FinancialLedgerEntryStatus["POSTED"] = "POSTED";
    FinancialLedgerEntryStatus["VOIDED"] = "VOIDED";
})(FinancialLedgerEntryStatus || (exports.FinancialLedgerEntryStatus = FinancialLedgerEntryStatus = {}));
const FinancialLedgerEntrySchema = new mongoose_1.Schema({
    idempotencyKey: { type: String, required: true, unique: true, trim: true, index: true },
    entryType: { type: String, enum: Object.values(FinancialLedgerEntryType), required: true, index: true },
    status: { type: String, enum: Object.values(FinancialLedgerEntryStatus), default: FinancialLedgerEntryStatus.POSTED, index: true },
    bookingId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Booking', default: null, index: true },
    quoteId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'JobQuote', default: null, index: true },
    invoiceId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Invoice', default: null, index: true },
    paymentTransactionId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'PaymentTransaction', default: null, index: true },
    settlementId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'ProviderSettlement', default: null, index: true },
    customerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    technicianId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    countryCode: {
        type: String,
        uppercase: true,
        trim: true,
        validate: { validator: (value) => !value || /^[A-Z]{2}$/.test(value), message: 'Invalid ISO country code.' },
        default: '',
        index: true,
    },
    currency: {
        type: String,
        uppercase: true,
        trim: true,
        validate: { validator: (value) => !value || /^[A-Z]{3}$/.test(value), message: 'Invalid currency code.' },
        default: '',
        index: true,
    },
    amountMinor: { type: Number, required: true, default: 0 },
    direction: { type: String, enum: ['DEBIT', 'CREDIT', 'MEMO'], required: true, default: 'MEMO', index: true },
    component: {
        type: String,
        enum: ['CALLOUT', 'LABOUR', 'PARTS', 'ADDITIONAL_SERVICES', 'SURCHARGE', 'PLATFORM_FEE', 'TAX', 'DISCOUNT', 'CREDIT', 'PAYMENT', 'PAYOUT', 'MEMO'],
        required: true,
        default: 'MEMO',
        index: true,
    },
    description: { type: String, required: true, trim: true, maxlength: 500 },
    occurredAt: { type: Date, required: true, default: Date.now, index: true },
    metadata: { type: mongoose_1.Schema.Types.Mixed, default: {} },
}, { timestamps: true });
FinancialLedgerEntrySchema.index({ bookingId: 1, occurredAt: -1 });
FinancialLedgerEntrySchema.index({ countryCode: 1, occurredAt: -1 });
FinancialLedgerEntrySchema.index({ customerId: 1, occurredAt: -1 });
FinancialLedgerEntrySchema.index({ technicianId: 1, occurredAt: -1 });
const FinancialLedgerEntry = mongoose_1.default.models.FinancialLedgerEntry ??
    mongoose_1.default.model('FinancialLedgerEntry', FinancialLedgerEntrySchema);
exports.default = FinancialLedgerEntry;
//# sourceMappingURL=financial-ledger-entry.model.js.map