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
exports.reviewTechnicianApplication = exports.getAvailableJobsForTechnician = exports.listTechnicianApplications = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const technician_model_1 = __importStar(require("../models/technician.model"));
const audit_service_1 = require("../services/audit.service");
const matching_service_1 = __importDefault(require("../services/matching.service"));
const isApprovalStatus = (value) => typeof value === 'string' &&
    Object.values(technician_model_1.TechnicianApprovalStatus).includes(value);
const listTechnicianApplications = async (_req, res) => {
    try {
        const technicians = await technician_model_1.default.find()
            .populate('userId', 'name email phone countryCode currency location')
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, technicians });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch technician applications.' });
    }
};
exports.listTechnicianApplications = listTechnicianApplications;
const getAvailableJobsForTechnician = async (req, res) => {
    const authUser = req.user;
    const technicianId = String(authUser?.id ?? authUser?._id ?? '').trim();
    if (!technicianId) {
        res.status(401).json({ message: 'Unauthorized. Technician identity missing.' });
        return;
    }
    try {
        const jobs = await matching_service_1.default.findNearbyPendingBookingsForTechnician(technicianId);
        await matching_service_1.default.markBookingsSentToTechnician(technicianId, jobs.map((job) => job.id));
        res.status(200).json({
            success: true,
            jobs: jobs.map((job) => ({
                bookingId: job.id,
                applianceType: job.applianceType,
                faultDescription: job.faultDescription,
                fullAddress: job.fullAddress,
                complexDetails: job.complexDetails,
                generalArea: job.generalArea,
                priceMinor: job.priceMinor,
                currency: job.currency,
                countryCode: job.countryCode,
                latitude: job.latitude,
                longitude: job.longitude,
                distanceKm: job.distanceKm,
                distanceText: `${job.distanceKm.toFixed(1)} km`,
                categoryMatch: job.categoryMatch,
            }))
        });
    }
    catch (error) {
        console.error('Failed to fetch available jobs for technician:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch nearby jobs.' });
    }
};
exports.getAvailableJobsForTechnician = getAvailableJobsForTechnician;
const reviewTechnicianApplication = async (req, res) => {
    const { id } = req.params;
    const body = req.body;
    const reviewerId = req.user?.id;
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        res.status(400).json({ message: 'Invalid technician id.' });
        return;
    }
    if (!isApprovalStatus(body.status)) {
        res.status(400).json({ message: 'Invalid technician review status.' });
        return;
    }
    try {
        const technician = await technician_model_1.default.findById(id);
        if (!technician) {
            res.status(404).json({ message: 'Technician application not found.' });
            return;
        }
        const before = {
            approvalStatus: technician.approvalStatus,
            review: technician.review,
        };
        technician.approvalStatus = body.status;
        technician.review.reviewedAt = new Date();
        technician.review.reviewedBy = mongoose_1.default.Types.ObjectId.isValid(reviewerId)
            ? new mongoose_1.default.Types.ObjectId(reviewerId)
            : null;
        const reviewReason = typeof body.rejectionReason === 'string' ? body.rejectionReason.trim() : '';
        technician.review.rejectionReason = body.status === technician_model_1.TechnicianApprovalStatus.REJECTED ? reviewReason : '';
        technician.review.suspensionReason = body.status === technician_model_1.TechnicianApprovalStatus.SUSPENDED ? reviewReason : '';
        await technician.save();
        await (0, audit_service_1.logAuditEvent)(req, {
            action: 'technician.review',
            module: 'TECHNICIANS',
            resourceType: 'Technician',
            resourceId: technician._id.toString(),
            changes: {
                before,
                after: {
                    approvalStatus: technician.approvalStatus,
                    review: technician.review,
                },
            },
            metadata: {
                status: body.status,
            },
        });
        res.status(200).json({ success: true, technician });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to review technician application.' });
    }
};
exports.reviewTechnicianApplication = reviewTechnicianApplication;
//# sourceMappingURL=technician.controller.js.map