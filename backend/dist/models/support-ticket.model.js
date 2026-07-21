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
exports.SupportTicketEscalationStatus = exports.SupportTicketPriority = exports.SupportTicketRequesterType = exports.SupportTicketStatus = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const user_model_1 = require("./user.model");
var SupportTicketStatus;
(function (SupportTicketStatus) {
    SupportTicketStatus["OPEN"] = "OPEN";
    SupportTicketStatus["PENDING"] = "PENDING";
    SupportTicketStatus["RESOLVED"] = "RESOLVED";
})(SupportTicketStatus || (exports.SupportTicketStatus = SupportTicketStatus = {}));
var SupportTicketRequesterType;
(function (SupportTicketRequesterType) {
    SupportTicketRequesterType["CUSTOMER"] = "CUSTOMER";
    SupportTicketRequesterType["TECHNICIAN"] = "TECHNICIAN";
})(SupportTicketRequesterType || (exports.SupportTicketRequesterType = SupportTicketRequesterType = {}));
var SupportTicketPriority;
(function (SupportTicketPriority) {
    SupportTicketPriority["NORMAL"] = "NORMAL";
    SupportTicketPriority["HIGH"] = "HIGH";
    SupportTicketPriority["URGENT"] = "URGENT";
})(SupportTicketPriority || (exports.SupportTicketPriority = SupportTicketPriority = {}));
var SupportTicketEscalationStatus;
(function (SupportTicketEscalationStatus) {
    SupportTicketEscalationStatus["NONE"] = "NONE";
    SupportTicketEscalationStatus["ESCALATED"] = "ESCALATED";
})(SupportTicketEscalationStatus || (exports.SupportTicketEscalationStatus = SupportTicketEscalationStatus = {}));
const SupportTicketSchema = new mongoose_1.Schema({
    ticketNumber: {
        type: String,
        required: true,
        trim: true,
        unique: true,
        index: true,
    },
    requesterId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    requesterType: {
        type: String,
        enum: Object.values(SupportTicketRequesterType),
        required: true,
        index: true,
    },
    requesterRole: {
        type: String,
        enum: [user_model_1.UserRole.CUSTOMER, user_model_1.UserRole.TECHNICIAN],
        required: true,
        index: true,
    },
    bookingId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Booking',
        default: null,
        index: true,
    },
    subject: {
        type: String,
        required: true,
        trim: true,
        maxlength: 160,
    },
    category: {
        type: String,
        default: 'GENERAL',
        trim: true,
        uppercase: true,
        maxlength: 60,
        index: true,
    },
    status: {
        type: String,
        enum: Object.values(SupportTicketStatus),
        default: SupportTicketStatus.OPEN,
        index: true,
    },
    priority: {
        type: String,
        enum: Object.values(SupportTicketPriority),
        default: SupportTicketPriority.NORMAL,
        index: true,
    },
    assignedAgentId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
        index: true,
    },
    escalationStatus: {
        type: String,
        enum: Object.values(SupportTicketEscalationStatus),
        default: SupportTicketEscalationStatus.NONE,
        index: true,
    },
    escalatedAt: {
        type: Date,
        default: null,
        index: true,
    },
    escalatedByAgentId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    escalationReason: {
        type: String,
        default: '',
        trim: true,
        maxlength: 240,
    },
    firstResponseDueAt: {
        type: Date,
        default: null,
        index: true,
    },
    firstResponseAt: {
        type: Date,
        default: null,
        index: true,
    },
    nextResponseDueAt: {
        type: Date,
        default: null,
        index: true,
    },
    lastMessageAt: {
        type: Date,
        default: null,
        index: true,
    },
    resolvedAt: {
        type: Date,
        default: null,
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
}, { timestamps: true });
SupportTicketSchema.index({ requesterId: 1, status: 1, updatedAt: -1 });
SupportTicketSchema.index({ status: 1, priority: 1, updatedAt: -1 });
SupportTicketSchema.index({ assignedAgentId: 1, status: 1, updatedAt: -1 });
SupportTicketSchema.index({ escalationStatus: 1, priority: 1, updatedAt: -1 });
SupportTicketSchema.index({ firstResponseDueAt: 1, status: 1 });
const SupportTicket = mongoose_1.default.models.SupportTicket ??
    mongoose_1.default.model('SupportTicket', SupportTicketSchema);
exports.default = SupportTicket;
//# sourceMappingURL=support-ticket.model.js.map