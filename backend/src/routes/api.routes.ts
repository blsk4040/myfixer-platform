// c:/myfixer-platform/backend/src/routes/api.routes.ts
import { Router } from 'express';
import {
  acceptBooking,
  confirmArrival,
  createBooking,
  declineBooking,
  finalizeJobInvoice,
  getMyActiveBooking,
  getMyBookingHistory,
  getBookingById,
  completeInspection,
  startJob,
  startInspection,
  startRoute,
  updateBookingStatus,
} from '../controllers/booking.controller';
import {
  bootstrapAdmin,
  completeGoogleClientProfile,
  forgotPassword,
  getMyProfile,
  googleAuth,
  loginUser,
  registerTechnician,
  registerUser,
  resetPassword,
  updateMyDefaultAddress,
  verifyEmail,
} from '../controllers/auth.controller'; 
import { getInvoicesByUser, downloadInvoicePDF } from '../controllers/invoice.controller';
import { getWalletBalance, getWalletTransactions, requestWalletCashout } from '../controllers/wallet.controller';
import {
  addBankPayoutMethod,
  addMobileMoneyPayoutMethod,
  deletePayoutMethod,
  getMyPayoutMethods,
  makeDefaultPayoutMethod,
} from '../controllers/payout-method.controller';
import {
  approveAdminSettlement,
  confirmCompletion,
  getAdminSettlements,
  getTechnicianSettlements,
  holdAdminSettlement,
  releaseAdminSettlementHold,
  reportCompletionIssueController,
  retryAdminSettlementPayout,
  submitCompletion,
} from '../controllers/settlement.controller';
import {
  approveJobQuote,
  createJobQuote,
  getBookingQuotes,
  requestQuoteClarification,
  rejectJobQuote,
  submitJobQuote,
} from '../controllers/quote.controller';
import {
  getBookingMessages,
  sendBookingMessage,
  uploadBookingMedia,
} from '../controllers/booking-chat.controller';
import {
  getAvailableJobsForTechnician,
  listTechnicianApplications,
  reviewTechnicianProfilePhoto,
  reviewTechnicianApplication,
  uploadMyTechnicianProfilePhoto,
} from '../controllers/technician.controller';
import {
  getAdminBookingById,
  getAdminBookings,
  createAdminUser,
  getAdminAuditLogs,
  getAdminInvoices,
  getAdminMarkets,
  getAdminOverview,
  getAdminQuotes,
  getAdminWalletTransactions,
  getPublicMarketAvailability,
  getPublicMarkets,
  listAdminUsers,
  updateTechnicianCapabilityStatus,
  updateAdminMarket,
  updateAdminUser,
} from '../controllers/admin.controller';
import { joinServiceWaitlist } from '../controllers/waitlist.controller';
import {
  createManagedCollectionProfile,
  getAdminCollectionProfile,
  listAdminCollectionOperations,
  listAdminManagedCollections,
  updateManagedCollectionJob,
  updateManagedCollectionReminder,
} from '../controllers/managed-collection.controller';
import {
  cancelAdminNotification,
  getMyNotificationPreferences,
  getMyNotifications,
  listAdminNotifications,
  processAdminNotifications,
  retryAdminNotification,
  updateMyNotification,
  updateMyNotificationPreferences,
} from '../controllers/notification.controller';
import {
  registerPushToken,
  unregisterPushToken,
} from '../controllers/push-token.controller';
import {
  createAdminSubscriptionPlan,
  createManagedCollectionSubscription,
  generateManagedCollectionSubscriptionInvoices,
  getMyManagedCollectionSubscriptionDashboard,
  listAdminManagedCollectionSubscriptions,
  listPublicSubscriptionPlans,
  updateAdminSubscriptionPlan,
  updateManagedCollectionSubscription,
} from '../controllers/managed-collection-subscription.controller';
import { authenticateToken, requireAdminPermission, requireRole } from '../middleware/auth.middleware';
import { AdminPermission, UserRole } from '../models/user.model';

// Import the secure PCI-compliant payment gateway endpoints
import paymentRoutes from './payment.routes';
import routingRoutes from '../modules/routing/routing.routes';

const apiRouter = Router();

