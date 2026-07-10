// src/controllers/payment.controller.ts
import { Response } from 'express';
import PaymentVault from '../models/paymentVault.model';
import { PaystackService } from '../services/paystack.service';
import { AuthenticatedRequest } from '../types/auth.types';
import crypto from 'crypto';
import Booking from '../models/booking.model';
import { getMarketByCountry } from '../config/market.config';
import { PaymentMethodStatus } from '../models/paymentVault.model';
import { logAuditEvent } from '../services/audit.service';
import { createNotifications } from '../services/notification.service';
import { NotificationChannel } from '../models/notification.model';
import {
  PaymentWorkflowError,
  initializeBookingPayment,
  maskPaymentReference,
  processPaystackWebhookPayload,
} from '../services/payment-workflow.service';
import { processPaystackTransferWebhookPayload } from '../services/settlement.service';
import { verifyPaystackSignature } from '../services/paystack.service';
import PaymentTransaction from '../models/payment-transaction.model';

export class PaymentController {
  static async initializePayment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { bookingId, quoteId, callbackUrl } = req.body || {};
      const idempotencyKey = String(req.headers['idempotency-key'] || req.body?.idempotencyKey || '').trim();

      const result = await initializeBookingPayment(
        {
          bookingId: String(bookingId || '').trim(),
          quoteId: quoteId ? String(quoteId).trim() : undefined,
          idempotencyKey: idempotencyKey || undefined,
          callbackUrl: typeof callbackUrl === 'string' ? callbackUrl.trim() : undefined,
        },
        req.user,
        req
      );

      const io = req.app.get('io');
      io?.to(`booking:${result.transaction.bookingId.toString()}`).emit(result.reused ? 'payment_pending' : 'payment_initialized', {
        bookingId: result.transaction.bookingId.toString(),
        amountMinor: result.transaction.amountMinor,
        currency: result.transaction.currency,
        reference: maskPaymentReference(result.transaction.reference),
        status: result.transaction.status,
      });

