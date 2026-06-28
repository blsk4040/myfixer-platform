// src/models/paymentVault.model.ts
import mongoose, { Schema, Document } from 'mongoose';

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
  createdAt: Date;
}

export interface IPaymentVault extends Document {
  userId: mongoose.Types.ObjectId;
  gateway: string;
  gatewayCustomerId: string;
  defaultMethodId: string;
  paymentMethods: IPaymentMethod[];
  createdAt: Date;
  updatedAt: Date;
}

const PaymentMethodSchema = new Schema<IPaymentMethod>({
  methodId: { type: String, required: true },
  authorizationCode: { type: String, required: true },
  signature: { type: String, required: true },
  reusable: { type: Boolean, default: true },
  brand: { type: String },
  bank: { type: String },
  countryCode: { type: String },
  last4: { type: String, required: true },
  expiryMonth: { type: String, required: true },
  expiryYear: { type: String, required: true },
  cardType: { type: String },
  isDefault: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const PaymentVaultSchema = new Schema<IPaymentVault>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    gateway: { type: String, default: 'paystack' },
    gatewayCustomerId: { type: String },
    defaultMethodId: { type: String },
    paymentMethods: [PaymentMethodSchema],
  },
  { timestamps: true }
);

export default mongoose.model<IPaymentVault>('PaymentVault', PaymentVaultSchema);