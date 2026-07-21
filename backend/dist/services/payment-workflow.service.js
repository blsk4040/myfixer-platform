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
exports.maskPaymentReference = exports.processPaystackWebhookPayload = exports.verifyAndSecurePayment = exports.recordWebhookEvent = exports.payloadHash = exports.initializeBookingPayment = exports.PaymentWorkflowError = void 0;
const crypto_1 = __importDefault(require("crypto"));
const mongoose_1 = __importDefault(require("mongoose"));
const booking_model_1 = __importStar(require("../models/booking.model"));
const quote_model_1 = __importStar(require("../models/quote.model"));
const payment_transaction_model_1 = __importStar(require("../models/payment-transaction.model"));
const payment_webhook_event_model_1 = __importStar(require("../models/payment-webhook-event.model"));
const user_model_1 = require("../models/user.model");
const paystack_service_1 = require("./paystack.service");
const inspection_workflow_service_1 = require("./inspection-workflow.service");
const notification_service_1 = require("./notification.service");
const notification_model_1 = require("../models/notification.model");
const audit_service_1 = require("./audit.service");
const market_finance_guard_service_1 = require("./market-finance-guard.service");
const promotion_campaign_service_1 = require("./promotion-campaign.service");
class PaymentWorkflowError extends Error {
    code;
    statusCode;
    constructor(message, code, statusCode = 400) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
    }
}
exports.PaymentWorkflowError = PaymentWorkflowError;
const actorId = (actor) => String(actor?.id ?? actor?._id ?? '').trim();
const maskReference = (reference) => reference.length <= 10 ? `${reference.slice(0, 3)}...` : `${reference.slice(0, 6)}...${reference.slice(-4)}`;
const generateReference = (bookingId) => `mfx_${bookingId.slice(-8)}_${Date.now()}_${crypto_1.default.randomBytes(5).toString('hex')}`;
const terminalBookingStatuses = new Set([booking_model_1.BookingStatus.COMPLETED, booking_model_1.BookingStatus.CANCELLED]);
const loadBookingForPayment = async (bookingId) => {
    if (!mongoose_1.default.Types.ObjectId.isValid(bookingId)) {
        throw new PaymentWorkflowError('Invalid booking id.', 'INVALID_BOOKING_ID');
    }
    const booking = await booking_model_1.default.findById(bookingId);
    if (!booking) {
        throw new PaymentWorkflowError('Booking not found.', 'BOOKING_NOT_FOUND', 404);
    }
    return booking;
};
const assertClientCanPay = (booking, actor) => {
    const role = (0, user_model_1.normalizeUserRole)(actor?.role);
    const id = actorId(actor);
    if (role !== user_model_1.UserRole.ADMIN && String(booking.customerId) !== id) {
        throw new PaymentWorkflowError('Only the booking owner can initialize payment.', 'PAYMENT_UNAUTHORIZED', 403);
    }
};
const getApprovedQuoteAmount = async (booking, quoteId) => {
    const filter = {
        bookingId: booking._id,
        status: quote_model_1.QuoteStatus.APPROVED,
        isCurrent: { $ne: false },
    };
    if (quoteId) {
        if (!mongoose_1.default.Types.ObjectId.isValid(quoteId)) {
            throw new PaymentWorkflowError('Invalid quote id.', 'INVALID_QUOTE_ID');
        }
        filter._id = new mongoose_1.default.Types.ObjectId(quoteId);
    }
    const quote = await quote_model_1.default.findOne(filter).sort({ version: -1, createdAt: -1 });
    if (!quote) {
        throw new PaymentWorkflowError('An approved quote is required before payment.', 'APPROVED_QUOTE_REQUIRED', 409);
    }
    if (quote.expiresAt && quote.expiresAt.getTime() < Date.now()) {
        throw new PaymentWorkflowError('This quote has expired.', 'QUOTE_EXPIRED', 409);
    }
    if (quote.totalAmountMinor <= 0) {
        throw new PaymentWorkflowError('Quote total must be greater than zero.', 'INVALID_PAYMENT_AMOUNT');
    }
    return { quote, amountMinor: quote.totalAmountMinor };
};
const resolvePaymentAmount = async (booking, quoteId) => {
    const quoteRequired = booking.pricingMode !== booking_model_1.PricingMode.FIXED_PRICE || booking.inspection?.quoteRequired === true;
    if (quoteRequired) {
        return getApprovedQuoteAmount(booking, quoteId);
    }
    if (quoteId) {
        return getApprovedQuoteAmount(booking, quoteId);
    }
    if (!Number.isInteger(booking.priceMinor) || booking.priceMinor <= 0) {
        throw new PaymentWorkflowError('Booking price must be greater than zero.', 'INVALID_PAYMENT_AMOUNT');
    }
    return { quote: null, amountMinor: booking.priceMinor };
};
const serializeTransaction = (transaction) => ({
    reference: transaction.reference,
    authorizationUrl: transaction.authorizationUrl,
    accessCode: transaction.accessCode,
    amountMinor: transaction.amountMinor,
    amount: transaction.amountMinor / 100,
    currency: transaction.currency,
    status: transaction.status,
    priceBreakdown: transaction.metadata?.priceBreakdown || null,
    promotion: transaction.metadata?.promotion || null,
    promotions: Array.isArray(transaction.metadata?.promotions) ? transaction.metadata.promotions : [],
});
const promotionSnapshotsFromTransaction = (transaction) => Array.isArray(transaction.metadata?.promotions)
    ? transaction.metadata.promotions
    : transaction.metadata?.promotion
        ? [transaction.metadata.promotion]
        : [];
