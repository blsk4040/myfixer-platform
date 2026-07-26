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
exports.CustomerReferralStatus = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var CustomerReferralStatus;
(function (CustomerReferralStatus) {
    CustomerReferralStatus["REGISTERED"] = "REGISTERED";
    CustomerReferralStatus["FIRST_BOOKING_CREATED"] = "FIRST_BOOKING_CREATED";
    CustomerReferralStatus["FIRST_JOB_COMPLETED"] = "FIRST_JOB_COMPLETED";
    CustomerReferralStatus["REWARD_ELIGIBLE"] = "REWARD_ELIGIBLE";
    CustomerReferralStatus["REWARD_BLOCKED"] = "REWARD_BLOCKED";
})(CustomerReferralStatus || (exports.CustomerReferralStatus = CustomerReferralStatus = {}));
const CustomerReferralSchema = new mongoose_1.Schema({
    referralCode: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
        index: true,
    },
    referrerCustomerId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    referredCustomerId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true,
    },
    referredCustomerEmail: {
        type: String,
        default: '',
        lowercase: true,
        trim: true,
        index: true,
    },
    countryCode: {
        type: String,
        required: true,
        uppercase: true,
        validate: { validator: (value) => /^[A-Z]{2}$/.test(value), message: 'Invalid ISO country code.' },
        index: true,
    },
    city: {
        type: String,
        default: '',
        trim: true,
        index: true,
    },
    status: {
        type: String,
        enum: Object.values(CustomerReferralStatus),
        default: CustomerReferralStatus.REGISTERED,
        index: true,
    },
    friendDiscountPromotionId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Promotion',
        default: null,
        index: true,
    },
    friendDiscountCode: {
        type: String,
        default: '',
        trim: true,
        uppercase: true,
        index: true,
    },
    friendDiscountIssuedAt: {
        type: Date,
        default: null,
    },
    firstBookingId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Booking',
        default: null,
    },
    firstCompletedBookingId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Booking',
        default: null,
    },
    rewardPromotionId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Promotion',
        default: null,
        index: true,
    },
    rewardCode: {
        type: String,
        default: '',
        trim: true,
        uppercase: true,
        index: true,
    },
    registeredAt: {
        type: Date,
        default: Date.now,
        index: true,
    },
    firstBookingAt: {
        type: Date,
        default: null,
    },
    firstCompletedAt: {
        type: Date,
        default: null,
    },
    rewardEligibleAt: {
        type: Date,
        default: null,
    },
    rewardIssuedAt: {
        type: Date,
        default: null,
    },
    rewardBlockedAt: {
        type: Date,
        default: null,
    },
    rewardBlockReason: {
        type: String,
        default: '',
        trim: true,
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
}, { timestamps: true });
CustomerReferralSchema.index({ referrerCustomerId: 1, status: 1 });
CustomerReferralSchema.index({ referralCode: 1, registeredAt: -1 });
const CustomerReferralModel = mongoose_1.default.models.CustomerReferral ??
    mongoose_1.default.model('CustomerReferral', CustomerReferralSchema);
exports.default = CustomerReferralModel;
//# sourceMappingURL=customer-referral.model.js.map