import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import mongoose from 'mongoose';
import Booking, { BookingStatus } from '../models/booking.model';
import JobQuote, { QuoteStatus } from '../models/quote.model';
import ChatMessage from '../models/chat-message.model';
import JobMedia from '../models/job-media.model';
import Technician, { TechnicianApprovalStatus, VerificationStatus } from '../models/technician.model';
import TechnicianCapability, { CapabilityStatus } from '../models/technician-capability.model';
import { Invoice, WalletTransaction } from '../models/billing.model';
import User, { AdminPermission, AdminRole, UserRole } from '../models/user.model';
import { CountryCode, CurrencyCode, MARKET_CONFIG, PaymentProviderCode } from '../config/market.config';
import MarketSetting, { MarketStatus } from '../models/market-setting.model';
import AuditLog from '../models/audit-log.model';
import Promotion, { PromotionDiscountType, PromotionStatus } from '../models/promotion.model';
import { EmailService } from '../services/email/email.service';
import {
  DEFAULT_SERVICE_DEFINITIONS,
  buildCityAvailability,
  getMarketAvailability,
  normalizeServiceEntries,
} from '../services/service-availability.service';

const parseLimit = (value: unknown, fallback = 50): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.floor(parsed), 1), 200);
};

const ADMIN_ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  [AdminRole.SUPER_ADMIN]: Object.values(AdminPermission),
  [AdminRole.OPERATIONS_MANAGER]: [
    AdminPermission.OVERVIEW_READ,
    AdminPermission.BOOKINGS_READ,
    AdminPermission.BOOKINGS_UPDATE,
    AdminPermission.TECHNICIANS_READ,
    AdminPermission.TECHNICIANS_REVIEW,
    AdminPermission.CLIENTS_CONTACT_READ,
    AdminPermission.SETTINGS_READ,
  ],
  [AdminRole.DISPATCHER]: [
    AdminPermission.OVERVIEW_READ,
    AdminPermission.BOOKINGS_READ,
    AdminPermission.BOOKINGS_UPDATE,
  ],
  [AdminRole.FINANCE_ADMIN]: [
    AdminPermission.OVERVIEW_READ,
    AdminPermission.FINANCE_READ,
    AdminPermission.SETTINGS_READ,
  ],
  [AdminRole.SUPPORT_AGENT]: [
    AdminPermission.OVERVIEW_READ,
    AdminPermission.BOOKINGS_READ,
    AdminPermission.TECHNICIANS_READ,
    AdminPermission.CLIENTS_CONTACT_READ,
  ],
  [AdminRole.TECHNICIAN_REVIEWER]: [
    AdminPermission.OVERVIEW_READ,
    AdminPermission.TECHNICIANS_READ,
    AdminPermission.TECHNICIANS_REVIEW,
  ],
  [AdminRole.MARKET_MANAGER]: [
    AdminPermission.OVERVIEW_READ,
    AdminPermission.MARKETS_READ,
    AdminPermission.MARKETS_UPDATE,
    AdminPermission.SETTINGS_READ,
  ],
  [AdminRole.READ_ONLY_ADMIN]: [
    AdminPermission.OVERVIEW_READ,
    AdminPermission.BOOKINGS_READ,
    AdminPermission.TECHNICIANS_READ,
    AdminPermission.FINANCE_READ,
    AdminPermission.MARKETS_READ,
    AdminPermission.ADMINS_READ,
    AdminPermission.SETTINGS_READ,
  ],
};

const getActor = (req: Request) => (req as any).user as { id?: string; email?: string } | undefined;

const getRequesterAdmin = async (req: Request) => {
  const actor = getActor(req);
  if (!actor?.id || !mongoose.Types.ObjectId.isValid(actor.id)) return null;
  return User.findById(actor.id);
};

const isSuperAdmin = async (req: Request): Promise<boolean> => {
  const admin = await getRequesterAdmin(req);
  return Boolean(admin && admin.role === UserRole.ADMIN && (admin.adminRole || AdminRole.SUPER_ADMIN) === AdminRole.SUPER_ADMIN);
};

