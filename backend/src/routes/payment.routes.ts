// src/routes/payment.routes.ts
import { RequestHandler, Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { paymentRateLimiter } from '../middleware/rate-limit.middleware';
import { UserRole } from '../models/user.model';

const router = Router();
const paymentHandler = (handler: typeof PaymentController.getCards): RequestHandler => handler as RequestHandler;

router.post('/webhooks/paystack', paymentHandler(PaymentController.handlePaystackWebhook as any));

// Protect the rest of the payment domain space under JWT validations
router.use(authenticateToken);

router.post('/initialize', paymentRateLimiter, requireRole([UserRole.CUSTOMER, UserRole.ADMIN]), paymentHandler(PaymentController.initializePayment as any));
router.get('/booking/:bookingId/status', requireRole([UserRole.CUSTOMER, UserRole.TECHNICIAN, UserRole.ADMIN]), paymentHandler(PaymentController.getPaymentStatus as any));
router.get('/cards', requireRole([UserRole.CUSTOMER, UserRole.ADMIN]), paymentHandler(PaymentController.getCards));
router.post('/save-card', paymentRateLimiter, requireRole([UserRole.CUSTOMER, UserRole.ADMIN]), paymentHandler(PaymentController.saveCard));
router.post('/charge-saved-card', paymentRateLimiter, requireRole([UserRole.CUSTOMER, UserRole.ADMIN]), paymentHandler(PaymentController.chargeSavedCard));
router.patch('/default/:id', paymentRateLimiter, requireRole([UserRole.CUSTOMER, UserRole.ADMIN]), paymentHandler(PaymentController.setDefaultCard));
router.delete('/cards/:id', paymentRateLimiter, requireRole([UserRole.CUSTOMER, UserRole.ADMIN]), paymentHandler(PaymentController.deleteCard));

export default router;
