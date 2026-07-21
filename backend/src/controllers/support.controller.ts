import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Booking from '../models/booking.model';
import SupportMessage, {
  SupportMessageSenderType,
  SupportMessageType,
} from '../models/support-message.model';
import SupportTicket, {
  SupportTicketEscalationStatus,
  SupportTicketPriority,
  SupportTicketRequesterType,
  SupportTicketStatus,
} from '../models/support-ticket.model';
import User, { AdminPermission, normalizeUserRole, UserRole } from '../models/user.model';
import { logAuditEvent } from '../services/audit.service';
import { AuditModule, AuditSeverity } from '../models/audit-log.model';
import { createNotifications } from '../services/notification.service';
import { NotificationChannel } from '../models/notification.model';

const getAuthUser = (req: Request) =>
  (req as any).user as { id?: string; _id?: string; email?: string; role?: string } | undefined;

const getUserId = (req: Request): string => String(getAuthUser(req)?.id ?? getAuthUser(req)?._id ?? '').trim();

const trimText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const normalizeCategory = (value: unknown): string => {
  const normalized = trimText(value).toUpperCase().replace(/[^A-Z0-9_ -]/g, '').replace(/\s+/g, '_');
  return normalized || 'GENERAL';
};

export const sanitizeTriageMetadata = (value: unknown) => {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const issueType = normalizeCategory(input.issueType);
  const bookingReference = trimText(input.bookingReference).slice(0, 80);
  const handoffReason = trimText(input.handoffReason).slice(0, 160);
  const suggestedFixesViewed = Array.isArray(input.suggestedFixesViewed)
    ? input.suggestedFixesViewed
        .map((item) => trimText(item).slice(0, 180))
        .filter(Boolean)
        .slice(0, 6)
    : [];

  return {
    issueType,
    bookingReference,
    suggestedFixesViewed,
    handoffReason: handoffReason || 'Human support requested',
  };
};

export const normalizeSupportTicketStatus = (value: unknown): SupportTicketStatus | null => {
  const normalized = trimText(value).toUpperCase();
  return Object.values(SupportTicketStatus).includes(normalized as SupportTicketStatus)
    ? normalized as SupportTicketStatus
    : null;
};

const normalizePriority = (value: unknown): SupportTicketPriority => {
  const normalized = trimText(value).toUpperCase();
  return Object.values(SupportTicketPriority).includes(normalized as SupportTicketPriority)
    ? normalized as SupportTicketPriority
    : SupportTicketPriority.NORMAL;
};

const parsePriority = (value: unknown): SupportTicketPriority | null => {
  const normalized = trimText(value).toUpperCase();
  return Object.values(SupportTicketPriority).includes(normalized as SupportTicketPriority)
    ? normalized as SupportTicketPriority
    : null;
};

const slaHoursByPriority: Record<SupportTicketPriority, number> = {
  [SupportTicketPriority.NORMAL]: 24,
  [SupportTicketPriority.HIGH]: 4,
  [SupportTicketPriority.URGENT]: 1,
};

const calculateFirstResponseDueAt = (priority: SupportTicketPriority, from = new Date()): Date =>
  new Date(from.getTime() + slaHoursByPriority[priority] * 60 * 60 * 1000);

const calculateNextResponseDueAt = (from = new Date()): Date =>
  new Date(from.getTime() + 24 * 60 * 60 * 1000);

const requesterTypeFromRole = (role: UserRole): SupportTicketRequesterType | null => {
  if (role === UserRole.CUSTOMER) return SupportTicketRequesterType.CUSTOMER;
  if (role === UserRole.TECHNICIAN) return SupportTicketRequesterType.TECHNICIAN;
  return null;
};

export const userCanAccessSupportTicket = (
  ticket: { requesterId?: unknown },
  userId: string,
  role: UserRole
): boolean => role === UserRole.ADMIN || String(ticket.requesterId || '') === userId;

