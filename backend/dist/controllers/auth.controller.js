"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTechnician = exports.resetPassword = exports.forgotPassword = exports.bootstrapAdmin = exports.loginUser = exports.registerUser = exports.updateMyDefaultAddress = exports.getMyProfile = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_model_1 = __importStar(require("../models/user.model"));
const market_config_1 = require("../config/market.config");
const technician_model_1 = __importStar(require("../models/technician.model"));
const technician_capability_model_1 = __importStar(require("../models/technician-capability.model"));
const technician_telemetry_model_1 = __importDefault(require("../models/technician-telemetry.model"));
const audit_log_model_1 = __importDefault(require("../models/audit-log.model"));
const email_service_1 = require("../services/email/email.service");
const booking_model_1 = __importStar(require("../models/booking.model"));
const service_availability_service_1 = require("../services/service-availability.service");
// --- JWT Helper Generator ---
const generateToken = (userId, role, email) => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET is not configured.');
    }
    return jsonwebtoken_1.default.sign({ id: userId, _id: userId, role, email }, secret, { expiresIn: '30d' });
};
const hashResetToken = (token) => crypto_1.default.createHash('sha256').update(token).digest('hex');
const logAuthAudit = async (req, action, metadata = {}, success = true) => {
    await audit_log_model_1.default.create({
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
const getAuthenticatedUser = (req) => req.user;
const toFiniteNumber = (value) => {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};
const capabilityStatusFromApprovalStatus = (approvalStatus) => {
    switch (approvalStatus) {
        case technician_model_1.TechnicianApprovalStatus.APPROVED:
            return technician_capability_model_1.CapabilityStatus.APPROVED;
        case technician_model_1.TechnicianApprovalStatus.REJECTED:
        case technician_model_1.TechnicianApprovalStatus.SUSPENDED:
            return technician_capability_model_1.CapabilityStatus.REJECTED;
        case technician_model_1.TechnicianApprovalStatus.PENDING_REVIEW:
        default:
            return technician_capability_model_1.CapabilityStatus.PENDING;
    }
};
const serializeCustomerProfile = async (user) => {
    const userId = user._id.toString();
    const [activeRequestCount, completedBookingCount] = await Promise.all([
        booking_model_1.default.countDocuments({
            customerId: user._id,
            status: {
                $in: [
                    booking_model_1.BookingStatus.PENDING,
                    booking_model_1.BookingStatus.ACCEPTED,
                    booking_model_1.BookingStatus.IN_ROUTE,
                    booking_model_1.BookingStatus.ARRIVED,
                    booking_model_1.BookingStatus.DIAGNOSTIC_DONE,
                ],
            },
        }),
        booking_model_1.default.countDocuments({
            customerId: user._id,
            status: booking_model_1.BookingStatus.COMPLETED,
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
const getMyProfile = async (req, res) => {
    const authUser = getAuthenticatedUser(req);
    const userId = String(authUser?.id ?? authUser?._id ?? '').trim();
    if (!userId) {
        res.status(401).json({ message: 'User identity is required.' });
        return;
    }
    try {
        const user = await user_model_1.default.findById(userId).lean();
        if (!user) {
            res.status(404).json({ message: 'Profile not found.' });
            return;
        }
        res.status(200).json({ success: true, profile: await serializeCustomerProfile(user) });
    }
    catch (error) {
        console.error('Failed to load profile:', error);
        res.status(500).json({ message: 'Failed to load profile.' });
    }
};
exports.getMyProfile = getMyProfile;
const updateMyDefaultAddress = async (req, res) => {
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
    const countryCode = (0, market_config_1.normalizeCountryCode)(req.body.countryCode);
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
        const defaultServiceAddress = {
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
        const user = await user_model_1.default.findByIdAndUpdate(userId, {
            $set: {
                defaultServiceAddress,
                'location.city': city,
                'location.area': suburb,
                countryCode,
            },
        }, { new: true, runValidators: true }).lean();
        if (!user) {
            res.status(404).json({ message: 'Profile not found.' });
            return;
        }
        res.status(200).json({ success: true, profile: await serializeCustomerProfile(user) });
    }
    catch (error) {
        console.error('Failed to update default address:', error);
        res.status(500).json({ message: 'Failed to update default address.' });
    }
};
exports.updateMyDefaultAddress = updateMyDefaultAddress;
/**
 * @desc    Register a new client or specialist profile matrix
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
const registerUser = async (req, res) => {
    try {
        const { name, email, phone, location, password, countryCode } = req.body;
        // 1. Structural Payload Validation
        if (!name || !email || !phone || !location?.city || !password) {
            res.status(400).json({ message: 'Registration payload rejected. Please fill all required fields.' });
            return;
        }
        // 2. Prevent Account Duplication
        const normalizedEmail = email.toLowerCase().trim();
        const resolvedCountryCode = (0, market_config_1.normalizeCountryCode)(countryCode ?? location.country);
        const market = (0, market_config_1.getMarketByCountry)(resolvedCountryCode);
        const userExists = await user_model_1.default.findOne({ email: normalizedEmail });
        if (userExists) {
            res.status(409).json({ message: 'An account with this email address already exists.' });
            return;
        }
        // 3. Cryptographic Password Hashing
        const saltRounds = 10;
        const hashedPassword = await bcrypt_1.default.hash(password, saltRounds);
        // 4. Persistence Entry Commit
        const newUser = await user_model_1.default.create({
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
            role: user_model_1.UserRole.CUSTOMER,
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
    }
    catch (error) {
        console.error('❌ Registration processing engine failure:', error);
        res.status(500).json({ message: 'Internal server error processing security footprint registration.' });
    }
};
exports.registerUser = registerUser;
/**
 * @desc    Authenticate User Session & Return Token
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        // 1. Check Input Presence
        if (!email || !password) {
            res.status(400).json({ message: 'Please provide both an email and password.' });
            return;
        }
        // 2. Lookup Identity Footprint Match
        const normalizedEmail = email.toLowerCase().trim();
        const user = await user_model_1.default.findOne({ email: normalizedEmail }).select('+password');
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
        const isPasswordMatch = await bcrypt_1.default.compare(password, user.password);
        if (!isPasswordMatch) {
            res.status(401).json({ message: 'Invalid credentials. Access Denied.' });
            return;
        }
        // 4. Issue Valid Session Handshake Token
        const normalizedRole = (0, user_model_1.normalizeUserRole)(user.role);
        let technicianProfile = null;
        if (normalizedRole === user_model_1.UserRole.TECHNICIAN) {
            technicianProfile = await technician_model_1.default.findOne({ userId: user._id });
            if (!technicianProfile) {
                res.status(403).json({ message: 'Technician profile is missing. Please contact support.' });
                return;
            }
            if (technicianProfile.approvalStatus !== technician_model_1.TechnicianApprovalStatus.APPROVED) {
                res.status(403).json({
                    message: technicianProfile.approvalStatus === technician_model_1.TechnicianApprovalStatus.PENDING_REVIEW
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
                adminRole: normalizedRole === user_model_1.UserRole.ADMIN ? user.adminRole || user_model_1.AdminRole.SUPER_ADMIN : undefined,
                adminPermissions: normalizedRole === user_model_1.UserRole.ADMIN ? user.adminPermissions || [] : [],
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
    }
    catch (error) {
        console.error('❌ Login authentication mechanism failure:', error);
        res.status(500).json({ message: 'Internal server error verifying profile authentication states.' });
    }
};
exports.loginUser = loginUser;
const bootstrapAdmin = async (req, res) => {
    try {
        const setupKey = req.headers['x-admin-setup-key'] ?? req.body.setupKey;
        const expectedSetupKey = process.env.ADMIN_SETUP_KEY;
        if (!expectedSetupKey || setupKey !== expectedSetupKey) {
            res.status(403).json({ message: 'Admin setup is not authorized.' });
            return;
        }
        const existingAdmin = await user_model_1.default.findOne({ role: user_model_1.UserRole.ADMIN });
        if (existingAdmin) {
            res.status(409).json({ message: 'An admin account already exists.' });
            return;
        }
        const { name, email, phone, password, countryCode, location } = req.body;
        if (!name || !email || !phone || !password) {
            res.status(400).json({ message: 'Name, email, phone, and password are required.' });
            return;
        }
        const resolvedCountryCode = (0, market_config_1.normalizeCountryCode)(countryCode ?? location?.country);
        const market = (0, market_config_1.getMarketByCountry)(resolvedCountryCode);
        const hashedPassword = await bcrypt_1.default.hash(password, 10);
        const admin = await user_model_1.default.create({
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
            role: user_model_1.UserRole.ADMIN,
            adminRole: user_model_1.AdminRole.SUPER_ADMIN,
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
    }
    catch (error) {
        console.error('Admin bootstrap failed:', error);
        res.status(500).json({ message: 'Unable to bootstrap admin account.' });
    }
};
exports.bootstrapAdmin = bootstrapAdmin;
const forgotPassword = async (req, res) => {
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
        const user = await user_model_1.default.findOne({ email: normalizedEmail, role: user_model_1.UserRole.ADMIN });
        if (!user || user.isActive === false) {
            await logAuthAudit(req, 'password_reset.request', { email: normalizedEmail, accountMatched: false }, true);
            res.status(200).json(genericResponse);
            return;
        }
        const resetToken = crypto_1.default.randomBytes(32).toString('hex');
        const resetTokenHash = hashResetToken(resetToken);
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
        await user_model_1.default.updateOne({ _id: user._id }, {
            $set: {
                passwordResetTokenHash: resetTokenHash,
                passwordResetExpiresAt: expiresAt,
                updatedAt: new Date(),
            },
        });
        const portalBaseUrl = process.env.ADMIN_PORTAL_URL?.trim().replace(/\/$/, '');
        const resetUrl = portalBaseUrl
            ? `${portalBaseUrl}?resetToken=${resetToken}&email=${encodeURIComponent(normalizedEmail)}`
            : '';
        const emailSent = resetUrl
            ? await email_service_1.EmailService.sendPasswordResetEmail({
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
    }
    catch (error) {
        console.error('Password reset request failed:', error);
        res.status(200).json({
            status: 'success',
            message: 'If this email exists, reset instructions have been sent.',
        });
    }
};
exports.forgotPassword = forgotPassword;
const resetPassword = async (req, res) => {
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
        const user = await user_model_1.default.findOne({
            email: normalizedEmail,
            role: user_model_1.UserRole.ADMIN,
            passwordResetTokenHash: tokenHash,
            passwordResetExpiresAt: { $gt: new Date() },
        }).select('+passwordResetTokenHash +passwordResetExpiresAt +refreshTokenVersion');
        if (!user) {
            await logAuthAudit(req, 'password_reset.complete', { email: normalizedEmail, accountMatched: false }, false);
            res.status(400).json({ message: 'The reset link is invalid or has expired.' });
            return;
        }
        const hashedPassword = await bcrypt_1.default.hash(password, 10);
        await user_model_1.default.updateOne({ _id: user._id }, {
            $set: {
                password: hashedPassword,
                lastPasswordChangeAt: new Date(),
                passwordResetTokenHash: '',
                passwordResetExpiresAt: null,
                updatedAt: new Date(),
            },
            $inc: { refreshTokenVersion: 1 },
        });
        await logAuthAudit(req, 'password_reset.complete', {
            email: normalizedEmail,
            userId: user._id.toString(),
        });
        res.status(200).json({ status: 'success', message: 'Password reset complete. You can now sign in.' });
    }
    catch (error) {
        console.error('Password reset failed:', error);
        res.status(500).json({ message: 'Unable to reset password right now.' });
    }
};
exports.resetPassword = resetPassword;
const registerTechnician = async (req, res) => {
    try {
        const { name, email, phone, location, password, countryCode, serviceCategories, yearsExperience, businessName, idNumber, vehicleType, serviceRadiusKm, bio, documents, banking, } = req.body;
        if (!name || !email || !phone || !location?.city || !password) {
            res.status(400).json({ message: 'Please complete all required technician registration fields.' });
            return;
        }
        if (!Array.isArray(serviceCategories) || serviceCategories.length === 0) {
            res.status(400).json({ message: 'Please select at least one service category.' });
            return;
        }
        const normalizedServiceCategories = Array.from(new Set(serviceCategories.map((item) => (0, service_availability_service_1.normalizeServiceKey)(item)).filter(Boolean)));
        if (normalizedServiceCategories.length === 0) {
            res.status(400).json({ message: 'Please select at least one valid service category.' });
            return;
        }
        if (password.length < 6) {
            res.status(400).json({ message: 'Password must be at least 6 characters long.' });
            return;
        }
        const normalizedEmail = email.toLowerCase().trim();
        const existingUser = await user_model_1.default.findOne({ email: normalizedEmail });
        if (existingUser) {
            res.status(409).json({ message: 'An account with this email address already exists.' });
            return;
        }
        const resolvedCountryCode = (0, market_config_1.normalizeCountryCode)(countryCode ?? location.country);
        const market = (0, market_config_1.getMarketByCountry)(resolvedCountryCode);
        const autoApprove = process.env.TECHNICIAN_AUTO_APPROVE === 'true';
        const approvalStatus = autoApprove
            ? technician_model_1.TechnicianApprovalStatus.APPROVED
            : technician_model_1.TechnicianApprovalStatus.PENDING_REVIEW;
        const hashedPassword = await bcrypt_1.default.hash(password, 10);
        const user = await user_model_1.default.create({
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
            role: user_model_1.UserRole.TECHNICIAN,
        });
        const technician = await technician_model_1.default.create({
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
        await technician_capability_model_1.default.insertMany(technician.serviceCategories.map((categorySlug) => ({
            technicianId: technician._id,
            categorySlug,
            approvedSpecialties: [],
            verificationStatus: capabilityStatus,
            serviceRadiusKm: normalizedServiceRadiusKm,
            rejectionReason: null,
        })), { ordered: false });
        await technician_telemetry_model_1.default.create({
            technicianId: technician._id,
            isOnDuty: false,
            connectionStatus: 'DISCONNECTED',
            location: technician.lastLocation ?? null,
        });
        const token = autoApprove ? generateToken(user._id.toString(), user_model_1.UserRole.TECHNICIAN, user.email) : null;
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
    }
    catch (error) {
        console.error('Technician registration failed:', error);
        res.status(500).json({ message: 'Unable to submit technician registration.' });
    }
};
exports.registerTechnician = registerTechnician;
//# sourceMappingURL=auth.controller.js.map