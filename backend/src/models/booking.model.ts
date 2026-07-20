// backend/src/models/booking.model.ts

import mongoose, { Schema, Document } from 'mongoose';
import { CountryCode, CurrencyCode } from '../config/market.config';

export enum BookingStatus {
  PENDING = 'PENDING',
  SCHEDULED = 'SCHEDULED',
  ACCEPTED = 'ACCEPTED',
  IN_ROUTE = 'IN_ROUTE',
  ARRIVED = 'ARRIVED',
  IN_PROGRESS = 'IN_PROGRESS',
  /** Legacy work-stage status retained while existing bookings are migrated. */
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

export enum BookingRecipientType {
  SELF = 'SELF',
  OTHER = 'OTHER',
}

export enum PricingMode {
  FIXED_PRICE = 'FIXED_PRICE',
  INSPECTION_AND_QUOTE = 'INSPECTION_AND_QUOTE',
}

export enum InspectionStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  NOT_REQUIRED = 'NOT_REQUIRED',
}

export enum WorkAuthorizationStatus {
  BLOCKED = 'BLOCKED',
  AWAITING_INSPECTION = 'AWAITING_INSPECTION',
  AWAITING_QUOTE = 'AWAITING_QUOTE',
  AWAITING_QUOTE_APPROVAL = 'AWAITING_QUOTE_APPROVAL',
  AWAITING_PAYMENT = 'AWAITING_PAYMENT',
  AUTHORIZED = 'AUTHORIZED',
}

export enum BookingPaymentStatus {
  NOT_REQUIRED = 'NOT_REQUIRED',
  PENDING = 'PENDING',
  SECURED = 'SECURED',
  FAILED = 'FAILED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  REFUNDED = 'REFUNDED',
}

export enum CompletionStatus {
  NOT_SUBMITTED = 'NOT_SUBMITTED',
  PROVIDER_SUBMITTED = 'PROVIDER_SUBMITTED',
  CUSTOMER_CONFIRMATION_PENDING = 'CUSTOMER_CONFIRMATION_PENDING',
  CUSTOMER_CONFIRMED = 'CUSTOMER_CONFIRMED',
  ISSUE_REPORTED = 'ISSUE_REPORTED',
  AUTO_CONFIRMED = 'AUTO_CONFIRMED',
  ADMIN_CONFIRMED = 'ADMIN_CONFIRMED',
}

interface IFinalBilling {
  baseAmountMinor: number;
  additionalLaborMinor: number;
  partsAmountMinor: number;
  totalAmountMinor: number;
  proofPhoto?: string;
  notes?: string;
}

export interface IServiceRecipient {
  type: BookingRecipientType;
  fullName: string;
  phoneNumber: string;
  relationship?: string;
  email?: string;
  countryCode?: string;
  country?: string;
  city?: string;
  streetAddress?: string;
  notes?: string;
}

export interface IInspectionPart {
  name: string;
  quantity?: number;
  notes?: string;
}

export interface IInspectionLocation {
  type: 'Point';
  coordinates: [number, number];
  accuracyMeters?: number;
}

export interface IBookingInspection {
  status: InspectionStatus;
  startedAt?: Date | null;
  completedAt?: Date | null;
  startedBy?: mongoose.Types.ObjectId | null;
  completedBy?: mongoose.Types.ObjectId | null;
  reminderAcknowledgedAt?: Date | null;
  reminderAcknowledgedBy?: mongoose.Types.ObjectId | null;
  startLocation?: IInspectionLocation;
  completionLocation?: IInspectionLocation;
  diagnosisNotes?: string;
  technicalObservations?: string;
  partsRequired?: IInspectionPart[];
  quoteRequired?: boolean;
  evidenceMediaIds?: mongoose.Types.ObjectId[];
}

export interface IWorkAuthorization {
  status: WorkAuthorizationStatus;
  reasonCode?: string;
  requirements?: Record<string, unknown>;
  evaluatedAt?: Date | null;
}

export interface IBookingPaymentSecurity {
  securedAt?: Date | null;
  transactionId?: mongoose.Types.ObjectId | null;
  provider?: string;
  reference?: string;
  amountMinor?: number;
  currency?: string;
  verifiedAt?: Date | null;
}

export interface IBookingCompletionPart {
  name: string;
  quantity?: number;
  amountMinor?: number;
  notes?: string;
}

