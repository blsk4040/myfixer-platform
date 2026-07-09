import mongoose, { Document, Schema } from 'mongoose';

export interface IPushTokenDocument extends Document {
  userId: mongoose.Types.ObjectId;
  token: string;
  platform: 'ios' | 'android' | 'web' | 'unknown';
  app: 'client' | 'technician' | 'admin' | 'unknown';
  deviceId: string;
  isActive: boolean;
  lastRegisteredAt: Date;
  disabledAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const PushTokenSchema = new Schema<IPushTokenDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    platform: {
      type: String,
      enum: ['ios', 'android', 'web', 'unknown'],
      default: 'unknown',
    },
    app: {
      type: String,
      enum: ['client', 'technician', 'admin', 'unknown'],
      default: 'unknown',
    },
    deviceId: {
      type: String,
      default: '',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastRegisteredAt: {
      type: Date,
      default: Date.now,
    },
    disabledAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

PushTokenSchema.index({ userId: 1, app: 1, isActive: 1 });
PushTokenSchema.index({ userId: 1, deviceId: 1 });

const PushToken =
  (mongoose.models.PushToken as mongoose.Model<IPushTokenDocument> | undefined) ??
  mongoose.model<IPushTokenDocument>('PushToken', PushTokenSchema);

export default PushToken;
