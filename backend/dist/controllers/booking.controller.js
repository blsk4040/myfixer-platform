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
exports.finalizeJobInvoice = exports.getBookingById = exports.createBooking = void 0;
// 1. IMPORT BookingStatus ENUM HERE
const booking_model_1 = __importStar(require("../models/booking.model"));
const matching_service_1 = __importDefault(require("../services/matching.service"));
// 2. UNCOMMENT AND USE YOUR ACTUAL EMAIL SERVICE UTILITY
const email_service_1 = require("../services/email/email.service");
const isCurrencyCode = (value) => value === booking_model_1.CurrencyCode.ZAR || value === booking_model_1.CurrencyCode.GHS;
const toFiniteNumber = (value) => {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};
const getSocketIdentity = (socket) => {
    const query = socket.handshake.query;
    const candidate = query.technicianId ??
        query.technician_id ??
        query.userId ??
        query.user_id;
    if (Array.isArray(candidate)) {
        return candidate[0] ?? null;
    }
    return candidate ?? null;
};
const emitIncomingRequest = async (io, technicianId, payload) => {
    io.to(`technician:${technicianId}`).emit('incoming_request', payload);
    const sockets = await io.fetchSockets();
    const matchingSockets = sockets.filter((socket) => getSocketIdentity(socket) === technicianId);
    matchingSockets.forEach((socket) => {
        socket.emit('incoming_request', payload);
    });
};
const createBooking = async (request, response) => {
    const body = request.body;
    const customerId = typeof body.customer_id === 'string' ? body.customer_id.trim() : '';
    const customerName = typeof body.customer_name === 'string' ? body.customer_name.trim() : 'Client';
    const applianceType = typeof body.appliance_type === 'string' ? body.appliance_type.trim() : '';
    const faultDescription = typeof body.fault_description === 'string' ? body.fault_description.trim() : 'No description provided.';
    const fullAddress = typeof body.full_address === 'string' ? body.full_address.trim() : '';
    const complexDetails = typeof body.complex_details === 'string' ? body.complex_details.trim() : '';
    const generalArea = typeof body.general_area === 'string' ? body.general_area.trim() : 'Local Area';
    const latitude = toFiniteNumber(body.latitude);
    const longitude = toFiniteNumber(body.longitude);
    const callOutFee = toFiniteNumber(body.call_out_fee) ?? 450; // Defaults to your base R450 configuration
    if (!customerId || !applianceType || !fullAddress || latitude === null || longitude === null) {
        response.status(400).json({ message: 'Missing or invalid booking layout items' });
        return;
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 || callOutFee < 0) {
        response.status(400).json({ message: 'Invalid location or pricing metrics input' });
        return;
    }
    if (!isCurrencyCode(body.currency)) {
        response.status(400).json({ message: 'Currency must be ZAR or GHS' });
        return;
    }
    try {
        // 1. Save directly into MongoDB Atlas with updated keys
        const booking = await booking_model_1.default.create({
            customerId,
            customerName,
            applianceType,
            faultDescription,
            customerLocation: {
                type: 'Point',
                coordinates: [longitude, latitude]
            },
            fullAddress,
            complexDetails,
            generalArea,
            price: callOutFee, // Map callOutFee into existing schema price field safely
            currency: body.currency
        });
        const bookingId = booking.id;
        // 2. Query geo-spatial ranges for active technician tracking rings
        const nearbyTechnicianIds = await matching_service_1.default.findNearbyTechnicians(latitude, longitude);
        // 3. Formulate the precise JSON parameters expected by DashboardScreen.tsx
        const incomingRequestPayload = {
            bookingId,
            customerId,
            customerName,
            applianceType,
            faultDescription,
            callOutFee,
            distance: "4.5 km", // You can calculate this dynamically in matchingService later
            generalArea,
            fullAddress,
            complexDetails,
            latitude,
            longitude,
            currency: body.currency
        };
        const io = request.app.get('io');
        if (io) {
            await Promise.all(nearbyTechnicianIds.map((technicianId) => emitIncomingRequest(io, technicianId, incomingRequestPayload)));
        }
        else {
            console.warn('Socket.io server instance unavailable; skipped technician broadcasts');
        }
        response.status(201).json({
            success: true,
            bookingId,
            notifiedTechnicianIds: nearbyTechnicianIds
        });
    }
    catch (error) {
        console.error('Failed to create booking in MongoDB:', error);
        response.status(500).json({ message: 'Failed to create booking' });
    }
};
exports.createBooking = createBooking;
// ==========================================
// ✅ FINALIZE INVOICE ENGINE WORKER
// ==========================================
const getBookingById = async (request, response) => {
    const { id } = request.params;
    try {
        const booking = await booking_model_1.default.findById(id);
        if (!booking) {
            response.status(404).json({ message: 'Booking not found' });
            return;
        }
        const [longitude, latitude] = booking.customerLocation.coordinates;
        response.status(200).json({
            id: booking.id,
            status: booking.status,
            customerId: booking.customerId,
            customerName: booking.customerName,
            applianceType: booking.applianceType,
            faultDescription: booking.faultDescription,
            fullAddress: booking.fullAddress,
            complexDetails: booking.complexDetails,
            generalArea: booking.generalArea,
            price: booking.price,
            currency: booking.currency,
            customerLocation: {
                latitude,
                longitude,
            },
            technicianId: booking.technicianId,
            createdAt: booking.createdAt,
            updatedAt: booking.updatedAt,
        });
    }
    catch (error) {
        console.error('Failed to fetch booking details:', error);
        response.status(500).json({ message: 'Failed to fetch booking details' });
    }
};
exports.getBookingById = getBookingById;
const finalizeJobInvoice = async (request, response) => {
    const body = request.body;
    const bookingId = typeof body.bookingId === 'string' ? body.bookingId.trim() : '';
    const proofPhoto = typeof body.proofPhoto === 'string' ? body.proofPhoto.trim() : '';
    const baseAmount = toFiniteNumber(body.baseAmount) ?? 450;
    const additionalLabor = toFiniteNumber(body.additionalLabor) ?? 0;
    const partsAmount = toFiniteNumber(body.partsAmount) ?? 0;
    const totalAmount = toFiniteNumber(body.totalAmount) ?? (baseAmount + additionalLabor + partsAmount);
    if (!bookingId) {
        response.status(400).json({ message: 'Missing require bookingId identity parameter' });
        return;
    }
    try {
        // 1. Find document inside MongoDB Atlas
        const booking = await booking_model_1.default.findById(bookingId);
        if (!booking) {
            response.status(404).json({ message: 'Booking entry record not found in system storage' });
            return;
        }
        // 2. ASSIGN USING THE ENUM INSTEAD OF A RAW STRING LITERAL 🎯
        booking.status = booking_model_1.BookingStatus.COMPLETED;
        booking.set('finalBilling', {
            baseAmount,
            additionalLabor,
            partsAmount,
            totalAmount,
            proofPhoto
        });
        await booking.save();
        console.log(`✅ MongoDB record updated successfully for complete run job #${bookingId}`);
        // 3. Trigger your Resend Email Worker pipeline
        const recipientEmail = booking.customerEmail || 'admin@myfixer.co.za';
        // The compiler can now resolve 'EmailService' cleanly 📬
        const emailSent = await email_service_1.EmailService.sendJobInvoiceEmail({
            recipientEmail,
            customerName: booking.customerName || 'Client',
            bookingId,
            baseAmount,
            additionalLabor,
            partsAmount,
            totalAmount
        });
        if (!emailSent) {
            console.warn(`⚠️ Invoice database updated, but transaction verification email failed to dispatch via Resend`);
        }
        response.status(200).json({
            success: true,
            message: 'Job finalized, financial matrices captured, and invoice dispatched successfully.',
            bookingId
        });
    }
    catch (error) {
        console.error('Failed to settle final billing operations endpoint run:', error);
        response.status(500).json({ message: 'Failed to process job closure accounting entries' });
    }
};
exports.finalizeJobInvoice = finalizeJobInvoice;
//# sourceMappingURL=booking.controller.js.map