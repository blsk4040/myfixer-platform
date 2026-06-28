// src/routes/payment.routes.ts
import { RequestHandler, Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const paymentHandler = (handler: typeof PaymentController.getCards): RequestHandler => handler as RequestHandler;

// Protect the entire payment domain space under JWT validations
router.use(authenticateToken);

router.get('/cards', paymentHandler(PaymentController.getCards));
router.post('/save-card', paymentHandler(PaymentController.saveCard));
router.post('/charge-saved-card', paymentHandler(PaymentController.chargeSavedCard));
router.patch('/default/:id', paymentHandler(PaymentController.setDefaultCard));
router.delete('/cards/:id', paymentHandler(PaymentController.deleteCard));

export default router;