// 🔐 Authentication Matrix Endpoints
apiRouter.post('/auth/register', registerUser);
apiRouter.post('/auth/register-technician', registerTechnician);
apiRouter.post('/auth/bootstrap-admin', bootstrapAdmin);
apiRouter.post('/auth/login', loginUser);
apiRouter.post('/auth/google', googleAuth);
apiRouter.post('/auth/google/complete-profile', completeGoogleClientProfile);
apiRouter.get('/auth/verify-email', verifyEmail);
apiRouter.post('/auth/verify-email', verifyEmail);
apiRouter.post('/auth/forgot-password', forgotPassword);
apiRouter.post('/auth/reset-password', resetPassword);

apiRouter.get('/markets', getPublicMarkets);
apiRouter.get('/markets/public', getPublicMarkets);
apiRouter.get('/markets/:country/availability', getPublicMarketAvailability);
apiRouter.post('/waitlist/service', authenticateToken, requireRole([UserRole.CUSTOMER, UserRole.ADMIN]), joinServiceWaitlist);
apiRouter.post('/managed-collections', authenticateToken, requireRole([UserRole.CUSTOMER, UserRole.ADMIN]), createManagedCollectionProfile);
apiRouter.get('/notifications', authenticateToken, getMyNotifications);
apiRouter.patch('/notifications/:id', authenticateToken, updateMyNotification);
apiRouter.get('/notification-preferences', authenticateToken, getMyNotificationPreferences);
apiRouter.patch('/notification-preferences', authenticateToken, updateMyNotificationPreferences);
apiRouter.post('/push-tokens', authenticateToken, registerPushToken);
apiRouter.delete('/push-tokens', authenticateToken, unregisterPushToken);
apiRouter.post('/technician/profile-photo', authenticateToken, requireRole([UserRole.TECHNICIAN]), uploadMyTechnicianProfilePhoto);
apiRouter.get('/profile/me', authenticateToken, requireRole([UserRole.CUSTOMER, UserRole.ADMIN]), getMyProfile);
apiRouter.patch('/profile/default-address', authenticateToken, requireRole([UserRole.CUSTOMER, UserRole.ADMIN]), updateMyDefaultAddress);
apiRouter.get('/managed-collection-plans', authenticateToken, requireRole([UserRole.CUSTOMER, UserRole.ADMIN]), listPublicSubscriptionPlans);
apiRouter.get('/managed-collection-subscriptions/me', authenticateToken, requireRole([UserRole.CUSTOMER, UserRole.ADMIN]), getMyManagedCollectionSubscriptionDashboard);
apiRouter.post('/managed-collection-subscriptions', authenticateToken, requireRole([UserRole.CUSTOMER, UserRole.ADMIN]), createManagedCollectionSubscription);
apiRouter.patch('/managed-collection-subscriptions/:id', authenticateToken, requireRole([UserRole.CUSTOMER, UserRole.ADMIN]), updateManagedCollectionSubscription);

