import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Server as SocketIOServer } from 'socket.io';
import Booking, { BookingStatus } from '../models/booking.model';
import JobQuote, { QuoteLineItemType, QuoteStatus } from '../models/quote.model';
import { normalizeUserRole, UserRole } from '../models/user.model';
import { toMinorUnits } from '../config/market.config';
import { logAuditEvent } from '../services/audit.service';
import { EmailService } from '../services/email/email.service';
import { createNotifications } from '../services/notification.service';
import { NotificationChannel } from '../models/notification.model';

interface QuoteLineItemInput {
  type?: unknown;
  label?: unknown;
  quantity?: unknown;
  unitAmount?: unknown;
  notes?: unknown;
}

interface CreateQuoteRequestBody {
  lineItems?: unknown;
  technicianNotes?: unknown;
}

interface DecideQuoteRequestBody {
  note?: unknown;
}

const getAuthenticatedUser = (request: Request) =>
  (request as any).user as
    | { id?: string; _id?: string; email?: string; role?: string }
    | undefined;

const toFiniteNumber = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const isLineItemType = (value: unknown): value is QuoteLineItemType =>
  typeof value === 'string' && Object.values(QuoteLineItemType).includes(value as QuoteLineItemType);

const serializeQuote = (quote: any) => ({
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

export const createJobQuote = async (request: Request, response: Response): Promise<void> => {
  const { bookingId } = request.params;
  const body = request.body as CreateQuoteRequestBody;
  const authUser = getAuthenticatedUser(request);
  const role = normalizeUserRole(authUser?.role);
  const userId = String(authUser?.id ?? authUser?._id ?? '');

  if (role !== UserRole.TECHNICIAN && role !== UserRole.ADMIN) {
    response.status(403).json({ message: 'Only technician or admin accounts can create quotes.' });
    return;
  }

  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    response.status(400).json({ message: 'Invalid booking id.' });
    return;
  }

  try {
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      response.status(404).json({ message: 'Booking not found.' });
      return;
    }

    if (!booking.technicianId) {
      response.status(409).json({ message: 'A technician must accept the booking before quoting.' });
      return;
    }

    if (role !== UserRole.ADMIN && String(booking.technicianId || '') !== userId) {
      response.status(403).json({ message: 'Only the assigned technician can quote this booking.' });
      return;
    }

    if (!Array.isArray(body.lineItems) || body.lineItems.length === 0) {
      response.status(400).json({ message: 'At least one quote line item is required.' });
      return;
    }

    const lineItems = (body.lineItems as QuoteLineItemInput[]).map((item) => {
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
      const signedTotal = item.type === QuoteLineItemType.DISCOUNT ? -rawTotal : rawTotal;

      return {
        type: item.type,
        label,
        quantity,
        unitAmountMinor: toMinorUnits(unitAmount, booking.currency),
        totalAmountMinor: toMinorUnits(signedTotal, booking.currency),
        notes: typeof item.notes === 'string' ? item.notes.trim() : '',
      };
    });

    const subtotalAmountMinor = lineItems
      .filter((item) => item.type !== QuoteLineItemType.DISCOUNT)
      .reduce((sum, item) => sum + item.totalAmountMinor, 0);
    const discountAmountMinor = Math.abs(
      lineItems
        .filter((item) => item.type === QuoteLineItemType.DISCOUNT)
        .reduce((sum, item) => sum + item.totalAmountMinor, 0)
    );
    const totalAmountMinor = Math.max(subtotalAmountMinor - discountAmountMinor, 0);

    const quote = await JobQuote.create({
      bookingId: booking._id,
      customerId: new mongoose.Types.ObjectId(booking.customerId),
      technicianId: new mongoose.Types.ObjectId(booking.technicianId),
      countryCode: booking.countryCode,
      currency: booking.currency,
      status: QuoteStatus.SENT_TO_CLIENT,
      lineItems,
      subtotalAmountMinor,
      discountAmountMinor,
      totalAmountMinor,
      technicianNotes: typeof body.technicianNotes === 'string' ? body.technicianNotes.trim() : '',
      sentAt: new Date(),
    });

    if (booking.status === BookingStatus.ARRIVED) {
      booking.status = BookingStatus.DIAGNOSTIC_DONE;
      await booking.save();
    }

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

    const io = request.app.get('io') as SocketIOServer | undefined;
    io?.to(`booking:${booking.id}`).emit('quote_sent', {
      ...serializedQuote,
      invoice: invoicePayload,
    });

    const emailSent = await EmailService.sendQuoteEmail({
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
    await createNotifications({
      userId: booking.customerId,
      email: booking.customerEmail,
      name: booking.customerName,
      channels: [NotificationChannel.IN_APP],
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

    response.status(201).json({ success: true, quote: serializedQuote, invoice: invoicePayload, emailSent });
  } catch (error: any) {
    response.status(400).json({ message: error.message || 'Failed to create quote.' });
  }
};

export const getBookingQuotes = async (request: Request, response: Response): Promise<void> => {
  const { bookingId } = request.params;
  const authUser = getAuthenticatedUser(request);
  const role = normalizeUserRole(authUser?.role);
  const userId = String(authUser?.id ?? authUser?._id ?? '');

  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    response.status(400).json({ message: 'Invalid booking id.' });
    return;
  }

  try {
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      response.status(404).json({ message: 'Booking not found.' });
      return;
    }

    const canView =
      role === UserRole.ADMIN ||
      String(booking.customerId) === userId ||
      String(booking.technicianId || '') === userId;

    if (!canView) {
      response.status(403).json({ message: 'This account cannot view quotes for this booking.' });
      return;
    }

    const quotes = await JobQuote.find({ bookingId }).sort({ createdAt: -1 });
    response.status(200).json({ success: true, quotes: quotes.map(serializeQuote) });
  } catch (error) {
    response.status(500).json({ message: 'Failed to fetch quotes.' });
  }
};

export const approveJobQuote = async (request: Request, response: Response): Promise<void> => {
  await decideJobQuote(request, response, QuoteStatus.APPROVED);
};

export const rejectJobQuote = async (request: Request, response: Response): Promise<void> => {
  await decideJobQuote(request, response, QuoteStatus.REJECTED);
};

const decideJobQuote = async (
  request: Request,
  response: Response,
  decision: QuoteStatus.APPROVED | QuoteStatus.REJECTED
): Promise<void> => {
  const { quoteId } = request.params;
  const body = request.body as DecideQuoteRequestBody;
  const authUser = getAuthenticatedUser(request);
  const role = normalizeUserRole(authUser?.role);
  const userId = String(authUser?.id ?? authUser?._id ?? '');

  if (!mongoose.Types.ObjectId.isValid(quoteId)) {
    response.status(400).json({ message: 'Invalid quote id.' });
    return;
  }

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

    if (role !== UserRole.ADMIN && String(booking.customerId || '') !== userId) {
      response.status(403).json({ message: 'Only the client or admin can decide this quote.' });
      return;
    }

    if (quote.status !== QuoteStatus.SENT_TO_CLIENT) {
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
    if (decision === QuoteStatus.APPROVED) quote.approvedAt = new Date();
    if (decision === QuoteStatus.REJECTED) quote.rejectedAt = new Date();
    if (mongoose.Types.ObjectId.isValid(userId)) quote.decisionBy = new mongoose.Types.ObjectId(userId);
    await quote.save();

    if (decision === QuoteStatus.APPROVED) {
      await JobQuote.updateMany(
        {
          bookingId: quote.bookingId,
          _id: { $ne: quote._id },
          status: QuoteStatus.SENT_TO_CLIENT,
        },
        { $set: { status: QuoteStatus.CANCELLED } }
      );
    }

    const io = request.app.get('io') as SocketIOServer | undefined;
    io?.to(`booking:${booking.id}`).emit(
      decision === QuoteStatus.APPROVED ? 'quote_approved' : 'quote_rejected',
      serializeQuote(quote)
    );
    await createNotifications({
      userId: booking.customerId,
      email: booking.customerEmail,
      name: booking.customerName,
      channels: [NotificationChannel.IN_APP],
      type: decision === QuoteStatus.APPROVED ? 'QUOTE_APPROVED' : 'QUOTE_REJECTED',
      title: decision === QuoteStatus.APPROVED ? 'Quote approved' : 'Quote rejected',
      message: decision === QuoteStatus.APPROVED
        ? `You approved the quote for ${booking.applianceType}.`
        : `You rejected the quote for ${booking.applianceType}.`,
      metadata: {
        bookingId: booking.id,
        quoteId: quote.id,
        status: quote.status,
      },
    });

    await logAuditEvent(request, {
      action: decision === QuoteStatus.APPROVED ? 'quote.approve' : 'quote.reject',
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
  } catch (error) {
    response.status(500).json({ message: 'Failed to update quote.' });
  }
};
