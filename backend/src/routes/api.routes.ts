// c:/myfixer-platform/backend/src/routes/api.routes.ts
import { Router } from 'express';
// 1. ADD 'finalizeJobInvoice' TO THIS EXISTING IMPORT
import { createBooking, finalizeJobInvoice } from '../controllers/booking.controller';
import { registerUser, loginUser } from '../controllers/auth.controller'; 
import { getInvoicesByUser, downloadInvoicePDF } from '../controllers/invoice.controller';
import { getWalletBalance, requestWalletCashout } from '../controllers/wallet.controller';

const apiRouter = Router();

// 🔐 Authentication Matrix Endpoints
apiRouter.post('/auth/register', registerUser);
apiRouter.post('/auth/login', loginUser);

// 📅 Dispatch & Booking Allocation Engine
apiRouter.post('/bookings', createBooking);

// 2. INSERT THE FINALIZE INVOICE ROUTE DIRECTLY HERE 🎯
apiRouter.post('/bookings/finalize-invoice', finalizeJobInvoice);

// 🧾 Tax Compliance Invoice Operations
apiRouter.get('/invoices', getInvoicesByUser);                  // Fetches account specific invoice rows
apiRouter.get('/invoices/:id/download', downloadInvoicePDF);     // Serves or constructs physical PDF buffers

// 💳 Digital Clearing Wallet Balance Operations
apiRouter.get('/wallet', getWalletBalance);                     // Balances data array fetch
apiRouter.post('/wallet/cashout', requestWalletCashout);         // Dispatches outbound EFT instructions

export default apiRouter;