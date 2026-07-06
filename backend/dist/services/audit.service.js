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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAuditEvent = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const audit_log_model_1 = __importStar(require("../models/audit-log.model"));
const getActor = (req) => (req.user || {});
const logAuditEvent = async (req, input) => {
    const actor = getActor(req);
    const actorId = actor.id ? String(actor.id) : '';
    await audit_log_model_1.default.create({
        actor: {
            id: actorId && mongoose_1.default.Types.ObjectId.isValid(actorId) ? new mongoose_1.default.Types.ObjectId(actorId) : undefined,
            email: actor.email || '',
            role: actor.role || '',
        },
        event: {
            action: input.action,
            module: input.module,
            resourceType: input.resourceType,
            resourceId: input.resourceId || '',
            severity: input.severity || audit_log_model_1.AuditSeverity.INFO,
        },
        request: {
            ipAddress: req.ip || '',
            device: '',
            platform: '',
            appVersion: '',
            userAgent: String(req.headers['user-agent'] || ''),
        },
        changes: input.changes || {},
        metadata: input.metadata || {},
        success: input.success ?? true,
    });
};
exports.logAuditEvent = logAuditEvent;
//# sourceMappingURL=audit.service.js.map