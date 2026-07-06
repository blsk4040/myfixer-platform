"use strict";
// src/models/auditLog.model.ts
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
exports.AuditAction = exports.AuditModule = exports.AuditSeverity = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var AuditSeverity;
(function (AuditSeverity) {
    AuditSeverity["INFO"] = "INFO";
    AuditSeverity["WARNING"] = "WARNING";
    AuditSeverity["ERROR"] = "ERROR";
    AuditSeverity["CRITICAL"] = "CRITICAL";
})(AuditSeverity || (exports.AuditSeverity = AuditSeverity = {}));
var AuditModule;
(function (AuditModule) {
    AuditModule["AUTH"] = "AUTH";
    AuditModule["BOOKINGS"] = "BOOKINGS";
    AuditModule["TECHNICIANS"] = "TECHNICIANS";
    AuditModule["CUSTOMERS"] = "CUSTOMERS";
    AuditModule["PAYMENTS"] = "PAYMENTS";
    AuditModule["WALLET"] = "WALLET";
    AuditModule["MARKET"] = "MARKET";
    AuditModule["ADMIN"] = "ADMIN";
    AuditModule["SUPPORT"] = "SUPPORT";
    AuditModule["NOTIFICATIONS"] = "NOTIFICATIONS";
})(AuditModule || (exports.AuditModule = AuditModule = {}));
var AuditAction;
(function (AuditAction) {
    AuditAction["LOGIN"] = "LOGIN";
    AuditAction["LOGOUT"] = "LOGOUT";
    AuditAction["CREATE"] = "CREATE";
    AuditAction["UPDATE"] = "UPDATE";
    AuditAction["DELETE"] = "DELETE";
    AuditAction["ASSIGN"] = "ASSIGN";
    AuditAction["ACCEPT"] = "ACCEPT";
    AuditAction["CANCEL"] = "CANCEL";
    AuditAction["COMPLETE"] = "COMPLETE";
    AuditAction["PAYMENT"] = "PAYMENT";
    AuditAction["CASHOUT"] = "CASHOUT";
    AuditAction["SYSTEM_EVENT"] = "SYSTEM_EVENT";
})(AuditAction || (exports.AuditAction = AuditAction = {}));
const AuditLogSchema = new mongoose_1.Schema({
    actor: {
        id: {
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'User',
        },
        email: {
            type: String,
            default: '',
            trim: true,
            lowercase: true,
        },
        role: {
            type: String,
            default: '',
            trim: true,
        },
    },
    event: {
        action: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        module: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        resourceType: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        resourceId: {
            type: String,
            default: '',
            trim: true,
            index: true,
        },
        severity: {
            type: String,
            enum: Object.values(AuditSeverity),
            default: AuditSeverity.INFO,
            index: true,
        },
    },
    request: {
        ipAddress: {
            type: String,
            default: '',
            trim: true,
        },
        device: {
            type: String,
            default: '',
            trim: true,
        },
        platform: {
            type: String,
            default: '',
            trim: true,
        },
        appVersion: {
            type: String,
            default: '',
            trim: true,
        },
        userAgent: {
            type: String,
            default: '',
            trim: true,
        },
    },
    changes: {
        before: {
            type: mongoose_1.Schema.Types.Mixed,
        },
        after: {
            type: mongoose_1.Schema.Types.Mixed,
        },
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
    success: {
        type: Boolean,
        default: true,
        index: true,
    },
}, { timestamps: true });
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ 'actor.id': 1, createdAt: -1 });
AuditLogSchema.index({ 'actor.email': 1, createdAt: -1 });
AuditLogSchema.index({ 'event.module': 1, createdAt: -1 });
AuditLogSchema.index({ 'event.action': 1, createdAt: -1 });
AuditLogSchema.index({ 'event.resourceType': 1, 'event.resourceId': 1 });
AuditLogSchema.index({ success: 1, createdAt: -1 });
const AuditLogModel = mongoose_1.default.models.AuditLog ??
    mongoose_1.default.model('AuditLog', AuditLogSchema);
exports.default = AuditLogModel;
//# sourceMappingURL=audit-log.model.js.map