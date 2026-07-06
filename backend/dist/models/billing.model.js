"use strict";
// src/models/billing.model.ts
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
exports.WalletTransaction = exports.Wallet = exports.Invoice = exports.WalletTransactionStatus = exports.WalletTransactionType = exports.InvoiceStatus = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const market_config_1 = require("../config/market.config");
var InvoiceStatus;
(function (InvoiceStatus) {
    InvoiceStatus["UNPAID"] = "UNPAID";
    InvoiceStatus["PAID"] = "PAID";
    InvoiceStatus["REFUNDED"] = "REFUNDED";
    InvoiceStatus["CANCELLED"] = "CANCELLED";
    InvoiceStatus["PARTIALLY_REFUNDED"] = "PARTIALLY_REFUNDED";
})(InvoiceStatus || (exports.InvoiceStatus = InvoiceStatus = {}));
var WalletTransactionType;
(function (WalletTransactionType) {
    WalletTransactionType["CLIENT_PAYMENT"] = "CLIENT_PAYMENT";
    WalletTransactionType["PLATFORM_COMMISSION"] = "PLATFORM_COMMISSION";
    WalletTransactionType["TECHNICIAN_EARNING_PENDING"] = "TECHNICIAN_EARNING_PENDING";
    WalletTransactionType["PENDING_RELEASED"] = "PENDING_RELEASED";
    WalletTransactionType["CASHOUT_REQUESTED"] = "CASHOUT_REQUESTED";
    WalletTransactionType["CASHOUT_PAID"] = "CASHOUT_PAID";
    WalletTransactionType["REFUND"] = "REFUND";
    WalletTransactionType["ADJUSTMENT"] = "ADJUSTMENT";
})(WalletTransactionType || (exports.WalletTransactionType = WalletTransactionType = {}));
var WalletTransactionStatus;
(function (WalletTransactionStatus) {
    WalletTransactionStatus["PENDING"] = "PENDING";
    WalletTransactionStatus["POSTED"] = "POSTED";
    WalletTransactionStatus["FAILED"] = "FAILED";
    WalletTransactionStatus["REVERSED"] = "REVERSED";
})(WalletTransactionStatus || (exports.WalletTransactionStatus = WalletTransactionStatus = {}));
const InvoiceSchema = new mongoose_1.Schema({
    invoiceNumber: {
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
        enum: Object.values(market_config_1.CountryCode),
        default: market_config_1.CountryCode.ZA,
        index: true,
    },
    currency: {
        type: String,
        enum: Object.values(market_config_1.CurrencyCode),
        default: market_config_1.CurrencyCode.ZAR,
        index: true,
    },
    baseAmountMinor: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
    additionalLaborMinor: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
    partsAmountMinor: {
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
    platformCommissionBps: {
        type: Number,
        required: true,
        default: 1500,
        min: 0,
        max: 10000,
    },
    platformCommissionAmountMinor: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
    technicianNetAmountMinor: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
    paymentGateway: {
        type: String,
        default: '',
        trim: true,
        lowercase: true,
    },
    paymentReference: {
        type: String,
        default: '',
        trim: true,
        index: true,
    },
    status: {
        type: String,
        enum: Object.values(InvoiceStatus),
        default: InvoiceStatus.UNPAID,
        index: true,
    },
    paidAt: {
        type: Date,
    },
    refundedAt: {
        type: Date,
    },
    cancelledAt: {
        type: Date,
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
}, { timestamps: true });
InvoiceSchema.virtual('baseAmount').get(function () {
    return this.baseAmountMinor / 100;
});
InvoiceSchema.virtual('additionalLabor').get(function () {
    return this.additionalLaborMinor / 100;
});
InvoiceSchema.virtual('partsAmount').get(function () {
    return this.partsAmountMinor / 100;
});
InvoiceSchema.virtual('totalAmount').get(function () {
    return this.totalAmountMinor / 100;
});
InvoiceSchema.virtual('platformCommissionAmount').get(function () {
    return this.platformCommissionAmountMinor / 100;
});
InvoiceSchema.virtual('technicianNetAmount').get(function () {
    return this.technicianNetAmountMinor / 100;
});
InvoiceSchema.set('toJSON', { virtuals: true });
InvoiceSchema.set('toObject', { virtuals: true });
InvoiceSchema.index({ status: 1, createdAt: -1 });
InvoiceSchema.index({ technicianId: 1, status: 1 });
InvoiceSchema.index({ customerId: 1, createdAt: -1 });
const WalletSchema = new mongoose_1.Schema({
    technicianId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true,
    },
    countryCode: {
        type: String,
        enum: Object.values(market_config_1.CountryCode),
        default: market_config_1.CountryCode.ZA,
        index: true,
    },
    currency: {
        type: String,
        enum: Object.values(market_config_1.CurrencyCode),
        default: market_config_1.CurrencyCode.ZAR,
        index: true,
    },
    availableBalanceMinor: {
        type: Number,
        required: true,
        default: 0,
    },
    pendingBalanceMinor: {
        type: Number,
        required: true,
        default: 0,
    },
    totalEarnedMinor: {
        type: Number,
        required: true,
        default: 0,
    },
    totalWithdrawnMinor: {
        type: Number,
        required: true,
        default: 0,
    },
    lastTransactionAt: {
        type: Date,
    },
}, { timestamps: true });
WalletSchema.virtual('availableBalance').get(function () {
    return this.availableBalanceMinor / 100;
});
WalletSchema.virtual('pendingBalance').get(function () {
    return this.pendingBalanceMinor / 100;
});
WalletSchema.virtual('totalEarned').get(function () {
    return this.totalEarnedMinor / 100;
});
WalletSchema.virtual('totalWithdrawn').get(function () {
    return this.totalWithdrawnMinor / 100;
});
WalletSchema.set('toJSON', { virtuals: true });
WalletSchema.set('toObject', { virtuals: true });
const WalletTransactionSchema = new mongoose_1.Schema({
    type: {
        type: String,
        enum: Object.values(WalletTransactionType),
        required: true,
        index: true,
    },
    status: {
        type: String,
        enum: Object.values(WalletTransactionStatus),
        default: WalletTransactionStatus.POSTED,
        index: true,
    },
    bookingId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Booking',
        index: true,
    },
    invoiceId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Invoice',
        index: true,
    },
    customerId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        index: true,
    },
    technicianId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        index: true,
    },
    countryCode: {
        type: String,
        enum: Object.values(market_config_1.CountryCode),
        required: true,
        index: true,
    },
    currency: {
        type: String,
        enum: Object.values(market_config_1.CurrencyCode),
        required: true,
        index: true,
    },
    amountMinor: {
        type: Number,
        required: true,
    },
    externalReference: {
        type: String,
        default: '',
        trim: true,
    },
    description: {
        type: String,
        required: true,
        trim: true,
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
}, { timestamps: true });
WalletTransactionSchema.virtual('amount').get(function () {
    return this.amountMinor / 100;
});
WalletTransactionSchema.set('toJSON', { virtuals: true });
WalletTransactionSchema.set('toObject', { virtuals: true });
WalletTransactionSchema.index({ technicianId: 1, createdAt: -1 });
WalletTransactionSchema.index({ customerId: 1, createdAt: -1 });
WalletTransactionSchema.index({ bookingId: 1, type: 1 });
WalletTransactionSchema.index({ invoiceId: 1, type: 1 });
WalletTransactionSchema.index({ status: 1, createdAt: -1 });
WalletTransactionSchema.index({ externalReference: 1 }, {
    unique: true,
    sparse: true,
    partialFilterExpression: {
        externalReference: { $type: 'string', $ne: '' },
    },
});
exports.Invoice = mongoose_1.default.models.Invoice ??
    mongoose_1.default.model('Invoice', InvoiceSchema);
exports.Wallet = mongoose_1.default.models.Wallet ??
    mongoose_1.default.model('Wallet', WalletSchema);
exports.WalletTransaction = mongoose_1.default.models.WalletTransaction ??
    mongoose_1.default.model('WalletTransaction', WalletTransactionSchema);
//# sourceMappingURL=billing.model.js.map