const serializeTicket = (ticket: any) => ({
  id: ticket._id?.toString?.() ?? ticket.id,
  ticketNumber: ticket.ticketNumber,
  requesterId: ticket.requesterId?.toString?.() ?? ticket.requesterId,
  requesterType: ticket.requesterType,
  bookingId: ticket.bookingId?.toString?.() ?? ticket.bookingId ?? null,
  subject: ticket.subject,
  category: ticket.category,
  status: ticket.status,
  priority: ticket.priority,
  assignedAgentId: ticket.assignedAgentId?.toString?.() ?? ticket.assignedAgentId ?? null,
  escalationStatus: ticket.escalationStatus || SupportTicketEscalationStatus.NONE,
  escalatedAt: ticket.escalatedAt || null,
  escalatedByAgentId: ticket.escalatedByAgentId?.toString?.() ?? ticket.escalatedByAgentId ?? null,
  escalationReason: ticket.escalationReason || '',
  firstResponseDueAt: ticket.firstResponseDueAt || null,
  firstResponseAt: ticket.firstResponseAt || null,
  nextResponseDueAt: ticket.nextResponseDueAt || null,
  sla: {
    firstResponseDueAt: ticket.firstResponseDueAt || null,
    firstResponseAt: ticket.firstResponseAt || null,
    nextResponseDueAt: ticket.nextResponseDueAt || null,
    firstResponseOverdue: Boolean(!ticket.firstResponseAt && ticket.firstResponseDueAt && new Date(ticket.firstResponseDueAt).getTime() < Date.now()),
    nextResponseOverdue: Boolean(ticket.nextResponseDueAt && ticket.status !== SupportTicketStatus.RESOLVED && new Date(ticket.nextResponseDueAt).getTime() < Date.now()),
  },
  lastMessageAt: ticket.lastMessageAt,
  resolvedAt: ticket.resolvedAt,
  createdAt: ticket.createdAt,
  updatedAt: ticket.updatedAt,
  requester: ticket.requester || null,
  booking: ticket.booking || null,
  triage: ticket.metadata?.triage || null,
});

const enrichAdminTickets = async (tickets: any[]) => {
  if (!tickets.length) return [];
  const requesterIds = [...new Set(tickets.map((ticket) => String(ticket.requesterId || '')).filter(Boolean))]
    .filter((id) => mongoose.Types.ObjectId.isValid(id));
  const bookingIds = [...new Set(tickets.map((ticket) => String(ticket.bookingId || '')).filter(Boolean))]
    .filter((id) => mongoose.Types.ObjectId.isValid(id));

  const [requesters, bookings] = await Promise.all([
    requesterIds.length
      ? User.find({ _id: { $in: requesterIds } }).select('name email role countryCode location.city').lean()
      : Promise.resolve([]),
    bookingIds.length
      ? Booking.find({ _id: { $in: bookingIds } }).select('status applianceType serviceKey countryCode city createdAt').lean()
      : Promise.resolve([]),
  ]);

  const requesterById = new Map(requesters.map((user: any) => [String(user._id), user]));
  const bookingById = new Map(bookings.map((booking: any) => [String(booking._id), booking]));

  return tickets.map((ticket) => {
    const requester = requesterById.get(String(ticket.requesterId || ''));
    const booking = bookingById.get(String(ticket.bookingId || ''));
    return {
      ...ticket,
      requester: requester ? {
        name: requester.name || '',
        email: requester.email || '',
        role: requester.role || ticket.requesterRole || '',
        countryCode: requester.countryCode || '',
        city: requester.location?.city || '',
      } : null,
      booking: booking ? {
        id: booking._id?.toString?.() || '',
        status: booking.status || '',
        service: booking.applianceType || booking.serviceKey || '',
        countryCode: booking.countryCode || '',
        city: booking.city || '',
        createdAt: booking.createdAt,
      } : null,
    };
  });
};

const serializeMessage = (message: any) => ({
  id: message._id?.toString?.() ?? message.id,
  ticketId: message.ticketId?.toString?.() ?? message.ticketId,
  senderId: message.senderId?.toString?.() ?? message.senderId ?? null,
  senderType: message.senderType,
  messageType: message.messageType,
  text: message.text,
  internal: message.internal,
  createdAt: message.createdAt,
});

const buildTicketNumber = (id: mongoose.Types.ObjectId): string =>
  `SUP-PADI-${new Date().getFullYear()}-${id.toString().slice(-6).toUpperCase()}`;

const loadBookingForRequester = async (bookingId: string, requesterId: string, role: UserRole) => {
  if (!bookingId) return null;
  if (!mongoose.Types.ObjectId.isValid(bookingId)) throw new Error('Invalid booking id.');
  const booking = await Booking.findById(bookingId).select('customerId technicianId');
  if (!booking) throw new Error('Booking not found.');
  const allowed =
    role === UserRole.ADMIN ||
    String(booking.customerId) === requesterId ||
    String(booking.technicianId || '') === requesterId;
  if (!allowed) throw new Error('This booking cannot be linked to your support ticket.');
  return booking;
};

