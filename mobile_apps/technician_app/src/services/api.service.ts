import authService, { AuthSession } from './auth.service';
import { AssignedBookingDetails, JobStatus } from '../store/useJobStore';
import { assertConfiguredUrl, getApiBaseUrl } from '../config/runtime.config';
import { AppliedPromotionSnapshot, PriceBreakdown } from '../utils/financialDisplay';

const API_BASE_URL = getApiBaseUrl();

type BookingStatus = Exclude<JobStatus, 'IDLE'> | 'CANCELLED';

export type QuoteLineItemType =
  | 'CALL_OUT'
  | 'CALLOUT'
  | 'LABOUR'
  | 'LABOR'
  | 'PART'
  | 'ADD_ON'
  | 'SURCHARGE'
  | 'DISCOUNT'
  | 'TAX'
  | 'PLATFORM_FEE';

export interface QuoteLineItemInput {
  type: QuoteLineItemType;
  label: string;
  quantity: number;
  unitAmount: number;
  notes?: string;
}

export interface JobQuote {
  id: string;
  quoteNumber?: string;
  bookingId: string;
  currency: string;
  status: string;
  version?: number;
  parentQuoteId?: string | null;
  expiresAt?: string | null;
  lineItems: QuoteLineItemInput[];
  totalAmount: number;
  totalAmountMinor: number;
  priceBreakdown?: PriceBreakdown | null;
  promotion?: AppliedPromotionSnapshot | null;
  promotions?: AppliedPromotionSnapshot[];
  technicianNotes?: string;
}

export interface InspectionGpsPayload {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  recordedAt: string;
}

export interface CompleteInspectionPayload extends InspectionGpsPayload {
  diagnosisNotes: string;
  technicalObservations?: string;
  quoteRequired: boolean;
  partsRequired?: Array<{ name: string; quantity?: number; notes?: string }>;
  evidenceMediaIds?: string[];
}

export interface BookingPaymentStatusResponse {
  success: boolean;
  paymentStatus: 'NOT_REQUIRED' | 'PENDING' | 'SECURED' | 'FAILED' | 'UNDER_REVIEW' | 'REFUNDED';
  transaction: {
    reference: string;
    status: string;
    amountMinor: number;
    currency: string;
    paidAt?: string | null;
    verifiedAt?: string | null;
  } | null;
}

export interface JobMediaRecord {
  id: string;
  bookingId: string;
  uploadedByUserId: string;
  uploadedByRole: 'CUSTOMER' | 'TECHNICIAN' | 'ADMIN' | 'SYSTEM';
  mediaType: 'IMAGE';
  purpose: string;
  url: string;
  thumbnailUrl: string;
  mimeType: string;
  fileName?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  retentionExpiresAt?: string;
  createdAt: string;
}

export interface BookingChatMessage {
  id: string;
  bookingId: string;
  senderId: string;
  senderRole: 'CUSTOMER' | 'TECHNICIAN' | 'ADMIN' | 'SYSTEM';
  messageType: 'TEXT' | 'IMAGE' | 'SYSTEM';
  text: string;
  media: JobMediaRecord[];
  createdAt: string;
}

