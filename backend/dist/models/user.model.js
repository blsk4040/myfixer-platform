"use strict";
// src/models/user.model.ts
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
exports.normalizeUserRole = exports.AccountStatus = exports.AdminPermission = exports.AdminRole = exports.UserRole = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const market_config_1 = require("../config/market.config");
var UserRole;
(function (UserRole) {
    UserRole["CUSTOMER"] = "CUSTOMER";
    UserRole["TECHNICIAN"] = "TECHNICIAN";
    UserRole["ADMIN"] = "ADMIN";
})(UserRole || (exports.UserRole = UserRole = {}));
var AdminRole;
(function (AdminRole) {
    AdminRole["SUPER_ADMIN"] = "SUPER_ADMIN";
    AdminRole["OPERATIONS_MANAGER"] = "OPERATIONS_MANAGER";
    AdminRole["DISPATCHER"] = "DISPATCHER";
    AdminRole["FINANCE_ADMIN"] = "FINANCE_ADMIN";
    AdminRole["SUPPORT_AGENT"] = "SUPPORT_AGENT";
    AdminRole["TECHNICIAN_REVIEWER"] = "TECHNICIAN_REVIEWER";
    AdminRole["MARKET_MANAGER"] = "MARKET_MANAGER";
    AdminRole["READ_ONLY_ADMIN"] = "READ_ONLY_ADMIN";
})(AdminRole || (exports.AdminRole = AdminRole = {}));
var AdminPermission;
(function (AdminPermission) {
    AdminPermission["OVERVIEW_READ"] = "overview.read";
    AdminPermission["BOOKINGS_READ"] = "bookings.read";
    AdminPermission["BOOKINGS_UPDATE"] = "bookings.update";
    AdminPermission["TECHNICIANS_READ"] = "technicians.read";
    AdminPermission["TECHNICIANS_REVIEW"] = "technicians.review";
    AdminPermission["FINANCE_READ"] = "finance.read";
    AdminPermission["MARKETS_READ"] = "markets.read";
    AdminPermission["MARKETS_UPDATE"] = "markets.update";
    AdminPermission["ADMINS_READ"] = "admins.read";
    AdminPermission["ADMINS_CREATE"] = "admins.create";
    AdminPermission["ADMINS_UPDATE"] = "admins.update";
    AdminPermission["SETTINGS_READ"] = "settings.read";
})(AdminPermission || (exports.AdminPermission = AdminPermission = {}));
var AccountStatus;
(function (AccountStatus) {
    AccountStatus["ACTIVE"] = "ACTIVE";
    AccountStatus["SUSPENDED"] = "SUSPENDED";
    AccountStatus["DEACTIVATED"] = "DEACTIVATED";
    AccountStatus["PENDING_VERIFICATION"] = "PENDING_VERIFICATION";
})(AccountStatus || (exports.AccountStatus = AccountStatus = {}));
const normalizeUserRole = (role) => {
    if (typeof role !== 'string')
        return UserRole.CUSTOMER;
    const normalized = role.trim().toUpperCase();
    if (normalized === 'CLIENT' || normalized === 'CUSTOMER')
        return UserRole.CUSTOMER;
    if (normalized === 'TECH' || normalized === 'TECHNICIAN')
        return UserRole.TECHNICIAN;
    if (normalized === 'ADMIN' || normalized === 'SUPER_ADMIN')
        return UserRole.ADMIN;
    return UserRole.CUSTOMER;
};
exports.normalizeUserRole = normalizeUserRole;
const DefaultServiceAddressSchema = new mongoose_1.Schema({
    streetAddress: {
        type: String,
        default: '',
        trim: true,
    },
    suburb: {
        type: String,
        default: '',
        trim: true,
    },
    city: {
        type: String,
        default: '',
        trim: true,
    },
    postalCode: {
        type: String,
        default: '',
        trim: true,
    },
    countryCode: {
        type: String,
        enum: Object.values(market_config_1.CountryCode),
        default: market_config_1.CountryCode.ZA,
    },
    fullAddress: {
        type: String,
        default: '',
        trim: true,
    },
    coordinates: {
        type: {
            type: String,
            enum: ['Point'],
        },
        coordinates: {
            type: [Number],
            validate: {
                validator(value) {
                    return value === undefined || (Array.isArray(value) && value.length === 2 && value.every((item) => Number.isFinite(item)));
                },
                message: 'Default service address coordinates must be [longitude, latitude].',
            },
            default: undefined,
        },
    },
    updatedAt: {
        type: Date,
        default: null,
    },
}, { _id: false });
const UserSchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        index: true,
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
    },
    phone: {
        type: String,
        required: true,
        trim: true,
    },
    profilePhotoUrl: {
        type: String,
        default: '',
        trim: true,
    },
    location: {
        country: {
            type: String,
            default: 'South Africa',
            trim: true,
        },
        city: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        area: {
            type: String,
            default: '',
            trim: true,
        },
    },
    defaultServiceAddress: {
        type: DefaultServiceAddressSchema,
        default: null,
    },
    profileCompleted: {
        type: Boolean,
        default: true,
        index: true,
    },
    countryCode: {
        type: String,
        enum: Object.values(market_config_1.CountryCode),
        default: market_config_1.CountryCode.ZA,
        index: true,
    },
    currency: {
        type: String,
        enum: Object.values(market_config_1.CurrencyCode),
        default: market_config_1.CurrencyCode.ZAR,
    },
    password: {
        type: String,
        required: true,
        minlength: 6,
        select: false,
    },
    role: {
        type: String,
        enum: Object.values(UserRole),
        default: UserRole.CUSTOMER,
        index: true,
    },
    adminRole: {
        type: String,
        enum: Object.values(AdminRole),
        default: undefined,
        index: true,
    },
    adminPermissions: {
        type: [String],
        enum: Object.values(AdminPermission),
        default: [],
    },
    accountStatus: {
        type: String,
        enum: Object.values(AccountStatus),
        default: AccountStatus.ACTIVE,
        index: true,
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true,
    },
    emailVerified: {
        type: Boolean,
        default: false,
        index: true,
    },
    isEmailVerified: {
        type: Boolean,
        default: false,
        index: true,
    },
    emailVerificationToken: {
        type: String,
        default: '',
        select: false,
        index: true,
    },
    phoneVerified: {
        type: Boolean,
        default: false,
        index: true,
    },
    lastLoginAt: {
        type: Date,
        default: null,
    },
    lastPasswordChangeAt: {
        type: Date,
        default: null,
    },
    passwordResetTokenHash: {
        type: String,
        default: '',
        select: false,
    },
    passwordResetExpiresAt: {
        type: Date,
        default: null,
        select: false,
    },
    refreshTokenVersion: {
        type: Number,
        default: 0,
        min: 0,
        select: false,
    },
    createdBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
    },
    updatedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
}, { timestamps: true });
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ phone: 1 });
UserSchema.index({ role: 1, accountStatus: 1 });
UserSchema.index({ countryCode: 1, role: 1 });
UserSchema.index({ 'location.city': 1, role: 1 });
UserSchema.index({ adminRole: 1, role: 1 });
const UserModel = mongoose_1.default.models.User ??
    mongoose_1.default.model('User', UserSchema);
exports.default = UserModel;
//# sourceMappingURL=user.model.js.map