export interface IBookingCompletion {
  status: CompletionStatus;
  submittedBy?: mongoose.Types.ObjectId | null;
  submittedAt?: Date | null;
  completionNotes?: string;
  partsUsed?: IBookingCompletionPart[];
  evidenceMediaIds?: mongoose.Types.ObjectId[];
  finalAmountMinor?: number;
  currency?: string;
  customerConfirmedBy?: mongoose.Types.ObjectId | null;
  customerConfirmedAt?: Date | null;
  issueReportedBy?: mongoose.Types.ObjectId | null;
  issueReportedAt?: Date | null;
  issueReason?: string;
  autoConfirmEligibleAt?: Date | null;
  autoConfirmedAt?: Date | null;
  adminConfirmedBy?: mongoose.Types.ObjectId | null;
  adminConfirmedAt?: Date | null;
  adminNote?: string;
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
  serviceRecipient?: IServiceRecipient;

  priceMinor: number;
  countryCode: string;
  currency: string;
  pricingMode: PricingMode;
  paymentStatus: BookingPaymentStatus;
  paymentSecurity?: IBookingPaymentSecurity;
  completion?: IBookingCompletion;
  workAuthorization?: IWorkAuthorization;
  inspection?: IBookingInspection;

  status: BookingStatus;

  finalBilling?: IFinalBilling;
  appointmentWindow?: {
    isPreBook: boolean;
    scheduledStartTime?: Date | null;
    scheduledEndTime?: Date | null;
  };

  scheduledAt?: Date | null;
  acceptedAt?: Date | null;
  inRouteAt?: Date | null;
  routeStartedAt?: Date | null;
  arrivedAt?: Date | null;
  inProgressAt?: Date | null;
  workStartedAt?: Date | null;
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
    preferredTechnicianId?: mongoose.Types.ObjectId | null;
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

const AppointmentWindowSchema = new Schema(
  {
    isPreBook: {
      type: Boolean,
      default: false,
      index: true,
    },
    scheduledStartTime: {
      type: Date,
      default: null,
      index: true,
    },
    scheduledEndTime: {
      type: Date,
      default: null,
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
    preferredTechnicianId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
  },
  { _id: false }
);

const ServiceRecipientSchema = new Schema(
  {
    type: {
      type: String,
      enum: Object.values(BookingRecipientType),
      default: BookingRecipientType.SELF,
      index: true,
    },
    fullName: {
      type: String,
      default: '',
      trim: true,
      maxlength: 120,
    },
    phoneNumber: {
      type: String,
      default: '',
      trim: true,
      maxlength: 40,
    },
    relationship: {
      type: String,
      default: '',
      trim: true,
      maxlength: 80,
    },
    email: {
      type: String,
      default: '',
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    countryCode: {
      type: String,
      default: '',
      trim: true,
      maxlength: 10,
    },
    country: {
      type: String,
      default: '',
      trim: true,
      maxlength: 120,
    },
    city: {
      type: String,
      default: '',
      trim: true,
      maxlength: 120,
    },
    streetAddress: {
      type: String,
      default: '',
      trim: true,
      maxlength: 240,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1000,
    },
  },
  { _id: false }
);

const InspectionPointSchema = new Schema<IInspectionLocation>(
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
    accuracyMeters: {
      type: Number,
      min: 0,
      default: undefined,
    },
  },
  { _id: false }
);

const InspectionPartSchema = new Schema<IInspectionPart>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    quantity: {
      type: Number,
      min: 0,
      default: undefined,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
  },
  { _id: false }
);

const BookingInspectionSchema = new Schema<IBookingInspection>(
  {
    status: {
      type: String,
      enum: Object.values(InspectionStatus),
      default: InspectionStatus.NOT_STARTED,
      index: true,
    },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    startedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    completedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reminderAcknowledgedAt: { type: Date, default: null },
    reminderAcknowledgedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    startLocation: { type: InspectionPointSchema, default: undefined },
    completionLocation: { type: InspectionPointSchema, default: undefined },
    diagnosisNotes: { type: String, default: '', trim: true, maxlength: 4000 },
    technicalObservations: { type: String, default: '', trim: true, maxlength: 4000 },
    partsRequired: { type: [InspectionPartSchema], default: [] },
    quoteRequired: { type: Boolean, default: undefined },
    evidenceMediaIds: { type: [Schema.Types.ObjectId], ref: 'JobMedia', default: [] },
  },
  { _id: false }
);

const WorkAuthorizationSchema = new Schema<IWorkAuthorization>(
  {
    status: {
      type: String,
      enum: Object.values(WorkAuthorizationStatus),
      default: WorkAuthorizationStatus.AWAITING_INSPECTION,
      index: true,
    },
    reasonCode: { type: String, default: '', trim: true, maxlength: 80 },
    requirements: { type: Schema.Types.Mixed, default: {} },
    evaluatedAt: { type: Date, default: null },
  },
  { _id: false }
);

const BookingPaymentSecuritySchema = new Schema<IBookingPaymentSecurity>(
  {
    securedAt: { type: Date, default: null },
    transactionId: { type: Schema.Types.ObjectId, ref: 'PaymentTransaction', default: null },
    provider: { type: String, default: '', trim: true },
    reference: { type: String, default: '', trim: true, index: true },
    amountMinor: { type: Number, min: 0, default: 0 },
    currency: { type: String, uppercase: true,
      validate: { validator: (value: string) => /^[A-Z]{3}$/.test(value), message: 'Invalid currency code.' }, default: undefined },
    verifiedAt: { type: Date, default: null },
  },
  { _id: false }
);

const BookingCompletionPartSchema = new Schema<IBookingCompletionPart>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    quantity: { type: Number, min: 0, default: undefined },
    amountMinor: { type: Number, min: 0, default: undefined },
    notes: { type: String, default: '', trim: true, maxlength: 500 },
  },
  { _id: false }
);

