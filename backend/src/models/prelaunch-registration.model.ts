import mongoose, { Document, Schema } from 'mongoose';

export enum PreLaunchRegistrationRole {
  CUSTOMER = 'CUSTOMER',
  PROFESSIONAL = 'PROFESSIONAL',
}

export enum PreLaunchRegistrationStatus {
  NEW = 'NEW',
  CONTACTED = 'CONTACTED',
  CONVERTED = 'CONVERTED',
  CLOSED = 'CLOSED',
}

export interface IPreLaunchRegistrationDocument extends Document {
  name: string;
  email: string;
  phone: string;
  city: string;
  role: PreLaunchRegistrationRole;
  source: string;
  status: PreLaunchRegistrationStatus;
  contactedAt?: Date | null;
  convertedAt?: Date | null;
  closedAt?: Date | null;
  notes?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const PreLaunchRegistrationSchema =
  new Schema<IPreLaunchRegistrationDocument>(
    {
      name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
        index: true,
      },

      email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        maxlength: 254,
        index: true,
      },

      phone: {
        type: String,
        required: true,
        trim: true,
        maxlength: 30,
        index: true,
      },

      city: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
        index: true,
      },

      role: {
        type: String,
        enum: Object.values(PreLaunchRegistrationRole),
        required: true,
        index: true,
      },

      source: {
        type: String,
        required: true,
        trim: true,
        default: 'hellopadi-pre-launch',
        index: true,
      },

      status: {
        type: String,
        enum: Object.values(PreLaunchRegistrationStatus),
        default: PreLaunchRegistrationStatus.NEW,
        index: true,
      },

      contactedAt: {
        type: Date,
        default: null,
        index: true,
      },

      convertedAt: {
        type: Date,
        default: null,
        index: true,
      },

      closedAt: {
        type: Date,
        default: null,
      },

      notes: {
        type: String,
        default: '',
        trim: true,
        maxlength: 2000,
      },

      metadata: {
        type: Schema.Types.Mixed,
        default: {},
      },
    },
    { timestamps: true }
  );

PreLaunchRegistrationSchema.index({
  status: 1,
  createdAt: -1,
});

PreLaunchRegistrationSchema.index({
  role: 1,
  status: 1,
  createdAt: -1,
});

PreLaunchRegistrationSchema.index({
  city: 1,
  status: 1,
  createdAt: -1,
});

PreLaunchRegistrationSchema.index({
  email: 1,
  createdAt: -1,
});

// Prevent the same email from registering for the same role more than once.
PreLaunchRegistrationSchema.index(
  {
    email: 1,
    role: 1,
  },
  {
    unique: true,
    name: 'prelaunch_email_role_unique',
  }
);

const PreLaunchRegistration =
  (mongoose.models.PreLaunchRegistration as mongoose.Model<IPreLaunchRegistrationDocument> | undefined) ??
  mongoose.model<IPreLaunchRegistrationDocument>(
    'PreLaunchRegistration',
    PreLaunchRegistrationSchema
  );

export default PreLaunchRegistration;