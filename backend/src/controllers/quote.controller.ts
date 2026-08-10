import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Server as SocketIOServer } from 'socket.io';
import Booking, { BookingPaymentStatus, WorkAuthorizationStatus } from '../models/booking.model';
import JobQuote, { QuoteStatus } from '../models/quote.model';
import MarketSetting from '../models/market-setting.model';
import { NotificationChannel } from '../models/notification.model';
import { normalizeUserRole, UserRole } from '../models/user.model';
import { createNotifications } from '../services/notification.service';
import { logAuditEvent } from '../services/audit.service';
import { calculateQuoteTotals, QuoteWorkflowError } from '../services/quote-workflow.service';
import { calculatePriceBreakdown } from '../services/price-breakdown.service';
import { ledgerType, recordLedgerEntries, recordLedgerEntry } from '../services/financial-ledger.service';

interface QuoteRequestBody {
  lineItems?: unknown;
  technicianNotes?: unknown;
  notes?: unknown;
  draft?: unknown;
  submit?: unknown;
  parentQuoteId?: unknown;
  expiresAt?: unknown;
}

interface QuoteDecisionBody {
  note?: unknown;
  message?: unknown;
}

const getAuthUser = (request: Request) =>
  (request as any).user as { id?: string; _id?: string; role?: string; email?: string } | undefined;

const getUserId = (request: Request): string =>
  String(getAuthUser(request)?.id ?? getAuthUser(request)?._id ?? '').trim();

const isOwnerOrAdmin = (booking: any, userId: string, role: UserRole): boolean =>
  role === UserRole.ADMIN || String(booking.customerId) === userId;

const isAssignedTechnicianOrAdmin = (booking: any, userId: string, role: UserRole): boolean =>
  role === UserRole.ADMIN || String(booking.technicianId || '') === userId;

const isQuoteSubmittedStatus = (status: QuoteStatus): boolean =>
  [QuoteStatus.SUBMITTED, QuoteStatus.SENT_TO_CLIENT].includes(status);

const buildQuoteNumber = (quoteId: mongoose.Types.ObjectId, version: number): string =>
  `Q-PADI-${new Date().getFullYear()}-${quoteId.toString().slice(-6).toUpperCase()}-V${Math.max(1, Math.round(version || 1))}`;

