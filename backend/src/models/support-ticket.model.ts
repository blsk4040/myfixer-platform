import mongoose, { Document, Schema } from 'mongoose';
import { UserRole } from './user.model';

export enum SupportTicketStatus {
  OPEN = 'OPEN',
  PENDING = 'PENDING',
  RESOLVED = 'RESOLVED',
}

export enum SupportTicketRequesterType {
  CUSTOMER = 'CUSTOMER',
  TECHNICIAN = 'TECHNICIAN',
}

export enum SupportTicketPriority {
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum SupportTicketEscalationStatus {
  NONE = 'NONE',
  ESCALATED = 'ESCALATED',
}

export interface ISupportTicketDocument extends Document {
  ticketNumber: string;
  requesterId: mongoose.Types.ObjectId;
  requesterType: SupportTicketRequesterType;
  requesterRole: UserRole;
  bookingId?: mongoose.Types.ObjectId | null;
  subject: string;
  category: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  assignedAgentId?: mongoose.Types.ObjectId | null;
  escalationStatus: SupportTicketEscalationStatus;
  escalatedAt?: Date | null;
  escalatedByAgentId?: mongoose.Types.ObjectId | null;
  escalationReason?: string;
  firstResponseDueAt?: Date | null;
  firstResponseAt?: Date | null;
  nextResponseDueAt?: Date | null;
  lastMessageAt?: Date | null;
  resolvedAt?: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const SupportTicketSchema = new Schema<ISupportTicketDocument>(
  {
    ticketNumber: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    requesterId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    requesterType: {
      type: String,
      enum: Object.values(SupportTicketRequesterType),
      required: true,
      index: true,
    },
    requesterRole: {
      type: String,
      enum: [UserRole.CUSTOMER, UserRole.TECHNICIAN],
      required: true,
      index: true,
    },
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
      index: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    category: {
      type: String,
      default: 'GENERAL',
      trim: true,
      uppercase: true,
      maxlength: 60,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(SupportTicketStatus),
      default: SupportTicketStatus.OPEN,
      index: true,
    },
    priority: {
      type: String,
      enum: Object.values(SupportTicketPriority),
      default: SupportTicketPriority.NORMAL,
      index: true,
    },
    assignedAgentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    escalationStatus: {
      type: String,
      enum: Object.values(SupportTicketEscalationStatus),
      default: SupportTicketEscalationStatus.NONE,
      index: true,
    },
    escalatedAt: {
      type: Date,
      default: null,
      index: true,
    },
    escalatedByAgentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    escalationReason: {
      type: String,
      default: '',
      trim: true,
      maxlength: 240,
    },
    firstResponseDueAt: {
      type: Date,
      default: null,
      index: true,
    },
    firstResponseAt: {
      type: Date,
      default: null,
      index: true,
    },
    nextResponseDueAt: {
      type: Date,
      default: null,
      index: true,
    },
    lastMessageAt: {
      type: Date,
      default: null,
      index: true,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

SupportTicketSchema.index({ requesterId: 1, status: 1, updatedAt: -1 });
SupportTicketSchema.index({ status: 1, priority: 1, updatedAt: -1 });
SupportTicketSchema.index({ assignedAgentId: 1, status: 1, updatedAt: -1 });
SupportTicketSchema.index({ escalationStatus: 1, priority: 1, updatedAt: -1 });
SupportTicketSchema.index({ firstResponseDueAt: 1, status: 1 });

const SupportTicket =
  (mongoose.models.SupportTicket as mongoose.Model<ISupportTicketDocument> | undefined) ??
  mongoose.model<ISupportTicketDocument>('SupportTicket', SupportTicketSchema);

export default SupportTicket;
