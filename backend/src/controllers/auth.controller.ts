// mobile_apps/backend/src/controllers/auth.controller.ts
import { OAuth2Client } from 'google-auth-library';
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User, { AdminRole, normalizeUserRole, UserRole } from '../models/user.model';
import { getMarketByCountry, normalizeCountryCode } from '../config/market.config';
import Technician, { TechnicianApprovalStatus, VerificationStatus } from '../models/technician.model';
import TechnicianCapability, { CapabilityStatus } from '../models/technician-capability.model';
import TechnicianTelemetry from '../models/technician-telemetry.model';
import MarketSetting, { MarketStatus } from '../models/market-setting.model';
import { getMarketPayoutCapabilities } from '../services/market-finance-guard.service';
import AuditLog from '../models/audit-log.model';
import Notification, { NotificationChannel, NotificationStatus, NotificationType } from '../models/notification.model';
import { EmailService } from '../services/email/email.service';
import Booking, { BookingStatus } from '../models/booking.model';
import { getMarketAvailability, normalizeServiceKey } from '../services/service-availability.service';
import { uploadImageToCloudinary } from '../services/media-storage.service';
import { assertActiveMarket } from '../services/market-finance-guard.service';

// --- JWT Helper Generator ---
const generateToken = (userId: string, role: UserRole, email: string, tokenVersion = 0): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured.');
  }

  return jwt.sign({ id: userId, _id: userId, role, email, tokenVersion }, secret, { expiresIn: '30d' });
};

const hashResetToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

const generateEmailVerificationToken = (): string => crypto.randomBytes(32).toString('hex');

const getClientBaseUrl = (req: Request): string =>
  (process.env.CLIENT_APP_URL || `${req.protocol}://${req.get('host') || ''}`).replace(/\/$/, '');

const isMarketActiveForOnboarding = async (countryCode: string): Promise<boolean> => {
  const market = await MarketSetting.findOne({
    'identity.countryCode': countryCode,
    'identity.status': MarketStatus.ACTIVE,
    $or: [{ 'deletionLock.locked': { $ne: true } }, { deletionLock: { $exists: false } }],
  })
    .select('_id')
    .lean();
  return Boolean(market);
};

const wantsJsonResponse = (req: Request): boolean =>
  req.method !== 'GET' ||
  req.query.format === 'json' ||
  String(req.get('accept') || '').includes('application/json');

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const padiWordmarkHtml = `
  <span class="padi-wordmark" aria-label="Padi">
    <span>Pad</span><span class="padi-i"><span class="padi-dot"></span><span class="padi-stem"></span></span>
  </span>
`;

const renderEmailVerificationPage = (args: {
  status: 'success' | 'error';
  title: string;
  message: string;
  openAppUrl?: string;
  openAppLabel?: string;
  returnAppLabel?: string;
  statusCode?: number;
}): string => {
  const openAppUrl = args.openAppUrl || process.env.CLIENT_APP_DEEP_LINK || 'myfixerclient://email-verified';
  const accent = args.status === 'success' ? '#00FF87' : '#F87171';
  const safeTitle = escapeHtml(args.title);
  const safeMessage = escapeHtml(args.message);
  const safeOpenAppLabel = escapeHtml(args.openAppLabel || 'Open Padi');
  const safeReturnAppLabel = escapeHtml(args.returnAppLabel || 'Padi');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle} | Padi</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: #090D14;
      color: #E2E8F0;
      font-family: Arial, Helvetica, sans-serif;
    }
    main {
      width: min(92vw, 440px);
      padding: 32px 24px;
      text-align: center;
      background: #111827;
      border: 1px solid #1E293B;
      border-radius: 18px;
      box-shadow: 0 18px 60px rgba(0, 0, 0, 0.35);
    }
    .mark {
      width: 68px;
      height: 68px;
      margin: 0 auto 18px;
      display: grid;
      place-items: center;
      border-radius: 999px;
      color: #090D14;
      background: ${accent};
      font-size: 34px;
      font-weight: 900;
    }
    .brand {
      margin: 0 0 18px;
    }
    .padi-wordmark {
      display: inline-flex;
      align-items: flex-end;
      justify-content: center;
      color: #FFFFFF;
      font-size: 30px;
      line-height: 1;
      font-weight: 900;
      letter-spacing: 0;
    }
    .padi-i {
      display: inline-flex;
      width: 13px;
      height: 29px;
      margin-left: 1px;
      padding-bottom: 2px;
      align-items: center;
      justify-content: flex-end;
      flex-direction: column;
    }
    .padi-dot {
      width: 6px;
      height: 6px;
      margin-bottom: 4px;
      border-radius: 999px;
      background: #B8FF3D;
    }
    .padi-stem {
      width: 5px;
      height: 15px;
      border-radius: 999px;
      background: #FFFFFF;
    }
    h1 {
      margin: 0;
      color: #FFFFFF;
      font-size: 26px;
      line-height: 1.2;
    }
    p {
      margin: 12px 0 24px;
      color: #94A3B8;
      font-size: 15px;
      line-height: 1.55;
    }
    a {
      display: inline-flex;
      min-height: 48px;
      padding: 0 22px;
      align-items: center;
      justify-content: center;
      border-radius: 12px;
      background: #00FF87;
      color: #090D14;
      font-weight: 900;
      text-decoration: none;
    }
    small {
      display: block;
      margin-top: 16px;
      color: #64748B;
      line-height: 1.4;
    }
  </style>
</head>
<body>
  <main>
    <div class="mark">${args.status === 'success' ? '&#10003;' : '!'}</div>
    <div class="brand">${padiWordmarkHtml}</div>
    <h1>${safeTitle}</h1>
    <p>${safeMessage}</p>
    <a href="${escapeHtml(openAppUrl)}">${safeOpenAppLabel}</a>
    <small>If the app does not open automatically, return to ${safeReturnAppLabel} and tap "I've verified my email".</small>
  </main>
