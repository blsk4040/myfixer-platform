import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import SupportMessage, {
  SupportMessageSenderType,
  SupportMessageType,
} from '../src/models/support-message.model';
import SupportTicket, {
  SupportTicketPriority,
  SupportTicketRequesterType,
  SupportTicketStatus,
} from '../src/models/support-ticket.model';
import {
  normalizeSupportTicketStatus,
  sanitizeTriageMetadata,
  userCanAccessSupportTicket,
} from '../src/controllers/support.controller';
import { UserRole } from '../src/models/user.model';

const ids = {
  customer: new mongoose.Types.ObjectId('507f1f77bcf86cd799439201'),
  technician: new mongoose.Types.ObjectId('507f1f77bcf86cd799439202'),
  booking: new mongoose.Types.ObjectId('507f1f77bcf86cd799439203'),
  ticket: new mongoose.Types.ObjectId('507f1f77bcf86cd799439204'),
};

const run = (): void => {
  const ticket = new SupportTicket({
    ticketNumber: 'SUP-PADI-2026-39204',
    requesterId: ids.customer,
    requesterType: SupportTicketRequesterType.CUSTOMER,
    requesterRole: UserRole.CUSTOMER,
    bookingId: ids.booking,
    subject: 'Payment help',
    category: 'PAYMENT',
    metadata: {
      triage: {
        issueType: 'PAYMENT',
        bookingReference: 'INV-100',
        suggestedFixesViewed: ['Check Inbox for invoices.'],
        handoffReason: 'Customer requested human support after bot triage',
      },
    },
  });

  assert.equal(ticket.validateSync(), undefined);
  assert.equal(ticket.status, SupportTicketStatus.OPEN);
  assert.equal(ticket.priority, SupportTicketPriority.NORMAL);
  assert.equal(ticket.metadata?.triage?.issueType, 'PAYMENT');
  assert.equal(ticket.metadata?.triage?.bookingReference, 'INV-100');

  const message = new SupportMessage({
    ticketId: ids.ticket,
    senderId: ids.customer,
    senderType: SupportMessageSenderType.CUSTOMER,
    messageType: SupportMessageType.TEXT,
    text: 'I need help with my receipt.',
  });

  assert.equal(message.validateSync(), undefined);
  assert.equal(message.internal, false);

  const blankMessage = new SupportMessage({
    ticketId: ids.ticket,
    senderId: ids.customer,
    senderType: SupportMessageSenderType.CUSTOMER,
    text: '',
  });
  assert.ok(blankMessage.validateSync(), 'blank support messages should be rejected');

  assert.equal(normalizeSupportTicketStatus('open'), SupportTicketStatus.OPEN);
  assert.equal(normalizeSupportTicketStatus('Pending'), SupportTicketStatus.PENDING);
  assert.equal(normalizeSupportTicketStatus('resolved'), SupportTicketStatus.RESOLVED);
  assert.equal(normalizeSupportTicketStatus('closed'), null);

  const triage = sanitizeTriageMetadata({
    issueType: 'payment issue',
    bookingReference: '  INV-200  ',
    suggestedFixesViewed: [' Check Inbox ', '', 'Try payment again'],
    handoffReason: '  needs agent  ',
  });
  assert.deepEqual(triage, {
    issueType: 'PAYMENT_ISSUE',
    bookingReference: 'INV-200',
    suggestedFixesViewed: ['Check Inbox', 'Try payment again'],
    handoffReason: 'needs agent',
  });

  assert.equal(userCanAccessSupportTicket({ requesterId: ids.customer }, ids.customer.toString(), UserRole.CUSTOMER), true);
  assert.equal(userCanAccessSupportTicket({ requesterId: ids.customer }, ids.technician.toString(), UserRole.TECHNICIAN), false);
  assert.equal(userCanAccessSupportTicket({ requesterId: ids.customer }, ids.technician.toString(), UserRole.ADMIN), true);

  console.log('Support foundation tests passed.');
};

run();
