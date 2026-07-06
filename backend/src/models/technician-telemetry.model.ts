import mongoose, { Schema, Document, Model } from 'mongoose';

export type TechnicianConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING';

export interface ITechnicianTelemetry extends Document {
  technicianId: mongoose.Types.ObjectId;
  isOnDuty: boolean;
  connectionStatus: TechnicianConnectionStatus;
  location: {
    type: 'Point';
    coordinates: [number, number];
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

const TelemetryLocationSchema = new Schema(
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
        message: 'Telemetry coordinates must contain [longitude, latitude]',
      },
    },
  },
  { _id: false }
);

const TechnicianTelemetrySchema = new Schema<ITechnicianTelemetry>(
  {
    technicianId: {
      type: Schema.Types.ObjectId,
      ref: 'Technician',
      required: true,
      unique: true,
      index: true,
    },
    isOnDuty: {
      type: Boolean,
      default: false,
      index: true,
    },
    connectionStatus: {
      type: String,
      enum: ['CONNECTED', 'DISCONNECTED', 'RECONNECTING'],
      default: 'DISCONNECTED',
      index: true,
    },
    location: {
      type: TelemetryLocationSchema,
      default: null,
    },
  },
  { timestamps: true }
);

TechnicianTelemetrySchema.index({ location: '2dsphere' });

const TechnicianTelemetryModel =
  (mongoose.models.TechnicianTelemetry as Model<ITechnicianTelemetry> | undefined) ??
  mongoose.model<ITechnicianTelemetry>('TechnicianTelemetry', TechnicianTelemetrySchema);

export default TechnicianTelemetryModel;
