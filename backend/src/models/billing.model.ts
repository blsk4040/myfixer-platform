// c:/myfixer-platform/backend/src/models/billing.model.ts
import { Schema, model, Document } from 'mongoose';

// 🧾 INVOICE INTERFACE & SCHEMA
export interface IInvoice extends Document {
  invoiceNumber: string;
  bookingId: Schema.Types.ObjectId;
  customerId: Schema.Types.ObjectId;
  technicianId: Schema.Types.ObjectId;
  baseAmount: number;
  additionalLabor: number;
  partsAmount: number;
  totalAmount: number;
  status: 'UNPAID' | 'PAID' | 'REFUNDED';
  createdAt: Date;
}

const InvoiceSchema = new Schema<IInvoice>({
  invoiceNumber: { type: String, required: true, unique: true },
  bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  technicianId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  baseAmount: { type: Number, required: true, default: 0 },
  additionalLabor: { type: Number, required: true, default: 0 },
  partsAmount: { type: Number, required: true, default: 0 },
  totalAmount: { type: Number, required: true, default: 0 },
  status: { type: String, enum: ['UNPAID', 'PAID', 'REFUNDED'], default: 'UNPAID' }
}, { timestamps: true });

// 💳 WALLET INTERFACE & SCHEMA
export interface IWallet extends Document {
  technicianId: Schema.Types.ObjectId;
  availableBalance: number;
  pendingBalance: number;
}

const WalletSchema = new Schema<IWallet>({
  technicianId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  availableBalance: { type: Number, required: true, default: 0 },
  pendingBalance: { type: Number, required: true, default: 0 }
}, { timestamps: true });

export const Invoice = model<IInvoice>('Invoice', InvoiceSchema);
export const Wallet = model<IWallet>('Wallet', WalletSchema);