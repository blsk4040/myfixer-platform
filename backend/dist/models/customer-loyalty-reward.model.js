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
exports.CustomerLoyaltyRewardStatus = exports.CustomerLoyaltyRewardType = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var CustomerLoyaltyRewardType;
(function (CustomerLoyaltyRewardType) {
    CustomerLoyaltyRewardType["PADI_DISCOUNT"] = "PADI_DISCOUNT";
    CustomerLoyaltyRewardType["FREE_SERVICE"] = "FREE_SERVICE";
    CustomerLoyaltyRewardType["PARTNER_VOUCHER"] = "PARTNER_VOUCHER";
    CustomerLoyaltyRewardType["PADI_CREDIT"] = "PADI_CREDIT";
    CustomerLoyaltyRewardType["BENEFIT"] = "BENEFIT";
})(CustomerLoyaltyRewardType || (exports.CustomerLoyaltyRewardType = CustomerLoyaltyRewardType = {}));
var CustomerLoyaltyRewardStatus;
(function (CustomerLoyaltyRewardStatus) {
    CustomerLoyaltyRewardStatus["EARNED"] = "EARNED";
    CustomerLoyaltyRewardStatus["CLAIMED"] = "CLAIMED";
    CustomerLoyaltyRewardStatus["REDEEMED"] = "REDEEMED";
    CustomerLoyaltyRewardStatus["EXPIRED"] = "EXPIRED";
    CustomerLoyaltyRewardStatus["BLOCKED"] = "BLOCKED";
})(CustomerLoyaltyRewardStatus || (exports.CustomerLoyaltyRewardStatus = CustomerLoyaltyRewardStatus = {}));
const CustomerLoyaltyRewardSchema = new mongoose_1.Schema({
    customerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    countryCode: {
        type: String,
        required: true,
        uppercase: true,
        validate: { validator: (value) => /^[A-Z]{2}$/.test(value), message: 'Invalid ISO country code.' },
        index: true,
    },
    city: { type: String, default: '', trim: true, index: true },
    milestone: { type: Number, required: true, min: 1, index: true },
    rewardType: {
        type: String,
        enum: Object.values(CustomerLoyaltyRewardType),
        required: true,
        index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, default: '', trim: true, maxlength: 600 },
    status: {
        type: String,
        enum: Object.values(CustomerLoyaltyRewardStatus),
        default: CustomerLoyaltyRewardStatus.EARNED,
        index: true,
    },
    qualifyingBookingIds: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'Booking' }],
    earnedFromBookingId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Booking', default: null, index: true },
    promotionId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Promotion', default: null, index: true },
    promotionCode: { type: String, default: '', trim: true, uppercase: true, index: true },
    partnerName: { type: String, default: '', trim: true, maxlength: 120 },
    partnerVoucherCode: { type: String, default: '', trim: true, maxlength: 120 },
    rewardValueMinor: { type: Number, default: null, min: 0 },
    currency: {
        type: String,
        uppercase: true,
        validate: { validator: (value) => !value || /^[A-Z]{3}$/.test(value), message: 'Invalid currency code.' },
        default: null,
    },
    expiresAt: { type: Date, default: null, index: true },
    claimedAt: { type: Date, default: null },
    redeemedAt: { type: Date, default: null },
    blockedAt: { type: Date, default: null },
    blockReason: { type: String, default: '', trim: true, maxlength: 240 },
    fraudSignals: { type: [String], default: [] },
    metadata: { type: mongoose_1.Schema.Types.Mixed, default: {} },
}, { timestamps: true });
CustomerLoyaltyRewardSchema.index({ customerId: 1, milestone: 1 }, { unique: true });
CustomerLoyaltyRewardSchema.index({ countryCode: 1, status: 1, createdAt: -1 });
const CustomerLoyaltyRewardModel = mongoose_1.default.models.CustomerLoyaltyReward ??
    mongoose_1.default.model('CustomerLoyaltyReward', CustomerLoyaltyRewardSchema);
exports.default = CustomerLoyaltyRewardModel;
//# sourceMappingURL=customer-loyalty-reward.model.js.map