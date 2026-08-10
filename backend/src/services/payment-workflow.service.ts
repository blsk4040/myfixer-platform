import crypto from 'crypto';
import mongoose from 'mongoose';
import Booking, {
  BookingPaymentStatus,
  BookingStatus,
  IBooking,
  PricingMode,
  WorkAuthorizationStatus,
} from '../models/booking.model';
import JobQuote, { QuoteStatus } from '../models/quote.model';
import PaymentTransaction, {
  IPaymentTransaction,
  PaymentProvider,
  PaymentTransactionStatus,
} from '../models/payment-transaction.model';
import PaymentWebhookEvent, { PaymentWebhookProcessingStatus } from '../models/payment-webhook-event.model';
import { UserRole, normalizeUserRole } from '../models/user.model';
import { PaystackService } from './paystack.service';
import { evaluateWorkStartEligibility, persistWorkStartEligibility } from './inspection-workflow.service';
import { createNotifications } from './notification.service';
import { NotificationChannel } from '../models/notification.model';
import { logAuditEvent } from './audit.service';
import { Request } from 'express';
import { assertMarketAllowsPaymentCollection } from './market-finance-guard.service';
import {
  AppliedPromotionSnapshot,
  releasePromotionReservations,
  reverseRedeemedPromotions,
} from './promotion-campaign.service';
import { ledgerType, recordLedgerEntry } from './financial-ledger.service';

export class PaymentWorkflowError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode = 400
  ) {
    super(message);
  }
}

interface PaymentActor {
  id?: unknown;
  _id?: unknown;
  email?: string;
  role?: string;
}

export interface InitializePaymentInput {
  bookingId: string;
  quoteId?: string;
  idempotencyKey?: string;
  callbackUrl?: string;
}

const actorId = (actor?: PaymentActor): string => String(actor?.id ?? actor?._id ?? '').trim();

const maskReference = (reference: string): string =>
  reference.length <= 10 ? `${reference.slice(0, 3)}...` : `${reference.slice(0, 6)}...${reference.slice(-4)}`;