const assertAdminSupportPermission = async (req: Request, permission: AdminPermission): Promise<boolean> => {
  const role = normalizeUserRole(getAuthUser(req)?.role);
  const userId = getUserId(req);
  if (role !== UserRole.ADMIN || !mongoose.Types.ObjectId.isValid(userId)) return false;
  const admin = await User.findById(userId).select('adminPermissions adminRole role isActive').lean();
  if (!admin || admin.role !== UserRole.ADMIN || admin.isActive === false) return false;
  return (admin.adminPermissions || []).includes(permission);
};

const loadAccessibleTicket = async (req: Request, includeInternal = false) => {
  const userId = getUserId(req);
  const role = normalizeUserRole(getAuthUser(req)?.role);
  const ticketId = String(req.params.ticketId || req.params.id || '').trim();
  if (!mongoose.Types.ObjectId.isValid(ticketId)) return null;
  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) return null;
  if (userCanAccessSupportTicket(ticket, userId, role)) return ticket;
  if (includeInternal && await assertAdminSupportPermission(req, AdminPermission.SUPPORT_READ)) return ticket;
  return null;
};

export const createSupportTicket = async (req: Request, res: Response): Promise<void> => {
  const authUser = getAuthUser(req);
  const requesterId = getUserId(req);
  const role = normalizeUserRole(authUser?.role);
  const requesterType = requesterTypeFromRole(role);
  if (!requesterType || !mongoose.Types.ObjectId.isValid(requesterId)) {
    res.status(403).json({ message: 'Only clients and Padi Pro providers can create support tickets.' });
    return;
  }

  const subject = trimText(req.body?.subject);
  const messageText = trimText(req.body?.message || req.body?.text);
  if (!subject) {
    res.status(400).json({ message: 'Support ticket subject is required.' });
    return;
  }
  if (!messageText) {
    res.status(400).json({ message: 'Support message is required.' });
    return;
  }

  try {
    const bookingId = trimText(req.body?.bookingId);
    const booking = await loadBookingForRequester(bookingId, requesterId, role);
    const ticketId = new mongoose.Types.ObjectId();
    const now = new Date();
    const priority = normalizePriority(req.body?.priority);
    const ticket = await SupportTicket.create({
      _id: ticketId,
      ticketNumber: buildTicketNumber(ticketId),
      requesterId: new mongoose.Types.ObjectId(requesterId),
      requesterType,
      requesterRole: role,
      bookingId: booking?._id ?? null,
      subject,
      category: normalizeCategory(req.body?.category),
      status: SupportTicketStatus.OPEN,
      priority,
      firstResponseDueAt: calculateFirstResponseDueAt(priority, now),
      nextResponseDueAt: null,
      lastMessageAt: now,
      metadata: { triage: sanitizeTriageMetadata(req.body?.triage) },
    });
    const message = await SupportMessage.create({
      ticketId: ticket._id,
      senderId: new mongoose.Types.ObjectId(requesterId),
      senderType: requesterType,
      messageType: SupportMessageType.TEXT,
      text: messageText,
      internal: false,
      readBy: [{ userId: new mongoose.Types.ObjectId(requesterId), readAt: now }],
    });

    await logAuditEvent(req, {
      action: 'support.ticket.create',
      module: AuditModule.SUPPORT,
      resourceType: 'SupportTicket',
      resourceId: ticket.id,
      metadata: { ticketNumber: ticket.ticketNumber, bookingId: booking?._id?.toString() || null },
    });

    res.status(201).json({ success: true, ticket: serializeTicket(ticket), message: serializeMessage(message) });
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Unable to create support ticket.' });
  }
};

export const listMySupportTickets = async (req: Request, res: Response): Promise<void> => {
  const requesterId = getUserId(req);
  const role = normalizeUserRole(getAuthUser(req)?.role);
  if (!requesterTypeFromRole(role) || !mongoose.Types.ObjectId.isValid(requesterId)) {
    res.status(403).json({ message: 'Only clients and Padi Pro providers can view this support inbox.' });
    return;
  }

  const tickets = await SupportTicket.find({ requesterId: new mongoose.Types.ObjectId(requesterId) })
    .sort({ updatedAt: -1 })
    .limit(100)
    .lean();
  res.status(200).json({ success: true, tickets: tickets.map(serializeTicket) });
};