// 📅 Dispatch & Booking Allocation Engine
apiRouter.post('/bookings/finalize-invoice', authenticateToken, finalizeJobInvoice);
apiRouter.get('/bookings/active/current', authenticateToken, requireRole([UserRole.CUSTOMER, UserRole.ADMIN]), getMyActiveBooking);
apiRouter.get('/bookings/history/me', authenticateToken, requireRole([UserRole.CUSTOMER, UserRole.ADMIN]), getMyBookingHistory);
apiRouter.post('/bookings', authenticateToken, requireRole([UserRole.CUSTOMER, UserRole.ADMIN]), createBooking);
apiRouter.post('/bookings/:id/accept', authenticateToken, requireRole([UserRole.TECHNICIAN, UserRole.ADMIN]), acceptBooking);
apiRouter.post('/bookings/:id/decline', authenticateToken, requireRole([UserRole.TECHNICIAN]), declineBooking);
apiRouter.post('/bookings/:id/start-route', authenticateToken, requireRole([UserRole.TECHNICIAN, UserRole.ADMIN]), startRoute);
apiRouter.post('/bookings/:bookingId/arrival', authenticateToken, requireRole([UserRole.TECHNICIAN, UserRole.ADMIN]), confirmArrival);
apiRouter.post('/bookings/:bookingId/start-inspection', authenticateToken, requireRole([UserRole.TECHNICIAN, UserRole.ADMIN]), startInspection);
apiRouter.post('/bookings/:bookingId/complete-inspection', authenticateToken, requireRole([UserRole.TECHNICIAN, UserRole.ADMIN]), completeInspection);
apiRouter.post('/bookings/:id/start-job', authenticateToken, requireRole([UserRole.TECHNICIAN, UserRole.ADMIN]), startJob);
apiRouter.post('/bookings/:bookingId/submit-completion', authenticateToken, requireRole([UserRole.TECHNICIAN, UserRole.ADMIN]), submitCompletion);
apiRouter.post('/bookings/:bookingId/confirm-completion', authenticateToken, requireRole([UserRole.CUSTOMER, UserRole.ADMIN]), confirmCompletion);
apiRouter.post('/bookings/:bookingId/report-completion-issue', authenticateToken, requireRole([UserRole.CUSTOMER, UserRole.ADMIN]), reportCompletionIssueController);
apiRouter.patch('/bookings/:id/status', authenticateToken, updateBookingStatus);
apiRouter.get('/bookings/:id', authenticateToken, getBookingById);
apiRouter.post('/bookings/:bookingId/media', authenticateToken, uploadBookingMedia);
apiRouter.get('/bookings/:bookingId/messages', authenticateToken, getBookingMessages);
apiRouter.post('/bookings/:bookingId/messages', authenticateToken, sendBookingMessage);

apiRouter.post('/bookings/:bookingId/quotes', authenticateToken, createJobQuote);
apiRouter.get('/bookings/:bookingId/quotes', authenticateToken, getBookingQuotes);
apiRouter.post('/quotes/:quoteId/submit', authenticateToken, requireRole([UserRole.TECHNICIAN, UserRole.ADMIN]), submitJobQuote);
apiRouter.post('/quotes/:quoteId/approve', authenticateToken, approveJobQuote);
apiRouter.post('/quotes/:quoteId/reject', authenticateToken, rejectJobQuote);
apiRouter.post('/quotes/:quoteId/request-clarification', authenticateToken, requestQuoteClarification);
apiRouter.get('/technician/available-jobs', authenticateToken, requireRole([UserRole.TECHNICIAN]), getAvailableJobsForTechnician);