const BookingCompletionSchema = new Schema<IBookingCompletion>(
  {
    status: {
      type: String,
      enum: Object.values(CompletionStatus),
      default: CompletionStatus.NOT_SUBMITTED,
      index: true,
    },
    submittedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    submittedAt: { type: Date, default: null },
    completionNotes: { type: String, default: '', trim: true, maxlength: 4000 },
    partsUsed: { type: [BookingCompletionPartSchema], default: [] },
    evidenceMediaIds: { type: [Schema.Types.ObjectId], ref: 'JobMedia', default: [] },
    finalAmountMinor: { type: Number, min: 0, default: 0 },
    currency: { type: String, uppercase: true,
      validate: { validator: (value: string) => /^[A-Z]{3}$/.test(value), message: 'Invalid currency code.' }, default: undefined },
    customerConfirmedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    customerConfirmedAt: { type: Date, default: null },
    issueReportedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    issueReportedAt: { type: Date, default: null },
    issueReason: { type: String, default: '', trim: true, maxlength: 2000 },
    autoConfirmEligibleAt: { type: Date, default: null },
    autoConfirmedAt: { type: Date, default: null },
    adminConfirmedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    adminConfirmedAt: { type: Date, default: null },
    adminNote: { type: String, default: '', trim: true, maxlength: 1000 },
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

    serviceRecipient: {
      type: ServiceRecipientSchema,
      default: undefined,
    },

    priceMinor: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    countryCode: {
      type: String,
      uppercase: true,
      validate: { validator: (value: string) => /^[A-Z]{2}$/.test(value), message: 'Invalid ISO country code.' },
      required: true,
      index: true,
    },

    currency: {
      type: String,
      uppercase: true,
      validate: { validator: (value: string) => /^[A-Z]{3}$/.test(value), message: 'Invalid currency code.' },
      required: true,
      index: true,
    },

    pricingMode: {
      type: String,
      enum: Object.values(PricingMode),
      default: PricingMode.INSPECTION_AND_QUOTE,
      index: true,
    },

    paymentStatus: {
      type: String,
      enum: Object.values(BookingPaymentStatus),
      default: BookingPaymentStatus.PENDING,
      index: true,
    },

    paymentSecurity: {
      type: BookingPaymentSecuritySchema,
      default: undefined,
    },

    completion: {
      type: BookingCompletionSchema,
      default: undefined,
    },

    workAuthorization: {
      type: WorkAuthorizationSchema,
      default: undefined,
    },

    inspection: {
      type: BookingInspectionSchema,
      default: undefined,
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

    appointmentWindow: {
      type: AppointmentWindowSchema,
      default: undefined,
    },

    scheduledAt: {
      type: Date,
      default: null,
      index: true,
    },

    acceptedAt: {
      type: Date,
      default: null,
    },

    inRouteAt: {
      type: Date,
      default: null,
    },

    routeStartedAt: {
      type: Date,
      default: null,
    },

    arrivedAt: {
      type: Date,
      default: null,
    },

    inProgressAt: {
      type: Date,
      default: null,
    },

    workStartedAt: {
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
BookingSchema.index({ technicianId: 1, 'appointmentWindow.scheduledStartTime': 1 });
BookingSchema.index({ countryCode: 1, status: 1 });
BookingSchema.index({ countryCode: 1, serviceKey: 1, status: 1 });
BookingSchema.index({ generalArea: 1, status: 1 });
BookingSchema.index({ status: 1, 'dispatch.expiresAt': 1 });
BookingSchema.index({ 'dispatch.declinedByTechnicians': 1 });
BookingSchema.index({ status: 1, 'inspection.status': 1 });
BookingSchema.index({ status: 1, 'workAuthorization.status': 1 });
BookingSchema.index({ status: 1, 'completion.status': 1 });

export const Booking =
  (mongoose.models.Booking as mongoose.Model<IBooking> | undefined) ??
  mongoose.model<IBooking>('Booking', BookingSchema);

export default Booking;
