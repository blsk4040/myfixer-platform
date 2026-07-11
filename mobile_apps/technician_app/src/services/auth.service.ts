import { isSocketDebugEnabled } from '../config/runtime.config';
import { registerDeviceForPushNotifications } from './pushNotification.service';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  profilePhotoUrl?: string;
  location?: {
    country?: string;
    city?: string;
    area?: string;
  };
  countryCode?: string;
  currency?: string;
  isEmailVerified?: boolean;
}

export interface AuthTechnicianProfile {
  id: string;
  approvalStatus?: string;
  countryCode?: string;
  currency?: string;
  serviceCategories?: string[];
  city?: string;
  businessName?: string;
  yearsExperience?: number;
  profilePhotoUrl?: string;
  profilePhotoStatus?: string;
  stats?: {
    averageRating?: number | null;
    reviewCount?: number;
    completedJobs?: number;
    cancelledJobs?: number;
    lifetimeEarningsMinor?: number;
  };
  payoutCapabilities?: {
    countryCode: string;
    currency: string;
    providerPayoutMethods: Array<'BANK_ACCOUNT' | 'MOBILE_MONEY'>;
    defaultProviderPayoutMethod: 'BANK_ACCOUNT' | 'MOBILE_MONEY';
    payoutsEnabled: boolean;
    adminApprovalRequired: boolean;
  };
}

export interface AuthSession {
  token: string;
  user: AuthUser;
  technician?: AuthTechnicianProfile;
}

const logSocketDebug = (message: string, metadata?: Record<string, unknown>): void => {
  if (!isSocketDebugEnabled()) return;
  console.info(`[tech-socket-debug] ${message}`, metadata ?? '');
};

class AuthService {
  private session: AuthSession | null = null;

  setSession(session: AuthSession): void {
    this.session = session;
    logSocketDebug('auth session stored', {
      userId: session.user?.id,
      technicianProfileId: session.technician?.id,
      hasToken: Boolean(session.token),
    });
    void registerDeviceForPushNotifications('technician', this.getAuthHeader()).catch((error) => {
      console.warn('Push notification registration failed:', error);
    });
  }

  clearSession(): void {
    this.session = null;
    logSocketDebug('auth session cleared');
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
