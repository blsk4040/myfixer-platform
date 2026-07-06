// mobile_apps/backend/src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User, { AdminRole, normalizeUserRole, UserRole } from '../models/user.model';
import { getMarketByCountry, normalizeCountryCode } from '../config/market.config';
import Technician, { TechnicianApprovalStatus } from '../models/technician.model';
import TechnicianCapability, { CapabilityStatus } from '../models/technician-capability.model';
import TechnicianTelemetry from '../models/technician-telemetry.model';
import AuditLog from '../models/audit-log.model';
import { EmailService } from '../services/email/email.service';
import Booking, { BookingStatus } from '../models/booking.model';
import { normalizeServiceKey } from '../services/service-availability.service';

// --- JWT Helper Generator ---
const generateToken = (userId: string, role: UserRole, email: string): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured.');
  }

  return jwt.sign({ id: userId, _id: userId, role, email }, secret, { expiresIn: '30d' });
};

const hashResetToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

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

const getAuthenticatedUser = (req: Request) =>
  (req as any).user as { id?: string; _id?: string; email?: string; role?: string } | undefined;

const toFiniteNumber = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

const serializeCustomerProfile = async (user: any) => {
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
    defaultServiceAddress: user.defaultServiceAddress || null,
    stats: {
      activeRequestCount,
      completedBookingCount,
    },
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

    res.status(200).json({ success: true, profile: await serializeCustomerProfile(user) });
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

    res.status(200).json({ success: true, profile: await serializeCustomerProfile(user) });
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
    const market = getMarketByCountry(resolvedCountryCode);
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
        country: market.countryName,
        city: location.city.trim(),
        area: typeof location.area === 'string'
          ? location.area.trim()
          : typeof location.neighbourhood === 'string'
            ? location.neighbourhood.trim()
            : typeof location.neighborhood === 'string'
              ? location.neighborhood.trim()
              : '',
      },
      countryCode: market.countryCode,
      currency: market.currency,
      password: hashedPassword,
      role: UserRole.CUSTOMER,
    });

    // 5. Auth Token Issuance Matrix
    const token = generateToken(newUser._id.toString(), newUser.role, newUser.email);

    res.status(201).json({
      status: 'success',
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        phone: newUser.phone,
        location: newUser.location,
        defaultServiceAddress: newUser.defaultServiceAddress || null,
        countryCode: newUser.countryCode,
        currency: newUser.currency,
      },
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
    const user = await User.findOne({ email: normalizedEmail }).select('+password');
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

    const token = generateToken(user._id.toString(), normalizedRole, user.email);

    res.status(200).json({
      status: 'success',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: normalizedRole,
        adminRole: normalizedRole === UserRole.ADMIN ? user.adminRole || AdminRole.SUPER_ADMIN : undefined,
        adminPermissions: normalizedRole === UserRole.ADMIN ? user.adminPermissions || [] : [],
        phone: user.phone,
        profilePhotoUrl: user.profilePhotoUrl,
        location: user.location,
        defaultServiceAddress: user.defaultServiceAddress || null,
        countryCode: user.countryCode,
        currency: user.currency,
      },
      technician: technicianProfile
        ? {
            id: technicianProfile._id,
            approvalStatus: technicianProfile.approvalStatus,
            serviceCategories: technicianProfile.serviceCategories,
            city: technicianProfile.city,
            businessName: technicianProfile.businessName,
            yearsExperience: technicianProfile.yearsExperience,
            profilePhotoUrl: technicianProfile.documents?.profilePhotoUrl || user.profilePhotoUrl,
          }
        : undefined,
    });
  } catch (error: any) {
    console.error('❌ Login authentication mechanism failure:', error);
    res.status(500).json({ message: 'Internal server error verifying profile authentication states.' });
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
    const market = getMarketByCountry(resolvedCountryCode);
    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      location: {
        country: market.countryName,
        city: location?.city?.trim() || 'Head Office',
        area: typeof location?.area === 'string' ? location.area.trim() : '',
      },
      countryCode: market.countryCode,
      currency: market.currency,
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

    if (!Array.isArray(serviceCategories) || serviceCategories.length === 0) {
      res.status(400).json({ message: 'Please select at least one service category.' });
      return;
    }

    const normalizedServiceCategories = Array.from(
      new Set(serviceCategories.map((item: unknown) => normalizeServiceKey(item)).filter(Boolean))
    );

    if (normalizedServiceCategories.length === 0) {
      res.status(400).json({ message: 'Please select at least one valid service category.' });
      return;
    }

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
    const market = getMarketByCountry(resolvedCountryCode);
    const autoApprove = process.env.TECHNICIAN_AUTO_APPROVE === 'true';
    const approvalStatus = autoApprove
      ? TechnicianApprovalStatus.APPROVED
      : TechnicianApprovalStatus.PENDING_REVIEW;

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      location: {
        country: market.countryName,
        city: location.city.trim(),
        area: typeof location.area === 'string'
          ? location.area.trim()
          : typeof location.neighbourhood === 'string'
            ? location.neighbourhood.trim()
            : typeof location.neighborhood === 'string'
              ? location.neighborhood.trim()
              : '',
      },
      countryCode: market.countryCode,
      currency: market.currency,
      password: hashedPassword,
      role: UserRole.TECHNICIAN,
    });

    const technician = await Technician.create({
      userId: user._id,
      approvalStatus,
      countryCode: market.countryCode,
      city: location.city.trim(),
      serviceCategories: normalizedServiceCategories,
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
        profilePhotoUrl: documents?.profilePhotoUrl ?? '',
      },
      banking: {
        accountHolder: banking?.accountHolder ?? '',
        bankName: banking?.bankName ?? '',
        accountNumberLast4: banking?.accountNumberLast4 ?? '',
      },
      review: {
        reviewedAt: autoApprove ? new Date() : null,
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

    const token = autoApprove ? generateToken(user._id.toString(), UserRole.TECHNICIAN, user.email) : null;

    res.status(201).json({
      status: 'success',
      message: autoApprove
        ? 'Technician profile approved automatically.'
        : 'Technician application submitted for review.',
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
          }
        : null,
      technician: {
        id: technician._id,
        approvalStatus: technician.approvalStatus,
        serviceCategories: technician.serviceCategories,
        city: technician.city,
        businessName: technician.businessName,
        yearsExperience: technician.yearsExperience,
        profilePhotoUrl: technician.documents?.profilePhotoUrl || user.profilePhotoUrl,
      },
    });
  } catch (error) {
    console.error('Technician registration failed:', error);
    res.status(500).json({ message: 'Unable to submit technician registration.' });
  }
};