export const getSupportTicketMessages = async (req: Request, res: Response): Promise<void> => {
  const role = normalizeUserRole(getAuthUser(req)?.role);
  const includeInternal = role === UserRole.ADMIN && await assertAdminSupportPermission(req, AdminPermission.SUPPORT_READ);
  const ticket = await loadAccessibleTicket(req, includeInternal);
  if (!ticket) {
    res.status(404).json({ message: 'Support ticket not found or access denied.' });
    return;
  }
  const messages = await SupportMessage.find({
    ticketId: ticket._id,
    ...(includeInternal ? {} : { internal: false }),
  }).sort({ createdAt: 1 }).limit(300).lean();
  res.status(200).json({ success: true, ticket: serializeTicket(ticket), messages: messages.map(serializeMessage) });
};

export const createSupportTicketMessage = async (req: Request, res: Response): Promise<void> => {
  const requesterId = getUserId(req);
  const role = normalizeUserRole(getAuthUser(req)?.role);
  const requesterType = requesterTypeFromRole(role);
  if (!requesterType || !mongoose.Types.ObjectId.isValid(requesterId)) {
    res.status(403).json({ message: 'Only clients and Padi Pro providers can reply to this support ticket.' });
    return;
  }
  const ticket = await loadAccessibleTicket(req, false);
  if (!ticket) {
    res.status(404).json({ message: 'Support ticket not found or access denied.' });
    return;
  }
  const text = trimText(req.body?.message || req.body?.text);
  if (!text) {
    res.status(400).json({ message: 'Support message is required.' });
    return;
  }

  const now = new Date();
  const message = await SupportMessage.create({
    ticketId: ticket._id,
    senderId: new mongoose.Types.ObjectId(requesterId),
    senderType: requesterType,
    messageType: SupportMessageType.TEXT,
    text,
    internal: false,
    readBy: [{ userId: new mongoose.Types.ObjectId(requesterId), readAt: now }],
  });
  ticket.status = SupportTicketStatus.OPEN;
  ticket.lastMessageAt = now;
  ticket.resolvedAt = null;
  ticket.nextResponseDueAt = calculateNextResponseDueAt(now);
  await ticket.save();
  res.status(201).json({ success: true, ticket: serializeTicket(ticket), message: serializeMessage(message) });
};

export const listAdminSupportTickets = async (req: Request, res: Response): Promise<void> => {
  const status = normalizeSupportTicketStatus(req.query.status);
  const filter = status ? { status } : {};
  const tickets = await SupportTicket.find(filter).sort({ updatedAt: -1 }).limit(200).lean();
  const enrichedTickets = await enrichAdminTickets(tickets);
  res.status(200).json({ success: true, tickets: enrichedTickets.map(serializeTicket) });
};

export const createAdminSupportMessage = async (req: Request, res: Response): Promise<void> => {
  const agentId = getUserId(req);
  const ticket = await loadAccessibleTicket(req, true);
  if (!ticket || !mongoose.Types.ObjectId.isValid(agentId)) {
    res.status(404).json({ message: 'Support ticket not found or access denied.' });
    return;
  }
  const text = trimText(req.body?.message || req.body?.text);
  if (!text) {
    res.status(400).json({ message: 'Support message is required.' });
    return;
  }
  const internal = req.body?.internal === true;
  const now = new Date();
  const wasFirstPublicAgentResponse = !internal && !ticket.firstResponseAt;
  const message = await SupportMessage.create({
    ticketId: ticket._id,
    senderId: new mongoose.Types.ObjectId(agentId),
    senderType: SupportMessageSenderType.AGENT,
    messageType: SupportMessageType.TEXT,
    text,
    internal,
    readBy: [{ userId: new mongoose.Types.ObjectId(agentId), readAt: now }],
  });
  ticket.assignedAgentId = ticket.assignedAgentId || new mongoose.Types.ObjectId(agentId);
  ticket.status = internal ? ticket.status : SupportTicketStatus.PENDING;
  if (wasFirstPublicAgentResponse) ticket.firstResponseAt = now;
  if (!internal) ticket.nextResponseDueAt = null;
  ticket.lastMessageAt = now;
  await ticket.save();
  await logAuditEvent(req, {
    action: internal ? 'support.note.create' : 'support.reply.create',
    module: AuditModule.SUPPORT,
    resourceType: 'SupportTicket',
    resourceId: ticket.id,
    metadata: {
      ticketNumber: ticket.ticketNumber,
      internal,
      firstResponseCaptured: wasFirstPublicAgentResponse,
    },
  });
  if (!internal) {
    await createNotifications({
      userId: ticket.requesterId,
      channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
      type: 'SUPPORT_REPLY',
      title: 'Padi Support replied',
      message: text.slice(0, 140),
      metadata: {
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
      },
    });
  }
  res.status(201).json({ success: true, ticket: serializeTicket(ticket), message: serializeMessage(message) });
};

