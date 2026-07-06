// backend/src/models/booking.model.ts

import mongoose, { Schema, Document } from 'mongoose';
import { CountryCode, CurrencyCode } from '../config/market.config';

export enum BookingStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  IN_ROUTE = 'IN_ROUTE',
  ARRIVED = 'ARRIVED',
  DIAGNOSTIC_DONE = 'DIAGNOSTIC_DONE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum BookingCancellationBy {
  CUSTOMER = 'CUSTOMER',
  TECHNICIAN = 'TECHNICIAN',
  ADMIN = 'ADMIN',
  SYSTEM = 'SYSTEM',
}

export enum BookingDispatchStatus {
  BROADCASTING = 'BROADCASTING',
  STANDBY = 'STANDBY',
  SCHEDULED = 'SCHEDULED',
  ACCEPTED = 'ACCEPTED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

interface IFinalBilling {
  baseAmountMinor: number;
  additionalLaborMinor: number;
  partsAmountMinor: number;
  totalAmountMinor: number;
  proofPhoto?: string;
  notes?: string;
}

export interface IBooking extends Document {
  customerId: mongoose.Types.ObjectId;
  customerName: string;
  customerEmail: string;

  technicianId?: mongoose.Types.ObjectId | null;
  technicianName?: string;

  serviceKey?: string;
  applianceType: string;
  faultDescription: string;

  customerLocation: {
    type: 'Point';
    coordinates: [number, number];
  };

  fullAddress: string;
  complexDetails?: string;
  generalArea: string;

  priceMinor: number;
  countryCode: CountryCode;
  currency: CurrencyCode;

  status: BookingStatus;

  finalBilling?: IFinalBilling;

  acceptedAt?: Date | null;
  inRouteAt?: Date | null;
  arrivedAt?: Date | null;
  diagnosticDoneAt?: Date | null;
  completedAt?: Date | null;
  cancelledAt?: Date | null;

  cancellation?: {
    cancelledBy: BookingCancellationBy;
    reason: string;
    note?: string;
  };

  dispatch?: {
    status: BookingDispatchStatus;
    expiresAt?: Date | null;
    sentToTechnicians: mongoose.Types.ObjectId[];
    declinedByTechnicians: mongoose.Types.ObjectId[];
    acceptedByTechnician?: mongoose.Types.ObjectId | null;
  };

  metadata: Record<string, unknown>;

  createdAt: Date;
  updatedAt: Date;
}

const FinalBillingSchema = new Schema(
  {
    baseAmountMinor: {
      type: Number,
      default: 0,
      min: 0,
    },
    additionalLaborMinor: {
      type: Number,
      default: 0,
      min: 0,
    },
    partsAmountMinor: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAmountMinor: {
      type: Number,
      default: 0,
      min: 0,
    },
    proofPhoto: {
      type: String,
      default: '',
      trim: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { _id: false }
);

const CancellationSchema = new Schema(
  {
    cancelledBy: {
      type: String,
      enum: Object.values(BookingCancellationBy),
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    note: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { _id: false }
);

const DispatchSchema = new Schema(
  {
    status: {
      type: String,
      enum: Object.values(BookingDispatchStatus),
      default: BookingDispatchStatus.BROADCASTING,
      index: true,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    sentToTechnicians: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
    declinedByTechnicians: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
    acceptedByTechnician: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { _id: false }
);

const BookingSchema = new Schema<IBooking>(
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
      index: true,
    },

    technicianId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },

    technicianName: {
      type: String,
      default: '',
      trim: true,
    },

    serviceKey: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
    },

    applianceType: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    faultDescription: {
      type: String,
      default: 'No description provided.',
      trim: true,
    },

    customerLocation: {
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

    fullAddress: {
      type: String,
      required: true,
      trim: true,
    },

    complexDetails: {
      type: String,
      default: '',
      trim: true,
    },

    generalArea: {
      type: String,
      default: 'Local Area',
      trim: true,
      index: true,
    },

    priceMinor: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    countryCode: {
      type: String,
      enum: Object.values(CountryCode),
      default: CountryCode.ZA,
      index: true,
    },

    currency: {
      type: String,
      enum: Object.values(CurrencyCode),
      default: CurrencyCode.ZAR,
      index: true,
    },

    status: {
      type: String,
      enum: Object.values(BookingStatus),
      default: BookingStatus.PENDING,
      index: true,
    },

    finalBilling: {
      type: FinalBillingSchema,
      default: undefined,
    },

    acceptedAt: {
      type: Date,
      default: null,
    },

    inRouteAt: {
      type: Date,
      default: null,
    },

    arrivedAt: {
      type: Date,
      default: null,
    },

    diagnosticDoneAt: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    cancellation: {
      type: CancellationSchema,
      default: undefined,
    },

    dispatch: {
      type: DispatchSchema,
      default: undefined,
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// --- Virtuals ---

BookingSchema.virtual('price').get(function () {
  return this.priceMinor / 100;
});

BookingSchema.virtual('finalBillingAmounts').get(function () {
  if (!this.finalBilling) return null;

  return {
    baseAmount: this.finalBilling.baseAmountMinor / 100,
    additionalLabor: this.finalBilling.additionalLaborMinor / 100,
    partsAmount: this.finalBilling.partsAmountMinor / 100,
    totalAmount: this.finalBilling.totalAmountMinor / 100,
  };
});

// --- Indexes ---

BookingSchema.index({ customerLocation: '2dsphere' });
BookingSchema.index({ status: 1, createdAt: -1 });
BookingSchema.index({ customerId: 1, createdAt: -1 });
BookingSchema.index({ technicianId: 1, status: 1 });
BookingSchema.index({ countryCode: 1, status: 1 });
BookingSchema.index({ countryCode: 1, serviceKey: 1, status: 1 });
BookingSchema.index({ generalArea: 1, status: 1 });
BookingSchema.index({ status: 1, 'dispatch.expiresAt': 1 });
BookingSchema.index({ 'dispatch.declinedByTechnicians': 1 });

export const Booking =
  (mongoose.models.Booking as mongoose.Model<IBooking> | undefined) ??
  mongoose.model<IBooking>('Booking', BookingSchema);

export default Booking;
