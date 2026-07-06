import mongoose, { Document, Schema } from 'mongoose';

export enum ServiceWaitlistStatus {
  WAITING = 'WAITING',
  NOTIFIED = 'NOTIFIED',
  CONVERTED = 'CONVERTED',
}

export enum ServiceWaitlistSource {
  CLIENT_APP = 'CLIENT_APP',
  ADMIN_PORTAL = 'ADMIN_PORTAL',
  API = 'API',
}

export interface IServiceWaitlistDocument extends Document {
  customerId?: mongoose.Types.ObjectId;
  email: string;
  phone: string;
  countryCode: string;
  city: string;
  area: string;
  serviceKey: string;
  location?: {
    type: 'Point';
    coordinates: [number, number];
  } | null;
  metadata: Record<string, unknown>;
  status: ServiceWaitlistStatus;
  source: ServiceWaitlistSource;
  createdAt: Date;
  updatedAt: Date;
}

const ServiceWaitlistSchema = new Schema<IServiceWaitlistDocument>(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    countryCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    area: {
      type: String,
      default: '',
      trim: true,
    },
    serviceKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator(value: number[]) {
            return Array.isArray(value) && value.length === 2;
          },
          message: 'Waitlist coordinates must contain [longitude, latitude]',
        },
      },
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: Object.values(ServiceWaitlistStatus),
      default: ServiceWaitlistStatus.WAITING,
    },
    source: {
      type: String,
      enum: Object.values(ServiceWaitlistSource),
      default: ServiceWaitlistSource.CLIENT_APP,
    },
  },
  { timestamps: true }
);

ServiceWaitlistSchema.index(
  { email: 1, countryCode: 1, city: 1, area: 1, serviceKey: 1 },
  { unique: true }
);
ServiceWaitlistSchema.index({ countryCode: 1, city: 1, area: 1, serviceKey: 1, status: 1 });
ServiceWaitlistSchema.index({ customerId: 1 });
ServiceWaitlistSchema.index({ location: '2dsphere' });

const ServiceWaitlist =
  (mongoose.models.ServiceWaitlist as mongoose.Model<IServiceWaitlistDocument> | undefined) ??
  mongoose.model<IServiceWaitlistDocument>('ServiceWaitlist', ServiceWaitlistSchema);

export default ServiceWaitlist;
