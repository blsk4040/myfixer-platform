"use strict";
// src/models/paymentVault.model.ts
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
exports.PaymentMethodStatus = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var PaymentMethodStatus;
(function (PaymentMethodStatus) {
    PaymentMethodStatus["ACTIVE"] = "ACTIVE";
    PaymentMethodStatus["DISABLED"] = "DISABLED";
    PaymentMethodStatus["EXPIRED"] = "EXPIRED";
    PaymentMethodStatus["REMOVED"] = "REMOVED";
})(PaymentMethodStatus || (exports.PaymentMethodStatus = PaymentMethodStatus = {}));
const PaymentMethodSchema = new mongoose_1.Schema({
    methodId: {
        type: String,
        required: true,
        trim: true,
        index: true,
    },
    authorizationCode: {
        type: String,
        required: true,
        trim: true,
        select: false,
    },
    signature: {
        type: String,
        required: true,
        trim: true,
        select: false,
    },
    reusable: {
        type: Boolean,
        default: true,
    },
    brand: {
        type: String,
        default: '',
        trim: true,
        lowercase: true,
    },
    bank: {
        type: String,
        default: '',
        trim: true,
    },
    countryCode: {
        type: String,
        default: '',
        trim: true,
        uppercase: true,
    },
    last4: {
        type: String,
        required: true,
        trim: true,
        minlength: 4,
        maxlength: 4,
    },
    expiryMonth: {
        type: String,
        required: true,
        trim: true,
    },
    expiryYear: {
        type: String,
        required: true,
        trim: true,
    },
    cardType: {
        type: String,
        default: '',
        trim: true,
        lowercase: true,
    },
    isDefault: {
        type: Boolean,
        default: false,
    },
    status: {
        type: String,
        enum: Object.values(PaymentMethodStatus),
        default: PaymentMethodStatus.ACTIVE,
        index: true,
    },
    disabledAt: {
        type: Date,
        default: null,
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
}, { _id: false });
const PaymentVaultSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true,
    },
    gateway: {
        type: String,
        default: 'paystack',
        trim: true,
        lowercase: true,
        index: true,
    },
    gatewayCustomerId: {
        type: String,
        default: '',
        trim: true,
        index: true,
    },
    defaultMethodId: {
        type: String,
        default: '',
        trim: true,
    },
    paymentMethods: {
        type: [PaymentMethodSchema],
        default: [],
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
}, { timestamps: true });
PaymentVaultSchema.index({ userId: 1, gateway: 1 }, { unique: true });
PaymentVaultSchema.index({ gateway: 1, gatewayCustomerId: 1 });
const PaymentVault = mongoose_1.default.models.PaymentVault ??
    mongoose_1.default.model('PaymentVault', PaymentVaultSchema);
exports.default = PaymentVault;
//# sourceMappingURL=paymentVault.model.js.map