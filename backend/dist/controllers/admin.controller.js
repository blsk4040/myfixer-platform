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
exports.getAdminAuditLogs = exports.updateAdminUser = exports.createAdminUser = exports.listAdminUsers = exports.updateAdminMarket = exports.getPublicMarketAvailability = exports.getPublicMarkets = exports.getAdminMarkets = exports.getAdminWalletTransactions = exports.getAdminInvoices = exports.getAdminQuotes = exports.updateTechnicianCapabilityStatus = exports.getAdminBookingById = exports.getAdminBookings = exports.getAdminOverview = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const mongoose_1 = __importDefault(require("mongoose"));
const booking_model_1 = __importStar(require("../models/booking.model"));
const quote_model_1 = __importStar(require("../models/quote.model"));
const chat_message_model_1 = __importDefault(require("../models/chat-message.model"));
const job_media_model_1 = __importDefault(require("../models/job-media.model"));
const technician_model_1 = __importStar(require("../models/technician.model"));
const technician_capability_model_1 = __importStar(require("../models/technician-capability.model"));
const billing_model_1 = require("../models/billing.model");
const user_model_1 = __importStar(require("../models/user.model"));
const market_config_1 = require("../config/market.config");
const market_setting_model_1 = __importStar(require("../models/market-setting.model"));
const audit_log_model_1 = __importDefault(require("../models/audit-log.model"));
const service_availability_service_1 = require("../services/service-availability.service");
const parseLimit = (value, fallback = 50) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed))
        return fallback;
    return Math.min(Math.max(Math.floor(parsed), 1), 200);
};
const DEFAULT_SERVICE_CATEGORIES = [
    'Cleaning',
    'Plumbing',
    'Electrical',
    'Mechanic',
    'Appliance Repair',
    'Gardening',
    'Painting',
    'Pest Control',
];
const ADMIN_ROLE_PERMISSIONS = {
    [user_model_1.AdminRole.SUPER_ADMIN]: Object.values(user_model_1.AdminPermission),
    [user_model_1.AdminRole.OPERATIONS_MANAGER]: [
        user_model_1.AdminPermission.OVERVIEW_READ,
        user_model_1.AdminPermission.BOOKINGS_READ,
        user_model_1.AdminPermission.BOOKINGS_UPDATE,
        user_model_1.AdminPermission.TECHNICIANS_READ,
        user_model_1.AdminPermission.TECHNICIANS_REVIEW,
        user_model_1.AdminPermission.SETTINGS_READ,
    ],
    [user_model_1.AdminRole.DISPATCHER]: [
        user_model_1.AdminPermission.OVERVIEW_READ,
        user_model_1.AdminPermission.BOOKINGS_READ,
        user_model_1.AdminPermission.BOOKINGS_UPDATE,
    ],
    [user_model_1.AdminRole.FINANCE_ADMIN]: [
        user_model_1.AdminPermission.OVERVIEW_READ,
        user_model_1.AdminPermission.FINANCE_READ,
        user_model_1.AdminPermission.SETTINGS_READ,
    ],
    [user_model_1.AdminRole.SUPPORT_AGENT]: [
        user_model_1.AdminPermission.OVERVIEW_READ,
        user_model_1.AdminPermission.BOOKINGS_READ,
        user_model_1.AdminPermission.TECHNICIANS_READ,
    ],
    [user_model_1.AdminRole.TECHNICIAN_REVIEWER]: [
        user_model_1.AdminPermission.OVERVIEW_READ,
        user_model_1.AdminPermission.TECHNICIANS_READ,
        user_model_1.AdminPermission.TECHNICIANS_REVIEW,
    ],
    [user_model_1.AdminRole.MARKET_MANAGER]: [
        user_model_1.AdminPermission.OVERVIEW_READ,
        user_model_1.AdminPermission.MARKETS_READ,
        user_model_1.AdminPermission.MARKETS_UPDATE,
        user_model_1.AdminPermission.SETTINGS_READ,
    ],
    [user_model_1.AdminRole.READ_ONLY_ADMIN]: [
        user_model_1.AdminPermission.OVERVIEW_READ,
        user_model_1.AdminPermission.BOOKINGS_READ,
        user_model_1.AdminPermission.TECHNICIANS_READ,
        user_model_1.AdminPermission.FINANCE_READ,
        user_model_1.AdminPermission.MARKETS_READ,
        user_model_1.AdminPermission.ADMINS_READ,
        user_model_1.AdminPermission.SETTINGS_READ,
    ],
};
const getActor = (req) => req.user;
const getRequesterAdmin = async (req) => {
    const actor = getActor(req);
    if (!actor?.id || !mongoose_1.default.Types.ObjectId.isValid(actor.id))
        return null;
    return user_model_1.default.findById(actor.id);
};
const isSuperAdmin = async (req) => {
    const admin = await getRequesterAdmin(req);
    return Boolean(admin && admin.role === user_model_1.UserRole.ADMIN && (admin.adminRole || user_model_1.AdminRole.SUPER_ADMIN) === user_model_1.AdminRole.SUPER_ADMIN);
};
const logAdminAction = async (req, action, resourceType, resourceId, metadata = {}) => {
    const actor = getActor(req);
    await audit_log_model_1.default.create({
        actor: {
            id: actor?.id && mongoose_1.default.Types.ObjectId.isValid(actor.id) ? actor.id : undefined,
            email: actor?.email || '',
            role: 'ADMIN',
        },
        event: {
            action,
            module: 'ADMIN',
            resourceType,
            resourceId,
            severity: 'INFO',
        },
        request: {
            ipAddress: req.ip || '',
            device: '',
            platform: '',
            appVersion: '',
            userAgent: String(req.headers['user-agent'] || ''),
        },
        metadata,
        success: true,
    });
};
const resolveAdminPermissions = (adminRole, extraPermissions = []) => Array.from(new Set([...(ADMIN_ROLE_PERMISSIONS[adminRole] || []), ...extraPermissions]));
const splitCsv = (value) => {
    if (Array.isArray(value))
        return value.map((item) => String(item).trim()).filter(Boolean);
    if (typeof value !== 'string')
        return [];
    return value.split(',').map((item) => item.trim()).filter(Boolean);
};
const normalizeSpecialties = (value) => Array.from(new Set(Array.isArray(value)
    ? value.map((item) => String(item).trim().toLowerCase()).filter(Boolean)
    : []));
