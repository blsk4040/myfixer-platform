import mongoose, { Schema, Document, Model } from 'mongoose';

export enum CapabilityStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface ITechnicianCapability extends Document {
  technicianId: mongoose.Types.ObjectId;
  categorySlug: string;
  approvedSpecialties: string[];
  verificationStatus: CapabilityStatus;
  serviceRadiusKm: number;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const TechnicianCapabilitySchema = new Schema<ITechnicianCapability>(
  {
    technicianId: {
      type: Schema.Types.ObjectId,
      ref: 'Technician',
      required: true,
      index: true,
    },
    categorySlug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    approvedSpecialties: {
      type: [String],
      default: [],
    },
    verificationStatus: {
      type: String,
      enum: Object.values(CapabilityStatus),
      default: CapabilityStatus.PENDING,
      index: true,
    },
    serviceRadiusKm: {
      type: Number,
      default: 25,
      min: 1,
      max: 150,
    },
    rejectionReason: {
      type: String,
      default: null,
      trim: true,
    },
  },
  { timestamps: true }
);

TechnicianCapabilitySchema.index({ technicianId: 1, categorySlug: 1 }, { unique: true });
TechnicianCapabilitySchema.index({ categorySlug: 1, verificationStatus: 1 });

const TechnicianCapabilityModel =
  (mongoose.models.TechnicianCapability as Model<ITechnicianCapability> | undefined) ??
  mongoose.model<ITechnicianCapability>('TechnicianCapability', TechnicianCapabilitySchema);

export default TechnicianCapabilityModel;
