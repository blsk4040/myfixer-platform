import authService, { AuthSession } from './auth.service';
import { JobStatus } from '../store/useJobStore';
import { assertConfiguredUrl, getApiBaseUrl } from '../config/runtime.config';

const API_BASE_URL = getApiBaseUrl();

type BookingStatus = Exclude<JobStatus, 'IDLE'> | 'CANCELLED';

export type QuoteLineItemType = 'CALLOUT' | 'LABOR' | 'PART' | 'ADD_ON' | 'SURCHARGE' | 'DISCOUNT';

export interface QuoteLineItemInput {
  type: QuoteLineItemType;
  label: string;
  quantity: number;
  unitAmount: number;
  notes?: string;
}

export interface JobQuote {
  id: string;
  bookingId: string;
  currency: string;
  status: string;
  lineItems: QuoteLineItemInput[];
  totalAmount: number;
  totalAmountMinor: number;
  technicianNotes?: string;
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

  registerTechnician(payload: RegisterTechnicianPayload): Promise<{
    status: string;
    message: string;
    token: string | null;
    user: AuthSession['user'] | null;
    technician: {
      id: string;
      approvalStatus: string;
      serviceCategories: string[];
      city?: string;
      businessName?: string;
      yearsExperience?: number;
      profilePhotoUrl?: string;
    };
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
      }),
    });
  }

  acceptBooking(bookingId: string): Promise<{ success: boolean; status: BookingStatus }> {
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

  updateBookingStatus(bookingId: string, status: BookingStatus): Promise<{ success: boolean; status: BookingStatus }> {
    return this.request(`/bookings/${encodeURIComponent(bookingId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  createJobQuote(bookingId: string, payload: { lineItems: QuoteLineItemInput[]; technicianNotes?: string }): Promise<{ success: boolean; quote: JobQuote }> {
    return this.request(`/bookings/${encodeURIComponent(bookingId)}/quotes`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  getBookingQuotes(bookingId: string): Promise<{ success: boolean; quotes: JobQuote[] }> {
    return this.request(`/bookings/${encodeURIComponent(bookingId)}/quotes`);
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
