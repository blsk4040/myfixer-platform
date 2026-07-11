// src/models/technician.model.ts

import mongoose, { Schema, Document } from 'mongoose';
import { CountryCode } from '../config/market.config';
import { User } from './user.model';

export enum TechnicianApprovalStatus {
  PENDING_REVIEW = 'PENDING_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SUSPENDED = 'SUSPENDED',
}

export enum VerificationStatus {
  NOT_SUBMITTED = 'NOT_SUBMITTED',
  SUBMITTED = 'SUBMITTED',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

export interface GeoPoint {
  longitude: number;
  latitude: number;
}

export interface TechnicianProfile {
  id: string;
  userId: string;
  isOnline: boolean;
  lastLocation: GeoPoint | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TechnicianProfileWithUser extends TechnicianProfile {
  user: User;
}

export interface CreateTechnicianProfileInput {
  userId: string;
  isOnline?: boolean;
  lastLocation?: GeoPoint | null;
}

export interface UpdateTechnicianLocationInput {
  technicianProfileId: string;
  lastLocation: GeoPoint;
  isOnline?: boolean;
}

export interface TechnicianProfileRow {
  id: string;
  user_id: string;
  is_online: boolean;
  last_location: unknown;
  created_at: Date;
  updated_at: Date;
}

export interface ITechnicianDocument extends Document {
  userId: mongoose.Types.ObjectId;

  approvalStatus: TechnicianApprovalStatus;

  countryCode: CountryCode;
  city: string;
  serviceCategories: string[];

  yearsExperience: number;
  businessName: string;
  idNumberLast4: string;

  vehicleType: string;
  vehicleRegistration: string;

  serviceRadiusKm: number;
  walletBalance: number;
  strikesCount: number;
  reliabilityScore: number;
  bio: string;

  documents: {
    idDocumentUrl?: string;
    idDocumentStatus: VerificationStatus;

    tradeCertificateUrl?: string;
    tradeCertificateStatus: VerificationStatus;

    policeClearanceUrl?: string;
    policeClearanceStatus: VerificationStatus;

    profilePhotoUrl?: string;
    profilePhotoStatus: VerificationStatus;
  };

  banking: {
    accountHolder?: string;
    bankName?: string;
    accountNumberLast4?: string;
    payoutEnabled: boolean;
  };

  stats: {
    averageRating: number;
    reviewCount: number;
    completedJobs: number;
    cancelledJobs: number;
    lifetimeEarningsMinor: number;
  };

  availability: {
    isOnline: boolean;
    acceptsEmergencyJobs: boolean;
    lastSeenAt?: Date | null;
  };

  lastLocation: {
    type: 'Point';
    coordinates: [number, number];
  } | null;

  review: {
    reviewedAt?: Date | null;
    reviewedBy?: mongoose.Types.ObjectId | null;
    rejectionReason: string;
    suspensionReason: string;
  };

  metadata: Record<string, unknown>;

  createdAt: Date;
  updatedAt: Date;
}

const LocationSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
      required: true,
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator(value: number[]) {
          return Array.isArray(value) && value.length === 2;
        },
        message: 'Coordinates must contain [longitude, latitude]',
      },
    },
  },
  { _id: false }
);

