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
exports.PayoutTransactionStatus = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const provider_payout_method_model_1 = require("./provider-payout-method.model");
var PayoutTransactionStatus;
(function (PayoutTransactionStatus) {
    PayoutTransactionStatus["INITIALIZED"] = "INITIALIZED";
    PayoutTransactionStatus["PROCESSING"] = "PROCESSING";
    PayoutTransactionStatus["SUCCESS"] = "SUCCESS";
    PayoutTransactionStatus["FAILED"] = "FAILED";
    PayoutTransactionStatus["REVERSED"] = "REVERSED";
    PayoutTransactionStatus["UNDER_REVIEW"] = "UNDER_REVIEW";
})(PayoutTransactionStatus || (exports.PayoutTransactionStatus = PayoutTransactionStatus = {}));
const PayoutTransactionSchema = new mongoose_1.Schema({
    provider: { type: String, enum: Object.values(provider_payout_method_model_1.ProviderPayoutProvider), default: provider_payout_method_model_1.ProviderPayoutProvider.PAYSTACK, index: true },
    reference: { type: String, required: true, unique: true, trim: true, index: true },
    providerTransferCode: { type: String, default: '', trim: true, index: true },
    settlementId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'ProviderSettlement', required: true, index: true },
    bookingId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    technicianId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    payoutMethodId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'ProviderPayoutMethod', required: true, index: true },
    countryCode: { type: String, uppercase: true,
        validate: { validator: (value) => /^[A-Z]{2}$/.test(value), message: 'Invalid ISO country code.' }, required: true, index: true },
    currency: { type: String, uppercase: true,
        validate: { validator: (value) => /^[A-Z]{3}$/.test(value), message: 'Invalid currency code.' }, required: true, index: true },
    amountMinor: { type: Number, required: true, min: 1 },
    status: { type: String, enum: Object.values(PayoutTransactionStatus), default: PayoutTransactionStatus.INITIALIZED, index: true },
    providerStatus: { type: String, default: '', trim: true },
    recipientSnapshot: {
        type: new mongoose_1.Schema({
            type: { type: String, required: true },
            maskedDestination: { type: String, required: true },
            providerRecipientCode: { type: String, default: '' },
        }, { _id: false }),
        required: true,
    },
    initiatedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', default: null },
    initiatedAt: { type: Date, default: null },
    succeededAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    reversedAt: { type: Date, default: null },
    verifiedAt: { type: Date, default: null },
    idempotencyKey: { type: String, required: true, trim: true, index: true },
    metadata: { type: mongoose_1.Schema.Types.Mixed, default: {} },
}, { timestamps: true });
PayoutTransactionSchema.index({ provider: 1, idempotencyKey: 1 }, { unique: true });
PayoutTransactionSchema.index({ settlementId: 1, status: 1 });
PayoutTransactionSchema.index({ technicianId: 1, createdAt: -1 });
const PayoutTransaction = mongoose_1.default.models.PayoutTransaction ??
    mongoose_1.default.model('PayoutTransaction', PayoutTransactionSchema);
exports.default = PayoutTransaction;
//# sourceMappingURL=payout-transaction.model.js.map