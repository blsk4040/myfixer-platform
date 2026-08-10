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
exports.requestQuoteClarification = exports.rejectJobQuote = exports.approveJobQuote = exports.getBookingQuotes = exports.submitJobQuote = exports.createJobQuote = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const booking_model_1 = __importStar(require("../models/booking.model"));
const quote_model_1 = __importStar(require("../models/quote.model"));
const market_setting_model_1 = __importDefault(require("../models/market-setting.model"));
const notification_model_1 = require("../models/notification.model");
const user_model_1 = require("../models/user.model");
const notification_service_1 = require("../services/notification.service");
const audit_service_1 = require("../services/audit.service");
const quote_workflow_service_1 = require("../services/quote-workflow.service");
const price_breakdown_service_1 = require("../services/price-breakdown.service");
const getAuthUser = (request) => request.user;
const getUserId = (request) => String(getAuthUser(request)?.id ?? getAuthUser(request)?._id ?? '').trim();
const isOwnerOrAdmin = (booking, userId, role) => role === user_model_1.UserRole.ADMIN || String(booking.customerId) === userId;
const isAssignedTechnicianOrAdmin = (booking, userId, role) => role === user_model_1.UserRole.ADMIN || String(booking.technicianId || '') === userId;
const isQuoteSubmittedStatus = (status) => [quote_model_1.QuoteStatus.SUBMITTED, quote_model_1.QuoteStatus.SENT_TO_CLIENT].includes(status);
const buildQuoteNumber = (quoteId, version) => `Q-PADI-${new Date().getFullYear()}-${quoteId.toString().slice(-6).toUpperCase()}-V${Math.max(1, Math.round(version || 1))}`;
const serializeQuote = (quote) => ({
    id: quote._id?.toString?.() ?? quote.id,
    quoteNumber: quote.quoteNumber || (quote._id ? buildQuoteNumber(quote._id, Number(quote.version || 1)) : ''),
    bookingId: quote.bookingId?.toString?.() ?? quote.bookingId,
    customerId: quote.customerId?.toString?.() ?? quote.customerId,
    technicianId: quote.technicianId?.toString?.() ?? quote.technicianId,
    countryCode: quote.countryCode,
    currency: quote.currency,
    status: quote.status,
    version: quote.version ?? 1,
    parentQuoteId: quote.parentQuoteId?.toString?.() ?? quote.parentQuoteId ?? null,
    isCurrent: quote.isCurrent !== false,
    lineItems: (quote.lineItems || []).map((item) => ({
        type: item.type,
        label: item.label,
        description: item.label,
        quantity: item.quantity,
        unitAmountMinor: item.unitAmountMinor,
        unitAmount: item.unitAmountMinor / 100,
        totalAmountMinor: item.totalAmountMinor,
        totalAmount: item.totalAmountMinor / 100,
        notes: item.notes || '',
        taxable: item.taxable === true,
    })),
    subtotalAmountMinor: quote.subtotalAmountMinor,
    subtotalAmount: quote.subtotalAmountMinor / 100,
    discountAmountMinor: quote.discountAmountMinor,
    discountAmount: quote.discountAmountMinor / 100,
    totalAmountMinor: quote.totalAmountMinor,
    totalAmount: quote.totalAmountMinor / 100,
    priceBreakdown: quote.metadata?.priceBreakdown || null,
    promotion: quote.metadata?.promotion || null,
    promotions: Array.isArray(quote.metadata?.promotions) ? quote.metadata.promotions : [],
    technicianNotes: quote.technicianNotes || '',
    clientDecisionNote: quote.clientDecisionNote || '',
    sentAt: quote.sentAt,
    submittedAt: quote.submittedAt,
    approvedAt: quote.approvedAt,
    rejectedAt: quote.rejectedAt,
    clarificationRequestedAt: quote.clarificationRequestedAt,
    supersededAt: quote.supersededAt,
    expiresAt: quote.expiresAt,
    createdAt: quote.createdAt,
    updatedAt: quote.updatedAt,
});
const emitQuoteEvent = (request, event, quote) => {
    const io = request.app.get('io');
    io?.to(`booking:${quote.bookingId.toString()}`).emit(event, serializeQuote(quote));
};
const defaultExpiry = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const parseExpiry = (value) => {
    if (!value)
        return defaultExpiry();
    const parsed = new Date(String(value));
    if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
        throw new quote_workflow_service_1.QuoteWorkflowError('Quote expiry must be a future timestamp.', 'INVALID_QUOTE_EXPIRY');
    }
    return parsed;
};
const positiveMinor = (value) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
const lineTotal = (items, types) => items
    .filter((item) => types.includes(String(item.type)))
    .reduce((sum, item) => sum + positiveMinor(item.totalAmountMinor), 0);
