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
exports.SupportMessageType = exports.SupportMessageSenderType = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var SupportMessageSenderType;
(function (SupportMessageSenderType) {
    SupportMessageSenderType["CUSTOMER"] = "CUSTOMER";
    SupportMessageSenderType["TECHNICIAN"] = "TECHNICIAN";
    SupportMessageSenderType["AGENT"] = "AGENT";
    SupportMessageSenderType["SYSTEM"] = "SYSTEM";
})(SupportMessageSenderType || (exports.SupportMessageSenderType = SupportMessageSenderType = {}));
var SupportMessageType;
(function (SupportMessageType) {
    SupportMessageType["TEXT"] = "TEXT";
    SupportMessageType["SYSTEM"] = "SYSTEM";
})(SupportMessageType || (exports.SupportMessageType = SupportMessageType = {}));
const ReadReceiptSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    readAt: {
        type: Date,
        default: Date.now,
    },
}, { _id: false });
const SupportMessageSchema = new mongoose_1.Schema({
    ticketId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'SupportTicket',
        required: true,
        index: true,
    },
    senderId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
        index: true,
    },
    senderType: {
        type: String,
        enum: Object.values(SupportMessageSenderType),
        required: true,
        index: true,
    },
    messageType: {
        type: String,
        enum: Object.values(SupportMessageType),
        default: SupportMessageType.TEXT,
        index: true,
    },
    text: {
        type: String,
        required: true,
        trim: true,
        maxlength: 4000,
    },
    internal: {
        type: Boolean,
        default: false,
        index: true,
    },
    readBy: {
        type: [ReadReceiptSchema],
        default: [],
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
}, { timestamps: true });
SupportMessageSchema.index({ ticketId: 1, createdAt: 1 });
SupportMessageSchema.index({ ticketId: 1, internal: 1, createdAt: 1 });
const SupportMessage = mongoose_1.default.models.SupportMessage ??
    mongoose_1.default.model('SupportMessage', SupportMessageSchema);
exports.default = SupportMessage;
//# sourceMappingURL=support-message.model.js.map