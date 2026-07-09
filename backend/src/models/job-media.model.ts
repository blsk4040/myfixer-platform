import mongoose, { Document, Schema } from 'mongoose';

export enum JobMediaPurpose {
  CHAT = 'CHAT',
  BEFORE_WORK = 'BEFORE_WORK',
  AFTER_WORK = 'AFTER_WORK',
  PROOF_OF_COMPLETION = 'PROOF_OF_COMPLETION',
  QUOTE_PART = 'QUOTE_PART',
  DISPUTE = 'DISPUTE',
}

export interface IJobMediaDocument extends Document {
  bookingId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  technicianId?: mongoose.Types.ObjectId | null;
  uploadedByUserId: mongoose.Types.ObjectId;
  uploadedByRole: string;
  mediaType: 'IMAGE';
  purpose: JobMediaPurpose;
  storageProvider: 'cloudinary';
  storageKey: string;
  url: string;
  thumbnailUrl: string;
  mimeType: string;
  fileName: string;
  fileSize: number;
  width?: number;
  height?: number;
  retentionExpiresAt: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const JobMediaSchema = new Schema<IJobMediaDocument>(
  {
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    technicianId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    uploadedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    uploadedByRole: {
      type: String,
      required: true,
      trim: true,
    },
    mediaType: {
      type: String,
      enum: ['IMAGE'],
      default: 'IMAGE',
    },
    purpose: {
      type: String,
      enum: Object.values(JobMediaPurpose),
      default: JobMediaPurpose.CHAT,
      index: true,
    },
    storageProvider: {
      type: String,
      enum: ['cloudinary'],
      default: 'cloudinary',
    },
    storageKey: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    thumbnailUrl: {
      type: String,
      default: '',
      trim: true,
    },
    mimeType: {
      type: String,
      default: 'image/jpeg',
      trim: true,
    },
    fileName: {
      type: String,
      default: '',
      trim: true,
    },
    fileSize: {
      type: Number,
      default: 0,
      min: 0,
    },
    width: {
      type: Number,
      default: 0,
      min: 0,
    },
    height: {
      type: Number,
      default: 0,
      min: 0,
    },
    retentionExpiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

JobMediaSchema.index({ bookingId: 1, purpose: 1, createdAt: -1 });

const JobMedia =
  (mongoose.models.JobMedia as mongoose.Model<IJobMediaDocument> | undefined) ??
  mongoose.model<IJobMediaDocument>('JobMedia', JobMediaSchema);

export default JobMedia;
