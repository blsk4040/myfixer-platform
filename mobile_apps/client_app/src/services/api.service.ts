import authService from './auth.service';
import { assertConfiguredUrl, getApiBaseUrl } from '../config/runtime.config';

const API_BASE_URL = getApiBaseUrl();

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface TechnicianRecord {
  id: string;
  name?: string;
  phone?: string;
  lastLocation?: Coordinate | null;
  [key: string]: unknown;
}

export interface BookingDetails {
  id: string;
  status: string;
  countryCode?: string;
  currency?: CurrencyCode;
  priceMinor?: number;
  customerLocation?: Coordinate;
  technician?: TechnicianRecord | null;
  technicianId?: string | null;
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
  category?: string;
  saveAsDefaultAddress?: boolean;
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
  stats?: {
    activeRequestCount: number;
    completedBookingCount: number;
  };
}

export interface CreateBookingResponse {
  success: boolean;
  bookingId: string;
  notifiedTechnicianIds: string[];
}

export interface ActiveBookingResponse {
  active: boolean;
  booking: BookingDetails | null;
}

export interface BookingHistoryItem {
  id: string;
  applianceType: string;
  faultDescription?: string;
  status: string;
  fullAddress?: string;
  generalArea?: string;
  currency: CurrencyCode;
  priceMinor: number;
  completedAt?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt: string;
  invoice?: {
    id: string;
    invoiceNumber: string;
    baseAmountMinor: number;
    additionalLaborMinor: number;
    partsAmountMinor: number;
    totalAmountMinor: number;
    status: string;
  } | null;
}

export interface JobQuote {
  id: string;
  bookingId: string;
  currency: CurrencyCode;
  status: string;
  lineItems: Array<{
    type: string;
    label: string;
    quantity: number;
    unitAmount: number;
    totalAmount: number;
  }>;
  totalAmount: number;
  totalAmountMinor: number;
  technicianNotes?: string;
}

export interface ServiceAvailabilityItem {
  serviceKey: string;
  label: string;
  status: 'ACTIVE' | 'COMING_SOON' | 'PAUSED' | 'DISABLED';
  canBook: boolean;
  message: string;
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
  };
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
        category: payload.category,
        save_as_default_address: payload.saveAsDefaultAddress,
      }),
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
