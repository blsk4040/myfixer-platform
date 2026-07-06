// src/routes/payment.routes.ts
import { RequestHandler, Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { UserRole } from '../models/user.model';

const router = Router();
const paymentHandler = (handler: typeof PaymentController.getCards): RequestHandler => handler as RequestHandler;

// Protect the entire payment domain space under JWT validations
router.use(authenticateToken);

router.get('/cards', requireRole([UserRole.CUSTOMER, UserRole.ADMIN]), paymentHandler(PaymentController.getCards));
router.post('/save-card', requireRole([UserRole.CUSTOMER, UserRole.ADMIN]), paymentHandler(PaymentController.saveCard));
router.post('/charge-saved-card', requireRole([UserRole.CUSTOMER, UserRole.ADMIN]), paymentHandler(PaymentController.chargeSavedCard));
router.patch('/default/:id', requireRole([UserRole.CUSTOMER, UserRole.ADMIN]), paymentHandler(PaymentController.setDefaultCard));
router.delete('/cards/:id', requireRole([UserRole.CUSTOMER, UserRole.ADMIN]), paymentHandler(PaymentController.deleteCard));

export default router;
