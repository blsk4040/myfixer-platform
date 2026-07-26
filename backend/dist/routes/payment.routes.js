"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/payment.routes.ts
const express_1 = require("express");
const payment_controller_1 = require("../controllers/payment.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rate_limit_middleware_1 = require("../middleware/rate-limit.middleware");
const user_model_1 = require("../models/user.model");
const router = (0, express_1.Router)();
const paymentHandler = (handler) => handler;
router.post('/webhooks/paystack', paymentHandler(payment_controller_1.PaymentController.handlePaystackWebhook));
// Protect the rest of the payment domain space under JWT validations
router.use(auth_middleware_1.authenticateToken);
router.post('/initialize', rate_limit_middleware_1.paymentRateLimiter, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.CUSTOMER, user_model_1.UserRole.ADMIN]), paymentHandler(payment_controller_1.PaymentController.initializePayment));
router.get('/booking/:bookingId/status', (0, auth_middleware_1.requireRole)([user_model_1.UserRole.CUSTOMER, user_model_1.UserRole.TECHNICIAN, user_model_1.UserRole.ADMIN]), paymentHandler(payment_controller_1.PaymentController.getPaymentStatus));
router.get('/cards', (0, auth_middleware_1.requireRole)([user_model_1.UserRole.CUSTOMER, user_model_1.UserRole.ADMIN]), paymentHandler(payment_controller_1.PaymentController.getCards));
router.post('/save-card', rate_limit_middleware_1.paymentRateLimiter, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.CUSTOMER, user_model_1.UserRole.ADMIN]), paymentHandler(payment_controller_1.PaymentController.saveCard));
router.post('/charge-saved-card', rate_limit_middleware_1.paymentRateLimiter, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.CUSTOMER, user_model_1.UserRole.ADMIN]), paymentHandler(payment_controller_1.PaymentController.chargeSavedCard));
router.patch('/default/:id', rate_limit_middleware_1.paymentRateLimiter, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.CUSTOMER, user_model_1.UserRole.ADMIN]), paymentHandler(payment_controller_1.PaymentController.setDefaultCard));
router.delete('/cards/:id', rate_limit_middleware_1.paymentRateLimiter, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.CUSTOMER, user_model_1.UserRole.ADMIN]), paymentHandler(payment_controller_1.PaymentController.deleteCard));
exports.default = router;
//# sourceMappingURL=payment.routes.js.map