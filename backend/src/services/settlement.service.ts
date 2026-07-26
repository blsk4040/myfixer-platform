import crypto from 'crypto';
import mongoose from 'mongoose';
import { Request } from 'express';
import Booking, {
  BookingPaymentStatus,
  BookingStatus,
  CompletionStatus,
  IBooking,
} from '../models/booking.model';
import PaymentTransaction, { PaymentProvider, PaymentTransactionStatus } from '../models/payment-transaction.model';
import ProviderSettlement, { IProviderSettlement, ProviderSettlementStatus } from '../models/provider-settlement.model';
import PayoutTransaction, { IPayoutTransaction, PayoutTransactionStatus } from '../models/payout-transaction.model';
import ProviderPayoutMethod, { ProviderPayoutMethodStatus } from '../models/provider-payout-method.model';
import JobMedia, { JobMediaPurpose } from '../models/job-media.model';
import { Invoice } from '../models/billing.model';
import { getCountryPaymentFeatureFlags } from '../config/payment-capabilities.config';
import { transitionBookingStatus } from './booking-workflow.service';
import { PaystackService } from './paystack.service';
import { logAuditEvent } from './audit.service';
import { createNotifications } from './notification.service';
import { NotificationChannel } from '../models/notification.model';
import { assertActiveMarket, assertMarketAllowsNewPayout } from './market-finance-guard.service';
import { processReferralRewardForCompletedBooking } from './provider-referral.service';
import { processCustomerReferralRewardForCompletedBooking } from './customer-referral.service';
import { refreshProviderReputationStats } from './provider-reputation.service';

export class SettlementError extends Error {
  constructor(message: string, public readonly code: string, public readonly statusCode = 400) {
    super(message);
  }
}

interface Actor {
  id?: unknown;
  _id?: unknown;
  role?: unknown;
}

const actorId = (actor?: Actor): string => String(actor?.id ?? actor?._id ?? '').trim();
const transferEnabled = (): boolean => ['1', 'true', 'yes', 'on'].includes(String(process.env.PAYSTACK_TRANSFERS_ENABLED || 'false').toLowerCase());
const autoConfirmHours = (): number => Math.max(1, Number(process.env.COMPLETION_AUTO_CONFIRM_HOURS || 72));

const maskReference = (reference: string): string =>
  reference.length <= 10 ? `${reference.slice(0, 3)}...` : `${reference.slice(0, 6)}...${reference.slice(-4)}`;

