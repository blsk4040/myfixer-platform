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
exports.refreshProviderReputationStats = exports.getProviderReputation = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const booking_model_1 = __importStar(require("../models/booking.model"));
const booking_review_model_1 = __importStar(require("../models/booking-review.model"));
const technician_model_1 = __importDefault(require("../models/technician.model"));
const toObjectId = (value) => value instanceof mongoose_1.default.Types.ObjectId ? value : new mongoose_1.default.Types.ObjectId(String(value));
const getProviderReputation = (profile) => {
    const reviewCount = Number(profile?.stats?.reviewCount || 0);
    const averageRating = reviewCount > 0 ? Number(profile?.stats?.averageRating || 0) : null;
    return {
        averageRating,
        reviewCount,
        completedJobs: Number(profile?.stats?.completedJobs || 0),
        verified: profile?.approvalStatus === 'APPROVED',
    };
};
exports.getProviderReputation = getProviderReputation;
const refreshProviderReputationStats = async (providerUserId) => {
    const technicianId = toObjectId(providerUserId);
    const [reviewSummary, completedJobs] = await Promise.all([
        booking_review_model_1.default.aggregate([
            { $match: { technicianId, status: booking_review_model_1.BookingReviewStatus.PUBLISHED } },
            {
                $group: {
                    _id: '$technicianId',
                    averageRating: { $avg: '$rating' },
                    reviewCount: { $sum: 1 },
                },
            },
        ]),
        booking_model_1.default.countDocuments({
            technicianId,
            status: booking_model_1.BookingStatus.COMPLETED,
        }),
    ]);
    const summary = reviewSummary[0];
    const stats = {
        averageRating: summary ? Number(Number(summary.averageRating || 0).toFixed(2)) : 0,
        reviewCount: summary ? Number(summary.reviewCount || 0) : 0,
        completedJobs,
    };
    const updated = await technician_model_1.default.findOneAndUpdate({ userId: technicianId }, {
        $set: {
            'stats.averageRating': stats.averageRating,
            'stats.reviewCount': stats.reviewCount,
            'stats.completedJobs': stats.completedJobs,
        },
    }, { new: true }).lean();
    return (0, exports.getProviderReputation)(updated || { stats });
};
exports.refreshProviderReputationStats = refreshProviderReputationStats;
//# sourceMappingURL=provider-reputation.service.js.map