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
exports.PaymentTransactionStatus = exports.PaymentProvider = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const market_config_1 = require("../config/market.config");
var PaymentProvider;
(function (PaymentProvider) {
    PaymentProvider["PAYSTACK"] = "PAYSTACK";
})(PaymentProvider || (exports.PaymentProvider = PaymentProvider = {}));
var PaymentTransactionStatus;
(function (PaymentTransactionStatus) {
    PaymentTransactionStatus["INITIALIZED"] = "INITIALIZED";
    PaymentTransactionStatus["PENDING"] = "PENDING";
    PaymentTransactionStatus["SUCCESS"] = "SUCCESS";
    PaymentTransactionStatus["FAILED"] = "FAILED";
    PaymentTransactionStatus["ABANDONED"] = "ABANDONED";
    PaymentTransactionStatus["REVERSED"] = "REVERSED";
    PaymentTransactionStatus["REFUNDED"] = "REFUNDED";
    PaymentTransactionStatus["UNDER_REVIEW"] = "UNDER_REVIEW";
})(PaymentTransactionStatus || (exports.PaymentTransactionStatus = PaymentTransactionStatus = {}));
const PaymentTransactionSchema = new mongoose_1.Schema({
    provider: {
        type: String,
        enum: Object.values(PaymentProvider),
        default: PaymentProvider.PAYSTACK,
        index: true,
    },
    reference: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true,
    },
    bookingId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Booking',
        required: true,
        index: true,
    },
    quoteId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'JobQuote',
        default: null,
        index: true,
    },
    customerId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    technicianId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
        index: true,
    },
    amountMinor: {
        type: Number,
        required: true,
        min: 1,
    },
    currency: {
        type: String,
        enum: Object.values(market_config_1.CurrencyCode),
        required: true,
        index: true,
    },
    status: {
        type: String,
        enum: Object.values(PaymentTransactionStatus),
        default: PaymentTransactionStatus.INITIALIZED,
        index: true,
    },
    providerStatus: {
        type: String,
        default: '',
        trim: true,
    },
    authorizationUrl: {
        type: String,
        default: '',
        trim: true,
    },
    accessCode: {
        type: String,
        default: '',
        trim: true,
    },
    providerTransactionId: {
        type: String,
        default: '',
        trim: true,
        index: true,
    },
    initializedAt: {
        type: Date,
        default: Date.now,
    },
    paidAt: { type: Date, default: null },
    verifiedAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    refundedAt: { type: Date, default: null },
    reversedAt: { type: Date, default: null },
    idempotencyKey: {
        type: String,
        required: true,
        trim: true,
        index: true,
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
}, { timestamps: true });
PaymentTransactionSchema.index({ provider: 1, idempotencyKey: 1 }, { unique: true });
PaymentTransactionSchema.index({ bookingId: 1, status: 1, createdAt: -1 });
PaymentTransactionSchema.index({ quoteId: 1, status: 1 });
PaymentTransactionSchema.index({ customerId: 1, createdAt: -1 });
const PaymentTransaction = mongoose_1.default.models.PaymentTransaction ??
    mongoose_1.default.model('PaymentTransaction', PaymentTransactionSchema);
exports.default = PaymentTransaction;
//# sourceMappingURL=payment-transaction.model.js.map