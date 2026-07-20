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
exports.ProviderSettlementStatus = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var ProviderSettlementStatus;
(function (ProviderSettlementStatus) {
    ProviderSettlementStatus["PENDING_COMPLETION"] = "PENDING_COMPLETION";
    ProviderSettlementStatus["AWAITING_CUSTOMER_CONFIRMATION"] = "AWAITING_CUSTOMER_CONFIRMATION";
    ProviderSettlementStatus["ON_HOLD"] = "ON_HOLD";
    ProviderSettlementStatus["READY_FOR_PAYOUT"] = "READY_FOR_PAYOUT";
    ProviderSettlementStatus["APPROVAL_REQUIRED"] = "APPROVAL_REQUIRED";
    ProviderSettlementStatus["APPROVED"] = "APPROVED";
    ProviderSettlementStatus["PAYOUT_QUEUED"] = "PAYOUT_QUEUED";
    ProviderSettlementStatus["PAYOUT_PROCESSING"] = "PAYOUT_PROCESSING";
    ProviderSettlementStatus["PAID"] = "PAID";
    ProviderSettlementStatus["PAYOUT_FAILED"] = "PAYOUT_FAILED";
    ProviderSettlementStatus["REVERSED"] = "REVERSED";
    ProviderSettlementStatus["CANCELLED"] = "CANCELLED";
    ProviderSettlementStatus["UNDER_REVIEW"] = "UNDER_REVIEW";
})(ProviderSettlementStatus || (exports.ProviderSettlementStatus = ProviderSettlementStatus = {}));
const ProviderSettlementSchema = new mongoose_1.Schema({
    bookingId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true, index: true },
    customerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    technicianId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    quoteId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'JobQuote', default: null, index: true },
    paymentTransactionId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'PaymentTransaction', default: null, index: true },
    countryCode: { type: String, uppercase: true,
        validate: { validator: (value) => /^[A-Z]{2}$/.test(value), message: 'Invalid ISO country code.' }, required: true, index: true },
    currency: { type: String, uppercase: true,
        validate: { validator: (value) => /^[A-Z]{3}$/.test(value), message: 'Invalid currency code.' }, required: true, index: true },
    grossAmountMinor: { type: Number, required: true, min: 0 },
    commissionBps: { type: Number, required: true, min: 0, max: 10000 },
    commissionAmountMinor: { type: Number, required: true, min: 0 },
    processingFeeMinor: { type: Number, required: true, default: 0, min: 0 },
    netAmountMinor: { type: Number, required: true, min: 0 },
    status: { type: String, enum: Object.values(ProviderSettlementStatus), required: true, index: true },
    completionConfirmedAt: { type: Date, default: null },
    readyForPayoutAt: { type: Date, default: null },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', default: null },
    holdReason: { type: String, default: '', trim: true, maxlength: 1000 },
    heldAt: { type: Date, default: null },
    heldBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', default: null },
    releasedFromHoldAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    payoutMethodId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'ProviderPayoutMethod', default: null },
    payoutTransactionId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'PayoutTransaction', default: null },
    metadata: { type: mongoose_1.Schema.Types.Mixed, default: {} },
}, { timestamps: true });
ProviderSettlementSchema.index({ technicianId: 1, status: 1, createdAt: -1 });
ProviderSettlementSchema.index({ status: 1, readyForPayoutAt: -1 });
const ProviderSettlement = mongoose_1.default.models.ProviderSettlement ??
    mongoose_1.default.model('ProviderSettlement', ProviderSettlementSchema);
exports.default = ProviderSettlement;
//# sourceMappingURL=provider-settlement.model.js.map