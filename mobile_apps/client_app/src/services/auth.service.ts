export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  countryCode?: string;
  currency?: string;
  phone?: string;
  location?: {
    country?: string;
    city?: string;
    area?: string;
  };
  defaultServiceAddress?: {
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
  } | null;
  stats?: {
    activeRequestCount?: number;
    completedBookingCount?: number;
  };
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

class AuthService {
  private session: AuthSession | null = null;

  setSession(session: AuthSession): void {
    this.session = session;
  }

  clearSession(): void {
    this.session = null;
  }

  getSession(): AuthSession | null {
    return this.session;
  }

  getAuthHeader(): Record<string, string> {
    return this.session?.token ? { Authorization: `Bearer ${this.session.token}` } : {};
  }
}

export const authService = new AuthService();
export default authService;
