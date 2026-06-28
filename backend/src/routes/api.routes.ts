// c:/myfixer-platform/backend/src/routes/api.routes.ts
import { Router } from 'express';
import { createBooking, finalizeJobInvoice, getBookingById } from '../controllers/booking.controller';
import { registerUser, loginUser } from '../controllers/auth.controller'; 
import { getInvoicesByUser, downloadInvoicePDF } from '../controllers/invoice.controller';
import { getWalletBalance, requestWalletCashout } from '../controllers/wallet.controller';
import { authenticateToken } from '../middleware/auth.middleware';

// Import the secure PCI-compliant payment gateway endpoints
import paymentRoutes from './payment.routes';

const apiRouter = Router();

// 🔐 Authentication Matrix Endpoints
apiRouter.post('/auth/register', registerUser);
apiRouter.post('/auth/login', loginUser);

// 📅 Dispatch & Booking Allocation Engine
apiRouter.post('/bookings', createBooking);
apiRouter.get('/bookings/:id', getBookingById);
apiRouter.post('/bookings/finalize-invoice', authenticateToken, finalizeJobInvoice);

// 💳 Secure Tokenized Payment Gateway Engine
apiRouter.use('/payments', paymentRoutes);

// 🧾 Tax Compliance Invoice Operations
apiRouter.get('/invoices', authenticateToken, getInvoicesByUser);         // Fetches account specific invoice rows
apiRouter.get('/invoices/:id/download', authenticateToken, downloadInvoicePDF);     // Serves or constructs physical PDF buffers

// 🏦 Digital Clearing Wallet Balance Operations
apiRouter.get('/wallet', authenticateToken, getWalletBalance);                     // Balances data array fetch
apiRouter.post('/wallet/cashout', authenticateToken, requestWalletCashout);         // Dispatches outbound EFT instructions

export default apiRouter;
