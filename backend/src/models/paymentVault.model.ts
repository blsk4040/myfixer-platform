// src/models/paymentVault.model.ts

import mongoose, { Schema, Document } from 'mongoose';

export enum PaymentMethodStatus {
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
  EXPIRED = 'EXPIRED',
  REMOVED = 'REMOVED',
}

export interface IPaymentMethod {
  methodId: string;
  authorizationCode: string;
  signature: string;
  reusable: boolean;
  brand: string;
  bank: string;
  countryCode: string;
  last4: string;
  expiryMonth: string;
  expiryYear: string;
  cardType: string;
  isDefault: boolean;
  status: PaymentMethodStatus;
  createdAt: Date;
  disabledAt?: Date;
  metadata: Record<string, unknown>;
}

export interface IPaymentVault extends Document {
  userId: mongoose.Types.ObjectId;
  gateway: string;
  gatewayCustomerId: string;
  defaultMethodId: string;
  paymentMethods: IPaymentMethod[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentMethodSchema = new Schema<IPaymentMethod>(
  {
    methodId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    authorizationCode: {
      type: String,
      required: true,
      trim: true,
      select: false,
    },

    signature: {
      type: String,
      required: true,
      trim: true,
      select: false,
    },

    reusable: {
      type: Boolean,
      default: true,
    },

    brand: {
      type: String,
      default: '',
      trim: true,
      lowercase: true,
    },

    bank: {
      type: String,
      default: '',
      trim: true,
    },

    countryCode: {
      type: String,
      default: '',
      trim: true,
      uppercase: true,
    },

    last4: {
      type: String,
      required: true,
      trim: true,
      minlength: 4,
      maxlength: 4,
    },

    expiryMonth: {
      type: String,
      required: true,
      trim: true,
    },

    expiryYear: {
      type: String,
      required: true,
      trim: true,
    },

    cardType: {
      type: String,
      default: '',
      trim: true,
      lowercase: true,
    },

    isDefault: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,
      enum: Object.values(PaymentMethodStatus),
      default: PaymentMethodStatus.ACTIVE,
      index: true,
    },

    disabledAt: {
      type: Date,
      default: null,
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const PaymentVaultSchema = new Schema<IPaymentVault>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    gateway: {
      type: String,
      default: 'paystack',
      trim: true,
      lowercase: true,
      index: true,
    },

    gatewayCustomerId: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },

    defaultMethodId: {
      type: String,
      default: '',
      trim: true,
    },

    paymentMethods: {
      type: [PaymentMethodSchema],
      default: [],
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

PaymentVaultSchema.index({ userId: 1, gateway: 1 }, { unique: true });
PaymentVaultSchema.index({ gateway: 1, gatewayCustomerId: 1 });

const PaymentVault =
  (mongoose.models.PaymentVault as mongoose.Model<IPaymentVault> | undefined) ??
  mongoose.model<IPaymentVault>('PaymentVault', PaymentVaultSchema);

export default PaymentVault;