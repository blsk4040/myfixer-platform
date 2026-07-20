"use strict";
// src/models/jobQuote.model.ts
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
exports.JobQuote = exports.QuoteLineItemType = exports.QuoteStatus = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var QuoteStatus;
(function (QuoteStatus) {
    QuoteStatus["NOT_REQUIRED"] = "NOT_REQUIRED";
    QuoteStatus["DRAFT"] = "DRAFT";
    QuoteStatus["SUBMITTED"] = "SUBMITTED";
    QuoteStatus["CLARIFICATION_REQUESTED"] = "CLARIFICATION_REQUESTED";
    QuoteStatus["SENT_TO_CLIENT"] = "SENT_TO_CLIENT";
    QuoteStatus["APPROVED"] = "APPROVED";
    QuoteStatus["REJECTED"] = "REJECTED";
    QuoteStatus["EXPIRED"] = "EXPIRED";
    QuoteStatus["SUPERSEDED"] = "SUPERSEDED";
    QuoteStatus["CANCELLED"] = "CANCELLED";
})(QuoteStatus || (exports.QuoteStatus = QuoteStatus = {}));
var QuoteLineItemType;
(function (QuoteLineItemType) {
    QuoteLineItemType["CALL_OUT"] = "CALL_OUT";
    QuoteLineItemType["CALLOUT"] = "CALLOUT";
    QuoteLineItemType["LABOUR"] = "LABOUR";
    QuoteLineItemType["LABOR"] = "LABOR";
    QuoteLineItemType["PART"] = "PART";
    QuoteLineItemType["ADD_ON"] = "ADD_ON";
    QuoteLineItemType["SURCHARGE"] = "SURCHARGE";
    QuoteLineItemType["DISCOUNT"] = "DISCOUNT";
    QuoteLineItemType["TAX"] = "TAX";
    QuoteLineItemType["PLATFORM_FEE"] = "PLATFORM_FEE";
})(QuoteLineItemType || (exports.QuoteLineItemType = QuoteLineItemType = {}));
const QuoteLineItemSchema = new mongoose_1.Schema({
    type: {
        type: String,
        enum: Object.values(QuoteLineItemType),
        required: true,
        index: true,
    },
    label: {
        type: String,
        required: true,
        trim: true,
    },
    quantity: {
        type: Number,
        required: true,
        min: 0,
        default: 1,
    },
    unitAmountMinor: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
    totalAmountMinor: {
        type: Number,
        required: true,
        default: 0,
    },
    notes: {
        type: String,
        default: '',
        trim: true,
    },
}, { _id: false });
QuoteLineItemSchema.virtual('unitAmount').get(function () {
    return this.unitAmountMinor / 100;
});
QuoteLineItemSchema.virtual('totalAmount').get(function () {
    return this.totalAmountMinor / 100;
});
QuoteLineItemSchema.set('toJSON', { virtuals: true });
QuoteLineItemSchema.set('toObject', { virtuals: true });
const JobQuoteSchema = new mongoose_1.Schema({
    bookingId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Booking',
        required: true,
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
        required: true,
        index: true,
    },
    countryCode: {
        type: String,
        uppercase: true,
        validate: { validator: (value) => /^[A-Z]{2}$/.test(value), message: 'Invalid ISO country code.' },
        required: true,
        index: true,
    },
    currency: {
        type: String,
        uppercase: true,
        validate: { validator: (value) => /^[A-Z]{3}$/.test(value), message: 'Invalid currency code.' },
        required: true,
        index: true,
    },
    status: {
        type: String,
        enum: Object.values(QuoteStatus),
        default: QuoteStatus.DRAFT,
        index: true,
    },
    version: {
        type: Number,
        required: true,
        default: 1,
        min: 1,
    },
    parentQuoteId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'JobQuote',
        default: null,
        index: true,
    },
    isCurrent: {
        type: Boolean,
        default: true,
        index: true,
    },
    lineItems: {
        type: [QuoteLineItemSchema],
        default: [],
    },
    subtotalAmountMinor: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
    discountAmountMinor: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
    totalAmountMinor: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
    technicianNotes: {
        type: String,
        default: '',
        trim: true,
    },
    clientDecisionNote: {
        type: String,
        default: '',
        trim: true,
    },
    sentAt: {
        type: Date,
        default: null,
    },
    submittedAt: {
        type: Date,
        default: null,
    },
    approvedAt: {
        type: Date,
        default: null,
    },
    rejectedAt: {
        type: Date,
        default: null,
    },
    clarificationRequestedAt: {
        type: Date,
        default: null,
    },
    supersededAt: {
        type: Date,
        default: null,
    },
    expiredAt: {
        type: Date,
        default: null,
    },
    cancelledAt: {
        type: Date,
        default: null,
    },
    expiresAt: {
        type: Date,
        default: null,
        index: true,
    },
    decisionBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
    },
    createdBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
    },
    submittedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
}, { timestamps: true });
JobQuoteSchema.virtual('subtotalAmount').get(function () {
    return this.subtotalAmountMinor / 100;
});
JobQuoteSchema.virtual('discountAmount').get(function () {
    return this.discountAmountMinor / 100;
});
JobQuoteSchema.virtual('totalAmount').get(function () {
    return this.totalAmountMinor / 100;
});
JobQuoteSchema.set('toJSON', { virtuals: true });
JobQuoteSchema.set('toObject', { virtuals: true });
JobQuoteSchema.index({ bookingId: 1, createdAt: -1 });
JobQuoteSchema.index({ bookingId: 1, version: -1 });
JobQuoteSchema.index({ bookingId: 1, isCurrent: 1, status: 1 });
JobQuoteSchema.index({ customerId: 1, status: 1 });
JobQuoteSchema.index({ technicianId: 1, status: 1 });
JobQuoteSchema.index({ status: 1, createdAt: -1 });
JobQuoteSchema.index({ expiresAt: 1, status: 1 });
exports.JobQuote = mongoose_1.default.models.JobQuote ??
    mongoose_1.default.model('JobQuote', JobQuoteSchema);
exports.default = exports.JobQuote;
//# sourceMappingURL=quote.model.js.map