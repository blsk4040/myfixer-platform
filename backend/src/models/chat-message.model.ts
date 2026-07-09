import mongoose, { Document, Schema } from 'mongoose';

export enum ChatMessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  SYSTEM = 'SYSTEM',
}

export interface IChatMessageDocument extends Document {
  bookingId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  senderRole: 'CUSTOMER' | 'TECHNICIAN' | 'ADMIN' | 'SYSTEM';
  messageType: ChatMessageType;
  text: string;
  mediaIds: mongoose.Types.ObjectId[];
  readBy: Array<{
    userId: mongoose.Types.ObjectId;
    readAt: Date;
  }>;
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

const ChatMessageSchema = new Schema<IChatMessageDocument>(
  {
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    senderRole: {
      type: String,
      enum: ['CUSTOMER', 'TECHNICIAN', 'ADMIN', 'SYSTEM'],
      required: true,
      index: true,
    },
    messageType: {
      type: String,
      enum: Object.values(ChatMessageType),
      default: ChatMessageType.TEXT,
      index: true,
    },
    text: {
      type: String,
      default: '',
      trim: true,
      maxlength: 2000,
    },
    mediaIds: {
      type: [Schema.Types.ObjectId],
      ref: 'JobMedia',
      default: [],
    },
    readBy: {
      type: [ReadReceiptSchema],
      default: [],
    },
  },
  { timestamps: true }
);

ChatMessageSchema.index({ bookingId: 1, createdAt: 1 });
ChatMessageSchema.index({ bookingId: 1, senderId: 1, createdAt: -1 });

const ChatMessage =
  (mongoose.models.ChatMessage as mongoose.Model<IChatMessageDocument> | undefined) ??
  mongoose.model<IChatMessageDocument>('ChatMessage', ChatMessageSchema);

export default ChatMessage;
