"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Booking = exports.CurrencyCode = exports.BookingStatus = void 0;
// backend/src/models/booking.model.ts
const mongoose_1 = require("mongoose");
var BookingStatus;
(function (BookingStatus) {
    BookingStatus["PENDING"] = "PENDING";
    BookingStatus["ACCEPTED"] = "ACCEPTED";
    BookingStatus["IN_ROUTE"] = "IN_ROUTE";
    BookingStatus["ARRIVED"] = "ARRIVED";
    BookingStatus["DIAGNOSTIC_DONE"] = "DIAGNOSTIC_DONE";
    BookingStatus["COMPLETED"] = "COMPLETED";
    BookingStatus["CANCELLED"] = "CANCELLED";
})(BookingStatus || (exports.BookingStatus = BookingStatus = {}));
var CurrencyCode;
(function (CurrencyCode) {
    CurrencyCode["ZAR"] = "ZAR";
    CurrencyCode["GHS"] = "GHS";
})(CurrencyCode || (exports.CurrencyCode = CurrencyCode = {}));
const BookingSchema = new mongoose_1.Schema({
    customerId: {
        type: String,
        required: true,
        trim: true
    },
    customerName: {
        type: String,
        default: 'Client',
        trim: true
    },
    customerEmail: {
        type: String,
        required: true,
        default: 'client@myfixer.co.za', // Fallback context matching default rules
        trim: true
    },
    technicianId: {
        type: String,
        default: null
    },
    applianceType: {
        type: String,
        required: true,
        trim: true
    },
    faultDescription: {
        type: String,
        default: 'No description provided.',
        trim: true
    },
    customerLocation: {
        type: {
            type: String,
            enum: ['Point'],
            required: true
        },
        coordinates: {
            type: [Number],
            required: true,
            validate: {
                validator: (value) => value.length === 2,
                message: 'Coordinates must contain [longitude, latitude]'
            }
        }
    },
    fullAddress: {
        type: String,
        required: true,
        trim: true
    },
    complexDetails: {
        type: String,
        default: '',
        trim: true
    },
    generalArea: {
        type: String,
        default: 'Local Area',
        trim: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        enum: Object.values(CurrencyCode),
        default: CurrencyCode.ZAR
    },
    status: {
        type: String,
        enum: Object.values(BookingStatus),
        default: BookingStatus.PENDING
    },
    finalBilling: {
        baseAmount: { type: Number, default: 450 },
        additionalLabor: { type: Number, default: 0 },
        partsAmount: { type: Number, default: 0 },
        totalAmount: { type: Number, default: 450 },
        proofPhoto: { type: String, default: '' }
    },
    acceptedAt: {
        type: Date,
        default: null
    },
    completedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});
BookingSchema.index({
    customerLocation: '2dsphere'
});
exports.Booking = (0, mongoose_1.model)('Booking', BookingSchema);
exports.default = exports.Booking;
//# sourceMappingURL=booking.model.js.map