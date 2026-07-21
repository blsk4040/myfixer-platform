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
exports.requireAdminPermission = exports.requireRole = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_model_1 = __importStar(require("../models/user.model"));
const ADMIN_ROLE_PERMISSIONS = {
    [user_model_1.AdminRole.SUPER_ADMIN]: Object.values(user_model_1.AdminPermission),
    [user_model_1.AdminRole.OPERATIONS_MANAGER]: [
        user_model_1.AdminPermission.OVERVIEW_READ,
        user_model_1.AdminPermission.BOOKINGS_READ,
        user_model_1.AdminPermission.BOOKINGS_UPDATE,
        user_model_1.AdminPermission.TECHNICIANS_READ,
        user_model_1.AdminPermission.CLIENTS_CONTACT_READ,
        user_model_1.AdminPermission.SETTINGS_READ,
    ],
    [user_model_1.AdminRole.DISPATCHER]: [
        user_model_1.AdminPermission.OVERVIEW_READ,
        user_model_1.AdminPermission.BOOKINGS_READ,
        user_model_1.AdminPermission.BOOKINGS_UPDATE,
    ],
    [user_model_1.AdminRole.FINANCE_ADMIN]: [
        user_model_1.AdminPermission.OVERVIEW_READ,
        user_model_1.AdminPermission.FINANCE_READ,
        user_model_1.AdminPermission.PROMOTIONS_READ,
        user_model_1.AdminPermission.PROMOTIONS_CREATE,
        user_model_1.AdminPermission.PROMOTIONS_UPDATE,
        user_model_1.AdminPermission.PROMOTIONS_ACTIVATE,
        user_model_1.AdminPermission.PROMOTIONS_PAUSE,
        user_model_1.AdminPermission.PROMOTIONS_ARCHIVE,
        user_model_1.AdminPermission.PROMOTIONS_PERFORMANCE_READ,
        user_model_1.AdminPermission.PROMOTIONS_REDEMPTIONS_READ,
        user_model_1.AdminPermission.SETTINGS_READ,
    ],
    [user_model_1.AdminRole.SUPPORT_AGENT]: [
        user_model_1.AdminPermission.OVERVIEW_READ,
        user_model_1.AdminPermission.BOOKINGS_READ,
        user_model_1.AdminPermission.TECHNICIANS_READ,
        user_model_1.AdminPermission.CLIENTS_CONTACT_READ,
        user_model_1.AdminPermission.SUPPORT_READ,
        user_model_1.AdminPermission.SUPPORT_REPLY,
        user_model_1.AdminPermission.SUPPORT_UPDATE,
    ],
    [user_model_1.AdminRole.TECHNICIAN_REVIEWER]: [
        user_model_1.AdminPermission.OVERVIEW_READ,
        user_model_1.AdminPermission.TECHNICIANS_READ,
        user_model_1.AdminPermission.TECHNICIANS_REVIEW,
    ],
    [user_model_1.AdminRole.MARKET_MANAGER]: [
        user_model_1.AdminPermission.OVERVIEW_READ,
        user_model_1.AdminPermission.MARKETS_READ,
        user_model_1.AdminPermission.MARKETS_UPDATE,
        user_model_1.AdminPermission.SETTINGS_READ,
    ],
    [user_model_1.AdminRole.READ_ONLY_ADMIN]: [
        user_model_1.AdminPermission.OVERVIEW_READ,
        user_model_1.AdminPermission.BOOKINGS_READ,
        user_model_1.AdminPermission.TECHNICIANS_READ,
        user_model_1.AdminPermission.FINANCE_READ,
        user_model_1.AdminPermission.PROMOTIONS_READ,
        user_model_1.AdminPermission.MARKETS_READ,
        user_model_1.AdminPermission.ADMINS_READ,
        user_model_1.AdminPermission.SETTINGS_READ,
    ],
};
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        res.status(500).json({ message: 'JWT secret is not configured' });
        return;
    }
    if (!authHeader) {
        res.status(401).json({ message: 'No token provided' });
        return;
    }
    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) {
        res.status(401).json({ message: 'Invalid authorization header' });
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        if (!decoded || typeof decoded !== 'object') {
            res.status(403).json({ message: 'Invalid token' });
            return;
        }
        const payload = decoded;
        const userId = payload._id ?? payload.id;
        if (!userId) {
            res.status(403).json({ message: 'Invalid token payload' });
            return;
        }
        const user = await user_model_1.default.findById(userId).select('role isActive accountStatus +refreshTokenVersion');
        if (!user || user.isActive === false) {
            res.status(403).json({ message: 'This account session is no longer active.' });
            return;
        }
        const currentTokenVersion = Number(user.refreshTokenVersion || 0);
        const presentedTokenVersion = Number.isFinite(Number(payload.tokenVersion))
            ? Number(payload.tokenVersion)
            : 0;
        if (presentedTokenVersion !== currentTokenVersion) {
            res.status(401).json({ message: 'This session has expired. Please sign in again.' });
            return;
        }
        req.user = {
            ...payload,
            id: userId,
            _id: userId,
            role: (0, user_model_1.normalizeUserRole)(user.role || payload.role),
        };
        next();
    }
    catch (err) {
        res.status(403).json({ message: 'Invalid token' });
    }
};
exports.authenticateToken = authenticateToken;
const requireRole = (allowedRoles) => (req, res, next) => {
    const role = (0, user_model_1.normalizeUserRole)(req.user?.role);
    if (!allowedRoles.includes(role)) {
        res.status(403).json({ message: 'This account is not allowed to perform this action.' });
        return;
    }
    next();
};
exports.requireRole = requireRole;
const requireAdminPermission = (permission) => async (req, res, next) => {
    const authUser = req.user;
    const role = (0, user_model_1.normalizeUserRole)(authUser?.role);
    if (role !== user_model_1.UserRole.ADMIN || !authUser?.id) {
        res.status(403).json({ message: 'This portal is only available to internal admin staff.' });
        return;
    }
    const admin = await user_model_1.default.findById(authUser.id).select('role adminRole adminPermissions isActive accountStatus');
    if (!admin || admin.role !== user_model_1.UserRole.ADMIN || admin.isActive === false) {
        res.status(403).json({ message: 'This admin account is not active.' });
        return;
    }
    const adminRole = admin.adminRole || user_model_1.AdminRole.READ_ONLY_ADMIN;
    const allowed = new Set([
        ...(ADMIN_ROLE_PERMISSIONS[adminRole] || []),
        ...(admin.adminPermissions || []),
    ]);
    if (!allowed.has(permission)) {
        res.status(403).json({ message: 'You do not have permission to perform this action.' });
        return;
    }
    next();
};
exports.requireAdminPermission = requireAdminPermission;
//# sourceMappingURL=auth.middleware.js.map