</body>
</html>`;
};

const sendVerificationEmail = async (req: Request, user: { email: string; name: string; emailVerificationToken?: string }) => {
  if (!user.emailVerificationToken) return false;
  const verificationUrl = `${getClientBaseUrl(req)}/api/v1/auth/verify-email?token=${encodeURIComponent(user.emailVerificationToken)}`;
  return EmailService.sendEmailVerificationEmail({
    recipientEmail: user.email,
    name: user.name,
    verificationUrl,
  });
};

const googleClient = new OAuth2Client();

const verifyGoogleIdToken = async (idToken: string) => {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: [
      process.env.GOOGLE_WEB_CLIENT_ID,
      process.env.GOOGLE_ANDROID_CLIENT_ID,
      process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    ].filter(Boolean) as string[],
  });

  return ticket.getPayload();
};

const logAuthAudit = async (
  req: Request,
  action: string,
  metadata: Record<string, unknown> = {},
  success = true
) => {
  await AuditLog.create({
    actor: {
      email: typeof metadata.email === 'string' ? metadata.email : '',
      role: 'PUBLIC',
    },
    event: {
      action,
      module: 'AUTH',
      resourceType: 'User',
      resourceId: typeof metadata.userId === 'string' ? metadata.userId : '',
      severity: success ? 'INFO' : 'WARNING',
    },
    request: {
      ipAddress: req.ip || '',
      device: '',
      platform: '',
      appVersion: '',
      userAgent: String(req.headers['user-agent'] || ''),
    },
    metadata,
    success,
  });
};

const getRequestDeviceLabel = (req: Request): string => {
  const explicitDevice =
    req.headers['x-device-name'] ??
    req.headers['x-device-model'] ??
    req.body?.deviceName;
  const rawDevice = Array.isArray(explicitDevice) ? explicitDevice[0] : explicitDevice;
  if (typeof rawDevice === 'string' && rawDevice.trim()) return rawDevice.trim().slice(0, 120);

  const userAgent = String(req.headers['user-agent'] || '').trim();
  if (!userAgent) return 'This device';
  if (/android/i.test(userAgent)) return 'Android device';
  if (/iphone|ipad|ios/i.test(userAgent)) return 'iOS device';
  if (/windows/i.test(userAgent)) return 'Windows device';
  if (/macintosh|mac os/i.test(userAgent)) return 'Mac device';
  return 'Signed-in device';
};

const createSecurityAlert = async (
  user: { _id: any; email?: string; phone?: string; name?: string },
  title: string,
  message: string,
  metadata: Record<string, unknown> = {}
) => {
  await Notification.create({
    recipient: {
      userId: user._id,
      email: user.email || '',
      phone: user.phone || '',
      name: user.name || '',
    },
    channel: NotificationChannel.IN_APP,
    type: NotificationType.SYSTEM,
    title,
    message,
    status: NotificationStatus.SENT,
    scheduledAt: new Date(),
    sentAt: new Date(),
    metadata: {
      feed: 'alerts',
      source: 'SECURITY',
      ...metadata,
    },
  });
};

const getAuthenticatedUser = (req: Request) =>
  (req as any).user as { id?: string; _id?: string; email?: string; role?: string } | undefined;

const toFiniteNumber = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getClientLocalHour = (req: Request): number => {
  const candidate =
    req.headers['x-client-local-hour'] ??
    req.headers['x-local-hour'] ??
    req.body?.clientLocalHour ??
    req.body?.localHour;
  const raw = Array.isArray(candidate) ? candidate[0] : candidate;
  const parsed = typeof raw === 'number' ? raw : Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 23
    ? parsed
    : new Date().getHours();
};

const getLocalizedGreeting = (req: Request): string => {
  const hour = getClientLocalHour(req);
  let greeting = 'Good Day';
  if (hour < 12) greeting = 'Good Morning';
  else if (hour < 18) greeting = 'Good Afternoon';
  else greeting = 'Good Evening';
  return greeting;
};

const capabilityStatusFromApprovalStatus = (approvalStatus: TechnicianApprovalStatus): CapabilityStatus => {
  switch (approvalStatus) {
    case TechnicianApprovalStatus.APPROVED:
      return CapabilityStatus.APPROVED;
    case TechnicianApprovalStatus.REJECTED:
    case TechnicianApprovalStatus.SUSPENDED:
      return CapabilityStatus.REJECTED;
    case TechnicianApprovalStatus.PENDING_REVIEW:
    default:
      return CapabilityStatus.PENDING;
  }
};

const hasValidDefaultServiceAddress = (user: any): boolean => {
  const address = user?.defaultServiceAddress;
  return Boolean(
    address &&
    typeof address.fullAddress === 'string' &&
    address.fullAddress.trim() &&
    typeof address.city === 'string' &&
    address.city.trim() &&
    typeof address.suburb === 'string' &&
    address.suburb.trim()
  );
};

const isCustomerProfileComplete = (user: any): boolean => {
  if (!user || normalizeUserRole(user.role) !== UserRole.CUSTOMER) return true;
  if (user.profileCompleted === true) return true;

  return Boolean(
    typeof user.name === 'string' &&
    user.name.trim() &&
    typeof user.phone === 'string' &&
    user.phone.trim() &&
    user.countryCode &&
    user.location?.city &&
    user.location?.area &&
    hasValidDefaultServiceAddress(user)
  );
};

const buildSessionUser = (user: any, req?: Request) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: normalizeUserRole(user.role),
  adminRole: normalizeUserRole(user.role) === UserRole.ADMIN ? user.adminRole || AdminRole.SUPER_ADMIN : undefined,
  adminPermissions: normalizeUserRole(user.role) === UserRole.ADMIN ? user.adminPermissions || [] : [],
  phone: user.phone,
  profilePhotoUrl: user.profilePhotoUrl,
  location: user.location,
  defaultServiceAddress: user.defaultServiceAddress || null,
  countryCode: user.countryCode,
  currency: user.currency,
  profileCompleted: isCustomerProfileComplete(user),
  isEmailVerified: user.isEmailVerified || user.emailVerified,
  mustChangePassword: Boolean(user.mustChangePassword),
  greeting: req ? getLocalizedGreeting(req) : undefined,
});

const buildSessionTechnician = async (technicianProfile: any, user?: any) => {
  if (!technicianProfile) return undefined;

  const countryCode = normalizeCountryCode(technicianProfile.countryCode || user?.countryCode);
  const market = await assertActiveMarket(countryCode);
  const payoutCapabilities = await getMarketPayoutCapabilities(market.identity.countryCode);
  const reviewCount = Number(technicianProfile.stats?.reviewCount || 0);
  const averageRating = reviewCount > 0 ? Number(technicianProfile.stats?.averageRating || 0) : null;

  return {
    id: technicianProfile._id,
    approvalStatus: technicianProfile.approvalStatus,
    countryCode: market.identity.countryCode,
    currency: market.identity.currency,
    serviceCategories: technicianProfile.serviceCategories,
    city: technicianProfile.city,
    businessName: technicianProfile.businessName,
    yearsExperience: technicianProfile.yearsExperience,
    profilePhotoUrl: technicianProfile.documents?.profilePhotoUrl || user?.profilePhotoUrl,
    profilePhotoStatus: technicianProfile.documents?.profilePhotoStatus,
    stats: {
      averageRating,
      reviewCount,
      completedJobs: Number(technicianProfile.stats?.completedJobs || 0),
      cancelledJobs: Number(technicianProfile.stats?.cancelledJobs || 0),
      lifetimeEarningsMinor: Number(technicianProfile.stats?.lifetimeEarningsMinor || 0),
    },
    payoutCapabilities: {
      countryCode: payoutCapabilities.countryCode,
      currency: payoutCapabilities.currency,
      providerPayoutMethods: payoutCapabilities.providerPayoutMethods,
      defaultProviderPayoutMethod: payoutCapabilities.defaultProviderPayoutMethod,
      payoutsEnabled: payoutCapabilities.payoutsEnabled,
      adminApprovalRequired: payoutCapabilities.adminApprovalRequired,
    },
  };
};

const serializeCustomerProfile = async (user: any, req?: Request) => {
  const userId = user._id.toString();
  const [activeRequestCount, completedBookingCount] = await Promise.all([
    Booking.countDocuments({
      customerId: user._id,
      status: {
        $in: [
          BookingStatus.PENDING,
          BookingStatus.ACCEPTED,
          BookingStatus.IN_ROUTE,
          BookingStatus.ARRIVED,
          BookingStatus.IN_PROGRESS,
          BookingStatus.DIAGNOSTIC_DONE,
        ],
      },
    }),
    Booking.countDocuments({
      customerId: user._id,
      status: BookingStatus.COMPLETED,
    }),
  ]);

  return {
    id: userId,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    profilePhotoUrl: user.profilePhotoUrl,
    location: user.location,
    countryCode: user.countryCode,
    currency: user.currency,
    profileCompleted: isCustomerProfileComplete(user),
    isEmailVerified: user.isEmailVerified || user.emailVerified,
    defaultServiceAddress: user.defaultServiceAddress || null,
    stats: {
      activeRequestCount,
      completedBookingCount,
    },
    greeting: req ? getLocalizedGreeting(req) : undefined,
  };
};

export const getMyProfile = async (req: Request, res: Response): Promise<void> => {
  const authUser = getAuthenticatedUser(req);
  const userId = String(authUser?.id ?? authUser?._id ?? '').trim();

  if (!userId) {
    res.status(401).json({ message: 'User identity is required.' });
    return;
  }

  try {
    const user = await User.findById(userId).lean();
    if (!user) {
      res.status(404).json({ message: 'Profile not found.' });
      return;
    }

    res.status(200).json({ success: true, profile: await serializeCustomerProfile(user, req) });
  } catch (error) {
    console.error('Failed to load profile:', error);
    res.status(500).json({ message: 'Failed to load profile.' });
  }
};

export const updateMyDefaultAddress = async (req: Request, res: Response): Promise<void> => {
  const authUser = getAuthenticatedUser(req);
  const userId = String(authUser?.id ?? authUser?._id ?? '').trim();

  if (!userId) {
    res.status(401).json({ message: 'User identity is required.' });
    return;
  }

  const streetAddress = typeof req.body.streetAddress === 'string' ? req.body.streetAddress.trim() : '';
  const suburb = typeof req.body.suburb === 'string' ? req.body.suburb.trim() : '';
  const city = typeof req.body.city === 'string' ? req.body.city.trim() : '';
  const postalCode = typeof req.body.postalCode === 'string' ? req.body.postalCode.trim() : '';
  const countryCode = normalizeCountryCode(req.body.countryCode);
  const latitude = toFiniteNumber(req.body.latitude);
  const longitude = toFiniteNumber(req.body.longitude);

  if (!streetAddress || !suburb || !city || !postalCode) {
    res.status(400).json({ message: 'Street address, suburb, city, and postal code are required.' });
    return;
  }

  if ((latitude !== null && (latitude < -90 || latitude > 90)) || (longitude !== null && (longitude < -180 || longitude > 180))) {
    res.status(400).json({ message: 'Invalid GPS coordinates.' });
    return;
  }

  try {
    if (!(await isMarketActiveForOnboarding(countryCode))) {
      res.status(409).json({ message: 'MyFixer is not accepting service addresses in this market right now.' });
      return;
    }
    const fullAddress = [streetAddress, suburb, city, postalCode].join(', ');
    const defaultServiceAddress: Record<string, unknown> = {
      streetAddress,
      suburb,
      city,
      postalCode,
      countryCode,
      fullAddress,
      updatedAt: new Date(),
    };

    if (latitude !== null && longitude !== null) {
      defaultServiceAddress.coordinates = {
        type: 'Point',
        coordinates: [longitude, latitude],
      };
    }

    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          defaultServiceAddress,
          'location.city': city,
          'location.area': suburb,
          countryCode,
        },
      },
      { new: true, runValidators: true }
    ).lean();

    if (!user) {
      res.status(404).json({ message: 'Profile not found.' });
      return;
    }

    res.status(200).json({ success: true, profile: await serializeCustomerProfile(user, req) });
  } catch (error) {
    console.error('Failed to update default address:', error);
    res.status(500).json({ message: 'Failed to update default address.' });
  }
};

/**
 * @desc    Register a new client or specialist profile matrix
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
export const registerUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, phone, location, password, countryCode } = req.body;

    // 1. Structural Payload Validation
    if (!name || !email || !phone || !location?.city || !password) {
      res.status(400).json({ message: 'Registration payload rejected. Please fill all required fields.' });
      return;
    }

    // 2. Prevent Account Duplication
    const normalizedEmail = email.toLowerCase().trim();
    const resolvedCountryCode = normalizeCountryCode(countryCode ?? location.country);
    const market = await assertActiveMarket(resolvedCountryCode);
    if (!(await isMarketActiveForOnboarding(market.identity.countryCode))) {
      res.status(409).json({ message: 'Padi is not accepting new registrations in this market right now.' });
      return;
    }
    const userExists = await User.findOne({ email: normalizedEmail });
    if (userExists) {
      res.status(409).json({ message: 'An account with this email address already exists.' });
      return;
    }

    // 3. Cryptographic Password Hashing
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 4. Persistence Entry Commit
    const newUser = await User.create({
      name,
      email: normalizedEmail,
      phone: phone.trim(),
      location: {
        country: market.identity.countryName,
        city: location.city.trim(),
        area: typeof location.area === 'string'
          ? location.area.trim()
          : typeof location.neighbourhood === 'string'
            ? location.neighbourhood.trim()
            : typeof location.neighborhood === 'string'
              ? location.neighborhood.trim()
              : '',
      },
      countryCode: market.identity.countryCode,
      currency: market.identity.currency,
      password: hashedPassword,
      role: UserRole.CUSTOMER,
      profileCompleted: true,
      emailVerified: false,
      isEmailVerified: false,
      emailVerificationToken: generateEmailVerificationToken(),
    });

    const verificationEmailSent = await sendVerificationEmail(req, newUser);

    // 5. Auth Token Issuance Matrix
    const token = generateToken(newUser._id.toString(), newUser.role, newUser.email, newUser.refreshTokenVersion || 0);

    res.status(201).json({
      status: 'success',
      token,
      user: buildSessionUser(newUser, req),
      verificationEmailSent,
    });
  } catch (error: any) {
    console.error('❌ Registration processing engine failure:', error);
    res.status(500).json({ message: 'Internal server error processing security footprint registration.' });
  }
};

/**
 * @desc    Authenticate User Session & Return Token
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
export const loginUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // 1. Check Input Presence
    if (!email || !password) {
      res.status(400).json({ message: 'Please provide both an email and password.' });
      return;
    }

    // 2. Lookup Identity Footprint Match
    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select('+password +refreshTokenVersion');
    if (!user) {
      res.status(401).json({ message: 'Invalid credentials. Access Denied.' });
      return;
    }

    if (user.isActive === false) {
      res.status(403).json({ message: 'This account has been deactivated. Please contact support.' });
      return;
    }

    // 3. Compare Cryptographic Fingerprint Signatures
    if (!user.password) {
      res.status(401).json({ message: 'Invalid credentials. Access Denied.' });
      return;
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      res.status(401).json({ message: 'Invalid credentials. Access Denied.' });
      return;
    }

    // 4. Issue Valid Session Handshake Token
    const normalizedRole = normalizeUserRole(user.role);
    let technicianProfile: any = null;
    if (normalizedRole === UserRole.TECHNICIAN) {
      technicianProfile = await Technician.findOne({ userId: user._id });
      if (!technicianProfile) {
        res.status(403).json({ message: 'Technician profile is missing. Please contact support.' });
        return;
      }

      if (!(user.isEmailVerified || user.emailVerified)) {
        res.status(403).json({
          code: 'EMAIL_VERIFICATION_REQUIRED',
          message: 'Please verify your email before accessing the technician dashboard.',
        });
        return;
      }

      if (technicianProfile.approvalStatus !== TechnicianApprovalStatus.APPROVED) {
        res.status(403).json({
          message:
            technicianProfile.approvalStatus === TechnicianApprovalStatus.PENDING_REVIEW
              ? 'Your technician application is still under review.'
              : `Your technician account is ${technicianProfile.approvalStatus.toLowerCase().replace('_', ' ')}.`,
          approvalStatus: technicianProfile.approvalStatus,
        });
        return;
      }
    }

    const now = new Date();
    const previousLoginAt = user.lastLoginAt || null;
    user.lastLoginAt = now;
    await user.save();

    await logAuthAudit(req, 'login.success', {
      email: user.email,
      userId: user._id.toString(),
      role: normalizedRole,
      device: getRequestDeviceLabel(req),
      previousLoginAt,
    });

    if (previousLoginAt) {
      await createSecurityAlert(
        user,
        'New sign-in to your Padi account',
        `Your account was signed in on ${getRequestDeviceLabel(req)}. If this was not you, change your password immediately.`,
        {
          event: 'LOGIN_SUCCESS',
          device: getRequestDeviceLabel(req),
          previousLoginAt,
        }
      );
    }

    const token = generateToken(user._id.toString(), normalizedRole, user.email, user.refreshTokenVersion || 0);

    res.status(200).json({
      status: 'success',
      token,
      requiresPasswordChange: Boolean(user.mustChangePassword),
      user: buildSessionUser(user, req),
      technician: technicianProfile
        ? await buildSessionTechnician(technicianProfile, user)
        : undefined,
    });
  } catch (error: any) {
    console.error('❌ Login authentication mechanism failure:', error);
    res.status(500).json({ message: 'Internal server error verifying profile authentication states.' });
  }
};

export const changeOwnPassword = async (req: Request, res: Response): Promise<void> => {
  const authUser = getAuthenticatedUser(req);
  const userId = String(authUser?.id ?? authUser?._id ?? '').trim();
  const currentPassword = typeof req.body.currentPassword === 'string' ? req.body.currentPassword : '';
  const newPassword = typeof req.body.newPassword === 'string' ? req.body.newPassword : '';

  if (!userId) {
    res.status(401).json({ message: 'Authentication is required.' });
    return;
  }

  if (!currentPassword || !newPassword) {
    res.status(400).json({ message: 'Current password and new password are required.' });
    return;
  }

  if (newPassword.length < 8) {
    res.status(400).json({ message: 'New password must be at least 8 characters long.' });
    return;
  }

  try {
    const user = await User.findById(userId).select('+password +refreshTokenVersion');
    if (!user || user.isActive === false) {
      res.status(404).json({ message: 'Account not found.' });
      return;
    }

    const isPasswordMatch = user.password ? await bcrypt.compare(currentPassword, user.password) : false;
    if (!isPasswordMatch) {
      res.status(401).json({ message: 'Current password is incorrect.' });
      return;
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.mustChangePassword = false;
    user.lastPasswordChangeAt = new Date();
    user.refreshTokenVersion = (user.refreshTokenVersion || 0) + 1;
    await user.save();

    await logAuthAudit(req, 'password_change.complete', {
      email: user.email,
      userId: user._id.toString(),
      forced: Boolean(req.body.forced),
    });

    const token = generateToken(user._id.toString(), normalizeUserRole(user.role), user.email, user.refreshTokenVersion || 0);
    res.status(200).json({
      status: 'success',
      message: 'Password updated successfully.',
      token,
      user: buildSessionUser(user, req),
    });
  } catch (error) {
    console.error('Password change failed:', error);
    res.status(500).json({ message: 'Unable to change password right now.' });
  }
};

export const getMySecuritySummary = async (req: Request, res: Response): Promise<void> => {
  const authUser = getAuthenticatedUser(req);
  const userId = String(authUser?.id ?? authUser?._id ?? '').trim();

  if (!userId) {
    res.status(401).json({ message: 'Authentication is required.' });
    return;
  }

  try {
    const user = await User.findById(userId).select('+refreshTokenVersion').lean();
    if (!user || user.isActive === false) {
      res.status(404).json({ message: 'Account not found.' });
      return;
    }

    const recentAuthEvents = await AuditLog.find({
      'event.module': 'AUTH',
      'event.resourceType': 'User',
      $or: [
        { 'event.resourceId': userId },
        { 'actor.email': user.email },
        { 'metadata.userId': userId },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(6)
      .lean();

    res.status(200).json({
      success: true,
      security: {
        email: user.email,
        emailVerified: Boolean(user.isEmailVerified || user.emailVerified),
        phoneVerified: Boolean(user.phoneVerified),
        lastLoginAt: user.lastLoginAt || null,
        lastPasswordChangeAt: user.lastPasswordChangeAt || null,
        tokenVersion: user.refreshTokenVersion || 0,
        currentDevice: {
          label: getRequestDeviceLabel(req),
          userAgent: String(req.headers['user-agent'] || ''),
        },
        recentEvents: recentAuthEvents.map((event) => ({
          id: event._id?.toString(),
          action: event.event?.action || '',
          success: Boolean(event.success),
          createdAt: event.createdAt,
          device: event.request?.device || event.metadata?.device || '',
        })),
      },
    });
  } catch (error) {
    console.error('Failed to load security summary:', error);
    res.status(500).json({ message: 'Unable to load security settings right now.' });
  }
};

export const signOutOtherSessions = async (req: Request, res: Response): Promise<void> => {
  const authUser = getAuthenticatedUser(req);
  const userId = String(authUser?.id ?? authUser?._id ?? '').trim();

  if (!userId) {
    res.status(401).json({ message: 'Authentication is required.' });
    return;
  }

  try {
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $inc: { refreshTokenVersion: 1 },
        $set: { updatedAt: new Date() },
      },
      { new: true }
    ).select('+refreshTokenVersion');

    if (!user || user.isActive === false) {
      res.status(404).json({ message: 'Account not found.' });
      return;
    }

    await logAuthAudit(req, 'sessions.sign_out_others', {
      email: user.email,
      userId: user._id.toString(),
      device: getRequestDeviceLabel(req),
    });

    await createSecurityAlert(
      user,
      'Other sessions were signed out',
      'All older Padi sessions were signed out. This device remains signed in.',
      { event: 'SIGN_OUT_OTHER_SESSIONS', device: getRequestDeviceLabel(req) }
    );

    const token = generateToken(user._id.toString(), normalizeUserRole(user.role), user.email, user.refreshTokenVersion || 0);
    res.status(200).json({
      success: true,
      message: 'Other sessions were signed out.',
      token,
      user: buildSessionUser(user, req),
      technician: normalizeUserRole(user.role) === UserRole.TECHNICIAN
        ? await buildSessionTechnician(await Technician.findOne({ userId: user._id }), user)
        : undefined,
    });
  } catch (error) {
    console.error('Failed to sign out other sessions:', error);
    res.status(500).json({ message: 'Unable to sign out other sessions right now.' });
  }
};

export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  const shouldReturnJson = wantsJsonResponse(req);

  try {
    const token =
      typeof req.query.token === 'string'
        ? req.query.token.trim()
        : typeof req.body.token === 'string'
          ? req.body.token.trim()
          : '';

    if (!token) {
      if (shouldReturnJson) {
        res.status(400).json({ message: 'Email verification token is required.' });
        return;
      }

      res.status(400).send(renderEmailVerificationPage({
        status: 'error',
        title: 'Verification link missing',
        message: 'This verification link is missing its security token. Please request a new verification email.',
      }));
      return;
    }

    const user = await User.findOne({ emailVerificationToken: token }).select('+emailVerificationToken');
    if (!user) {
      if (shouldReturnJson) {
        res.status(400).json({ message: 'The verification link is invalid or has already been used.' });
        return;
      }

      res.status(400).send(renderEmailVerificationPage({
        status: 'error',
        title: 'Link expired or already used',
        message: 'This email verification link is invalid or has already been used. Open Padi and request a fresh verification email if needed.',
      }));
      return;
    }

    const verifiedRole = normalizeUserRole(user.role);
    const openAppUrl = verifiedRole === UserRole.TECHNICIAN
      ? process.env.TECHNICIAN_APP_DEEP_LINK || 'myfixertechnician://email-verified'
      : process.env.CLIENT_APP_DEEP_LINK || 'myfixerclient://email-verified';
    const successMessage = verifiedRole === UserRole.TECHNICIAN
      ? 'Your Padi Pro email is verified. You can return to the technician app while your application is reviewed.'
      : 'Your Padi email is verified. You can return to the app and continue booking services.';
    const openAppLabel = verifiedRole === UserRole.TECHNICIAN ? 'Open Padi Pro' : 'Open Padi';
    const returnAppLabel = verifiedRole === UserRole.TECHNICIAN ? 'Padi Pro' : 'Padi';

    if (!(user.emailVerified || user.isEmailVerified)) {
      user.emailVerified = true;
      user.isEmailVerified = true;
      await user.save();
    }

    if (shouldReturnJson) {
      res.status(200).json({ status: 'success', message: 'Email verified successfully.' });
      return;
    }

    res.status(200).send(renderEmailVerificationPage({
      status: 'success',
      title: 'Email verified',
      message: successMessage,
      openAppUrl,
      openAppLabel,
      returnAppLabel,
    }));
  } catch (error) {
    console.error('Email verification failed:', error);
    if (shouldReturnJson) {
      res.status(500).json({ message: 'Unable to verify email right now.' });
      return;
    }

    res.status(500).send(renderEmailVerificationPage({
      status: 'error',
      title: 'Verification unavailable',
      message: 'We could not verify your email right now. Please try the link again in a few minutes.',
    }));
  }
};

export const googleAuth = async (req: Request, res: Response): Promise<void> => {
  try {
    const idToken =
      typeof req.body.idToken === 'string'
        ? req.body.idToken.trim()
        : typeof req.body.googleToken === 'string'
          ? req.body.googleToken.trim()
          : '';

    if (!idToken) {
      res.status(400).json({ message: 'Google idToken is required.' });
      return;
    }

    const payload = await verifyGoogleIdToken(idToken);
    const email = typeof payload?.email === 'string' ? payload.email.toLowerCase().trim() : '';
    const googleSubject = typeof payload?.sub === 'string' ? payload.sub : '';
    const emailVerified = payload?.email_verified === true;

    if (!email || !googleSubject || !emailVerified) {
      res.status(401).json({ message: 'Google token payload is invalid or email is not verified.' });
      return;
    }

    const name =
      (typeof payload?.name === 'string' && payload.name.trim()) ||
      (typeof req.body.name === 'string' && req.body.name.trim()) ||
      email.split('@')[0];

    const user = await User.findOne({ email });

    if (!user) {
      res.status(200).json({
        status: 'profile_required',
        message: 'Complete your MyFixer profile to continue.',
        googleProfile: {
          email,
          name,
          googleSubject,
        },
      });
      return;
    }

    if (user.isActive === false) {
      res.status(403).json({ message: 'This account has been deactivated. Please contact support.' });
      return;
    }

    user.lastLoginAt = new Date();
    user.metadata = {
      ...(user.metadata || {}),
      googleSubject,
      authProvider: user.metadata?.authProvider || 'GOOGLE',
    };
    if (!user.name && name) user.name = name;
    await user.save();

    const token = generateToken(user._id.toString(), normalizeUserRole(user.role), user.email, user.refreshTokenVersion || 0);
    const sessionUser = buildSessionUser(user, req);
    const normalizedRole = normalizeUserRole(user.role);
    let technicianProfile: any = null;

    if (normalizedRole === UserRole.TECHNICIAN) {
      technicianProfile = await Technician.findOne({ userId: user._id });
      if (technicianProfile && !(user.isEmailVerified || user.emailVerified)) {
        res.status(200).json({
          status: 'email_verification_required',
          token,
          user: sessionUser,
          technician: await buildSessionTechnician(technicianProfile, user),
          message: 'Please verify your email before accessing the technician dashboard.',
        });
        return;
      }

      if (!technicianProfile || technicianProfile.approvalStatus !== TechnicianApprovalStatus.APPROVED) {
        res.status(403).json({
          message: technicianProfile?.approvalStatus === TechnicianApprovalStatus.PENDING_REVIEW
            ? 'Your technician application is still under review.'
            : 'This technician account is not approved yet.',
          approvalStatus: technicianProfile?.approvalStatus,
        });
        return;
      }
    }

    if (normalizedRole === UserRole.CUSTOMER && !sessionUser.profileCompleted) {
      res.status(200).json({
        status: 'profile_required',
        token,
        user: sessionUser,
        googleProfile: { email, name, googleSubject },
        message: 'Complete your MyFixer profile to continue.',
      });
      return;
    }

    if (normalizedRole === UserRole.CUSTOMER && !sessionUser.isEmailVerified) {
      res.status(200).json({
        status: 'email_verification_required',
        token,
        user: sessionUser,
        message: 'Please verify your email before booking a service.',
      });
      return;
    }

    res.status(200).json({
      status: 'success',
      token,
      user: sessionUser,
      technician: technicianProfile
        ? await buildSessionTechnician(technicianProfile, user)
        : undefined,
    });
  } catch (error) {
    console.error('Google auth failed:', error);
    res.status(500).json({ message: 'Unable to authenticate with Google right now.' });
  }
};

export const completeGoogleClientProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const idToken = typeof req.body.idToken === 'string' ? req.body.idToken.trim() : '';
    const payload = idToken ? await verifyGoogleIdToken(idToken) : null;
    const email = typeof payload?.email === 'string' ? payload.email.toLowerCase().trim() : '';
    const googleSubject = typeof payload?.sub === 'string' ? payload.sub : '';

    if (!email || !googleSubject || payload?.email_verified !== true) {
      res.status(401).json({ message: 'Valid Google sign-in is required.' });
      return;
    }

    const name = typeof req.body.name === 'string' && req.body.name.trim()
      ? req.body.name.trim()
      : typeof payload?.name === 'string' && payload.name.trim()
        ? payload.name.trim()
        : '';
    const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
    const countryCode = normalizeCountryCode(req.body.countryCode ?? req.body.defaultServiceAddress?.countryCode);
    const city = typeof req.body.city === 'string' ? req.body.city.trim() : '';
    const area = typeof req.body.area === 'string' ? req.body.area.trim() : '';
    const consent = req.body.consent === true;
    const addressInput = req.body.defaultServiceAddress || {};
    const streetAddress = typeof addressInput.streetAddress === 'string' ? addressInput.streetAddress.trim() : '';
    const suburb = typeof addressInput.suburb === 'string' && addressInput.suburb.trim()
      ? addressInput.suburb.trim()
      : area;
    const postalCode = typeof addressInput.postalCode === 'string' ? addressInput.postalCode.trim() : '';
    const fullAddress = typeof addressInput.fullAddress === 'string' && addressInput.fullAddress.trim()
      ? addressInput.fullAddress.trim()
      : [streetAddress, suburb, city, postalCode].filter(Boolean).join(', ');
    const latitude = toFiniteNumber(addressInput.latitude);
    const longitude = toFiniteNumber(addressInput.longitude);

    if (!name || !phone || !countryCode || !city || !area || !fullAddress || !consent) {
      res.status(400).json({ message: 'Name, phone, country, city, area, service address, and consent are required.' });
      return;
    }

    if ((latitude !== null && (latitude < -90 || latitude > 90)) || (longitude !== null && (longitude < -180 || longitude > 180))) {
      res.status(400).json({ message: 'Invalid service address coordinates.' });
      return;
    }

    const market = await assertActiveMarket(countryCode);
    if (!(await isMarketActiveForOnboarding(market.identity.countryCode))) {
      res.status(409).json({ message: 'MyFixer is not accepting new registrations in this market right now.' });
      return;
    }
    const existingUser = await User.findOne({ email });
    if (existingUser && normalizeUserRole(existingUser.role) !== UserRole.CUSTOMER) {
      res.status(409).json({ message: 'This Google account is already linked to another MyFixer role.' });
      return;
    }

    const defaultServiceAddress: Record<string, unknown> = {
      streetAddress: streetAddress || fullAddress,
      suburb,
      city,
      postalCode,
      countryCode: market.identity.countryCode,
      fullAddress,
      updatedAt: new Date(),
    };

    if (latitude !== null && longitude !== null) {
      defaultServiceAddress.coordinates = {
        type: 'Point',
        coordinates: [longitude, latitude],
      };
    }

    const emailVerificationToken = generateEmailVerificationToken();
    const user = await User.findOneAndUpdate(
      { email },
      {
        $set: {
          name,
          phone,
          location: {
            country: market.identity.countryName,
            city,
            area,
          },
          defaultServiceAddress,
          countryCode: market.identity.countryCode,
          currency: market.identity.currency,
          profileCompleted: true,
          emailVerified: existingUser?.emailVerified || false,
          isEmailVerified: existingUser?.isEmailVerified || false,
          emailVerificationToken: existingUser?.isEmailVerified || existingUser?.emailVerified ? '' : emailVerificationToken,
          lastLoginAt: new Date(),
          'metadata.googleSubject': googleSubject,
          'metadata.authProvider': 'GOOGLE',
          'metadata.googleConsentAt': new Date(),
        },
        $setOnInsert: {
          email,
          password: crypto.randomBytes(24).toString('hex'),
          role: UserRole.CUSTOMER,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    );

    const verificationUser = user.isEmailVerified || user.emailVerified
      ? null
      : await User.findById(user._id).select('+emailVerificationToken');
    const verificationEmailSent = verificationUser
      ? await sendVerificationEmail(req, verificationUser)
      : false;
    const token = generateToken(user._id.toString(), UserRole.CUSTOMER, user.email, user.refreshTokenVersion || 0);
    const emailVerified = Boolean(user.isEmailVerified || user.emailVerified);

    console.info('[auth.google.complete-profile] verification email result', {
      email: user.email,
      emailVerified,
      verificationEmailSent,
    });

    res.status(200).json({
      status: emailVerified ? 'success' : 'email_verification_required',
      token,
      user: buildSessionUser(user, req),
      verificationEmailSent,
      message: emailVerified
        ? 'Profile completed.'
        : 'Profile completed. Please verify your email before booking a service.',
    });
  } catch (error) {
    console.error('Google profile completion failed:', error);
    res.status(500).json({ message: 'Unable to complete Google profile right now.' });
  }
};

export const bootstrapAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const setupKey = req.headers['x-admin-setup-key'] ?? req.body.setupKey;
    const expectedSetupKey = process.env.ADMIN_SETUP_KEY;

    if (!expectedSetupKey || setupKey !== expectedSetupKey) {
      res.status(403).json({ message: 'Admin setup is not authorized.' });
      return;
    }

    const existingAdmin = await User.findOne({ role: UserRole.ADMIN });
    if (existingAdmin) {
      res.status(409).json({ message: 'An admin account already exists.' });
      return;
    }

    const { name, email, phone, password, countryCode, location } = req.body;
    if (!name || !email || !phone || !password) {
      res.status(400).json({ message: 'Name, email, phone, and password are required.' });
      return;
    }

    const resolvedCountryCode = normalizeCountryCode(countryCode ?? location?.country);
    const market = await assertActiveMarket(resolvedCountryCode);
    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      location: {
        country: market.identity.countryName,
        city: location?.city?.trim() || 'Head Office',
        area: typeof location?.area === 'string' ? location.area.trim() : '',
      },
      countryCode: market.identity.countryCode,
      currency: market.identity.currency,
      password: hashedPassword,
      role: UserRole.ADMIN,
      adminRole: AdminRole.SUPER_ADMIN,
      adminPermissions: [],
    });

    res.status(201).json({
      status: 'success',
      user: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        adminRole: admin.adminRole,
      },
    });
  } catch (error) {
    console.error('Admin bootstrap failed:', error);
    res.status(500).json({ message: 'Unable to bootstrap admin account.' });
  }
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      res.status(400).json({ message: 'Please provide a valid email address.' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const genericResponse = {
      status: 'success',
      message: 'If this email exists, reset instructions have been sent.',
    };

    const user = await User.findOne({ email: normalizedEmail, role: UserRole.ADMIN });
    if (!user || user.isActive === false) {
      await logAuthAudit(req, 'password_reset.request', { email: normalizedEmail, accountMatched: false }, true);
      res.status(200).json(genericResponse);
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = hashResetToken(resetToken);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordResetTokenHash: resetTokenHash,
          passwordResetExpiresAt: expiresAt,
          updatedAt: new Date(),
        },
      }
    );

    const portalBaseUrl = process.env.ADMIN_PORTAL_URL?.trim().replace(/\/$/, '');
    const resetUrl = portalBaseUrl
      ? `${portalBaseUrl}?resetToken=${resetToken}&email=${encodeURIComponent(normalizedEmail)}`
      : '';
    const emailSent = resetUrl
      ? await EmailService.sendPasswordResetEmail({
          recipientEmail: normalizedEmail,
          name: user.name,
          resetUrl,
        })
      : false;

    await logAuthAudit(req, 'password_reset.request', {
      email: normalizedEmail,
      userId: user._id.toString(),
      emailSent,
      expiresAt,
    });

    res.status(200).json(genericResponse);
  } catch (error) {
    console.error('Password reset request failed:', error);
    res.status(200).json({
      status: 'success',
      message: 'If this email exists, reset instructions have been sent.',
    });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, token, password } = req.body;

    if (!email || typeof email !== 'string' || !token || typeof token !== 'string' || !password || typeof password !== 'string') {
      res.status(400).json({ message: 'Email, reset token, and new password are required.' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ message: 'Password must be at least 6 characters long.' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const tokenHash = hashResetToken(token);
    const user = await User.findOne({
      email: normalizedEmail,
      role: UserRole.ADMIN,
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { $gt: new Date() },
    }).select('+passwordResetTokenHash +passwordResetExpiresAt +refreshTokenVersion');

    if (!user) {
      await logAuthAudit(req, 'password_reset.complete', { email: normalizedEmail, accountMatched: false }, false);
      res.status(400).json({ message: 'The reset link is invalid or has expired.' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          password: hashedPassword,
          lastPasswordChangeAt: new Date(),
          mustChangePassword: false,
          passwordResetTokenHash: '',
          passwordResetExpiresAt: null,
          updatedAt: new Date(),
        },
        $inc: { refreshTokenVersion: 1 },
      }
    );

    await logAuthAudit(req, 'password_reset.complete', {
      email: normalizedEmail,
      userId: user._id.toString(),
    });

    res.status(200).json({ status: 'success', message: 'Password reset complete. You can now sign in.' });
  } catch (error) {
    console.error('Password reset failed:', error);
    res.status(500).json({ message: 'Unable to reset password right now.' });
  }
};

export const registerTechnician = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      email,
      phone,
      location,
      password,
      countryCode,
      serviceCategories,
      yearsExperience,
      businessName,
      idNumber,
      vehicleType,
      serviceRadiusKm,
      bio,
      documents,
      banking,
    } = req.body;

    if (!name || !email || !phone || !location?.city || !password) {
      res.status(400).json({ message: 'Please complete all required technician registration fields.' });
      return;
    }

    const profilePhotoDataUri =
      typeof documents?.profilePhotoDataUri === 'string'
        ? documents.profilePhotoDataUri.trim()
        : typeof documents?.profilePhotoBase64 === 'string'
          ? documents.profilePhotoBase64.trim()
          : '';

    if (!profilePhotoDataUri.startsWith('data:image/')) {
      res.status(400).json({ message: 'A clear technician profile photo is required for admin review.' });
      return;
    }

    if (!Array.isArray(serviceCategories) || serviceCategories.length === 0) {
      res.status(400).json({ message: 'Please select at least one service category.' });
      return;
    }

    const normalizedServiceCategories = Array.from(
      new Set(serviceCategories.map((item: unknown) => normalizeServiceKey(item)).filter(Boolean))
    );

    if (password.length < 6) {
      res.status(400).json({ message: 'Password must be at least 6 characters long.' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      res.status(409).json({ message: 'An account with this email address already exists.' });
      return;
    }

    const resolvedCountryCode = normalizeCountryCode(countryCode ?? location.country);
    const market = await assertActiveMarket(resolvedCountryCode);
    if (!(await isMarketActiveForOnboarding(market.identity.countryCode))) {
      res.status(409).json({ message: 'MyFixer is not accepting new technician registrations in this market right now.' });
      return;
    }
    const marketAvailability = await getMarketAvailability(resolvedCountryCode, location.city, location.area ?? location.neighbourhood ?? location.neighborhood);
    const bookableServiceKeys = new Set(
      marketAvailability.services
        .filter((service) => service.canBook)
        .map((service) => service.serviceKey)
    );
    const availableServiceCategories = normalizedServiceCategories.filter((serviceKey) => bookableServiceKeys.has(serviceKey));

    if (availableServiceCategories.length === 0) {
      res.status(400).json({ message: 'Please select at least one active service category in your country or city.' });
      return;
    }

    const approvalStatus = TechnicianApprovalStatus.PENDING_REVIEW;

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      location: {
        country: market.identity.countryName,
        city: location.city.trim(),
        area: typeof location.area === 'string'
          ? location.area.trim()
          : typeof location.neighbourhood === 'string'
            ? location.neighbourhood.trim()
            : typeof location.neighborhood === 'string'
              ? location.neighborhood.trim()
              : '',
      },
      countryCode: market.identity.countryCode,
      currency: market.identity.currency,
      password: hashedPassword,
      role: UserRole.TECHNICIAN,
      emailVerified: false,
      isEmailVerified: false,
      emailVerificationToken: generateEmailVerificationToken(),
    });

    const verificationEmailSent = await sendVerificationEmail(req, user);

    const uploadedProfilePhoto = await uploadImageToCloudinary({
      dataUri: profilePhotoDataUri,
      folder: `myfixer/technicians/${user._id.toString()}/profile`,
      publicId: `profile-photo-${Date.now()}`,
    });

    const technician = await Technician.create({
      userId: user._id,
      approvalStatus,
      countryCode: market.identity.countryCode,
      city: location.city.trim(),
      serviceCategories: availableServiceCategories,
      yearsExperience: Number.isFinite(Number(yearsExperience)) ? Number(yearsExperience) : 0,
      businessName: typeof businessName === 'string' ? businessName.trim() : '',
      idNumberLast4: typeof idNumber === 'string' ? idNumber.trim().slice(-4) : '',
      vehicleType: typeof vehicleType === 'string' ? vehicleType.trim() : '',
      serviceRadiusKm: Number.isFinite(Number(serviceRadiusKm)) ? Number(serviceRadiusKm) : 25,
      bio: typeof bio === 'string' ? bio.trim() : '',
      documents: {
        idDocumentUrl: documents?.idDocumentUrl ?? '',
        tradeCertificateUrl: documents?.tradeCertificateUrl ?? '',
        policeClearanceUrl: documents?.policeClearanceUrl ?? '',
        profilePhotoUrl: uploadedProfilePhoto.url,
        profilePhotoStatus: VerificationStatus.SUBMITTED,
      },
      banking: {
        accountHolder: banking?.accountHolder ?? '',
        bankName: banking?.bankName ?? '',
        accountNumberLast4: banking?.accountNumberLast4 ?? '',
      },
      review: {
        reviewedAt: null,
        reviewedBy: null,
        rejectionReason: '',
        suspensionReason: '',
      },
    });

    const normalizedServiceRadiusKm = Number.isFinite(Number(serviceRadiusKm)) ? Number(serviceRadiusKm) : 25;
    const capabilityStatus = capabilityStatusFromApprovalStatus(approvalStatus);
    await TechnicianCapability.insertMany(
      technician.serviceCategories.map((categorySlug) => ({
        technicianId: technician._id,
        categorySlug,
        approvedSpecialties: [],
        verificationStatus: capabilityStatus,
        serviceRadiusKm: normalizedServiceRadiusKm,
        rejectionReason: null,
      })),
      { ordered: false }
    );

    await TechnicianTelemetry.create({
      technicianId: technician._id,
      isOnDuty: false,
      connectionStatus: 'DISCONNECTED',
      location: technician.lastLocation ?? null,
    });

    const token = null;

    res.status(201).json({
      status: 'success',
      message: 'Technician application submitted for review.',
      token,
      user: token
        ? {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            phone: user.phone,
            profilePhotoUrl: user.profilePhotoUrl,
            location: user.location,
            defaultServiceAddress: user.defaultServiceAddress || null,
            countryCode: user.countryCode,
            currency: user.currency,
            isEmailVerified: user.isEmailVerified,
            greeting: getLocalizedGreeting(req),
          }
        : null,
      technician: await buildSessionTechnician(technician, user),
      verificationEmailSent,
    });
  } catch (error) {
    console.error('Technician registration failed:', error);
    res.status(500).json({ message: 'Unable to submit technician registration.' });
  }
};
