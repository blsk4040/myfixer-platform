"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Wallet = exports.Invoice = void 0;
// c:/myfixer-platform/backend/src/models/billing.model.ts
const mongoose_1 = require("mongoose");
const InvoiceSchema = new mongoose_1.Schema({
    invoiceNumber: { type: String, required: true, unique: true },
    bookingId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Booking', required: true },
    customerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    technicianId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    baseAmount: { type: Number, required: true, default: 0 },
    additionalLabor: { type: Number, required: true, default: 0 },
    partsAmount: { type: Number, required: true, default: 0 },
    totalAmount: { type: Number, required: true, default: 0 },
    status: { type: String, enum: ['UNPAID', 'PAID', 'REFUNDED'], default: 'UNPAID' }
}, { timestamps: true });
const WalletSchema = new mongoose_1.Schema({
    technicianId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    availableBalance: { type: Number, required: true, default: 0 },
    pendingBalance: { type: Number, required: true, default: 0 }
}, { timestamps: true });
exports.Invoice = (0, mongoose_1.model)('Invoice', InvoiceSchema);
exports.Wallet = (0, mongoose_1.model)('Wallet', WalletSchema);
//# sourceMappingURL=billing.model.js.map