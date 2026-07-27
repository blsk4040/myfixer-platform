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
exports.reviewTechnicianApplication = exports.reviewTechnicianProfilePhoto = exports.uploadMyTechnicianProfilePhoto = exports.getMyTechnicianJobs = exports.getAvailableJobsForTechnician = exports.listTechnicianApplications = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const booking_model_1 = __importStar(require("../models/booking.model"));
const quote_model_1 = __importDefault(require("../models/quote.model"));
const technician_model_1 = __importStar(require("../models/technician.model"));
const technician_capability_model_1 = __importStar(require("../models/technician-capability.model"));
const booking_privacy_service_1 = require("../services/booking-privacy.service");
const audit_service_1 = require("../services/audit.service");
const matching_service_1 = __importDefault(require("../services/matching.service"));
const user_model_1 = __importDefault(require("../models/user.model"));
const email_service_1 = require("../services/email/email.service");
const media_storage_service_1 = require("../services/media-storage.service");
const admin_market_scope_service_1 = require("../services/admin-market-scope.service");
const provider_reputation_service_1 = require("../services/provider-reputation.service");
const image_data_uri_1 = require("../utils/image-data-uri");
const MAX_TECHNICIAN_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024;
const isApprovalStatus = (value) => typeof value === 'string' &&
    Object.values(technician_model_1.TechnicianApprovalStatus).includes(value);