const generateReference = (bookingId: string): string =>
  `mfx_${bookingId.slice(-8)}_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;

const terminalBookingStatuses = new Set([BookingStatus.COMPLETED, BookingStatus.CANCELLED]);

const loadBookingForPayment = async (bookingId: string): Promise<IBooking> => {
  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    throw new PaymentWorkflowError('Invalid booking id.', 'INVALID_BOOKING_ID');
  }
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new PaymentWorkflowError('Booking not found.', 'BOOKING_NOT_FOUND', 404);
  }
  return booking;
};

const assertClientCanPay = (booking: IBooking, actor?: PaymentActor): void => {
  const role = normalizeUserRole(actor?.role);
  const id = actorId(actor);
  if (role !== UserRole.ADMIN && String(booking.customerId) !== id) {
    throw new PaymentWorkflowError('Only the booking owner can initialize payment.', 'PAYMENT_UNAUTHORIZED', 403);
  }
};

const getApprovedQuoteAmount = async (booking: IBooking, quoteId?: string) => {
  const filter: Record<string, unknown> = {
    bookingId: booking._id,
    status: QuoteStatus.APPROVED,
    isCurrent: { $ne: false },
  };
  if (quoteId) {
    if (!mongoose.Types.ObjectId.isValid(quoteId)) {
      throw new PaymentWorkflowError('Invalid quote id.', 'INVALID_QUOTE_ID');
    }
    filter._id = new mongoose.Types.ObjectId(quoteId);
  }
  const quote = await JobQuote.findOne(filter).sort({ version: -1, createdAt: -1 });
  if (!quote) {
    throw new PaymentWorkflowError('An approved quote is required before payment.', 'APPROVED_QUOTE_REQUIRED', 409);
  }
  if (quote.expiresAt && quote.expiresAt.getTime() < Date.now()) {
    throw new PaymentWorkflowError('This quote has expired.', 'QUOTE_EXPIRED', 409);
  }
  if (quote.totalAmountMinor <= 0) {
    throw new PaymentWorkflowError('Quote total must be greater than zero.', 'INVALID_PAYMENT_AMOUNT');
  }
  const quoteBreakdown = quote.metadata?.priceBreakdown && typeof quote.metadata.priceBreakdown === 'object'
    ? quote.metadata.priceBreakdown as Record<string, unknown>
    : null;
  const amountMinor = typeof quoteBreakdown?.totalMinor === 'number' && Number.isFinite(quoteBreakdown.totalMinor)
    ? Math.max(0, Math.round(quoteBreakdown.totalMinor))
    : quote.totalAmountMinor;
  if (amountMinor <= 0) {
    throw new PaymentWorkflowError('Quote balance must be greater than zero.', 'INVALID_PAYMENT_AMOUNT');
  }
  return { quote, amountMinor };
};

const resolvePaymentAmount = async (booking: IBooking, quoteId?: string) => {
  const quoteRequired = booking.pricingMode !== PricingMode.FIXED_PRICE || booking.inspection?.quoteRequired === true;
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

const serializeTransaction = (transaction: IPaymentTransaction) => ({
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

const promotionSnapshotsFromTransaction = (transaction: IPaymentTransaction): AppliedPromotionSnapshot[] =>
  Array.isArray(transaction.metadata?.promotions)
    ? transaction.metadata.promotions as AppliedPromotionSnapshot[]
    : transaction.metadata?.promotion
      ? [transaction.metadata.promotion as AppliedPromotionSnapshot]
      : [];

const paymentLedgerContext = (transaction: IPaymentTransaction, booking?: IBooking | null) => ({
  bookingId: transaction.bookingId,
  quoteId: transaction.quoteId ?? null,
  paymentTransactionId: transaction._id,
  customerId: transaction.customerId,
  technicianId: transaction.technicianId ?? booking?.technicianId ?? null,
  countryCode: booking?.countryCode || String(transaction.metadata?.countryCode || ''),
  currency: transaction.currency,
  metadata: {
    reference: maskReference(transaction.reference),
    provider: transaction.provider,
    providerStatus: transaction.providerStatus || '',
    quoteId: transaction.quoteId?.toString() || null,
  },
});

export const initializeBookingPayment = async (
  input: InitializePaymentInput,
  actor: PaymentActor | undefined,
  req?: Request
) => {
  const booking = await loadBookingForPayment(input.bookingId);
  assertClientCanPay(booking, actor);

  if (terminalBookingStatuses.has(booking.status)) {
    throw new PaymentWorkflowError('Payment cannot be initialized for a terminal booking.', 'BOOKING_TERMINAL', 409);
  }
  if (booking.paymentStatus === BookingPaymentStatus.SECURED) {
    throw new PaymentWorkflowError('Payment is already secured for this booking.', 'PAYMENT_ALREADY_SECURED', 409);
  }

  await assertMarketAllowsPaymentCollection(booking.countryCode, booking.currency, PaymentProvider.PAYSTACK);

  const { quote, amountMinor } = await resolvePaymentAmount(booking, input.quoteId);
  const idempotencyKey = (input.idempotencyKey || `booking:${booking.id}:quote:${quote?._id?.toString() || 'fixed'}:amount:${amountMinor}`).trim();
  const existing = await PaymentTransaction.findOne({
    provider: PaymentProvider.PAYSTACK,
    idempotencyKey,
    status: { $in: [PaymentTransactionStatus.INITIALIZED, PaymentTransactionStatus.PENDING] },
  });
  if (existing) {
    if (req) {
      await logAuditEvent(req, {
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
    technicianId: booking.technicianId?.toString() || null,
    countryCode: booking.countryCode,
    promotion: booking.metadata?.promotion || null,
    promotions: Array.isArray(booking.metadata?.promotions) ? booking.metadata.promotions : [],
    priceBreakdown: quote?.metadata?.priceBreakdown || booking.metadata?.priceBreakdown || null,
  };

  let initialized;
  try {
    initialized = await PaystackService.initializeTransaction({
      email: booking.customerEmail || actor?.email || '',
      amountMinor,
      currency: booking.currency,
      reference,
      callbackUrl: input.callbackUrl,
      metadata,
    });
  } catch (error) {
    const upstream = (error as any)?.response;
    const providerCode = String(upstream?.data?.code || '').trim();
    const providerMessage = String(upstream?.data?.message || '').trim();
    throw new PaymentWorkflowError(
      providerMessage || 'Payment provider could not initialize checkout.',
      providerCode || 'PAYSTACK_INITIALIZE_FAILED',
      upstream?.status && upstream.status >= 400 && upstream.status < 500 ? 409 : 502
    );
  }
  if (!initialized?.status || !initialized?.data?.authorization_url) {
    throw new PaymentWorkflowError('Payment provider could not initialize checkout.', 'PAYSTACK_INITIALIZE_FAILED', 502);
  }

  const transaction = await PaymentTransaction.create({
    provider: PaymentProvider.PAYSTACK,
    reference,
    bookingId: booking._id,
    quoteId: quote?._id ?? null,
    customerId: booking.customerId,
    technicianId: booking.technicianId ?? null,
    amountMinor,
    currency: booking.currency,
    status: PaymentTransactionStatus.INITIALIZED,
    providerStatus: 'initialized',
    authorizationUrl: initialized.data.authorization_url,
    accessCode: initialized.data.access_code || '',
    initializedAt: new Date(),
    idempotencyKey,
    metadata,
  });

  await recordLedgerEntry({
    idempotencyKey: `payment:${transaction.id}:initialized`,
    entryType: quote ? ledgerType.REPAIR_BALANCE_CHARGE_CREATED : ledgerType.BOOKING_CALLOUT_CHARGE_CREATED,
    amountMinor,
    direction: 'DEBIT',
    component: quote ? 'PAYMENT' : 'CALLOUT',
    description: quote ? 'Repair balance checkout initialized' : 'Call-out payment checkout initialized',
    ...paymentLedgerContext(transaction, booking),
  });

  await Booking.updateOne(
    { _id: booking._id, paymentStatus: { $ne: BookingPaymentStatus.SECURED } },
    {
      $set: {
        paymentStatus: BookingPaymentStatus.PENDING,
        'workAuthorization.status': WorkAuthorizationStatus.AWAITING_PAYMENT,
        'workAuthorization.reasonCode': 'PAYMENT_NOT_SECURED',
        'workAuthorization.evaluatedAt': new Date(),
      },
    }
  );

  if (req) {
    await logAuditEvent(req, {
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

export const payloadHash = (rawBody: Buffer): string =>
  crypto.createHash('sha256').update(rawBody).digest('hex');

export const recordWebhookEvent = async (payload: any, rawBody: Buffer) => {
  const hash = payloadHash(rawBody);
  const eventId = String(payload?.data?.id ?? payload?.id ?? '').trim();
  const eventType = String(payload?.event ?? 'unknown').trim();
  const reference = String(payload?.data?.reference ?? '').trim();
  try {
    const event = await PaymentWebhookEvent.create({
      provider: PaymentProvider.PAYSTACK,
      eventType,
      eventId,
      reference,
      payloadHash: hash,
      processed: false,
      processingStatus: PaymentWebhookProcessingStatus.RECEIVED,
      receivedAt: new Date(),
      metadata: {
        providerStatus: payload?.data?.status,
      },
    });
    return { event, duplicate: false };
  } catch (error: any) {
    if (error?.code === 11000) {
      const event = await PaymentWebhookEvent.findOne({
        provider: PaymentProvider.PAYSTACK,
        $or: [{ payloadHash: hash }, ...(eventId ? [{ eventId }] : [])],
      });
      return { event, duplicate: true };
    }
    throw error;
  }
};

const markTransactionFailure = async (
  transaction: IPaymentTransaction,
  status: PaymentTransactionStatus,
  providerStatus: string,
  metadata: Record<string, unknown> = {}
) => {
  const now = new Date();
  transaction.status = status;
  transaction.providerStatus = providerStatus;
  transaction.metadata = { ...transaction.metadata, ...metadata };
  if (status === PaymentTransactionStatus.FAILED) transaction.failedAt = now;
  if (status === PaymentTransactionStatus.REFUNDED) transaction.refundedAt = now;
  if (status === PaymentTransactionStatus.REVERSED) transaction.reversedAt = now;
  if (status === PaymentTransactionStatus.UNDER_REVIEW) transaction.verifiedAt = now;
  await transaction.save();
};

export const verifyAndSecurePayment = async (reference: string, req?: Request) => {
  const transaction = await PaymentTransaction.findOne({ provider: PaymentProvider.PAYSTACK, reference });
  if (!transaction) {
    throw new PaymentWorkflowError('Payment reference is unknown.', 'UNKNOWN_PAYMENT_REFERENCE', 404);
  }
  if (transaction.status === PaymentTransactionStatus.SUCCESS) {
    return { transaction, duplicate: true };
  }

  const verification = await PaystackService.verifyTransaction(reference);
  const data = verification.data;
  const providerStatus = String(data?.status || '').toLowerCase();
  transaction.providerStatus = providerStatus;
  transaction.providerTransactionId = data?.id ? String(data.id) : transaction.providerTransactionId;

  const amountMatches = Number(data?.amount) === transaction.amountMinor;
  const currencyMatches = String(data?.currency || '').toUpperCase() === transaction.currency;
  const referenceMatches = String(data?.reference || '') === transaction.reference;
  const booking = await Booking.findById(transaction.bookingId);

  if (providerStatus !== 'success') {
    await markTransactionFailure(transaction, PaymentTransactionStatus.FAILED, providerStatus || 'failed');
    await recordLedgerEntry({
      idempotencyKey: `payment:${transaction.id}:failed:${providerStatus || 'failed'}`,
      entryType: ledgerType.PAYMENT_FAILED,
      amountMinor: transaction.amountMinor,
      direction: 'MEMO',
      component: 'PAYMENT',
      description: 'Payment failed',
      ...paymentLedgerContext(transaction, booking),
    });
    await Booking.updateOne(
      { _id: transaction.bookingId, paymentStatus: { $ne: BookingPaymentStatus.SECURED } },
      { $set: { paymentStatus: BookingPaymentStatus.FAILED } }
    );
    req?.app.get('io')?.to(`booking:${transaction.bookingId.toString()}`).emit('payment_failed', {
      bookingId: transaction.bookingId.toString(),
      reference: maskReference(transaction.reference),
      updatedAt: new Date().toISOString(),
    });
    return { transaction, duplicate: false };
  }

  if (!amountMatches || !currencyMatches || !referenceMatches) {
    await markTransactionFailure(transaction, PaymentTransactionStatus.UNDER_REVIEW, providerStatus, {
      amountMatches,
      currencyMatches,
      referenceMatches,
      providerAmount: data?.amount,
      providerCurrency: data?.currency,
      providerReference: data?.reference,
    });
    await recordLedgerEntry({
      idempotencyKey: `payment:${transaction.id}:under-review`,
      entryType: ledgerType.PAYMENT_FAILED,
      amountMinor: transaction.amountMinor,
      direction: 'MEMO',
      component: 'PAYMENT',
      description: 'Payment moved under review',
      ...paymentLedgerContext(transaction, booking),
    });
    await Booking.updateOne(
      { _id: transaction.bookingId },
      {
        $set: {
          paymentStatus: BookingPaymentStatus.UNDER_REVIEW,
          'workAuthorization.status': WorkAuthorizationStatus.BLOCKED,
          'workAuthorization.reasonCode': 'PAYMENT_UNDER_REVIEW',
          'workAuthorization.evaluatedAt': new Date(),
        },
      }
    );
    req?.app.get('io')?.to(`booking:${transaction.bookingId.toString()}`).emit('payment_under_review', {
      bookingId: transaction.bookingId.toString(),
      reference: maskReference(transaction.reference),
      updatedAt: new Date().toISOString(),
    });
    return { transaction, duplicate: false };
  }

  const now = new Date();
  const updatedTransaction = await PaymentTransaction.findOneAndUpdate(
    {
      _id: transaction._id,
      status: { $ne: PaymentTransactionStatus.SUCCESS },
    },
    {
      $set: {
        status: PaymentTransactionStatus.SUCCESS,
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
    },
    { new: true }
  );

  if (!updatedTransaction) {
    const current = await PaymentTransaction.findById(transaction._id);
    return { transaction: current || transaction, duplicate: true };
  }

  const securedBooking = await Booking.findOneAndUpdate(
    {
      _id: updatedTransaction.bookingId,
      paymentStatus: { $in: [BookingPaymentStatus.PENDING, BookingPaymentStatus.FAILED, BookingPaymentStatus.UNDER_REVIEW] },
    },
    {
      $set: {
        paymentStatus: BookingPaymentStatus.SECURED,
        paymentSecurity: {
          securedAt: now,
          transactionId: updatedTransaction._id,
          provider: PaymentProvider.PAYSTACK,
          reference: updatedTransaction.reference,
          amountMinor: updatedTransaction.amountMinor,
          currency: updatedTransaction.currency,
          verifiedAt: now,
        },
      },
    },
    { new: true }
  );

  if (securedBooking) {
    await recordLedgerEntry({
      idempotencyKey: `payment:${updatedTransaction.id}:success`,
      entryType: ledgerType.PAYMENT_SUCCEEDED,
      amountMinor: updatedTransaction.amountMinor,
      direction: 'CREDIT',
      component: 'PAYMENT',
      description: 'Payment succeeded',
      ...paymentLedgerContext(updatedTransaction, securedBooking),
    });

    const eligibility = await evaluateWorkStartEligibility(securedBooking);
    await persistWorkStartEligibility(securedBooking, eligibility);

    const io = req?.app.get('io');
    io?.to(`booking:${securedBooking.id}`).emit('payment_secured', {
      bookingId: securedBooking.id,
      status: BookingPaymentStatus.SECURED,
      amountMinor: updatedTransaction.amountMinor,
      currency: updatedTransaction.currency,
      reference: maskReference(updatedTransaction.reference),
      workStartEligibility: eligibility,
      updatedAt: now.toISOString(),
    });

    if (mongoose.connection.readyState === 1) void (async () => {
      if (securedBooking.technicianId) {
        await createNotifications({
          userId: securedBooking.technicianId,
          channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
          type: 'PAYMENT_SECURED',
          title: 'Payment secured',
          message: 'Payment is secured in Padi. You may begin work when all other requirements are met.',
          metadata: { bookingId: securedBooking.id, transactionId: updatedTransaction.id },
        });
      }
      await createNotifications({
        userId: securedBooking.customerId,
        email: securedBooking.customerEmail,
        name: securedBooking.customerName,
        channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
        type: 'PAYMENT_CONFIRMED',
        title: 'Payment confirmed',
        message: 'Payment confirmed. The provider can now begin work.',
        metadata: { bookingId: securedBooking.id, transactionId: updatedTransaction.id },
      });
    })().catch((notificationError) => {
      console.warn('Payment secured but notification dispatch failed:', notificationError);
    });

    if (req) {
      await logAuditEvent(req, {
        action: 'payment.verified',
        module: 'PAYMENTS',
        resourceType: 'PaymentTransaction',
        resourceId: updatedTransaction.id,
        metadata: {
          bookingId: securedBooking.id,
          maskedReference: maskReference(updatedTransaction.reference),
          amountMinor: updatedTransaction.amountMinor,
          currency: updatedTransaction.currency,
        },
      });
    }
  }

  return { transaction: updatedTransaction, duplicate: false };
};

export const processPaystackWebhookPayload = async (payload: any, rawBody: Buffer, req?: Request) => {
  const { event, duplicate } = await recordWebhookEvent(payload, rawBody);
  if (!event) return { duplicate: true, processed: false };
  if (duplicate && event.processed) return { duplicate: true, processed: true };

  event.processingStatus = PaymentWebhookProcessingStatus.PROCESSING;
  await event.save();

  const eventType = String(payload?.event || '');
  const reference = String(payload?.data?.reference || '');

  try {
    if (eventType === 'charge.success') {
      await verifyAndSecurePayment(reference, req);
      event.processingStatus = PaymentWebhookProcessingStatus.PROCESSED;
      event.processed = true;
      event.processedAt = new Date();
      await event.save();
      return { duplicate, processed: true };
    }

    if (['charge.failed', 'charge.abandoned'].includes(eventType)) {
      const transaction = await PaymentTransaction.findOne({ provider: PaymentProvider.PAYSTACK, reference });
      if (transaction && transaction.status !== PaymentTransactionStatus.SUCCESS) {
        const booking = await Booking.findById(transaction.bookingId);
        transaction.status = eventType === 'charge.abandoned' ? PaymentTransactionStatus.ABANDONED : PaymentTransactionStatus.FAILED;
        transaction.providerStatus = String(payload?.data?.status || eventType);
        transaction.failedAt = new Date();
        await transaction.save();
        await recordLedgerEntry({
          idempotencyKey: `payment:${transaction.id}:${eventType}`,
          entryType: ledgerType.PAYMENT_FAILED,
          amountMinor: transaction.amountMinor,
          direction: 'MEMO',
          component: 'PAYMENT',
          description: eventType === 'charge.abandoned' ? 'Payment abandoned' : 'Payment failed',
          ...paymentLedgerContext(transaction, booking),
        });
        const releasedPromotions = await releasePromotionReservations(
          promotionSnapshotsFromTransaction(transaction),
          eventType === 'charge.abandoned' ? 'PAYMENT_ABANDONED' : 'PAYMENT_FAILED'
        );
        await Booking.updateOne(
          { _id: transaction.bookingId, paymentStatus: { $ne: BookingPaymentStatus.SECURED } },
          {
            $set: {
              paymentStatus: BookingPaymentStatus.FAILED,
              'metadata.promotions': releasedPromotions,
              'metadata.promotion': releasedPromotions[0] || null,
            },
          }
        );
        req?.app.get('io')?.to(`booking:${transaction.bookingId.toString()}`).emit('payment_failed', {
          bookingId: transaction.bookingId.toString(),
          reference: maskReference(transaction.reference),
          updatedAt: new Date().toISOString(),
        });
      }
      event.processingStatus = PaymentWebhookProcessingStatus.PROCESSED;
      event.processed = true;
      event.processedAt = new Date();
      await event.save();
      return { duplicate, processed: true };
    }

    if (['refund.processed', 'charge.reversed'].includes(eventType)) {
      const transaction = await PaymentTransaction.findOne({ provider: PaymentProvider.PAYSTACK, reference });
      if (transaction) {
        const booking = await Booking.findById(transaction.bookingId);
        const status = eventType === 'refund.processed' ? PaymentTransactionStatus.REFUNDED : PaymentTransactionStatus.REVERSED;
        await markTransactionFailure(transaction, status, eventType);
        await recordLedgerEntry({
          idempotencyKey: `payment:${transaction.id}:${eventType}`,
          entryType: ledgerType.PAYMENT_REVERSED,
          amountMinor: transaction.amountMinor,
          direction: 'DEBIT',
          component: 'PAYMENT',
          description: eventType === 'refund.processed' ? 'Payment refunded' : 'Payment reversed',
          ...paymentLedgerContext(transaction, booking),
        });
        const reversedPromotions = await reverseRedeemedPromotions(
          promotionSnapshotsFromTransaction(transaction),
          eventType === 'refund.processed' ? 'PAYMENT_REFUNDED' : 'PAYMENT_REVERSED'
        );
        await Booking.updateOne(
          { _id: transaction.bookingId, status: { $nin: [BookingStatus.IN_PROGRESS, BookingStatus.COMPLETED] } },
          {
            $set: {
              paymentStatus: eventType === 'refund.processed' ? BookingPaymentStatus.REFUNDED : BookingPaymentStatus.UNDER_REVIEW,
              'metadata.promotions': reversedPromotions,
              'metadata.promotion': reversedPromotions[0] || null,
              'workAuthorization.status': WorkAuthorizationStatus.BLOCKED,
              'workAuthorization.reasonCode': eventType === 'refund.processed' ? 'PAYMENT_REFUNDED' : 'PAYMENT_REVERSED',
              'workAuthorization.evaluatedAt': new Date(),
            },
          }
        );
        req?.app.get('io')?.to(`booking:${transaction.bookingId.toString()}`).emit(
          eventType === 'refund.processed' ? 'payment_refunded' : 'payment_reversed',
          {
            bookingId: transaction.bookingId.toString(),
            reference: maskReference(transaction.reference),
            updatedAt: new Date().toISOString(),
          }
        );
      }
      event.processingStatus = PaymentWebhookProcessingStatus.PROCESSED;
      event.processed = true;
      event.processedAt = new Date();
      await event.save();
      return { duplicate, processed: true };
    }

    event.processingStatus = PaymentWebhookProcessingStatus.IGNORED;
    event.processed = true;
    event.processedAt = new Date();
    await event.save();
    return { duplicate, processed: false };
  } catch (error: any) {
    event.processingStatus = PaymentWebhookProcessingStatus.FAILED;
    event.failureReason = error?.message?.slice(0, 500) || 'Webhook processing failed';
    await event.save();
    throw error;
  }
};

export const maskPaymentReference = maskReference;
