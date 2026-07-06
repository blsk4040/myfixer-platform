import mongoose, { Document, Schema } from 'mongoose';

export interface INotificationPreferenceDocument extends Document {
  userId: mongoose.Types.ObjectId;
  channels: {
    inApp: boolean;
    email: boolean;
    push: boolean;
    sms: boolean;
    whatsapp: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const NotificationPreferenceSchema = new Schema<INotificationPreferenceDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    channels: {
      inApp: {
        type: Boolean,
        default: true,
      },
      email: {
        type: Boolean,
        default: true,
      },
      push: {
        type: Boolean,
        default: false,
      },
      sms: {
        type: Boolean,
        default: false,
      },
      whatsapp: {
        type: Boolean,
        default: false,
      },
    },
  },
  { timestamps: true }
);

const NotificationPreference =
  (mongoose.models.NotificationPreference as mongoose.Model<INotificationPreferenceDocument> | undefined) ??
  mongoose.model<INotificationPreferenceDocument>('NotificationPreference', NotificationPreferenceSchema);

export default NotificationPreference;