const isPhotoReviewStatus = (value) => value === technician_model_1.VerificationStatus.VERIFIED || value === technician_model_1.VerificationStatus.REJECTED;
const capabilityStatusForTechnicianReview = (status) => {
    if (status === technician_model_1.TechnicianApprovalStatus.APPROVED)
        return technician_capability_model_1.CapabilityStatus.APPROVED;
    if (status === technician_model_1.TechnicianApprovalStatus.REJECTED || status === technician_model_1.TechnicianApprovalStatus.SUSPENDED) {
        return technician_capability_model_1.CapabilityStatus.REJECTED;
    }
    return technician_capability_model_1.CapabilityStatus.PENDING;
};
const listTechnicianApplications = async (req, res) => {
    try {
        const scopeFilter = (0, admin_market_scope_service_1.countryScopeFilter)(await (0, admin_market_scope_service_1.getAdminMarketScope)(req));
        const technicians = await technician_model_1.default.find(scopeFilter)
            .populate('userId', 'name email phone countryCode currency location')
            .sort({ createdAt: -1 })
            .lean();
        const technicianIds = technicians.map((technician) => technician._id);
        const capabilities = await technician_capability_model_1.default.find({ technicianId: { $in: technicianIds } })
            .sort({ categorySlug: 1 })
            .lean();
        const capabilitiesByTechnician = capabilities.reduce((map, capability) => {
            const key = String(capability.technicianId);
            map[key] = map[key] || [];
            map[key].push(capability);
            return map;
        }, {});
        res.status(200).json({
            success: true,
            technicians: technicians.map((technician) => ({
                ...technician,
                capabilities: capabilitiesByTechnician[String(technician._id)] || [],
            })),
        });
    }
    catch (error) {
        if ((0, admin_market_scope_service_1.handleAdminMarketScopeError)(res, error))
            return;
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
        const acceptedFutureJobs = await booking_model_1.default.find({
            technicianId: new mongoose_1.default.Types.ObjectId(technicianId),
            status: { $in: [booking_model_1.BookingStatus.ACCEPTED, booking_model_1.BookingStatus.IN_ROUTE, booking_model_1.BookingStatus.ARRIVED, booking_model_1.BookingStatus.IN_PROGRESS, booking_model_1.BookingStatus.DIAGNOSTIC_DONE] },
            'appointmentWindow.isPreBook': true,
            'appointmentWindow.scheduledStartTime': { $gte: new Date() },
        })
            .select('applianceType faultDescription fullAddress complexDetails generalArea priceMinor currency countryCode appointmentWindow status customerName')
            .sort({ 'appointmentWindow.scheduledStartTime': 1 })
            .limit(100)
            .lean();
        res.status(200).json({
            success: true,
            jobs,
            acceptedFutureJobs: acceptedFutureJobs.map((job) => ({
                bookingId: job._id.toString(),
                customerName: job.customerName,
                applianceType: job.applianceType,
                faultDescription: job.faultDescription,
                fullAddress: job.fullAddress,
                complexDetails: job.complexDetails,
                generalArea: job.generalArea,
                priceMinor: job.priceMinor,
                currency: job.currency,
                countryCode: job.countryCode,
                appointmentWindow: job.appointmentWindow,
                status: job.status,
            })),
        });
    }
    catch (error) {
        console.error('Failed to fetch available jobs for technician:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch nearby jobs.' });
    }
};
exports.getAvailableJobsForTechnician = getAvailableJobsForTechnician;
const getMyTechnicianJobs = async (req, res) => {
    const authUser = req.user;
    const technicianId = String(authUser?.id ?? authUser?._id ?? '').trim();
    if (!technicianId || !mongoose_1.default.Types.ObjectId.isValid(technicianId)) {
        res.status(401).json({ message: 'Unauthorized. Technician identity missing.' });
        return;
    }
    try {
        const technicianObjectId = new mongoose_1.default.Types.ObjectId(technicianId);
        const now = new Date();
        const activeStatuses = [
            booking_model_1.BookingStatus.ACCEPTED,
            booking_model_1.BookingStatus.IN_ROUTE,
            booking_model_1.BookingStatus.ARRIVED,
            booking_model_1.BookingStatus.IN_PROGRESS,
            booking_model_1.BookingStatus.DIAGNOSTIC_DONE,
        ];
        const [activeJobs, scheduledJobs, completedJobs, technicianProfile] = await Promise.all([
            booking_model_1.default.find({
                technicianId: technicianObjectId,
                status: { $in: activeStatuses },
                $or: [
                    { 'appointmentWindow.isPreBook': { $ne: true } },
                    { 'appointmentWindow.scheduledStartTime': { $lte: now } },
                    { 'appointmentWindow.scheduledStartTime': null },
                ],
            })
                .sort({ acceptedAt: -1, updatedAt: -1 })
                .limit(100),
            booking_model_1.default.find({
                technicianId: technicianObjectId,
                $or: [
                    { status: booking_model_1.BookingStatus.SCHEDULED },
                    {
                        status: { $in: activeStatuses },
                        'appointmentWindow.isPreBook': true,
                        'appointmentWindow.scheduledStartTime': { $gt: now },
                    },
                ],
            })
                .sort({ 'appointmentWindow.scheduledStartTime': 1, scheduledAt: 1, updatedAt: -1 })
                .limit(100),
            booking_model_1.default.find({
                technicianId: technicianObjectId,
                status: booking_model_1.BookingStatus.COMPLETED,
            })
                .sort({ completedAt: -1, updatedAt: -1 })
                .limit(50),
            technician_model_1.default.findOne({ userId: technicianObjectId }).select('approvalStatus stats').lean(),
        ]);
        const allJobs = [...activeJobs, ...scheduledJobs, ...completedJobs];
        const bookingIds = allJobs.map((job) => job._id);
        const currentQuotes = await quote_model_1.default.find({ bookingId: { $in: bookingIds }, isCurrent: true })
            .select('bookingId status')
            .lean();
        const quoteStatusByBookingId = new Map(currentQuotes.map((quote) => [String(quote.bookingId), quote.status]));
        const serializeWithQuoteStatus = (booking) => ({
            ...(0, booking_privacy_service_1.serializeBookingForAssignedTechnician)(booking),
            quoteStatus: quoteStatusByBookingId.get(String(booking._id)) ?? 'NOT_REQUIRED',
        });
        res.status(200).json({
            success: true,
            activeJobs: activeJobs.map(serializeWithQuoteStatus),
            scheduledJobs: scheduledJobs.map(serializeWithQuoteStatus),
            completedJobs: completedJobs.map(serializeWithQuoteStatus),
            reputation: (0, provider_reputation_service_1.getProviderReputation)(technicianProfile),
        });
    }
    catch (error) {
        console.error('Failed to fetch technician jobs:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch technician jobs.' });
    }
};
exports.getMyTechnicianJobs = getMyTechnicianJobs;
const uploadMyTechnicianProfilePhoto = async (req, res) => {
    const authUser = req.user;
    const technicianUserId = String(authUser?.id ?? authUser?._id ?? '').trim();
    if (!technicianUserId || !mongoose_1.default.Types.ObjectId.isValid(technicianUserId)) {
        res.status(401).json({ message: 'Unauthorized. Technician identity missing.' });
        return;
    }
    try {
        const { dataUri } = (0, image_data_uri_1.parseImageDataUri)(req.body?.dataUri, {
            maxBytes: MAX_TECHNICIAN_PROFILE_PHOTO_BYTES,
            invalidMessage: 'Please upload a JPG, PNG, or WebP profile photo.',
            tooLargeMessage: 'Profile photos must be 5 MB or smaller.',
        });
        const technician = await technician_model_1.default.findOne({ userId: new mongoose_1.default.Types.ObjectId(technicianUserId) });
        if (!technician) {
            res.status(404).json({ message: 'Technician profile not found.' });
            return;
        }
        const uploaded = await (0, media_storage_service_1.uploadImageToCloudinary)({
            dataUri,
            folder: `myfixer/technicians/${technicianUserId}/profile`,
            publicId: `profile-photo-${Date.now()}`,
        });
        const before = {
            profilePhotoUrl: technician.documents.profilePhotoUrl,
            profilePhotoStatus: technician.documents.profilePhotoStatus,
            approvalStatus: technician.approvalStatus,
        };
        technician.documents.profilePhotoUrl = uploaded.url;
        technician.documents.profilePhotoStatus = technician_model_1.VerificationStatus.SUBMITTED;
        if (technician.approvalStatus === technician_model_1.TechnicianApprovalStatus.REJECTED) {
            technician.approvalStatus = technician_model_1.TechnicianApprovalStatus.PENDING_REVIEW;
            technician.review.rejectionReason = '';
        }
        await technician.save();
        await (0, audit_service_1.logAuditEvent)(req, {
            action: 'technician.profile_photo.submit',
            module: 'TECHNICIANS',
            resourceType: 'Technician',
            resourceId: technician._id.toString(),
            changes: {
                before,
                after: {
                    profilePhotoUrl: technician.documents.profilePhotoUrl,
                    profilePhotoStatus: technician.documents.profilePhotoStatus,
                    approvalStatus: technician.approvalStatus,
                },
            },
        });
        res.status(200).json({
            success: true,
            technician: {
                id: technician._id,
                approvalStatus: technician.approvalStatus,
                profilePhotoUrl: technician.documents.profilePhotoUrl,
                profilePhotoStatus: technician.documents.profilePhotoStatus,
            },
        });
    }
    catch (error) {
        console.error('Failed to upload technician profile photo:', error);
        res.status(500).json({ message: 'Unable to upload technician profile photo.' });
    }
};
exports.uploadMyTechnicianProfilePhoto = uploadMyTechnicianProfilePhoto;
const reviewTechnicianProfilePhoto = async (req, res) => {
    const { id } = req.params;
    const body = req.body;
    const reviewerId = req.user?.id;
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        res.status(400).json({ message: 'Invalid technician id.' });
        return;
    }
    if (!isPhotoReviewStatus(body.status)) {
        res.status(400).json({ message: 'Invalid profile photo review status.' });
        return;
    }
    try {
        const technician = await technician_model_1.default.findById(id);
        if (!technician) {
            res.status(404).json({ message: 'Technician application not found.' });
            return;
        }
        if (!technician.documents.profilePhotoUrl) {
            res.status(400).json({ message: 'Technician has not uploaded a profile photo.' });
            return;
        }
        const before = {
            profilePhotoStatus: technician.documents.profilePhotoStatus,
            profilePhotoUrl: technician.documents.profilePhotoUrl,
            approvalStatus: technician.approvalStatus,
            review: technician.review,
        };
        technician.documents.profilePhotoStatus = body.status;
        technician.review.reviewedAt = new Date();
        technician.review.reviewedBy = mongoose_1.default.Types.ObjectId.isValid(reviewerId)
            ? new mongoose_1.default.Types.ObjectId(reviewerId)
            : null;
        const reviewReason = typeof body.rejectionReason === 'string' ? body.rejectionReason.trim() : '';
        if (body.status === technician_model_1.VerificationStatus.REJECTED) {
            technician.approvalStatus = technician_model_1.TechnicianApprovalStatus.PENDING_REVIEW;
            technician.review.rejectionReason = reviewReason || 'Profile photo was rejected. Please upload a clear headshot.';
            await user_model_1.default.findByIdAndUpdate(technician.userId, { $set: { profilePhotoUrl: '' } });
        }
        else {
            technician.review.rejectionReason = '';
            await user_model_1.default.findByIdAndUpdate(technician.userId, { $set: { profilePhotoUrl: technician.documents.profilePhotoUrl } });
        }
        await technician.save();
        await (0, audit_service_1.logAuditEvent)(req, {
            action: 'technician.profile_photo.review',
            module: 'TECHNICIANS',
            resourceType: 'Technician',
            resourceId: technician._id.toString(),
            changes: {
                before,
                after: {
                    profilePhotoStatus: technician.documents.profilePhotoStatus,
                    profilePhotoUrl: technician.documents.profilePhotoUrl,
                    approvalStatus: technician.approvalStatus,
                    review: technician.review,
                },
            },
            metadata: { status: body.status },
        });
        res.status(200).json({ success: true, technician });
    }
    catch (error) {
        console.error('Failed to review technician profile photo:', error);
        res.status(500).json({ message: 'Failed to review technician profile photo.' });
    }
};
exports.reviewTechnicianProfilePhoto = reviewTechnicianProfilePhoto;
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
        if (body.status === technician_model_1.TechnicianApprovalStatus.APPROVED &&
            technician.documents.profilePhotoStatus !== technician_model_1.VerificationStatus.VERIFIED) {
            res.status(409).json({ message: 'Approve the technician profile photo before approving this application.' });
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
        await technician_capability_model_1.default.updateMany({ technicianId: technician._id }, {
            $set: {
                verificationStatus: capabilityStatusForTechnicianReview(technician.approvalStatus),
                rejectionReason: technician.approvalStatus === technician_model_1.TechnicianApprovalStatus.REJECTED ||
                    technician.approvalStatus === technician_model_1.TechnicianApprovalStatus.SUSPENDED
                    ? reviewReason
                    : null,
            },
        });
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
        let reviewEmailSent = false;
        if (before.approvalStatus !== technician.approvalStatus) {
            const technicianUser = await user_model_1.default.findById(technician.userId).select('name email').lean();
            if (technicianUser?.email) {
                reviewEmailSent = await email_service_1.EmailService.sendTechnicianReviewEmail({
                    recipientEmail: technicianUser.email,
                    technicianName: technicianUser.name || 'there',
                    status: technician.approvalStatus,
                    rejectionReason: reviewReason,
                });
            }
        }
        res.status(200).json({ success: true, technician, reviewEmailSent });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to review technician application.' });
    }
};
exports.reviewTechnicianApplication = reviewTechnicianApplication;
//# sourceMappingURL=technician.controller.js.map