export interface NotificationRecord {
  _id: string;
  channel: 'IN_APP' | 'EMAIL' | 'PUSH' | 'SMS' | 'WHATSAPP';
  type: string;
  title: string;
  message: string;
  status: string;
  scheduledAt: string;
  sentAt?: string | null;
  readAt?: string | null;
  archivedAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface NotificationInboxResponse {
  success: boolean;
  notifications: NotificationRecord[];
  unreadCount: number;
}

export type SupportTicketStatus = 'OPEN' | 'PENDING' | 'RESOLVED';

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  requesterId: string;
  requesterType: 'CUSTOMER' | 'TECHNICIAN';
  bookingId?: string | null;
  subject: string;
  category: string;
  status: SupportTicketStatus;
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
  assignedAgentId?: string | null;
  lastMessageAt?: string | null;
  resolvedAt?: string | null;
  triage?: {
    issueType?: string;
    bookingReference?: string;
    suggestedFixesViewed?: string[];
    handoffReason?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupportMessage {
  id: string;
  ticketId: string;
  senderId?: string | null;
  senderType: 'CUSTOMER' | 'TECHNICIAN' | 'AGENT' | 'SYSTEM';
  messageType: 'TEXT' | 'SYSTEM';
  text: string;
  internal: boolean;
  createdAt: string;
}

export interface SecuritySummaryResponse {
  success: boolean;
  security: {
    email: string;
    emailVerified: boolean;
    phoneVerified: boolean;
    lastLoginAt?: string | null;
    lastPasswordChangeAt?: string | null;
    tokenVersion: number;
    currentDevice: {
      label: string;
      userAgent?: string;
    };
    recentEvents: Array<{
      id: string;
      action: string;
      success: boolean;
      createdAt: string;
      device?: string;
    }>;
  };
}

export interface SecuritySessionResponse {
  success?: boolean;
  status?: string;
  message: string;
  token?: string;
  user?: AuthSession['user'];
  technician?: AuthSession['technician'];
}

export interface WalletBalanceResponse {
  success: boolean;
  country_code?: string;
  currency: string;
  available_balance: number;
  available_balance_minor: number;
  pending_balance: number;
  pending_balance_minor: number;
}

export interface WalletTransactionRecord {
  _id: string;
  type?: string;
  status?: string;
  amount?: number;
  amountMinor?: number;
  currency?: string;
  description?: string;
  createdAt?: string;
}

export type ProviderSettlementStatus =
  | 'PENDING_COMPLETION'
  | 'AWAITING_CUSTOMER_CONFIRMATION'
  | 'ON_HOLD'
  | 'READY_FOR_PAYOUT'
  | 'APPROVAL_REQUIRED'
  | 'APPROVED'
  | 'PAYOUT_QUEUED'
  | 'PAYOUT_PROCESSING'
  | 'PAID'
  | 'PAYOUT_FAILED'
  | 'REVERSED'
  | 'CANCELLED'
  | 'UNDER_REVIEW';

export interface ProviderSettlementRecord {
  id: string;
  bookingId: string;
  currency: string;
  grossAmountMinor: number;
  commissionAmountMinor: number;
  processingFeeMinor: number;
  netAmountMinor: number;
  status: ProviderSettlementStatus;
  completionConfirmedAt?: string | null;
  readyForPayoutAt?: string | null;
  paidAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  holdReason?: string;
  metadata?: {
    priceBreakdown?: PriceBreakdown | null;
    promotion?: AppliedPromotionSnapshot | null;
    promotions?: AppliedPromotionSnapshot[];
    [key: string]: unknown;
  };
}

export interface ProviderPayoutMethodRecord {
  id: string;
  type: 'BANK_ACCOUNT' | 'MOBILE_MONEY';
  provider: 'PAYSTACK';
  countryCode: string;
  currency: string;
  accountHolderName: string;
  bankName?: string;
  bankCode?: string;
  mobileProvider?: string;
  maskedDestination: string;
  status: 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED' | 'DISABLED';
  isDefault: boolean;
  verifiedAt?: string | null;
}

export interface RegisterTechnicianPayload {
  name: string;
  email: string;
  phone: string;
  countryCode: string;
  city: string;
  password: string;
  serviceCategories: string[];
  yearsExperience: number;
  businessName?: string;
  idNumber?: string;
  vehicleType?: string;
  serviceRadiusKm?: number;
  bio?: string;
  profilePhotoDataUri: string;
}

export interface ServiceAvailabilityItem {
  serviceKey: string;
  label: string;
  description?: string;
  imageKey?: string;
  imageUrl?: string;
  calloutFeeMinor?: number;
  subcategories?: Array<{
    subcategoryKey: string;
    label: string;
    description?: string;
    status: 'ACTIVE' | 'COMING_SOON' | 'PAUSED' | 'DISABLED' | 'ARCHIVED';
    imageKey?: string;
    imageUrl?: string;
    calloutFeeMinor?: number;
  }>;
  status: 'ACTIVE' | 'COMING_SOON' | 'PAUSED' | 'DISABLED';
  canBook: boolean;
  message: string;
}

export interface MarketAvailabilityBookableService {
  serviceKey: string;
  label: string;
  description?: string;
  imageKey?: string;
  imageUrl?: string;
  calloutFeeMinor?: number;
  publicationStatus?: string;
  status?: string;
  canBook?: boolean;
}

export interface MarketAvailabilityCategory {
  categoryKey: string;
  serviceKey?: string;
  label: string;
  description?: string;
  imageKey?: string;
  imageUrl?: string;
  status?: string;
  publicationStatus?: string;
  services?: MarketAvailabilityBookableService[];
  bookableServices?: MarketAvailabilityBookableService[];
}

export interface MarketAvailabilityGroup {
  groupKey: string;
  label: string;
  groupLabel?: string;
  imageKey?: string;
  imageUrl?: string;
  status?: string;
  publicationStatus?: string;
  categories?: MarketAvailabilityCategory[];
}

export interface MarketAvailabilityResponse {
  success: boolean;
  availability: {
    countryCode: string;
    countryName: string;
    currency: string;
    city: string;
    area: string;
    services: ServiceAvailabilityItem[];
    groups?: MarketAvailabilityGroup[];
  };
}

export interface PublicMarket {
  countryCode: string;
  countryName: string;
  currency: string;
  locale?: string;
  timezone?: string;
  status?: string;
}

export interface GoogleAuthResponse {
  status: 'success' | 'profile_required' | 'email_verification_required';
  token?: string;
  user?: AuthSession['user'];
  technician?: AuthSession['technician'];
  googleProfile?: {
    email: string;
    name?: string;
    googleSubject?: string;
  };
  message?: string;
}

class ApiService {
  private async request<TResponse>(path: string, init?: RequestInit): Promise<TResponse> {
    assertConfiguredUrl(API_BASE_URL, 'EXPO_PUBLIC_API_BASE_URL');

    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...authService.getAuthHeader(),
        ...init?.headers,
      },
    });

