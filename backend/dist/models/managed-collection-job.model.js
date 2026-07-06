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
exports.ManagedCollectionJobStatus = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const managed_collection_model_1 = require("./managed-collection.model");
var ManagedCollectionJobStatus;
(function (ManagedCollectionJobStatus) {
    ManagedCollectionJobStatus["SCHEDULED"] = "SCHEDULED";
    ManagedCollectionJobStatus["ASSIGNED"] = "ASSIGNED";
    ManagedCollectionJobStatus["IN_PROGRESS"] = "IN_PROGRESS";
    ManagedCollectionJobStatus["COMPLETED"] = "COMPLETED";
    ManagedCollectionJobStatus["MISSED"] = "MISSED";
    ManagedCollectionJobStatus["CANCELLED"] = "CANCELLED";
})(ManagedCollectionJobStatus || (exports.ManagedCollectionJobStatus = ManagedCollectionJobStatus = {}));
const CollectionHistorySchema = new mongoose_1.Schema({
    collectionDate: {
        type: Date,
        required: true,
    },
    completedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
    },
    notes: {
        type: String,
        default: '',
        trim: true,
    },
    photos: {
        type: [String],
        default: [],
    },
    missedReason: {
        type: String,
        default: '',
        trim: true,
    },
    status: {
        type: String,
        enum: Object.values(ManagedCollectionJobStatus),
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
}, { _id: false });
const ManagedCollectionJobSchema = new mongoose_1.Schema({
    profileId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'ManagedCollectionProfile',
        required: true,
        index: true,
    },
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
    collectionType: {
        type: String,
        enum: Object.values(managed_collection_model_1.ManagedCollectionType),
        required: true,
        index: true,
    },
    binPackage: {
        type: [String],
        enum: Object.values(managed_collection_model_1.ManagedCollectionBinColor),
        default: [],
    },
    frequency: {
        type: String,
        enum: Object.values(managed_collection_model_1.ManagedCollectionFrequency),
        required: true,
    },
    preferredCollectionDay: {
        type: String,
        required: true,
        trim: true,
        index: true,
    },
    scheduledFor: {
        type: Date,
        required: true,
        index: true,
    },
    completedAt: {
        type: Date,
        default: null,
    },
    assignedTo: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    status: {
        type: String,
        enum: Object.values(ManagedCollectionJobStatus),
        default: ManagedCollectionJobStatus.SCHEDULED,
        index: true,
    },
    notes: {
        type: String,
        default: '',
        trim: true,
    },
    missedReason: {
        type: String,
        default: '',
        trim: true,
    },
    photos: {
        type: [String],
        default: [],
    },
    history: {
        type: [CollectionHistorySchema],
        default: [],
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
}, { timestamps: true });
ManagedCollectionJobSchema.index({ scheduledFor: 1, status: 1 });
ManagedCollectionJobSchema.index({ countryCode: 1, city: 1, area: 1, scheduledFor: 1 });
ManagedCollectionJobSchema.index({ profileId: 1, scheduledFor: 1 }, { unique: true });
const ManagedCollectionJob = mongoose_1.default.models.ManagedCollectionJob ??
    mongoose_1.default.model('ManagedCollectionJob', ManagedCollectionJobSchema);
exports.default = ManagedCollectionJob;
//# sourceMappingURL=managed-collection-job.model.js.map