const serializeSettlement = (settlement: IProviderSettlement) => ({
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

const ensureObjectId = (value: string, label: string) => {
  if (!mongoose.Types.ObjectId.isValid(value)) throw new SettlementError(`Invalid ${label}.`, 'INVALID_ID');
};

const loadBooking = async (bookingId: string) => {
  ensureObjectId(bookingId, 'booking id');
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new SettlementError('Booking not found.', 'BOOKING_NOT_FOUND', 404);
  return booking;
};

const latestSuccessfulPayment = async (booking: IBooking) => {
  const payment = await PaymentTransaction.findOne({
    bookingId: booking._id,
    provider: PaymentProvider.PAYSTACK,
    status: PaymentTransactionStatus.SUCCESS,
  }).sort({ verifiedAt: -1, createdAt: -1 });
  if (!payment) throw new SettlementError('Verified payment is required before completion settlement.', 'PAYMENT_NOT_SECURED', 409);
  return payment;
};

const assertAssignedTechnician = (booking: IBooking, actor?: Actor) => {
  if (String(booking.technicianId || '') !== actorId(actor)) {
    throw new SettlementError('Only the assigned technician can perform this action.', 'UNASSIGNED_TECHNICIAN', 403);
  }
};

const assertBookingOwner = (booking: IBooking, actor?: Actor) => {
  if (String(booking.customerId || '') !== actorId(actor)) {
    throw new SettlementError('Only the booking owner can perform this action.', 'UNAUTHORIZED_CUSTOMER', 403);
  }
};

const validateEvidence = async (booking: IBooking, mediaIds: string[]) => {
  if (mediaIds.length === 0) throw new SettlementError('Completion evidence photo is required.', 'COMPLETION_EVIDENCE_REQUIRED');
  const validIds = mediaIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (validIds.length !== mediaIds.length) throw new SettlementError('Invalid evidence media id.', 'INVALID_MEDIA_ID');
  const count = await JobMedia.countDocuments({
    _id: { $in: validIds },
    bookingId: booking._id,
    uploadedByUserId: booking.technicianId,
    purpose: JobMediaPurpose.PROOF_OF_COMPLETION,
  });
  if (count !== mediaIds.length) throw new SettlementError('Completion evidence must belong to this booking and technician.', 'INVALID_COMPLETION_EVIDENCE');
};

export const submitProviderCompletion = async (
  bookingId: string,
  actor: Actor | undefined,
  input: {
    completionNotes: string;
    partsUsed?: Array<{ name: string; quantity?: number; amountMinor?: number; notes?: string }>;
    evidenceMediaIds?: string[];
    finalAmountMinor: number;
    idempotencyKey?: string;
  },
  req?: Request
) => {
  const booking = await loadBooking(bookingId);
  assertAssignedTechnician(booking, actor);
  if (booking.status !== BookingStatus.IN_PROGRESS) throw new SettlementError('Completion can only be submitted after work has started.', 'BOOKING_NOT_IN_PROGRESS', 409);
  if (booking.paymentStatus !== BookingPaymentStatus.SECURED) throw new SettlementError('Payment must be secured before completion can be submitted.', 'PAYMENT_NOT_SECURED', 409);
  if ((booking.completion?.status === CompletionStatus.CUSTOMER_CONFIRMATION_PENDING || booking.completion?.status === CompletionStatus.PROVIDER_SUBMITTED) && booking.completion?.submittedAt) {
    return { booking, duplicate: true };
  }
  const notes = input.completionNotes.trim();
  if (notes.length < 5) throw new SettlementError('Completion notes are required.', 'COMPLETION_NOTES_REQUIRED');
  const payment = await latestSuccessfulPayment(booking);
  if (!Number.isInteger(input.finalAmountMinor) || input.finalAmountMinor !== payment.amountMinor) {
    throw new SettlementError('Final amount must match the approved paid amount.', 'FINAL_AMOUNT_MISMATCH', 409);
  }
  const evidenceMediaIds = input.evidenceMediaIds || [];
  await validateEvidence(booking, evidenceMediaIds);
  const now = new Date();
  const autoConfirmEligibleAt = new Date(now.getTime() + autoConfirmHours() * 60 * 60 * 1000);
  const updated = await Booking.findOneAndUpdate(
    {
      _id: booking._id,
      technicianId: new mongoose.Types.ObjectId(actorId(actor)),
      status: BookingStatus.IN_PROGRESS,
      paymentStatus: BookingPaymentStatus.SECURED,
      $or: [{ 'completion.status': { $exists: false } }, { 'completion.status': CompletionStatus.NOT_SUBMITTED }],
    },
    {
      $set: {
        completion: {
          status: CompletionStatus.CUSTOMER_CONFIRMATION_PENDING,
          submittedBy: new mongoose.Types.ObjectId(actorId(actor)),
          submittedAt: now,
          completionNotes: notes,
          partsUsed: input.partsUsed || [],
          evidenceMediaIds: evidenceMediaIds.map((id) => new mongoose.Types.ObjectId(id)),
          finalAmountMinor: input.finalAmountMinor,
          currency: booking.currency,
          autoConfirmEligibleAt,
        },
      },
    },
    { new: true }
  );
  if (!updated) throw new SettlementError('Completion was already submitted or booking state changed.', 'COMPLETION_CONFLICT', 409);
  req?.app.get('io')?.to(`booking:${booking.id}`).emit('completion_submitted', {
    bookingId: booking.id,
    completionStatus: CompletionStatus.CUSTOMER_CONFIRMATION_PENDING,
    finalAmountMinor: input.finalAmountMinor,
    currency: booking.currency,
  });
  if (req) await logAuditEvent(req, {
    action: 'completion.submit',
    module: 'BOOKINGS',
    resourceType: 'Booking',
    resourceId: booking.id,
    metadata: { bookingId: booking.id, finalAmountMinor: input.finalAmountMinor, idempotencyKey: input.idempotencyKey || '' },
  });
  void createNotifications({
    userId: booking.customerId,
    email: booking.customerEmail,
    name: booking.customerName,
    channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
    type: 'COMPLETION_SUBMITTED',
    title: 'Provider marked the work complete',
    message: 'Inspect the work before confirming completion in MyFixer.',
    metadata: { bookingId: booking.id },
  }).catch(() => undefined);
  return { booking: updated, duplicate: false };
};

const createSettlementFromBooking = async (booking: IBooking, payment: any, status: ProviderSettlementStatus) => {
  const market = await assertActiveMarket(booking.countryCode);
  const invoice = await Invoice.findOne({ bookingId: booking._id }).lean();
  const invoiceBreakdown = invoice?.metadata?.priceBreakdown && typeof invoice.metadata.priceBreakdown === 'object'
    ? invoice.metadata.priceBreakdown as Record<string, any>
    : null;
  const bookingBreakdown = booking.metadata?.priceBreakdown && typeof booking.metadata.priceBreakdown === 'object'
    ? booking.metadata.priceBreakdown as Record<string, any>
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
  const settlement = await ProviderSettlement.findOneAndUpdate(
    { bookingId: booking._id },
    {
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
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return settlement;
};

export const confirmCustomerCompletion = async (bookingId: string, actor: Actor | undefined, input: { idempotencyKey?: string }, req?: Request) => {
  let booking = await loadBooking(bookingId);
  assertBookingOwner(booking, actor);
  if (booking.status === BookingStatus.COMPLETED && booking.completion?.status === CompletionStatus.CUSTOMER_CONFIRMED) {
    const existing = await ProviderSettlement.findOne({ bookingId: booking._id });
    return { booking, settlement: existing, duplicate: true };
  }
  if (booking.completion?.status !== CompletionStatus.CUSTOMER_CONFIRMATION_PENDING) {
    throw new SettlementError('Completion is not awaiting customer confirmation.', 'COMPLETION_NOT_PENDING', 409);
  }
  const payment = await latestSuccessfulPayment(booking);
  const now = new Date();
  const updated = await Booking.findOneAndUpdate(
    {
      _id: booking._id,
      customerId: new mongoose.Types.ObjectId(actorId(actor)),
      status: BookingStatus.IN_PROGRESS,
      'completion.status': CompletionStatus.CUSTOMER_CONFIRMATION_PENDING,
      paymentStatus: BookingPaymentStatus.SECURED,
    },
    {
      $set: {
        'completion.status': CompletionStatus.CUSTOMER_CONFIRMED,
        'completion.customerConfirmedBy': new mongoose.Types.ObjectId(actorId(actor)),
        'completion.customerConfirmedAt': now,
      },
    },
    { new: true }
  );
  if (!updated) throw new SettlementError('Completion confirmation conflict.', 'COMPLETION_CONFIRMATION_CONFLICT', 409);
  const completedBooking = await transitionBookingStatus({
    booking: updated as IBooking,
    actor: { id: actorId(actor), role: String(actor?.role || '') },
    nextStatus: BookingStatus.COMPLETED,
    action: 'COMPLETE_JOB',
  });
  const flags = getCountryPaymentFeatureFlags(completedBooking.countryCode);
  const settlement = await createSettlementFromBooking(
    completedBooking,
    payment,
    flags.adminApprovalRequired ? ProviderSettlementStatus.APPROVAL_REQUIRED : ProviderSettlementStatus.READY_FOR_PAYOUT
  );
  if (completedBooking.technicianId) {
    await refreshProviderReputationStats(completedBooking.technicianId);
  }
  await processReferralRewardForCompletedBooking(completedBooking);
  await processCustomerReferralRewardForCompletedBooking(completedBooking);
  req?.app.get('io')?.to(`booking:${completedBooking.id}`).emit('completion_confirmed', {
    bookingId: completedBooking.id,
    status: completedBooking.status,
    completionStatus: CompletionStatus.CUSTOMER_CONFIRMED,
    settlementStatus: settlement.status,
  });
  req?.app.get('io')?.to(`technician:${completedBooking.technicianId?.toString()}`).emit('settlement_created', serializeSettlement(settlement));
  if (req) await logAuditEvent(req, {
    action: 'completion.confirm',
    module: 'BOOKINGS',
    resourceType: 'Booking',
    resourceId: completedBooking.id,
    metadata: { bookingId: completedBooking.id, settlementId: settlement.id, idempotencyKey: input.idempotencyKey || '' },
  });
  return { booking: completedBooking, settlement, duplicate: false };
};

export const reportCompletionIssue = async (bookingId: string, actor: Actor | undefined, input: { reason: string }, req?: Request) => {
  const booking = await loadBooking(bookingId);
  assertBookingOwner(booking, actor);
  const reason = input.reason.trim();
  if (reason.length < 8) throw new SettlementError('Issue reason is required.', 'ISSUE_REASON_REQUIRED');
  if (booking.completion?.status !== CompletionStatus.CUSTOMER_CONFIRMATION_PENDING) {
    throw new SettlementError('Issue reporting is available only while completion is awaiting confirmation.', 'ISSUE_INVALID_STATE', 409);
  }
  const updated = await Booking.findOneAndUpdate(
    { _id: booking._id, customerId: new mongoose.Types.ObjectId(actorId(actor)), 'completion.status': CompletionStatus.CUSTOMER_CONFIRMATION_PENDING },
    {
      $set: {
        'completion.status': CompletionStatus.ISSUE_REPORTED,
        'completion.issueReportedBy': new mongoose.Types.ObjectId(actorId(actor)),
        'completion.issueReportedAt': new Date(),
        'completion.issueReason': reason,
      },
    },
    { new: true }
  );
  if (!updated) throw new SettlementError('Completion issue conflict.', 'ISSUE_CONFLICT', 409);
  await ProviderSettlement.findOneAndUpdate(
    { bookingId: booking._id },
    {
      $set: {
        status: ProviderSettlementStatus.ON_HOLD,
        holdReason: 'CUSTOMER_ISSUE',
        heldAt: new Date(),
        heldBy: new mongoose.Types.ObjectId(actorId(actor)),
      },
    },
    { new: true }
  );
  req?.app.get('io')?.to(`booking:${booking.id}`).emit('completion_issue_reported', { bookingId: booking.id });
  if (req) await logAuditEvent(req, {
    action: 'completion.issue_reported',
    module: 'BOOKINGS',
    resourceType: 'Booking',
    resourceId: booking.id,
    metadata: { bookingId: booking.id, reasonCode: 'CUSTOMER_ISSUE' },
  });
  return { booking: updated };
};

const generatePayoutReference = (settlementId: string): string =>
  `mfx_po_${settlementId.slice(-8)}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

const initiatePayoutForSettlement = async (settlement: IProviderSettlement, actor: Actor | undefined, req?: Request) => {
  if (!transferEnabled()) throw new SettlementError('Paystack transfers are disabled.', 'PAYOUTS_DISABLED', 409);
  await assertMarketAllowsNewPayout(settlement.countryCode, settlement.currency, PaymentProvider.PAYSTACK);
  const method = await ProviderPayoutMethod.findOne({
    technicianId: settlement.technicianId,
    countryCode: settlement.countryCode,
    currency: settlement.currency,
    status: ProviderPayoutMethodStatus.VERIFIED,
    isDefault: true,
  });
  if (!method || !method.providerRecipientCode) {
    throw new SettlementError('A verified default payout method is required.', 'VERIFIED_PAYOUT_METHOD_REQUIRED', 409);
  }
  const reference = generatePayoutReference(settlement.id);
  const payout = await PayoutTransaction.create({
    provider: method.provider,
    reference,
    settlementId: settlement._id,
    bookingId: settlement.bookingId,
    technicianId: settlement.technicianId,
    payoutMethodId: method._id,
    countryCode: settlement.countryCode,
    currency: settlement.currency,
    amountMinor: settlement.netAmountMinor,
    status: PayoutTransactionStatus.INITIALIZED,
    recipientSnapshot: {
      type: method.type,
      maskedDestination: method.maskedDestination,
      providerRecipientCode: method.providerRecipientCode,
    },
    initiatedBy: actorId(actor) && mongoose.Types.ObjectId.isValid(actorId(actor)) ? new mongoose.Types.ObjectId(actorId(actor)) : null,
    initiatedAt: new Date(),
    idempotencyKey: `settlement:${settlement.id}:amount:${settlement.netAmountMinor}`,
    metadata: {},
  });
  const transfer = await PaystackService.initiateTransfer({
    amountMinor: settlement.netAmountMinor,
    currency: settlement.currency,
    recipientCode: method.providerRecipientCode,
    reference,
    reason: `MyFixer provider payout for booking ${settlement.bookingId.toString()}`,
  });
  payout.status = PayoutTransactionStatus.PROCESSING;
  payout.providerStatus = String(transfer?.data?.status || 'processing');
  payout.providerTransferCode = String(transfer?.data?.transfer_code || '');
  await payout.save();
  settlement.status = ProviderSettlementStatus.PAYOUT_PROCESSING;
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

export const approveSettlement = async (settlementId: string, actor: Actor | undefined, input: { reason: string; idempotencyKey?: string }, req?: Request) => {
  ensureObjectId(settlementId, 'settlement id');
  const reason = input.reason.trim();
  if (reason.length < 5) throw new SettlementError('Admin approval reason is required.', 'APPROVAL_REASON_REQUIRED');
  const settlement = await ProviderSettlement.findOne({ _id: settlementId });
  if (!settlement) throw new SettlementError('Settlement not found.', 'SETTLEMENT_NOT_FOUND', 404);
  if (settlement.status === ProviderSettlementStatus.PAYOUT_PROCESSING || settlement.status === ProviderSettlementStatus.PAID) {
    return { settlement, duplicate: true };
  }
  if (![ProviderSettlementStatus.APPROVAL_REQUIRED, ProviderSettlementStatus.READY_FOR_PAYOUT, ProviderSettlementStatus.PAYOUT_FAILED].includes(settlement.status)) {
    throw new SettlementError('Settlement is not eligible for approval.', 'SETTLEMENT_NOT_ELIGIBLE', 409);
  }
  if (settlement.holdReason) throw new SettlementError('Settlement is on hold.', 'SETTLEMENT_ON_HOLD', 409);
  const booking = await Booking.findById(settlement.bookingId);
  if (!booking || booking.paymentStatus !== BookingPaymentStatus.SECURED || booking.completion?.status !== CompletionStatus.CUSTOMER_CONFIRMED) {
    throw new SettlementError('Settlement eligibility checks failed.', 'SETTLEMENT_ELIGIBILITY_FAILED', 409);
  }
  settlement.status = ProviderSettlementStatus.APPROVED;
  settlement.approvedAt = settlement.approvedAt || new Date();
  settlement.approvedBy = actorId(actor) && mongoose.Types.ObjectId.isValid(actorId(actor)) ? new mongoose.Types.ObjectId(actorId(actor)) : null;
  settlement.metadata = { ...(settlement.metadata || {}), approvalReason: reason };
  await settlement.save();
  if (req) await logAuditEvent(req, {
    action: 'settlement.approve',
    module: 'PAYMENTS',
    resourceType: 'ProviderSettlement',
    resourceId: settlement.id,
    metadata: { settlementId: settlement.id, bookingId: settlement.bookingId.toString(), reason },
  });
  const result = await initiatePayoutForSettlement(settlement, actor, req);
  return { ...result, duplicate: false };
};

export const holdSettlement = async (settlementId: string, actor: Actor | undefined, reason: string, req?: Request) => {
  const trimmed = reason.trim();
  if (trimmed.length < 5) throw new SettlementError('Hold reason is required.', 'HOLD_REASON_REQUIRED');
  const settlement = await ProviderSettlement.findOneAndUpdate(
    { _id: settlementId, status: { $nin: [ProviderSettlementStatus.PAID, ProviderSettlementStatus.PAYOUT_PROCESSING] } },
    {
      $set: {
        status: ProviderSettlementStatus.ON_HOLD,
        holdReason: trimmed,
        heldAt: new Date(),
        heldBy: actorId(actor) && mongoose.Types.ObjectId.isValid(actorId(actor)) ? new mongoose.Types.ObjectId(actorId(actor)) : null,
      },
    },
    { new: true }
  );
  if (!settlement) throw new SettlementError('Settlement cannot be placed on hold.', 'HOLD_CONFLICT', 409);
  req?.app.get('io')?.to(`technician:${settlement.technicianId.toString()}`).emit('settlement_on_hold', serializeSettlement(settlement));
  return settlement;
};

export const releaseSettlementHold = async (settlementId: string, actor: Actor | undefined, reason: string) => {
  const settlement = await ProviderSettlement.findOneAndUpdate(
    { _id: settlementId, status: ProviderSettlementStatus.ON_HOLD },
    {
      $set: {
        status: ProviderSettlementStatus.APPROVAL_REQUIRED,
        releasedFromHoldAt: new Date(),
        'metadata.releaseReason': reason.trim(),
        'metadata.releasedBy': actorId(actor),
      },
      $unset: { holdReason: '' },
    },
    { new: true }
  );
  if (!settlement) throw new SettlementError('Settlement hold could not be released.', 'RELEASE_HOLD_CONFLICT', 409);
  return settlement;
};

export const listSettlements = async (filter: Record<string, unknown> = {}) => {
  const settlements = await ProviderSettlement.find(filter).sort({ createdAt: -1 }).limit(200);
  return settlements.map(serializeSettlement);
};

export const retrySettlementPayout = async (settlementId: string, actor: Actor | undefined, reason: string, req?: Request) => {
  const settlement = await ProviderSettlement.findOne({ _id: settlementId, status: ProviderSettlementStatus.PAYOUT_FAILED });
  if (!settlement) throw new SettlementError('Only failed payouts can be retried.', 'RETRY_NOT_ALLOWED', 409);
  settlement.status = ProviderSettlementStatus.APPROVAL_REQUIRED;
  settlement.metadata = { ...(settlement.metadata || {}), retryReason: reason.trim() };
  await settlement.save();
  return approveSettlement(settlement.id, actor, { reason: reason || 'Retry approved payout' }, req);
};

export const processPaystackTransferWebhookPayload = async (payload: any, req?: Request) => {
  const eventType = String(payload?.event || '');
  const data = payload?.data || {};
  const reference = String(data.reference || '');
  const transferCode = String(data.transfer_code || '');
  const payout = await PayoutTransaction.findOne({
    $or: [{ reference }, ...(transferCode ? [{ providerTransferCode: transferCode }] : [])],
  });
  if (!payout) return { processed: false };
  if (payout.status === PayoutTransactionStatus.SUCCESS && eventType === 'transfer.success') return { processed: true, duplicate: true };

  const settlement = await ProviderSettlement.findById(payout.settlementId);
  if (!settlement) return { processed: false };

  if (eventType === 'transfer.success') {
    let verified: any = null;
    try {
      verified = await PaystackService.verifyTransfer(reference || transferCode);
    } catch {
      verified = null;
    }
    const providerAmount = Number(verified?.data?.amount ?? data.amount);
    const providerCurrency = String(verified?.data?.currency ?? data.currency ?? payout.currency).toUpperCase();
    const amountMatches = providerAmount === payout.amountMinor;
    const currencyMatches = providerCurrency === payout.currency;
    if (!amountMatches || !currencyMatches) {
      payout.status = PayoutTransactionStatus.UNDER_REVIEW;
      payout.providerStatus = 'mismatch';
      payout.verifiedAt = new Date();
      payout.metadata = { ...(payout.metadata || {}), amountMatches, currencyMatches, providerAmount, providerCurrency };
      await payout.save();
      settlement.status = ProviderSettlementStatus.UNDER_REVIEW;
      await settlement.save();
      return { processed: true };
    }
    const now = new Date();
    payout.status = PayoutTransactionStatus.SUCCESS;
    payout.providerStatus = String(verified?.data?.status || data.status || 'success');
    payout.succeededAt = payout.succeededAt || now;
    payout.verifiedAt = now;
    await payout.save();
    settlement.status = ProviderSettlementStatus.PAID;
    settlement.paidAt = settlement.paidAt || now;
    await settlement.save();
    req?.app.get('io')?.to(`technician:${settlement.technicianId.toString()}`).emit('payout_paid', serializeSettlement(settlement));
    return { processed: true };
  }

  if (['transfer.failed', 'transfer.reversed'].includes(eventType)) {
    const reversed = eventType === 'transfer.reversed';
    payout.status = reversed ? PayoutTransactionStatus.REVERSED : PayoutTransactionStatus.FAILED;
    payout.providerStatus = String(data.status || eventType);
    if (reversed) payout.reversedAt = new Date();
    else payout.failedAt = new Date();
    await payout.save();
    settlement.status = reversed ? ProviderSettlementStatus.REVERSED : ProviderSettlementStatus.PAYOUT_FAILED;
    await settlement.save();
    req?.app.get('io')?.to(`technician:${settlement.technicianId.toString()}`).emit(reversed ? 'payout_reversed' : 'payout_failed', serializeSettlement(settlement));
    return { processed: true };
  }
  return { processed: false };
};
