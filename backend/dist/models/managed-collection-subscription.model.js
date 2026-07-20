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
exports.ManagedCollectionSubscriptionInvoice = exports.ManagedCollectionSubscription = exports.ManagedCollectionPlan = exports.SubscriptionInvoiceStatus = exports.BillingFrequency = exports.SubscriptionPlanStatus = exports.SubscriptionStatus = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const managed_collection_model_1 = require("./managed-collection.model");
var SubscriptionStatus;
(function (SubscriptionStatus) {
    SubscriptionStatus["ACTIVE"] = "ACTIVE";
    SubscriptionStatus["PAUSED"] = "PAUSED";
    SubscriptionStatus["CANCELLED"] = "CANCELLED";
    SubscriptionStatus["EXPIRED"] = "EXPIRED";
    SubscriptionStatus["PENDING"] = "PENDING";
})(SubscriptionStatus || (exports.SubscriptionStatus = SubscriptionStatus = {}));
var SubscriptionPlanStatus;
(function (SubscriptionPlanStatus) {
    SubscriptionPlanStatus["ACTIVE"] = "ACTIVE";
    SubscriptionPlanStatus["PAUSED"] = "PAUSED";
    SubscriptionPlanStatus["DISABLED"] = "DISABLED";
})(SubscriptionPlanStatus || (exports.SubscriptionPlanStatus = SubscriptionPlanStatus = {}));
var BillingFrequency;
(function (BillingFrequency) {
    BillingFrequency["WEEKLY"] = "WEEKLY";
    BillingFrequency["MONTHLY"] = "MONTHLY";
    BillingFrequency["QUARTERLY"] = "QUARTERLY";
    BillingFrequency["YEARLY"] = "YEARLY";
})(BillingFrequency || (exports.BillingFrequency = BillingFrequency = {}));
var SubscriptionInvoiceStatus;
(function (SubscriptionInvoiceStatus) {
    SubscriptionInvoiceStatus["DRAFT"] = "DRAFT";
    SubscriptionInvoiceStatus["UNPAID"] = "UNPAID";
    SubscriptionInvoiceStatus["PAID"] = "PAID";
    SubscriptionInvoiceStatus["OVERDUE"] = "OVERDUE";
    SubscriptionInvoiceStatus["CANCELLED"] = "CANCELLED";
})(SubscriptionInvoiceStatus || (exports.SubscriptionInvoiceStatus = SubscriptionInvoiceStatus = {}));
const PlanSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true, index: true },
    description: { type: String, default: '', trim: true },
    priceMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, uppercase: true,
        validate: { validator: (value) => /^[A-Z]{3}$/.test(value), message: 'Invalid currency code.' }, required: true, index: true },
    countryCode: { type: String, uppercase: true,
        validate: { validator: (value) => /^[A-Z]{2}$/.test(value), message: 'Invalid ISO country code.' }, required: true, index: true },
    billingFrequency: { type: String, enum: Object.values(BillingFrequency), required: true, index: true },
    collectionFrequency: { type: String, enum: Object.values(managed_collection_model_1.ManagedCollectionFrequency), required: true },
    binPackage: { type: [String], enum: Object.values(managed_collection_model_1.ManagedCollectionBinColor), default: [] },
    collectionType: { type: String, enum: Object.values(managed_collection_model_1.ManagedCollectionType), required: true, index: true },
    status: { type: String, enum: Object.values(SubscriptionPlanStatus), default: SubscriptionPlanStatus.ACTIVE, index: true },
    metadata: { type: mongoose_1.Schema.Types.Mixed, default: {} },
}, { timestamps: true });
const SubscriptionSchema = new mongoose_1.Schema({
    customerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    profileId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'ManagedCollectionProfile', index: true },
    planId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'ManagedCollectionPlan', required: true, index: true },
    planName: { type: String, required: true, trim: true },
    customerName: { type: String, default: 'Client', trim: true },
    customerEmail: { type: String, required: true, trim: true, lowercase: true },
    countryCode: { type: String, uppercase: true,
        validate: { validator: (value) => /^[A-Z]{2}$/.test(value), message: 'Invalid ISO country code.' }, required: true, index: true },
    city: { type: String, required: true, trim: true, index: true },
    area: { type: String, default: '', trim: true, index: true },
    currency: { type: String, uppercase: true,
        validate: { validator: (value) => /^[A-Z]{3}$/.test(value), message: 'Invalid currency code.' }, required: true },
    priceMinor: { type: Number, required: true, min: 0 },
    billingFrequency: { type: String, enum: Object.values(BillingFrequency), required: true, index: true },
    collectionFrequency: { type: String, enum: Object.values(managed_collection_model_1.ManagedCollectionFrequency), required: true },
    binPackage: { type: [String], enum: Object.values(managed_collection_model_1.ManagedCollectionBinColor), default: [] },
    collectionType: { type: String, enum: Object.values(managed_collection_model_1.ManagedCollectionType), required: true, index: true },
    status: { type: String, enum: Object.values(SubscriptionStatus), default: SubscriptionStatus.PENDING, index: true },
    startedAt: { type: Date, default: Date.now },
    pausedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    previousBillingDate: { type: Date, default: null },
    nextBillingDate: { type: Date, required: true, index: true },
    renewalDate: { type: Date, required: true, index: true },
    gracePeriodEndsAt: { type: Date, required: true, index: true },
    recurringPayment: {
        provider: { type: String, default: 'paystack', trim: true, lowercase: true },
        customerCode: { type: String, default: '', trim: true },
        authorizationReference: { type: String, default: '', trim: true },
        defaultMethodId: { type: String, default: '', trim: true },
        enabled: { type: Boolean, default: false },
    },
    metadata: { type: mongoose_1.Schema.Types.Mixed, default: {} },
}, { timestamps: true });
const SubscriptionInvoiceSchema = new mongoose_1.Schema({
    invoiceNumber: { type: String, required: true, unique: true, trim: true, index: true },
    subscriptionId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'ManagedCollectionSubscription', required: true, index: true },
    planId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'ManagedCollectionPlan', required: true, index: true },
    customerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    countryCode: { type: String, uppercase: true,
        validate: { validator: (value) => /^[A-Z]{2}$/.test(value), message: 'Invalid ISO country code.' }, required: true, index: true },
    currency: { type: String, uppercase: true,
        validate: { validator: (value) => /^[A-Z]{3}$/.test(value), message: 'Invalid currency code.' }, required: true },
    amountMinor: { type: Number, required: true, min: 0 },
    billingPeriodStart: { type: Date, required: true },
    billingPeriodEnd: { type: Date, required: true },
    dueAt: { type: Date, required: true, index: true },
    status: { type: String, enum: Object.values(SubscriptionInvoiceStatus), default: SubscriptionInvoiceStatus.UNPAID, index: true },
    paidAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    metadata: { type: mongoose_1.Schema.Types.Mixed, default: {} },
}, { timestamps: true });
PlanSchema.index({ countryCode: 1, status: 1 });
SubscriptionSchema.index({ customerId: 1, status: 1 });
SubscriptionSchema.index({ status: 1, nextBillingDate: 1 });
SubscriptionInvoiceSchema.index({ subscriptionId: 1, dueAt: -1 });
SubscriptionInvoiceSchema.index({ status: 1, dueAt: 1 });
exports.ManagedCollectionPlan = mongoose_1.default.models.ManagedCollectionPlan ??
    mongoose_1.default.model('ManagedCollectionPlan', PlanSchema);
exports.ManagedCollectionSubscription = mongoose_1.default.models.ManagedCollectionSubscription ??
    mongoose_1.default.model('ManagedCollectionSubscription', SubscriptionSchema);
exports.ManagedCollectionSubscriptionInvoice = mongoose_1.default.models.ManagedCollectionSubscriptionInvoice ??
    mongoose_1.default.model('ManagedCollectionSubscriptionInvoice', SubscriptionInvoiceSchema);
//# sourceMappingURL=managed-collection-subscription.model.js.map