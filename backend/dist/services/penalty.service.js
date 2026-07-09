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
exports.handleTechnicianCancellation = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const booking_model_1 = __importStar(require("../models/booking.model"));
const technician_model_1 = __importStar(require("../models/technician.model"));
const notification_model_1 = require("../models/notification.model");
const matching_service_1 = __importDefault(require("./matching.service"));
const notification_service_1 = require("./notification.service");
const LATE_CANCELLATION_FEE_MINOR = 15000;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const handleTechnicianCancellation = async (bookingId, technicianId, io) => {
    if (!mongoose_1.default.Types.ObjectId.isValid(bookingId) || !mongoose_1.default.Types.ObjectId.isValid(technicianId)) {
        throw new Error('Valid bookingId and technicianId are required.');
    }
    const booking = await booking_model_1.default.findById(bookingId);
    if (!booking) {
        throw new Error('Booking not found.');
    }
    const technician = await technician_model_1.default.findOne({ userId: new mongoose_1.default.Types.ObjectId(technicianId) });
    if (!technician) {
        throw new Error('Technician profile not found.');
    }
    const scheduledStart = booking.appointmentWindow?.scheduledStartTime
        ? new Date(booking.appointmentWindow.scheduledStartTime)
        : null;
    const noticeMs = scheduledStart && !Number.isNaN(scheduledStart.getTime())
        ? scheduledStart.getTime() - Date.now()
        : 0;
    const tier = noticeMs > TWENTY_FOUR_HOURS_MS ? 1 : noticeMs >= TWO_HOURS_MS ? 2 : 3;
    const penaltyMinor = tier === 1 ? 0 : tier === 2 ? LATE_CANCELLATION_FEE_MINOR : Math.max(booking.priceMinor, LATE_CANCELLATION_FEE_MINOR);
    if (penaltyMinor > 0) {
        technician.walletBalance -= penaltyMinor;
    }
    if (tier === 3) {
        technician.strikesCount += 1;
        technician.reliabilityScore = Math.max(technician.reliabilityScore - 15, 0);
    }
    let suspended = false;
    if (technician.strikesCount >= 3) {
        technician.approvalStatus = technician_model_1.TechnicianApprovalStatus.SUSPENDED;
        technician.availability.isOnline = false;
        technician.review.suspensionReason = 'Automatic suspension after repeated late cancellations or no-shows.';
        suspended = true;
    }
    await technician.save();
    booking.technicianId = null;
    booking.technicianName = '';
    booking.status = booking_model_1.BookingStatus.PENDING;
    booking.dispatch = {
        ...(booking.dispatch ?? {
            sentToTechnicians: [],
            declinedByTechnicians: [],
        }),
        status: tier === 1 ? booking_model_1.BookingDispatchStatus.STANDBY : booking_model_1.BookingDispatchStatus.STANDBY,
        expiresAt: tier === 1 ? null : matching_service_1.default.getDispatchExpiry({ createdAt: new Date() }),
        sentToTechnicians: [],
        declinedByTechnicians: booking.dispatch?.declinedByTechnicians ?? [],
        acceptedByTechnician: null,
    };
    booking.metadata = {
        ...(booking.metadata ?? {}),
        lastTechnicianCancellation: {
            technicianId,
            tier,
            penaltyMinor,
            cancelledAt: new Date(),
            scheduledStartTime: scheduledStart,
        },
    };
    await booking.save();
    const rematchTechnicianIds = tier === 1 ? [] : await matching_service_1.default.findEligibleOnlineTechniciansForBooking(booking.id);
    if (tier >= 2 && rematchTechnicianIds.length) {
        booking.dispatch.sentToTechnicians = rematchTechnicianIds.map((id) => new mongoose_1.default.Types.ObjectId(id));
        await booking.save();
        const payload = {
            bookingId: booking.id,
            serviceKey: booking.serviceKey,
            applianceType: booking.applianceType,
            faultDescription: booking.faultDescription,
            fullAddress: booking.fullAddress,
            generalArea: booking.generalArea,
            priceMinor: booking.priceMinor,
            countryCode: booking.countryCode,
            currency: booking.currency,
            emergencyReplacement: true,
        };
        rematchTechnicianIds.forEach((targetTechnicianId) => {
            io?.to(`technician:${targetTechnicianId}`).emit('emergency_standby_request', payload);
            io?.to(`technician:${targetTechnicianId}`).emit('incoming_request', payload);
        });
        await Promise.all(rematchTechnicianIds.map((targetTechnicianId) => (0, notification_service_1.createNotifications)({
            userId: targetTechnicianId,
            channels: [notification_model_1.NotificationChannel.PUSH],
            type: 'EMERGENCY_JOB_REQUEST',
            title: 'Urgent replacement job',
            message: `${booking.applianceType || 'Service request'} needs a replacement technician in ${booking.generalArea || 'your area'}.`,
            metadata: {
                bookingId: booking.id,
                applianceType: booking.applianceType,
                emergencyReplacement: true,
            },
        })));
    }
    return {
        tier,
        penaltyMinor,
        bookingId: booking.id,
        technicianId,
        rematchTechnicianIds,
        suspended,
    };
};
exports.handleTechnicianCancellation = handleTechnicianCancellation;
exports.default = {
    handleTechnicianCancellation: exports.handleTechnicianCancellation,
};
//# sourceMappingURL=penalty.service.js.map