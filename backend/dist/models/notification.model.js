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
exports.NotificationType = exports.NotificationStatus = exports.NotificationChannel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var NotificationChannel;
(function (NotificationChannel) {
    NotificationChannel["IN_APP"] = "IN_APP";
    NotificationChannel["EMAIL"] = "EMAIL";
    NotificationChannel["PUSH"] = "PUSH";
    NotificationChannel["SMS"] = "SMS";
    NotificationChannel["WHATSAPP"] = "WHATSAPP";
})(NotificationChannel || (exports.NotificationChannel = NotificationChannel = {}));
var NotificationStatus;
(function (NotificationStatus) {
    NotificationStatus["PENDING"] = "PENDING";
    NotificationStatus["SCHEDULED"] = "SCHEDULED";
    NotificationStatus["SENT"] = "SENT";
    NotificationStatus["FAILED"] = "FAILED";
    NotificationStatus["CANCELLED"] = "CANCELLED";
    NotificationStatus["READ"] = "READ";
    NotificationStatus["ARCHIVED"] = "ARCHIVED";
})(NotificationStatus || (exports.NotificationStatus = NotificationStatus = {}));
var NotificationType;
(function (NotificationType) {
    NotificationType["COLLECTION_REMINDER"] = "COLLECTION_REMINDER";
    NotificationType["COLLECTION_TODAY"] = "COLLECTION_TODAY";
    NotificationType["COLLECTION_MISSED"] = "COLLECTION_MISSED";
    NotificationType["COLLECTION_RESCHEDULED"] = "COLLECTION_RESCHEDULED";
    NotificationType["COLLECTION_CANCELLED"] = "COLLECTION_CANCELLED";
    NotificationType["SYSTEM"] = "SYSTEM";
})(NotificationType || (exports.NotificationType = NotificationType = {}));
const NotificationSchema = new mongoose_1.Schema({
    recipient: {
        userId: {
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'User',
            index: true,
        },
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
        name: {
            type: String,
            default: '',
            trim: true,
        },
    },
    channel: {
        type: String,
        enum: Object.values(NotificationChannel),
        required: true,
        index: true,
    },
    type: {
        type: String,
        required: true,
        trim: true,
        index: true,
    },
    title: {
        type: String,
        required: true,
        trim: true,
    },
    message: {
        type: String,
        required: true,
        trim: true,
    },
    status: {
        type: String,
        enum: Object.values(NotificationStatus),
        default: NotificationStatus.PENDING,
        index: true,
    },
    scheduledAt: {
        type: Date,
        default: Date.now,
        index: true,
    },
    sentAt: {
        type: Date,
        default: null,
    },
    readAt: {
        type: Date,
        default: null,
    },
    archivedAt: {
        type: Date,
        default: null,
    },
    cancelledAt: {
        type: Date,
        default: null,
    },
    retryCount: {
        type: Number,
        default: 0,
        min: 0,
    },
    nextRetryAt: {
        type: Date,
        default: null,
    },
    lastError: {
        type: String,
        default: '',
        trim: true,
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
}, { timestamps: true });
NotificationSchema.index({ 'recipient.userId': 1, status: 1, createdAt: -1 });
NotificationSchema.index({ status: 1, scheduledAt: 1 });
NotificationSchema.index({ channel: 1, status: 1, scheduledAt: 1 });
NotificationSchema.index({ type: 1, createdAt: -1 });
const Notification = mongoose_1.default.models.Notification ??
    mongoose_1.default.model('Notification', NotificationSchema);
exports.default = Notification;
//# sourceMappingURL=notification.model.js.map