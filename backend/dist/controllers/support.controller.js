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
exports.updateAdminSupportTicket = exports.createAdminSupportMessage = exports.listAdminSupportTickets = exports.createSupportTicketMessage = exports.getSupportTicketMessages = exports.listMySupportTickets = exports.createSupportTicket = exports.userCanAccessSupportTicket = exports.normalizeSupportTicketStatus = exports.sanitizeTriageMetadata = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const booking_model_1 = __importDefault(require("../models/booking.model"));
const support_message_model_1 = __importStar(require("../models/support-message.model"));
const support_ticket_model_1 = __importStar(require("../models/support-ticket.model"));
const user_model_1 = __importStar(require("../models/user.model"));
const audit_service_1 = require("../services/audit.service");
const audit_log_model_1 = require("../models/audit-log.model");
const notification_service_1 = require("../services/notification.service");
const notification_model_1 = require("../models/notification.model");
const getAuthUser = (req) => req.user;
const getUserId = (req) => String(getAuthUser(req)?.id ?? getAuthUser(req)?._id ?? '').trim();
const trimText = (value) => (typeof value === 'string' ? value.trim() : '');
const normalizeCategory = (value) => {
    const normalized = trimText(value).toUpperCase().replace(/[^A-Z0-9_ -]/g, '').replace(/\s+/g, '_');
    return normalized || 'GENERAL';
};
const sanitizeTriageMetadata = (value) => {
    const input = value && typeof value === 'object' ? value : {};
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
exports.sanitizeTriageMetadata = sanitizeTriageMetadata;
const normalizeSupportTicketStatus = (value) => {
    const normalized = trimText(value).toUpperCase();
    return Object.values(support_ticket_model_1.SupportTicketStatus).includes(normalized)
        ? normalized
        : null;
};
exports.normalizeSupportTicketStatus = normalizeSupportTicketStatus;
const normalizePriority = (value) => {
    const normalized = trimText(value).toUpperCase();
    return Object.values(support_ticket_model_1.SupportTicketPriority).includes(normalized)
        ? normalized
        : support_ticket_model_1.SupportTicketPriority.NORMAL;
};
const parsePriority = (value) => {
    const normalized = trimText(value).toUpperCase();
    return Object.values(support_ticket_model_1.SupportTicketPriority).includes(normalized)
        ? normalized
        : null;
};
const slaHoursByPriority = {
    [support_ticket_model_1.SupportTicketPriority.NORMAL]: 24,
    [support_ticket_model_1.SupportTicketPriority.HIGH]: 4,
    [support_ticket_model_1.SupportTicketPriority.URGENT]: 1,
};
const calculateFirstResponseDueAt = (priority, from = new Date()) => new Date(from.getTime() + slaHoursByPriority[priority] * 60 * 60 * 1000);
const calculateNextResponseDueAt = (from = new Date()) => new Date(from.getTime() + 24 * 60 * 60 * 1000);
const requesterTypeFromRole = (role) => {
    if (role === user_model_1.UserRole.CUSTOMER)
        return support_ticket_model_1.SupportTicketRequesterType.CUSTOMER;
    if (role === user_model_1.UserRole.TECHNICIAN)
        return support_ticket_model_1.SupportTicketRequesterType.TECHNICIAN;
    return null;
};
const userCanAccessSupportTicket = (ticket, userId, role) => role === user_model_1.UserRole.ADMIN || String(ticket.requesterId || '') === userId;
exports.userCanAccessSupportTicket = userCanAccessSupportTicket;
const serializeTicket = (ticket) => ({
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
    escalationStatus: ticket.escalationStatus || support_ticket_model_1.SupportTicketEscalationStatus.NONE,
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
        nextResponseOverdue: Boolean(ticket.nextResponseDueAt && ticket.status !== support_ticket_model_1.SupportTicketStatus.RESOLVED && new Date(ticket.nextResponseDueAt).getTime() < Date.now()),
    },
    lastMessageAt: ticket.lastMessageAt,
    resolvedAt: ticket.resolvedAt,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    requester: ticket.requester || null,
    booking: ticket.booking || null,
    triage: ticket.metadata?.triage || null,
});
const enrichAdminTickets = async (tickets) => {
    if (!tickets.length)
        return [];
    const requesterIds = [...new Set(tickets.map((ticket) => String(ticket.requesterId || '')).filter(Boolean))]
        .filter((id) => mongoose_1.default.Types.ObjectId.isValid(id));
    const bookingIds = [...new Set(tickets.map((ticket) => String(ticket.bookingId || '')).filter(Boolean))]
        .filter((id) => mongoose_1.default.Types.ObjectId.isValid(id));
    const [requesters, bookings] = await Promise.all([
        requesterIds.length
            ? user_model_1.default.find({ _id: { $in: requesterIds } }).select('name email role countryCode location.city').lean()
            : Promise.resolve([]),
        bookingIds.length
            ? booking_model_1.default.find({ _id: { $in: bookingIds } }).select('status applianceType serviceKey countryCode city createdAt').lean()
            : Promise.resolve([]),
    ]);
    const requesterById = new Map(requesters.map((user) => [String(user._id), user]));
    const bookingById = new Map(bookings.map((booking) => [String(booking._id), booking]));
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
const serializeMessage = (message) => ({
    id: message._id?.toString?.() ?? message.id,
    ticketId: message.ticketId?.toString?.() ?? message.ticketId,
    senderId: message.senderId?.toString?.() ?? message.senderId ?? null,
    senderType: message.senderType,
    messageType: message.messageType,
    text: message.text,
    internal: message.internal,
    createdAt: message.createdAt,
});
const buildTicketNumber = (id) => `SUP-PADI-${new Date().getFullYear()}-${id.toString().slice(-6).toUpperCase()}`;
const loadBookingForRequester = async (bookingId, requesterId, role) => {
    if (!bookingId)
        return null;
    if (!mongoose_1.default.Types.ObjectId.isValid(bookingId))
        throw new Error('Invalid booking id.');
    const booking = await booking_model_1.default.findById(bookingId).select('customerId technicianId');
    if (!booking)
        throw new Error('Booking not found.');
    const allowed = role === user_model_1.UserRole.ADMIN ||
        String(booking.customerId) === requesterId ||
        String(booking.technicianId || '') === requesterId;
    if (!allowed)
        throw new Error('This booking cannot be linked to your support ticket.');
    return booking;
};
const assertAdminSupportPermission = async (req, permission) => {
    const role = (0, user_model_1.normalizeUserRole)(getAuthUser(req)?.role);
    const userId = getUserId(req);
    if (role !== user_model_1.UserRole.ADMIN || !mongoose_1.default.Types.ObjectId.isValid(userId))
        return false;
    const admin = await user_model_1.default.findById(userId).select('adminPermissions adminRole role isActive').lean();
    if (!admin || admin.role !== user_model_1.UserRole.ADMIN || admin.isActive === false)
        return false;
    return (admin.adminPermissions || []).includes(permission);
};
const loadAccessibleTicket = async (req, includeInternal = false) => {
    const userId = getUserId(req);
    const role = (0, user_model_1.normalizeUserRole)(getAuthUser(req)?.role);
    const ticketId = String(req.params.ticketId || req.params.id || '').trim();
    if (!mongoose_1.default.Types.ObjectId.isValid(ticketId))
        return null;
    const ticket = await support_ticket_model_1.default.findById(ticketId);
    if (!ticket)
        return null;
    if ((0, exports.userCanAccessSupportTicket)(ticket, userId, role))
        return ticket;
    if (includeInternal && await assertAdminSupportPermission(req, user_model_1.AdminPermission.SUPPORT_READ))
        return ticket;
    return null;
};
const createSupportTicket = async (req, res) => {
    const authUser = getAuthUser(req);
    const requesterId = getUserId(req);
    const role = (0, user_model_1.normalizeUserRole)(authUser?.role);
    const requesterType = requesterTypeFromRole(role);
    if (!requesterType || !mongoose_1.default.Types.ObjectId.isValid(requesterId)) {
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
        const ticketId = new mongoose_1.default.Types.ObjectId();
        const now = new Date();
        const priority = normalizePriority(req.body?.priority);
        const ticket = await support_ticket_model_1.default.create({
            _id: ticketId,
            ticketNumber: buildTicketNumber(ticketId),
            requesterId: new mongoose_1.default.Types.ObjectId(requesterId),
            requesterType,
            requesterRole: role,
            bookingId: booking?._id ?? null,
            subject,
            category: normalizeCategory(req.body?.category),
            status: support_ticket_model_1.SupportTicketStatus.OPEN,
            priority,
            firstResponseDueAt: calculateFirstResponseDueAt(priority, now),
            nextResponseDueAt: null,
            lastMessageAt: now,
            metadata: { triage: (0, exports.sanitizeTriageMetadata)(req.body?.triage) },
        });
        const message = await support_message_model_1.default.create({
            ticketId: ticket._id,
            senderId: new mongoose_1.default.Types.ObjectId(requesterId),
            senderType: requesterType,
            messageType: support_message_model_1.SupportMessageType.TEXT,
            text: messageText,
            internal: false,
            readBy: [{ userId: new mongoose_1.default.Types.ObjectId(requesterId), readAt: now }],
        });
        await (0, audit_service_1.logAuditEvent)(req, {
            action: 'support.ticket.create',
            module: audit_log_model_1.AuditModule.SUPPORT,
            resourceType: 'SupportTicket',
            resourceId: ticket.id,
            metadata: { ticketNumber: ticket.ticketNumber, bookingId: booking?._id?.toString() || null },
        });
        res.status(201).json({ success: true, ticket: serializeTicket(ticket), message: serializeMessage(message) });
    }
    catch (error) {
        res.status(400).json({ message: error.message || 'Unable to create support ticket.' });
    }
};
exports.createSupportTicket = createSupportTicket;
const listMySupportTickets = async (req, res) => {
    const requesterId = getUserId(req);
    const role = (0, user_model_1.normalizeUserRole)(getAuthUser(req)?.role);
    if (!requesterTypeFromRole(role) || !mongoose_1.default.Types.ObjectId.isValid(requesterId)) {
        res.status(403).json({ message: 'Only clients and Padi Pro providers can view this support inbox.' });
        return;
    }
    const tickets = await support_ticket_model_1.default.find({ requesterId: new mongoose_1.default.Types.ObjectId(requesterId) })
        .sort({ updatedAt: -1 })
        .limit(100)
        .lean();
    res.status(200).json({ success: true, tickets: tickets.map(serializeTicket) });
};
exports.listMySupportTickets = listMySupportTickets;
const getSupportTicketMessages = async (req, res) => {
    const role = (0, user_model_1.normalizeUserRole)(getAuthUser(req)?.role);
    const includeInternal = role === user_model_1.UserRole.ADMIN && await assertAdminSupportPermission(req, user_model_1.AdminPermission.SUPPORT_READ);
    const ticket = await loadAccessibleTicket(req, includeInternal);
    if (!ticket) {
        res.status(404).json({ message: 'Support ticket not found or access denied.' });
        return;
    }
    const messages = await support_message_model_1.default.find({
        ticketId: ticket._id,
        ...(includeInternal ? {} : { internal: false }),
    }).sort({ createdAt: 1 }).limit(300).lean();
    res.status(200).json({ success: true, ticket: serializeTicket(ticket), messages: messages.map(serializeMessage) });
};
exports.getSupportTicketMessages = getSupportTicketMessages;
const createSupportTicketMessage = async (req, res) => {
    const requesterId = getUserId(req);
    const role = (0, user_model_1.normalizeUserRole)(getAuthUser(req)?.role);
    const requesterType = requesterTypeFromRole(role);
    if (!requesterType || !mongoose_1.default.Types.ObjectId.isValid(requesterId)) {
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
    const message = await support_message_model_1.default.create({
        ticketId: ticket._id,
        senderId: new mongoose_1.default.Types.ObjectId(requesterId),
        senderType: requesterType,
        messageType: support_message_model_1.SupportMessageType.TEXT,
        text,
        internal: false,
        readBy: [{ userId: new mongoose_1.default.Types.ObjectId(requesterId), readAt: now }],
    });
    ticket.status = support_ticket_model_1.SupportTicketStatus.OPEN;
    ticket.lastMessageAt = now;
    ticket.resolvedAt = null;
    ticket.nextResponseDueAt = calculateNextResponseDueAt(now);
    await ticket.save();
    res.status(201).json({ success: true, ticket: serializeTicket(ticket), message: serializeMessage(message) });
};
exports.createSupportTicketMessage = createSupportTicketMessage;
const listAdminSupportTickets = async (req, res) => {
    const status = (0, exports.normalizeSupportTicketStatus)(req.query.status);
    const filter = status ? { status } : {};
    const tickets = await support_ticket_model_1.default.find(filter).sort({ updatedAt: -1 }).limit(200).lean();
    const enrichedTickets = await enrichAdminTickets(tickets);
    res.status(200).json({ success: true, tickets: enrichedTickets.map(serializeTicket) });
};
exports.listAdminSupportTickets = listAdminSupportTickets;
const createAdminSupportMessage = async (req, res) => {
    const agentId = getUserId(req);
    const ticket = await loadAccessibleTicket(req, true);
    if (!ticket || !mongoose_1.default.Types.ObjectId.isValid(agentId)) {
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
    const message = await support_message_model_1.default.create({
        ticketId: ticket._id,
        senderId: new mongoose_1.default.Types.ObjectId(agentId),
        senderType: support_message_model_1.SupportMessageSenderType.AGENT,
        messageType: support_message_model_1.SupportMessageType.TEXT,
        text,
        internal,
        readBy: [{ userId: new mongoose_1.default.Types.ObjectId(agentId), readAt: now }],
    });
    ticket.assignedAgentId = ticket.assignedAgentId || new mongoose_1.default.Types.ObjectId(agentId);
    ticket.status = internal ? ticket.status : support_ticket_model_1.SupportTicketStatus.PENDING;
    if (wasFirstPublicAgentResponse)
        ticket.firstResponseAt = now;
    if (!internal)
        ticket.nextResponseDueAt = null;
    ticket.lastMessageAt = now;
    await ticket.save();
    await (0, audit_service_1.logAuditEvent)(req, {
        action: internal ? 'support.note.create' : 'support.reply.create',
        module: audit_log_model_1.AuditModule.SUPPORT,
        resourceType: 'SupportTicket',
        resourceId: ticket.id,
        metadata: {
            ticketNumber: ticket.ticketNumber,
            internal,
            firstResponseCaptured: wasFirstPublicAgentResponse,
        },
    });
    if (!internal) {
        await (0, notification_service_1.createNotifications)({
            userId: ticket.requesterId,
            channels: [notification_model_1.NotificationChannel.IN_APP, notification_model_1.NotificationChannel.PUSH],
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
exports.createAdminSupportMessage = createAdminSupportMessage;
const updateAdminSupportTicket = async (req, res) => {
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
        escalationStatus: ticket.escalationStatus || support_ticket_model_1.SupportTicketEscalationStatus.NONE,
        escalationReason: ticket.escalationReason || '',
    };
    const status = req.body?.status !== undefined ? (0, exports.normalizeSupportTicketStatus)(req.body.status) : null;
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
        ticket.resolvedAt = status === support_ticket_model_1.SupportTicketStatus.RESOLVED ? new Date() : null;
        if (status === support_ticket_model_1.SupportTicketStatus.RESOLVED)
            ticket.nextResponseDueAt = null;
    }
    if (priority) {
        ticket.priority = priority;
        if (!ticket.firstResponseAt)
            ticket.firstResponseDueAt = calculateFirstResponseDueAt(priority, ticket.createdAt || new Date());
    }
    const assignedAgentId = trimText(req.body?.assignedAgentId);
    if (assignedAgentId) {
        if (!mongoose_1.default.Types.ObjectId.isValid(assignedAgentId)) {
            res.status(400).json({ message: 'Assigned agent id is invalid.' });
            return;
        }
        ticket.assignedAgentId = new mongoose_1.default.Types.ObjectId(assignedAgentId);
    }
    if (req.body?.escalateToLead === true) {
        if (!mongoose_1.default.Types.ObjectId.isValid(agentId)) {
            res.status(400).json({ message: 'Current support agent id is invalid.' });
            return;
        }
        ticket.escalationStatus = support_ticket_model_1.SupportTicketEscalationStatus.ESCALATED;
        ticket.escalatedAt = new Date();
        ticket.escalatedByAgentId = new mongoose_1.default.Types.ObjectId(agentId);
        ticket.escalationReason = trimText(req.body?.escalationReason).slice(0, 240) || 'Escalated to support lead';
        if (ticket.priority === support_ticket_model_1.SupportTicketPriority.NORMAL) {
            ticket.priority = support_ticket_model_1.SupportTicketPriority.HIGH;
            if (!ticket.firstResponseAt)
                ticket.firstResponseDueAt = calculateFirstResponseDueAt(ticket.priority, ticket.createdAt || new Date());
        }
    }
    await ticket.save();
    await (0, audit_service_1.logAuditEvent)(req, {
        action: req.body?.escalateToLead === true ? 'support.ticket.escalate' : 'support.ticket.update',
        module: audit_log_model_1.AuditModule.SUPPORT,
        resourceType: 'SupportTicket',
        resourceId: ticket.id,
        severity: req.body?.escalateToLead === true || ticket.priority === support_ticket_model_1.SupportTicketPriority.URGENT ? audit_log_model_1.AuditSeverity.WARNING : audit_log_model_1.AuditSeverity.INFO,
        changes: {
            before,
            after: {
                status: ticket.status,
                priority: ticket.priority,
                assignedAgentId: ticket.assignedAgentId?.toString?.() || null,
                escalationStatus: ticket.escalationStatus || support_ticket_model_1.SupportTicketEscalationStatus.NONE,
                escalationReason: ticket.escalationReason || '',
            },
        },
        metadata: { ticketNumber: ticket.ticketNumber },
    });
    res.status(200).json({ success: true, ticket: serializeTicket(ticket) });
};
exports.updateAdminSupportTicket = updateAdminSupportTicket;
//# sourceMappingURL=support.controller.js.map