export const updateAdminSupportTicket = async (req: Request, res: Response): Promise<void> => {
  const agentId = getUserId(req);
  const ticket = await loadAccessibleTicket(req, true);
  if (!ticket) {
    res.status(404).json({ message: 'Support ticket not found or access denied.' });
    return;
  }
  const before = {
    status: ticket.status,
    priority: ticket.priority,
    assignedAgentId: ticket.assignedAgentId?.toString?.() || null,
    escalationStatus: ticket.escalationStatus || SupportTicketEscalationStatus.NONE,
    escalationReason: ticket.escalationReason || '',
  };
  const status = req.body?.status !== undefined ? normalizeSupportTicketStatus(req.body.status) : null;
  if (req.body?.status !== undefined && !status) {
    res.status(400).json({ message: 'Status must be OPEN, PENDING or RESOLVED.' });
    return;
  }
  const priority = req.body?.priority !== undefined ? parsePriority(req.body.priority) : null;
  if (req.body?.priority !== undefined && !priority) {
    res.status(400).json({ message: 'Priority must be NORMAL, HIGH or URGENT.' });
    return;
  }
  if (status) {
    ticket.status = status;
    ticket.resolvedAt = status === SupportTicketStatus.RESOLVED ? new Date() : null;
    if (status === SupportTicketStatus.RESOLVED) ticket.nextResponseDueAt = null;
  }
  if (priority) {
    ticket.priority = priority;
    if (!ticket.firstResponseAt) ticket.firstResponseDueAt = calculateFirstResponseDueAt(priority, ticket.createdAt || new Date());
  }
  const assignedAgentId = trimText(req.body?.assignedAgentId);
  if (assignedAgentId) {
    if (!mongoose.Types.ObjectId.isValid(assignedAgentId)) {
      res.status(400).json({ message: 'Assigned agent id is invalid.' });
      return;
    }
    ticket.assignedAgentId = new mongoose.Types.ObjectId(assignedAgentId);
  }
  if (req.body?.escalateToLead === true) {
    if (!mongoose.Types.ObjectId.isValid(agentId)) {
      res.status(400).json({ message: 'Current support agent id is invalid.' });
      return;
    }
    ticket.escalationStatus = SupportTicketEscalationStatus.ESCALATED;
    ticket.escalatedAt = new Date();
    ticket.escalatedByAgentId = new mongoose.Types.ObjectId(agentId);
    ticket.escalationReason = trimText(req.body?.escalationReason).slice(0, 240) || 'Escalated to support lead';
    if (ticket.priority === SupportTicketPriority.NORMAL) {
      ticket.priority = SupportTicketPriority.HIGH;
      if (!ticket.firstResponseAt) ticket.firstResponseDueAt = calculateFirstResponseDueAt(ticket.priority, ticket.createdAt || new Date());
    }
  }
  await ticket.save();
  await logAuditEvent(req, {
    action: req.body?.escalateToLead === true ? 'support.ticket.escalate' : 'support.ticket.update',
    module: AuditModule.SUPPORT,
    resourceType: 'SupportTicket',
    resourceId: ticket.id,
    severity: req.body?.escalateToLead === true || ticket.priority === SupportTicketPriority.URGENT ? AuditSeverity.WARNING : AuditSeverity.INFO,
    changes: {
      before,
      after: {
        status: ticket.status,
        priority: ticket.priority,
        assignedAgentId: ticket.assignedAgentId?.toString?.() || null,
        escalationStatus: ticket.escalationStatus || SupportTicketEscalationStatus.NONE,
        escalationReason: ticket.escalationReason || '',
      },
    },
    metadata: { ticketNumber: ticket.ticketNumber },
  });
  res.status(200).json({ success: true, ticket: serializeTicket(ticket) });
};
