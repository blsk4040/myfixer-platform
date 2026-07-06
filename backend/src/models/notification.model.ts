import mongoose, { Document, Schema } from 'mongoose';

export enum NotificationChannel {
  IN_APP = 'IN_APP',
  EMAIL = 'EMAIL',
  PUSH = 'PUSH',
  SMS = 'SMS',
  WHATSAPP = 'WHATSAPP',
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  SCHEDULED = 'SCHEDULED',
  SENT = 'SENT',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  READ = 'READ',
  ARCHIVED = 'ARCHIVED',
}

export enum NotificationType {
  COLLECTION_REMINDER = 'COLLECTION_REMINDER',
  COLLECTION_TODAY = 'COLLECTION_TODAY',
  COLLECTION_MISSED = 'COLLECTION_MISSED',
  COLLECTION_RESCHEDULED = 'COLLECTION_RESCHEDULED',
  COLLECTION_CANCELLED = 'COLLECTION_CANCELLED',
  SYSTEM = 'SYSTEM',
}

export interface INotificationDocument extends Document {
  recipient: {
    userId?: mongoose.Types.ObjectId;
    email: string;
    phone: string;
    name: string;
  };
  channel: NotificationChannel;
  type: NotificationType | string;
  title: string;
  message: string;
  status: NotificationStatus;
  scheduledAt: Date;
  sentAt?: Date | null;
  readAt?: Date | null;
  archivedAt?: Date | null;
  cancelledAt?: Date | null;
  retryCount: number;
  nextRetryAt?: Date | null;
  lastError: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotificationDocument>(
  {
    recipient: {
      userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        index: true,
      },
      email: {
        type: String,
        default: '',
        trim: true,
        lowercase: true,
      },
      phone: {
        type: String,
        default: '',
        trim: true,
      },
      name: {
        type: String,
        default: '',
        trim: true,
      },
    },
    channel: {
      type: String,
      enum: Object.values(NotificationChannel),
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(NotificationStatus),
      default: NotificationStatus.PENDING,
      index: true,
    },
    scheduledAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    readAt: {
      type: Date,
      default: null,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    retryCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    nextRetryAt: {
      type: Date,
      default: null,
    },
    lastError: {
      type: String,
      default: '',
      trim: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

NotificationSchema.index({ 'recipient.userId': 1, status: 1, createdAt: -1 });
NotificationSchema.index({ status: 1, scheduledAt: 1 });
NotificationSchema.index({ channel: 1, status: 1, scheduledAt: 1 });
NotificationSchema.index({ type: 1, createdAt: -1 });

const Notification =
  (mongoose.models.Notification as mongoose.Model<INotificationDocument> | undefined) ??
  mongoose.model<INotificationDocument>('Notification', NotificationSchema);

export default Notification;
