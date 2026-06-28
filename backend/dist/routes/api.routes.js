"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// c:/myfixer-platform/backend/src/routes/api.routes.ts
const express_1 = require("express");
const booking_controller_1 = require("../controllers/booking.controller");
const auth_controller_1 = require("../controllers/auth.controller");
const invoice_controller_1 = require("../controllers/invoice.controller");
const wallet_controller_1 = require("../controllers/wallet.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
// Import the secure PCI-compliant payment gateway endpoints
const payment_routes_1 = __importDefault(require("./payment.routes"));
const apiRouter = (0, express_1.Router)();
// 🔐 Authentication Matrix Endpoints
apiRouter.post('/auth/register', auth_controller_1.registerUser);
apiRouter.post('/auth/login', auth_controller_1.loginUser);
// 📅 Dispatch & Booking Allocation Engine
apiRouter.post('/bookings', booking_controller_1.createBooking);
apiRouter.get('/bookings/:id', booking_controller_1.getBookingById);
apiRouter.post('/bookings/finalize-invoice', auth_middleware_1.authenticateToken, booking_controller_1.finalizeJobInvoice);
// 💳 Secure Tokenized Payment Gateway Engine
apiRouter.use('/payments', payment_routes_1.default);
// 🧾 Tax Compliance Invoice Operations
apiRouter.get('/invoices', auth_middleware_1.authenticateToken, invoice_controller_1.getInvoicesByUser); // Fetches account specific invoice rows
apiRouter.get('/invoices/:id/download', auth_middleware_1.authenticateToken, invoice_controller_1.downloadInvoicePDF); // Serves or constructs physical PDF buffers
// 🏦 Digital Clearing Wallet Balance Operations
apiRouter.get('/wallet', auth_middleware_1.authenticateToken, wallet_controller_1.getWalletBalance); // Balances data array fetch
apiRouter.post('/wallet/cashout', auth_middleware_1.authenticateToken, wallet_controller_1.requestWalletCashout); // Dispatches outbound EFT instructions
exports.default = apiRouter;
//# sourceMappingURL=api.routes.js.map