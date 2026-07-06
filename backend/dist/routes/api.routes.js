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
const quote_controller_1 = require("../controllers/quote.controller");
const technician_controller_1 = require("../controllers/technician.controller");
const admin_controller_1 = require("../controllers/admin.controller");
const waitlist_controller_1 = require("../controllers/waitlist.controller");
const managed_collection_controller_1 = require("../controllers/managed-collection.controller");
const notification_controller_1 = require("../controllers/notification.controller");
const managed_collection_subscription_controller_1 = require("../controllers/managed-collection-subscription.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const user_model_1 = require("../models/user.model");
// Import the secure PCI-compliant payment gateway endpoints
const payment_routes_1 = __importDefault(require("./payment.routes"));
const apiRouter = (0, express_1.Router)();
// 🔐 Authentication Matrix Endpoints
apiRouter.post('/auth/register', auth_controller_1.registerUser);
apiRouter.post('/auth/register-technician', auth_controller_1.registerTechnician);
apiRouter.post('/auth/bootstrap-admin', auth_controller_1.bootstrapAdmin);
apiRouter.post('/auth/login', auth_controller_1.loginUser);
apiRouter.post('/auth/forgot-password', auth_controller_1.forgotPassword);
apiRouter.post('/auth/reset-password', auth_controller_1.resetPassword);
apiRouter.get('/markets', admin_controller_1.getPublicMarkets);
apiRouter.get('/markets/public', admin_controller_1.getPublicMarkets);
apiRouter.get('/markets/:country/availability', admin_controller_1.getPublicMarketAvailability);
apiRouter.post('/waitlist/service', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.CUSTOMER, user_model_1.UserRole.ADMIN]), waitlist_controller_1.joinServiceWaitlist);
apiRouter.post('/managed-collections', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.CUSTOMER, user_model_1.UserRole.ADMIN]), managed_collection_controller_1.createManagedCollectionProfile);
apiRouter.get('/notifications', auth_middleware_1.authenticateToken, notification_controller_1.getMyNotifications);
apiRouter.patch('/notifications/:id', auth_middleware_1.authenticateToken, notification_controller_1.updateMyNotification);
apiRouter.get('/notification-preferences', auth_middleware_1.authenticateToken, notification_controller_1.getMyNotificationPreferences);
apiRouter.patch('/notification-preferences', auth_middleware_1.authenticateToken, notification_controller_1.updateMyNotificationPreferences);
apiRouter.get('/profile/me', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.CUSTOMER, user_model_1.UserRole.ADMIN]), auth_controller_1.getMyProfile);
apiRouter.patch('/profile/default-address', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.CUSTOMER, user_model_1.UserRole.ADMIN]), auth_controller_1.updateMyDefaultAddress);
apiRouter.get('/managed-collection-plans', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.CUSTOMER, user_model_1.UserRole.ADMIN]), managed_collection_subscription_controller_1.listPublicSubscriptionPlans);
apiRouter.get('/managed-collection-subscriptions/me', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.CUSTOMER, user_model_1.UserRole.ADMIN]), managed_collection_subscription_controller_1.getMyManagedCollectionSubscriptionDashboard);
apiRouter.post('/managed-collection-subscriptions', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.CUSTOMER, user_model_1.UserRole.ADMIN]), managed_collection_subscription_controller_1.createManagedCollectionSubscription);
apiRouter.patch('/managed-collection-subscriptions/:id', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.CUSTOMER, user_model_1.UserRole.ADMIN]), managed_collection_subscription_controller_1.updateManagedCollectionSubscription);
// 📅 Dispatch & Booking Allocation Engine
apiRouter.post('/bookings/finalize-invoice', auth_middleware_1.authenticateToken, booking_controller_1.finalizeJobInvoice);
apiRouter.get('/bookings/active/current', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.CUSTOMER, user_model_1.UserRole.ADMIN]), booking_controller_1.getMyActiveBooking);
apiRouter.get('/bookings/history/me', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.CUSTOMER, user_model_1.UserRole.ADMIN]), booking_controller_1.getMyBookingHistory);
apiRouter.post('/bookings', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.CUSTOMER, user_model_1.UserRole.ADMIN]), booking_controller_1.createBooking);
apiRouter.post('/bookings/:id/accept', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.TECHNICIAN, user_model_1.UserRole.ADMIN]), booking_controller_1.acceptBooking);
apiRouter.post('/bookings/:id/decline', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.TECHNICIAN]), booking_controller_1.declineBooking);
apiRouter.patch('/bookings/:id/status', auth_middleware_1.authenticateToken, booking_controller_1.updateBookingStatus);
apiRouter.get('/bookings/:id', auth_middleware_1.authenticateToken, booking_controller_1.getBookingById);
apiRouter.post('/bookings/:bookingId/quotes', auth_middleware_1.authenticateToken, quote_controller_1.createJobQuote);
apiRouter.get('/bookings/:bookingId/quotes', auth_middleware_1.authenticateToken, quote_controller_1.getBookingQuotes);
apiRouter.post('/quotes/:quoteId/approve', auth_middleware_1.authenticateToken, quote_controller_1.approveJobQuote);
apiRouter.post('/quotes/:quoteId/reject', auth_middleware_1.authenticateToken, quote_controller_1.rejectJobQuote);
apiRouter.get('/technician/available-jobs', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.TECHNICIAN]), technician_controller_1.getAvailableJobsForTechnician);
apiRouter.get('/admin/technicians', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.ADMIN]), (0, auth_middleware_1.requireAdminPermission)(user_model_1.AdminPermission.TECHNICIANS_READ), technician_controller_1.listTechnicianApplications);
apiRouter.patch('/admin/technicians/:id/review', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.ADMIN]), (0, auth_middleware_1.requireAdminPermission)(user_model_1.AdminPermission.TECHNICIANS_REVIEW), technician_controller_1.reviewTechnicianApplication);
apiRouter.put('/admin/capabilities/:capabilityId/status', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.ADMIN]), (0, auth_middleware_1.requireAdminPermission)(user_model_1.AdminPermission.TECHNICIANS_REVIEW), admin_controller_1.updateTechnicianCapabilityStatus);
apiRouter.get('/admin/overview', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.ADMIN]), (0, auth_middleware_1.requireAdminPermission)(user_model_1.AdminPermission.OVERVIEW_READ), admin_controller_1.getAdminOverview);
apiRouter.get('/admin/bookings', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.ADMIN]), (0, auth_middleware_1.requireAdminPermission)(user_model_1.AdminPermission.BOOKINGS_READ), admin_controller_1.getAdminBookings);
apiRouter.get('/admin/bookings/:id', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.ADMIN]), (0, auth_middleware_1.requireAdminPermission)(user_model_1.AdminPermission.BOOKINGS_READ), admin_controller_1.getAdminBookingById);
apiRouter.get('/admin/managed-collections', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.ADMIN]), (0, auth_middleware_1.requireAdminPermission)(user_model_1.AdminPermission.BOOKINGS_READ), managed_collection_controller_1.listAdminManagedCollections);
apiRouter.get('/admin/collection-operations', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.ADMIN]), (0, auth_middleware_1.requireAdminPermission)(user_model_1.AdminPermission.BOOKINGS_READ), managed_collection_controller_1.listAdminCollectionOperations);
apiRouter.get('/admin/managed-collections/:id', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.ADMIN]), (0, auth_middleware_1.requireAdminPermission)(user_model_1.AdminPermission.BOOKINGS_READ), managed_collection_controller_1.getAdminCollectionProfile);
apiRouter.patch('/admin/collection-jobs/:id', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.ADMIN]), (0, auth_middleware_1.requireAdminPermission)(user_model_1.AdminPermission.BOOKINGS_UPDATE), managed_collection_controller_1.updateManagedCollectionJob);
apiRouter.patch('/admin/managed-collection-reminders/:id', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.ADMIN]), (0, auth_middleware_1.requireAdminPermission)(user_model_1.AdminPermission.BOOKINGS_UPDATE), managed_collection_controller_1.updateManagedCollectionReminder);
apiRouter.get('/admin/quotes', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.ADMIN]), (0, auth_middleware_1.requireAdminPermission)(user_model_1.AdminPermission.BOOKINGS_READ), admin_controller_1.getAdminQuotes);
apiRouter.get('/admin/invoices', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.ADMIN]), (0, auth_middleware_1.requireAdminPermission)(user_model_1.AdminPermission.FINANCE_READ), admin_controller_1.getAdminInvoices);
apiRouter.get('/admin/wallet-transactions', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.ADMIN]), (0, auth_middleware_1.requireAdminPermission)(user_model_1.AdminPermission.FINANCE_READ), admin_controller_1.getAdminWalletTransactions);
apiRouter.get('/admin/markets', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.ADMIN]), (0, auth_middleware_1.requireAdminPermission)(user_model_1.AdminPermission.MARKETS_READ), admin_controller_1.getAdminMarkets);
apiRouter.patch('/admin/markets/:countryCode', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.ADMIN]), (0, auth_middleware_1.requireAdminPermission)(user_model_1.AdminPermission.MARKETS_UPDATE), admin_controller_1.updateAdminMarket);
apiRouter.get('/admin/users', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.ADMIN]), (0, auth_middleware_1.requireAdminPermission)(user_model_1.AdminPermission.ADMINS_READ), admin_controller_1.listAdminUsers);
apiRouter.post('/admin/users', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.ADMIN]), (0, auth_middleware_1.requireAdminPermission)(user_model_1.AdminPermission.ADMINS_CREATE), admin_controller_1.createAdminUser);
apiRouter.patch('/admin/users/:id', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.ADMIN]), (0, auth_middleware_1.requireAdminPermission)(user_model_1.AdminPermission.ADMINS_UPDATE), admin_controller_1.updateAdminUser);
apiRouter.get('/admin/audit-logs', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.ADMIN]), (0, auth_middleware_1.requireAdminPermission)(user_model_1.AdminPermission.ADMINS_READ), admin_controller_1.getAdminAuditLogs);
apiRouter.get('/admin/notifications', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.ADMIN]), (0, auth_middleware_1.requireAdminPermission)(user_model_1.AdminPermission.BOOKINGS_READ), notification_controller_1.listAdminNotifications);
apiRouter.post('/admin/notifications/process-due', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.ADMIN]), (0, auth_middleware_1.requireAdminPermission)(user_model_1.AdminPermission.BOOKINGS_UPDATE), notification_controller_1.processAdminNotifications);
apiRouter.post('/admin/notifications/:id/retry', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.ADMIN]), (0, auth_middleware_1.requireAdminPermission)(user_model_1.AdminPermission.BOOKINGS_UPDATE), notification_controller_1.retryAdminNotification);
apiRouter.post('/admin/notifications/:id/cancel', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.ADMIN]), (0, auth_middleware_1.requireAdminPermission)(user_model_1.AdminPermission.BOOKINGS_UPDATE), notification_controller_1.cancelAdminNotification);
apiRouter.get('/admin/managed-collection-subscriptions', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.ADMIN]), (0, auth_middleware_1.requireAdminPermission)(user_model_1.AdminPermission.FINANCE_READ), managed_collection_subscription_controller_1.listAdminManagedCollectionSubscriptions);
apiRouter.post('/admin/managed-collection-subscriptions/generate-invoices', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.ADMIN]), (0, auth_middleware_1.requireAdminPermission)(user_model_1.AdminPermission.FINANCE_READ), managed_collection_subscription_controller_1.generateManagedCollectionSubscriptionInvoices);
apiRouter.post('/admin/managed-collection-subscription-plans', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.ADMIN]), (0, auth_middleware_1.requireAdminPermission)(user_model_1.AdminPermission.MARKETS_UPDATE), managed_collection_subscription_controller_1.createAdminSubscriptionPlan);
apiRouter.patch('/admin/managed-collection-subscription-plans/:id', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.ADMIN]), (0, auth_middleware_1.requireAdminPermission)(user_model_1.AdminPermission.MARKETS_UPDATE), managed_collection_subscription_controller_1.updateAdminSubscriptionPlan);
// 💳 Secure Tokenized Payment Gateway Engine
apiRouter.use('/payments', payment_routes_1.default);
// 🧾 Tax Compliance Invoice Operations
apiRouter.get('/invoices', auth_middleware_1.authenticateToken, invoice_controller_1.getInvoicesByUser); // Fetches account specific invoice rows
apiRouter.get('/invoices/:id/download', auth_middleware_1.authenticateToken, invoice_controller_1.downloadInvoicePDF); // Serves or constructs physical PDF buffers
// 🏦 Digital Clearing Wallet Balance Operations
apiRouter.get('/wallet', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.TECHNICIAN, user_model_1.UserRole.ADMIN]), wallet_controller_1.getWalletBalance); // Balances data array fetch
apiRouter.get('/wallet/transactions', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.TECHNICIAN, user_model_1.UserRole.ADMIN]), wallet_controller_1.getWalletTransactions);
apiRouter.post('/wallet/cashout', auth_middleware_1.authenticateToken, (0, auth_middleware_1.requireRole)([user_model_1.UserRole.TECHNICIAN, user_model_1.UserRole.ADMIN]), wallet_controller_1.requestWalletCashout); // Dispatches outbound EFT instructions
exports.default = apiRouter;
//# sourceMappingURL=api.routes.js.map