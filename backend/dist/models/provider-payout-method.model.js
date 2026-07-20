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
exports.ProviderPayoutProvider = exports.ProviderPayoutMethodStatus = exports.ProviderPayoutMethodType = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var ProviderPayoutMethodType;
(function (ProviderPayoutMethodType) {
    ProviderPayoutMethodType["BANK_ACCOUNT"] = "BANK_ACCOUNT";
    ProviderPayoutMethodType["MOBILE_MONEY"] = "MOBILE_MONEY";
})(ProviderPayoutMethodType || (exports.ProviderPayoutMethodType = ProviderPayoutMethodType = {}));
var ProviderPayoutMethodStatus;
(function (ProviderPayoutMethodStatus) {
    ProviderPayoutMethodStatus["PENDING_VERIFICATION"] = "PENDING_VERIFICATION";
    ProviderPayoutMethodStatus["VERIFIED"] = "VERIFIED";
    ProviderPayoutMethodStatus["REJECTED"] = "REJECTED";
    ProviderPayoutMethodStatus["DISABLED"] = "DISABLED";
})(ProviderPayoutMethodStatus || (exports.ProviderPayoutMethodStatus = ProviderPayoutMethodStatus = {}));
var ProviderPayoutProvider;
(function (ProviderPayoutProvider) {
    ProviderPayoutProvider["PAYSTACK"] = "PAYSTACK";
})(ProviderPayoutProvider || (exports.ProviderPayoutProvider = ProviderPayoutProvider = {}));
const ProviderPayoutMethodSchema = new mongoose_1.Schema({
    technicianId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: Object.values(ProviderPayoutMethodType), required: true, index: true },
    provider: { type: String, enum: Object.values(ProviderPayoutProvider), default: ProviderPayoutProvider.PAYSTACK, index: true },
    countryCode: { type: String, uppercase: true,
        validate: { validator: (value) => /^[A-Z]{2}$/.test(value), message: 'Invalid ISO country code.' }, required: true, index: true },
    currency: { type: String, uppercase: true,
        validate: { validator: (value) => /^[A-Z]{3}$/.test(value), message: 'Invalid currency code.' }, required: true, index: true },
    accountHolderName: { type: String, required: true, trim: true, maxlength: 120 },
    bankName: { type: String, default: '', trim: true, maxlength: 120 },
    bankCode: { type: String, default: '', trim: true, maxlength: 40 },
    encryptedAccountNumber: { type: String, default: '', select: false },
    encryptedMobileNumber: { type: String, default: '', select: false },
    mobileProvider: { type: String, default: '', trim: true, maxlength: 80 },
    maskedDestination: { type: String, required: true, trim: true },
    providerRecipientCode: { type: String, default: '', trim: true, index: true },
    providerRecipientId: { type: String, default: '', trim: true },
    status: {
        type: String,
        enum: Object.values(ProviderPayoutMethodStatus),
        default: ProviderPayoutMethodStatus.PENDING_VERIFICATION,
        index: true,
    },
    isDefault: { type: Boolean, default: false, index: true },
    verifiedAt: { type: Date, default: null },
    disabledAt: { type: Date, default: null },
    rejectionReason: { type: String, default: '', trim: true, maxlength: 500 },
    metadata: { type: mongoose_1.Schema.Types.Mixed, default: {} },
}, { timestamps: true });
ProviderPayoutMethodSchema.index({ technicianId: 1, isDefault: 1 });
ProviderPayoutMethodSchema.index({ technicianId: 1, status: 1, createdAt: -1 });
const ProviderPayoutMethod = mongoose_1.default.models.ProviderPayoutMethod ??
    mongoose_1.default.model('ProviderPayoutMethod', ProviderPayoutMethodSchema);
exports.default = ProviderPayoutMethod;
//# sourceMappingURL=provider-payout-method.model.js.map