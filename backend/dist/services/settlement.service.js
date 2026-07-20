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
exports.processPaystackTransferWebhookPayload = exports.retrySettlementPayout = exports.listSettlements = exports.releaseSettlementHold = exports.holdSettlement = exports.approveSettlement = exports.reportCompletionIssue = exports.confirmCustomerCompletion = exports.submitProviderCompletion = exports.SettlementError = void 0;
const crypto_1 = __importDefault(require("crypto"));
const mongoose_1 = __importDefault(require("mongoose"));
const booking_model_1 = __importStar(require("../models/booking.model"));
const payment_transaction_model_1 = __importStar(require("../models/payment-transaction.model"));
const provider_settlement_model_1 = __importStar(require("../models/provider-settlement.model"));
const payout_transaction_model_1 = __importStar(require("../models/payout-transaction.model"));
const provider_payout_method_model_1 = __importStar(require("../models/provider-payout-method.model"));
const job_media_model_1 = __importStar(require("../models/job-media.model"));
const billing_model_1 = require("../models/billing.model");
const payment_capabilities_config_1 = require("../config/payment-capabilities.config");
const booking_workflow_service_1 = require("./booking-workflow.service");
const paystack_service_1 = require("./paystack.service");
const audit_service_1 = require("./audit.service");
const notification_service_1 = require("./notification.service");
const notification_model_1 = require("../models/notification.model");
const market_finance_guard_service_1 = require("./market-finance-guard.service");
class SettlementError extends Error {
    code;
    statusCode;
    constructor(message, code, statusCode = 400) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
    }
}
exports.SettlementError = SettlementError;
const actorId = (actor) => String(actor?.id ?? actor?._id ?? '').trim();
const transferEnabled = () => ['1', 'true', 'yes', 'on'].includes(String(process.env.PAYSTACK_TRANSFERS_ENABLED || 'false').toLowerCase());
const autoConfirmHours = () => Math.max(1, Number(process.env.COMPLETION_AUTO_CONFIRM_HOURS || 72));
const maskReference = (reference) => reference.length <= 10 ? `${reference.slice(0, 3)}...` : `${reference.slice(0, 6)}...${reference.slice(-4)}`;
const serializeSettlement = (settlement) => ({
    id: settlement.id,
    bookingId: settlement.bookingId.toString(),
    technicianId: settlement.technicianId.toString(),
    customerId: settlement.customerId.toString(),
    countryCode: settlement.countryCode,
    currency: settlement.currency,
    grossAmountMinor: settlement.grossAmountMinor,
    commissionBps: settlement.commissionBps,
    commissionAmountMinor: settlement.commissionAmountMinor,
    processingFeeMinor: settlement.processingFeeMinor,
    netAmountMinor: settlement.netAmountMinor,
    status: settlement.status,
    completionConfirmedAt: settlement.completionConfirmedAt,
    readyForPayoutAt: settlement.readyForPayoutAt,
    approvedAt: settlement.approvedAt,
    paidAt: settlement.paidAt,
    holdReason: settlement.holdReason || '',
    payoutMethodId: settlement.payoutMethodId?.toString() || null,
    payoutTransactionId: settlement.payoutTransactionId?.toString() || null,
    createdAt: settlement.createdAt,
    updatedAt: settlement.updatedAt,
    metadata: settlement.metadata || {},
});
const ensureObjectId = (value, label) => {
    if (!mongoose_1.default.Types.ObjectId.isValid(value))
        throw new SettlementError(`Invalid ${label}.`, 'INVALID_ID');
};
const loadBooking = async (bookingId) => {
    ensureObjectId(bookingId, 'booking id');
    const booking = await booking_model_1.default.findById(bookingId);
    if (!booking)
        throw new SettlementError('Booking not found.', 'BOOKING_NOT_FOUND', 404);
    return booking;
};
const latestSuccessfulPayment = async (booking) => {
    const payment = await payment_transaction_model_1.default.findOne({
        bookingId: booking._id,
        provider: payment_transaction_model_1.PaymentProvider.PAYSTACK,
        status: payment_transaction_model_1.PaymentTransactionStatus.SUCCESS,
    }).sort({ verifiedAt: -1, createdAt: -1 });
    if (!payment)
        throw new SettlementError('Verified payment is required before completion settlement.', 'PAYMENT_NOT_SECURED', 409);
    return payment;
};
const assertAssignedTechnician = (booking, actor) => {
    if (String(booking.technicianId || '') !== actorId(actor)) {
        throw new SettlementError('Only the assigned technician can perform this action.', 'UNASSIGNED_TECHNICIAN', 403);
    }
};
const assertBookingOwner = (booking, actor) => {
    if (String(booking.customerId || '') !== actorId(actor)) {
        throw new SettlementError('Only the booking owner can perform this action.', 'UNAUTHORIZED_CUSTOMER', 403);
    }
};
const validateEvidence = async (booking, mediaIds) => {
    if (mediaIds.length === 0)
        throw new SettlementError('Completion evidence photo is required.', 'COMPLETION_EVIDENCE_REQUIRED');
    const validIds = mediaIds.filter((id) => mongoose_1.default.Types.ObjectId.isValid(id));
    if (validIds.length !== mediaIds.length)
        throw new SettlementError('Invalid evidence media id.', 'INVALID_MEDIA_ID');
    const count = await job_media_model_1.default.countDocuments({
        _id: { $in: validIds },
        bookingId: booking._id,
        uploadedByUserId: booking.technicianId,
        purpose: job_media_model_1.JobMediaPurpose.PROOF_OF_COMPLETION,
    });
    if (count !== mediaIds.length)
        throw new SettlementError('Completion evidence must belong to this booking and technician.', 'INVALID_COMPLETION_EVIDENCE');
};
const submitProviderCompletion = async (bookingId, actor, input, req) => {
    const booking = await loadBooking(bookingId);
    assertAssignedTechnician(booking, actor);
    if (booking.status !== booking_model_1.BookingStatus.IN_PROGRESS)
        throw new SettlementError('Completion can only be submitted after work has started.', 'BOOKING_NOT_IN_PROGRESS', 409);
    if (booking.paymentStatus !== booking_model_1.BookingPaymentStatus.SECURED)
        throw new SettlementError('Payment must be secured before completion can be submitted.', 'PAYMENT_NOT_SECURED', 409);
    if ((booking.completion?.status === booking_model_1.CompletionStatus.CUSTOMER_CONFIRMATION_PENDING || booking.completion?.status === booking_model_1.CompletionStatus.PROVIDER_SUBMITTED) && booking.completion?.submittedAt) {
        return { booking, duplicate: true };
    }
    const notes = input.completionNotes.trim();
    if (notes.length < 5)
        throw new SettlementError('Completion notes are required.', 'COMPLETION_NOTES_REQUIRED');
    const payment = await latestSuccessfulPayment(booking);
    if (!Number.isInteger(input.finalAmountMinor) || input.finalAmountMinor !== payment.amountMinor) {
        throw new SettlementError('Final amount must match the approved paid amount.', 'FINAL_AMOUNT_MISMATCH', 409);
    }
    const evidenceMediaIds = input.evidenceMediaIds || [];
    await validateEvidence(booking, evidenceMediaIds);
    const now = new Date();
    const autoConfirmEligibleAt = new Date(now.getTime() + autoConfirmHours() * 60 * 60 * 1000);
    const updated = await booking_model_1.default.findOneAndUpdate({
        _id: booking._id,
        technicianId: new mongoose_1.default.Types.ObjectId(actorId(actor)),
        status: booking_model_1.BookingStatus.IN_PROGRESS,
        paymentStatus: booking_model_1.BookingPaymentStatus.SECURED,
        $or: [{ 'completion.status': { $exists: false } }, { 'completion.status': booking_model_1.CompletionStatus.NOT_SUBMITTED }],
    }, {
        $set: {
            completion: {
                status: booking_model_1.CompletionStatus.CUSTOMER_CONFIRMATION_PENDING,
                submittedBy: new mongoose_1.default.Types.ObjectId(actorId(actor)),
                submittedAt: now,
                completionNotes: notes,
                partsUsed: input.partsUsed || [],
                evidenceMediaIds: evidenceMediaIds.map((id) => new mongoose_1.default.Types.ObjectId(id)),
                finalAmountMinor: input.finalAmountMinor,
                currency: booking.currency,
                autoConfirmEligibleAt,
            },
        },
    }, { new: true });
    if (!updated)
        throw new SettlementError('Completion was already submitted or booking state changed.', 'COMPLETION_CONFLICT', 409);
    req?.app.get('io')?.to(`booking:${booking.id}`).emit('completion_submitted', {
        bookingId: booking.id,
        completionStatus: booking_model_1.CompletionStatus.CUSTOMER_CONFIRMATION_PENDING,
        finalAmountMinor: input.finalAmountMinor,
        currency: booking.currency,
    });
    if (req)
        await (0, audit_service_1.logAuditEvent)(req, {
            action: 'completion.submit',
            module: 'BOOKINGS',
            resourceType: 'Booking',
            resourceId: booking.id,
            metadata: { bookingId: booking.id, finalAmountMinor: input.finalAmountMinor, idempotencyKey: input.idempotencyKey || '' },
        });
    void (0, notification_service_1.createNotifications)({
        userId: booking.customerId,
        email: booking.customerEmail,
        name: booking.customerName,
        channels: [notification_model_1.NotificationChannel.IN_APP, notification_model_1.NotificationChannel.PUSH],
        type: 'COMPLETION_SUBMITTED',
        title: 'Provider marked the work complete',
        message: 'Inspect the work before confirming completion in MyFixer.',
        metadata: { bookingId: booking.id },
    }).catch(() => undefined);
    return { booking: updated, duplicate: false };
};
exports.submitProviderCompletion = submitProviderCompletion;
const createSettlementFromBooking = async (booking, payment, status) => {
    const market = await (0, market_finance_guard_service_1.assertActiveMarket)(booking.countryCode);
    const invoice = await billing_model_1.Invoice.findOne({ bookingId: booking._id }).lean();
    const invoiceBreakdown = invoice?.metadata?.priceBreakdown && typeof invoice.metadata.priceBreakdown === 'object'
        ? invoice.metadata.priceBreakdown
        : null;
    const bookingBreakdown = booking.metadata?.priceBreakdown && typeof booking.metadata.priceBreakdown === 'object'
        ? booking.metadata.priceBreakdown
        : null;
    const priceBreakdown = invoiceBreakdown || bookingBreakdown || null;
    const grossAmountMinor = typeof priceBreakdown?.technicianGrossMinor === 'number'
        ? Math.max(0, Math.round(priceBreakdown.technicianGrossMinor))
        : payment.amountMinor;
    const commissionBps = market.pricing.platformCommissionBps;
    const commissionAmountMinor = typeof priceBreakdown?.platformCommissionMinor === 'number'
        ? Math.max(0, Math.round(priceBreakdown.platformCommissionMinor))
        : Math.round((grossAmountMinor * commissionBps) / 10000);
    const processingFeeMinor = 0;
    const netAmountMinor = typeof priceBreakdown?.technicianNetMinor === 'number'
        ? Math.max(0, Math.round(priceBreakdown.technicianNetMinor))
        : Math.max(grossAmountMinor - commissionAmountMinor - processingFeeMinor, 0);
    const settlement = await provider_settlement_model_1.default.findOneAndUpdate({ bookingId: booking._id }, {
        $setOnInsert: {
            bookingId: booking._id,
            customerId: booking.customerId,
            technicianId: booking.technicianId,
            quoteId: payment.quoteId || null,
            paymentTransactionId: payment._id,
            countryCode: booking.countryCode,
            currency: booking.currency,
            grossAmountMinor,
            commissionBps,
            commissionAmountMinor,
            processingFeeMinor,
            netAmountMinor,
            completionConfirmedAt: new Date(),
            readyForPayoutAt: new Date(),
            metadata: {
                paymentReference: maskReference(payment.reference),
                feePolicy: 'market.platformCommissionBps',
                priceBreakdown: priceBreakdown || null,
                promotion: invoice?.metadata?.promotion || booking.metadata?.promotion || null,
                promotions: invoice?.metadata?.promotions || booking.metadata?.promotions || [],
            },
        },
        $set: { status },
    }, { new: true, upsert: true, setDefaultsOnInsert: true });
    return settlement;
};
const confirmCustomerCompletion = async (bookingId, actor, input, req) => {
    let booking = await loadBooking(bookingId);
    assertBookingOwner(booking, actor);
    if (booking.status === booking_model_1.BookingStatus.COMPLETED && booking.completion?.status === booking_model_1.CompletionStatus.CUSTOMER_CONFIRMED) {
        const existing = await provider_settlement_model_1.default.findOne({ bookingId: booking._id });
        return { booking, settlement: existing, duplicate: true };
    }
    if (booking.completion?.status !== booking_model_1.CompletionStatus.CUSTOMER_CONFIRMATION_PENDING) {
        throw new SettlementError('Completion is not awaiting customer confirmation.', 'COMPLETION_NOT_PENDING', 409);
    }
    const payment = await latestSuccessfulPayment(booking);
    const now = new Date();
    const updated = await booking_model_1.default.findOneAndUpdate({
        _id: booking._id,
        customerId: new mongoose_1.default.Types.ObjectId(actorId(actor)),
        status: booking_model_1.BookingStatus.IN_PROGRESS,
        'completion.status': booking_model_1.CompletionStatus.CUSTOMER_CONFIRMATION_PENDING,
        paymentStatus: booking_model_1.BookingPaymentStatus.SECURED,
    }, {
        $set: {
            'completion.status': booking_model_1.CompletionStatus.CUSTOMER_CONFIRMED,
            'completion.customerConfirmedBy': new mongoose_1.default.Types.ObjectId(actorId(actor)),
            'completion.customerConfirmedAt': now,
        },
    }, { new: true });
    if (!updated)
        throw new SettlementError('Completion confirmation conflict.', 'COMPLETION_CONFIRMATION_CONFLICT', 409);
    const completedBooking = await (0, booking_workflow_service_1.transitionBookingStatus)({
        booking: updated,
        actor: { id: actorId(actor), role: String(actor?.role || '') },
        nextStatus: booking_model_1.BookingStatus.COMPLETED,
        action: 'COMPLETE_JOB',
    });
    const flags = (0, payment_capabilities_config_1.getCountryPaymentFeatureFlags)(completedBooking.countryCode);
    const settlement = await createSettlementFromBooking(completedBooking, payment, flags.adminApprovalRequired ? provider_settlement_model_1.ProviderSettlementStatus.APPROVAL_REQUIRED : provider_settlement_model_1.ProviderSettlementStatus.READY_FOR_PAYOUT);
    req?.app.get('io')?.to(`booking:${completedBooking.id}`).emit('completion_confirmed', {
        bookingId: completedBooking.id,
        status: completedBooking.status,
        completionStatus: booking_model_1.CompletionStatus.CUSTOMER_CONFIRMED,
        settlementStatus: settlement.status,
    });
    req?.app.get('io')?.to(`technician:${completedBooking.technicianId?.toString()}`).emit('settlement_created', serializeSettlement(settlement));
    if (req)
        await (0, audit_service_1.logAuditEvent)(req, {
            action: 'completion.confirm',
            module: 'BOOKINGS',
            resourceType: 'Booking',
            resourceId: completedBooking.id,
            metadata: { bookingId: completedBooking.id, settlementId: settlement.id, idempotencyKey: input.idempotencyKey || '' },
        });
    return { booking: completedBooking, settlement, duplicate: false };
};
exports.confirmCustomerCompletion = confirmCustomerCompletion;
const reportCompletionIssue = async (bookingId, actor, input, req) => {
    const booking = await loadBooking(bookingId);
    assertBookingOwner(booking, actor);
    const reason = input.reason.trim();
    if (reason.length < 8)
        throw new SettlementError('Issue reason is required.', 'ISSUE_REASON_REQUIRED');
    if (booking.completion?.status !== booking_model_1.CompletionStatus.CUSTOMER_CONFIRMATION_PENDING) {
        throw new SettlementError('Issue reporting is available only while completion is awaiting confirmation.', 'ISSUE_INVALID_STATE', 409);
    }
    const updated = await booking_model_1.default.findOneAndUpdate({ _id: booking._id, customerId: new mongoose_1.default.Types.ObjectId(actorId(actor)), 'completion.status': booking_model_1.CompletionStatus.CUSTOMER_CONFIRMATION_PENDING }, {
        $set: {
            'completion.status': booking_model_1.CompletionStatus.ISSUE_REPORTED,
            'completion.issueReportedBy': new mongoose_1.default.Types.ObjectId(actorId(actor)),
            'completion.issueReportedAt': new Date(),
            'completion.issueReason': reason,
        },
    }, { new: true });
    if (!updated)
        throw new SettlementError('Completion issue conflict.', 'ISSUE_CONFLICT', 409);
    await provider_settlement_model_1.default.findOneAndUpdate({ bookingId: booking._id }, {
        $set: {
            status: provider_settlement_model_1.ProviderSettlementStatus.ON_HOLD,
            holdReason: 'CUSTOMER_ISSUE',
            heldAt: new Date(),
            heldBy: new mongoose_1.default.Types.ObjectId(actorId(actor)),
        },
    }, { new: true });
    req?.app.get('io')?.to(`booking:${booking.id}`).emit('completion_issue_reported', { bookingId: booking.id });
    if (req)
        await (0, audit_service_1.logAuditEvent)(req, {
            action: 'completion.issue_reported',
            module: 'BOOKINGS',
            resourceType: 'Booking',
            resourceId: booking.id,
            metadata: { bookingId: booking.id, reasonCode: 'CUSTOMER_ISSUE' },
        });
    return { booking: updated };
};
exports.reportCompletionIssue = reportCompletionIssue;
const generatePayoutReference = (settlementId) => `mfx_po_${settlementId.slice(-8)}_${Date.now()}_${crypto_1.default.randomBytes(4).toString('hex')}`;
const initiatePayoutForSettlement = async (settlement, actor, req) => {
    if (!transferEnabled())
        throw new SettlementError('Paystack transfers are disabled.', 'PAYOUTS_DISABLED', 409);
    await (0, market_finance_guard_service_1.assertMarketAllowsNewPayout)(settlement.countryCode, settlement.currency, payment_transaction_model_1.PaymentProvider.PAYSTACK);
    const method = await provider_payout_method_model_1.default.findOne({
        technicianId: settlement.technicianId,
        countryCode: settlement.countryCode,
        currency: settlement.currency,
        status: provider_payout_method_model_1.ProviderPayoutMethodStatus.VERIFIED,
        isDefault: true,
    });
    if (!method || !method.providerRecipientCode) {
        throw new SettlementError('A verified default payout method is required.', 'VERIFIED_PAYOUT_METHOD_REQUIRED', 409);
    }
    const reference = generatePayoutReference(settlement.id);
    const payout = await payout_transaction_model_1.default.create({
        provider: method.provider,
        reference,
        settlementId: settlement._id,
        bookingId: settlement.bookingId,
        technicianId: settlement.technicianId,
        payoutMethodId: method._id,
        countryCode: settlement.countryCode,
        currency: settlement.currency,
        amountMinor: settlement.netAmountMinor,
        status: payout_transaction_model_1.PayoutTransactionStatus.INITIALIZED,
        recipientSnapshot: {
            type: method.type,
            maskedDestination: method.maskedDestination,
            providerRecipientCode: method.providerRecipientCode,
        },
        initiatedBy: actorId(actor) && mongoose_1.default.Types.ObjectId.isValid(actorId(actor)) ? new mongoose_1.default.Types.ObjectId(actorId(actor)) : null,
        initiatedAt: new Date(),
        idempotencyKey: `settlement:${settlement.id}:amount:${settlement.netAmountMinor}`,
        metadata: {},
    });
    const transfer = await paystack_service_1.PaystackService.initiateTransfer({
        amountMinor: settlement.netAmountMinor,
        currency: settlement.currency,
        recipientCode: method.providerRecipientCode,
        reference,
        reason: `MyFixer provider payout for booking ${settlement.bookingId.toString()}`,
    });
    payout.status = payout_transaction_model_1.PayoutTransactionStatus.PROCESSING;
    payout.providerStatus = String(transfer?.data?.status || 'processing');
    payout.providerTransferCode = String(transfer?.data?.transfer_code || '');
    await payout.save();
    settlement.status = provider_settlement_model_1.ProviderSettlementStatus.PAYOUT_PROCESSING;
    settlement.payoutMethodId = method._id;
    settlement.payoutTransactionId = payout._id;
    settlement.metadata = {
        ...(settlement.metadata || {}),
        payoutDestinationSnapshot: {
            type: method.type,
            maskedDestination: method.maskedDestination,
            providerRecipientCode: method.providerRecipientCode,
        },
    };
    await settlement.save();
    req?.app.get('io')?.to(`technician:${settlement.technicianId.toString()}`).emit('payout_processing', serializeSettlement(settlement));
    return { payout, settlement };
};
const approveSettlement = async (settlementId, actor, input, req) => {
    ensureObjectId(settlementId, 'settlement id');
    const reason = input.reason.trim();
    if (reason.length < 5)
        throw new SettlementError('Admin approval reason is required.', 'APPROVAL_REASON_REQUIRED');
    const settlement = await provider_settlement_model_1.default.findOne({ _id: settlementId });
    if (!settlement)
        throw new SettlementError('Settlement not found.', 'SETTLEMENT_NOT_FOUND', 404);
    if (settlement.status === provider_settlement_model_1.ProviderSettlementStatus.PAYOUT_PROCESSING || settlement.status === provider_settlement_model_1.ProviderSettlementStatus.PAID) {
        return { settlement, duplicate: true };
    }
    if (![provider_settlement_model_1.ProviderSettlementStatus.APPROVAL_REQUIRED, provider_settlement_model_1.ProviderSettlementStatus.READY_FOR_PAYOUT, provider_settlement_model_1.ProviderSettlementStatus.PAYOUT_FAILED].includes(settlement.status)) {
        throw new SettlementError('Settlement is not eligible for approval.', 'SETTLEMENT_NOT_ELIGIBLE', 409);
    }
    if (settlement.holdReason)
        throw new SettlementError('Settlement is on hold.', 'SETTLEMENT_ON_HOLD', 409);
    const booking = await booking_model_1.default.findById(settlement.bookingId);
    if (!booking || booking.paymentStatus !== booking_model_1.BookingPaymentStatus.SECURED || booking.completion?.status !== booking_model_1.CompletionStatus.CUSTOMER_CONFIRMED) {
        throw new SettlementError('Settlement eligibility checks failed.', 'SETTLEMENT_ELIGIBILITY_FAILED', 409);
    }
    settlement.status = provider_settlement_model_1.ProviderSettlementStatus.APPROVED;
    settlement.approvedAt = settlement.approvedAt || new Date();
    settlement.approvedBy = actorId(actor) && mongoose_1.default.Types.ObjectId.isValid(actorId(actor)) ? new mongoose_1.default.Types.ObjectId(actorId(actor)) : null;
    settlement.metadata = { ...(settlement.metadata || {}), approvalReason: reason };
    await settlement.save();
    if (req)
        await (0, audit_service_1.logAuditEvent)(req, {
            action: 'settlement.approve',
            module: 'PAYMENTS',
            resourceType: 'ProviderSettlement',
            resourceId: settlement.id,
            metadata: { settlementId: settlement.id, bookingId: settlement.bookingId.toString(), reason },
        });
    const result = await initiatePayoutForSettlement(settlement, actor, req);
    return { ...result, duplicate: false };
};
exports.approveSettlement = approveSettlement;
const holdSettlement = async (settlementId, actor, reason, req) => {
    const trimmed = reason.trim();
    if (trimmed.length < 5)
        throw new SettlementError('Hold reason is required.', 'HOLD_REASON_REQUIRED');
    const settlement = await provider_settlement_model_1.default.findOneAndUpdate({ _id: settlementId, status: { $nin: [provider_settlement_model_1.ProviderSettlementStatus.PAID, provider_settlement_model_1.ProviderSettlementStatus.PAYOUT_PROCESSING] } }, {
        $set: {
            status: provider_settlement_model_1.ProviderSettlementStatus.ON_HOLD,
            holdReason: trimmed,
            heldAt: new Date(),
            heldBy: actorId(actor) && mongoose_1.default.Types.ObjectId.isValid(actorId(actor)) ? new mongoose_1.default.Types.ObjectId(actorId(actor)) : null,
        },
    }, { new: true });
    if (!settlement)
        throw new SettlementError('Settlement cannot be placed on hold.', 'HOLD_CONFLICT', 409);
    req?.app.get('io')?.to(`technician:${settlement.technicianId.toString()}`).emit('settlement_on_hold', serializeSettlement(settlement));
    return settlement;
};
exports.holdSettlement = holdSettlement;
const releaseSettlementHold = async (settlementId, actor, reason) => {
    const settlement = await provider_settlement_model_1.default.findOneAndUpdate({ _id: settlementId, status: provider_settlement_model_1.ProviderSettlementStatus.ON_HOLD }, {
        $set: {
            status: provider_settlement_model_1.ProviderSettlementStatus.APPROVAL_REQUIRED,
            releasedFromHoldAt: new Date(),
            'metadata.releaseReason': reason.trim(),
            'metadata.releasedBy': actorId(actor),
        },
        $unset: { holdReason: '' },
    }, { new: true });
    if (!settlement)
        throw new SettlementError('Settlement hold could not be released.', 'RELEASE_HOLD_CONFLICT', 409);
    return settlement;
};
exports.releaseSettlementHold = releaseSettlementHold;
const listSettlements = async (filter = {}) => {
    const settlements = await provider_settlement_model_1.default.find(filter).sort({ createdAt: -1 }).limit(200);
    return settlements.map(serializeSettlement);
};
exports.listSettlements = listSettlements;
const retrySettlementPayout = async (settlementId, actor, reason, req) => {
    const settlement = await provider_settlement_model_1.default.findOne({ _id: settlementId, status: provider_settlement_model_1.ProviderSettlementStatus.PAYOUT_FAILED });
    if (!settlement)
        throw new SettlementError('Only failed payouts can be retried.', 'RETRY_NOT_ALLOWED', 409);
    settlement.status = provider_settlement_model_1.ProviderSettlementStatus.APPROVAL_REQUIRED;
    settlement.metadata = { ...(settlement.metadata || {}), retryReason: reason.trim() };
    await settlement.save();
    return (0, exports.approveSettlement)(settlement.id, actor, { reason: reason || 'Retry approved payout' }, req);
};
exports.retrySettlementPayout = retrySettlementPayout;
const processPaystackTransferWebhookPayload = async (payload, req) => {
    const eventType = String(payload?.event || '');
    const data = payload?.data || {};
    const reference = String(data.reference || '');
    const transferCode = String(data.transfer_code || '');
    const payout = await payout_transaction_model_1.default.findOne({
        $or: [{ reference }, ...(transferCode ? [{ providerTransferCode: transferCode }] : [])],
    });
    if (!payout)
        return { processed: false };
    if (payout.status === payout_transaction_model_1.PayoutTransactionStatus.SUCCESS && eventType === 'transfer.success')
        return { processed: true, duplicate: true };
    const settlement = await provider_settlement_model_1.default.findById(payout.settlementId);
    if (!settlement)
        return { processed: false };
    if (eventType === 'transfer.success') {
        let verified = null;
        try {
            verified = await paystack_service_1.PaystackService.verifyTransfer(reference || transferCode);
        }
        catch {
            verified = null;
        }
        const providerAmount = Number(verified?.data?.amount ?? data.amount);
        const providerCurrency = String(verified?.data?.currency ?? data.currency ?? payout.currency).toUpperCase();
        const amountMatches = providerAmount === payout.amountMinor;
        const currencyMatches = providerCurrency === payout.currency;
        if (!amountMatches || !currencyMatches) {
            payout.status = payout_transaction_model_1.PayoutTransactionStatus.UNDER_REVIEW;
            payout.providerStatus = 'mismatch';
            payout.verifiedAt = new Date();
            payout.metadata = { ...(payout.metadata || {}), amountMatches, currencyMatches, providerAmount, providerCurrency };
            await payout.save();
            settlement.status = provider_settlement_model_1.ProviderSettlementStatus.UNDER_REVIEW;
            await settlement.save();
            return { processed: true };
        }
        const now = new Date();
        payout.status = payout_transaction_model_1.PayoutTransactionStatus.SUCCESS;
        payout.providerStatus = String(verified?.data?.status || data.status || 'success');
        payout.succeededAt = payout.succeededAt || now;
        payout.verifiedAt = now;
        await payout.save();
        settlement.status = provider_settlement_model_1.ProviderSettlementStatus.PAID;
        settlement.paidAt = settlement.paidAt || now;
        await settlement.save();
        req?.app.get('io')?.to(`technician:${settlement.technicianId.toString()}`).emit('payout_paid', serializeSettlement(settlement));
        return { processed: true };
    }
    if (['transfer.failed', 'transfer.reversed'].includes(eventType)) {
        const reversed = eventType === 'transfer.reversed';
        payout.status = reversed ? payout_transaction_model_1.PayoutTransactionStatus.REVERSED : payout_transaction_model_1.PayoutTransactionStatus.FAILED;
        payout.providerStatus = String(data.status || eventType);
        if (reversed)
            payout.reversedAt = new Date();
        else
            payout.failedAt = new Date();
        await payout.save();
        settlement.status = reversed ? provider_settlement_model_1.ProviderSettlementStatus.REVERSED : provider_settlement_model_1.ProviderSettlementStatus.PAYOUT_FAILED;
        await settlement.save();
        req?.app.get('io')?.to(`technician:${settlement.technicianId.toString()}`).emit(reversed ? 'payout_reversed' : 'payout_failed', serializeSettlement(settlement));
        return { processed: true };
    }
    return { processed: false };
};
exports.processPaystackTransferWebhookPayload = processPaystackTransferWebhookPayload;
//# sourceMappingURL=settlement.service.js.map