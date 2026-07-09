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
exports.JobMediaPurpose = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var JobMediaPurpose;
(function (JobMediaPurpose) {
    JobMediaPurpose["CHAT"] = "CHAT";
    JobMediaPurpose["BEFORE_WORK"] = "BEFORE_WORK";
    JobMediaPurpose["AFTER_WORK"] = "AFTER_WORK";
    JobMediaPurpose["PROOF_OF_COMPLETION"] = "PROOF_OF_COMPLETION";
    JobMediaPurpose["QUOTE_PART"] = "QUOTE_PART";
    JobMediaPurpose["DISPUTE"] = "DISPUTE";
})(JobMediaPurpose || (exports.JobMediaPurpose = JobMediaPurpose = {}));
const JobMediaSchema = new mongoose_1.Schema({
    bookingId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Booking',
        required: true,
        index: true,
    },
    customerId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    technicianId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
        index: true,
    },
    uploadedByUserId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    uploadedByRole: {
        type: String,
        required: true,
        trim: true,
    },
    mediaType: {
        type: String,
        enum: ['IMAGE'],
        default: 'IMAGE',
    },
    purpose: {
        type: String,
        enum: Object.values(JobMediaPurpose),
        default: JobMediaPurpose.CHAT,
        index: true,
    },
    storageProvider: {
        type: String,
        enum: ['cloudinary'],
        default: 'cloudinary',
    },
    storageKey: {
        type: String,
        required: true,
        trim: true,
    },
    url: {
        type: String,
        required: true,
        trim: true,
    },
    thumbnailUrl: {
        type: String,
        default: '',
        trim: true,
    },
    mimeType: {
        type: String,
        default: 'image/jpeg',
        trim: true,
    },
    fileName: {
        type: String,
        default: '',
        trim: true,
    },
    fileSize: {
        type: Number,
        default: 0,
        min: 0,
    },
    width: {
        type: Number,
        default: 0,
        min: 0,
    },
    height: {
        type: Number,
        default: 0,
        min: 0,
    },
    retentionExpiresAt: {
        type: Date,
        required: true,
        index: true,
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
}, { timestamps: true });
JobMediaSchema.index({ bookingId: 1, purpose: 1, createdAt: -1 });
const JobMedia = mongoose_1.default.models.JobMedia ??
    mongoose_1.default.model('JobMedia', JobMediaSchema);
exports.default = JobMedia;
//# sourceMappingURL=job-media.model.js.map