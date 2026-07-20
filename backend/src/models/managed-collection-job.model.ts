import mongoose, { Document, Schema } from 'mongoose';
import {
  ManagedCollectionBinColor,
  ManagedCollectionFrequency,
  ManagedCollectionType,
} from './managed-collection.model';
import { CountryCode } from '../config/market.config';

export enum ManagedCollectionJobStatus {
  SCHEDULED = 'SCHEDULED',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  MISSED = 'MISSED',
  CANCELLED = 'CANCELLED',
}

export interface IManagedCollectionHistoryEntry {
  collectionDate: Date;
  completedBy?: mongoose.Types.ObjectId;
  notes: string;
  photos: string[];
  missedReason: string;
  status: ManagedCollectionJobStatus;
  createdAt: Date;
}

export interface IManagedCollectionJobDocument extends Document {
  profileId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  customerName: string;
  customerEmail: string;
  countryCode: string;
  city: string;
  area: string;
  fullAddress: string;
  collectionType: ManagedCollectionType;
  binPackage: ManagedCollectionBinColor[];
  frequency: ManagedCollectionFrequency;
  preferredCollectionDay: string;
  scheduledFor: Date;
  completedAt?: Date | null;
  assignedTo?: mongoose.Types.ObjectId | null;
  status: ManagedCollectionJobStatus;
  notes: string;
  missedReason: string;
  photos: string[];
  history: IManagedCollectionHistoryEntry[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const CollectionHistorySchema = new Schema<IManagedCollectionHistoryEntry>(
  {
    collectionDate: {
      type: Date,
      required: true,
    },
    completedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    photos: {
      type: [String],
      default: [],
    },
    missedReason: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(ManagedCollectionJobStatus),
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const ManagedCollectionJobSchema = new Schema<IManagedCollectionJobDocument>(
  {
    profileId: {
      type: Schema.Types.ObjectId,
      ref: 'ManagedCollectionProfile',
      required: true,
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    customerName: {
      type: String,
      default: 'Client',
      trim: true,
    },
    customerEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    countryCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    area: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    fullAddress: {
      type: String,
      required: true,
      trim: true,
    },
    collectionType: {
      type: String,
      enum: Object.values(ManagedCollectionType),
      required: true,
      index: true,
    },
    binPackage: {
      type: [String],
      enum: Object.values(ManagedCollectionBinColor),
      default: [],
    },
    frequency: {
      type: String,
      enum: Object.values(ManagedCollectionFrequency),
      required: true,
    },
    preferredCollectionDay: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    scheduledFor: {
      type: Date,
      required: true,
      index: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      enum: Object.values(ManagedCollectionJobStatus),
      default: ManagedCollectionJobStatus.SCHEDULED,
      index: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    missedReason: {
      type: String,
      default: '',
      trim: true,
    },
    photos: {
      type: [String],
      default: [],
    },
    history: {
      type: [CollectionHistorySchema],
      default: [],
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

ManagedCollectionJobSchema.index({ scheduledFor: 1, status: 1 });
ManagedCollectionJobSchema.index({ countryCode: 1, city: 1, area: 1, scheduledFor: 1 });
ManagedCollectionJobSchema.index({ profileId: 1, scheduledFor: 1 }, { unique: true });

const ManagedCollectionJob =
  (mongoose.models.ManagedCollectionJob as mongoose.Model<IManagedCollectionJobDocument> | undefined) ??
  mongoose.model<IManagedCollectionJobDocument>('ManagedCollectionJob', ManagedCollectionJobSchema);

export default ManagedCollectionJob;
