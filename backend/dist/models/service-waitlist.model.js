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
exports.ServiceWaitlistSource = exports.ServiceWaitlistStatus = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var ServiceWaitlistStatus;
(function (ServiceWaitlistStatus) {
    ServiceWaitlistStatus["WAITING"] = "WAITING";
    ServiceWaitlistStatus["NOTIFIED"] = "NOTIFIED";
    ServiceWaitlistStatus["CONVERTED"] = "CONVERTED";
})(ServiceWaitlistStatus || (exports.ServiceWaitlistStatus = ServiceWaitlistStatus = {}));
var ServiceWaitlistSource;
(function (ServiceWaitlistSource) {
    ServiceWaitlistSource["CLIENT_APP"] = "CLIENT_APP";
    ServiceWaitlistSource["ADMIN_PORTAL"] = "ADMIN_PORTAL";
    ServiceWaitlistSource["API"] = "API";
})(ServiceWaitlistSource || (exports.ServiceWaitlistSource = ServiceWaitlistSource = {}));
const ServiceWaitlistSchema = new mongoose_1.Schema({
    customerId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
    },
    phone: {
        type: String,
        default: '',
        trim: true,
    },
    countryCode: {
        type: String,
        required: true,
        uppercase: true,
        trim: true,
    },
    city: {
        type: String,
        required: true,
        trim: true,
    },
    area: {
        type: String,
        default: '',
        trim: true,
    },
    serviceKey: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            required: true,
        },
        coordinates: {
            type: [Number],
            required: true,
            validate: {
                validator(value) {
                    return Array.isArray(value) && value.length === 2;
                },
                message: 'Waitlist coordinates must contain [longitude, latitude]',
            },
        },
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
    status: {
        type: String,
        enum: Object.values(ServiceWaitlistStatus),
        default: ServiceWaitlistStatus.WAITING,
    },
    source: {
        type: String,
        enum: Object.values(ServiceWaitlistSource),
        default: ServiceWaitlistSource.CLIENT_APP,
    },
}, { timestamps: true });
ServiceWaitlistSchema.index({ email: 1, countryCode: 1, city: 1, area: 1, serviceKey: 1 }, { unique: true });
ServiceWaitlistSchema.index({ countryCode: 1, city: 1, area: 1, serviceKey: 1, status: 1 });
ServiceWaitlistSchema.index({ customerId: 1 });
ServiceWaitlistSchema.index({ location: '2dsphere' });
const ServiceWaitlist = mongoose_1.default.models.ServiceWaitlist ??
    mongoose_1.default.model('ServiceWaitlist', ServiceWaitlistSchema);
exports.default = ServiceWaitlist;
//# sourceMappingURL=service-waitlist.model.js.map