    if (!response.ok) {
      const message = await this.getErrorMessage(response);
      throw new Error(message);
    }

    return response.json() as Promise<TResponse>;
  }

  login(email: string, password: string): Promise<AuthSession> {
    return this.request<AuthSession>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: email.toLowerCase().trim(), password }),
    });
  }

  signInWithGoogle(idToken: string): Promise<GoogleAuthResponse> {
    return this.request<GoogleAuthResponse>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
  }

  registerTechnician(payload: RegisterTechnicianPayload): Promise<{
    status: string;
    message: string;
    token: string | null;
    user: AuthSession['user'] | null;
    technician: AuthSession['technician'];
    verificationEmailSent?: boolean;
  }> {
    return this.request('/auth/register-technician', {
      method: 'POST',
      body: JSON.stringify({
        name: payload.name,
        email: payload.email.toLowerCase().trim(),
        phone: payload.phone,
        countryCode: payload.countryCode,
        location: {
          country: payload.countryCode,
          city: payload.city,
        },
        password: payload.password,
        serviceCategories: payload.serviceCategories,
        yearsExperience: payload.yearsExperience,
        businessName: payload.businessName,
        idNumber: payload.idNumber,
        vehicleType: payload.vehicleType,
        serviceRadiusKm: payload.serviceRadiusKm,
        bio: payload.bio,
        documents: {
          profilePhotoDataUri: payload.profilePhotoDataUri,
        },
      }),
    });
  }

  getMarketAvailability(params: { countryCode: string; city?: string; area?: string }): Promise<MarketAvailabilityResponse> {
    const query = new URLSearchParams();
    if (params.city) query.set('city', params.city);
    if (params.area) query.set('area', params.area);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.request<MarketAvailabilityResponse>(`/markets/${encodeURIComponent(params.countryCode)}/availability${suffix}`);
  }

  getPublicMarkets(): Promise<{ markets: PublicMarket[] }> {
    return this.request('/markets');
  }

  uploadTechnicianProfilePhoto(payload: {
    dataUri: string;
  }): Promise<{
    success: boolean;
    technician: {
      id: string;
      approvalStatus: string;
      profilePhotoUrl: string;
      profilePhotoStatus: string;
    };
  }> {
    return this.request('/technician/profile-photo', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  acceptBooking(bookingId: string): Promise<{ success: boolean; status: BookingStatus; booking?: AssignedBookingDetails }> {
    return this.request(`/bookings/${encodeURIComponent(bookingId)}/accept`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  declineBooking(bookingId: string): Promise<{ success: boolean; status: 'PENDING' }> {
    return this.request(`/bookings/${encodeURIComponent(bookingId)}/decline`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  getAvailableJobsForTechnician(): Promise<{ success: boolean; jobs: any[] }> {
    return this.request('/technician/available-jobs');
  }

  getTechnicianJobs(): Promise<{ success: boolean; activeJobs: any[]; scheduledJobs: any[]; completedJobs: any[] }> {
    return this.request('/technician/jobs');
  }

  updateBookingStatus(bookingId: string, status: BookingStatus): Promise<{ success: boolean; status: BookingStatus }> {
    return this.request(`/bookings/${encodeURIComponent(bookingId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  startRoute(bookingId: string): Promise<{ success: boolean; status: BookingStatus }> {
    return this.request(`/bookings/${encodeURIComponent(bookingId)}/start-route`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  confirmArrival(bookingId: string, payload: {
    latitude: number;
    longitude: number;
    accuracyMeters: number;
    recordedAt: string;
  }): Promise<{ success: boolean; status?: BookingStatus; message?: string; code?: string }> {
    return this.request(`/bookings/${encodeURIComponent(bookingId)}/arrival`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  startJob(bookingId: string): Promise<{ success: boolean; status: BookingStatus }> {
    return this.request(`/bookings/${encodeURIComponent(bookingId)}/start-job`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  startInspection(bookingId: string, payload: InspectionGpsPayload & { acknowledgePlatformRules: boolean }): Promise<{ success: boolean; bookingId: string; inspection: unknown }> {
    return this.request(`/bookings/${encodeURIComponent(bookingId)}/start-inspection`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  completeInspection(bookingId: string, payload: CompleteInspectionPayload): Promise<{ success: boolean; bookingId: string; inspection: unknown; workAuthorization?: unknown }> {
    return this.request(`/bookings/${encodeURIComponent(bookingId)}/complete-inspection`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  createJobQuote(bookingId: string, payload: { lineItems: QuoteLineItemInput[]; technicianNotes?: string; draft?: boolean; submit?: boolean; parentQuoteId?: string }): Promise<{ success: boolean; quote: JobQuote }> {
    return this.request(`/bookings/${encodeURIComponent(bookingId)}/quotes`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  getBookingQuotes(bookingId: string): Promise<{ success: boolean; quotes: JobQuote[] }> {
    return this.request(`/bookings/${encodeURIComponent(bookingId)}/quotes`);
  }

  getBookingPaymentStatus(bookingId: string): Promise<BookingPaymentStatusResponse> {
    return this.request(`/payments/booking/${encodeURIComponent(bookingId)}/status`);
  }

  finalizeJobInvoice(payload: {
    bookingId: string;
    baseAmount: number;
    additionalLabor: number;
    partsAmount: number;
    totalAmount: number;
    proofPhoto: string;
  }): Promise<{ success: boolean; bookingId: string }> {
    return this.request('/bookings/finalize-invoice', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  submitCompletion(bookingId: string, payload: {
    completionNotes: string;
    partsUsed?: Array<{ name: string; quantity?: number; amountMinor?: number; notes?: string }>;
    evidenceMediaIds: string[];
    finalAmountMinor: number;
    idempotencyKey?: string;
  }): Promise<{ success: boolean; bookingId: string; completion: unknown }> {
    return this.request(`/bookings/${encodeURIComponent(bookingId)}/submit-completion`, {
      method: 'POST',
      headers: payload.idempotencyKey ? { 'Idempotency-Key': payload.idempotencyKey } : undefined,
      body: JSON.stringify(payload),
    });
  }

  getBookingMessages(bookingId: string): Promise<{ success: boolean; messages: BookingChatMessage[] }> {
    return this.request(`/bookings/${encodeURIComponent(bookingId)}/messages`);
  }

  uploadBookingMedia(bookingId: string, payload: {
    dataUri: string;
    fileName?: string;
    mimeType?: string;
    purpose?: 'CHAT' | 'BEFORE_WORK' | 'AFTER_WORK' | 'INSPECTION' | 'PROOF_OF_COMPLETION' | 'QUOTE_PART' | 'DISPUTE';
  }): Promise<{ success: boolean; media: JobMediaRecord }> {
    return this.request(`/bookings/${encodeURIComponent(bookingId)}/media`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  sendBookingMessage(bookingId: string, payload: {
    text?: string;
    mediaIds?: string[];
  }): Promise<{ success: boolean; message: BookingChatMessage }> {
    return this.request(`/bookings/${encodeURIComponent(bookingId)}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  getWalletBalance(): Promise<WalletBalanceResponse> {
    return this.request('/wallet');
  }

  getWalletTransactions(): Promise<{ success: boolean; transactions: WalletTransactionRecord[] }> {
    return this.request('/wallet/transactions');
  }

  requestWalletCashout(amountMinor: number): Promise<{
    success: boolean;
    amount_minor: number;
    amount: number;
    message: string;
  }> {
    return this.request('/wallet/cashout', {
      method: 'POST',
      body: JSON.stringify({ amountMinor }),
    });
  }

  getPayoutMethods(): Promise<{ success: boolean; methods: ProviderPayoutMethodRecord[] }> {
    return this.request('/technicians/me/payout-methods');
  }

  addBankPayoutMethod(payload: {
    countryCode: string;
    currency: string;
    accountHolderName: string;
    bankName: string;
    bankCode: string;
    accountNumber: string;
    makeDefault?: boolean;
  }): Promise<{ success: boolean; method: ProviderPayoutMethodRecord }> {
    return this.request('/technicians/me/payout-methods/bank-account', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  addMobileMoneyPayoutMethod(payload: {
    countryCode: string;
    currency: string;
    operatorCode: string;
    phoneNumber: string;
    accountName?: string;
    makeDefault?: boolean;
  }): Promise<{ success: boolean; method: ProviderPayoutMethodRecord }> {
    return this.request('/technicians/me/payout-methods/mobile-money', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  setDefaultPayoutMethod(methodId: string): Promise<{ success: boolean; method: ProviderPayoutMethodRecord }> {
    return this.request(`/technicians/me/payout-methods/${encodeURIComponent(methodId)}/default`, { method: 'PATCH' });
  }

  disablePayoutMethod(methodId: string): Promise<{ success: boolean; method: ProviderPayoutMethodRecord }> {
    return this.request(`/technicians/me/payout-methods/${encodeURIComponent(methodId)}`, { method: 'DELETE' });
  }

  getMySettlements(): Promise<{ success: boolean; settlements: ProviderSettlementRecord[] }> {
    return this.request('/technicians/me/settlements');
  }

  getNotifications(): Promise<NotificationInboxResponse> {
    return this.request<NotificationInboxResponse>('/notifications');
  }

  getSupportTickets(): Promise<{ success: boolean; tickets: SupportTicket[] }> {
    return this.request('/support/tickets');
  }

  createSupportTicket(payload: {
    subject: string;
    message: string;
    category?: string;
    bookingId?: string;
    triage?: {
      issueType?: string;
      bookingReference?: string;
      suggestedFixesViewed?: string[];
      handoffReason?: string;
    };
  }): Promise<{ success: boolean; ticket: SupportTicket; message: SupportMessage }> {
    return this.request('/support/tickets', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  getSupportTicketMessages(ticketId: string): Promise<{ success: boolean; ticket: SupportTicket; messages: SupportMessage[] }> {
    return this.request(`/support/tickets/${encodeURIComponent(ticketId)}/messages`);
  }

  sendSupportMessage(ticketId: string, text: string): Promise<{ success: boolean; ticket: SupportTicket; message: SupportMessage }> {
    return this.request(`/support/tickets/${encodeURIComponent(ticketId)}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message: text }),
    });
  }

  getSecuritySummary(): Promise<SecuritySummaryResponse> {
    return this.request<SecuritySummaryResponse>('/auth/security');
  }

  changePassword(payload: { currentPassword: string; newPassword: string }): Promise<SecuritySessionResponse> {
    return this.request<SecuritySessionResponse>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  signOutOtherSessions(): Promise<SecuritySessionResponse> {
    return this.request<SecuritySessionResponse>('/auth/sign-out-other-sessions', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  updateNotification(id: string, action: 'MARK_READ' | 'MARK_UNREAD' | 'ARCHIVE'): Promise<{
    success: boolean;
    notification: NotificationRecord;
  }> {
    return this.request(`/notifications/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ action }),
    });
  }

  private async getErrorMessage(response: Response): Promise<string> {
    try {
      const body = (await response.json()) as { message?: unknown; error?: unknown };
      const message = body.message ?? body.error;
      if (typeof message === 'string' && message.trim()) return message;
    } catch {
      // Use status fallback below.
    }

    return `Request failed with status ${response.status}`;
  }
}

export const apiService = new ApiService();
export default apiService;
