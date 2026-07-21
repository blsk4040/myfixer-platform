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
exports.PaymentController = void 0;
const paymentVault_model_1 = __importDefault(require("../models/paymentVault.model"));
const paystack_service_1 = require("../services/paystack.service");
const crypto_1 = __importDefault(require("crypto"));
const booking_model_1 = __importStar(require("../models/booking.model"));
const paymentVault_model_2 = require("../models/paymentVault.model");
const audit_service_1 = require("../services/audit.service");
const notification_service_1 = require("../services/notification.service");
const notification_model_1 = require("../models/notification.model");
const payment_workflow_service_1 = require("../services/payment-workflow.service");
const settlement_service_1 = require("../services/settlement.service");
const paystack_service_2 = require("../services/paystack.service");
const payment_transaction_model_1 = __importStar(require("../models/payment-transaction.model"));
const quote_model_1 = __importStar(require("../models/quote.model"));
const market_finance_guard_service_1 = require("../services/market-finance-guard.service");
class PaymentController {
    static async initializePayment(req, res) {
        try {
            const { bookingId, quoteId, callbackUrl } = req.body || {};
            const idempotencyKey = String(req.headers['idempotency-key'] || req.body?.idempotencyKey || '').trim();
            const result = await (0, payment_workflow_service_1.initializeBookingPayment)({
                bookingId: String(bookingId || '').trim(),
                quoteId: quoteId ? String(quoteId).trim() : undefined,
                idempotencyKey: idempotencyKey || undefined,
                callbackUrl: typeof callbackUrl === 'string' ? callbackUrl.trim() : undefined,
            }, req.user, req);
            const io = req.app.get('io');
            io?.to(`booking:${result.transaction.bookingId.toString()}`).emit(result.reused ? 'payment_pending' : 'payment_initialized', {
                bookingId: result.transaction.bookingId.toString(),
                amountMinor: result.transaction.amountMinor,
                currency: result.transaction.currency,
                reference: (0, payment_workflow_service_1.maskPaymentReference)(result.transaction.reference),
                status: result.transaction.status,
            });
            res.status(result.reused ? 200 : 201).json({
                success: true,
                payment: result.response,
                reused: result.reused,
            });
        }
        catch (error) {
            if (error instanceof market_finance_guard_service_1.MarketFinanceGuardError) {
                res.status(error.statusCode).json({ message: error.message, code: error.code });
                return;
            }
            if (error instanceof payment_workflow_service_1.PaymentWorkflowError) {
                res.status(error.statusCode).json({ message: error.message, code: error.code });
                return;
            }
            const upstream = error?.response;
            console.error('Failed to initialize payment:', {
                message: error instanceof Error ? error.message : 'Unknown payment initialization error.',
                providerStatus: upstream?.status,
                providerCode: upstream?.data?.code,
                providerType: upstream?.data?.type,
                providerMessage: upstream?.data?.message,
            });
            res.status(500).json({ message: 'Unable to initialize secure payment.' });
        }
    }
    static async getPaymentStatus(req, res) {
        try {
            const bookingId = String(req.params.bookingId || '').trim();
            const userId = String(req.user.id ?? req.user._id);
            const booking = await booking_model_1.default.findById(bookingId).lean();
            if (!booking) {
                res.status(404).json({ message: 'Booking not found.' });
                return;
            }
            const role = String(req.user.role || '').toUpperCase();
            const allowed = role === 'ADMIN' ||
                String(booking.customerId) === userId ||
                String(booking.technicianId || '') === userId;
            if (!allowed) {
                res.status(403).json({ message: 'Not authorized to view payment status.' });
                return;
            }
            const transaction = await payment_transaction_model_1.default.findOne({ bookingId: booking._id }).sort({ createdAt: -1 }).lean();
            res.status(200).json({
                success: true,
                paymentStatus: booking.paymentStatus,
                transaction: transaction ? {
                    reference: (0, payment_workflow_service_1.maskPaymentReference)(transaction.reference),
                    status: transaction.status,
                    amountMinor: transaction.amountMinor,
                    currency: transaction.currency,
                    paidAt: transaction.paidAt,
                    verifiedAt: transaction.verifiedAt,
                } : null,
            });
        }
        catch (error) {
            res.status(500).json({ message: 'Unable to load payment status.' });
        }
    }
    static async handlePaystackWebhook(req, res) {
        const rawBody = req.rawBody instanceof Buffer
            ? req.rawBody
            : Buffer.from(JSON.stringify(req.body || {}));
        const signature = String(req.headers['x-paystack-signature'] || '');
        if (!(0, paystack_service_2.verifyPaystackSignature)(rawBody, signature)) {
            try {
                await (0, audit_service_1.logAuditEvent)(req, {
                    action: 'payment.webhook.invalid_signature',
                    module: 'PAYMENTS',
                    resourceType: 'PaymentWebhookEvent',
                    metadata: { provider: 'PAYSTACK' },
                    success: false,
                });
            }
            catch {
                // Audit failure must not leak details to webhook caller.
            }
            res.status(401).json({ message: 'Invalid webhook signature.' });
            return;
        }
        try {
            await (0, audit_service_1.logAuditEvent)(req, {
                action: 'payment.webhook.received',
                module: 'PAYMENTS',
                resourceType: 'PaymentWebhookEvent',
                metadata: {
                    provider: 'PAYSTACK',
                    eventType: req.body?.event,
                    reference: req.body?.data?.reference ? (0, payment_workflow_service_1.maskPaymentReference)(String(req.body.data.reference)) : '',
                },
            });
            if (String(req.body?.event || '').startsWith('transfer.')) {
                await (0, settlement_service_1.processPaystackTransferWebhookPayload)(req.body, req);
            }
            else {
                await (0, payment_workflow_service_1.processPaystackWebhookPayload)(req.body, rawBody, req);
            }
            res.status(200).json({ received: true });
        }
        catch (error) {
            console.error('Failed to process Paystack webhook:', error);
            res.status(200).json({ received: true });
        }
    }
    static async getCards(req, res) {
        try {
            const userId = req.user._id;
            const vault = await paymentVault_model_1.default.findOne({ userId });
            if (!vault) {
                res.status(200).json([]);
                return;
            }
            const cards = vault.paymentMethods.map(m => ({
                methodId: m.methodId,
                brand: m.brand,
                last4: m.last4,
                expiryMonth: m.expiryMonth,
                expiryYear: m.expiryYear,
                isDefault: m.methodId === vault.defaultMethodId,
            }));
            res.status(200).json(cards);
        }
        catch (error) {
            console.error('Failed to fetch saved payment methods:', error);
            res.status(500).json({ error: 'Unable to fetch saved payment methods.' });
        }
    }
    static async saveCard(req, res) {
        try {
            const userId = req.user._id;
            const { transactionReference } = req.body;
            const paystackData = await paystack_service_1.PaystackService.verifyTransaction(transactionReference);
            if (paystackData.data.status !== 'success') {
                res.status(400).json({ error: 'Transaction validation verification failed.' });
                return;
            }
            const { authorization, customer } = paystackData.data;
            if (!authorization?.authorization_code ||
                !authorization.signature ||
                !authorization.last4 ||
                !authorization.exp_month ||
                !authorization.exp_year ||
                !customer?.customer_code) {
                res.status(400).json({ error: 'Payment provider did not return reusable card authorization details.' });
                return;
            }
            if (!authorization.reusable) {
                res.status(400).json({ error: 'Payment card method cannot be saved for recurring access operations.' });
                return;
            }
            let vault = await paymentVault_model_1.default.findOne({ userId }).select('+paymentMethods.signature');
            if (!vault) {
                vault = new paymentVault_model_1.default({
                    userId,
                    gatewayCustomerId: customer.customer_code,
                    paymentMethods: [],
                });
            }
            const cardExists = vault.paymentMethods.some(m => m.signature === authorization.signature);
            if (cardExists) {
                await (0, audit_service_1.logAuditEvent)(req, {
                    action: 'payment_card.save.duplicate',
                    module: 'PAYMENTS',
                    resourceType: 'PaymentVault',
                    resourceId: vault._id.toString(),
                    metadata: {
                        userId: String(userId),
                        brand: authorization.brand,
                        last4: authorization.last4,
                    },
                });
                res.status(200).json({ message: 'Card variant structural instance already mapped.' });
                return;
            }
            const generatedMethodId = `pm_${crypto_1.default.randomBytes(8).toString('hex')}`;
            const newCard = {
                methodId: generatedMethodId,
                authorizationCode: authorization.authorization_code,
                signature: authorization.signature,
                reusable: authorization.reusable,
                brand: authorization.brand || '',
                bank: authorization.bank || '',
                countryCode: authorization.country_code || '',
                last4: authorization.last4,
                expiryMonth: authorization.exp_month,
                expiryYear: authorization.exp_year,
                cardType: authorization.card_type || '',
                isDefault: vault.paymentMethods.length === 0,
                status: paymentVault_model_2.PaymentMethodStatus.ACTIVE,
                createdAt: new Date(),
                metadata: {
                    gateway: 'paystack',
                },
            };
            vault.paymentMethods.push(newCard);
            if (vault.paymentMethods.length === 1) {
                vault.defaultMethodId = generatedMethodId;
            }
            await vault.save();
            await (0, audit_service_1.logAuditEvent)(req, {
                action: 'payment_card.save',
                module: 'PAYMENTS',
                resourceType: 'PaymentVault',
                resourceId: vault._id.toString(),
                changes: {
                    after: {
                        defaultMethodId: vault.defaultMethodId,
                        paymentMethodCount: vault.paymentMethods.length,
                    },
                },
                metadata: {
                    userId: String(userId),
                    methodId: generatedMethodId,
                    brand: authorization.brand,
                    last4: authorization.last4,
                    gateway: 'paystack',
                },
            });
            res.status(201).json({ message: 'Secure token mapping verified successfully.', methodId: generatedMethodId });
        }
        catch (error) {
            console.error('Failed to save payment card:', error);
            res.status(500).json({ error: 'Unable to save payment method.' });
        }
    }
    static async chargeSavedCard(req, res) {
        try {
            const userId = req.user._id;
            const { bookingId, quoteId } = req.body;
            if (!req.user.email) {
                res.status(400).json({ error: 'Authenticated user email is required to charge a saved card.' });
                return;
            }
            const booking = await booking_model_1.default.findById(bookingId);
            if (!booking) {
                res.status(404).json({ error: 'Booking not found for payment charge.' });
                return;
            }
            await (0, market_finance_guard_service_1.assertMarketAllowsPaymentCollection)(booking.countryCode, booking.currency, payment_transaction_model_1.PaymentProvider.PAYSTACK);
            let normalizedAmount = booking.priceMinor;
            if (booking.pricingMode !== booking_model_1.PricingMode.FIXED_PRICE || quoteId) {
                const quote = await quote_model_1.default.findOne({
                    bookingId: booking._id,
                    status: quote_model_1.QuoteStatus.APPROVED,
                    isCurrent: { $ne: false },
                    ...(quoteId ? { _id: quoteId } : {}),
                }).sort({ version: -1, createdAt: -1 });
                if (!quote) {
                    res.status(409).json({ error: 'An approved quote is required before charging a saved card.' });
                    return;
                }
                normalizedAmount = quote.totalAmountMinor;
            }
            if (!Number.isInteger(normalizedAmount) || normalizedAmount <= 0 || !bookingId) {
                res.status(400).json({ error: 'A valid server-side booking amount is required.' });
                return;
            }
            const vault = await paymentVault_model_1.default.findOne({ userId }).select('+paymentMethods.authorizationCode +paymentMethods.signature');
            const targetMethodId = vault?.defaultMethodId;
            const targetCard = vault?.paymentMethods.find(m => m.methodId === targetMethodId && m.status === paymentVault_model_2.PaymentMethodStatus.ACTIVE);
            if (!vault || !targetCard) {
                res.status(400).json({ error: 'No validated payment profiles found on this identity root context.' });
                return;
            }
            const uniqueReference = `chg_${bookingId}_${crypto_1.default.randomBytes(4).toString('hex')}`;
            const chargeResult = await paystack_service_1.PaystackService.chargeToken(req.user.email, normalizedAmount, targetCard.authorizationCode, uniqueReference, booking.currency);
            await (0, audit_service_1.logAuditEvent)(req, {
                action: 'payment.charge_saved_card',
                module: 'PAYMENTS',
                resourceType: 'Booking',
                resourceId: booking.id,
                metadata: {
                    userId: String(userId),
                    methodId: targetCard.methodId,
                    reference: uniqueReference,
                    amountMinor: normalizedAmount,
                    currency: booking.currency,
                    status: chargeResult.data.status,
                },
            });
            const io = req.app.get('io');
            if (booking.technicianId) {
                io?.to(`technician:${booking.technicianId.toString()}`).emit('payment_pending', {
                    bookingId: booking.id,
                    reference: uniqueReference,
                    amountMinor: normalizedAmount,
                    currency: booking.currency,
                });
            }
            await (0, notification_service_1.createNotifications)({
                userId: booking.customerId,
                email: req.user.email,
                name: '',
                channels: [notification_model_1.NotificationChannel.IN_APP, notification_model_1.NotificationChannel.PUSH],
                type: 'PAYMENT_PENDING',
                title: 'Payment submitted',
                message: `Payment for your ${booking.applianceType} booking was submitted and still needs provider verification.`,
                metadata: {
                    bookingId: booking.id,
                    reference: uniqueReference,
                    amountMinor: normalizedAmount,
                    currency: booking.currency,
                },
            });
            res.status(200).json({
                status: chargeResult.data.status,
                reference: uniqueReference,
                amountMinor: normalizedAmount,
                currency: booking.currency,
            });
        }
        catch (error) {
            if (error instanceof market_finance_guard_service_1.MarketFinanceGuardError) {
                res.status(error.statusCode).json({ error: error.message, code: error.code });
                return;
            }
            console.error('Failed to charge saved card:', error);
            res.status(500).json({ error: 'Unable to process saved-card payment.' });
        }
    }
    static async deleteCard(req, res) {
        try {
            const userId = req.user._id;
            const { id } = req.params;
            const vault = await paymentVault_model_1.default.findOne({ userId });
            if (!vault) {
                res.status(404).json({ error: 'Payment repository trace entity missing.' });
                return;
            }
            const removedCard = vault.paymentMethods.find(m => m.methodId === id);
            if (!removedCard) {
                res.status(404).json({ error: 'Specified payment reference mismatch.' });
                return;
            }
            const before = {
                defaultMethodId: vault.defaultMethodId,
                paymentMethodCount: vault.paymentMethods.length,
                removedMethodId: id,
            };
            vault.paymentMethods = vault.paymentMethods.filter(m => m.methodId !== id);
            if (vault.defaultMethodId === id && vault.paymentMethods.length > 0) {
                vault.defaultMethodId = vault.paymentMethods[0].methodId;
            }
            else if (vault.defaultMethodId === id) {
                vault.defaultMethodId = '';
            }
            await vault.save();
            await (0, audit_service_1.logAuditEvent)(req, {
                action: 'payment_card.delete',
                module: 'PAYMENTS',
                resourceType: 'PaymentVault',
                resourceId: vault._id.toString(),
                changes: {
                    before,
                    after: {
                        defaultMethodId: vault.defaultMethodId,
                        paymentMethodCount: vault.paymentMethods.length,
                    },
                },
                metadata: {
                    userId: String(userId),
                    methodId: id,
                    brand: removedCard?.brand,
                    last4: removedCard?.last4,
                },
            });
            res.status(200).json({ message: 'Tokenized structural references purged successfully.' });
        }
        catch (error) {
            console.error('Failed to delete payment card:', error);
            res.status(500).json({ error: 'Unable to delete payment method.' });
        }
    }
    static async setDefaultCard(req, res) {
        try {
            const userId = req.user._id;
            const { id } = req.params;
            const vault = await paymentVault_model_1.default.findOne({ userId });
            if (!vault) {
                res.status(404).json({ error: 'Vault execution domain error.' });
                return;
            }
            const hasCard = vault.paymentMethods.some(m => m.methodId === id);
            if (!hasCard) {
                res.status(404).json({ error: 'Specified payment reference mismatch.' });
                return;
            }
            const beforeDefaultMethodId = vault.defaultMethodId;
            vault.defaultMethodId = id;
            await vault.save();
            await (0, audit_service_1.logAuditEvent)(req, {
                action: 'payment_card.set_default',
                module: 'PAYMENTS',
                resourceType: 'PaymentVault',
                resourceId: vault._id.toString(),
                changes: {
                    before: { defaultMethodId: beforeDefaultMethodId },
                    after: { defaultMethodId: vault.defaultMethodId },
                },
                metadata: {
                    userId: String(userId),
                    methodId: id,
                },
            });
            res.status(200).json({ message: 'Default pointer re-indexed successfully.' });
        }
        catch (error) {
            console.error('Failed to set default payment card:', error);
            res.status(500).json({ error: 'Unable to update default payment method.' });
        }
    }
}
exports.PaymentController = PaymentController;
//# sourceMappingURL=payment.controller.js.map