const initializeBookingPayment = async (input, actor, req) => {
    const booking = await loadBookingForPayment(input.bookingId);
    assertClientCanPay(booking, actor);
    if (terminalBookingStatuses.has(booking.status)) {
        throw new PaymentWorkflowError('Payment cannot be initialized for a terminal booking.', 'BOOKING_TERMINAL', 409);
    }
    if (booking.paymentStatus === booking_model_1.BookingPaymentStatus.SECURED) {
        throw new PaymentWorkflowError('Payment is already secured for this booking.', 'PAYMENT_ALREADY_SECURED', 409);
    }
    await (0, market_finance_guard_service_1.assertMarketAllowsPaymentCollection)(booking.countryCode, booking.currency, payment_transaction_model_1.PaymentProvider.PAYSTACK);
    const { quote, amountMinor } = await resolvePaymentAmount(booking, input.quoteId);
    const idempotencyKey = (input.idempotencyKey || `booking:${booking.id}:quote:${quote?._id?.toString() || 'fixed'}:amount:${amountMinor}`).trim();
    const existing = await payment_transaction_model_1.default.findOne({
        provider: payment_transaction_model_1.PaymentProvider.PAYSTACK,
        idempotencyKey,
        status: { $in: [payment_transaction_model_1.PaymentTransactionStatus.INITIALIZED, payment_transaction_model_1.PaymentTransactionStatus.PENDING] },
    });
    if (existing) {
        if (req) {
            await (0, audit_service_1.logAuditEvent)(req, {
                action: 'payment.initialize.reused',
                module: 'PAYMENTS',
                resourceType: 'PaymentTransaction',
                resourceId: existing.id,
                metadata: { bookingId: booking.id, maskedReference: maskReference(existing.reference) },
            });
        }
        return { transaction: existing, reused: true, response: serializeTransaction(existing) };
    }
    const reference = generateReference(booking.id);
    const metadata = {
        bookingId: booking.id,
        quoteId: quote?._id?.toString() || null,
        customerId: booking.customerId.toString(),
        promotion: booking.metadata?.promotion || null,
        promotions: Array.isArray(booking.metadata?.promotions) ? booking.metadata.promotions : [],
        priceBreakdown: quote?.metadata?.priceBreakdown || booking.metadata?.priceBreakdown || null,
    };
    let initialized;
    try {
        initialized = await paystack_service_1.PaystackService.initializeTransaction({
            email: booking.customerEmail || actor?.email || '',
            amountMinor,
            currency: booking.currency,
            reference,
            callbackUrl: input.callbackUrl,
            metadata,
        });
    }
    catch (error) {
        const upstream = error?.response;
        const providerCode = String(upstream?.data?.code || '').trim();
        const providerMessage = String(upstream?.data?.message || '').trim();
        throw new PaymentWorkflowError(providerMessage || 'Payment provider could not initialize checkout.', providerCode || 'PAYSTACK_INITIALIZE_FAILED', upstream?.status && upstream.status >= 400 && upstream.status < 500 ? 409 : 502);
    }
    if (!initialized?.status || !initialized?.data?.authorization_url) {
        throw new PaymentWorkflowError('Payment provider could not initialize checkout.', 'PAYSTACK_INITIALIZE_FAILED', 502);
    }
    const transaction = await payment_transaction_model_1.default.create({
        provider: payment_transaction_model_1.PaymentProvider.PAYSTACK,
        reference,
        bookingId: booking._id,
        quoteId: quote?._id ?? null,
        customerId: booking.customerId,
        technicianId: booking.technicianId ?? null,
        amountMinor,
        currency: booking.currency,
        status: payment_transaction_model_1.PaymentTransactionStatus.INITIALIZED,
        providerStatus: 'initialized',
        authorizationUrl: initialized.data.authorization_url,
        accessCode: initialized.data.access_code || '',
        initializedAt: new Date(),
        idempotencyKey,
        metadata,
    });
    await booking_model_1.default.updateOne({ _id: booking._id, paymentStatus: { $ne: booking_model_1.BookingPaymentStatus.SECURED } }, {
        $set: {
            paymentStatus: booking_model_1.BookingPaymentStatus.PENDING,
            'workAuthorization.status': booking_model_1.WorkAuthorizationStatus.AWAITING_PAYMENT,
            'workAuthorization.reasonCode': 'PAYMENT_NOT_SECURED',
            'workAuthorization.evaluatedAt': new Date(),
        },
    });
    if (req) {
        await (0, audit_service_1.logAuditEvent)(req, {
            action: 'payment.initialize',
            module: 'PAYMENTS',
            resourceType: 'PaymentTransaction',
            resourceId: transaction.id,
            metadata: {
                bookingId: booking.id,
                quoteId: quote?._id?.toString() || null,
                amountMinor,
                currency: booking.currency,
                maskedReference: maskReference(reference),
            },
        });
    }
    return { transaction, reused: false, response: serializeTransaction(transaction) };
};
exports.initializeBookingPayment = initializeBookingPayment;
const payloadHash = (rawBody) => crypto_1.default.createHash('sha256').update(rawBody).digest('hex');
exports.payloadHash = payloadHash;
const recordWebhookEvent = async (payload, rawBody) => {
    const hash = (0, exports.payloadHash)(rawBody);
    const eventId = String(payload?.data?.id ?? payload?.id ?? '').trim();
    const eventType = String(payload?.event ?? 'unknown').trim();
    const reference = String(payload?.data?.reference ?? '').trim();
    try {
        const event = await payment_webhook_event_model_1.default.create({
            provider: payment_transaction_model_1.PaymentProvider.PAYSTACK,
            eventType,
            eventId,
            reference,
            payloadHash: hash,
            processed: false,
            processingStatus: payment_webhook_event_model_1.PaymentWebhookProcessingStatus.RECEIVED,
            receivedAt: new Date(),
            metadata: {
                providerStatus: payload?.data?.status,
            },
        });
        return { event, duplicate: false };
    }
    catch (error) {
        if (error?.code === 11000) {
            const event = await payment_webhook_event_model_1.default.findOne({
                provider: payment_transaction_model_1.PaymentProvider.PAYSTACK,
                $or: [{ payloadHash: hash }, ...(eventId ? [{ eventId }] : [])],
            });
            return { event, duplicate: true };
        }
        throw error;
    }
};
exports.recordWebhookEvent = recordWebhookEvent;
const markTransactionFailure = async (transaction, status, providerStatus, metadata = {}) => {
    const now = new Date();
    transaction.status = status;
    transaction.providerStatus = providerStatus;
    transaction.metadata = { ...transaction.metadata, ...metadata };
    if (status === payment_transaction_model_1.PaymentTransactionStatus.FAILED)
        transaction.failedAt = now;
    if (status === payment_transaction_model_1.PaymentTransactionStatus.REFUNDED)
        transaction.refundedAt = now;
    if (status === payment_transaction_model_1.PaymentTransactionStatus.REVERSED)
        transaction.reversedAt = now;
    if (status === payment_transaction_model_1.PaymentTransactionStatus.UNDER_REVIEW)
        transaction.verifiedAt = now;
    await transaction.save();
};
const verifyAndSecurePayment = async (reference, req) => {
    const transaction = await payment_transaction_model_1.default.findOne({ provider: payment_transaction_model_1.PaymentProvider.PAYSTACK, reference });
    if (!transaction) {
        throw new PaymentWorkflowError('Payment reference is unknown.', 'UNKNOWN_PAYMENT_REFERENCE', 404);
    }
    if (transaction.status === payment_transaction_model_1.PaymentTransactionStatus.SUCCESS) {
        return { transaction, duplicate: true };
    }
    const verification = await paystack_service_1.PaystackService.verifyTransaction(reference);
    const data = verification.data;
    const providerStatus = String(data?.status || '').toLowerCase();
    transaction.providerStatus = providerStatus;
    transaction.providerTransactionId = data?.id ? String(data.id) : transaction.providerTransactionId;
    const amountMatches = Number(data?.amount) === transaction.amountMinor;
    const currencyMatches = String(data?.currency || '').toUpperCase() === transaction.currency;
    const referenceMatches = String(data?.reference || '') === transaction.reference;
    if (providerStatus !== 'success') {
        await markTransactionFailure(transaction, payment_transaction_model_1.PaymentTransactionStatus.FAILED, providerStatus || 'failed');
        await booking_model_1.default.updateOne({ _id: transaction.bookingId, paymentStatus: { $ne: booking_model_1.BookingPaymentStatus.SECURED } }, { $set: { paymentStatus: booking_model_1.BookingPaymentStatus.FAILED } });
        req?.app.get('io')?.to(`booking:${transaction.bookingId.toString()}`).emit('payment_failed', {
            bookingId: transaction.bookingId.toString(),
            reference: maskReference(transaction.reference),
            updatedAt: new Date().toISOString(),
        });
        return { transaction, duplicate: false };
    }
    if (!amountMatches || !currencyMatches || !referenceMatches) {
        await markTransactionFailure(transaction, payment_transaction_model_1.PaymentTransactionStatus.UNDER_REVIEW, providerStatus, {
            amountMatches,
            currencyMatches,
            referenceMatches,
            providerAmount: data?.amount,
            providerCurrency: data?.currency,
            providerReference: data?.reference,
        });
        await booking_model_1.default.updateOne({ _id: transaction.bookingId }, {
            $set: {
                paymentStatus: booking_model_1.BookingPaymentStatus.UNDER_REVIEW,
                'workAuthorization.status': booking_model_1.WorkAuthorizationStatus.BLOCKED,
                'workAuthorization.reasonCode': 'PAYMENT_UNDER_REVIEW',
                'workAuthorization.evaluatedAt': new Date(),
            },
        });
        req?.app.get('io')?.to(`booking:${transaction.bookingId.toString()}`).emit('payment_under_review', {
            bookingId: transaction.bookingId.toString(),
            reference: maskReference(transaction.reference),
            updatedAt: new Date().toISOString(),
        });
        return { transaction, duplicate: false };
    }
    const now = new Date();
    const updatedTransaction = await payment_transaction_model_1.default.findOneAndUpdate({
        _id: transaction._id,
        status: { $ne: payment_transaction_model_1.PaymentTransactionStatus.SUCCESS },
    }, {
        $set: {
            status: payment_transaction_model_1.PaymentTransactionStatus.SUCCESS,
            providerStatus: providerStatus,
            providerTransactionId: data?.id ? String(data.id) : '',
            paidAt: data?.paid_at ? new Date(data.paid_at) : now,
            verifiedAt: now,
            metadata: {
                ...transaction.metadata,
                providerGatewayResponse: data?.gateway_response || '',
                providerCustomerEmail: data?.customer?.email || '',
            },
        },
    }, { new: true });
    if (!updatedTransaction) {
        const current = await payment_transaction_model_1.default.findById(transaction._id);
        return { transaction: current || transaction, duplicate: true };
    }
    const booking = await booking_model_1.default.findOneAndUpdate({
        _id: updatedTransaction.bookingId,
        paymentStatus: { $in: [booking_model_1.BookingPaymentStatus.PENDING, booking_model_1.BookingPaymentStatus.FAILED, booking_model_1.BookingPaymentStatus.UNDER_REVIEW] },
    }, {
        $set: {
            paymentStatus: booking_model_1.BookingPaymentStatus.SECURED,
            paymentSecurity: {
                securedAt: now,
                transactionId: updatedTransaction._id,
                provider: payment_transaction_model_1.PaymentProvider.PAYSTACK,
                reference: updatedTransaction.reference,
                amountMinor: updatedTransaction.amountMinor,
                currency: updatedTransaction.currency,
                verifiedAt: now,
            },
        },
    }, { new: true });
    if (booking) {
        const eligibility = await (0, inspection_workflow_service_1.evaluateWorkStartEligibility)(booking);
        await (0, inspection_workflow_service_1.persistWorkStartEligibility)(booking, eligibility);
        const io = req?.app.get('io');
        io?.to(`booking:${booking.id}`).emit('payment_secured', {
            bookingId: booking.id,
            status: booking_model_1.BookingPaymentStatus.SECURED,
            amountMinor: updatedTransaction.amountMinor,
            currency: updatedTransaction.currency,
            reference: maskReference(updatedTransaction.reference),
            workStartEligibility: eligibility,
            updatedAt: now.toISOString(),
        });
        if (mongoose_1.default.connection.readyState === 1)
            void (async () => {
                if (booking.technicianId) {
                    await (0, notification_service_1.createNotifications)({
                        userId: booking.technicianId,
                        channels: [notification_model_1.NotificationChannel.IN_APP, notification_model_1.NotificationChannel.PUSH],
                        type: 'PAYMENT_SECURED',
                        title: 'Payment secured',
                        message: 'Payment is secured in Padi. You may begin work when all other requirements are met.',
                        metadata: { bookingId: booking.id, transactionId: updatedTransaction.id },
                    });
                }
                await (0, notification_service_1.createNotifications)({
                    userId: booking.customerId,
                    email: booking.customerEmail,
                    name: booking.customerName,
                    channels: [notification_model_1.NotificationChannel.IN_APP, notification_model_1.NotificationChannel.PUSH],
                    type: 'PAYMENT_CONFIRMED',
                    title: 'Payment confirmed',
                    message: 'Payment confirmed. The provider can now begin work.',
                    metadata: { bookingId: booking.id, transactionId: updatedTransaction.id },
                });
            })().catch((notificationError) => {
                console.warn('Payment secured but notification dispatch failed:', notificationError);
            });
        if (req) {
            await (0, audit_service_1.logAuditEvent)(req, {
                action: 'payment.verified',
                module: 'PAYMENTS',
                resourceType: 'PaymentTransaction',
                resourceId: updatedTransaction.id,
                metadata: {
                    bookingId: booking.id,
                    maskedReference: maskReference(updatedTransaction.reference),
                    amountMinor: updatedTransaction.amountMinor,
                    currency: updatedTransaction.currency,
                },
            });
        }
    }
    return { transaction: updatedTransaction, duplicate: false };
};
exports.verifyAndSecurePayment = verifyAndSecurePayment;
const processPaystackWebhookPayload = async (payload, rawBody, req) => {
    const { event, duplicate } = await (0, exports.recordWebhookEvent)(payload, rawBody);
    if (!event)
        return { duplicate: true, processed: false };
    if (duplicate && event.processed)
        return { duplicate: true, processed: true };
    event.processingStatus = payment_webhook_event_model_1.PaymentWebhookProcessingStatus.PROCESSING;
    await event.save();
    const eventType = String(payload?.event || '');
    const reference = String(payload?.data?.reference || '');
    try {
        if (eventType === 'charge.success') {
            await (0, exports.verifyAndSecurePayment)(reference, req);
            event.processingStatus = payment_webhook_event_model_1.PaymentWebhookProcessingStatus.PROCESSED;
            event.processed = true;
            event.processedAt = new Date();
            await event.save();
            return { duplicate, processed: true };
        }
        if (['charge.failed', 'charge.abandoned'].includes(eventType)) {
            const transaction = await payment_transaction_model_1.default.findOne({ provider: payment_transaction_model_1.PaymentProvider.PAYSTACK, reference });
            if (transaction && transaction.status !== payment_transaction_model_1.PaymentTransactionStatus.SUCCESS) {
                transaction.status = eventType === 'charge.abandoned' ? payment_transaction_model_1.PaymentTransactionStatus.ABANDONED : payment_transaction_model_1.PaymentTransactionStatus.FAILED;
                transaction.providerStatus = String(payload?.data?.status || eventType);
                transaction.failedAt = new Date();
                await transaction.save();
                const releasedPromotions = await (0, promotion_campaign_service_1.releasePromotionReservations)(promotionSnapshotsFromTransaction(transaction), eventType === 'charge.abandoned' ? 'PAYMENT_ABANDONED' : 'PAYMENT_FAILED');
                await booking_model_1.default.updateOne({ _id: transaction.bookingId, paymentStatus: { $ne: booking_model_1.BookingPaymentStatus.SECURED } }, {
                    $set: {
                        paymentStatus: booking_model_1.BookingPaymentStatus.FAILED,
                        'metadata.promotions': releasedPromotions,
                        'metadata.promotion': releasedPromotions[0] || null,
                    },
                });
                req?.app.get('io')?.to(`booking:${transaction.bookingId.toString()}`).emit('payment_failed', {
                    bookingId: transaction.bookingId.toString(),
                    reference: maskReference(transaction.reference),
                    updatedAt: new Date().toISOString(),
                });
            }
            event.processingStatus = payment_webhook_event_model_1.PaymentWebhookProcessingStatus.PROCESSED;
            event.processed = true;
            event.processedAt = new Date();
            await event.save();
            return { duplicate, processed: true };
        }
        if (['refund.processed', 'charge.reversed'].includes(eventType)) {
            const transaction = await payment_transaction_model_1.default.findOne({ provider: payment_transaction_model_1.PaymentProvider.PAYSTACK, reference });
            if (transaction) {
                const status = eventType === 'refund.processed' ? payment_transaction_model_1.PaymentTransactionStatus.REFUNDED : payment_transaction_model_1.PaymentTransactionStatus.REVERSED;
                await markTransactionFailure(transaction, status, eventType);
                const reversedPromotions = await (0, promotion_campaign_service_1.reverseRedeemedPromotions)(promotionSnapshotsFromTransaction(transaction), eventType === 'refund.processed' ? 'PAYMENT_REFUNDED' : 'PAYMENT_REVERSED');
                await booking_model_1.default.updateOne({ _id: transaction.bookingId, status: { $nin: [booking_model_1.BookingStatus.IN_PROGRESS, booking_model_1.BookingStatus.COMPLETED] } }, {
                    $set: {
                        paymentStatus: eventType === 'refund.processed' ? booking_model_1.BookingPaymentStatus.REFUNDED : booking_model_1.BookingPaymentStatus.UNDER_REVIEW,
                        'metadata.promotions': reversedPromotions,
                        'metadata.promotion': reversedPromotions[0] || null,
                        'workAuthorization.status': booking_model_1.WorkAuthorizationStatus.BLOCKED,
                        'workAuthorization.reasonCode': eventType === 'refund.processed' ? 'PAYMENT_REFUNDED' : 'PAYMENT_REVERSED',
                        'workAuthorization.evaluatedAt': new Date(),
                    },
                });
                req?.app.get('io')?.to(`booking:${transaction.bookingId.toString()}`).emit(eventType === 'refund.processed' ? 'payment_refunded' : 'payment_reversed', {
                    bookingId: transaction.bookingId.toString(),
                    reference: maskReference(transaction.reference),
                    updatedAt: new Date().toISOString(),
                });
            }
            event.processingStatus = payment_webhook_event_model_1.PaymentWebhookProcessingStatus.PROCESSED;
            event.processed = true;
            event.processedAt = new Date();
            await event.save();
            return { duplicate, processed: true };
        }
        event.processingStatus = payment_webhook_event_model_1.PaymentWebhookProcessingStatus.IGNORED;
        event.processed = true;
        event.processedAt = new Date();
        await event.save();
        return { duplicate, processed: false };
    }
    catch (error) {
        event.processingStatus = payment_webhook_event_model_1.PaymentWebhookProcessingStatus.FAILED;
        event.failureReason = error?.message?.slice(0, 500) || 'Webhook processing failed';
        await event.save();
        throw error;
    }
};
exports.processPaystackWebhookPayload = processPaystackWebhookPayload;
exports.maskPaymentReference = maskReference;
//# sourceMappingURL=payment-workflow.service.js.map