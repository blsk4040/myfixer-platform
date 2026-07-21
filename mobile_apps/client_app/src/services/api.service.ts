import authService, { AuthSession } from './auth.service';
import { assertConfiguredUrl, getApiBaseUrl } from '../config/runtime.config';
import { BookingStatus, ServiceRecipient } from '../types/booking';
import { AppliedPromotionSnapshot, PriceBreakdown } from '../utils/financialDisplay';

const API_BASE_URL = getApiBaseUrl();

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface TechnicianRecord {
  id: string;
  name?: string;
  phone?: string;
  profilePhotoUrl?: string;
  lastLocation?: Coordinate | null;
  [key: string]: unknown;
}

export interface BookingDetails {
  id: string;
  status: BookingStatus;
  countryCode?: string;
  currency?: CurrencyCode;
  priceMinor?: number;
  customerLocation?: Coordinate;
  serviceLocation?: Coordinate;
  serviceRecipient?: ServiceRecipient;
  technician?: TechnicianRecord | null;
  technicianId?: string | null;
  inspection?: unknown;
  pricingMode?: 'FIXED_PRICE' | 'INSPECTION_AND_QUOTE';
  paymentStatus?: 'NOT_REQUIRED' | 'PENDING' | 'SECURED' | 'FAILED' | 'UNDER_REVIEW' | 'REFUNDED';
  workAuthorization?: unknown;
  [key: string]: unknown;
}

export type CurrencyCode = 'ZAR' | 'GHS' | 'NGN' | 'KES' | 'UGX' | 'TZS' | 'RWF' | 'ZMW' | 'USD';

export interface CreateBookingRequest {
  customerId?: string;
  customerName?: string;
  applianceType: string;
  faultDescription?: string;
  latitude: number;
  longitude: number;
  price?: number;
  countryCode?: string;
  currency: CurrencyCode;
  fullAddress?: string;
  streetAddress?: string;
  suburb?: string;
  postalCode?: string;
  complexDetails?: string;
  generalArea?: string;
  city?: string;
  area?: string;
  serviceKey?: string;
  subcategoryKey?: string;
  category?: string;
  promoCode?: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  preferredTechnicianId?: string;
  rebookFromBookingId?: string;
  saveAsDefaultAddress?: boolean;
  isForSomeoneElse?: boolean;
  contactName?: string;
  contactPhone?: string;
  serviceRecipient?: ServiceRecipient;
}

export interface DefaultServiceAddress {
  streetAddress?: string;
  suburb?: string;
  city?: string;
  postalCode?: string;
  countryCode?: string;
  fullAddress?: string;
  coordinates?: {
    type?: string;
    coordinates?: [number, number];
  } | null;
}

export interface CustomerProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  profilePhotoUrl?: string;
  countryCode?: string;
  currency?: CurrencyCode;
  location?: {
    country?: string;
    city?: string;
    area?: string;
  };
  defaultServiceAddress?: DefaultServiceAddress | null;
  profileCompleted?: boolean;
  isEmailVerified?: boolean;
  stats?: {
    activeRequestCount: number;
    completedBookingCount: number;
  };
}

export interface GoogleAuthResponse {
  status: 'success' | 'profile_required' | 'email_verification_required';
  token?: string;
  user?: AuthSession['user'];
  googleProfile?: {
    email: string;
    name?: string;
    googleSubject?: string;
  };
  message?: string;
  verificationEmailSent?: boolean;
}

export interface CompleteGoogleProfilePayload {
  idToken: string;
  name: string;
  phone: string;
  countryCode: string;
  city: string;
  area: string;
  consent: boolean;
  defaultServiceAddress: {
    streetAddress?: string;
    suburb: string;
    city: string;
    postalCode?: string;
    countryCode?: string;
    fullAddress: string;
    latitude?: number;
    longitude?: number;
  };
}

export interface CreateBookingResponse {
  success: boolean;
  bookingId: string;
  notifiedTechnicianIds: string[];
  priceBreakdown?: PriceBreakdown | null;
  promotion?: AppliedPromotionSnapshot | null;
  promotions?: AppliedPromotionSnapshot[];
}

export interface ActiveBookingResponse {
  active: boolean;
  booking: BookingDetails | null;
}