apiRouter.get('/admin/technicians', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.TECHNICIANS_READ), listTechnicianApplications);
apiRouter.patch('/admin/technicians/:id/review', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.TECHNICIANS_REVIEW), reviewTechnicianApplication);
apiRouter.patch('/admin/technicians/:id/profile-photo', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.TECHNICIANS_REVIEW), reviewTechnicianProfilePhoto);
apiRouter.put('/admin/capabilities/:capabilityId/status', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.TECHNICIANS_REVIEW), updateTechnicianCapabilityStatus);
apiRouter.get('/admin/overview', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.OVERVIEW_READ), getAdminOverview);
apiRouter.get('/admin/bookings', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.BOOKINGS_READ), getAdminBookings);
apiRouter.get('/admin/bookings/:id', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.BOOKINGS_READ), getAdminBookingById);
apiRouter.get('/admin/managed-collections', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.BOOKINGS_READ), listAdminManagedCollections);
apiRouter.get('/admin/collection-operations', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.BOOKINGS_READ), listAdminCollectionOperations);
apiRouter.get('/admin/managed-collections/:id', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.BOOKINGS_READ), getAdminCollectionProfile);
apiRouter.patch('/admin/collection-jobs/:id', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.BOOKINGS_UPDATE), updateManagedCollectionJob);
apiRouter.patch('/admin/managed-collection-reminders/:id', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.BOOKINGS_UPDATE), updateManagedCollectionReminder);
apiRouter.get('/admin/quotes', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.BOOKINGS_READ), getAdminQuotes);
apiRouter.get('/admin/invoices', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.FINANCE_READ), getAdminInvoices);
apiRouter.get('/admin/wallet-transactions', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.FINANCE_READ), getAdminWalletTransactions);
apiRouter.get('/admin/settlements', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.FINANCE_READ), getAdminSettlements);
apiRouter.post('/admin/settlements/:settlementId/approve', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.FINANCE_READ), approveAdminSettlement);
apiRouter.post('/admin/settlements/:id/hold', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.FINANCE_READ), holdAdminSettlement);
apiRouter.post('/admin/settlements/:id/release-hold', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.FINANCE_READ), releaseAdminSettlementHold);
apiRouter.post('/admin/settlements/:id/retry-payout', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.FINANCE_READ), retryAdminSettlementPayout);
apiRouter.get('/admin/markets', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.MARKETS_READ), getAdminMarkets);
apiRouter.patch('/admin/markets/:countryCode', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.MARKETS_UPDATE), updateAdminMarket);
apiRouter.get('/admin/users', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.ADMINS_READ), listAdminUsers);
apiRouter.post('/admin/users', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.ADMINS_CREATE), createAdminUser);
apiRouter.patch('/admin/users/:id', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.ADMINS_UPDATE), updateAdminUser);
apiRouter.get('/admin/audit-logs', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.ADMINS_READ), getAdminAuditLogs);
apiRouter.get('/admin/notifications', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.BOOKINGS_READ), listAdminNotifications);
apiRouter.post('/admin/notifications/process-due', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.BOOKINGS_UPDATE), processAdminNotifications);
apiRouter.post('/admin/notifications/:id/retry', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.BOOKINGS_UPDATE), retryAdminNotification);
apiRouter.post('/admin/notifications/:id/cancel', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.BOOKINGS_UPDATE), cancelAdminNotification);
apiRouter.get('/admin/managed-collection-subscriptions', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.FINANCE_READ), listAdminManagedCollectionSubscriptions);
apiRouter.post('/admin/managed-collection-subscriptions/generate-invoices', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.FINANCE_READ), generateManagedCollectionSubscriptionInvoices);
apiRouter.post('/admin/managed-collection-subscription-plans', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.MARKETS_UPDATE), createAdminSubscriptionPlan);
apiRouter.patch('/admin/managed-collection-subscription-plans/:id', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.MARKETS_UPDATE), updateAdminSubscriptionPlan);

// 💳 Secure Tokenized Payment Gateway Engine
apiRouter.use('/payments', paymentRoutes);
apiRouter.use('/routing', routingRoutes);

// 🧾 Tax Compliance Invoice Operations
apiRouter.get('/invoices', authenticateToken, getInvoicesByUser);         // Fetches account specific invoice rows
apiRouter.get('/invoices/:id/download', authenticateToken, downloadInvoicePDF);     // Serves or constructs physical PDF buffers

// 🏦 Digital Clearing Wallet Balance Operations
apiRouter.get('/wallet', authenticateToken, requireRole([UserRole.TECHNICIAN, UserRole.ADMIN]), getWalletBalance);                     // Balances data array fetch
apiRouter.get('/wallet/transactions', authenticateToken, requireRole([UserRole.TECHNICIAN, UserRole.ADMIN]), getWalletTransactions);
apiRouter.post('/wallet/cashout', authenticateToken, requireRole([UserRole.TECHNICIAN, UserRole.ADMIN]), requestWalletCashout);         // Dispatches outbound EFT instructions
apiRouter.get('/technicians/me/payout-methods', authenticateToken, requireRole([UserRole.TECHNICIAN]), getMyPayoutMethods);
apiRouter.post('/technicians/me/payout-methods/bank-account', authenticateToken, requireRole([UserRole.TECHNICIAN]), addBankPayoutMethod);
apiRouter.post('/technicians/me/payout-methods/mobile-money', authenticateToken, requireRole([UserRole.TECHNICIAN]), addMobileMoneyPayoutMethod);
apiRouter.patch('/technicians/me/payout-methods/:id/default', authenticateToken, requireRole([UserRole.TECHNICIAN]), makeDefaultPayoutMethod);
apiRouter.delete('/technicians/me/payout-methods/:id', authenticateToken, requireRole([UserRole.TECHNICIAN]), deletePayoutMethod);
apiRouter.get('/technicians/me/settlements', authenticateToken, requireRole([UserRole.TECHNICIAN]), getTechnicianSettlements);

export default apiRouter;
