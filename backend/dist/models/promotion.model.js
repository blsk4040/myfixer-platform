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
exports.PromotionStackingPolicy = exports.PromotionFundingSource = exports.PromotionTriggerType = exports.PromotionStatus = exports.PromotionDiscountType = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var PromotionDiscountType;
(function (PromotionDiscountType) {
    PromotionDiscountType["PERCENTAGE"] = "PERCENTAGE";
    PromotionDiscountType["FIXED_AMOUNT"] = "FIXED_AMOUNT";
    PromotionDiscountType["FREE_CALLOUT"] = "FREE_CALLOUT";
})(PromotionDiscountType || (exports.PromotionDiscountType = PromotionDiscountType = {}));
var PromotionStatus;
(function (PromotionStatus) {
    PromotionStatus["DRAFT"] = "DRAFT";
    PromotionStatus["ACTIVE"] = "ACTIVE";
    PromotionStatus["PAUSED"] = "PAUSED";
    PromotionStatus["EXPIRED"] = "EXPIRED";
    PromotionStatus["ENDED"] = "ENDED";
    PromotionStatus["ARCHIVED"] = "ARCHIVED";
})(PromotionStatus || (exports.PromotionStatus = PromotionStatus = {}));
var PromotionTriggerType;
(function (PromotionTriggerType) {
    PromotionTriggerType["AUTOMATIC"] = "AUTOMATIC";
    PromotionTriggerType["CODE"] = "CODE";
})(PromotionTriggerType || (exports.PromotionTriggerType = PromotionTriggerType = {}));
var PromotionFundingSource;
(function (PromotionFundingSource) {
    PromotionFundingSource["MYFIXER"] = "MYFIXER";
    PromotionFundingSource["PROVIDER"] = "PROVIDER";
    PromotionFundingSource["PARTNER"] = "PARTNER";
    PromotionFundingSource["SHARED"] = "SHARED";
    PromotionFundingSource["PLATFORM"] = "PLATFORM";
    PromotionFundingSource["TECHNICIAN"] = "TECHNICIAN";
})(PromotionFundingSource || (exports.PromotionFundingSource = PromotionFundingSource = {}));
var PromotionStackingPolicy;
(function (PromotionStackingPolicy) {
    PromotionStackingPolicy["EXCLUSIVE"] = "EXCLUSIVE";
    PromotionStackingPolicy["STACKABLE"] = "STACKABLE";
})(PromotionStackingPolicy || (exports.PromotionStackingPolicy = PromotionStackingPolicy = {}));
const PromotionSchema = new mongoose_1.Schema({
    code: {
        type: String,
        uppercase: true,
        trim: true,
        match: /^[A-Z0-9_-]{3,32}$/,
        default: null,
    },
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120,
    },
    description: {
        type: String,
        default: '',
        trim: true,
        maxlength: 500,
    },
    status: {
        type: String,
        enum: Object.values(PromotionStatus),
        default: PromotionStatus.ACTIVE,
        index: true,
    },
    triggerType: {
        type: String,
        enum: Object.values(PromotionTriggerType),
        default: PromotionTriggerType.CODE,
        index: true,
    },
    discountType: {
        type: String,
        enum: Object.values(PromotionDiscountType),
        required: true,
    },
    discountValue: {
        type: Number,
        required: true,
        min: 0,
    },
    maxDiscountMinor: {
        type: Number,
        default: null,
        min: 0,
    },
    minBookingAmountMinor: {
        type: Number,
        default: 0,
        min: 0,
    },
    serviceKeys: {
        type: [String],
        default: [],
        index: true,
    },
    cityKeys: {
        type: [String],
        default: [],
        index: true,
    },
    areaKeys: {
        type: [String],
        default: [],
        index: true,
    },
    subcategoryKeys: {
        type: [String],
        default: [],
        index: true,
    },
    eligibleClientIds: [{
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'User',
        }],
    excludedClientIds: [{
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'User',
        }],
    firstBookingOnly: {
        type: Boolean,
        default: false,
    },
    priority: {
        type: Number,
        default: 100,
        min: 0,
        index: true,
    },
    stackingPolicy: {
        type: String,
        enum: Object.values(PromotionStackingPolicy),
        default: PromotionStackingPolicy.EXCLUSIVE,
    },
    fundingSource: {
        type: String,
        enum: Object.values(PromotionFundingSource),
        default: PromotionFundingSource.PLATFORM,
    },
    fundingSplitBps: {
        platform: { type: Number, default: 10000, min: 0, max: 10000 },
        technician: { type: Number, default: 0, min: 0, max: 10000 },
        partner: { type: Number, default: 0, min: 0, max: 10000 },
    },
    budgetMinor: {
        type: Number,
        default: null,
        min: 0,
    },
    reservedBudgetMinor: {
        type: Number,
        default: 0,
        min: 0,
    },
    redeemedBudgetMinor: {
        type: Number,
        default: 0,
        min: 0,
    },
    reservationCount: {
        type: Number,
        default: 0,
        min: 0,
    },
    redemptionCount: {
        type: Number,
        default: 0,
        min: 0,
    },
    countryCode: {
        type: String,
        uppercase: true,
        validate: { validator: (value) => /^[A-Z]{2}$/.test(value), message: 'Invalid ISO country code.' },
        default: null,
        index: true,
    },
    currency: {
        type: String,
        uppercase: true,
        validate: { validator: (value) => /^[A-Z]{3}$/.test(value), message: 'Invalid currency code.' },
        default: null,
        index: true,
    },
    startsAt: {
        type: Date,
        default: null,
    },
    expiresAt: {
        type: Date,
        default: null,
        index: true,
    },
    usageLimit: {
        type: Number,
        default: null,
        min: 0,
    },
    usageCount: {
        type: Number,
        default: 0,
        min: 0,
    },
    perClientLimit: {
        type: Number,
        default: null,
        min: 0,
    },
    createdBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
    },
    updatedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
}, { timestamps: true });
PromotionSchema.index({ status: 1, startsAt: 1, expiresAt: 1 });
PromotionSchema.index({ countryCode: 1, status: 1 });
PromotionSchema.index({ code: 1 }, { unique: true, partialFilterExpression: { code: { $type: 'string' } } });
PromotionSchema.index({ triggerType: 1, status: 1, priority: 1 });
PromotionSchema.index({ countryCode: 1, serviceKeys: 1, subcategoryKeys: 1, status: 1 });
const PromotionModel = mongoose_1.default.models.Promotion ??
    mongoose_1.default.model('Promotion', PromotionSchema);
exports.default = PromotionModel;
//# sourceMappingURL=promotion.model.js.map