const buildQuotePriceBreakdown = async (booking, totals) => {
    const bookingBreakdown = booking.metadata?.priceBreakdown && typeof booking.metadata.priceBreakdown === 'object'
        ? booking.metadata.priceBreakdown
        : {};
    const bookingCalloutMinor = positiveMinor(bookingBreakdown.calloutFeeMinor ?? booking.priceMinor);
    const quoteCalloutMinor = lineTotal(totals.lineItems, ['CALL_OUT', 'CALLOUT']);
    const labourMinor = lineTotal(totals.lineItems, ['LABOUR', 'LABOR']);
    const partsMinor = lineTotal(totals.lineItems, ['PART']);
    const additionalServicesMinor = lineTotal(totals.lineItems, ['ADD_ON']);
    const surchargeMinor = lineTotal(totals.lineItems, ['SURCHARGE']);
    const repairWorkMinor = labourMinor + partsMinor + additionalServicesMinor + surchargeMinor;
    const calloutFeeDeductible = bookingBreakdown.calloutFeeDeductible !== false && quoteCalloutMinor > 0 && repairWorkMinor > 0;
    const marketSetting = await market_setting_model_1.default.findOne({ 'identity.countryCode': booking.countryCode }).lean();
    return (0, price_breakdown_service_1.calculatePriceBreakdown)({
        currency: booking.currency,
        calloutFeeMinor: quoteCalloutMinor,
        calloutFeeDeductible,
        calloutCreditMinor: calloutFeeDeductible ? Math.min(bookingCalloutMinor, quoteCalloutMinor) : 0,
        labourMinor,
        partsMinor,
        additionalServicesMinor,
        surchargeMinor,
        otherDiscountMinor: totals.discountAmountMinor,
        marketPricing: {
            ...(marketSetting?.pricing || {}),
            platformCommissionBps: marketSetting?.pricing?.platformCommissionBps ?? 1500,
        },
    });
};
const createJobQuote = async (request, response) => {
    const { bookingId } = request.params;
    const body = request.body;
    const userId = getUserId(request);
    const role = (0, user_model_1.normalizeUserRole)(getAuthUser(request)?.role);
    try {
        if (!mongoose_1.default.Types.ObjectId.isValid(bookingId)) {
            response.status(400).json({ message: 'Invalid booking id.' });
            return;
        }
        if (role !== user_model_1.UserRole.TECHNICIAN && role !== user_model_1.UserRole.ADMIN) {
            response.status(403).json({ message: 'Only the assigned technician can create a quote.' });
            return;
        }
        const booking = await booking_model_1.default.findById(bookingId);
        if (!booking) {
            response.status(404).json({ message: 'Booking not found.' });
            return;
        }
        if (!isAssignedTechnicianOrAdmin(booking, userId, role)) {
            response.status(403).json({ message: 'Only the assigned technician can create a quote for this booking.' });
            return;
        }
        const shouldSubmit = body.submit !== false && body.draft !== true;
        const parentQuoteId = typeof body.parentQuoteId === 'string' ? body.parentQuoteId.trim() : '';
        let version = 1;
        let parentQuote = null;
        if (parentQuoteId) {
            if (!mongoose_1.default.Types.ObjectId.isValid(parentQuoteId)) {
                response.status(400).json({ message: 'Invalid parent quote id.' });
                return;
            }
            parentQuote = await quote_model_1.default.findOne({ _id: parentQuoteId, bookingId: booking._id });
            if (!parentQuote) {
                response.status(404).json({ message: 'Parent quote not found.' });
                return;
            }
            if (parentQuote.status === quote_model_1.QuoteStatus.APPROVED) {
                response.status(409).json({ message: 'Approved quotes cannot be revised.' });
                return;
            }
            version = Number(parentQuote.version || 1) + 1;
        }
        else {
            const latest = await quote_model_1.default.findOne({ bookingId: booking._id }).sort({ version: -1, createdAt: -1 }).lean();
            version = latest ? Number(latest.version || 1) + 1 : 1;
        }
        const totals = (0, quote_workflow_service_1.calculateQuoteTotals)(Array.isArray(body.lineItems) ? body.lineItems : [], booking.currency);
        const priceBreakdown = await buildQuotePriceBreakdown(booking, totals);
        const now = new Date();
        const status = shouldSubmit ? quote_model_1.QuoteStatus.SUBMITTED : quote_model_1.QuoteStatus.DRAFT;
        const quoteId = new mongoose_1.default.Types.ObjectId();
        const quote = await quote_model_1.default.create({
            _id: quoteId,
            quoteNumber: buildQuoteNumber(quoteId, version),
            bookingId: booking._id,
            customerId: booking.customerId,
            technicianId: booking.technicianId,
            countryCode: booking.countryCode,
            currency: booking.currency,
            status,
            version,
            parentQuoteId: parentQuote?._id ?? null,
            isCurrent: true,
            lineItems: totals.lineItems,
            subtotalAmountMinor: totals.subtotalAmountMinor,
            discountAmountMinor: totals.discountAmountMinor,
            totalAmountMinor: totals.totalAmountMinor,
            technicianNotes: typeof body.technicianNotes === 'string' ? body.technicianNotes.trim().slice(0, 4000) : '',
            sentAt: shouldSubmit ? now : null,
            submittedAt: shouldSubmit ? now : null,
            submittedBy: shouldSubmit ? new mongoose_1.default.Types.ObjectId(userId) : undefined,
            createdBy: new mongoose_1.default.Types.ObjectId(userId),
            expiresAt: shouldSubmit ? parseExpiry(body.expiresAt) : null,
            metadata: {
                priceBreakdown,
                pricingPolicy: 'callout-credit-v1',
            },
        });
        if (shouldSubmit) {
            await quote_model_1.default.updateMany({
                _id: { $ne: quote._id },
                bookingId: booking._id,
                isCurrent: true,
                status: { $in: [quote_model_1.QuoteStatus.SUBMITTED, quote_model_1.QuoteStatus.SENT_TO_CLIENT, quote_model_1.QuoteStatus.CLARIFICATION_REQUESTED, quote_model_1.QuoteStatus.REJECTED] },
            }, {
                $set: {
                    status: quote_model_1.QuoteStatus.SUPERSEDED,
                    isCurrent: false,
                    supersededAt: now,
                },
            });
            booking.set('metadata.latestQuoteId', quote._id.toString());
            booking.set('metadata.latestQuoteVersion', quote.version);
            booking.set('metadata.latestQuoteTotal', quote.totalAmountMinor);
            booking.set('metadata.latestQuoteSentAt', now.toISOString());
            booking.set('workAuthorization.status', booking_model_1.WorkAuthorizationStatus.AWAITING_QUOTE_APPROVAL);
            booking.set('workAuthorization.reasonCode', 'QUOTE_NOT_APPROVED');
            booking.set('workAuthorization.evaluatedAt', now);
            await booking.save();
        }
        emitQuoteEvent(request, shouldSubmit ? (version > 1 ? 'quote_revised' : 'quote_submitted') : 'quote_draft_saved', quote);
        if (shouldSubmit) {
            await (0, notification_service_1.createNotifications)({
                userId: booking.customerId,
                channels: [notification_model_1.NotificationChannel.IN_APP, notification_model_1.NotificationChannel.PUSH],
                type: 'QUOTE_SUBMITTED',
                title: 'Quote ready for review',
                message: `Review the Padi quote for ${booking.applianceType}. Only pay through Padi.`,
                metadata: {
                    feed: 'inbox',
                    documentType: 'QUOTE',
                    bookingId: booking.id,
                    quoteId: quote.id,
                    quoteNumber: quote.quoteNumber,
                    version: quote.version,
                },
            });
        }
        await (0, audit_service_1.logAuditEvent)(request, {
            action: shouldSubmit ? (version > 1 ? 'quote.revised_submitted' : 'quote.submitted') : 'quote.draft_saved',
            module: 'BOOKINGS',
            resourceType: 'JobQuote',
            resourceId: quote.id,
            metadata: {
                bookingId: booking.id,
                version: quote.version,
                totalAmountMinor: quote.totalAmountMinor,
            },
        });
        response.status(201).json({ success: true, quote: serializeQuote(quote) });
    }
    catch (error) {
        if (error instanceof quote_workflow_service_1.QuoteWorkflowError) {
            response.status(error.statusCode).json({ message: error.message, code: error.code });
            return;
        }
        console.error('Failed to create job quote:', error);
        response.status(500).json({ message: 'Failed to create quote.' });
    }
};
exports.createJobQuote = createJobQuote;
const submitJobQuote = async (request, response) => {
    const { quoteId } = request.params;
    const userId = getUserId(request);
    const role = (0, user_model_1.normalizeUserRole)(getAuthUser(request)?.role);
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
        if (!isAssignedTechnicianOrAdmin(booking, userId, role)) {
            response.status(403).json({ message: 'Only the assigned technician can submit this quote.' });
            return;
        }
        if (quote.status !== quote_model_1.QuoteStatus.DRAFT) {
            response.status(409).json({ message: 'Only draft quotes can be submitted.' });
            return;
        }
        const now = new Date();
        if (!quote.metadata?.priceBreakdown) {
            const totals = {
                lineItems: quote.lineItems,
                subtotalAmountMinor: quote.subtotalAmountMinor,
                discountAmountMinor: quote.discountAmountMinor,
                totalAmountMinor: quote.totalAmountMinor,
            };
            quote.metadata = {
                ...(quote.metadata || {}),
                priceBreakdown: await buildQuotePriceBreakdown(booking, totals),
                pricingPolicy: 'callout-credit-v1',
            };
        }
        quote.status = quote_model_1.QuoteStatus.SUBMITTED;
        quote.quoteNumber = quote.quoteNumber || buildQuoteNumber(quote._id, Number(quote.version || 1));
        quote.sentAt = now;
        quote.submittedAt = now;
        quote.submittedBy = new mongoose_1.default.Types.ObjectId(userId);
        quote.expiresAt = parseExpiry(request.body?.expiresAt);
        await quote.save();
        await quote_model_1.default.updateMany({
            _id: { $ne: quote._id },
            bookingId: booking._id,
            isCurrent: true,
            status: { $in: [quote_model_1.QuoteStatus.SUBMITTED, quote_model_1.QuoteStatus.SENT_TO_CLIENT, quote_model_1.QuoteStatus.CLARIFICATION_REQUESTED, quote_model_1.QuoteStatus.REJECTED] },
        }, { $set: { status: quote_model_1.QuoteStatus.SUPERSEDED, isCurrent: false, supersededAt: now } });
        booking.set('workAuthorization.status', booking_model_1.WorkAuthorizationStatus.AWAITING_QUOTE_APPROVAL);
        booking.set('workAuthorization.reasonCode', 'QUOTE_NOT_APPROVED');
        booking.set('workAuthorization.evaluatedAt', now);
        await booking.save();
        emitQuoteEvent(request, quote.version > 1 ? 'quote_revised' : 'quote_submitted', quote);
        await (0, notification_service_1.createNotifications)({
            userId: booking.customerId,
            channels: [notification_model_1.NotificationChannel.IN_APP, notification_model_1.NotificationChannel.PUSH],
            type: 'QUOTE_SUBMITTED',
            title: 'Quote ready for review',
            message: `Review the Padi quote for ${booking.applianceType}. Only pay through Padi.`,
            metadata: {
                feed: 'inbox',
                documentType: 'QUOTE',
                bookingId: booking.id,
                quoteId: quote.id,
                quoteNumber: quote.quoteNumber || buildQuoteNumber(quote._id, Number(quote.version || 1)),
                version: quote.version,
            },
        });
        response.status(200).json({ success: true, quote: serializeQuote(quote) });
    }
    catch (error) {
        response.status(500).json({ message: 'Failed to submit quote.' });
    }
};
exports.submitJobQuote = submitJobQuote;
const getBookingQuotes = async (request, response) => {
    const { bookingId } = request.params;
    const userId = getUserId(request);
    const role = (0, user_model_1.normalizeUserRole)(getAuthUser(request)?.role);
    if (!mongoose_1.default.Types.ObjectId.isValid(bookingId)) {
        response.status(400).json({ message: 'Invalid booking id.' });
        return;
    }
    const booking = await booking_model_1.default.findById(bookingId).lean();
    if (!booking) {
        response.status(404).json({ message: 'Booking not found.' });
        return;
    }
    if (!isOwnerOrAdmin(booking, userId, role) && !isAssignedTechnicianOrAdmin(booking, userId, role)) {
        response.status(403).json({ message: 'Not authorized to view quotes for this booking.' });
        return;
    }
    const quotes = await quote_model_1.default.find({ bookingId: booking._id }).sort({ version: -1, createdAt: -1 }).lean();
    response.status(200).json({ success: true, quotes: quotes.map(serializeQuote) });
};
exports.getBookingQuotes = getBookingQuotes;
const decideJobQuote = async (request, response, decision) => {
    const { quoteId } = request.params;
    const body = request.body;
    const userId = getUserId(request);
    const role = (0, user_model_1.normalizeUserRole)(getAuthUser(request)?.role);
    const note = typeof body.note === 'string' ? body.note.trim() : '';
    if (decision === quote_model_1.QuoteStatus.REJECTED && !note) {
        response.status(400).json({ message: 'A rejection reason is required.' });
        return;
    }
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
    if (!isOwnerOrAdmin(booking, userId, role)) {
        response.status(403).json({ message: 'Only the booking owner can respond to this quote.' });
        return;
    }
    if (!isQuoteSubmittedStatus(quote.status)) {
        response.status(409).json({ message: 'Only submitted quotes can be approved or rejected.' });
        return;
    }
    if (quote.expiresAt && quote.expiresAt.getTime() < Date.now()) {
        quote.status = quote_model_1.QuoteStatus.EXPIRED;
        quote.expiredAt = new Date();
        quote.isCurrent = false;
        await quote.save();
        response.status(409).json({ message: 'This quote has expired.', code: 'QUOTE_EXPIRED' });
        return;
    }
    const now = new Date();
    const updated = await quote_model_1.default.findOneAndUpdate({
        _id: quote._id,
        status: { $in: [quote_model_1.QuoteStatus.SUBMITTED, quote_model_1.QuoteStatus.SENT_TO_CLIENT] },
        isCurrent: { $ne: false },
    }, {
        $set: {
            status: decision,
            clientDecisionNote: note,
            decisionBy: new mongoose_1.default.Types.ObjectId(userId),
            ...(decision === quote_model_1.QuoteStatus.APPROVED ? { approvedAt: now } : { rejectedAt: now }),
        },
    }, { new: true });
    if (!updated) {
        response.status(409).json({ message: 'Quote state changed before it could be updated.' });
        return;
    }
    if (decision === quote_model_1.QuoteStatus.APPROVED) {
        await quote_model_1.default.updateMany({ _id: { $ne: updated._id }, bookingId: booking._id, isCurrent: true }, { $set: { status: quote_model_1.QuoteStatus.SUPERSEDED, isCurrent: false, supersededAt: now } });
        booking.paymentStatus = booking_model_1.BookingPaymentStatus.PENDING;
        booking.set('workAuthorization.status', booking_model_1.WorkAuthorizationStatus.AWAITING_PAYMENT);
        booking.set('workAuthorization.reasonCode', 'PAYMENT_NOT_SECURED');
        booking.set('workAuthorization.evaluatedAt', now);
        await booking.save();
    }
    const event = decision === quote_model_1.QuoteStatus.APPROVED ? 'quote_approved' : 'quote_rejected';
    emitQuoteEvent(request, event, updated);
    await (0, notification_service_1.createNotifications)({
        userId: booking.technicianId,
        channels: [notification_model_1.NotificationChannel.IN_APP, notification_model_1.NotificationChannel.PUSH],
        type: decision === quote_model_1.QuoteStatus.APPROVED ? 'QUOTE_APPROVED' : 'QUOTE_REJECTED',
        title: decision === quote_model_1.QuoteStatus.APPROVED ? 'Quote approved' : 'Quote rejected',
        message: decision === quote_model_1.QuoteStatus.APPROVED
            ? 'The client approved the quote. Payment is still required before work can begin.'
            : 'The client rejected the quote. Create a revision if appropriate.',
        metadata: {
            feed: 'inbox',
            documentType: 'QUOTE',
            bookingId: booking.id,
            quoteId: updated.id,
            quoteNumber: updated.quoteNumber || buildQuoteNumber(updated._id, Number(updated.version || 1)),
            version: updated.version,
        },
    });
    await (0, audit_service_1.logAuditEvent)(request, {
        action: decision === quote_model_1.QuoteStatus.APPROVED ? 'quote.approved' : 'quote.rejected',
        module: 'BOOKINGS',
        resourceType: 'JobQuote',
        resourceId: updated.id,
        metadata: { bookingId: booking.id, version: updated.version },
    });
    response.status(200).json({ success: true, quote: serializeQuote(updated) });
};
const approveJobQuote = async (request, response) => {
    await decideJobQuote(request, response, quote_model_1.QuoteStatus.APPROVED);
};
exports.approveJobQuote = approveJobQuote;
const rejectJobQuote = async (request, response) => {
    await decideJobQuote(request, response, quote_model_1.QuoteStatus.REJECTED);
};
exports.rejectJobQuote = rejectJobQuote;
const requestQuoteClarification = async (request, response) => {
    const { quoteId } = request.params;
    const userId = getUserId(request);
    const role = (0, user_model_1.normalizeUserRole)(getAuthUser(request)?.role);
    const body = request.body;
    const message = typeof body.message === 'string' ? body.message.trim() : typeof body.note === 'string' ? body.note.trim() : '';
    if (!message) {
        response.status(400).json({ message: 'Clarification message is required.' });
        return;
    }
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
    if (!isOwnerOrAdmin(booking, userId, role)) {
        response.status(403).json({ message: 'Only the booking owner can request quote clarification.' });
        return;
    }
    if (!isQuoteSubmittedStatus(quote.status)) {
        response.status(409).json({ message: 'Only submitted quotes can receive clarification requests.' });
        return;
    }
    const now = new Date();
    const updated = await quote_model_1.default.findOneAndUpdate({ _id: quote._id, status: { $in: [quote_model_1.QuoteStatus.SUBMITTED, quote_model_1.QuoteStatus.SENT_TO_CLIENT] }, isCurrent: { $ne: false } }, {
        $set: {
            status: quote_model_1.QuoteStatus.CLARIFICATION_REQUESTED,
            clarificationRequestedAt: now,
            clientDecisionNote: message.slice(0, 1000),
            decisionBy: new mongoose_1.default.Types.ObjectId(userId),
        },
    }, { new: true });
    if (!updated) {
        response.status(409).json({ message: 'Quote state changed before clarification could be requested.' });
        return;
    }
    emitQuoteEvent(request, 'quote_clarification_requested', updated);
    await (0, notification_service_1.createNotifications)({
        userId: booking.technicianId,
        channels: [notification_model_1.NotificationChannel.IN_APP, notification_model_1.NotificationChannel.PUSH],
        type: 'QUOTE_CLARIFICATION_REQUESTED',
        title: 'Client requested clarification',
        message: 'The client requested clarification. Create a revised quote instead of editing the submitted quote.',
        metadata: {
            feed: 'inbox',
            documentType: 'QUOTE',
            bookingId: booking.id,
            quoteId: updated.id,
            quoteNumber: updated.quoteNumber || buildQuoteNumber(updated._id, Number(updated.version || 1)),
            version: updated.version,
        },
    });
    await (0, audit_service_1.logAuditEvent)(request, {
        action: 'quote.clarification_requested',
        module: 'BOOKINGS',
        resourceType: 'JobQuote',
        resourceId: updated.id,
        metadata: { bookingId: booking.id, version: updated.version },
    });
    response.status(200).json({ success: true, quote: serializeQuote(updated) });
};
exports.requestQuoteClarification = requestQuoteClarification;
//# sourceMappingURL=quote.controller.js.map