const TechnicianSchema = new Schema<ITechnicianDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    approvalStatus: {
      type: String,
      enum: Object.values(TechnicianApprovalStatus),
      default: TechnicianApprovalStatus.PENDING_REVIEW,
      index: true,
    },

    countryCode: {
      type: String,
      enum: Object.values(CountryCode),
      required: true,
      index: true,
    },

    city: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    serviceCategories: {
      type: [String],
      required: true,
      default: [],
      index: true,
    },

    yearsExperience: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    businessName: {
      type: String,
      default: '',
      trim: true,
    },

    idNumberLast4: {
      type: String,
      default: '',
      trim: true,
      maxlength: 4,
    },

    vehicleType: {
      type: String,
      default: '',
      trim: true,
    },

    vehicleRegistration: {
      type: String,
      default: '',
      trim: true,
      uppercase: true,
    },

    serviceRadiusKm: {
      type: Number,
      default: 25,
      min: 1,
      max: 150,
    },

    walletBalance: {
      type: Number,
      default: 0,
    },

    strikesCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    reliabilityScore: {
      type: Number,
      default: 100,
      min: 0,
      max: 100,
    },

    bio: {
      type: String,
      default: '',
      trim: true,
      maxlength: 600,
    },

    documents: {
      idDocumentUrl: {
        type: String,
        default: '',
        trim: true,
      },
      idDocumentStatus: {
        type: String,
        enum: Object.values(VerificationStatus),
        default: VerificationStatus.NOT_SUBMITTED,
      },

      tradeCertificateUrl: {
        type: String,
        default: '',
        trim: true,
      },
      tradeCertificateStatus: {
        type: String,
        enum: Object.values(VerificationStatus),
        default: VerificationStatus.NOT_SUBMITTED,
      },

      policeClearanceUrl: {
        type: String,
        default: '',
        trim: true,
      },
      policeClearanceStatus: {
        type: String,
        enum: Object.values(VerificationStatus),
        default: VerificationStatus.NOT_SUBMITTED,
      },

      profilePhotoUrl: {
        type: String,
        default: '',
        trim: true,
      },
      profilePhotoStatus: {
        type: String,
        enum: Object.values(VerificationStatus),
        default: VerificationStatus.NOT_SUBMITTED,
      },
    },

    banking: {
      accountHolder: {
        type: String,
        default: '',
        trim: true,
      },
      bankName: {
        type: String,
        default: '',
        trim: true,
      },
      accountNumberLast4: {
        type: String,
        default: '',
        trim: true,
        maxlength: 4,
      },
      payoutEnabled: {
        type: Boolean,
        default: false,
      },
    },

    stats: {
      averageRating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5,
      },
      reviewCount: {
        type: Number,
        default: 0,
        min: 0,
      },
      completedJobs: {
        type: Number,
        default: 0,
        min: 0,
      },
      cancelledJobs: {
        type: Number,
        default: 0,
        min: 0,
      },
      lifetimeEarningsMinor: {
        type: Number,
        default: 0,
        min: 0,
      },
    },

    availability: {
      isOnline: {
        type: Boolean,
        default: false,
        index: true,
      },
      acceptsEmergencyJobs: {
        type: Boolean,
        default: false,
      },
      lastSeenAt: {
        type: Date,
        default: null,
      },
    },

    lastLocation: {
      type: LocationSchema,
      default: null,
    },

    review: {
      reviewedAt: {
        type: Date,
        default: null,
      },
      reviewedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      rejectionReason: {
        type: String,
        default: '',
        trim: true,
      },
      suspensionReason: {
        type: String,
        default: '',
        trim: true,
      },
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

TechnicianSchema.virtual('stats.lifetimeEarnings').get(function () {
  return this.stats.lifetimeEarningsMinor / 100;
});

TechnicianSchema.set('toJSON', { virtuals: true });
TechnicianSchema.set('toObject', { virtuals: true });

TechnicianSchema.index({ lastLocation: '2dsphere' });
TechnicianSchema.index({ approvalStatus: 1, 'availability.isOnline': 1 });
TechnicianSchema.index({ countryCode: 1, city: 1, approvalStatus: 1 });
TechnicianSchema.index({ serviceCategories: 1, approvalStatus: 1 });
TechnicianSchema.index({ 'stats.averageRating': -1 });
TechnicianSchema.index({ createdAt: -1 });

const TechnicianModel =
  (mongoose.models.Technician as mongoose.Model<ITechnicianDocument> | undefined) ??
  mongoose.model<ITechnicianDocument>('Technician', TechnicianSchema);

export default TechnicianModel;
