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
exports.handleAdminMarketScopeError = exports.assertAdminCountryAccess = exports.countryScopeFilter = exports.getAdminMarketScope = exports.AdminMarketScopeError = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const user_model_1 = __importStar(require("../models/user.model"));
class AdminMarketScopeError extends Error {
    statusCode = 403;
    code = 'ADMIN_MARKET_SCOPE_DENIED';
}
exports.AdminMarketScopeError = AdminMarketScopeError;
const normalizeCountryCode = (value) => typeof value === 'string' ? value.trim().toUpperCase() : '';
const authUserId = (req) => {
    const user = req.user;
    return String(user?.id ?? user?._id ?? '').trim();
};
const getAdminMarketScope = async (req, countryCodeOverride) => {
    const userId = authUserId(req);
    if (!mongoose_1.default.Types.ObjectId.isValid(userId))
        throw new AdminMarketScopeError('Admin identity is required.');
    const admin = await user_model_1.default.findOne({ _id: userId, role: user_model_1.UserRole.ADMIN, isActive: { $ne: false } })
        .select('adminRole countryCode')
        .lean();
    if (!admin)
        throw new AdminMarketScopeError('Admin account is not active.');
    const requestedCountryCode = normalizeCountryCode(countryCodeOverride ?? req.query.countryCode);
    const canViewAllMarkets = admin.adminRole === user_model_1.AdminRole.SUPER_ADMIN;
    const adminCountryCode = normalizeCountryCode(admin.countryCode);
    const allowedCountryCodes = canViewAllMarkets ? [] : [adminCountryCode].filter(Boolean);
    if (!canViewAllMarkets && !allowedCountryCodes.length) {
        throw new AdminMarketScopeError('This admin account is not assigned to a market.');
    }
    if (requestedCountryCode && !/^[A-Z]{2}$/.test(requestedCountryCode)) {
        throw new AdminMarketScopeError('Requested market is invalid.');
    }
    if (!canViewAllMarkets && requestedCountryCode && !allowedCountryCodes.includes(requestedCountryCode)) {
        throw new AdminMarketScopeError('You are not allowed to view this market.');
    }
    return {
        canViewAllMarkets,
        allowedCountryCodes,
        requestedCountryCode,
        effectiveCountryCodes: requestedCountryCode ? [requestedCountryCode] : allowedCountryCodes,
    };
};
exports.getAdminMarketScope = getAdminMarketScope;
const countryScopeFilter = (scope) => scope.effectiveCountryCodes.length ? { countryCode: { $in: scope.effectiveCountryCodes } } : {};
exports.countryScopeFilter = countryScopeFilter;
const assertAdminCountryAccess = async (req, countryCode) => {
    const requested = normalizeCountryCode(countryCode);
    const scope = await (0, exports.getAdminMarketScope)(req, requested);
    if (!scope.canViewAllMarkets && !scope.effectiveCountryCodes.includes(requested)) {
        throw new AdminMarketScopeError('You are not allowed to access this market.');
    }
};
exports.assertAdminCountryAccess = assertAdminCountryAccess;
const handleAdminMarketScopeError = (res, error) => {
    if (error instanceof AdminMarketScopeError) {
        res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
        return true;
    }
    return false;
};
exports.handleAdminMarketScopeError = handleAdminMarketScopeError;
//# sourceMappingURL=admin-market-scope.service.js.map