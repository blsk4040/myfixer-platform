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
exports.ReminderStatus = exports.ReminderChannel = exports.ReminderType = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var ReminderType;
(function (ReminderType) {
    ReminderType["DAY_BEFORE_COLLECTION"] = "DAY_BEFORE_COLLECTION";
    ReminderType["COLLECTION_DAY"] = "COLLECTION_DAY";
})(ReminderType || (exports.ReminderType = ReminderType = {}));
var ReminderChannel;
(function (ReminderChannel) {
    ReminderChannel["IN_APP"] = "IN_APP";
    ReminderChannel["EMAIL"] = "EMAIL";
    ReminderChannel["SMS"] = "SMS";
    ReminderChannel["WHATSAPP"] = "WHATSAPP";
    ReminderChannel["PUSH"] = "PUSH";
})(ReminderChannel || (exports.ReminderChannel = ReminderChannel = {}));
var ReminderStatus;
(function (ReminderStatus) {
    ReminderStatus["PENDING"] = "PENDING";
    ReminderStatus["SENT"] = "SENT";
    ReminderStatus["FAILED"] = "FAILED";
    ReminderStatus["CANCELLED"] = "CANCELLED";
})(ReminderStatus || (exports.ReminderStatus = ReminderStatus = {}));
const NotificationReminderSchema = new mongoose_1.Schema({
    customerId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        index: true,
    },
    targetType: {
        type: String,
        required: true,
        trim: true,
        index: true,
    },
    targetId: {
        type: mongoose_1.Schema.Types.ObjectId,
        required: true,
        index: true,
    },
    reminderType: {
        type: String,
        enum: Object.values(ReminderType),
        required: true,
        index: true,
    },
    channels: {
        type: [String],
        enum: Object.values(ReminderChannel),
        default: [ReminderChannel.IN_APP],
    },
    status: {
        type: String,
        enum: Object.values(ReminderStatus),
        default: ReminderStatus.PENDING,
        index: true,
    },
    scheduledFor: {
        type: Date,
        required: true,
        index: true,
    },
    payload: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
    cancelledAt: {
        type: Date,
        default: null,
    },
    sentAt: {
        type: Date,
        default: null,
    },
    failureReason: {
        type: String,
        default: '',
        trim: true,
    },
}, { timestamps: true });
NotificationReminderSchema.index({ targetType: 1, targetId: 1, status: 1 });
NotificationReminderSchema.index({ scheduledFor: 1, status: 1 });
const NotificationReminder = mongoose_1.default.models.NotificationReminder ??
    mongoose_1.default.model('NotificationReminder', NotificationReminderSchema);
exports.default = NotificationReminder;
//# sourceMappingURL=notification-reminder.model.js.map