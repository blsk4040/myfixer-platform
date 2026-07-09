"use strict";
// backend/src/models/booking.model.ts
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
exports.Booking = exports.BookingDispatchStatus = exports.BookingCancellationBy = exports.BookingStatus = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const market_config_1 = require("../config/market.config");
var BookingStatus;
(function (BookingStatus) {
    BookingStatus["PENDING"] = "PENDING";
    BookingStatus["SCHEDULED"] = "SCHEDULED";
    BookingStatus["ACCEPTED"] = "ACCEPTED";
    BookingStatus["IN_ROUTE"] = "IN_ROUTE";
    BookingStatus["ARRIVED"] = "ARRIVED";
    BookingStatus["DIAGNOSTIC_DONE"] = "DIAGNOSTIC_DONE";
    BookingStatus["COMPLETED"] = "COMPLETED";
    BookingStatus["CANCELLED"] = "CANCELLED";
})(BookingStatus || (exports.BookingStatus = BookingStatus = {}));
var BookingCancellationBy;
(function (BookingCancellationBy) {
    BookingCancellationBy["CUSTOMER"] = "CUSTOMER";
    BookingCancellationBy["TECHNICIAN"] = "TECHNICIAN";
    BookingCancellationBy["ADMIN"] = "ADMIN";
    BookingCancellationBy["SYSTEM"] = "SYSTEM";
})(BookingCancellationBy || (exports.BookingCancellationBy = BookingCancellationBy = {}));
var BookingDispatchStatus;
(function (BookingDispatchStatus) {
    BookingDispatchStatus["BROADCASTING"] = "BROADCASTING";
    BookingDispatchStatus["STANDBY"] = "STANDBY";
    BookingDispatchStatus["SCHEDULED"] = "SCHEDULED";
    BookingDispatchStatus["ACCEPTED"] = "ACCEPTED";
    BookingDispatchStatus["EXPIRED"] = "EXPIRED";
    BookingDispatchStatus["CANCELLED"] = "CANCELLED";
})(BookingDispatchStatus || (exports.BookingDispatchStatus = BookingDispatchStatus = {}));
const FinalBillingSchema = new mongoose_1.Schema({
    baseAmountMinor: {
        type: Number,
        default: 0,
        min: 0,
    },
    additionalLaborMinor: {
        type: Number,
        default: 0,
        min: 0,
    },
    partsAmountMinor: {
        type: Number,
        default: 0,
        min: 0,
    },
    totalAmountMinor: {
        type: Number,
        default: 0,
        min: 0,
    },
    proofPhoto: {
        type: String,
        default: '',
        trim: true,
    },
    notes: {
        type: String,
        default: '',
        trim: true,
    },
}, { _id: false });
const CancellationSchema = new mongoose_1.Schema({
    cancelledBy: {
        type: String,
        enum: Object.values(BookingCancellationBy),
        required: true,
    },
    reason: {
        type: String,
        required: true,
        trim: true,
    },
    note: {
        type: String,
        default: '',
        trim: true,
    },
}, { _id: false });
const AppointmentWindowSchema = new mongoose_1.Schema({
    isPreBook: {
        type: Boolean,
        default: false,
        index: true,
    },
    scheduledStartTime: {
        type: Date,
        default: null,
        index: true,
    },
    scheduledEndTime: {
        type: Date,
        default: null,
    },
}, { _id: false });
const DispatchSchema = new mongoose_1.Schema({
    status: {
        type: String,
        enum: Object.values(BookingDispatchStatus),
        default: BookingDispatchStatus.BROADCASTING,
        index: true,
    },
    expiresAt: {
        type: Date,
        default: null,
        index: true,
    },
    sentToTechnicians: {
        type: [mongoose_1.Schema.Types.ObjectId],
        ref: 'User',
        default: [],
    },
    declinedByTechnicians: {
        type: [mongoose_1.Schema.Types.ObjectId],
        ref: 'User',
        default: [],
    },
    acceptedByTechnician: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
}, { _id: false });
const BookingSchema = new mongoose_1.Schema({
    customerId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    customerName: {
        type: String,
        default: 'Client',
        trim: true,
    },
    customerEmail: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        index: true,
    },
    technicianId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
        index: true,
    },
    technicianName: {
        type: String,
        default: '',
        trim: true,
    },
    serviceKey: {
        type: String,
        trim: true,
        lowercase: true,
        index: true,
    },
    applianceType: {
        type: String,
        required: true,
        trim: true,
        index: true,
    },
    faultDescription: {
        type: String,
        default: 'No description provided.',
        trim: true,
    },
    customerLocation: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point',
            required: true,
        },
        coordinates: {
            type: [Number],
            required: true,
            validate: {
                validator(value) {
                    return Array.isArray(value) && value.length === 2;
                },
                message: 'Coordinates must contain [longitude, latitude]',
            },
        },
    },
    fullAddress: {
        type: String,
        required: true,
        trim: true,
    },
    complexDetails: {
        type: String,
        default: '',
        trim: true,
    },
    generalArea: {
        type: String,
        default: 'Local Area',
        trim: true,
        index: true,
    },
    priceMinor: {
        type: Number,
        required: true,
        min: 0,
        default: 0,
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
        index: true,
    },
    status: {
        type: String,
        enum: Object.values(BookingStatus),
        default: BookingStatus.PENDING,
        index: true,
    },
    finalBilling: {
        type: FinalBillingSchema,
        default: undefined,
    },
    appointmentWindow: {
        type: AppointmentWindowSchema,
        default: undefined,
    },
    acceptedAt: {
        type: Date,
        default: null,
    },
    inRouteAt: {
        type: Date,
        default: null,
    },
    arrivedAt: {
        type: Date,
        default: null,
    },
    diagnosticDoneAt: {
        type: Date,
        default: null,
    },
    completedAt: {
        type: Date,
        default: null,
    },
    cancelledAt: {
        type: Date,
        default: null,
    },
    cancellation: {
        type: CancellationSchema,
        default: undefined,
    },
    dispatch: {
        type: DispatchSchema,
        default: undefined,
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
// --- Virtuals ---
BookingSchema.virtual('price').get(function () {
    return this.priceMinor / 100;
});
BookingSchema.virtual('finalBillingAmounts').get(function () {
    if (!this.finalBilling)
        return null;
    return {
        baseAmount: this.finalBilling.baseAmountMinor / 100,
        additionalLabor: this.finalBilling.additionalLaborMinor / 100,
        partsAmount: this.finalBilling.partsAmountMinor / 100,
        totalAmount: this.finalBilling.totalAmountMinor / 100,
    };
});
// --- Indexes ---
BookingSchema.index({ customerLocation: '2dsphere' });
BookingSchema.index({ status: 1, createdAt: -1 });
BookingSchema.index({ customerId: 1, createdAt: -1 });
BookingSchema.index({ technicianId: 1, status: 1 });
BookingSchema.index({ technicianId: 1, 'appointmentWindow.scheduledStartTime': 1 });
BookingSchema.index({ countryCode: 1, status: 1 });
BookingSchema.index({ countryCode: 1, serviceKey: 1, status: 1 });
BookingSchema.index({ generalArea: 1, status: 1 });
BookingSchema.index({ status: 1, 'dispatch.expiresAt': 1 });
BookingSchema.index({ 'dispatch.declinedByTechnicians': 1 });
exports.Booking = mongoose_1.default.models.Booking ??
    mongoose_1.default.model('Booking', BookingSchema);
exports.default = exports.Booking;
//# sourceMappingURL=booking.model.js.map