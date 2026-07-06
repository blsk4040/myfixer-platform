"use strict";
// src/models/technician.model.ts
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
exports.VerificationStatus = exports.TechnicianApprovalStatus = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const market_config_1 = require("../config/market.config");
var TechnicianApprovalStatus;
(function (TechnicianApprovalStatus) {
    TechnicianApprovalStatus["PENDING_REVIEW"] = "PENDING_REVIEW";
    TechnicianApprovalStatus["APPROVED"] = "APPROVED";
    TechnicianApprovalStatus["REJECTED"] = "REJECTED";
    TechnicianApprovalStatus["SUSPENDED"] = "SUSPENDED";
})(TechnicianApprovalStatus || (exports.TechnicianApprovalStatus = TechnicianApprovalStatus = {}));
var VerificationStatus;
(function (VerificationStatus) {
    VerificationStatus["NOT_SUBMITTED"] = "NOT_SUBMITTED";
    VerificationStatus["SUBMITTED"] = "SUBMITTED";
    VerificationStatus["VERIFIED"] = "VERIFIED";
    VerificationStatus["REJECTED"] = "REJECTED";
})(VerificationStatus || (exports.VerificationStatus = VerificationStatus = {}));
const LocationSchema = new mongoose_1.Schema({
    type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
        required: true,
    },
    coordinates: {
        type: [Number],
        required: true,
        validate: {
            validator(value) {
                return Array.isArray(value) && value.length === 2;
            },
            message: 'Coordinates must contain [longitude, latitude]',
        },
    },
}, { _id: false });
const TechnicianSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true,
    },
    approvalStatus: {
        type: String,
        enum: Object.values(TechnicianApprovalStatus),
        default: TechnicianApprovalStatus.PENDING_REVIEW,
        index: true,
    },
    countryCode: {
        type: String,
        enum: Object.values(market_config_1.CountryCode),
        required: true,
        index: true,
    },
    city: {
        type: String,
        required: true,
        trim: true,
        index: true,
    },
    serviceCategories: {
        type: [String],
        required: true,
        default: [],
        index: true,
    },
    yearsExperience: {
        type: Number,
        required: true,
        min: 0,
        default: 0,
    },
    businessName: {
        type: String,
        default: '',
        trim: true,
    },
    idNumberLast4: {
        type: String,
        default: '',
        trim: true,
        maxlength: 4,
    },
    vehicleType: {
        type: String,
        default: '',
        trim: true,
    },
    vehicleRegistration: {
        type: String,
        default: '',
        trim: true,
        uppercase: true,
    },
    serviceRadiusKm: {
        type: Number,
        default: 25,
        min: 1,
        max: 150,
    },
    bio: {
        type: String,
        default: '',
        trim: true,
        maxlength: 600,
    },
    documents: {
        idDocumentUrl: {
            type: String,
            default: '',
            trim: true,
        },
        idDocumentStatus: {
            type: String,
            enum: Object.values(VerificationStatus),
            default: VerificationStatus.NOT_SUBMITTED,
        },
        tradeCertificateUrl: {
            type: String,
            default: '',
            trim: true,
        },
        tradeCertificateStatus: {
            type: String,
            enum: Object.values(VerificationStatus),
            default: VerificationStatus.NOT_SUBMITTED,
        },
        policeClearanceUrl: {
            type: String,
            default: '',
            trim: true,
        },
        policeClearanceStatus: {
            type: String,
            enum: Object.values(VerificationStatus),
            default: VerificationStatus.NOT_SUBMITTED,
        },
        profilePhotoUrl: {
            type: String,
            default: '',
            trim: true,
        },
        profilePhotoStatus: {
            type: String,
            enum: Object.values(VerificationStatus),
            default: VerificationStatus.NOT_SUBMITTED,
        },
    },
    banking: {
        accountHolder: {
            type: String,
            default: '',
            trim: true,
        },
        bankName: {
            type: String,
            default: '',
            trim: true,
        },
        accountNumberLast4: {
            type: String,
            default: '',
            trim: true,
            maxlength: 4,
        },
        payoutEnabled: {
            type: Boolean,
            default: false,
        },
    },
    stats: {
        averageRating: {
            type: Number,
            default: 0,
            min: 0,
            max: 5,
        },
        completedJobs: {
            type: Number,
            default: 0,
            min: 0,
        },
        cancelledJobs: {
            type: Number,
            default: 0,
            min: 0,
        },
        lifetimeEarningsMinor: {
            type: Number,
            default: 0,
            min: 0,
        },
    },
    availability: {
        isOnline: {
            type: Boolean,
            default: false,
            index: true,
        },
        acceptsEmergencyJobs: {
            type: Boolean,
            default: false,
        },
        lastSeenAt: {
            type: Date,
            default: null,
        },
    },
    lastLocation: {
        type: LocationSchema,
        default: null,
    },
    review: {
        reviewedAt: {
            type: Date,
            default: null,
        },
        reviewedBy: {
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        rejectionReason: {
            type: String,
            default: '',
            trim: true,
        },
        suspensionReason: {
            type: String,
            default: '',
            trim: true,
        },
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
}, { timestamps: true });
TechnicianSchema.virtual('stats.lifetimeEarnings').get(function () {
    return this.stats.lifetimeEarningsMinor / 100;
});
TechnicianSchema.set('toJSON', { virtuals: true });
TechnicianSchema.set('toObject', { virtuals: true });
TechnicianSchema.index({ lastLocation: '2dsphere' });
TechnicianSchema.index({ approvalStatus: 1, 'availability.isOnline': 1 });
TechnicianSchema.index({ countryCode: 1, city: 1, approvalStatus: 1 });
TechnicianSchema.index({ serviceCategories: 1, approvalStatus: 1 });
TechnicianSchema.index({ 'stats.averageRating': -1 });
TechnicianSchema.index({ createdAt: -1 });
const TechnicianModel = mongoose_1.default.models.Technician ??
    mongoose_1.default.model('Technician', TechnicianSchema);
exports.default = TechnicianModel;
//# sourceMappingURL=technician.model.js.map