const safeJsonArray = (value) => {
    if (Array.isArray(value))
        return value;
    if (typeof value !== 'string' || !value.trim())
        return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
};
const normalizeCityServiceAvailability = (value) => safeJsonArray(value)
    .map((row) => (0, service_availability_service_1.buildCityAvailability)(row))
    .filter((row) => Boolean(row))
    .map((row) => ({
    city: row.city,
    status: row.status,
    services: row.services,
    areas: row.areas,
}));
const normalizePaymentProviderSettings = (value) => safeJsonArray(value)
    .map((row, index) => ({
    provider: String(row.provider || '').trim().toUpperCase(),
    status: ['ACTIVE', 'DISABLED', 'TESTING', 'FALLBACK'].includes(row.status) ? row.status : 'DISABLED',
    methods: splitCsv(row.methods),
    priority: Number.isFinite(Number(row.priority)) ? Number(row.priority) : index + 1,
    payoutEnabled: row.payoutEnabled === true || row.payoutEnabled === 'true',
    configReference: String(row.configReference || '').trim(),
}))
    .filter((row) => row.provider);
const buildDefaultProviderSettings = (providers) => providers.map((provider, index) => ({
    provider,
    status: index === 0 ? 'ACTIVE' : 'FALLBACK',
    methods: [],
    priority: index + 1,
    payoutEnabled: false,
    configReference: `${provider}_CONFIG_REF`,
}));
const mergeMarketSetting = (setting) => {
    const identity = setting.identity || {};
    const pricing = setting.pricing || {};
    const coverage = setting.coverage || {};
    const payments = setting.payments || {};
    const support = setting.support || {};
    const countryCode = identity.countryCode || setting.countryCode;
    const status = identity.status || setting.status;
    const enabled = identity.enabled ?? setting.enabled ?? status === market_setting_model_1.MarketStatus.ACTIVE;
    const paymentProviders = payments.paymentProviders || setting.paymentProviders || [];
    const providerSettings = payments.providerSettings || setting.paymentProviderSettings || [];
    const baseMarket = market_config_1.MARKET_CONFIG[countryCode];
    const normalizedServiceCategories = (0, service_availability_service_1.normalizeServiceEntries)(coverage.serviceCategories ?? setting.serviceCategories ?? service_availability_service_1.DEFAULT_SERVICE_DEFINITIONS);
    const normalizedCityAvailability = Array.isArray(coverage.cityServiceAvailability ?? setting.cityServiceAvailability)
        ? (coverage.cityServiceAvailability ?? setting.cityServiceAvailability)
            .map((row) => (0, service_availability_service_1.buildCityAvailability)(row, normalizedServiceCategories))
            .filter(Boolean)
        : [];
    return {
        ...(baseMarket || {}),
        ...setting,
        identity,
        pricing,
        coverage,
        payments,
        support,
        countryCode,
        countryName: identity.countryName || setting.countryName || baseMarket?.countryName,
        currency: identity.currency || setting.currency || baseMarket?.currency,
        locale: identity.locale || setting.locale || baseMarket?.locale,
        status,
        enabled,
        defaultCalloutFee: typeof pricing.defaultCalloutFeeMinor === 'number'
            ? pricing.defaultCalloutFeeMinor / 100
            : pricing.defaultCalloutFee ?? setting.defaultCalloutFee ?? baseMarket?.defaultCalloutFee ?? 0,
        platformCommissionBps: pricing.platformCommissionBps ?? setting.platformCommissionBps ?? baseMarket?.platformCommissionBps ?? 1500,
        taxLabel: pricing.taxLabel || setting.taxLabel || baseMarket?.taxLabel || 'VAT',
        supportedCities: coverage.supportedCities ?? setting.supportedCities ?? [],
        serviceCategories: normalizedServiceCategories,
        cityServiceAvailability: normalizedCityAvailability,
        paymentProviders,
        paymentProviderSettings: providerSettings.length
            ? providerSettings
            : buildDefaultProviderSettings(paymentProviders.length ? paymentProviders : baseMarket?.paymentProviders || []),
        supportEmail: support.email ?? setting.supportEmail ?? '',
        supportPhone: support.phone ?? setting.supportPhone ?? '',
        supportWhatsapp: support.whatsapp ?? setting.supportWhatsapp ?? '',
        supportEscalationEmail: support.escalationEmail ?? setting.supportEscalationEmail ?? '',
        hasCustomSettings: true,
    };
};
const getConfiguredMarkets = async () => {
    const settings = await market_setting_model_1.default.find().sort({ 'identity.countryName': 1 });
    return settings.map((setting) => mergeMarketSetting(setting.toObject()));
};
const getActiveMarkets = async () => {
    const settings = await market_setting_model_1.default.find({
        'identity.status': market_setting_model_1.MarketStatus.ACTIVE,
        'identity.enabled': true,
    }).sort({ 'identity.countryName': 1 });
    return settings.map((setting) => mergeMarketSetting(setting.toObject()));
};
const getAvailableMarketOptions = async () => {
    const settings = await market_setting_model_1.default.find();
    const configuredCountries = new Set(settings.map((setting) => setting.identity?.countryCode));
    return Object.values(market_config_1.MARKET_CONFIG)
        .filter((market) => !configuredCountries.has(market.countryCode))
        .map((market) => ({
        countryCode: market.countryCode,
        countryName: market.countryName,
        currency: market.currency,
        defaultCalloutFee: market.defaultCalloutFee,
        platformCommissionBps: market.platformCommissionBps,
        paymentProviders: market.paymentProviders,
        taxLabel: market.taxLabel,
    }));
};
const buildBookingFilter = (query) => {
    const filter = {};
    if (typeof query.status === 'string' && query.status) {
        filter.status = query.status;
    }
    if (typeof query.countryCode === 'string' && query.countryCode) {
        filter.countryCode = query.countryCode.toUpperCase();
    }
    if (typeof query.search === 'string' && query.search.trim()) {
        const search = query.search.trim();
        filter.$or = [
            { customerName: new RegExp(search, 'i') },
            { applianceType: new RegExp(search, 'i') },
            { generalArea: new RegExp(search, 'i') },
            { fullAddress: new RegExp(search, 'i') },
        ];
    }
    return filter;
};
const getAdminOverview = async (_req, res) => {
    try {
        const [totalBookings, activeBookings, pendingBookings, completedBookings, pendingTechnicians, approvedTechnicians, pendingQuotes, approvedQuotes, unpaidInvoices, walletLedgerRows, clients,] = await Promise.all([
            booking_model_1.default.countDocuments(),
            booking_model_1.default.countDocuments({
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
            booking_model_1.default.countDocuments({ status: booking_model_1.BookingStatus.PENDING }),
            booking_model_1.default.countDocuments({ status: booking_model_1.BookingStatus.COMPLETED }),
            technician_model_1.default.countDocuments({ approvalStatus: technician_model_1.TechnicianApprovalStatus.PENDING_REVIEW }),
            technician_model_1.default.countDocuments({ approvalStatus: technician_model_1.TechnicianApprovalStatus.APPROVED }),
            quote_model_1.default.countDocuments({ status: quote_model_1.QuoteStatus.SENT_TO_CLIENT }),
            quote_model_1.default.countDocuments({ status: quote_model_1.QuoteStatus.APPROVED }),
            billing_model_1.Invoice.countDocuments({ status: 'UNPAID' }),
            billing_model_1.WalletTransaction.find().sort({ createdAt: -1 }).limit(500),
            user_model_1.default.countDocuments({ role: user_model_1.UserRole.CUSTOMER }),
        ]);
        const totalsByCurrency = walletLedgerRows.reduce((acc, row) => {
            const currency = row.currency;
            acc[currency] ??= { commission: 0, technicianPending: 0, clientDue: 0 };
            const amount = typeof row.amount === 'number'
                ? row.amount
                : typeof row.amountMinor === 'number'
                    ? row.amountMinor / 100
                    : 0;
            if (row.type === 'PLATFORM_COMMISSION')
                acc[currency].commission += amount;
            if (row.type === 'TECHNICIAN_EARNING_PENDING')
                acc[currency].technicianPending += amount;
            if (row.type === 'CLIENT_PAYMENT')
                acc[currency].clientDue += amount;
            return acc;
        }, {});
        res.status(200).json({
            success: true,
            overview: {
                totalBookings,
                activeBookings,
                pendingBookings,
                completedBookings,
                pendingTechnicians,
                approvedTechnicians,
                pendingQuotes,
                approvedQuotes,
                unpaidInvoices,
                clients,
                totalsByCurrency,
            },
        });
    }
    catch (error) {
        console.error('Failed to load admin overview:', error);
        res.status(500).json({ success: false, message: 'Failed to load admin overview.' });
    }
};
exports.getAdminOverview = getAdminOverview;
const getAdminBookings = async (req, res) => {
    try {
        const limit = parseLimit(req.query.limit);
        const bookings = await booking_model_1.default.find(buildBookingFilter(req.query))
            .sort({ updatedAt: -1 })
            .limit(limit);
        res.status(200).json({ success: true, bookings });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch bookings.' });
    }
};
exports.getAdminBookings = getAdminBookings;
const getAdminBookingById = async (req, res) => {
    const { id } = req.params;
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        res.status(400).json({ message: 'Invalid booking id.' });
        return;
    }
    try {
        const [booking, quotes, invoices, ledger, media, messages] = await Promise.all([
            booking_model_1.default.findById(id),
            quote_model_1.default.find({ bookingId: id }).sort({ createdAt: -1 }),
            billing_model_1.Invoice.find({ bookingId: id }).sort({ createdAt: -1 }),
            billing_model_1.WalletTransaction.find({ bookingId: id }).sort({ createdAt: -1 }),
            job_media_model_1.default.find({ bookingId: id }).sort({ createdAt: -1 }),
            chat_message_model_1.default.find({ bookingId: id }).sort({ createdAt: 1 }).limit(300),
        ]);
        if (!booking) {
            res.status(404).json({ message: 'Booking not found.' });
            return;
        }
        res.status(200).json({ success: true, booking, quotes, invoices, ledger, media, messages });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch booking.' });
    }
};
exports.getAdminBookingById = getAdminBookingById;
const updateTechnicianCapabilityStatus = async (req, res) => {
    const { capabilityId } = req.params;
    if (!mongoose_1.default.Types.ObjectId.isValid(capabilityId)) {
        res.status(400).json({ message: 'Invalid capability id.' });
        return;
    }
    const requestedStatus = String(req.body.verificationStatus || '').trim().toUpperCase();
    if (![technician_capability_model_1.CapabilityStatus.APPROVED, technician_capability_model_1.CapabilityStatus.REJECTED].includes(requestedStatus)) {
        res.status(400).json({ message: 'verificationStatus must be APPROVED or REJECTED.' });
        return;
    }
    const verificationStatus = requestedStatus;
    const rejectionReason = typeof req.body.rejectionReason === 'string' ? req.body.rejectionReason.trim() : '';
    if (verificationStatus === technician_capability_model_1.CapabilityStatus.REJECTED && !rejectionReason) {
        res.status(400).json({ message: 'rejectionReason is required when rejecting a capability.' });
        return;
    }
    const approvedSpecialties = req.body.approvedSpecialties === undefined
        ? undefined
        : normalizeSpecialties(req.body.approvedSpecialties);
    try {
        const update = {
            verificationStatus,
            rejectionReason: verificationStatus === technician_capability_model_1.CapabilityStatus.REJECTED ? rejectionReason : null,
        };
        if (approvedSpecialties !== undefined) {
            update.approvedSpecialties = approvedSpecialties;
        }
        const capability = await technician_capability_model_1.default.findByIdAndUpdate(capabilityId, { $set: update }, { new: true, runValidators: true });
        if (!capability) {
            res.status(404).json({ message: 'Technician capability not found.' });
            return;
        }
        const technicianUpdate = verificationStatus === technician_capability_model_1.CapabilityStatus.APPROVED
            ? { $addToSet: { serviceCategories: capability.categorySlug } }
            : { $pull: { serviceCategories: capability.categorySlug } };
        const technician = await technician_model_1.default.findByIdAndUpdate(capability.technicianId, technicianUpdate, { new: true });
        await logAdminAction(req, 'technician_capability.status_update', 'TechnicianCapability', capability._id.toString(), {
            technicianId: capability.technicianId.toString(),
            categorySlug: capability.categorySlug,
            verificationStatus,
            rejectionReason: capability.rejectionReason,
            approvedSpecialties: capability.approvedSpecialties,
            legacyServiceCategories: technician?.serviceCategories ?? [],
        });
        res.status(200).json({
            success: true,
            capability,
            technician: technician
                ? {
                    id: technician._id,
                    serviceCategories: technician.serviceCategories,
                }
                : null,
        });
    }
    catch (error) {
        console.error('Capability status update failed:', error);
        res.status(500).json({ success: false, message: 'Failed to update technician capability.' });
    }
};
exports.updateTechnicianCapabilityStatus = updateTechnicianCapabilityStatus;
const getAdminQuotes = async (req, res) => {
    try {
        const filter = {};
        if (typeof req.query.status === 'string' && req.query.status)
            filter.status = req.query.status;
        if (typeof req.query.countryCode === 'string' && req.query.countryCode)
            filter.countryCode = req.query.countryCode.toUpperCase();
        const quotes = await quote_model_1.default.find(filter)
            .populate('bookingId', 'applianceType status generalArea customerName')
            .populate('technicianId', 'name email phone')
            .populate('customerId', 'name email phone')
            .sort({ updatedAt: -1 })
            .limit(parseLimit(req.query.limit));
        res.status(200).json({ success: true, quotes });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch quotes.' });
    }
};
exports.getAdminQuotes = getAdminQuotes;
const getAdminInvoices = async (req, res) => {
    try {
        const filter = {};
        if (typeof req.query.status === 'string' && req.query.status)
            filter.status = req.query.status;
        if (typeof req.query.countryCode === 'string' && req.query.countryCode)
            filter.countryCode = req.query.countryCode.toUpperCase();
        const invoices = await billing_model_1.Invoice.find(filter)
            .populate('bookingId', 'applianceType status generalArea customerName')
            .populate('technicianId', 'name email phone')
            .populate('customerId', 'name email phone')
            .sort({ createdAt: -1 })
            .limit(parseLimit(req.query.limit));
        res.status(200).json({ success: true, invoices });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch invoices.' });
    }
};
exports.getAdminInvoices = getAdminInvoices;
const getAdminWalletTransactions = async (req, res) => {
    try {
        const filter = {};
        if (typeof req.query.type === 'string' && req.query.type)
            filter.type = req.query.type;
        if (typeof req.query.status === 'string' && req.query.status)
            filter.status = req.query.status;
        if (typeof req.query.countryCode === 'string' && req.query.countryCode)
            filter.countryCode = req.query.countryCode.toUpperCase();
        const transactions = await billing_model_1.WalletTransaction.find(filter)
            .populate('bookingId', 'applianceType status generalArea customerName')
            .populate('technicianId', 'name email phone')
            .populate('customerId', 'name email phone')
            .sort({ createdAt: -1 })
            .limit(parseLimit(req.query.limit, 100));
        res.status(200).json({ success: true, transactions });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch wallet transactions.' });
    }
};
exports.getAdminWalletTransactions = getAdminWalletTransactions;
const getAdminMarkets = async (_req, res) => {
    try {
        res.status(200).json({
            success: true,
            markets: await getConfiguredMarkets(),
            availableMarkets: await getAvailableMarketOptions(),
            availableStatuses: Object.values(market_setting_model_1.MarketStatus),
            availablePaymentProviders: ['PAYSTACK', 'FLUTTERWAVE', 'MPESA', 'MTN_MOMO', 'AIRTEL_MONEY', 'YOCO', 'OZOW'],
            defaultServiceCategories: DEFAULT_SERVICE_CATEGORIES,
            serviceDefinitions: service_availability_service_1.DEFAULT_SERVICE_DEFINITIONS,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to load markets.' });
    }
};
exports.getAdminMarkets = getAdminMarkets;
const getPublicMarkets = async (_req, res) => {
    try {
        res.status(200).json({ markets: await getActiveMarkets() });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to load markets.' });
    }
};
exports.getPublicMarkets = getPublicMarkets;
const getPublicMarketAvailability = async (req, res) => {
    try {
        const availability = await (0, service_availability_service_1.getMarketAvailability)(req.params.country, req.query.city, req.query.area);
        res.status(200).json({ success: true, availability });
    }
    catch (error) {
        console.error('Failed to load market availability:', error);
        res.status(500).json({ message: 'Failed to load service availability.' });
    }
};
exports.getPublicMarketAvailability = getPublicMarketAvailability;
const updateAdminMarket = async (req, res) => {
    try {
        const countryCode = String(req.params.countryCode || '').toUpperCase();
        const baseMarket = market_config_1.MARKET_CONFIG[countryCode];
        const isKnownMarket = Boolean(baseMarket);
        if (!isKnownMarket && !(await isSuperAdmin(req))) {
            res.status(403).json({ message: 'Only a super admin can add a custom country.' });
            return;
        }
        const identity = req.body.identity || {};
        const pricing = req.body.pricing || {};
        const coverage = req.body.coverage || {};
        const payments = req.body.payments || {};
        const support = req.body.support || {};
        const requestedStatus = identity.status || req.body.status;
        const status = Object.values(market_setting_model_1.MarketStatus).includes(requestedStatus)
            ? requestedStatus
            : (identity.enabled ?? req.body.enabled)
                ? market_setting_model_1.MarketStatus.ACTIVE
                : market_setting_model_1.MarketStatus.DISABLED;
        const paymentProviders = splitCsv(payments.paymentProviders ?? req.body.paymentProviders);
        const serviceCategories = (0, service_availability_service_1.normalizeServiceEntries)(coverage.serviceCategories ?? req.body.serviceCategories);
        const supportedCities = splitCsv(coverage.supportedCities ?? req.body.supportedCities);
        const cityServiceAvailability = normalizeCityServiceAvailability(coverage.cityServiceAvailability ?? req.body.cityServiceAvailability);
        const paymentProviderSettings = normalizePaymentProviderSettings(payments.providerSettings ?? req.body.paymentProviderSettings);
        const actor = getActor(req);
        const requestedCurrency = typeof (identity.currency ?? req.body.currency) === 'string' && String(identity.currency ?? req.body.currency).trim()
            ? String(identity.currency ?? req.body.currency).trim().toUpperCase()
            : '';
        const currency = requestedCurrency || baseMarket?.currency;
        const countryName = baseMarket?.countryName ?? String(identity.countryName ?? req.body.countryName ?? '').trim();
        const defaultCalloutFee = Number.isFinite(Number(pricing.defaultCalloutFeeMinor))
            ? Number(pricing.defaultCalloutFeeMinor) / 100
            : Number.isFinite(Number(pricing.defaultCalloutFee ?? req.body.defaultCalloutFee))
                ? Number(pricing.defaultCalloutFee ?? req.body.defaultCalloutFee)
                : baseMarket?.defaultCalloutFee ?? 0;
        const platformCommissionBps = Number.isFinite(Number(pricing.platformCommissionBps ?? req.body.platformCommissionBps))
            ? Number(pricing.platformCommissionBps ?? req.body.platformCommissionBps)
            : baseMarket?.platformCommissionBps ?? 1500;
        const taxLabel = typeof (pricing.taxLabel ?? req.body.taxLabel) === 'string' && String(pricing.taxLabel ?? req.body.taxLabel).trim()
            ? String(pricing.taxLabel ?? req.body.taxLabel).trim()
            : baseMarket?.taxLabel ?? 'VAT';
        if (!currency) {
            res.status(400).json({ message: 'Currency is required for custom countries.' });
            return;
        }
        if (!baseMarket && !countryName) {
            res.status(400).json({ message: 'Country name is required for custom countries.' });
            return;
        }
        const market = await market_setting_model_1.default.findOneAndUpdate({ 'identity.countryCode': countryCode }, {
            identity: {
                countryCode,
                countryName,
                currency,
                locale: typeof (identity.locale ?? req.body.locale) === 'string' && String(identity.locale ?? req.body.locale).trim()
                    ? String(identity.locale ?? req.body.locale).trim()
                    : baseMarket?.locale ?? 'en',
                status,
                enabled: status === market_setting_model_1.MarketStatus.ACTIVE,
            },
            pricing: {
                defaultCalloutFeeMinor: Math.round(defaultCalloutFee * 100),
                platformCommissionBps,
                taxLabel,
            },
            coverage: {
                supportedCities,
                serviceCategories: serviceCategories.length ? serviceCategories : service_availability_service_1.DEFAULT_SERVICE_DEFINITIONS,
                cityServiceAvailability,
            },
            payments: {
                paymentProviders: paymentProviders.length ? paymentProviders : baseMarket?.paymentProviders ?? [],
                providerSettings: paymentProviderSettings.length
                    ? paymentProviderSettings
                    : buildDefaultProviderSettings(paymentProviders.length ? paymentProviders : baseMarket?.paymentProviders ?? []),
            },
            support: {
                email: typeof (support.email ?? req.body.supportEmail) === 'string' ? String(support.email ?? req.body.supportEmail).trim().toLowerCase() : '',
                phone: typeof (support.phone ?? req.body.supportPhone) === 'string' ? String(support.phone ?? req.body.supportPhone).trim() : '',
                whatsapp: typeof (support.whatsapp ?? req.body.supportWhatsapp) === 'string' ? String(support.whatsapp ?? req.body.supportWhatsapp).trim() : '',
                escalationEmail: typeof (support.escalationEmail ?? req.body.supportEscalationEmail) === 'string'
                    ? String(support.escalationEmail ?? req.body.supportEscalationEmail).trim().toLowerCase()
                    : '',
            },
            audit: {
                updatedBy: actor?.id,
            },
        }, { new: true, upsert: true, runValidators: true });
        await logAdminAction(req, 'market.update', 'MarketSetting', countryCode, {
            status: market.identity.status,
            enabled: market.identity.enabled,
            defaultCalloutFeeMinor: market.pricing.defaultCalloutFeeMinor,
            platformCommissionBps: market.pricing.platformCommissionBps,
        });
        res.status(200).json({ success: true, market });
    }
    catch (error) {
        console.error('Market update failed:', error);
        res.status(500).json({ success: false, message: 'Failed to update market.' });
    }
};
exports.updateAdminMarket = updateAdminMarket;
const listAdminUsers = async (_req, res) => {
    try {
        const admins = await user_model_1.default.find({ role: user_model_1.UserRole.ADMIN })
            .select('-password')
            .sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            admins,
            roles: Object.values(user_model_1.AdminRole),
            permissionsByRole: ADMIN_ROLE_PERMISSIONS,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch admin users.' });
    }
};
exports.listAdminUsers = listAdminUsers;
const createAdminUser = async (req, res) => {
    try {
        if (!(await isSuperAdmin(req))) {
            res.status(403).json({ message: 'Only a super admin can create admin users.' });
            return;
        }
        const { name, email, phone, password, adminRole, countryCode, location } = req.body;
        if (!name || !email || !phone || !password) {
            res.status(400).json({ message: 'Name, email, phone, and password are required.' });
            return;
        }
        const normalizedEmail = String(email).toLowerCase().trim();
        const exists = await user_model_1.default.findOne({ email: normalizedEmail });
        if (exists) {
            res.status(409).json({ message: 'A user with this email already exists.' });
            return;
        }
        const selectedRole = Object.values(user_model_1.AdminRole).includes(adminRole) ? adminRole : user_model_1.AdminRole.READ_ONLY_ADMIN;
        const baseMarket = market_config_1.MARKET_CONFIG[String(countryCode || 'ZA').toUpperCase()] ?? market_config_1.MARKET_CONFIG[market_config_1.CountryCode.ZA];
        const admin = await user_model_1.default.create({
            name: String(name).trim(),
            email: normalizedEmail,
            phone: String(phone).trim(),
            location: {
                country: baseMarket.countryName,
                city: location?.city?.trim() || 'Head Office',
            },
            countryCode: baseMarket.countryCode,
            currency: baseMarket.currency,
            password: await bcrypt_1.default.hash(String(password), 10),
            role: user_model_1.UserRole.ADMIN,
            adminRole: selectedRole,
            adminPermissions: resolveAdminPermissions(selectedRole),
            isActive: true,
        });
        await logAdminAction(req, 'admin.create', 'User', admin._id.toString(), {
            email: admin.email,
            adminRole: admin.adminRole,
        });
        const result = admin.toObject();
        delete result.password;
        res.status(201).json({ success: true, admin: result });
    }
    catch (error) {
        console.error('Admin create failed:', error);
        res.status(500).json({ success: false, message: 'Failed to create admin user.' });
    }
};
exports.createAdminUser = createAdminUser;
const updateAdminUser = async (req, res) => {
    try {
        if (!(await isSuperAdmin(req))) {
            res.status(403).json({ message: 'Only a super admin can update admin users.' });
            return;
        }
        const { id } = req.params;
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            res.status(400).json({ message: 'Invalid admin id.' });
            return;
        }
        const updates = {};
        if (Object.values(user_model_1.AdminRole).includes(req.body.adminRole)) {
            updates.adminRole = req.body.adminRole;
            updates.adminPermissions = resolveAdminPermissions(req.body.adminRole);
        }
        if (typeof req.body.isActive === 'boolean')
            updates.isActive = req.body.isActive;
        if (typeof req.body.name === 'string' && req.body.name.trim())
            updates.name = req.body.name.trim();
        if (typeof req.body.phone === 'string' && req.body.phone.trim())
            updates.phone = req.body.phone.trim();
        const admin = await user_model_1.default.findOneAndUpdate({ _id: id, role: user_model_1.UserRole.ADMIN }, updates, { new: true, runValidators: true }).select('-password');
        if (!admin) {
            res.status(404).json({ message: 'Admin user not found.' });
            return;
        }
        await logAdminAction(req, 'admin.update', 'User', id, updates);
        res.status(200).json({ success: true, admin });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update admin user.' });
    }
};
exports.updateAdminUser = updateAdminUser;
const getAdminAuditLogs = async (req, res) => {
    try {
        const logs = await audit_log_model_1.default.find()
            .sort({ createdAt: -1 })
            .limit(parseLimit(req.query.limit, 100));
        res.status(200).json({ success: true, logs });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch audit logs.' });
    }
};
exports.getAdminAuditLogs = getAdminAuditLogs;
//# sourceMappingURL=admin.controller.js.map