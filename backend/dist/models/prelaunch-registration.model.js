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
exports.PreLaunchRegistrationStatus = exports.PreLaunchRegistrationRole = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var PreLaunchRegistrationRole;
(function (PreLaunchRegistrationRole) {
    PreLaunchRegistrationRole["CUSTOMER"] = "CUSTOMER";
    PreLaunchRegistrationRole["PROFESSIONAL"] = "PROFESSIONAL";
})(PreLaunchRegistrationRole || (exports.PreLaunchRegistrationRole = PreLaunchRegistrationRole = {}));
var PreLaunchRegistrationStatus;
(function (PreLaunchRegistrationStatus) {
    PreLaunchRegistrationStatus["NEW"] = "NEW";
    PreLaunchRegistrationStatus["CONTACTED"] = "CONTACTED";
    PreLaunchRegistrationStatus["CONVERTED"] = "CONVERTED";
    PreLaunchRegistrationStatus["CLOSED"] = "CLOSED";
})(PreLaunchRegistrationStatus || (exports.PreLaunchRegistrationStatus = PreLaunchRegistrationStatus = {}));
const PreLaunchRegistrationSchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
        index: true,
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        maxlength: 254,
        index: true,
    },
    phone: {
        type: String,
        required: true,
        trim: true,
        maxlength: 30,
        index: true,
    },
    city: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
        index: true,
    },
    role: {
        type: String,
        enum: Object.values(PreLaunchRegistrationRole),
        required: true,
        index: true,
    },
    source: {
        type: String,
        required: true,
        trim: true,
        default: 'hellopadi-pre-launch',
        index: true,
    },
    status: {
        type: String,
        enum: Object.values(PreLaunchRegistrationStatus),
        default: PreLaunchRegistrationStatus.NEW,
        index: true,
    },
    contactedAt: {
        type: Date,
        default: null,
        index: true,
    },
    convertedAt: {
        type: Date,
        default: null,
        index: true,
    },
    closedAt: {
        type: Date,
        default: null,
    },
    notes: {
        type: String,
        default: '',
        trim: true,
        maxlength: 2000,
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
}, { timestamps: true });
PreLaunchRegistrationSchema.index({
    status: 1,
    createdAt: -1,
});
PreLaunchRegistrationSchema.index({
    role: 1,
    status: 1,
    createdAt: -1,
});
PreLaunchRegistrationSchema.index({
    city: 1,
    status: 1,
    createdAt: -1,
});
PreLaunchRegistrationSchema.index({
    email: 1,
    createdAt: -1,
});
// Prevent the same email from registering for the same role more than once.
PreLaunchRegistrationSchema.index({
    email: 1,
    role: 1,
}, {
    unique: true,
    name: 'prelaunch_email_role_unique',
});
const PreLaunchRegistration = mongoose_1.default.models.PreLaunchRegistration ??
    mongoose_1.default.model('PreLaunchRegistration', PreLaunchRegistrationSchema);
exports.default = PreLaunchRegistration;
//# sourceMappingURL=prelaunch-registration.model.js.map