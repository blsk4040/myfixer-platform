// backend/src/models/booking.model.ts
import { Schema, model, Document } from 'mongoose';

export enum BookingStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  IN_ROUTE = 'IN_ROUTE',
  ARRIVED = 'ARRIVED',                 // Added to support field tracking status
  DIAGNOSTIC_DONE = 'DIAGNOSTIC_DONE', // Added to support input sheet intercept status
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export enum CurrencyCode {
  ZAR = 'ZAR',
  GHS = 'GHS'
}

// Sub-interface matching our tax invoice parameters schema matrix
interface IFinalBilling {
  baseAmount: number;
  additionalLabor: number;
  partsAmount: number;
  totalAmount: number;
  proofPhoto?: string;
}

export interface IBooking extends Document {
  customerId: string;
  customerName: string;         // Added to store readable reference profiles
  customerEmail: string;        // Added to control Resend dynamic recipients
  technicianId: string | null;

  applianceType: string;
  faultDescription: string;     // Added for diagnostic logs context
  
  customerLocation: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  
  fullAddress: string;          // Added for map/routing accuracy
  complexDetails?: string;      // Added for complex/estate security instructions
  generalArea: string;          // Added for masked visual display maps

  price: number;
  currency: CurrencyCode;

  status: BookingStatus;
  
  finalBilling?: IFinalBilling; // Added to log itemized invoice calculations safely

  acceptedAt: Date | null;
  completedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

const BookingSchema = new Schema<IBooking>(
  {
    customerId: {
      type: String,
      required: true,
      trim: true
    },

    customerName: {
      type: String,
      default: 'Client',
      trim: true
    },

    customerEmail: {
      type: String,
      required: true,
      default: 'client@myfixer.co.za', // Fallback context matching default rules
      trim: true
    },

    technicianId: {
      type: String,
      default: null
    },

    applianceType: {
      type: String,
      required: true,
      trim: true
    },

    faultDescription: {
      type: String,
      default: 'No description provided.',
      trim: true
    },

    customerLocation: {
      type: {
        type: String,
        enum: ['Point'],
        required: true
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: (value: number[]) => value.length === 2,
          message: 'Coordinates must contain [longitude, latitude]'
        }
      }
    },

    fullAddress: {
      type: String,
      required: true,
      trim: true
    },

    complexDetails: {
      type: String,
      default: '',
      trim: true
    },

    generalArea: {
      type: String,
      default: 'Local Area',
      trim: true
    },

    price: {
      type: Number,
      required: true,
      min: 0
    },

    currency: {
      type: String,
      enum: Object.values(CurrencyCode),
      default: CurrencyCode.ZAR
    },

    status: {
      type: String,
      enum: Object.values(BookingStatus),
      default: BookingStatus.PENDING
    },

    finalBilling: {
      baseAmount: { type: Number, default: 450 },
      additionalLabor: { type: Number, default: 0 },
      partsAmount: { type: Number, default: 0 },
      totalAmount: { type: Number, default: 450 },
      proofPhoto: { type: String, default: '' }
    },

    acceptedAt: {
      type: Date,
      default: null
    },

    completedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

BookingSchema.index({
  customerLocation: '2dsphere'
});

export const Booking = model<IBooking>('Booking', BookingSchema);
export default Booking;