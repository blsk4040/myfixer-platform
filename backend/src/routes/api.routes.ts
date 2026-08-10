// c:/myfixer-platform/backend/src/routes/api.routes.ts
import { Router } from 'express';
import {
  acceptBooking,
  confirmArrival,
  createBooking,
  declineBooking,
  finalizeJobInvoice,
  getMyActiveBooking,
  getMyActiveBookings,
  getMyBookingHistory,
  getBookingReview,
  getBookingById,
  completeInspection,
  submitBookingReview,
  startJob,
  startInspection,
  startRoute,
  updateBookingStatus,
} from '../controllers/booking.controller';
import {
  bootstrapAdmin,
  changeOwnPassword,
  completeGoogleClientProfile,
  forgotPassword,
  getMySecuritySummary,
  getMyProfile,
  googleAuth,
  loginUser,
  registerTechnician,
  registerUser,
  resetPassword,
  signOutOtherSessions,
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
  getMyTechnicianJobs,
  listTechnicianApplications,
  reviewTechnicianProfilePhoto,
  reviewTechnicianApplication,
  uploadMyTechnicianProfilePhoto,
} from '../controllers/technician.controller';
import {
  getAdminBookingById,
  getAdminBookings,
  getAdminClients,
  clearAdminAuditLogs,
  activateAdminPromotion,
  archiveAdminPromotion,
  createAdminPromotion,
  createAdminService,
  createAdminUser,
  deleteAdminUser,
  createAdminMarketCity,
  createAdminMarketArea,
  deleteAdminBookableService,
  deleteAdminServiceCategory,
  deleteAdminServiceGroup,
  deleteAdminMarketCity,
  deleteAdminMarketArea,
  deleteAdminMarket,
  duplicateAdminPromotion,
  endAdminPromotion,
  getAdminAuditLogs,
  getAdminInvoices,
  getAdminGrowthTrust,
  getAdminMarkets,
  getAdminOverview,
  getAdminPromotionAudit,
  getAdminPromotionById,
  getAdminPromotionPerformance,
  getAdminPromotionRedemptions,
  getAdminPromotionsSummary,
  listAdminReferralRewards,
  getAdminServices,
  listAdminPromotions,
  getAdminQuotes,
  getAdminWalletTransactions,
  pauseAdminPromotion,
  getPublicMarketAvailability,
  getPublicMarkets,
  getPublicServices,
  listAdminUsers,
  previewAdminPricing,
  revealAdminClientContact,
  updateTechnicianCapabilityStatus,
  updateAdminMarket,
  updateAdminMarketCity,
  updateAdminMarketArea,
  updateAdminPromotion,
  updateAdminService,
  updateAdminServiceGroup,
  updateAdminUser,
  uploadAdminServiceImage,
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
  createAdminBroadcastNotification,
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
import { getAdminFinancialLedger } from '../controllers/financial-ledger.controller';
import {
  createAdminSupportMessage,
  createSupportTicket,
  createSupportTicketMessage,
  getSupportTicketMessages,
  listAdminSupportTickets,
  listMySupportTickets,
  updateAdminSupportTicket,
} from '../controllers/support.controller';
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
import {
  authRateLimiter,
  bookingWriteRateLimiter,
  bootstrapRateLimiter,
  mediaUploadRateLimiter,
  passwordResetRateLimiter,
  publicReadRateLimiter,
  supportRateLimiter,
} from '../middleware/rate-limit.middleware';
import { AdminPermission, UserRole } from '../models/user.model';
import { getMyProviderReferralProgram } from '../controllers/provider-referral.controller';
import { getMyCustomerReferralProgram } from '../controllers/customer-referral.controller';
import { getMyCustomerLoyaltyProgram } from '../controllers/customer-loyalty.controller';

// Import the secure PCI-compliant payment gateway endpoints
import paymentRoutes from './payment.routes';
import routingRoutes from '../modules/routing/routing.routes';

const apiRouter = Router();

// 🔐 Authentication Matrix Endpoints
apiRouter.post('/auth/register', authRateLimiter, registerUser);
apiRouter.post('/auth/register-technician', authRateLimiter, registerTechnician);
apiRouter.post('/auth/bootstrap-admin', bootstrapRateLimiter, bootstrapAdmin);
apiRouter.post('/auth/login', authRateLimiter, loginUser);
apiRouter.post('/auth/google', authRateLimiter, googleAuth);
apiRouter.post('/auth/google/complete-profile', authRateLimiter, completeGoogleClientProfile);
apiRouter.get('/auth/verify-email', verifyEmail);
apiRouter.post('/auth/verify-email', authRateLimiter, verifyEmail);
apiRouter.post('/auth/forgot-password', passwordResetRateLimiter, forgotPassword);
apiRouter.post('/auth/reset-password', passwordResetRateLimiter, resetPassword);
apiRouter.post('/auth/change-password', authenticateToken, changeOwnPassword);
apiRouter.get('/auth/security', authenticateToken, getMySecuritySummary);
apiRouter.post('/auth/sign-out-other-sessions', authenticateToken, signOutOtherSessions);

apiRouter.get('/markets', publicReadRateLimiter, getPublicMarkets);
apiRouter.get('/markets/public', publicReadRateLimiter, getPublicMarkets);
apiRouter.get('/markets/:country/availability', publicReadRateLimiter, getPublicMarketAvailability);
apiRouter.get('/services', publicReadRateLimiter, getPublicServices);
apiRouter.get('/services/published', publicReadRateLimiter, getPublicServices);
apiRouter.post('/waitlist/service', bookingWriteRateLimiter, authenticateToken, requireRole([UserRole.CUSTOMER, UserRole.ADMIN]), joinServiceWaitlist);
apiRouter.post('/managed-collections', authenticateToken, requireRole([UserRole.CUSTOMER, UserRole.ADMIN]), createManagedCollectionProfile);
apiRouter.get('/notifications', authenticateToken, getMyNotifications);
apiRouter.patch('/notifications/:id', authenticateToken, updateMyNotification);
apiRouter.get('/notification-preferences', authenticateToken, getMyNotificationPreferences);
apiRouter.patch('/notification-preferences', authenticateToken, updateMyNotificationPreferences);
apiRouter.post('/push-tokens', authenticateToken, registerPushToken);
apiRouter.delete('/push-tokens', authenticateToken, unregisterPushToken);
apiRouter.get('/support/tickets', authenticateToken, requireRole([UserRole.CUSTOMER, UserRole.TECHNICIAN]), listMySupportTickets);
apiRouter.post('/support/tickets', supportRateLimiter, authenticateToken, requireRole([UserRole.CUSTOMER, UserRole.TECHNICIAN]), createSupportTicket);
apiRouter.get('/support/tickets/:ticketId/messages', authenticateToken, requireRole([UserRole.CUSTOMER, UserRole.TECHNICIAN]), getSupportTicketMessages);
apiRouter.post('/support/tickets/:ticketId/messages', supportRateLimiter, authenticateToken, requireRole([UserRole.CUSTOMER, UserRole.TECHNICIAN]), createSupportTicketMessage);
apiRouter.post('/technician/profile-photo', mediaUploadRateLimiter, authenticateToken, requireRole([UserRole.TECHNICIAN]), uploadMyTechnicianProfilePhoto);
apiRouter.get('/profile/me', authenticateToken, requireRole([UserRole.CUSTOMER, UserRole.ADMIN]), getMyProfile);
apiRouter.patch('/profile/default-address', authenticateToken, requireRole([UserRole.CUSTOMER, UserRole.ADMIN]), updateMyDefaultAddress);
apiRouter.get('/managed-collection-plans', authenticateToken, requireRole([UserRole.CUSTOMER, UserRole.ADMIN]), listPublicSubscriptionPlans);
apiRouter.get('/managed-collection-subscriptions/me', authenticateToken, requireRole([UserRole.CUSTOMER, UserRole.ADMIN]), getMyManagedCollectionSubscriptionDashboard);
apiRouter.post('/managed-collection-subscriptions', authenticateToken, requireRole([UserRole.CUSTOMER, UserRole.ADMIN]), createManagedCollectionSubscription);
apiRouter.patch('/managed-collection-subscriptions/:id', authenticateToken, requireRole([UserRole.CUSTOMER, UserRole.ADMIN]), updateManagedCollectionSubscription);

// 📅 Dispatch & Booking Allocation Engine
apiRouter.post('/bookings/finalize-invoice', bookingWriteRateLimiter, authenticateToken, finalizeJobInvoice);
apiRouter.get('/bookings/active', authenticateToken, requireRole([UserRole.CUSTOMER, UserRole.ADMIN]), getMyActiveBookings);
apiRouter.get('/bookings/active/current', authenticateToken, requireRole([UserRole.CUSTOMER, UserRole.ADMIN]), getMyActiveBooking);
apiRouter.get('/bookings/history/me', authenticateToken, requireRole([UserRole.CUSTOMER, UserRole.ADMIN]), getMyBookingHistory);
apiRouter.get('/clients/me/referral', authenticateToken, requireRole([UserRole.CUSTOMER, UserRole.ADMIN]), getMyCustomerReferralProgram);
apiRouter.get('/clients/me/loyalty', authenticateToken, requireRole([UserRole.CUSTOMER, UserRole.ADMIN]), getMyCustomerLoyaltyProgram);
apiRouter.post('/bookings', bookingWriteRateLimiter, authenticateToken, requireRole([UserRole.CUSTOMER, UserRole.ADMIN]), createBooking);
apiRouter.get('/bookings/:bookingId/review', authenticateToken, requireRole([UserRole.CUSTOMER, UserRole.ADMIN]), getBookingReview);
apiRouter.post('/bookings/:bookingId/review', bookingWriteRateLimiter, authenticateToken, requireRole([UserRole.CUSTOMER, UserRole.ADMIN]), submitBookingReview);
apiRouter.post('/bookings/:id/accept', bookingWriteRateLimiter, authenticateToken, requireRole([UserRole.TECHNICIAN, UserRole.ADMIN]), acceptBooking);
apiRouter.post('/bookings/:id/decline', bookingWriteRateLimiter, authenticateToken, requireRole([UserRole.TECHNICIAN]), declineBooking);
apiRouter.post('/bookings/:id/start-route', bookingWriteRateLimiter, authenticateToken, requireRole([UserRole.TECHNICIAN, UserRole.ADMIN]), startRoute);
apiRouter.post('/bookings/:bookingId/arrival', bookingWriteRateLimiter, authenticateToken, requireRole([UserRole.TECHNICIAN, UserRole.ADMIN]), confirmArrival);
apiRouter.post('/bookings/:bookingId/start-inspection', bookingWriteRateLimiter, authenticateToken, requireRole([UserRole.TECHNICIAN, UserRole.ADMIN]), startInspection);
apiRouter.post('/bookings/:bookingId/complete-inspection', bookingWriteRateLimiter, authenticateToken, requireRole([UserRole.TECHNICIAN, UserRole.ADMIN]), completeInspection);
apiRouter.post('/bookings/:id/start-job', bookingWriteRateLimiter, authenticateToken, requireRole([UserRole.TECHNICIAN, UserRole.ADMIN]), startJob);
apiRouter.post('/bookings/:bookingId/submit-completion', bookingWriteRateLimiter, authenticateToken, requireRole([UserRole.TECHNICIAN, UserRole.ADMIN]), submitCompletion);
apiRouter.post('/bookings/:bookingId/confirm-completion', bookingWriteRateLimiter, authenticateToken, requireRole([UserRole.CUSTOMER, UserRole.ADMIN]), confirmCompletion);
apiRouter.post('/bookings/:bookingId/report-completion-issue', bookingWriteRateLimiter, authenticateToken, requireRole([UserRole.CUSTOMER, UserRole.ADMIN]), reportCompletionIssueController);
apiRouter.patch('/bookings/:id/status', bookingWriteRateLimiter, authenticateToken, updateBookingStatus);
apiRouter.get('/bookings/:id', authenticateToken, getBookingById);
apiRouter.post('/bookings/:bookingId/media', mediaUploadRateLimiter, authenticateToken, uploadBookingMedia);
apiRouter.get('/bookings/:bookingId/messages', authenticateToken, getBookingMessages);
apiRouter.post('/bookings/:bookingId/messages', supportRateLimiter, authenticateToken, sendBookingMessage);

apiRouter.post('/bookings/:bookingId/quotes', bookingWriteRateLimiter, authenticateToken, createJobQuote);
apiRouter.get('/bookings/:bookingId/quotes', authenticateToken, getBookingQuotes);
apiRouter.post('/quotes/:quoteId/submit', bookingWriteRateLimiter, authenticateToken, requireRole([UserRole.TECHNICIAN, UserRole.ADMIN]), submitJobQuote);
apiRouter.post('/quotes/:quoteId/approve', bookingWriteRateLimiter, authenticateToken, approveJobQuote);
apiRouter.post('/quotes/:quoteId/reject', bookingWriteRateLimiter, authenticateToken, rejectJobQuote);
apiRouter.post('/quotes/:quoteId/request-clarification', bookingWriteRateLimiter, authenticateToken, requestQuoteClarification);
apiRouter.get('/technician/available-jobs', authenticateToken, requireRole([UserRole.TECHNICIAN]), getAvailableJobsForTechnician);
apiRouter.get('/technician/jobs', authenticateToken, requireRole([UserRole.TECHNICIAN]), getMyTechnicianJobs);
apiRouter.get('/technicians/me/referral', authenticateToken, requireRole([UserRole.TECHNICIAN]), getMyProviderReferralProgram);

apiRouter.get('/admin/technicians', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.TECHNICIANS_READ), listTechnicianApplications);
apiRouter.patch('/admin/technicians/:id/review', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.TECHNICIANS_REVIEW), reviewTechnicianApplication);
apiRouter.patch('/admin/technicians/:id/profile-photo', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.TECHNICIANS_REVIEW), reviewTechnicianProfilePhoto);
apiRouter.put('/admin/capabilities/:capabilityId/status', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.TECHNICIANS_REVIEW), updateTechnicianCapabilityStatus);
apiRouter.get('/admin/overview', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.OVERVIEW_READ), getAdminOverview);
apiRouter.get('/admin/clients', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.OVERVIEW_READ), getAdminClients);
apiRouter.get('/admin/clients/:id/contact', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.CLIENTS_CONTACT_READ), revealAdminClientContact);
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
apiRouter.get('/admin/financial-ledger', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.FINANCE_READ), getAdminFinancialLedger);
apiRouter.get('/admin/promotions', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.PROMOTIONS_READ), listAdminPromotions);
apiRouter.get('/admin/promotions/summary', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.PROMOTIONS_PERFORMANCE_READ), getAdminPromotionsSummary);
apiRouter.get('/admin/referral-rewards', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.PROMOTIONS_PERFORMANCE_READ), listAdminReferralRewards);
apiRouter.get('/admin/growth-trust', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.PROMOTIONS_PERFORMANCE_READ), getAdminGrowthTrust);
apiRouter.post('/admin/promotions', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.PROMOTIONS_CREATE), createAdminPromotion);
apiRouter.get('/admin/promotions/:id', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.PROMOTIONS_READ), getAdminPromotionById);
apiRouter.get('/admin/promotions/:id/performance', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.PROMOTIONS_PERFORMANCE_READ), getAdminPromotionPerformance);
apiRouter.get('/admin/promotions/:id/redemptions', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.PROMOTIONS_REDEMPTIONS_READ), getAdminPromotionRedemptions);
apiRouter.get('/admin/promotions/:id/audit', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.ADMINS_READ), getAdminPromotionAudit);
apiRouter.post('/admin/promotions/:id/duplicate', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.PROMOTIONS_CREATE), duplicateAdminPromotion);
apiRouter.post('/admin/promotions/:id/activate', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.PROMOTIONS_ACTIVATE), activateAdminPromotion);
apiRouter.post('/admin/promotions/:id/pause', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.PROMOTIONS_PAUSE), pauseAdminPromotion);
apiRouter.post('/admin/promotions/:id/end', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.PROMOTIONS_ARCHIVE), endAdminPromotion);
apiRouter.post('/admin/promotions/:id/archive', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.PROMOTIONS_ARCHIVE), archiveAdminPromotion);
apiRouter.patch('/admin/promotions/:id', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.PROMOTIONS_UPDATE), updateAdminPromotion);
apiRouter.get('/admin/settlements', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.FINANCE_READ), getAdminSettlements);
apiRouter.post('/admin/settlements/:settlementId/approve', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.FINANCE_READ), approveAdminSettlement);
apiRouter.post('/admin/settlements/:id/hold', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.FINANCE_READ), holdAdminSettlement);
apiRouter.post('/admin/settlements/:id/release-hold', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.FINANCE_READ), releaseAdminSettlementHold);
apiRouter.post('/admin/settlements/:id/retry-payout', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.FINANCE_READ), retryAdminSettlementPayout);
apiRouter.get('/admin/markets', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.MARKETS_READ), getAdminMarkets);
apiRouter.patch('/admin/markets/:countryCode', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.MARKETS_UPDATE), updateAdminMarket);
apiRouter.delete('/admin/markets/:countryCode', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.MARKETS_UPDATE), deleteAdminMarket);
apiRouter.post('/admin/markets/:countryCode/cities', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.MARKETS_UPDATE), createAdminMarketCity);
apiRouter.patch('/admin/markets/:countryCode/cities/:cityName', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.MARKETS_UPDATE), updateAdminMarketCity);
apiRouter.delete('/admin/markets/:countryCode/cities/:cityName', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.MARKETS_UPDATE), deleteAdminMarketCity);
apiRouter.post('/admin/markets/:countryCode/cities/:cityName/areas', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.MARKETS_UPDATE), createAdminMarketArea);
apiRouter.patch('/admin/markets/:countryCode/cities/:cityName/areas/:areaName', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.MARKETS_UPDATE), updateAdminMarketArea);
apiRouter.delete('/admin/markets/:countryCode/cities/:cityName/areas/:areaName', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.MARKETS_UPDATE), deleteAdminMarketArea);
apiRouter.get('/admin/services', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.MARKETS_READ), getAdminServices);
apiRouter.post('/admin/services', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.MARKETS_UPDATE), createAdminService);
apiRouter.post('/admin/services/images', mediaUploadRateLimiter, authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.MARKETS_UPDATE), uploadAdminServiceImage);
apiRouter.patch('/admin/service-groups/:groupKey', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.MARKETS_UPDATE), updateAdminServiceGroup);
apiRouter.delete('/admin/service-groups/:groupKey', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.MARKETS_UPDATE), deleteAdminServiceGroup);
apiRouter.delete('/admin/services/:serviceKey/bookable/:bookableServiceKey', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.MARKETS_UPDATE), deleteAdminBookableService);
apiRouter.delete('/admin/services/:serviceKey', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.MARKETS_UPDATE), deleteAdminServiceCategory);
apiRouter.patch('/admin/services/:serviceKey', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.MARKETS_UPDATE), updateAdminService);
apiRouter.post('/admin/pricing/preview', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.MARKETS_READ), previewAdminPricing);
apiRouter.get('/admin/users', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.ADMINS_READ), listAdminUsers);
apiRouter.post('/admin/users', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.ADMINS_CREATE), createAdminUser);
apiRouter.patch('/admin/users/:id', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.ADMINS_UPDATE), updateAdminUser);
apiRouter.delete('/admin/users/:id', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.ADMINS_UPDATE), deleteAdminUser);
apiRouter.get('/admin/audit-logs', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.ADMINS_READ), getAdminAuditLogs);
apiRouter.delete('/admin/audit-logs', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.ADMINS_UPDATE), clearAdminAuditLogs);
apiRouter.get('/admin/notifications', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.BOOKINGS_READ), listAdminNotifications);
apiRouter.post('/admin/notifications', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.BOOKINGS_UPDATE), createAdminBroadcastNotification);
apiRouter.post('/admin/notifications/process-due', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.BOOKINGS_UPDATE), processAdminNotifications);
apiRouter.post('/admin/notifications/:id/retry', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.BOOKINGS_UPDATE), retryAdminNotification);
apiRouter.post('/admin/notifications/:id/cancel', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.BOOKINGS_UPDATE), cancelAdminNotification);
apiRouter.get('/admin/support/tickets', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.SUPPORT_READ), listAdminSupportTickets);
apiRouter.patch('/admin/support/tickets/:ticketId', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.SUPPORT_UPDATE), updateAdminSupportTicket);
apiRouter.get('/admin/support/tickets/:ticketId/messages', authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.SUPPORT_READ), getSupportTicketMessages);
apiRouter.post('/admin/support/tickets/:ticketId/messages', supportRateLimiter, authenticateToken, requireRole([UserRole.ADMIN]), requireAdminPermission(AdminPermission.SUPPORT_REPLY), createAdminSupportMessage);
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