export interface BookingHistoryItem {
  id: string;
  serviceKey?: string;
  applianceType: string;
  faultDescription?: string;
  status: BookingStatus;
  fullAddress?: string;
  generalArea?: string;
  currency: CurrencyCode;
  priceMinor: number;
  completedAt?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt: string;
  technician?: TechnicianRecord | null;
  invoice?: {
    id: string;
    invoiceNumber: string;
    baseAmountMinor: number;
    additionalLaborMinor: number;
    partsAmountMinor: number;
    totalAmountMinor: number;
    promoDiscountMinor?: number;
    promotion?: AppliedPromotionSnapshot | null;
    priceBreakdown?: PriceBreakdown | null;
    status: string;
  } | null;
}

export interface JobQuote {
  id: string;
  quoteNumber?: string;
  bookingId: string;
  currency: CurrencyCode;
  status: string;
  version?: number;
  parentQuoteId?: string | null;
  expiresAt?: string | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  clarificationRequestedAt?: string | null;
  lineItems: Array<{
    type: string;
    label: string;
    description?: string;
    quantity: number;
    unitAmountMinor?: number;
    unitAmount: number;
    totalAmountMinor?: number;
    totalAmount: number;
    notes?: string;
  }>;
  totalAmount: number;
  totalAmountMinor: number;
  priceBreakdown?: PriceBreakdown | null;
  promotion?: AppliedPromotionSnapshot | null;
  promotions?: AppliedPromotionSnapshot[];
  technicianNotes?: string;
}

export interface PaymentInitializeResponse {
  success: boolean;
  reused: boolean;
  payment: {
    authorizationUrl: string;
    accessCode: string;
    reference: string;
    amountMinor: number;
    amount: number;
    currency: CurrencyCode;
    status: string;
    priceBreakdown?: PriceBreakdown | null;
    promotion?: AppliedPromotionSnapshot | null;
    promotions?: AppliedPromotionSnapshot[];
  };
}

