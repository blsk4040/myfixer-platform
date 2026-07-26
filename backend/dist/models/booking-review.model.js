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
exports.BookingReviewStatus = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var BookingReviewStatus;
(function (BookingReviewStatus) {
    BookingReviewStatus["PUBLISHED"] = "PUBLISHED";
    BookingReviewStatus["HIDDEN"] = "HIDDEN";
})(BookingReviewStatus || (exports.BookingReviewStatus = BookingReviewStatus = {}));
const BookingReviewSchema = new mongoose_1.Schema({
    bookingId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Booking',
        required: true,
        unique: true,
        index: true,
    },
    customerId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    technicianId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    serviceKey: {
        type: String,
        default: '',
        trim: true,
        index: true,
    },
    serviceName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 160,
    },
    countryCode: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
        maxlength: 2,
        index: true,
    },
    city: {
        type: String,
        default: '',
        trim: true,
        maxlength: 120,
        index: true,
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
    },
    professional: {
        type: Boolean,
        required: true,
    },
    onTime: {
        type: Boolean,
        required: true,
    },
    qualityWork: {
        type: Boolean,
        required: true,
    },
    communication: {
        type: Boolean,
        required: true,
    },
    comment: {
        type: String,
        default: '',
        trim: true,
        maxlength: 1200,
    },
    wouldBookAgain: {
        type: Boolean,
        default: true,
    },
    status: {
        type: String,
        enum: Object.values(BookingReviewStatus),
        default: BookingReviewStatus.PUBLISHED,
        index: true,
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
}, { timestamps: true });
BookingReviewSchema.index({ customerId: 1, createdAt: -1 });
BookingReviewSchema.index({ technicianId: 1, status: 1, createdAt: -1 });
BookingReviewSchema.index({ countryCode: 1, city: 1, serviceKey: 1, status: 1 });
exports.default = mongoose_1.default.model('BookingReview', BookingReviewSchema);
//# sourceMappingURL=booking-review.model.js.map