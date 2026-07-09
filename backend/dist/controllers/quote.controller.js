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
exports.rejectJobQuote = exports.approveJobQuote = exports.getBookingQuotes = exports.createJobQuote = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const booking_model_1 = __importStar(require("../models/booking.model"));
const quote_model_1 = __importStar(require("../models/quote.model"));
const user_model_1 = require("../models/user.model");
const market_config_1 = require("../config/market.config");
const audit_service_1 = require("../services/audit.service");
const email_service_1 = require("../services/email/email.service");
const notification_service_1 = require("../services/notification.service");
const notification_model_1 = require("../models/notification.model");
const getAuthenticatedUser = (request) => request.user;
const toFiniteNumber = (value) => {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};
const isLineItemType = (value) => typeof value === 'string' && Object.values(quote_model_1.QuoteLineItemType).includes(value);
const serializeQuote = (quote) => ({
    id: quote.id,
    bookingId: quote.bookingId,
    customerId: quote.customerId,
    technicianId: quote.technicianId,
    countryCode: quote.countryCode,
    currency: quote.currency,
    status: quote.status,
    lineItems: quote.lineItems,
    subtotalAmount: quote.subtotalAmount,
    subtotalAmountMinor: quote.subtotalAmountMinor,
    discountAmount: quote.discountAmount,
    discountAmountMinor: quote.discountAmountMinor,
    totalAmount: quote.totalAmount,
    totalAmountMinor: quote.totalAmountMinor,
    technicianNotes: quote.technicianNotes,
    clientDecisionNote: quote.clientDecisionNote,
    sentAt: quote.sentAt,
    approvedAt: quote.approvedAt,
    rejectedAt: quote.rejectedAt,
    createdAt: quote.createdAt,
    updatedAt: quote.updatedAt,
});
const createJobQuote = async (request, response) => {
    const { bookingId } = request.params;
    const body = request.body;
    const authUser = getAuthenticatedUser(request);
    const role = (0, user_model_1.normalizeUserRole)(authUser?.role);
    const userId = String(authUser?.id ?? authUser?._id ?? '');
    if (role !== user_model_1.UserRole.TECHNICIAN && role !== user_model_1.UserRole.ADMIN) {
        response.status(403).json({ message: 'Only technician or admin accounts can create quotes.' });
        return;
    }
    if (!mongoose_1.default.Types.ObjectId.isValid(bookingId)) {
        response.status(400).json({ message: 'Invalid booking id.' });
        return;
    }
    try {
        const booking = await booking_model_1.default.findById(bookingId);
        if (!booking) {
            response.status(404).json({ message: 'Booking not found.' });
            return;
        }
        if (!booking.technicianId) {
            response.status(409).json({ message: 'A technician must accept the booking before quoting.' });
            return;
        }
        if (role !== user_model_1.UserRole.ADMIN && String(booking.technicianId || '') !== userId) {
            response.status(403).json({ message: 'Only the assigned technician can quote this booking.' });
            return;
        }
        if (!Array.isArray(body.lineItems) || body.lineItems.length === 0) {
            response.status(400).json({ message: 'At least one quote line item is required.' });
            return;
        }
        const lineItems = body.lineItems.map((item) => {
            if (!isLineItemType(item.type)) {
                throw new Error('Invalid quote line item type.');
            }
            const label = typeof item.label === 'string' ? item.label.trim() : '';
            const quantity = toFiniteNumber(item.quantity) ?? 1;
            const unitAmount = toFiniteNumber(item.unitAmount);
            if (!label || unitAmount === null || quantity <= 0 || unitAmount < 0) {
                throw new Error('Invalid quote line item values.');
            }
            const rawTotal = quantity * unitAmount;
            const signedTotal = item.type === quote_model_1.QuoteLineItemType.DISCOUNT ? -rawTotal : rawTotal;
            return {
                type: item.type,
                label,
                quantity,
                unitAmountMinor: (0, market_config_1.toMinorUnits)(unitAmount, booking.currency),
                totalAmountMinor: (0, market_config_1.toMinorUnits)(signedTotal, booking.currency),
                notes: typeof item.notes === 'string' ? item.notes.trim() : '',
            };
        });
        const subtotalAmountMinor = lineItems
            .filter((item) => item.type !== quote_model_1.QuoteLineItemType.DISCOUNT)
            .reduce((sum, item) => sum + item.totalAmountMinor, 0);
        const discountAmountMinor = Math.abs(lineItems
            .filter((item) => item.type === quote_model_1.QuoteLineItemType.DISCOUNT)
            .reduce((sum, item) => sum + item.totalAmountMinor, 0));
        const totalAmountMinor = Math.max(subtotalAmountMinor - discountAmountMinor, 0);
        const quote = await quote_model_1.default.create({
            bookingId: booking._id,
            customerId: new mongoose_1.default.Types.ObjectId(booking.customerId),
            technicianId: new mongoose_1.default.Types.ObjectId(booking.technicianId),
            countryCode: booking.countryCode,
            currency: booking.currency,
            status: quote_model_1.QuoteStatus.SENT_TO_CLIENT,
            lineItems,
            subtotalAmountMinor,
            discountAmountMinor,
            totalAmountMinor,
            technicianNotes: typeof body.technicianNotes === 'string' ? body.technicianNotes.trim() : '',
            sentAt: new Date(),
        });
        booking.metadata = {
            ...(booking.metadata ?? {}),
            latestQuoteId: quote.id,
            latestQuoteTotalAmountMinor: totalAmountMinor,
            latestQuoteSentAt: quote.sentAt,
        };
        if (booking.status === booking_model_1.BookingStatus.ARRIVED) {
            booking.status = booking_model_1.BookingStatus.DIAGNOSTIC_DONE;
        }
        await booking.save();
        const serializedQuote = serializeQuote(quote);
        const invoicePayload = {
            bookingId: booking.id,
            customerName: booking.customerName,
            customerEmail: booking.customerEmail,
            currency: booking.currency,
            totalAmountMinor,
            totalAmount: totalAmountMinor / 100,
            lineItems: quote.lineItems,
        };
        const io = request.app.get('io');
        io?.to(`booking:${booking.id}`).emit('quote_sent', {
            ...serializedQuote,
            invoice: invoicePayload,
        });
        const emailSent = await email_service_1.EmailService.sendQuoteEmail({
            recipientEmail: booking.customerEmail,
            customerName: booking.customerName || 'Client',
            bookingId: booking.id,
            totalAmount: totalAmountMinor / 100,
            currency: booking.currency,
            lineItems: quote.lineItems.map((item) => ({
                label: item.label,
                quantity: item.quantity,
                totalAmountMinor: item.totalAmountMinor,
            })),
        });
        const inboxMessages = await (0, notification_service_1.createNotifications)({
            userId: booking.customerId,
            email: booking.customerEmail,
            name: booking.customerName,
            channels: [notification_model_1.NotificationChannel.IN_APP, notification_model_1.NotificationChannel.PUSH],
            type: 'QUOTE_SENT',
            title: 'Quote sent for approval',
            message: `A quote for ${booking.applianceType} is ready for your review.`,
            metadata: {
                bookingId: booking.id,
                quoteId: quote.id,
                totalAmountMinor,
                currency: booking.currency,
            },
        });
        inboxMessages.forEach((message) => {
            io?.to(`customer:${booking.customerId.toString()}`).emit('new_inbox_message', message);
        });
        response.status(201).json({ success: true, quote: serializedQuote, invoice: invoicePayload, emailSent });
    }
    catch (error) {
        response.status(400).json({ message: error.message || 'Failed to create quote.' });
    }
};
exports.createJobQuote = createJobQuote;
const getBookingQuotes = async (request, response) => {
    const { bookingId } = request.params;
    const authUser = getAuthenticatedUser(request);
    const role = (0, user_model_1.normalizeUserRole)(authUser?.role);
    const userId = String(authUser?.id ?? authUser?._id ?? '');
    if (!mongoose_1.default.Types.ObjectId.isValid(bookingId)) {
        response.status(400).json({ message: 'Invalid booking id.' });
        return;
    }
    try {
        const booking = await booking_model_1.default.findById(bookingId);
        if (!booking) {
            response.status(404).json({ message: 'Booking not found.' });
            return;
        }
        const canView = role === user_model_1.UserRole.ADMIN ||
            String(booking.customerId) === userId ||
            String(booking.technicianId || '') === userId;
        if (!canView) {
            response.status(403).json({ message: 'This account cannot view quotes for this booking.' });
            return;
        }
        const quotes = await quote_model_1.default.find({ bookingId }).sort({ createdAt: -1 });
        response.status(200).json({ success: true, quotes: quotes.map(serializeQuote) });
    }
    catch (error) {
        response.status(500).json({ message: 'Failed to fetch quotes.' });
    }
};
exports.getBookingQuotes = getBookingQuotes;
const approveJobQuote = async (request, response) => {
    await decideJobQuote(request, response, quote_model_1.QuoteStatus.APPROVED);
};
exports.approveJobQuote = approveJobQuote;
const rejectJobQuote = async (request, response) => {
    await decideJobQuote(request, response, quote_model_1.QuoteStatus.REJECTED);
};
exports.rejectJobQuote = rejectJobQuote;
const decideJobQuote = async (request, response, decision) => {
    const { quoteId } = request.params;
    const body = request.body;
    const authUser = getAuthenticatedUser(request);
    const role = (0, user_model_1.normalizeUserRole)(authUser?.role);
    const userId = String(authUser?.id ?? authUser?._id ?? '');
    if (!mongoose_1.default.Types.ObjectId.isValid(quoteId)) {
        response.status(400).json({ message: 'Invalid quote id.' });
        return;
    }
    try {
        const quote = await quote_model_1.default.findById(quoteId);
        if (!quote) {
            response.status(404).json({ message: 'Quote not found.' });
            return;
        }
        const booking = await booking_model_1.default.findById(quote.bookingId);
        if (!booking) {
            response.status(404).json({ message: 'Booking not found.' });
            return;
        }
        if (role !== user_model_1.UserRole.ADMIN && String(booking.customerId || '') !== userId) {
            response.status(403).json({ message: 'Only the client or admin can decide this quote.' });
            return;
        }
        if (quote.status !== quote_model_1.QuoteStatus.SENT_TO_CLIENT) {
            response.status(409).json({ message: `Quote is already ${quote.status}.` });
            return;
        }
        const before = {
            status: quote.status,
            clientDecisionNote: quote.clientDecisionNote,
            approvedAt: quote.approvedAt,
            rejectedAt: quote.rejectedAt,
        };
        quote.status = decision;
        quote.clientDecisionNote = typeof body.note === 'string' ? body.note.trim() : '';
        if (decision === quote_model_1.QuoteStatus.APPROVED)
            quote.approvedAt = new Date();
        if (decision === quote_model_1.QuoteStatus.REJECTED)
            quote.rejectedAt = new Date();
        if (mongoose_1.default.Types.ObjectId.isValid(userId))
            quote.decisionBy = new mongoose_1.default.Types.ObjectId(userId);
        await quote.save();
        if (decision === quote_model_1.QuoteStatus.APPROVED) {
            await quote_model_1.default.updateMany({
                bookingId: quote.bookingId,
                _id: { $ne: quote._id },
                status: quote_model_1.QuoteStatus.SENT_TO_CLIENT,
            }, { $set: { status: quote_model_1.QuoteStatus.CANCELLED } });
        }
        const io = request.app.get('io');
        io?.to(`booking:${booking.id}`).emit(decision === quote_model_1.QuoteStatus.APPROVED ? 'quote_approved' : 'quote_rejected', serializeQuote(quote));
        await (0, notification_service_1.createNotifications)({
            userId: booking.customerId,
            email: booking.customerEmail,
            name: booking.customerName,
            channels: [notification_model_1.NotificationChannel.IN_APP, notification_model_1.NotificationChannel.PUSH],
            type: decision === quote_model_1.QuoteStatus.APPROVED ? 'QUOTE_APPROVED' : 'QUOTE_REJECTED',
            title: decision === quote_model_1.QuoteStatus.APPROVED ? 'Quote approved' : 'Quote rejected',
            message: decision === quote_model_1.QuoteStatus.APPROVED
                ? `You approved the quote for ${booking.applianceType}.`
                : `You rejected the quote for ${booking.applianceType}.`,
            metadata: {
                bookingId: booking.id,
                quoteId: quote.id,
                status: quote.status,
            },
        });
        await (0, audit_service_1.logAuditEvent)(request, {
            action: decision === quote_model_1.QuoteStatus.APPROVED ? 'quote.approve' : 'quote.reject',
            module: 'BOOKINGS',
            resourceType: 'JobQuote',
            resourceId: quote.id,
            changes: {
                before,
                after: {
                    status: quote.status,
                    clientDecisionNote: quote.clientDecisionNote,
                    approvedAt: quote.approvedAt,
                    rejectedAt: quote.rejectedAt,
                    decisionBy: quote.decisionBy,
                },
            },
            metadata: {
                bookingId: booking.id,
                totalAmountMinor: quote.totalAmountMinor,
            },
        });
        response.status(200).json({ success: true, quote: serializeQuote(quote) });
    }
    catch (error) {
        response.status(500).json({ message: 'Failed to update quote.' });
    }
};
//# sourceMappingURL=quote.controller.js.map