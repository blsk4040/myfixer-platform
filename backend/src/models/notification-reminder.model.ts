import mongoose, { Document, Schema } from 'mongoose';

export enum ReminderType {
  DAY_BEFORE_COLLECTION = 'DAY_BEFORE_COLLECTION',
  COLLECTION_DAY = 'COLLECTION_DAY',
}

export enum ReminderChannel {
  IN_APP = 'IN_APP',
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  WHATSAPP = 'WHATSAPP',
  PUSH = 'PUSH',
}

export enum ReminderStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export interface INotificationReminderDocument extends Document {
  customerId?: mongoose.Types.ObjectId;
  targetType: string;
  targetId: mongoose.Types.ObjectId;
  reminderType: ReminderType;
  channels: ReminderChannel[];
  status: ReminderStatus;
  scheduledFor: Date;
  payload: Record<string, unknown>;
  cancelledAt?: Date | null;
  sentAt?: Date | null;
  failureReason: string;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationReminderSchema = new Schema<INotificationReminderDocument>(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    targetType: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    reminderType: {
      type: String,
      enum: Object.values(ReminderType),
      required: true,
      index: true,
    },
    channels: {
      type: [String],
      enum: Object.values(ReminderChannel),
      default: [ReminderChannel.IN_APP],
    },
    status: {
      type: String,
      enum: Object.values(ReminderStatus),
      default: ReminderStatus.PENDING,
      index: true,
    },
    scheduledFor: {
      type: Date,
      required: true,
      index: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      default: {},
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    failureReason: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true }
);

NotificationReminderSchema.index({ targetType: 1, targetId: 1, status: 1 });
NotificationReminderSchema.index({ scheduledFor: 1, status: 1 });

const NotificationReminder =
  (mongoose.models.NotificationReminder as mongoose.Model<INotificationReminderDocument> | undefined) ??
  mongoose.model<INotificationReminderDocument>('NotificationReminder', NotificationReminderSchema);

export default NotificationReminder;