export interface BookingPaymentStatusResponse {
  success: boolean;
  paymentStatus: 'NOT_REQUIRED' | 'PENDING' | 'SECURED' | 'FAILED' | 'UNDER_REVIEW' | 'REFUNDED';
  transaction: {
    reference: string;
    status: string;
    amountMinor: number;
    currency: CurrencyCode;
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
  legacySubcategoryKey?: string;
  categoryKey: string;
  groupKey: string;
  label: string;
  description?: string;
  imageKey?: string;
  imageUrl?: string;
  status: 'ACTIVE' | 'COMING_SOON' | 'PAUSED' | 'DISABLED' | 'ARCHIVED';
  canBook: boolean;
  message: string;
  calloutFeeMinor?: number;
  minimumChargeMinor?: number;
  estimatedDurationMinutes?: number;
  inspectionRequired?: boolean;
  fixedPriceSupported?: boolean;
  requiresCapabilityApproval?: boolean;
  displayOrder?: number;
  pricingSource?: string;
}

export interface MarketAvailabilityCategory {
  categoryKey: string;
  legacyServiceKey: string;
  groupKey: string;
  label: string;
  description?: string;
  imageKey?: string;
  imageUrl?: string;
  iconKey?: string;
  status: 'ACTIVE' | 'PUBLISHED' | 'COMING_SOON' | 'DRAFT' | 'PAUSED' | 'DISABLED' | 'ARCHIVED';
  displayOrder?: number;
  services: MarketAvailabilityBookableService[];
}

export interface MarketAvailabilityGroup {
  groupKey: string;
  label: string;
  description?: string;
  imageKey?: string;
  imageUrl?: string;
  iconKey?: string;
  status: string;
  displayOrder?: number;
  categories: MarketAvailabilityCategory[];
}

export interface MarketAvailabilityResponse {
  success: boolean;
  availability: {
    countryCode: string;
    countryName: string;
    currency: string;
    city: string;
    area: string;
    market?: {
      countryCode: string;
      countryName: string;
      currency: string;
      city: string;
      area: string;
    };
    groups?: MarketAvailabilityGroup[];
    services: ServiceAvailabilityItem[];
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

export type ManagedCollectionPropertyType = 'HOUSE' | 'APARTMENT' | 'ESTATE' | 'COMMERCIAL' | 'INDUSTRIAL';
export type ManagedCollectionType = 'GENERAL_WASTE';
export type ManagedCollectionFrequency = 'WEEKLY' | 'TWICE_WEEKLY' | 'MONTHLY';
export type ManagedCollectionDay = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
export type ManagedCollectionBinColor = 'RED' | 'GREEN' | 'BLUE';

export interface CreateManagedCollectionRequest {
  countryCode?: string;
  city: string;
  area?: string;
  fullAddress: string;
  propertyType: ManagedCollectionPropertyType;
  collectionType: ManagedCollectionType;
  binPackage: ManagedCollectionBinColor[];
  frequency: ManagedCollectionFrequency;
  preferredCollectionDay: ManagedCollectionDay;
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
}

export interface ManagedCollectionSubscriptionPlan {
  _id: string;
  name: string;
  description?: string;
  priceMinor: number;
  currency: CurrencyCode;
  billingFrequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  collectionFrequency: ManagedCollectionFrequency;
  binPackage: ManagedCollectionBinColor[];
  collectionType: ManagedCollectionType;
  status: string;
}

export interface ManagedCollectionSubscriptionRecord {
  _id: string;
  planName: string;
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'EXPIRED' | 'PENDING';
  priceMinor: number;
  currency: CurrencyCode;
  billingFrequency: string;
  nextBillingDate: string;
  renewalDate: string;
  gracePeriodEndsAt: string;
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

  getBookingDetails(bookingId: string): Promise<BookingDetails> {
    return this.request<BookingDetails>(`/bookings/${encodeURIComponent(bookingId)}`);
  }

  getMyActiveBooking(): Promise<ActiveBookingResponse> {
    return this.request<ActiveBookingResponse>('/bookings/active/current');
  }

  getMyBookingHistory(): Promise<{ success: boolean; bookings: BookingHistoryItem[] }> {
    return this.request('/bookings/history/me');
  }

  createBooking(payload: CreateBookingRequest): Promise<CreateBookingResponse> {
    return this.request<CreateBookingResponse>('/bookings', {
      method: 'POST',
      body: JSON.stringify({
        customer_id: payload.customerId,
        customer_name: payload.customerName,
        appliance_type: payload.applianceType,
        fault_description: payload.faultDescription,
        latitude: payload.latitude,
        longitude: payload.longitude,
        ...(typeof payload.price === 'number' ? { call_out_fee: payload.price } : {}),
        country_code: payload.countryCode,
        currency: payload.currency,
        full_address: payload.fullAddress,
        street_address: payload.streetAddress,
        suburb: payload.suburb,
        postal_code: payload.postalCode,
        complex_details: payload.complexDetails,
        general_area: payload.generalArea,
        city: payload.city,
        area: payload.area,
        service_key: payload.serviceKey,
        subcategory_key: payload.subcategoryKey,
        category: payload.category,
        promo_code: payload.promoCode,
        scheduled_start_time: payload.scheduledStartTime,
        scheduled_end_time: payload.scheduledEndTime,
        preferred_technician_id: payload.preferredTechnicianId,
        rebook_from_booking_id: payload.rebookFromBookingId,
        save_as_default_address: payload.saveAsDefaultAddress,
        service_recipient: payload.serviceRecipient,
        is_for_someone_else: payload.isForSomeoneElse,
        onsite_contact_name: payload.contactName,
        onsite_contact_phone: payload.contactPhone,
      }),
    });
  }

  signInWithGoogle(idToken: string): Promise<GoogleAuthResponse> {
    return this.request<GoogleAuthResponse>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
  }

  completeGoogleProfile(payload: CompleteGoogleProfilePayload): Promise<GoogleAuthResponse> {
    return this.request<GoogleAuthResponse>('/auth/google/complete-profile', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  getMyProfile(): Promise<{ success: boolean; profile: CustomerProfile }> {
    return this.request('/profile/me');
  }

  updateDefaultAddress(payload: {
    streetAddress: string;
    suburb: string;
    city: string;
    postalCode: string;
    countryCode?: string;
    latitude?: number;
    longitude?: number;
  }): Promise<{ success: boolean; profile: CustomerProfile }> {
    return this.request('/profile/default-address', {
      method: 'PATCH',
      body: JSON.stringify(payload),
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

  joinServiceWaitlist(payload: {
    email: string;
    phone?: string;
    countryCode: string;
    city: string;
    area?: string;
    serviceKey: string;
  }): Promise<{ success: boolean; message: string }> {
    return this.request('/waitlist/service', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  createManagedCollectionProfile(payload: CreateManagedCollectionRequest): Promise<{
    success: boolean;
    profile: Record<string, unknown>;
    reminders: Array<Record<string, unknown>>;
  }> {
    return this.request('/managed-collections', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
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

  getManagedCollectionPlans(countryCode?: string): Promise<{ success: boolean; plans: ManagedCollectionSubscriptionPlan[] }> {
    const suffix = countryCode ? `?countryCode=${encodeURIComponent(countryCode)}` : '';
    return this.request(`/managed-collection-plans${suffix}`);
  }

  getManagedCollectionSubscriptionDashboard(): Promise<{
    success: boolean;
    currentSubscription: ManagedCollectionSubscriptionRecord | null;
    subscriptions: ManagedCollectionSubscriptionRecord[];
    invoices: Array<Record<string, unknown>>;
  }> {
    return this.request('/managed-collection-subscriptions/me');
  }

  createManagedCollectionSubscription(planId: string): Promise<{
    success: boolean;
    subscription: ManagedCollectionSubscriptionRecord;
    invoice: Record<string, unknown>;
  }> {
    return this.request('/managed-collection-subscriptions', {
      method: 'POST',
      body: JSON.stringify({ planId }),
    });
  }

  updateManagedCollectionSubscription(id: string, action: 'PAUSE' | 'RESUME' | 'CANCEL' | 'UPGRADE' | 'DOWNGRADE', planId?: string): Promise<{
    success: boolean;
    subscription: ManagedCollectionSubscriptionRecord;
  }> {
    return this.request(`/managed-collection-subscriptions/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ action, planId }),
    });
  }

  getBookingQuotes(bookingId: string): Promise<{ success: boolean; quotes: JobQuote[] }> {
    return this.request(`/bookings/${encodeURIComponent(bookingId)}/quotes`);
  }

  approveJobQuote(quoteId: string, note?: string): Promise<{ success: boolean; quote: JobQuote }> {
    return this.request(`/quotes/${encodeURIComponent(quoteId)}/approve`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    });
  }

  rejectJobQuote(quoteId: string, note?: string): Promise<{ success: boolean; quote: JobQuote }> {
    return this.request(`/quotes/${encodeURIComponent(quoteId)}/reject`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    });
  }

  requestQuoteClarification(quoteId: string, message: string): Promise<{ success: boolean; quote: JobQuote }> {
    return this.request(`/quotes/${encodeURIComponent(quoteId)}/request-clarification`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  initializePayment(payload: { bookingId: string; quoteId?: string; idempotencyKey?: string; callbackUrl?: string }): Promise<PaymentInitializeResponse> {
    return this.request('/payments/initialize', {
      method: 'POST',
      headers: payload.idempotencyKey ? { 'Idempotency-Key': payload.idempotencyKey } : undefined,
      body: JSON.stringify(payload),
    });
  }

  getBookingPaymentStatus(bookingId: string): Promise<BookingPaymentStatusResponse> {
    return this.request(`/payments/booking/${encodeURIComponent(bookingId)}/status`);
  }

  confirmCompletion(bookingId: string, idempotencyKey?: string): Promise<{ success: boolean; bookingId: string; status: BookingStatus; completion: unknown; settlement: unknown }> {
    return this.request(`/bookings/${encodeURIComponent(bookingId)}/confirm-completion`, {
      method: 'POST',
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
      body: JSON.stringify({ idempotencyKey }),
    });
  }

  reportCompletionIssue(bookingId: string, reason: string): Promise<{ success: boolean; bookingId: string; completion: unknown }> {
    return this.request(`/bookings/${encodeURIComponent(bookingId)}/report-completion-issue`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
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

  private async getErrorMessage(response: Response): Promise<string> {
    try {
      const body = (await response.json()) as { message?: unknown };

      if (typeof body.message === 'string' && body.message.trim().length > 0) {
        return body.message;
      }
    } catch {
      // Fall through to a status-based message when the backend returns no JSON body.
    }

    return `Request failed with status ${response.status}`;
  }
}

export const apiService = new ApiService();
export default apiService;