const logAdminAction = async (
  req: Request,
  action: string,
  resourceType: string,
  resourceId: string,
  metadata: Record<string, unknown> = {}
) => {
  const actor = getActor(req);

  await AuditLog.create({
    actor: {
      id: actor?.id && mongoose.Types.ObjectId.isValid(actor.id) ? actor.id : undefined,
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

const resolveAdminPermissions = (adminRole: AdminRole, extraPermissions: AdminPermission[] = []) =>
  Array.from(new Set([...(ADMIN_ROLE_PERMISSIONS[adminRole] || []), ...extraPermissions]));

const normalizeAdminPermissionsInput = (value: unknown): AdminPermission[] =>
  Array.isArray(value)
    ? Array.from(
        new Set(
          value.filter((permission): permission is AdminPermission =>
            Object.values(AdminPermission).includes(permission as AdminPermission)
          )
        )
      )
    : [];

const generateTemporaryPassword = (): string =>
  `${crypto.randomBytes(9).toString('base64url')}A1!`;

const normalizePromotionCode = (value: unknown): string =>
  String(value || '').trim().toUpperCase().replace(/\s+/g, '');

const optionalDate = (value: unknown): Date | null => {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizePromotionPayload = (body: Record<string, unknown>) => {
  const discountType = Object.values(PromotionDiscountType).includes(body.discountType as PromotionDiscountType)
    ? body.discountType as PromotionDiscountType
    : PromotionDiscountType.PERCENTAGE;
  const discountValue = Number(body.discountValue);
  const countryCode = String(body.countryCode || '').trim().toUpperCase();
  const currency = String(body.currency || '').trim().toUpperCase();

  if (!Number.isFinite(discountValue) || discountValue <= 0) {
    throw new Error('Discount value must be greater than zero.');
  }

  if (discountType === PromotionDiscountType.PERCENTAGE && discountValue > 100) {
    throw new Error('Percentage discounts cannot exceed 100%.');
  }

  return {
    name: String(body.name || '').trim(),
    description: String(body.description || '').trim(),
    status: Object.values(PromotionStatus).includes(body.status as PromotionStatus)
      ? body.status as PromotionStatus
      : PromotionStatus.ACTIVE,
    discountType,
    discountValue,
    maxDiscountMinor: Number.isFinite(Number(body.maxDiscountMinor)) ? Number(body.maxDiscountMinor) : null,
    minBookingAmountMinor: Number.isFinite(Number(body.minBookingAmountMinor)) ? Number(body.minBookingAmountMinor) : 0,
    countryCode: Object.values(CountryCode).includes(countryCode as CountryCode) ? countryCode : null,
    currency: Object.values(CurrencyCode).includes(currency as CurrencyCode) ? currency : null,
    startsAt: optionalDate(body.startsAt),
    expiresAt: optionalDate(body.expiresAt),
    usageLimit: Number.isFinite(Number(body.usageLimit)) ? Number(body.usageLimit) : null,
    perClientLimit: Number.isFinite(Number(body.perClientLimit)) ? Number(body.perClientLimit) : null,
  };
};

const normalizePromotionPatchPayload = (body: Record<string, unknown>) => {
  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) updates.name = String(body.name || '').trim();
  if (body.description !== undefined) updates.description = String(body.description || '').trim();
  if (body.status !== undefined) {
    updates.status = Object.values(PromotionStatus).includes(body.status as PromotionStatus)
      ? body.status as PromotionStatus
      : PromotionStatus.ACTIVE;
  }
  if (body.discountType !== undefined) {
    updates.discountType = Object.values(PromotionDiscountType).includes(body.discountType as PromotionDiscountType)
      ? body.discountType as PromotionDiscountType
      : PromotionDiscountType.PERCENTAGE;
  }
  if (body.discountValue !== undefined) {
    const discountValue = Number(body.discountValue);
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      throw new Error('Discount value must be greater than zero.');
    }
    if (updates.discountType === PromotionDiscountType.PERCENTAGE && discountValue > 100) {
      throw new Error('Percentage discounts cannot exceed 100%.');
    }
    updates.discountValue = discountValue;
  }

  if (body.maxDiscountMinor !== undefined) updates.maxDiscountMinor = Number.isFinite(Number(body.maxDiscountMinor)) ? Number(body.maxDiscountMinor) : null;
  if (body.minBookingAmountMinor !== undefined) updates.minBookingAmountMinor = Number.isFinite(Number(body.minBookingAmountMinor)) ? Number(body.minBookingAmountMinor) : 0;
  if (body.countryCode !== undefined) {
    const countryCode = String(body.countryCode || '').trim().toUpperCase();
    updates.countryCode = Object.values(CountryCode).includes(countryCode as CountryCode) ? countryCode : null;
  }
  if (body.currency !== undefined) {
    const currency = String(body.currency || '').trim().toUpperCase();
    updates.currency = Object.values(CurrencyCode).includes(currency as CurrencyCode) ? currency : null;
  }
  if (body.startsAt !== undefined) updates.startsAt = optionalDate(body.startsAt);
  if (body.expiresAt !== undefined) updates.expiresAt = optionalDate(body.expiresAt);
  if (body.usageLimit !== undefined) updates.usageLimit = Number.isFinite(Number(body.usageLimit)) ? Number(body.usageLimit) : null;
  if (body.perClientLimit !== undefined) updates.perClientLimit = Number.isFinite(Number(body.perClientLimit)) ? Number(body.perClientLimit) : null;

  return updates;
};

const splitCsv = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value !== 'string') return [];
  return value.split(',').map((item) => item.trim()).filter(Boolean);
};

const normalizeSpecialties = (value: unknown): string[] =>
  Array.from(
    new Set(
      Array.isArray(value)
        ? value.map((item) => String(item).trim().toLowerCase()).filter(Boolean)
        : []
    )
  );

const safeJsonArray = (value: unknown): any[] => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const normalizeCityServiceAvailability = (value: unknown) =>
  safeJsonArray(value)
    .map((row) => buildCityAvailability(row))
    .filter((row): row is NonNullable<ReturnType<typeof buildCityAvailability>> => Boolean(row))
    .map((row) => ({
      city: row.city,
      status: row.status,
      services: row.services,
      areas: row.areas,
    }));

const normalizePaymentProviderSettings = (value: unknown) =>
  safeJsonArray(value)
    .map((row, index) => ({
      provider: String(row.provider || '').trim().toUpperCase(),
      status: ['ACTIVE', 'DISABLED', 'TESTING', 'FALLBACK'].includes(row.status) ? row.status : 'DISABLED',
      methods: splitCsv(row.methods),
      priority: Number.isFinite(Number(row.priority)) ? Number(row.priority) : index + 1,
      payoutEnabled: row.payoutEnabled === true || row.payoutEnabled === 'true',
      configReference: String(row.configReference || '').trim(),
    }))
    .filter((row) => row.provider);

const buildDefaultProviderSettings = (providers: string[]) =>
  providers.map((provider, index) => ({
    provider,
    status: index === 0 ? 'ACTIVE' : 'FALLBACK',
    methods: [],
    priority: index + 1,
    payoutEnabled: false,
    configReference: `${provider}_CONFIG_REF`,
  }));

const serviceStatusScopeKey = (scope: string, serviceKey: string) => `${scope}:${serviceKey}`;

const collectServiceStatuses = (args: {
  serviceCategories?: unknown[];
  cityServiceAvailability?: unknown[];
}): Map<string, MarketStatus> => {
  const statuses = new Map<string, MarketStatus>();

  normalizeServiceEntries(args.serviceCategories).forEach((service) => {
    statuses.set(serviceStatusScopeKey('country', service.serviceKey), service.status);
  });

  safeJsonArray(args.cityServiceAvailability)
    .map((row) => buildCityAvailability(row, args.serviceCategories))
    .filter((row): row is NonNullable<ReturnType<typeof buildCityAvailability>> => Boolean(row))
    .forEach((row) => {
      row.services.forEach((service) => {
        statuses.set(serviceStatusScopeKey(`city:${row.city.toLowerCase()}`, service.serviceKey), service.status);
      });
      row.areas.forEach((area) => {
        area.services.forEach((service) => {
          statuses.set(serviceStatusScopeKey(`area:${row.city.toLowerCase()}:${area.name.toLowerCase()}`, service.serviceKey), service.status);
        });
      });
    });

  return statuses;
};

const getServiceActivations = (
  nextStatuses: Map<string, MarketStatus>,
  previousStatuses: Map<string, MarketStatus>
) =>
  Array.from(nextStatuses.entries())
    .filter(([key, status]) => status === MarketStatus.ACTIVE && previousStatuses.get(key) !== MarketStatus.ACTIVE)
    .map(([key]) => key);

const canActivateMarketServices = (admin: any): boolean =>
  Boolean(
    admin?.role === UserRole.ADMIN &&
      (
        (admin.adminRole || AdminRole.SUPER_ADMIN) === AdminRole.SUPER_ADMIN ||
        (Array.isArray(admin.adminPermissions) && admin.adminPermissions.includes(AdminPermission.MARKETS_SERVICES_ACTIVATE))
      )
  );

const adminHasPermission = (admin: any, permission: AdminPermission): boolean => {
  if (!admin || admin.role !== UserRole.ADMIN) return false;
  const adminRole = Object.values(AdminRole).includes(admin.adminRole)
    ? admin.adminRole as AdminRole
    : AdminRole.READ_ONLY_ADMIN;
  const allowed = new Set([
    ...(ADMIN_ROLE_PERMISSIONS[adminRole] || []),
    ...(Array.isArray(admin.adminPermissions) ? admin.adminPermissions : []),
  ]);
  return allowed.has(permission);
};

const maskEmail = (email: unknown): string => {
  const value = String(email || '').trim();
  const [local, domain] = value.split('@');
  if (!local || !domain) return value ? 'hidden' : '';
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(3, local.length - visible.length))}@${domain}`;
};

const maskPhone = (phone: unknown): string => {
  const value = String(phone || '').trim();
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  const last = digits.slice(-4);
  return last ? `*** *** ${last}` : 'hidden';
};

const mergeMarketSetting = (setting: any) => {
  const identity = setting.identity || {};
  const pricing = setting.pricing || {};
  const coverage = setting.coverage || {};
  const payments = setting.payments || {};
  const support = setting.support || {};
  const countryCode = identity.countryCode || setting.countryCode;
  const status = identity.status || setting.status;
  const enabled = identity.enabled ?? setting.enabled ?? status === MarketStatus.ACTIVE;
  const paymentProviders = payments.paymentProviders || setting.paymentProviders || [];
  const providerSettings = payments.providerSettings || setting.paymentProviderSettings || [];
  const baseMarket = MARKET_CONFIG[countryCode as CountryCode];
  const normalizedServiceCategories = normalizeServiceEntries(
    coverage.serviceCategories ?? setting.serviceCategories ?? DEFAULT_SERVICE_DEFINITIONS
  );
  const normalizedCityAvailability = Array.isArray(coverage.cityServiceAvailability ?? setting.cityServiceAvailability)
    ? (coverage.cityServiceAvailability ?? setting.cityServiceAvailability)
        .map((row: unknown) => buildCityAvailability(row, normalizedServiceCategories))
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
    defaultCalloutFee:
      typeof pricing.defaultCalloutFeeMinor === 'number'
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
  const settings = await MarketSetting.find().sort({ 'identity.countryName': 1 });
  return settings.map((setting) => mergeMarketSetting(setting.toObject()));
};

const getActiveMarkets = async () => {
  const settings = await MarketSetting.find({
    'identity.status': MarketStatus.ACTIVE,
    'identity.enabled': true,
  }).sort({ 'identity.countryName': 1 });
  return settings.map((setting) => mergeMarketSetting(setting.toObject()));
};

const getAvailableMarketOptions = async () => {
  const settings = await MarketSetting.find();
  const configuredCountries = new Set(settings.map((setting) => setting.identity?.countryCode));

  return Object.values(MARKET_CONFIG)
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

const buildBookingFilter = (query: Request['query']) => {
  const filter: Record<string, unknown> = {};

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

export const getAdminOverview = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [
      totalBookings,
      activeBookings,
      pendingBookings,
      completedBookings,
      pendingTechnicians,
      approvedTechnicians,
      pendingQuotes,
      approvedQuotes,
      unpaidInvoices,
      walletLedgerRows,
      clients,
    ] = await Promise.all([
      Booking.countDocuments(),
      Booking.countDocuments({
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
      Booking.countDocuments({ status: BookingStatus.PENDING }),
      Booking.countDocuments({ status: BookingStatus.COMPLETED }),
      Technician.countDocuments({ approvalStatus: TechnicianApprovalStatus.PENDING_REVIEW }),
      Technician.countDocuments({ approvalStatus: TechnicianApprovalStatus.APPROVED }),
      JobQuote.countDocuments({ status: QuoteStatus.SENT_TO_CLIENT }),
      JobQuote.countDocuments({ status: QuoteStatus.APPROVED }),
      Invoice.countDocuments({ status: 'UNPAID' }),
      WalletTransaction.find().sort({ createdAt: -1 }).limit(500),
      User.countDocuments({ role: UserRole.CUSTOMER }),
    ]);

    const totalsByCurrency = walletLedgerRows.reduce<Record<string, { commission: number; technicianPending: number; clientDue: number }>>(
      (acc, row) => {
        const currency = row.currency;
        acc[currency] ??= { commission: 0, technicianPending: 0, clientDue: 0 };
        const amount = typeof (row as any).amount === 'number'
          ? (row as any).amount
          : typeof row.amountMinor === 'number'
            ? row.amountMinor / 100
            : 0;

        if (row.type === 'PLATFORM_COMMISSION') acc[currency].commission += amount;
        if (row.type === 'TECHNICIAN_EARNING_PENDING') acc[currency].technicianPending += amount;
        if (row.type === 'CLIENT_PAYMENT') acc[currency].clientDue += amount;

        return acc;
      },
      {}
    );

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
  } catch (error) {
    console.error('Failed to load admin overview:', error);
    res.status(500).json({ success: false, message: 'Failed to load admin overview.' });
  }
};

export const getAdminClients = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseLimit(req.query.limit, 100);
    const clients = await User.find({ role: UserRole.CUSTOMER })
      .select('name email phone countryCode accountStatus isEmailVerified profileCompleted location createdAt updatedAt')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.status(200).json({
      success: true,
      contactAccess: false,
      clients: clients.map((client) => ({
        ...client,
        email: maskEmail(client.email),
        phone: maskPhone(client.phone),
        contactMasked: true,
      })),
    });
  } catch (error) {
    console.error('Failed to load admin clients:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch clients.' });
  }
};

export const revealAdminClientContact = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: 'Invalid client id.' });
    return;
  }

  try {
    const admin = await getRequesterAdmin(req);
    if (!adminHasPermission(admin, AdminPermission.CLIENTS_CONTACT_READ)) {
      res.status(403).json({ message: 'You do not have permission to view client contact details.' });
      return;
    }

    const client = await User.findOne({ _id: id, role: UserRole.CUSTOMER })
      .select('name email phone')
      .lean();

    if (!client) {
      res.status(404).json({ message: 'Client not found.' });
      return;
    }

    await logAdminAction(req, 'client.contact.reveal', 'User', id, {
      clientName: client.name,
      revealTtlSeconds: 15,
    });

    res.status(200).json({
      success: true,
      contact: {
        id: client._id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        expiresInSeconds: 15,
      },
    });
  } catch (error) {
    console.error('Failed to reveal client contact:', error);
    res.status(500).json({ success: false, message: 'Failed to reveal client contact.' });
  }
};

export const getAdminBookings = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseLimit(req.query.limit);
    const bookings = await Booking.find(buildBookingFilter(req.query))
      .sort({ updatedAt: -1 })
      .limit(limit);

    res.status(200).json({ success: true, bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch bookings.' });
  }
};

export const getAdminBookingById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: 'Invalid booking id.' });
    return;
  }

  try {
    const [booking, quotes, invoices, ledger, media, messages] = await Promise.all([
      Booking.findById(id),
      JobQuote.find({ bookingId: id }).sort({ createdAt: -1 }),
      Invoice.find({ bookingId: id }).sort({ createdAt: -1 }),
      WalletTransaction.find({ bookingId: id }).sort({ createdAt: -1 }),
      JobMedia.find({ bookingId: id }).sort({ createdAt: -1 }),
      ChatMessage.find({ bookingId: id }).sort({ createdAt: 1 }).limit(300),
    ]);

    if (!booking) {
      res.status(404).json({ message: 'Booking not found.' });
      return;
    }

    const [customer, technicianUser, technicianProfile] = await Promise.all([
      booking.customerId && mongoose.Types.ObjectId.isValid(booking.customerId)
        ? User.findById(booking.customerId).select('name email phone profilePhotoUrl').lean()
        : null,
      booking.technicianId && mongoose.Types.ObjectId.isValid(booking.technicianId)
        ? User.findById(booking.technicianId).select('name email phone profilePhotoUrl').lean()
        : null,
      booking.technicianId && mongoose.Types.ObjectId.isValid(booking.technicianId)
        ? Technician.findOne({ userId: booking.technicianId }).select('documents.profilePhotoUrl documents.profilePhotoStatus approvalStatus').lean()
        : null,
    ]);
    const approvedTechnicianPhotoUrl = technicianProfile?.documents?.profilePhotoStatus === VerificationStatus.VERIFIED
      ? technicianProfile.documents.profilePhotoUrl
      : '';

    res.status(200).json({
      success: true,
      booking,
      participants: {
        customer,
        technician: technicianUser ? {
          ...technicianUser,
          profilePhotoUrl: technicianUser.profilePhotoUrl || approvedTechnicianPhotoUrl || '',
          photoStatus: technicianProfile?.documents?.profilePhotoStatus || 'NOT_SUBMITTED',
          approvalStatus: technicianProfile?.approvalStatus || '',
        } : null,
      },
      quotes,
      invoices,
      ledger,
      media,
      messages,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch booking.' });
  }
};

export const updateTechnicianCapabilityStatus = async (req: Request, res: Response): Promise<void> => {
  const { capabilityId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(capabilityId)) {
    res.status(400).json({ message: 'Invalid capability id.' });
    return;
  }

  const requestedStatus = String(req.body.verificationStatus || '').trim().toUpperCase();
  if (![CapabilityStatus.APPROVED, CapabilityStatus.REJECTED].includes(requestedStatus as CapabilityStatus)) {
    res.status(400).json({ message: 'verificationStatus must be APPROVED or REJECTED.' });
    return;
  }

  const verificationStatus = requestedStatus as CapabilityStatus.APPROVED | CapabilityStatus.REJECTED;
  const rejectionReason =
    typeof req.body.rejectionReason === 'string' ? req.body.rejectionReason.trim() : '';

  if (verificationStatus === CapabilityStatus.REJECTED && !rejectionReason) {
    res.status(400).json({ message: 'rejectionReason is required when rejecting a capability.' });
    return;
  }

  const approvedSpecialties =
    req.body.approvedSpecialties === undefined
      ? undefined
      : normalizeSpecialties(req.body.approvedSpecialties);

  try {
    const update: Record<string, unknown> = {
      verificationStatus,
      rejectionReason: verificationStatus === CapabilityStatus.REJECTED ? rejectionReason : null,
    };

    if (approvedSpecialties !== undefined) {
      update.approvedSpecialties = approvedSpecialties;
    }

    const capability = await TechnicianCapability.findByIdAndUpdate(
      capabilityId,
      { $set: update },
      { new: true, runValidators: true }
    );

    if (!capability) {
      res.status(404).json({ message: 'Technician capability not found.' });
      return;
    }

    const technicianUpdate =
      verificationStatus === CapabilityStatus.APPROVED
        ? { $addToSet: { serviceCategories: capability.categorySlug } }
        : { $pull: { serviceCategories: capability.categorySlug } };

    const technician = await Technician.findByIdAndUpdate(
      capability.technicianId,
      technicianUpdate,
      { new: true }
    );

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
  } catch (error) {
    console.error('Capability status update failed:', error);
    res.status(500).json({ success: false, message: 'Failed to update technician capability.' });
  }
};

export const getAdminQuotes = async (req: Request, res: Response): Promise<void> => {
  try {
    const filter: Record<string, unknown> = {};
    if (typeof req.query.status === 'string' && req.query.status) filter.status = req.query.status;
    if (typeof req.query.countryCode === 'string' && req.query.countryCode) filter.countryCode = req.query.countryCode.toUpperCase();

    const quotes = await JobQuote.find(filter)
      .populate('bookingId', 'applianceType status generalArea customerName')
      .populate('technicianId', 'name email phone')
      .populate('customerId', 'name email phone')
      .sort({ updatedAt: -1 })
      .limit(parseLimit(req.query.limit));

    res.status(200).json({ success: true, quotes });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch quotes.' });
  }
};

export const getAdminInvoices = async (req: Request, res: Response): Promise<void> => {
  try {
    const filter: Record<string, unknown> = {};
    if (typeof req.query.status === 'string' && req.query.status) filter.status = req.query.status;
    if (typeof req.query.countryCode === 'string' && req.query.countryCode) filter.countryCode = req.query.countryCode.toUpperCase();

    const invoices = await Invoice.find(filter)
      .populate('bookingId', 'applianceType status generalArea customerName')
      .populate('technicianId', 'name email phone')
      .populate('customerId', 'name email phone')
      .sort({ createdAt: -1 })
      .limit(parseLimit(req.query.limit));

    res.status(200).json({ success: true, invoices });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch invoices.' });
  }
};

export const getAdminWalletTransactions = async (req: Request, res: Response): Promise<void> => {
  try {
    const filter: Record<string, unknown> = {};
    if (typeof req.query.type === 'string' && req.query.type) filter.type = req.query.type;
    if (typeof req.query.status === 'string' && req.query.status) filter.status = req.query.status;
    if (typeof req.query.countryCode === 'string' && req.query.countryCode) filter.countryCode = req.query.countryCode.toUpperCase();

    const transactions = await WalletTransaction.find(filter)
      .populate('bookingId', 'applianceType status generalArea customerName')
      .populate('technicianId', 'name email phone')
      .populate('customerId', 'name email phone')
      .sort({ createdAt: -1 })
      .limit(parseLimit(req.query.limit, 100));

    res.status(200).json({ success: true, transactions });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch wallet transactions.' });
  }
};

export const getAdminMarkets = async (_req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json({
      success: true,
      markets: await getConfiguredMarkets(),
      availableMarkets: await getAvailableMarketOptions(),
      availableStatuses: Object.values(MarketStatus),
      availablePaymentProviders: ['PAYSTACK', 'FLUTTERWAVE', 'MPESA', 'MTN_MOMO', 'AIRTEL_MONEY', 'YOCO', 'OZOW'],
      defaultServiceCategories: DEFAULT_SERVICE_DEFINITIONS,
      serviceDefinitions: DEFAULT_SERVICE_DEFINITIONS,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load markets.' });
  }
};

export const getPublicMarkets = async (_req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json({ markets: await getActiveMarkets() });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load markets.' });
  }
};

export const getPublicMarketAvailability = async (req: Request, res: Response): Promise<void> => {
  try {
    const availability = await getMarketAvailability(req.params.country, req.query.city, req.query.area);
    res.status(200).json({ success: true, availability });
  } catch (error) {
    console.error('Failed to load market availability:', error);
    res.status(500).json({ message: 'Failed to load service availability.' });
  }
};

export const updateAdminMarket = async (req: Request, res: Response): Promise<void> => {
  try {
    const countryCode = String(req.params.countryCode || '').toUpperCase() as CountryCode;
    const baseMarket = MARKET_CONFIG[countryCode];
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
    const status = Object.values(MarketStatus).includes(requestedStatus)
      ? requestedStatus
      : (identity.enabled ?? req.body.enabled)
        ? MarketStatus.ACTIVE
        : MarketStatus.DISABLED;

    const paymentProviders = splitCsv(payments.paymentProviders ?? req.body.paymentProviders) as PaymentProviderCode[];
    const serviceCategories = normalizeServiceEntries(coverage.serviceCategories ?? req.body.serviceCategories);
    const supportedCities = splitCsv(coverage.supportedCities ?? req.body.supportedCities);
    const cityServiceAvailability = normalizeCityServiceAvailability(coverage.cityServiceAvailability ?? req.body.cityServiceAvailability);
    const paymentProviderSettings = normalizePaymentProviderSettings(payments.providerSettings ?? req.body.paymentProviderSettings);
    const actor = getActor(req);
    const admin = await getRequesterAdmin(req);
    const existingMarket = await MarketSetting.findOne({ 'identity.countryCode': countryCode }).lean();
    const previousServiceStatuses = collectServiceStatuses({
      serviceCategories: existingMarket?.coverage?.serviceCategories ?? [],
      cityServiceAvailability: existingMarket?.coverage?.cityServiceAvailability ?? [],
    });
    const nextServiceStatuses = collectServiceStatuses({
      serviceCategories,
      cityServiceAvailability,
    });
    const serviceActivations = getServiceActivations(nextServiceStatuses, previousServiceStatuses);

    if (serviceActivations.length && !canActivateMarketServices(admin)) {
      res.status(403).json({
        message: 'Only a super admin or an admin with service activation permission can activate services.',
        requiredPermission: AdminPermission.MARKETS_SERVICES_ACTIVATE,
        attemptedActivations: serviceActivations,
      });
      return;
    }
    const requestedCurrency =
      typeof (identity.currency ?? req.body.currency) === 'string' && String(identity.currency ?? req.body.currency).trim()
        ? String(identity.currency ?? req.body.currency).trim().toUpperCase()
        : '';
    const currency = requestedCurrency || baseMarket?.currency;
    const countryName = baseMarket?.countryName ?? String(identity.countryName ?? req.body.countryName ?? '').trim();
    const defaultCalloutFee =
      Number.isFinite(Number(pricing.defaultCalloutFeeMinor))
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

    const market = await MarketSetting.findOneAndUpdate(
      { 'identity.countryCode': countryCode },
      {
        identity: {
          countryCode,
          countryName,
          currency,
          locale: typeof (identity.locale ?? req.body.locale) === 'string' && String(identity.locale ?? req.body.locale).trim()
            ? String(identity.locale ?? req.body.locale).trim()
            : baseMarket?.locale ?? 'en',
          status,
          enabled: status === MarketStatus.ACTIVE,
        },
        pricing: {
          defaultCalloutFeeMinor: Math.round(defaultCalloutFee * 100),
          platformCommissionBps,
          taxLabel,
        },
        coverage: {
          supportedCities,
          serviceCategories: serviceCategories.length ? serviceCategories : DEFAULT_SERVICE_DEFINITIONS,
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
      },
      { new: true, upsert: true, runValidators: true }
    );

    await logAdminAction(req, 'market.update', 'MarketSetting', countryCode, {
      status: market.identity.status,
      enabled: market.identity.enabled,
      defaultCalloutFeeMinor: market.pricing.defaultCalloutFeeMinor,
      platformCommissionBps: market.pricing.platformCommissionBps,
      serviceActivations,
    });

    res.status(200).json({ success: true, market });
  } catch (error) {
    console.error('Market update failed:', error);
    res.status(500).json({ success: false, message: 'Failed to update market.' });
  }
};

export const listAdminUsers = async (_req: Request, res: Response): Promise<void> => {
  try {
    const admins = await User.find({ role: UserRole.ADMIN })
      .select('-password')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      admins,
      roles: Object.values(AdminRole),
      permissionsByRole: ADMIN_ROLE_PERMISSIONS,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch admin users.' });
  }
};

export const createAdminUser = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!(await isSuperAdmin(req))) {
      res.status(403).json({ message: 'Only a super admin can create admin users.' });
      return;
    }

    const { name, email, phone, password, adminRole, adminPermissions, countryCode, location } = req.body;
    if (!name || !email || !phone) {
      res.status(400).json({ message: 'Name, email, and phone are required.' });
      return;
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) {
      res.status(409).json({ message: 'A user with this email already exists.' });
      return;
    }

    const selectedRole = Object.values(AdminRole).includes(adminRole) ? adminRole : AdminRole.READ_ONLY_ADMIN;
    const requestedCountryCode = String(countryCode || 'ZA').toUpperCase() as CountryCode;
    const baseMarket = MARKET_CONFIG[requestedCountryCode];
    if (!baseMarket) {
      res.status(400).json({ message: 'This country is not configured as a MyFixer market yet. Add it in Settings before assigning staff to it.' });
      return;
    }
    const temporaryPassword = typeof password === 'string' && password.trim().length >= 8
      ? password
      : generateTemporaryPassword();
    const admin = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      phone: String(phone).trim(),
      location: {
        country: baseMarket.countryName,
        city: location?.city?.trim() || 'Head Office',
      },
      countryCode: baseMarket.countryCode,
      currency: baseMarket.currency,
      password: await bcrypt.hash(temporaryPassword, 10),
      role: UserRole.ADMIN,
      adminRole: selectedRole,
      adminPermissions: resolveAdminPermissions(selectedRole, normalizeAdminPermissionsInput(adminPermissions)),
      isActive: true,
      mustChangePassword: true,
    });

    const portalUrl = process.env.ADMIN_PORTAL_URL?.trim().replace(/\/$/, '') || '';
    const onboardingEmailSent = portalUrl
      ? await EmailService.sendStaffOnboardingEmail({
          recipientEmail: admin.email,
          name: admin.name,
          portalUrl,
          username: admin.email,
          temporaryPassword,
        })
      : false;

    await logAdminAction(req, 'admin.create', 'User', admin._id.toString(), {
      email: admin.email,
      adminRole: admin.adminRole,
      onboardingEmailSent,
    });

    const result = admin.toObject();
    delete (result as any).password;
    res.status(201).json({ success: true, admin: result, onboardingEmailSent });
  } catch (error) {
    console.error('Admin create failed:', error);
    res.status(500).json({ success: false, message: 'Failed to create admin user.' });
  }
};

export const updateAdminUser = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!(await isSuperAdmin(req))) {
      res.status(403).json({ message: 'Only a super admin can update admin users.' });
      return;
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'Invalid admin id.' });
      return;
    }

    const targetAdmin = await User.findOne({ _id: id, role: UserRole.ADMIN }).select('adminRole adminPermissions');
    if (!targetAdmin) {
      res.status(404).json({ message: 'Admin user not found.' });
      return;
    }

    const updates: Record<string, unknown> = {};
    if (Object.values(AdminRole).includes(req.body.adminRole)) {
      const requestedPermissions = Array.isArray(req.body.adminPermissions)
        ? normalizeAdminPermissionsInput(req.body.adminPermissions)
        : normalizeAdminPermissionsInput(targetAdmin.adminPermissions);
      updates.adminRole = req.body.adminRole;
      updates.adminPermissions = resolveAdminPermissions(req.body.adminRole, requestedPermissions);
    } else if (Array.isArray(req.body.adminPermissions)) {
      updates.adminPermissions = resolveAdminPermissions(targetAdmin.adminRole || AdminRole.READ_ONLY_ADMIN, normalizeAdminPermissionsInput(req.body.adminPermissions));
    }
    if (typeof req.body.isActive === 'boolean') updates.isActive = req.body.isActive;
    if (typeof req.body.name === 'string' && req.body.name.trim()) updates.name = req.body.name.trim();
    if (typeof req.body.phone === 'string' && req.body.phone.trim()) updates.phone = req.body.phone.trim();

    const admin = await User.findOneAndUpdate(
      { _id: id, role: UserRole.ADMIN },
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    await logAdminAction(req, 'admin.update', 'User', id, updates);
    res.status(200).json({ success: true, admin });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update admin user.' });
  }
};

export const listAdminPromotions = async (_req: Request, res: Response): Promise<void> => {
  try {
    const promotions = await Promotion.find().sort({ createdAt: -1 }).limit(200).lean();
    res.status(200).json({
      success: true,
      promotions,
      discountTypes: Object.values(PromotionDiscountType),
      statuses: Object.values(PromotionStatus),
    });
  } catch (error) {
    console.error('Failed to load promotions:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch promotions.' });
  }
};

export const createAdminPromotion = async (req: Request, res: Response): Promise<void> => {
  try {
    const actor = getActor(req);
    const code = normalizePromotionCode(req.body.code);
    const payload = normalizePromotionPayload(req.body);

    if (!code) {
      res.status(400).json({ message: 'Promo code is required.' });
      return;
    }

    if (!payload.name) {
      res.status(400).json({ message: 'Promotion name is required.' });
      return;
    }

    const promotion = await Promotion.create({
      ...payload,
      code,
      createdBy: actor?.id,
      updatedBy: actor?.id,
    });

    await logAdminAction(req, 'promotion.create', 'Promotion', promotion._id.toString(), {
      code: promotion.code,
      discountType: promotion.discountType,
      discountValue: promotion.discountValue,
    });

    res.status(201).json({ success: true, promotion });
  } catch (error: any) {
    if (error?.code === 11000) {
      res.status(409).json({ message: 'A promotion with this code already exists.' });
      return;
    }
    res.status(400).json({ success: false, message: error.message || 'Failed to create promotion.' });
  }
};

export const updateAdminPromotion = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'Invalid promotion id.' });
      return;
    }

    const actor = getActor(req);
    const updates = normalizePromotionPatchPayload(req.body);
    const promotion = await Promotion.findByIdAndUpdate(
      id,
      { $set: { ...updates, updatedBy: actor?.id } },
      { new: true, runValidators: true }
    );

    if (!promotion) {
      res.status(404).json({ message: 'Promotion not found.' });
      return;
    }

    await logAdminAction(req, 'promotion.update', 'Promotion', id, updates);
    res.status(200).json({ success: true, promotion });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to update promotion.' });
  }
};

export const getAdminAuditLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const logs = await AuditLog.find()
      .sort({ createdAt: -1 })
      .limit(parseLimit(req.query.limit, 100));
    res.status(200).json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch audit logs.' });
  }
};
