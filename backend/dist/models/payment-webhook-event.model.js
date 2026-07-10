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
exports.PaymentWebhookProcessingStatus = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const payment_transaction_model_1 = require("./payment-transaction.model");
var PaymentWebhookProcessingStatus;
(function (PaymentWebhookProcessingStatus) {
    PaymentWebhookProcessingStatus["RECEIVED"] = "RECEIVED";
    PaymentWebhookProcessingStatus["PROCESSING"] = "PROCESSING";
    PaymentWebhookProcessingStatus["PROCESSED"] = "PROCESSED";
    PaymentWebhookProcessingStatus["IGNORED"] = "IGNORED";
    PaymentWebhookProcessingStatus["FAILED"] = "FAILED";
})(PaymentWebhookProcessingStatus || (exports.PaymentWebhookProcessingStatus = PaymentWebhookProcessingStatus = {}));
const PaymentWebhookEventSchema = new mongoose_1.Schema({
    provider: {
        type: String,
        enum: Object.values(payment_transaction_model_1.PaymentProvider),
        default: payment_transaction_model_1.PaymentProvider.PAYSTACK,
        index: true,
    },
    eventType: {
        type: String,
        required: true,
        trim: true,
        index: true,
    },
    eventId: {
        type: String,
        default: '',
        trim: true,
    },
    reference: {
        type: String,
        default: '',
        trim: true,
        index: true,
    },
    payloadHash: {
        type: String,
        required: true,
        trim: true,
        index: true,
    },
    processed: {
        type: Boolean,
        default: false,
        index: true,
    },
    processingStatus: {
        type: String,
        enum: Object.values(PaymentWebhookProcessingStatus),
        default: PaymentWebhookProcessingStatus.RECEIVED,
        index: true,
    },
    receivedAt: {
        type: Date,
        default: Date.now,
        index: true,
    },
    processedAt: {
        type: Date,
        default: null,
    },
    failureReason: {
        type: String,
        default: '',
        trim: true,
        maxlength: 500,
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
}, { timestamps: true });
PaymentWebhookEventSchema.index({ provider: 1, eventId: 1 }, {
    unique: true,
    partialFilterExpression: { eventId: { $type: 'string', $ne: '' } },
});
PaymentWebhookEventSchema.index({ provider: 1, payloadHash: 1 }, { unique: true });
PaymentWebhookEventSchema.index({ provider: 1, processingStatus: 1, receivedAt: -1 });
const PaymentWebhookEvent = mongoose_1.default.models.PaymentWebhookEvent ??
    mongoose_1.default.model('PaymentWebhookEvent', PaymentWebhookEventSchema);
exports.default = PaymentWebhookEvent;
//# sourceMappingURL=payment-webhook-event.model.js.map