const serializeQuote = (quote: any) => ({
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
  lineItems: (quote.lineItems || []).map((item: any) => ({
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

const emitQuoteEvent = (request: Request, event: string, quote: any): void => {
  const io = request.app.get('io') as SocketIOServer | undefined;
  io?.to(`booking:${quote.bookingId.toString()}`).emit(event, serializeQuote(quote));
};

const quoteLedgerContext = (booking: any, quote: any) => ({
  bookingId: booking._id,
  quoteId: quote._id,
  customerId: booking.customerId,
  technicianId: booking.technicianId,
  countryCode: booking.countryCode,
  currency: booking.currency,
});

const defaultExpiry = (): Date => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

const parseExpiry = (value: unknown): Date => {
  if (!value) return defaultExpiry();
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
    throw new QuoteWorkflowError('Quote expiry must be a future timestamp.', 'INVALID_QUOTE_EXPIRY');
  }
  return parsed;
};

const positiveMinor = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;

const lineTotal = (items: Array<{ type: string; totalAmountMinor: number }>, types: string[]): number =>
  items
    .filter((item) => types.includes(String(item.type)))
    .reduce((sum, item) => sum + positiveMinor(item.totalAmountMinor), 0);

const buildQuotePriceBreakdown = async (booking: any, totals: ReturnType<typeof calculateQuoteTotals>) => {
  const bookingBreakdown = booking.metadata?.priceBreakdown && typeof booking.metadata.priceBreakdown === 'object'
    ? booking.metadata.priceBreakdown as Record<string, unknown>
    : {};
  const bookingCalloutMinor = positiveMinor(bookingBreakdown.calloutFeeMinor ?? booking.priceMinor);
  const quoteCalloutMinor = lineTotal(totals.lineItems, ['CALL_OUT', 'CALLOUT']);
  const labourMinor = lineTotal(totals.lineItems, ['LABOUR', 'LABOR']);
  const partsMinor = lineTotal(totals.lineItems, ['PART']);
  const additionalServicesMinor = lineTotal(totals.lineItems, ['ADD_ON']);
  const surchargeMinor = lineTotal(totals.lineItems, ['SURCHARGE']);
  const repairWorkMinor = labourMinor + partsMinor + additionalServicesMinor + surchargeMinor;
  const calloutFeeDeductible = bookingBreakdown.calloutFeeDeductible !== false && quoteCalloutMinor > 0 && repairWorkMinor > 0;
  const marketSetting = await MarketSetting.findOne({ 'identity.countryCode': booking.countryCode }).lean();

  return calculatePriceBreakdown({
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

export const createJobQuote = async (request: Request, response: Response): Promise<void> => {
  const { bookingId } = request.params;
  const body = request.body as QuoteRequestBody;
  const userId = getUserId(request);
  const role = normalizeUserRole(getAuthUser(request)?.role);

  try {
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      response.status(400).json({ message: 'Invalid booking id.' });
      return;
    }
    if (role !== UserRole.TECHNICIAN && role !== UserRole.ADMIN) {
      response.status(403).json({ message: 'Only the assigned technician can create a quote.' });
      return;
    }

    const booking = await Booking.findById(bookingId);
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
    let parentQuote: any = null;

    if (parentQuoteId) {
      if (!mongoose.Types.ObjectId.isValid(parentQuoteId)) {
        response.status(400).json({ message: 'Invalid parent quote id.' });
        return;
      }
      parentQuote = await JobQuote.findOne({ _id: parentQuoteId, bookingId: booking._id });
      if (!parentQuote) {
        response.status(404).json({ message: 'Parent quote not found.' });
        return;
      }
      if (parentQuote.status === QuoteStatus.APPROVED) {
        response.status(409).json({ message: 'Approved quotes cannot be revised.' });
        return;
      }
      version = Number(parentQuote.version || 1) + 1;
    } else {
      const latest = await JobQuote.findOne({ bookingId: booking._id }).sort({ version: -1, createdAt: -1 }).lean();
      version = latest ? Number(latest.version || 1) + 1 : 1;
    }

    const totals = calculateQuoteTotals(Array.isArray(body.lineItems) ? body.lineItems as any[] : [], booking.currency);
    const priceBreakdown = await buildQuotePriceBreakdown(booking, totals);
    const now = new Date();
    const status = shouldSubmit ? QuoteStatus.SUBMITTED : QuoteStatus.DRAFT;
    const quoteId = new mongoose.Types.ObjectId();
    const quote = await JobQuote.create({
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
      submittedBy: shouldSubmit ? new mongoose.Types.ObjectId(userId) : undefined,
      createdBy: new mongoose.Types.ObjectId(userId),
      expiresAt: shouldSubmit ? parseExpiry(body.expiresAt) : null,
      metadata: {
        priceBreakdown,
        pricingPolicy: 'callout-credit-v1',
      },
    });

    if (shouldSubmit) {
      await JobQuote.updateMany(
        {
          _id: { $ne: quote._id },
          bookingId: booking._id,
          isCurrent: true,
          status: { $in: [QuoteStatus.SUBMITTED, QuoteStatus.SENT_TO_CLIENT, QuoteStatus.CLARIFICATION_REQUESTED, QuoteStatus.REJECTED] },
        },
        {
          $set: {
            status: QuoteStatus.SUPERSEDED,
            isCurrent: false,
            supersededAt: now,
          },
        }
      );

      booking.set('metadata.latestQuoteId', quote._id.toString());
      booking.set('metadata.latestQuoteVersion', quote.version);
      booking.set('metadata.latestQuoteTotal', quote.totalAmountMinor);
      booking.set('metadata.latestQuoteSentAt', now.toISOString());
      booking.set('workAuthorization.status', WorkAuthorizationStatus.AWAITING_QUOTE_APPROVAL);
      booking.set('workAuthorization.reasonCode', 'QUOTE_NOT_APPROVED');
      booking.set('workAuthorization.evaluatedAt', now);
      await booking.save();
    }

    emitQuoteEvent(request, shouldSubmit ? (version > 1 ? 'quote_revised' : 'quote_submitted') : 'quote_draft_saved', quote);

    if (shouldSubmit) {
      const creditMinor = typeof priceBreakdown.calloutCreditMinor === 'number' ? priceBreakdown.calloutCreditMinor : 0;
      await recordLedgerEntries([
        {
          idempotencyKey: `quote:${quote.id}:submitted`,
          entryType: ledgerType.QUOTE_SUBMITTED,
          amountMinor: priceBreakdown.totalBeforeCreditMinor,
          direction: 'MEMO',
          component: 'MEMO',
          description: 'Repair quote submitted',
          ...quoteLedgerContext(booking, quote),
          metadata: {
            quoteNumber: quote.quoteNumber,
            amountDueMinor: priceBreakdown.amountDueMinor,
            platformCommissionBaseMinor: priceBreakdown.platformCommissionBaseMinor,
            platformCommissionMinor: priceBreakdown.platformCommissionMinor,
          },
        },
        ...(creditMinor > 0 ? [{
          idempotencyKey: `quote:${quote.id}:callout-credit`,
          entryType: ledgerType.CALLOUT_CREDIT_APPLIED,
          amountMinor: creditMinor,
          direction: 'CREDIT' as const,
          component: 'CREDIT' as const,
          description: 'Call-out fee credit applied to repair quote',
          ...quoteLedgerContext(booking, quote),
          metadata: { quoteNumber: quote.quoteNumber },
        }] : []),
      ]);

      await createNotifications({
        userId: booking.customerId,
        channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
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

    await logAuditEvent(request, {
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
  } catch (error) {
    if (error instanceof QuoteWorkflowError) {
      response.status(error.statusCode).json({ message: error.message, code: error.code });
      return;
    }
    console.error('Failed to create job quote:', error);
    response.status(500).json({ message: 'Failed to create quote.' });
  }
};

export const submitJobQuote = async (request: Request, response: Response): Promise<void> => {
  const { quoteId } = request.params;
  const userId = getUserId(request);
  const role = normalizeUserRole(getAuthUser(request)?.role);

  try {
    const quote = await JobQuote.findById(quoteId);
    if (!quote) {
      response.status(404).json({ message: 'Quote not found.' });
      return;
    }
    const booking = await Booking.findById(quote.bookingId);
    if (!booking) {
      response.status(404).json({ message: 'Booking not found.' });
      return;
    }
    if (!isAssignedTechnicianOrAdmin(booking, userId, role)) {
      response.status(403).json({ message: 'Only the assigned technician can submit this quote.' });
      return;
    }
    if (quote.status !== QuoteStatus.DRAFT) {
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
        priceBreakdown: await buildQuotePriceBreakdown(booking, totals as ReturnType<typeof calculateQuoteTotals>),
        pricingPolicy: 'callout-credit-v1',
      };
    }
    quote.status = QuoteStatus.SUBMITTED;
    quote.quoteNumber = quote.quoteNumber || buildQuoteNumber(quote._id, Number(quote.version || 1));
    quote.sentAt = now;
    quote.submittedAt = now;
    quote.submittedBy = new mongoose.Types.ObjectId(userId);
    quote.expiresAt = parseExpiry(request.body?.expiresAt);
    await quote.save();

    await JobQuote.updateMany(
      {
        _id: { $ne: quote._id },
        bookingId: booking._id,
        isCurrent: true,
        status: { $in: [QuoteStatus.SUBMITTED, QuoteStatus.SENT_TO_CLIENT, QuoteStatus.CLARIFICATION_REQUESTED, QuoteStatus.REJECTED] },
      },
      { $set: { status: QuoteStatus.SUPERSEDED, isCurrent: false, supersededAt: now } }
    );

    booking.set('workAuthorization.status', WorkAuthorizationStatus.AWAITING_QUOTE_APPROVAL);
    booking.set('workAuthorization.reasonCode', 'QUOTE_NOT_APPROVED');
    booking.set('workAuthorization.evaluatedAt', now);
    await booking.save();

    const priceBreakdown = quote.metadata?.priceBreakdown && typeof quote.metadata.priceBreakdown === 'object'
      ? quote.metadata.priceBreakdown as Record<string, any>
      : null;
    const creditMinor = typeof priceBreakdown?.calloutCreditMinor === 'number' ? Math.max(0, Math.round(priceBreakdown.calloutCreditMinor)) : 0;
    await recordLedgerEntries([
      {
        idempotencyKey: `quote:${quote.id}:submitted`,
        entryType: ledgerType.QUOTE_SUBMITTED,
        amountMinor: typeof priceBreakdown?.totalBeforeCreditMinor === 'number' ? Math.max(0, Math.round(priceBreakdown.totalBeforeCreditMinor)) : quote.totalAmountMinor,
        direction: 'MEMO',
        component: 'MEMO',
        description: 'Repair quote submitted',
        ...quoteLedgerContext(booking, quote),
        metadata: {
          quoteNumber: quote.quoteNumber || buildQuoteNumber(quote._id, Number(quote.version || 1)),
          amountDueMinor: typeof priceBreakdown?.amountDueMinor === 'number' ? Math.max(0, Math.round(priceBreakdown.amountDueMinor)) : quote.totalAmountMinor,
          platformCommissionBaseMinor: priceBreakdown?.platformCommissionBaseMinor,
          platformCommissionMinor: priceBreakdown?.platformCommissionMinor,
        },
      },
      ...(creditMinor > 0 ? [{
        idempotencyKey: `quote:${quote.id}:callout-credit`,
        entryType: ledgerType.CALLOUT_CREDIT_APPLIED,
        amountMinor: creditMinor,
        direction: 'CREDIT' as const,
        component: 'CREDIT' as const,
        description: 'Call-out fee credit applied to repair quote',
        ...quoteLedgerContext(booking, quote),
        metadata: { quoteNumber: quote.quoteNumber || buildQuoteNumber(quote._id, Number(quote.version || 1)) },
      }] : []),
    ]);

    emitQuoteEvent(request, quote.version > 1 ? 'quote_revised' : 'quote_submitted', quote);
    await createNotifications({
      userId: booking.customerId,
      channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
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
  } catch (error) {
    response.status(500).json({ message: 'Failed to submit quote.' });
  }
};

export const getBookingQuotes = async (request: Request, response: Response): Promise<void> => {
  const { bookingId } = request.params;
  const userId = getUserId(request);
  const role = normalizeUserRole(getAuthUser(request)?.role);

  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    response.status(400).json({ message: 'Invalid booking id.' });
    return;
  }

  const booking = await Booking.findById(bookingId).lean();
  if (!booking) {
    response.status(404).json({ message: 'Booking not found.' });
    return;
  }
  if (!isOwnerOrAdmin(booking, userId, role) && !isAssignedTechnicianOrAdmin(booking, userId, role)) {
    response.status(403).json({ message: 'Not authorized to view quotes for this booking.' });
    return;
  }

  const quotes = await JobQuote.find({ bookingId: booking._id }).sort({ version: -1, createdAt: -1 }).lean();
  response.status(200).json({ success: true, quotes: quotes.map(serializeQuote) });
};

const decideJobQuote = async (
  request: Request,
  response: Response,
  decision: QuoteStatus.APPROVED | QuoteStatus.REJECTED
): Promise<void> => {
  const { quoteId } = request.params;
  const body = request.body as QuoteDecisionBody;
  const userId = getUserId(request);
  const role = normalizeUserRole(getAuthUser(request)?.role);
  const note = typeof body.note === 'string' ? body.note.trim() : '';

  if (decision === QuoteStatus.REJECTED && !note) {
    response.status(400).json({ message: 'A rejection reason is required.' });
    return;
  }

  const quote = await JobQuote.findById(quoteId);
  if (!quote) {
    response.status(404).json({ message: 'Quote not found.' });
    return;
  }
  const booking = await Booking.findById(quote.bookingId);
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
    quote.status = QuoteStatus.EXPIRED;
    quote.expiredAt = new Date();
    quote.isCurrent = false;
    await quote.save();
    response.status(409).json({ message: 'This quote has expired.', code: 'QUOTE_EXPIRED' });
    return;
  }

  const now = new Date();
  const updated = await JobQuote.findOneAndUpdate(
    {
      _id: quote._id,
      status: { $in: [QuoteStatus.SUBMITTED, QuoteStatus.SENT_TO_CLIENT] },
      isCurrent: { $ne: false },
    },
    {
      $set: {
        status: decision,
        clientDecisionNote: note,
        decisionBy: new mongoose.Types.ObjectId(userId),
        ...(decision === QuoteStatus.APPROVED ? { approvedAt: now } : { rejectedAt: now }),
      },
    },
    { new: true }
  );

  if (!updated) {
    response.status(409).json({ message: 'Quote state changed before it could be updated.' });
    return;
  }

  if (decision === QuoteStatus.APPROVED) {
    await JobQuote.updateMany(
      { _id: { $ne: updated._id }, bookingId: booking._id, isCurrent: true },
      { $set: { status: QuoteStatus.SUPERSEDED, isCurrent: false, supersededAt: now } }
    );
    booking.paymentStatus = BookingPaymentStatus.PENDING;
    booking.set('workAuthorization.status', WorkAuthorizationStatus.AWAITING_PAYMENT);
    booking.set('workAuthorization.reasonCode', 'PAYMENT_NOT_SECURED');
    booking.set('workAuthorization.evaluatedAt', now);
    await booking.save();
  }

  await recordLedgerEntry({
    idempotencyKey: `quote:${updated.id}:${decision.toLowerCase()}`,
    entryType: decision === QuoteStatus.APPROVED ? ledgerType.QUOTE_APPROVED : ledgerType.QUOTE_REJECTED,
    amountMinor: typeof updated.metadata?.priceBreakdown === 'object' && typeof (updated.metadata.priceBreakdown as any)?.amountDueMinor === 'number'
      ? Math.max(0, Math.round((updated.metadata.priceBreakdown as any).amountDueMinor))
      : updated.totalAmountMinor,
    direction: 'MEMO',
    component: 'MEMO',
    description: decision === QuoteStatus.APPROVED ? 'Repair quote approved' : 'Repair quote rejected',
    ...quoteLedgerContext(booking, updated),
    metadata: {
      quoteNumber: updated.quoteNumber || buildQuoteNumber(updated._id, Number(updated.version || 1)),
      version: updated.version,
      decisionNote: note,
    },
  });

  const event = decision === QuoteStatus.APPROVED ? 'quote_approved' : 'quote_rejected';
  emitQuoteEvent(request, event, updated);

  await createNotifications({
    userId: booking.technicianId!,
    channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
    type: decision === QuoteStatus.APPROVED ? 'QUOTE_APPROVED' : 'QUOTE_REJECTED',
    title: decision === QuoteStatus.APPROVED ? 'Quote approved' : 'Quote rejected',
    message: decision === QuoteStatus.APPROVED
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

  await logAuditEvent(request, {
    action: decision === QuoteStatus.APPROVED ? 'quote.approved' : 'quote.rejected',
    module: 'BOOKINGS',
    resourceType: 'JobQuote',
    resourceId: updated.id,
    metadata: { bookingId: booking.id, version: updated.version },
  });

  response.status(200).json({ success: true, quote: serializeQuote(updated) });
};

export const approveJobQuote = async (request: Request, response: Response): Promise<void> => {
  await decideJobQuote(request, response, QuoteStatus.APPROVED);
};

export const rejectJobQuote = async (request: Request, response: Response): Promise<void> => {
  await decideJobQuote(request, response, QuoteStatus.REJECTED);
};

export const requestQuoteClarification = async (request: Request, response: Response): Promise<void> => {
  const { quoteId } = request.params;
  const userId = getUserId(request);
  const role = normalizeUserRole(getAuthUser(request)?.role);
  const body = request.body as QuoteDecisionBody;
  const message = typeof body.message === 'string' ? body.message.trim() : typeof body.note === 'string' ? body.note.trim() : '';

  if (!message) {
    response.status(400).json({ message: 'Clarification message is required.' });
    return;
  }

  const quote = await JobQuote.findById(quoteId);
  if (!quote) {
    response.status(404).json({ message: 'Quote not found.' });
    return;
  }
  const booking = await Booking.findById(quote.bookingId);
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
  const updated = await JobQuote.findOneAndUpdate(
    { _id: quote._id, status: { $in: [QuoteStatus.SUBMITTED, QuoteStatus.SENT_TO_CLIENT] }, isCurrent: { $ne: false } },
    {
      $set: {
        status: QuoteStatus.CLARIFICATION_REQUESTED,
        clarificationRequestedAt: now,
        clientDecisionNote: message.slice(0, 1000),
        decisionBy: new mongoose.Types.ObjectId(userId),
      },
    },
    { new: true }
  );

  if (!updated) {
    response.status(409).json({ message: 'Quote state changed before clarification could be requested.' });
    return;
  }

  emitQuoteEvent(request, 'quote_clarification_requested', updated);
  await createNotifications({
    userId: booking.technicianId!,
    channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
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
  await logAuditEvent(request, {
    action: 'quote.clarification_requested',
    module: 'BOOKINGS',
    resourceType: 'JobQuote',
    resourceId: updated.id,
    metadata: { bookingId: booking.id, version: updated.version },
  });

  response.status(200).json({ success: true, quote: serializeQuote(updated) });
};
