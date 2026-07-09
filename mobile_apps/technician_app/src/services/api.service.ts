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
    technician: {
      id: string;
      approvalStatus: string;
      serviceCategories: string[];
      city?: string;
      businessName?: string;
      yearsExperience?: number;
      profilePhotoUrl?: string;
      profilePhotoStatus?: string;
    };
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

  getBookingMessages(bookingId: string): Promise<{ success: boolean; messages: BookingChatMessage[] }> {
    return this.request(`/bookings/${encodeURIComponent(bookingId)}/messages`);
  }

  uploadBookingMedia(bookingId: string, payload: {
    dataUri: string;
    fileName?: string;
    mimeType?: string;
    purpose?: 'CHAT' | 'BEFORE_WORK' | 'AFTER_WORK' | 'PROOF_OF_COMPLETION' | 'QUOTE_PART' | 'DISPUTE';
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
