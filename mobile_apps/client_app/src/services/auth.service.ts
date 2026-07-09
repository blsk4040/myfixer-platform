import * as SecureStore from 'expo-secure-store';
import { registerDeviceForPushNotifications } from './pushNotification.service';

const SESSION_STORAGE_KEY = 'myfixer.client.session';

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
  profileCompleted?: boolean;
  isEmailVerified?: boolean;
  stats?: {
    activeRequestCount?: number;
    completedBookingCount?: number;
  };
}

export interface AuthSession {
  status?: 'success' | 'profile_required' | 'email_verification_required';
  token: string;
  user: AuthUser;
}

class AuthService {
  private session: AuthSession | null = null;

  setSession(session: AuthSession): void {
    this.session = session;
  }

  async persistSession(session: AuthSession): Promise<void> {
    this.setSession(session);
    await SecureStore.setItemAsync(SESSION_STORAGE_KEY, JSON.stringify(session));
    void registerDeviceForPushNotifications('client', this.getAuthHeader()).catch((error) => {
      console.warn('Push notification registration failed:', error);
    });
  }

  async restoreSession(): Promise<AuthSession | null> {
    const storedSession = await SecureStore.getItemAsync(SESSION_STORAGE_KEY);
    if (!storedSession) return null;

    try {
      const parsedSession = JSON.parse(storedSession) as AuthSession;
      if (!parsedSession?.token || !parsedSession.user) return null;
      this.session = parsedSession;
      return parsedSession;
    } catch {
      await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
      return null;
    }
  }

  clearSession(): void {
    this.session = null;
    void SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
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
