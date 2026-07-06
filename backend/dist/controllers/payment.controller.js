"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentController = void 0;
const paymentVault_model_1 = __importDefault(require("../models/paymentVault.model"));
const paystack_service_1 = require("../services/paystack.service");
const crypto_1 = __importDefault(require("crypto"));
const booking_model_1 = __importDefault(require("../models/booking.model"));
const market_config_1 = require("../config/market.config");
const paymentVault_model_2 = require("../models/paymentVault.model");
const audit_service_1 = require("../services/audit.service");
const notification_service_1 = require("../services/notification.service");
const notification_model_1 = require("../models/notification.model");
class PaymentController {
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
                brand: authorization.brand,
                bank: authorization.bank,
                countryCode: authorization.country_code,
                last4: authorization.last4,
                expiryMonth: authorization.exp_month,
                expiryYear: authorization.exp_year,
                cardType: authorization.card_type,
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
            const { amountMinor, amountInCents, bookingId } = req.body;
            if (!req.user.email) {
                res.status(400).json({ error: 'Authenticated user email is required to charge a saved card.' });
                return;
            }
            const booking = await booking_model_1.default.findById(bookingId);
            if (!booking) {
                res.status(404).json({ error: 'Booking not found for payment charge.' });
                return;
            }
            const market = (0, market_config_1.getMarketByCountry)(booking.countryCode);
            if (!market.paymentProviders.includes('PAYSTACK')) {
                res.status(400).json({ error: `Paystack is not enabled for ${market.countryName}.` });
                return;
            }
            const normalizedAmount = Number(amountMinor ?? amountInCents);
            if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0 || !bookingId) {
                res.status(400).json({ error: 'A valid amountMinor and bookingId are required.' });
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
                io?.to(`technician:${booking.technicianId.toString()}`).emit('payment_confirmed', {
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
                channels: [notification_model_1.NotificationChannel.IN_APP],
                type: 'PAYMENT_CONFIRMED',
                title: 'Payment confirmed',
                message: `Payment for your ${booking.applianceType} booking has been confirmed.`,
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