      res.status(result.reused ? 200 : 201).json({
        success: true,
        payment: result.response,
        reused: result.reused,
      });
    } catch (error) {
      if (error instanceof PaymentWorkflowError) {
        res.status(error.statusCode).json({ message: error.message, code: error.code });
        return;
      }
      console.error('Failed to initialize payment:', error);
      res.status(500).json({ message: 'Unable to initialize secure payment.' });
    }
  }

  static async getPaymentStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const bookingId = String(req.params.bookingId || '').trim();
      const userId = String(req.user.id ?? req.user._id);
      const booking = await Booking.findById(bookingId).lean();
      if (!booking) {
        res.status(404).json({ message: 'Booking not found.' });
        return;
      }
      const role = String(req.user.role || '').toUpperCase();
      const allowed =
        role === 'ADMIN' ||
        String(booking.customerId) === userId ||
        String(booking.technicianId || '') === userId;
      if (!allowed) {
        res.status(403).json({ message: 'Not authorized to view payment status.' });
        return;
      }
      const transaction = await PaymentTransaction.findOne({ bookingId: booking._id }).sort({ createdAt: -1 }).lean();
      res.status(200).json({
        success: true,
        paymentStatus: booking.paymentStatus,
        transaction: transaction ? {
          reference: maskPaymentReference(transaction.reference),
          status: transaction.status,
          amountMinor: transaction.amountMinor,
          currency: transaction.currency,
          paidAt: transaction.paidAt,
          verifiedAt: transaction.verifiedAt,
        } : null,
      });
    } catch (error) {
      res.status(500).json({ message: 'Unable to load payment status.' });
    }
  }

  static async handlePaystackWebhook(req: AuthenticatedRequest, res: Response): Promise<void> {
    const rawBody = (req as any).rawBody instanceof Buffer
      ? (req as any).rawBody as Buffer
      : Buffer.from(JSON.stringify(req.body || {}));
    const signature = String(req.headers['x-paystack-signature'] || '');

    if (!verifyPaystackSignature(rawBody, signature)) {
      try {
        await logAuditEvent(req, {
          action: 'payment.webhook.invalid_signature',
          module: 'PAYMENTS',
          resourceType: 'PaymentWebhookEvent',
          metadata: { provider: 'PAYSTACK' },
          success: false,
        });
      } catch {
        // Audit failure must not leak details to webhook caller.
      }
      res.status(401).json({ message: 'Invalid webhook signature.' });
      return;
    }

    try {
      await logAuditEvent(req, {
        action: 'payment.webhook.received',
        module: 'PAYMENTS',
        resourceType: 'PaymentWebhookEvent',
        metadata: {
          provider: 'PAYSTACK',
          eventType: req.body?.event,
          reference: req.body?.data?.reference ? maskPaymentReference(String(req.body.data.reference)) : '',
        },
      });
      if (String(req.body?.event || '').startsWith('transfer.')) {
        await processPaystackTransferWebhookPayload(req.body, req);
      } else {
        await processPaystackWebhookPayload(req.body, rawBody, req);
      }
      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Failed to process Paystack webhook:', error);
      res.status(200).json({ received: true });
    }
  }
  
  static async getCards(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user._id; 
      const vault = await PaymentVault.findOne({ userId });
      
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
    } catch (error) {
      console.error('Failed to fetch saved payment methods:', error);
      res.status(500).json({ error: 'Unable to fetch saved payment methods.' });
    }
  }

  static async saveCard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user._id;
      const { transactionReference } = req.body;

      const paystackData = await PaystackService.verifyTransaction(transactionReference);
      if (paystackData.data.status !== 'success') {
        res.status(400).json({ error: 'Transaction validation verification failed.' });
        return;
      }

      const { authorization, customer } = paystackData.data;
      if (
        !authorization?.authorization_code ||
        !authorization.signature ||
        !authorization.last4 ||
        !authorization.exp_month ||
        !authorization.exp_year ||
        !customer?.customer_code
      ) {
        res.status(400).json({ error: 'Payment provider did not return reusable card authorization details.' });
        return;
      }
      
      if (!authorization.reusable) {
        res.status(400).json({ error: 'Payment card method cannot be saved for recurring access operations.' });
        return;
      }

      let vault = await PaymentVault.findOne({ userId }).select('+paymentMethods.signature');
      if (!vault) {
        vault = new PaymentVault({
          userId,
          gatewayCustomerId: customer.customer_code,
          paymentMethods: [],
        });
      }

      const cardExists = vault.paymentMethods.some(m => m.signature === authorization.signature);
      if (cardExists) {
        await logAuditEvent(req, {
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

      const generatedMethodId = `pm_${crypto.randomBytes(8).toString('hex')}`;
      
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
        status: PaymentMethodStatus.ACTIVE,
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
      await logAuditEvent(req, {
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
    } catch (error) {
      console.error('Failed to save payment card:', error);
      res.status(500).json({ error: 'Unable to save payment method.' });
    }
  }

  static async chargeSavedCard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user._id;
      const { amountMinor, amountInCents, bookingId } = req.body;

      if (!req.user.email) {
        res.status(400).json({ error: 'Authenticated user email is required to charge a saved card.' });
        return;
      }

      const booking = await Booking.findById(bookingId);
      if (!booking) {
        res.status(404).json({ error: 'Booking not found for payment charge.' });
        return;
      }

      const market = getMarketByCountry(booking.countryCode);
      if (!market.paymentProviders.includes('PAYSTACK')) {
        res.status(400).json({ error: `Paystack is not enabled for ${market.countryName}.` });
        return;
      }

      const normalizedAmount = Number(amountMinor ?? amountInCents);
      if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0 || !bookingId) {
        res.status(400).json({ error: 'A valid amountMinor and bookingId are required.' });
        return;
      }

      const vault = await PaymentVault.findOne({ userId }).select('+paymentMethods.authorizationCode +paymentMethods.signature');
      const targetMethodId = vault?.defaultMethodId;
      const targetCard = vault?.paymentMethods.find(m => m.methodId === targetMethodId && m.status === PaymentMethodStatus.ACTIVE);

      if (!vault || !targetCard) {
        res.status(400).json({ error: 'No validated payment profiles found on this identity root context.' });
        return;
      }

      const uniqueReference = `chg_${bookingId}_${crypto.randomBytes(4).toString('hex')}`;
      
      const chargeResult = await PaystackService.chargeToken(
        req.user.email,
        normalizedAmount,
        targetCard.authorizationCode,
        uniqueReference,
        booking.currency
      );

      await logAuditEvent(req, {
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
      await createNotifications({
        userId: booking.customerId,
        email: req.user.email,
        name: '',
        channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
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
    } catch (error) {
      console.error('Failed to charge saved card:', error);
      res.status(500).json({ error: 'Unable to process saved-card payment.' });
    }
  }

  static async deleteCard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user._id;
      const { id } = req.params;

      const vault = await PaymentVault.findOne({ userId });
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
      } else if (vault.defaultMethodId === id) {
        vault.defaultMethodId = '';
      }

      await vault.save();
      await logAuditEvent(req, {
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
    } catch (error) {
      console.error('Failed to delete payment card:', error);
      res.status(500).json({ error: 'Unable to delete payment method.' });
    }
  }

  static async setDefaultCard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user._id;
      const { id } = req.params;

      const vault = await PaymentVault.findOne({ userId });
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

      await logAuditEvent(req, {
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
    } catch (error) {
      console.error('Failed to set default payment card:', error);
      res.status(500).json({ error: 'Unable to update default payment method.' });
    }
  }
}
