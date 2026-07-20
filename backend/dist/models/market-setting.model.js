"use strict";
// src/models/marketSetting.model.ts
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
exports.PaymentProviderStatus = exports.MarketStatus = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var MarketStatus;
(function (MarketStatus) {
    MarketStatus["DRAFT"] = "DRAFT";
    MarketStatus["COMING_SOON"] = "COMING_SOON";
    MarketStatus["ACTIVE"] = "ACTIVE";
    MarketStatus["PAUSED"] = "PAUSED";
    MarketStatus["DISABLED"] = "DISABLED";
    MarketStatus["ARCHIVED"] = "ARCHIVED";
})(MarketStatus || (exports.MarketStatus = MarketStatus = {}));
var PaymentProviderStatus;
(function (PaymentProviderStatus) {
    PaymentProviderStatus["ACTIVE"] = "ACTIVE";
    PaymentProviderStatus["DISABLED"] = "DISABLED";
    PaymentProviderStatus["TESTING"] = "TESTING";
    PaymentProviderStatus["FALLBACK"] = "FALLBACK";
})(PaymentProviderStatus || (exports.PaymentProviderStatus = PaymentProviderStatus = {}));
const CityServiceAvailabilitySchema = new mongoose_1.Schema({
    city: {
        type: String,
        required: true,
        trim: true,
    },
    status: {
        type: String,
        enum: Object.values(MarketStatus),
        default: MarketStatus.ACTIVE,
    },
    services: {
        type: [mongoose_1.Schema.Types.Mixed],
        default: [],
    },
    areas: {
        type: [
            new mongoose_1.Schema({
                name: {
                    type: String,
                    required: true,
                    trim: true,
                },
                status: {
                    type: String,
                    enum: Object.values(MarketStatus),
                    default: MarketStatus.ACTIVE,
                },
                services: {
                    type: [
                        new mongoose_1.Schema({
                            serviceKey: {
                                type: String,
                                required: true,
                                trim: true,
                                lowercase: true,
                            },
                            label: {
                                type: String,
                                default: '',
                                trim: true,
                            },
                            status: {
                                type: String,
                                enum: Object.values(MarketStatus),
                                default: MarketStatus.ACTIVE,
                            },
                        }, { _id: false }),
                    ],
                    default: [],
                },
            }, { _id: false }),
        ],
        default: [],
    },
}, { _id: false });
const PaymentProviderSettingSchema = new mongoose_1.Schema({
    provider: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
    },
    status: {
        type: String,
        enum: Object.values(PaymentProviderStatus),
        default: PaymentProviderStatus.DISABLED,
    },
    methods: {
        type: [String],
        default: [],
    },
    priority: {
        type: Number,
        default: 1,
        min: 1,
    },
    payoutEnabled: {
        type: Boolean,
        default: false,
    },
    configReference: {
        type: String,
        default: '',
        trim: true,
    },
}, { _id: false });
const ChangeHistorySchema = new mongoose_1.Schema({
    changedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
    },
    changedAt: {
        type: Date,
        default: Date.now,
    },
    section: {
        type: String,
        required: true,
        trim: true,
    },
    action: {
        type: String,
        required: true,
        trim: true,
    },
    before: {
        type: mongoose_1.Schema.Types.Mixed,
    },
    after: {
        type: mongoose_1.Schema.Types.Mixed,
    },
}, { _id: false });
const MarketSettingSchema = new mongoose_1.Schema({
    identity: {
        countryCode: {
            type: String,
            required: true,
            uppercase: true,
            trim: true,
        },
        countryName: {
            type: String,
            required: true,
            trim: true,
        },
        currency: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
        },
        locale: {
            type: String,
            required: true,
            trim: true,
        },
        timezone: {
            type: String,
            default: '',
            trim: true,
        },
        status: {
            type: String,
            enum: Object.values(MarketStatus),
            default: MarketStatus.DRAFT,
        },
    },
    pricing: {
        defaultCalloutFeeMinor: {
            type: Number,
            required: true,
            min: 0,
        },
        marketCalloutFeeMinor: {
            type: Number,
            min: 0,
            default: undefined,
        },
        platformCommissionBps: {
            type: Number,
            required: true,
            min: 0,
            max: 10000,
        },
        taxLabel: {
            type: String,
            default: 'VAT',
            trim: true,
        },
        taxRateBps: {
            type: Number,
            min: 0,
            max: 10000,
            default: 0,
        },
        taxInclusive: {
            type: Boolean,
            default: false,
        },
        clientServiceFeeType: {
            type: String,
            enum: ['PERCENTAGE', 'FIXED', 'NONE'],
            default: 'NONE',
        },
        clientServiceFeeBps: {
            type: Number,
            min: 0,
            max: 10000,
            default: 0,
        },
        clientServiceFeeMinor: {
            type: Number,
            min: 0,
            default: 0,
        },
        taxableCallout: { type: Boolean, default: true },
        taxableLabour: { type: Boolean, default: true },
        taxableParts: { type: Boolean, default: true },
        taxableAdditionalServices: { type: Boolean, default: true },
        taxableClientServiceFee: { type: Boolean, default: true },
        discountsReduceTaxableValue: { type: Boolean, default: true },
    },
    coverage: {
        supportedCities: {
            type: [String],
            default: [],
        },
        serviceCategories: {
            type: [mongoose_1.Schema.Types.Mixed],
            default: [],
        },
        cityServiceAvailability: {
            type: [CityServiceAvailabilitySchema],
            default: [],
        },
    },
    payments: {
        paymentProviders: {
            type: [String],
            default: [],
        },
        providerSettings: {
            type: [PaymentProviderSettingSchema],
            default: [],
        },
    },
    support: {
        email: {
            type: String,
            default: '',
            trim: true,
            lowercase: true,
        },
        phone: {
            type: String,
            default: '',
            trim: true,
        },
        whatsapp: {
            type: String,
            default: '',
            trim: true,
        },
        escalationEmail: {
            type: String,
            default: '',
            trim: true,
            lowercase: true,
        },
    },
    audit: {
        updatedBy: {
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'User',
        },
        changeHistory: {
            type: [ChangeHistorySchema],
            default: [],
        },
    },
    deletionLock: {
        locked: {
            type: Boolean,
            default: false,
            index: true,
        },
        token: {
            type: String,
            default: '',
            trim: true,
        },
        lockedAt: {
            type: Date,
            default: null,
        },
        lockedBy: {
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
    },
}, { timestamps: true });
MarketSettingSchema.index({ 'identity.countryCode': 1 }, { unique: true });
MarketSettingSchema.index({ 'identity.status': 1 });
MarketSettingSchema.index({ 'coverage.supportedCities': 1 });
MarketSettingSchema.index({ 'deletionLock.locked': 1, 'deletionLock.token': 1 });
const MarketSettingModel = mongoose_1.default.models.MarketSetting ??
    mongoose_1.default.model('MarketSetting', MarketSettingSchema);
exports.default = MarketSettingModel;
//# sourceMappingURL=market-setting.model.js.map