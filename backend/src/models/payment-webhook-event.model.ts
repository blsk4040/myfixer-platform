import mongoose, { Document, Schema } from 'mongoose';
import { PaymentProvider } from './payment-transaction.model';

export enum PaymentWebhookProcessingStatus {
  RECEIVED = 'RECEIVED',
  PROCESSING = 'PROCESSING',
  PROCESSED = 'PROCESSED',
  IGNORED = 'IGNORED',
  FAILED = 'FAILED',
}

export interface IPaymentWebhookEvent extends Document {
  provider: PaymentProvider;
  eventType: string;
  eventId?: string;
  reference?: string;
  payloadHash: string;
  processed: boolean;
  processingStatus: PaymentWebhookProcessingStatus;
  receivedAt: Date;
  processedAt?: Date | null;
  failureReason?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentWebhookEventSchema = new Schema<IPaymentWebhookEvent>(
  {
    provider: {
      type: String,
      enum: Object.values(PaymentProvider),
      default: PaymentProvider.PAYSTACK,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    eventId: {
      type: String,
      default: '',
      trim: true,
    },
    reference: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    payloadHash: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    processed: {
      type: Boolean,
      default: false,
      index: true,
    },
    processingStatus: {
      type: String,
      enum: Object.values(PaymentWebhookProcessingStatus),
      default: PaymentWebhookProcessingStatus.RECEIVED,
      index: true,
    },
    receivedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    processedAt: {
      type: Date,
      default: null,
    },
    failureReason: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

PaymentWebhookEventSchema.index(
  { provider: 1, eventId: 1 },
  {
    unique: true,
    partialFilterExpression: { eventId: { $type: 'string', $ne: '' } },
  }
);
PaymentWebhookEventSchema.index({ provider: 1, payloadHash: 1 }, { unique: true });
PaymentWebhookEventSchema.index({ provider: 1, processingStatus: 1, receivedAt: -1 });

const PaymentWebhookEvent =
  (mongoose.models.PaymentWebhookEvent as mongoose.Model<IPaymentWebhookEvent> | undefined) ??
  mongoose.model<IPaymentWebhookEvent>('PaymentWebhookEvent', PaymentWebhookEventSchema);

export default PaymentWebhookEvent;
