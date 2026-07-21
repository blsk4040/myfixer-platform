import mongoose, { Document, Schema } from 'mongoose';

export enum SupportMessageSenderType {
  CUSTOMER = 'CUSTOMER',
  TECHNICIAN = 'TECHNICIAN',
  AGENT = 'AGENT',
  SYSTEM = 'SYSTEM',
}

export enum SupportMessageType {
  TEXT = 'TEXT',
  SYSTEM = 'SYSTEM',
}

export interface ISupportMessageDocument extends Document {
  ticketId: mongoose.Types.ObjectId;
  senderId?: mongoose.Types.ObjectId | null;
  senderType: SupportMessageSenderType;
  messageType: SupportMessageType;
  text: string;
  internal: boolean;
  readBy: Array<{
    userId: mongoose.Types.ObjectId;
    readAt: Date;
  }>;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const ReadReceiptSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    readAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const SupportMessageSchema = new Schema<ISupportMessageDocument>(
  {
    ticketId: {
      type: Schema.Types.ObjectId,
      ref: 'SupportTicket',
      required: true,
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    senderType: {
      type: String,
      enum: Object.values(SupportMessageSenderType),
      required: true,
      index: true,
    },
    messageType: {
      type: String,
      enum: Object.values(SupportMessageType),
      default: SupportMessageType.TEXT,
      index: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000,
    },
    internal: {
      type: Boolean,
      default: false,
      index: true,
    },
    readBy: {
      type: [ReadReceiptSchema],
      default: [],
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

SupportMessageSchema.index({ ticketId: 1, createdAt: 1 });
SupportMessageSchema.index({ ticketId: 1, internal: 1, createdAt: 1 });

const SupportMessage =
  (mongoose.models.SupportMessage as mongoose.Model<ISupportMessageDocument> | undefined) ??
  mongoose.model<ISupportMessageDocument>('SupportMessage', SupportMessageSchema);

export default SupportMessage;
