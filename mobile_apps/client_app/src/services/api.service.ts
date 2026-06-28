const API_BASE_URL = 'http://192.168.3.34:5000/api/v1';

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
  customerLocation?: Coordinate;
  technician?: TechnicianRecord | null;
  technicianId?: string | null;
  [key: string]: unknown;
}

export type CurrencyCode = 'ZAR' | 'GHS';

export interface CreateBookingRequest {
  customerId: string;
  customerName?: string;
  applianceType: string;
  faultDescription?: string;
  latitude: number;
  longitude: number;
  price: number;
  currency: CurrencyCode;
  fullAddress?: string;
  complexDetails?: string;
  generalArea?: string;
}

export interface CreateBookingResponse {
  success: boolean;
  bookingId: string;
  notifiedTechnicianIds: string[];
}

class ApiService {
  private async request<TResponse>(path: string, init?: RequestInit): Promise<TResponse> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
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
        call_out_fee: payload.price,
        currency: payload.currency,
        full_address: payload.fullAddress,
        complex_details: payload.complexDetails,
        general_area: payload.generalArea,
      }),
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
