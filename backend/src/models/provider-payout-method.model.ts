import mongoose, { Document, Schema } from 'mongoose';
import { CountryCode, CurrencyCode } from '../config/market.config';

export enum ProviderPayoutMethodType {
  BANK_ACCOUNT = 'BANK_ACCOUNT',
  MOBILE_MONEY = 'MOBILE_MONEY',
}

export enum ProviderPayoutMethodStatus {
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  DISABLED = 'DISABLED',
}

export enum ProviderPayoutProvider {
  PAYSTACK = 'PAYSTACK',
}

export interface IProviderPayoutMethod extends Document {
  technicianId: mongoose.Types.ObjectId;
  type: ProviderPayoutMethodType;
  provider: ProviderPayoutProvider;
  countryCode: CountryCode;
  currency: CurrencyCode;
  accountHolderName: string;
  bankName?: string;
  bankCode?: string;
  encryptedAccountNumber?: string;
  encryptedMobileNumber?: string;
  mobileProvider?: string;
  maskedDestination: string;
  providerRecipientCode?: string;
  providerRecipientId?: string;
  status: ProviderPayoutMethodStatus;
  isDefault: boolean;
  verifiedAt?: Date | null;
  disabledAt?: Date | null;
  rejectionReason?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const ProviderPayoutMethodSchema = new Schema<IProviderPayoutMethod>(
  {
    technicianId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: Object.values(ProviderPayoutMethodType), required: true, index: true },
    provider: { type: String, enum: Object.values(ProviderPayoutProvider), default: ProviderPayoutProvider.PAYSTACK, index: true },
    countryCode: { type: String, enum: Object.values(CountryCode), required: true, index: true },
    currency: { type: String, enum: Object.values(CurrencyCode), required: true, index: true },
    accountHolderName: { type: String, required: true, trim: true, maxlength: 120 },
    bankName: { type: String, default: '', trim: true, maxlength: 120 },
    bankCode: { type: String, default: '', trim: true, maxlength: 40 },
    encryptedAccountNumber: { type: String, default: '', select: false },
    encryptedMobileNumber: { type: String, default: '', select: false },
    mobileProvider: { type: String, default: '', trim: true, maxlength: 80 },
    maskedDestination: { type: String, required: true, trim: true },
    providerRecipientCode: { type: String, default: '', trim: true, index: true },
    providerRecipientId: { type: String, default: '', trim: true },
    status: {
      type: String,
      enum: Object.values(ProviderPayoutMethodStatus),
      default: ProviderPayoutMethodStatus.PENDING_VERIFICATION,
      index: true,
    },
    isDefault: { type: Boolean, default: false, index: true },
    verifiedAt: { type: Date, default: null },
    disabledAt: { type: Date, default: null },
    rejectionReason: { type: String, default: '', trim: true, maxlength: 500 },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

ProviderPayoutMethodSchema.index({ technicianId: 1, isDefault: 1 });
ProviderPayoutMethodSchema.index({ technicianId: 1, status: 1, createdAt: -1 });

const ProviderPayoutMethod =
  (mongoose.models.ProviderPayoutMethod as mongoose.Model<IProviderPayoutMethod> | undefined) ??
  mongoose.model<IProviderPayoutMethod>('ProviderPayoutMethod', ProviderPayoutMethodSchema);

export default ProviderPayoutMethod;
