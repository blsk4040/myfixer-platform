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
exports.Booking = exports.CompletionStatus = exports.BookingPaymentStatus = exports.WorkAuthorizationStatus = exports.InspectionStatus = exports.PricingMode = exports.BookingRecipientType = exports.BookingDispatchStatus = exports.BookingCancellationBy = exports.BookingStatus = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const market_config_1 = require("../config/market.config");
var BookingStatus;
(function (BookingStatus) {
    BookingStatus["PENDING"] = "PENDING";
    BookingStatus["SCHEDULED"] = "SCHEDULED";
    BookingStatus["ACCEPTED"] = "ACCEPTED";
    BookingStatus["IN_ROUTE"] = "IN_ROUTE";
    BookingStatus["ARRIVED"] = "ARRIVED";
    BookingStatus["IN_PROGRESS"] = "IN_PROGRESS";
    /** Legacy work-stage status retained while existing bookings are migrated. */
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
var BookingRecipientType;
(function (BookingRecipientType) {
    BookingRecipientType["SELF"] = "SELF";
    BookingRecipientType["OTHER"] = "OTHER";
})(BookingRecipientType || (exports.BookingRecipientType = BookingRecipientType = {}));
var PricingMode;
(function (PricingMode) {
    PricingMode["FIXED_PRICE"] = "FIXED_PRICE";
    PricingMode["INSPECTION_AND_QUOTE"] = "INSPECTION_AND_QUOTE";
})(PricingMode || (exports.PricingMode = PricingMode = {}));
var InspectionStatus;
(function (InspectionStatus) {
    InspectionStatus["NOT_STARTED"] = "NOT_STARTED";
    InspectionStatus["IN_PROGRESS"] = "IN_PROGRESS";
    InspectionStatus["COMPLETED"] = "COMPLETED";
    InspectionStatus["NOT_REQUIRED"] = "NOT_REQUIRED";
})(InspectionStatus || (exports.InspectionStatus = InspectionStatus = {}));
var WorkAuthorizationStatus;
(function (WorkAuthorizationStatus) {
    WorkAuthorizationStatus["BLOCKED"] = "BLOCKED";
    WorkAuthorizationStatus["AWAITING_INSPECTION"] = "AWAITING_INSPECTION";
    WorkAuthorizationStatus["AWAITING_QUOTE"] = "AWAITING_QUOTE";
    WorkAuthorizationStatus["AWAITING_QUOTE_APPROVAL"] = "AWAITING_QUOTE_APPROVAL";
    WorkAuthorizationStatus["AWAITING_PAYMENT"] = "AWAITING_PAYMENT";
    WorkAuthorizationStatus["AUTHORIZED"] = "AUTHORIZED";
})(WorkAuthorizationStatus || (exports.WorkAuthorizationStatus = WorkAuthorizationStatus = {}));
var BookingPaymentStatus;
(function (BookingPaymentStatus) {
    BookingPaymentStatus["NOT_REQUIRED"] = "NOT_REQUIRED";
    BookingPaymentStatus["PENDING"] = "PENDING";
    BookingPaymentStatus["SECURED"] = "SECURED";
    BookingPaymentStatus["FAILED"] = "FAILED";
    BookingPaymentStatus["UNDER_REVIEW"] = "UNDER_REVIEW";
    BookingPaymentStatus["REFUNDED"] = "REFUNDED";
})(BookingPaymentStatus || (exports.BookingPaymentStatus = BookingPaymentStatus = {}));
var CompletionStatus;
(function (CompletionStatus) {
    CompletionStatus["NOT_SUBMITTED"] = "NOT_SUBMITTED";
    CompletionStatus["PROVIDER_SUBMITTED"] = "PROVIDER_SUBMITTED";
    CompletionStatus["CUSTOMER_CONFIRMATION_PENDING"] = "CUSTOMER_CONFIRMATION_PENDING";
    CompletionStatus["CUSTOMER_CONFIRMED"] = "CUSTOMER_CONFIRMED";
    CompletionStatus["ISSUE_REPORTED"] = "ISSUE_REPORTED";
    CompletionStatus["AUTO_CONFIRMED"] = "AUTO_CONFIRMED";
    CompletionStatus["ADMIN_CONFIRMED"] = "ADMIN_CONFIRMED";
})(CompletionStatus || (exports.CompletionStatus = CompletionStatus = {}));
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
const ServiceRecipientSchema = new mongoose_1.Schema({
    type: {
        type: String,
        enum: Object.values(BookingRecipientType),
        default: BookingRecipientType.SELF,
        index: true,
    },
    fullName: {
        type: String,
        default: '',
        trim: true,
        maxlength: 120,
    },
    phoneNumber: {
        type: String,
        default: '',
        trim: true,
        maxlength: 40,
    },
    relationship: {
        type: String,
        default: '',
        trim: true,
        maxlength: 80,
    },
    email: {
        type: String,
        default: '',
        trim: true,
        lowercase: true,
        maxlength: 254,
    },
    countryCode: {
        type: String,
        default: '',
        trim: true,
        maxlength: 10,
    },
    country: {
        type: String,
        default: '',
        trim: true,
        maxlength: 120,
    },
    city: {
        type: String,
        default: '',
        trim: true,
        maxlength: 120,
    },
    streetAddress: {
        type: String,
        default: '',
        trim: true,
        maxlength: 240,
    },
    notes: {
        type: String,
        default: '',
        trim: true,
        maxlength: 1000,
    },
}, { _id: false });
const InspectionPointSchema = new mongoose_1.Schema({
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
    accuracyMeters: {
        type: Number,
        min: 0,
        default: undefined,
    },
}, { _id: false });
const InspectionPartSchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120,
    },
    quantity: {
        type: Number,
        min: 0,
        default: undefined,
    },
    notes: {
        type: String,
        default: '',
        trim: true,
        maxlength: 500,
    },
}, { _id: false });
const BookingInspectionSchema = new mongoose_1.Schema({
    status: {
        type: String,
        enum: Object.values(InspectionStatus),
        default: InspectionStatus.NOT_STARTED,
        index: true,
    },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    startedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', default: null },
    completedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', default: null },
    reminderAcknowledgedAt: { type: Date, default: null },
    reminderAcknowledgedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', default: null },
    startLocation: { type: InspectionPointSchema, default: undefined },
    completionLocation: { type: InspectionPointSchema, default: undefined },
    diagnosisNotes: { type: String, default: '', trim: true, maxlength: 4000 },
    technicalObservations: { type: String, default: '', trim: true, maxlength: 4000 },
    partsRequired: { type: [InspectionPartSchema], default: [] },
    quoteRequired: { type: Boolean, default: undefined },
    evidenceMediaIds: { type: [mongoose_1.Schema.Types.ObjectId], ref: 'JobMedia', default: [] },
}, { _id: false });
const WorkAuthorizationSchema = new mongoose_1.Schema({
    status: {
        type: String,
        enum: Object.values(WorkAuthorizationStatus),
        default: WorkAuthorizationStatus.AWAITING_INSPECTION,
        index: true,
    },
    reasonCode: { type: String, default: '', trim: true, maxlength: 80 },
    requirements: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    evaluatedAt: { type: Date, default: null },
}, { _id: false });
const BookingPaymentSecuritySchema = new mongoose_1.Schema({
    securedAt: { type: Date, default: null },
    transactionId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'PaymentTransaction', default: null },
    provider: { type: String, default: '', trim: true },
    reference: { type: String, default: '', trim: true, index: true },
    amountMinor: { type: Number, min: 0, default: 0 },
    currency: { type: String, enum: Object.values(market_config_1.CurrencyCode), default: undefined },
    verifiedAt: { type: Date, default: null },
}, { _id: false });
const BookingCompletionPartSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true, maxlength: 120 },
    quantity: { type: Number, min: 0, default: undefined },
    amountMinor: { type: Number, min: 0, default: undefined },
    notes: { type: String, default: '', trim: true, maxlength: 500 },
}, { _id: false });
const BookingCompletionSchema = new mongoose_1.Schema({
    status: {
        type: String,
        enum: Object.values(CompletionStatus),
        default: CompletionStatus.NOT_SUBMITTED,
        index: true,
    },
    submittedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', default: null },
    submittedAt: { type: Date, default: null },
    completionNotes: { type: String, default: '', trim: true, maxlength: 4000 },
    partsUsed: { type: [BookingCompletionPartSchema], default: [] },
    evidenceMediaIds: { type: [mongoose_1.Schema.Types.ObjectId], ref: 'JobMedia', default: [] },
    finalAmountMinor: { type: Number, min: 0, default: 0 },
    currency: { type: String, enum: Object.values(market_config_1.CurrencyCode), default: undefined },
    customerConfirmedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', default: null },
    customerConfirmedAt: { type: Date, default: null },
    issueReportedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', default: null },
    issueReportedAt: { type: Date, default: null },
    issueReason: { type: String, default: '', trim: true, maxlength: 2000 },
    autoConfirmEligibleAt: { type: Date, default: null },
    autoConfirmedAt: { type: Date, default: null },
    adminConfirmedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', default: null },
    adminConfirmedAt: { type: Date, default: null },
    adminNote: { type: String, default: '', trim: true, maxlength: 1000 },
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
    serviceRecipient: {
        type: ServiceRecipientSchema,
        default: undefined,
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
    pricingMode: {
        type: String,
        enum: Object.values(PricingMode),
        default: PricingMode.INSPECTION_AND_QUOTE,
        index: true,
    },
    paymentStatus: {
        type: String,
        enum: Object.values(BookingPaymentStatus),
        default: BookingPaymentStatus.PENDING,
        index: true,
    },
    paymentSecurity: {
        type: BookingPaymentSecuritySchema,
        default: undefined,
    },
    completion: {
        type: BookingCompletionSchema,
        default: undefined,
    },
    workAuthorization: {
        type: WorkAuthorizationSchema,
        default: undefined,
    },
    inspection: {
        type: BookingInspectionSchema,
        default: undefined,
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
    scheduledAt: {
        type: Date,
        default: null,
        index: true,
    },
    acceptedAt: {
        type: Date,
        default: null,
    },
    inRouteAt: {
        type: Date,
        default: null,
    },
    routeStartedAt: {
        type: Date,
        default: null,
    },
    arrivedAt: {
        type: Date,
        default: null,
    },
    inProgressAt: {
        type: Date,
        default: null,
    },
    workStartedAt: {
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
BookingSchema.index({ status: 1, 'inspection.status': 1 });
BookingSchema.index({ status: 1, 'workAuthorization.status': 1 });
BookingSchema.index({ status: 1, 'completion.status': 1 });
exports.Booking = mongoose_1.default.models.Booking ??
    mongoose_1.default.model('Booking', BookingSchema);
exports.default = exports.Booking;
//# sourceMappingURL=booking.model.js.map