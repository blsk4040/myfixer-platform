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
exports.ChatMessageType = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var ChatMessageType;
(function (ChatMessageType) {
    ChatMessageType["TEXT"] = "TEXT";
    ChatMessageType["IMAGE"] = "IMAGE";
    ChatMessageType["SYSTEM"] = "SYSTEM";
})(ChatMessageType || (exports.ChatMessageType = ChatMessageType = {}));
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
const ChatMessageSchema = new mongoose_1.Schema({
    bookingId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Booking',
        required: true,
        index: true,
    },
    senderId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    senderRole: {
        type: String,
        enum: ['CUSTOMER', 'TECHNICIAN', 'ADMIN', 'SYSTEM'],
        required: true,
        index: true,
    },
    messageType: {
        type: String,
        enum: Object.values(ChatMessageType),
        default: ChatMessageType.TEXT,
        index: true,
    },
    text: {
        type: String,
        default: '',
        trim: true,
        maxlength: 2000,
    },
    mediaIds: {
        type: [mongoose_1.Schema.Types.ObjectId],
        ref: 'JobMedia',
        default: [],
    },
    readBy: {
        type: [ReadReceiptSchema],
        default: [],
    },
}, { timestamps: true });
ChatMessageSchema.index({ bookingId: 1, createdAt: 1 });
ChatMessageSchema.index({ bookingId: 1, senderId: 1, createdAt: -1 });
const ChatMessage = mongoose_1.default.models.ChatMessage ??
    mongoose_1.default.model('ChatMessage', ChatMessageSchema);
exports.default = ChatMessage;
//# sourceMappingURL=chat-message.model.js.map