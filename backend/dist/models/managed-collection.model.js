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
exports.ManagedCollectionProfileStatus = exports.ManagedCollectionDay = exports.ManagedCollectionFrequency = exports.ManagedCollectionBinColor = exports.ManagedCollectionType = exports.ManagedCollectionPropertyType = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var ManagedCollectionPropertyType;
(function (ManagedCollectionPropertyType) {
    ManagedCollectionPropertyType["HOUSE"] = "HOUSE";
    ManagedCollectionPropertyType["APARTMENT"] = "APARTMENT";
    ManagedCollectionPropertyType["ESTATE"] = "ESTATE";
    ManagedCollectionPropertyType["COMMERCIAL"] = "COMMERCIAL";
    ManagedCollectionPropertyType["INDUSTRIAL"] = "INDUSTRIAL";
})(ManagedCollectionPropertyType || (exports.ManagedCollectionPropertyType = ManagedCollectionPropertyType = {}));
var ManagedCollectionType;
(function (ManagedCollectionType) {
    ManagedCollectionType["GENERAL_WASTE"] = "GENERAL_WASTE";
    ManagedCollectionType["RECYCLING"] = "RECYCLING";
    ManagedCollectionType["ORGANIC_WASTE"] = "ORGANIC_WASTE";
    ManagedCollectionType["GARDEN_WASTE"] = "GARDEN_WASTE";
    ManagedCollectionType["MEDICAL_WASTE"] = "MEDICAL_WASTE";
    ManagedCollectionType["COMMERCIAL_WASTE"] = "COMMERCIAL_WASTE";
    ManagedCollectionType["CONSTRUCTION_WASTE"] = "CONSTRUCTION_WASTE";
    ManagedCollectionType["E_WASTE"] = "E_WASTE";
    ManagedCollectionType["BULK_WASTE"] = "BULK_WASTE";
})(ManagedCollectionType || (exports.ManagedCollectionType = ManagedCollectionType = {}));
var ManagedCollectionBinColor;
(function (ManagedCollectionBinColor) {
    ManagedCollectionBinColor["RED"] = "RED";
    ManagedCollectionBinColor["GREEN"] = "GREEN";
    ManagedCollectionBinColor["BLUE"] = "BLUE";
})(ManagedCollectionBinColor || (exports.ManagedCollectionBinColor = ManagedCollectionBinColor = {}));
var ManagedCollectionFrequency;
(function (ManagedCollectionFrequency) {
    ManagedCollectionFrequency["WEEKLY"] = "WEEKLY";
    ManagedCollectionFrequency["TWICE_WEEKLY"] = "TWICE_WEEKLY";
    ManagedCollectionFrequency["MONTHLY"] = "MONTHLY";
})(ManagedCollectionFrequency || (exports.ManagedCollectionFrequency = ManagedCollectionFrequency = {}));
var ManagedCollectionDay;
(function (ManagedCollectionDay) {
    ManagedCollectionDay["MONDAY"] = "MONDAY";
    ManagedCollectionDay["TUESDAY"] = "TUESDAY";
    ManagedCollectionDay["WEDNESDAY"] = "WEDNESDAY";
    ManagedCollectionDay["THURSDAY"] = "THURSDAY";
    ManagedCollectionDay["FRIDAY"] = "FRIDAY";
    ManagedCollectionDay["SATURDAY"] = "SATURDAY";
    ManagedCollectionDay["SUNDAY"] = "SUNDAY";
})(ManagedCollectionDay || (exports.ManagedCollectionDay = ManagedCollectionDay = {}));
var ManagedCollectionProfileStatus;
(function (ManagedCollectionProfileStatus) {
    ManagedCollectionProfileStatus["ACTIVE"] = "ACTIVE";
    ManagedCollectionProfileStatus["PAUSED"] = "PAUSED";
    ManagedCollectionProfileStatus["CANCELLED"] = "CANCELLED";
})(ManagedCollectionProfileStatus || (exports.ManagedCollectionProfileStatus = ManagedCollectionProfileStatus = {}));
const ManagedCollectionProfileSchema = new mongoose_1.Schema({
    customerId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    customerName: {
        type: String,
        default: 'Client',
        trim: true,
    },
    customerEmail: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
    },
    customerPhone: {
        type: String,
        default: '',
        trim: true,
    },
    countryCode: {
        type: String,
        required: true,
        uppercase: true,
        trim: true,
        index: true,
    },
    city: {
        type: String,
        required: true,
        trim: true,
        index: true,
    },
    area: {
        type: String,
        default: '',
        trim: true,
        index: true,
    },
    fullAddress: {
        type: String,
        required: true,
        trim: true,
    },
    propertyType: {
        type: String,
        enum: Object.values(ManagedCollectionPropertyType),
        required: true,
    },
    collectionType: {
        type: String,
        enum: Object.values(ManagedCollectionType),
        default: ManagedCollectionType.GENERAL_WASTE,
        required: true,
    },
    binPackage: {
        type: [String],
        enum: Object.values(ManagedCollectionBinColor),
        default: [ManagedCollectionBinColor.RED, ManagedCollectionBinColor.GREEN, ManagedCollectionBinColor.BLUE],
    },
    frequency: {
        type: String,
        enum: Object.values(ManagedCollectionFrequency),
        required: true,
    },
    preferredCollectionDay: {
        type: String,
        enum: Object.values(ManagedCollectionDay),
        required: true,
    },
    nextCollectionDate: {
        type: Date,
        required: true,
        index: true,
    },
    status: {
        type: String,
        enum: Object.values(ManagedCollectionProfileStatus),
        default: ManagedCollectionProfileStatus.ACTIVE,
        index: true,
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
}, { timestamps: true });
ManagedCollectionProfileSchema.index({ countryCode: 1, city: 1, area: 1, status: 1 });
ManagedCollectionProfileSchema.index({ customerId: 1, collectionType: 1, status: 1 });
const ManagedCollectionProfile = mongoose_1.default.models.ManagedCollectionProfile ??
    mongoose_1.default.model('ManagedCollectionProfile', ManagedCollectionProfileSchema);
exports.default = ManagedCollectionProfile;
//# sourceMappingURL=managed-collection.model.js.map