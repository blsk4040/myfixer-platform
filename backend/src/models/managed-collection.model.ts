import mongoose, { Document, Schema } from 'mongoose';
import { CountryCode } from '../config/market.config';

export enum ManagedCollectionPropertyType {
  HOUSE = 'HOUSE',
  APARTMENT = 'APARTMENT',
  ESTATE = 'ESTATE',
  COMMERCIAL = 'COMMERCIAL',
  INDUSTRIAL = 'INDUSTRIAL',
}

export enum ManagedCollectionType {
  GENERAL_WASTE = 'GENERAL_WASTE',
  RECYCLING = 'RECYCLING',
  ORGANIC_WASTE = 'ORGANIC_WASTE',
  GARDEN_WASTE = 'GARDEN_WASTE',
  MEDICAL_WASTE = 'MEDICAL_WASTE',
  COMMERCIAL_WASTE = 'COMMERCIAL_WASTE',
  CONSTRUCTION_WASTE = 'CONSTRUCTION_WASTE',
  E_WASTE = 'E_WASTE',
  BULK_WASTE = 'BULK_WASTE',
}

export enum ManagedCollectionBinColor {
  RED = 'RED',
  GREEN = 'GREEN',
  BLUE = 'BLUE',
}

export enum ManagedCollectionFrequency {
  WEEKLY = 'WEEKLY',
  TWICE_WEEKLY = 'TWICE_WEEKLY',
  MONTHLY = 'MONTHLY',
}

export enum ManagedCollectionDay {
  MONDAY = 'MONDAY',
  TUESDAY = 'TUESDAY',
  WEDNESDAY = 'WEDNESDAY',
  THURSDAY = 'THURSDAY',
  FRIDAY = 'FRIDAY',
  SATURDAY = 'SATURDAY',
  SUNDAY = 'SUNDAY',
}

export enum ManagedCollectionProfileStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  CANCELLED = 'CANCELLED',
}

export interface IManagedCollectionProfileDocument extends Document {
  customerId: mongoose.Types.ObjectId;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  countryCode: string;
  city: string;
  area: string;
  fullAddress: string;
  propertyType: ManagedCollectionPropertyType;
  collectionType: ManagedCollectionType;
  binPackage: ManagedCollectionBinColor[];
  frequency: ManagedCollectionFrequency;
  preferredCollectionDay: ManagedCollectionDay;
  nextCollectionDate: Date;
  status: ManagedCollectionProfileStatus;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const ManagedCollectionProfileSchema = new Schema<IManagedCollectionProfileDocument>(
  {
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
    customerPhone: {
      type: String,
      default: '',
      trim: true,
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
    propertyType: {
      type: String,
      enum: Object.values(ManagedCollectionPropertyType),
      required: true,
    },
    collectionType: {
      type: String,
      enum: Object.values(ManagedCollectionType),
      default: ManagedCollectionType.GENERAL_WASTE,
      required: true,
    },
    binPackage: {
      type: [String],
      enum: Object.values(ManagedCollectionBinColor),
      default: [ManagedCollectionBinColor.RED, ManagedCollectionBinColor.GREEN, ManagedCollectionBinColor.BLUE],
    },
    frequency: {
      type: String,
      enum: Object.values(ManagedCollectionFrequency),
      required: true,
    },
    preferredCollectionDay: {
      type: String,
      enum: Object.values(ManagedCollectionDay),
      required: true,
    },
    nextCollectionDate: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(ManagedCollectionProfileStatus),
      default: ManagedCollectionProfileStatus.ACTIVE,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

ManagedCollectionProfileSchema.index({ countryCode: 1, city: 1, area: 1, status: 1 });
ManagedCollectionProfileSchema.index({ customerId: 1, collectionType: 1, status: 1 });

const ManagedCollectionProfile =
  (mongoose.models.ManagedCollectionProfile as mongoose.Model<IManagedCollectionProfileDocument> | undefined) ??
  mongoose.model<IManagedCollectionProfileDocument>('ManagedCollectionProfile', ManagedCollectionProfileSchema);

export default ManagedCollectionProfile;
