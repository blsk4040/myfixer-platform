import mongoose, { Document, Schema } from 'mongoose';

export enum BookingReviewStatus {
  PUBLISHED = 'PUBLISHED',
  HIDDEN = 'HIDDEN',
}

export interface IBookingReviewDocument extends Document {
  bookingId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  technicianId: mongoose.Types.ObjectId;
  serviceKey: string;
  serviceName: string;
  countryCode: string;
  city: string;
  rating: number;
  professional: boolean;
  onTime: boolean;
  qualityWork: boolean;
  communication: boolean;
  comment: string;
  wouldBookAgain: boolean;
  status: BookingReviewStatus;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const BookingReviewSchema = new Schema<IBookingReviewDocument>(
  {
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      unique: true,
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
      required: true,
      index: true,
    },
    serviceKey: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    serviceName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    countryCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 2,
      index: true,
    },
    city: {
      type: String,
      default: '',
      trim: true,
      maxlength: 120,
      index: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    professional: {
      type: Boolean,
      required: true,
    },
    onTime: {
      type: Boolean,
      required: true,
    },
    qualityWork: {
      type: Boolean,
      required: true,
    },
    communication: {
      type: Boolean,
      required: true,
    },
    comment: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1200,
    },
    wouldBookAgain: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: Object.values(BookingReviewStatus),
      default: BookingReviewStatus.PUBLISHED,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

BookingReviewSchema.index({ customerId: 1, createdAt: -1 });
BookingReviewSchema.index({ technicianId: 1, status: 1, createdAt: -1 });
BookingReviewSchema.index({ countryCode: 1, city: 1, serviceKey: 1, status: 1 });

export default mongoose.model<IBookingReviewDocument>('BookingReview', BookingReviewSchema);
