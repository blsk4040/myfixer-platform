"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/payment.routes.ts
const express_1 = require("express");
const payment_controller_1 = require("../controllers/payment.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
const paymentHandler = (handler) => handler;
// Protect the entire payment domain space under JWT validations
router.use(auth_middleware_1.authenticateToken);
router.get('/cards', paymentHandler(payment_controller_1.PaymentController.getCards));
router.post('/save-card', paymentHandler(payment_controller_1.PaymentController.saveCard));
router.post('/charge-saved-card', paymentHandler(payment_controller_1.PaymentController.chargeSavedCard));
router.patch('/default/:id', paymentHandler(payment_controller_1.PaymentController.setDefaultCard));
router.delete('/cards/:id', paymentHandler(payment_controller_1.PaymentController.deleteCard));
exports.default = router;
//# sourceMappingURL=payment.routes.js.map