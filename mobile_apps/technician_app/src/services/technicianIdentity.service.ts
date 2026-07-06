import authService, { AuthSession } from './auth.service';

export interface TechnicianIdentity {
  userId: string;
  technicianProfileId: string;
  displayName: string;
  initials: string;
  email: string;
  phone: string;
  city: string;
  approvalStatus: string;
  serviceCategories: string[];
  businessName: string;
  profilePhotoUrl: string;
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

export const getTechnicianIdentity = (session: AuthSession | null = authService.getSession()): TechnicianIdentity => {
  const user = session?.user;
  const profile = session?.technician;
  const displayName = clean(user?.name) || 'Technician';
  const city = clean(profile?.city) || clean(user?.location?.city) || 'City not set';
  const approvalStatus = clean(profile?.approvalStatus) || 'UNKNOWN';
  const profilePhotoUrl = clean(profile?.profilePhotoUrl) || clean(user?.profilePhotoUrl);
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
    city,
    approvalStatus: titleCaseStatus(approvalStatus),
    serviceCategories,
    businessName: clean(profile?.businessName),
    profilePhotoUrl,
  };
};
