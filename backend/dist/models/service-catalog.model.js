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
exports.ServicePublicationStatus = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const market_setting_model_1 = require("./market-setting.model");
var ServicePublicationStatus;
(function (ServicePublicationStatus) {
    ServicePublicationStatus["DRAFT"] = "DRAFT";
    ServicePublicationStatus["PUBLISHED"] = "PUBLISHED";
    ServicePublicationStatus["PAUSED"] = "PAUSED";
    ServicePublicationStatus["ARCHIVED"] = "ARCHIVED";
})(ServicePublicationStatus || (exports.ServicePublicationStatus = ServicePublicationStatus = {}));
const MAX_SERVICE_PRICE_MINOR = 100_000_000;
const normalizeKey = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const normalizeStringList = (values) => Array.isArray(values)
    ? values
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .slice(0, 50)
    : [];
const CapabilityRequirementsSchema = new mongoose_1.Schema({
    requiredEvidenceTypes: {
        type: [String],
        default: [],
        set: normalizeStringList,
    },
    equipmentRequired: {
        type: [String],
        default: [],
        set: normalizeStringList,
    },
    licenceRequired: {
        type: Boolean,
        default: false,
    },
    certificateRequired: {
        type: Boolean,
        default: false,
    },
    notes: {
        type: String,
        default: '',
        trim: true,
        maxlength: 1200,
    },
}, { _id: false });
const ServiceSubcategorySchema = new mongoose_1.Schema({
    subcategoryKey: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        set: normalizeKey,
    },
    serviceKey: {
        type: String,
        trim: true,
        lowercase: true,
        default: '',
        set: normalizeKey,
    },
    label: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        default: '',
        trim: true,
        maxlength: 1200,
    },
    status: {
        type: String,
        enum: Object.values(market_setting_model_1.MarketStatus),
        default: market_setting_model_1.MarketStatus.ACTIVE,
    },
    publicationStatus: {
        type: String,
        enum: Object.values(ServicePublicationStatus),
        default: ServicePublicationStatus.PUBLISHED,
    },
    displayOrder: {
        type: Number,
        default: 0,
        min: 0,
    },
    imageKey: {
        type: String,
        default: '',
        trim: true,
        lowercase: true,
        set: normalizeKey,
    },
    imageUrl: {
        type: String,
        default: '',
        trim: true,
        validate: {
            validator(value) {
                return !value || /^https:\/\/[^\s]+$/i.test(value);
            },
            message: 'Image URL must be HTTPS.',
        },
    },
    searchKeywords: {
        type: [String],
        default: [],
        set: normalizeStringList,
    },
    synonyms: {
        type: [String],
        default: [],
        set: normalizeStringList,
    },
    estimatedDurationMinutes: {
        type: Number,
        min: 0,
        default: undefined,
    },
    inspectionRequired: {
        type: Boolean,
        default: false,
    },
    fixedPriceSupported: {
        type: Boolean,
        default: false,
    },
    requiresCapabilityApproval: {
        type: Boolean,
        default: true,
    },
    capabilityRequirements: {
        type: CapabilityRequirementsSchema,
        default: () => ({}),
    },
    calloutFeeMinor: {
        type: Number,
        min: 0,
        max: MAX_SERVICE_PRICE_MINOR,
        default: undefined,
    },
    minimumChargeMinor: {
        type: Number,
        min: 0,
        max: MAX_SERVICE_PRICE_MINOR,
        default: undefined,
    },
}, { _id: false });
const ServiceCatalogSchema = new mongoose_1.Schema({
    serviceKey: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        set: normalizeKey,
    },
    categoryKey: {
        type: String,
        trim: true,
        lowercase: true,
        default: '',
        set: normalizeKey,
    },
    groupKey: {
        type: String,
        trim: true,
        lowercase: true,
        default: 'home_services',
        set: normalizeKey,
        index: true,
    },
    groupLabel: {
        type: String,
        default: 'Home Services',
        trim: true,
    },
    groupDescription: {
        type: String,
        default: '',
        trim: true,
        maxlength: 1200,
    },
    groupImageKey: {
        type: String,
        default: '',
        trim: true,
        lowercase: true,
        set: normalizeKey,
    },
    groupImageUrl: {
        type: String,
        default: '',
        trim: true,
        validate: {
            validator(value) {
                return !value || /^https:\/\/[^\s]+$/i.test(value);
            },
            message: 'Group image URL must be HTTPS.',
        },
    },
    groupIconKey: {
        type: String,
        default: '',
        trim: true,
        lowercase: true,
        set: normalizeKey,
    },
    groupStatus: {
        type: String,
        enum: Object.values(ServicePublicationStatus),
        default: ServicePublicationStatus.PUBLISHED,
        index: true,
    },
    groupDisplayOrder: {
        type: Number,
        min: 0,
        default: 0,
    },
    label: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        default: '',
        trim: true,
        maxlength: 1200,
    },
    internalNotes: {
        type: String,
        default: '',
        trim: true,
        maxlength: 2000,
    },
    imageKey: {
        type: String,
        default: 'maintenance',
        trim: true,
        lowercase: true,
        set: normalizeKey,
    },
    imageUrl: {
        type: String,
        default: '',
        trim: true,
        validate: {
            validator(value) {
                return !value || /^https:\/\/[^\s]+$/i.test(value);
            },
            message: 'Image URL must be HTTPS.',
        },
    },
    iconKey: {
        type: String,
        default: '',
        trim: true,
        lowercase: true,
        set: normalizeKey,
    },
    searchKeywords: {
        type: [String],
        default: [],
        set: normalizeStringList,
    },
    synonyms: {
        type: [String],
        default: [],
        set: normalizeStringList,
    },
    status: {
        type: String,
        enum: Object.values(ServicePublicationStatus),
        default: ServicePublicationStatus.DRAFT,
        index: true,
    },
    defaultCalloutFeeMinor: {
        type: Number,
        min: 0,
        max: MAX_SERVICE_PRICE_MINOR,
        default: undefined,
    },
    minimumChargeMinor: {
        type: Number,
        min: 0,
        max: MAX_SERVICE_PRICE_MINOR,
        default: undefined,
    },
    fixedPriceSupported: {
        type: Boolean,
        default: false,
    },
    requiresCapabilityApproval: {
        type: Boolean,
        default: true,
    },
    capabilityRequirements: {
        type: CapabilityRequirementsSchema,
        default: () => ({}),
    },
    displayOrder: {
        type: Number,
        min: 0,
        default: 0,
    },
    subcategories: {
        type: [ServiceSubcategorySchema],
        default: [],
        validate: {
            validator(values) {
                const keys = (values || []).map((item) => normalizeKey(item.subcategoryKey)).filter(Boolean);
                return new Set(keys).size === keys.length;
            },
            message: 'Subcategory keys must be unique within a service.',
        },
    },
    audit: {
        updatedBy: {
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'User',
        },
        changeHistory: {
            type: [
                new mongoose_1.Schema({
                    changedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
                    changedAt: { type: Date, default: Date.now },
                    action: { type: String, required: true, trim: true },
                    before: { type: mongoose_1.Schema.Types.Mixed },
                    after: { type: mongoose_1.Schema.Types.Mixed },
                }, { _id: false }),
            ],
            default: [],
        },
    },
}, { timestamps: true });
ServiceCatalogSchema.index({ status: 1, serviceKey: 1 });
ServiceCatalogSchema.index({ groupKey: 1, status: 1, displayOrder: 1 });
const ServiceCatalogModel = mongoose_1.default.models.ServiceCatalog ??
    mongoose_1.default.model('ServiceCatalog', ServiceCatalogSchema);
exports.default = ServiceCatalogModel;
//# sourceMappingURL=service-catalog.model.js.map