import authService, { AuthSession } from './auth.service';

export interface TechnicianIdentity {
  userId: string;
  technicianProfileId: string;
  displayName: string;
  initials: string;
  email: string;
  phone: string;
  countryCode: string;
  currency: string;
  city: string;
  approvalStatus: string;
  serviceCategories: string[];
  businessName: string;
  profilePhotoUrl: string;
  profilePhotoStatus: string;
  stats: {
    averageRating: number | null;
    reviewCount: number;
    completedJobs: number;
    cancelledJobs: number;
    lifetimeEarningsMinor: number;
  };
  payoutCapabilities: {
    countryCode: string;
    currency: string;
    providerPayoutMethods: Array<'BANK_ACCOUNT' | 'MOBILE_MONEY'>;
    defaultProviderPayoutMethod: 'BANK_ACCOUNT' | 'MOBILE_MONEY';
    payoutsEnabled: boolean;
    adminApprovalRequired: boolean;
  };
}

const clean = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const titleCaseStatus = (value: string): string =>
  value
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const initialsFromName = (name: string): string => {
  const parts = name.split(/\s+/).filter(Boolean);
  if (!parts.length) return 'T';
  return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
};

const finiteNumber = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const getTechnicianIdentity = (session: AuthSession | null = authService.getSession()): TechnicianIdentity => {
  const user = session?.user;
  const profile = session?.technician;
  const displayName = clean(user?.name) || 'Technician';
  const countryCode = clean(profile?.countryCode) || clean(user?.countryCode) || 'ZA';
  const currency = clean(profile?.currency) || clean(user?.currency) || 'ZAR';
  const city = clean(profile?.city) || clean(user?.location?.city) || 'City not set';
  const approvalStatus = clean(profile?.approvalStatus) || 'UNKNOWN';
  const profilePhotoUrl = clean(profile?.profilePhotoUrl) || clean(user?.profilePhotoUrl);
  const profilePhotoStatus = clean(profile?.profilePhotoStatus) || 'NOT_SUBMITTED';
  const serviceCategories = Array.isArray(profile?.serviceCategories)
    ? profile.serviceCategories.map(clean).filter(Boolean)
    : [];

  return {
    userId: clean(user?.id),
    technicianProfileId: clean(profile?.id) || clean(user?.id),
    displayName,
    initials: initialsFromName(displayName),
    email: clean(user?.email) || 'Email not set',
    phone: clean(user?.phone) || 'Phone not set',
    countryCode,
    currency,
    city,
    approvalStatus: titleCaseStatus(approvalStatus),
    serviceCategories,
    businessName: clean(profile?.businessName),
    profilePhotoUrl,
    profilePhotoStatus: titleCaseStatus(profilePhotoStatus),
    stats: {
      averageRating: typeof profile?.stats?.averageRating === 'number' ? profile.stats.averageRating : null,
      reviewCount: finiteNumber(profile?.stats?.reviewCount),
      completedJobs: finiteNumber(profile?.stats?.completedJobs),
      cancelledJobs: finiteNumber(profile?.stats?.cancelledJobs),
      lifetimeEarningsMinor: finiteNumber(profile?.stats?.lifetimeEarningsMinor),
    },
    payoutCapabilities: profile?.payoutCapabilities || {
      countryCode,
      currency,
      providerPayoutMethods: ['BANK_ACCOUNT'],
      defaultProviderPayoutMethod: 'BANK_ACCOUNT',
      payoutsEnabled: false,
      adminApprovalRequired: true,
    },
  };
};
