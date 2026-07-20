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
exports.getAdminAuditLogs = exports.updateAdminPromotion = exports.archiveAdminPromotion = exports.endAdminPromotion = exports.pauseAdminPromotion = exports.activateAdminPromotion = exports.duplicateAdminPromotion = exports.getAdminPromotionAudit = exports.getAdminPromotionRedemptions = exports.getAdminPromotionPerformance = exports.getAdminPromotionById = exports.createAdminPromotion = exports.getAdminPromotionsSummary = exports.listAdminPromotions = exports.updateAdminUser = exports.createAdminUser = exports.listAdminUsers = exports.deleteAdminMarketArea = exports.updateAdminMarketArea = exports.createAdminMarketArea = exports.deleteAdminMarketCity = exports.updateAdminMarketCity = exports.createAdminMarketCity = exports.deleteAdminMarket = exports.updateAdminMarket = exports.getPublicMarketAvailability = exports.getPublicMarkets = exports.previewAdminPricing = exports.getPublicServices = exports.updateAdminService = exports.deleteAdminBookableService = exports.deleteAdminServiceCategory = exports.deleteAdminServiceGroup = exports.updateAdminServiceGroup = exports.createAdminService = exports.uploadAdminServiceImage = exports.getAdminServices = exports.getAdminMarkets = exports.getAdminWalletTransactions = exports.getAdminInvoices = exports.getAdminQuotes = exports.updateTechnicianCapabilityStatus = exports.getAdminBookingById = exports.getAdminBookings = exports.revealAdminClientContact = exports.getAdminClients = exports.getAdminOverview = exports.buildPromotionAnalyticsSummary = exports.promotionMaterialFieldsChanged = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const crypto_1 = __importDefault(require("crypto"));
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
const promotion_model_1 = __importStar(require("../models/promotion.model"));
const payment_transaction_model_1 = __importDefault(require("../models/payment-transaction.model"));
const payment_webhook_event_model_1 = __importDefault(require("../models/payment-webhook-event.model"));
const provider_settlement_model_1 = __importDefault(require("../models/provider-settlement.model"));
const payout_transaction_model_1 = __importDefault(require("../models/payout-transaction.model"));
const provider_payout_method_model_1 = __importDefault(require("../models/provider-payout-method.model"));
const paymentVault_model_1 = __importDefault(require("../models/paymentVault.model"));
const managed_collection_model_1 = __importDefault(require("../models/managed-collection.model"));
const managed_collection_job_model_1 = __importDefault(require("../models/managed-collection-job.model"));
const managed_collection_subscription_model_1 = require("../models/managed-collection-subscription.model");
const service_waitlist_model_1 = __importDefault(require("../models/service-waitlist.model"));
const service_catalog_model_1 = __importStar(require("../models/service-catalog.model"));
const notification_model_1 = __importDefault(require("../models/notification.model"));
const email_service_1 = require("../services/email/email.service");
const service_availability_service_1 = require("../services/service-availability.service");
const media_storage_service_1 = require("../services/media-storage.service");
const market_lifecycle_service_1 = require("../services/market-lifecycle.service");
const market_city_service_1 = require("../services/market-city.service");
const price_breakdown_service_1 = require("../services/price-breakdown.service");
const parseLimit = (value, fallback = 50) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed))
        return fallback;
    return Math.min(Math.max(Math.floor(parsed), 1), 200);
};
const ADMIN_ROLE_PERMISSIONS = {
    [user_model_1.AdminRole.SUPER_ADMIN]: Object.values(user_model_1.AdminPermission),
    [user_model_1.AdminRole.OPERATIONS_MANAGER]: [
        user_model_1.AdminPermission.OVERVIEW_READ,
        user_model_1.AdminPermission.BOOKINGS_READ,
        user_model_1.AdminPermission.BOOKINGS_UPDATE,
        user_model_1.AdminPermission.TECHNICIANS_READ,
        user_model_1.AdminPermission.TECHNICIANS_REVIEW,
        user_model_1.AdminPermission.CLIENTS_CONTACT_READ,
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
        user_model_1.AdminPermission.PROMOTIONS_READ,
        user_model_1.AdminPermission.PROMOTIONS_CREATE,
        user_model_1.AdminPermission.PROMOTIONS_UPDATE,
        user_model_1.AdminPermission.PROMOTIONS_ACTIVATE,
        user_model_1.AdminPermission.PROMOTIONS_PAUSE,
        user_model_1.AdminPermission.PROMOTIONS_ARCHIVE,
        user_model_1.AdminPermission.PROMOTIONS_PERFORMANCE_READ,
        user_model_1.AdminPermission.PROMOTIONS_REDEMPTIONS_READ,
        user_model_1.AdminPermission.SETTINGS_READ,
    ],
    [user_model_1.AdminRole.SUPPORT_AGENT]: [
        user_model_1.AdminPermission.OVERVIEW_READ,
        user_model_1.AdminPermission.BOOKINGS_READ,
        user_model_1.AdminPermission.TECHNICIANS_READ,
        user_model_1.AdminPermission.CLIENTS_CONTACT_READ,
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
        user_model_1.AdminPermission.PROMOTIONS_READ,
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
const logAdminAction = async (req, action, resourceType, resourceId, metadata = {}, success = true) => {
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
        success,
    });
};
const countMarketDependencies = async (countryCode) => {
    const normalized = countryCode.toUpperCase();
    const bookingIds = await booking_model_1.default.find({ countryCode: normalized }).distinct('_id');
    const referenceValues = bookingIds.map((id) => id.toString());
    const entries = await Promise.all([
        ['bookings', booking_model_1.default.countDocuments({ countryCode: normalized })],
        ['technicians', technician_model_1.default.countDocuments({ countryCode: normalized })],
        ['users', user_model_1.default.countDocuments({ countryCode: normalized })],
        ['technicianCapabilities', technician_capability_model_1.default.countDocuments({ countryCode: normalized })],
        ['quotes', quote_model_1.default.countDocuments({ countryCode: normalized })],
        ['invoices', billing_model_1.Invoice.countDocuments({ countryCode: normalized })],
        ['walletTransactions', billing_model_1.WalletTransaction.countDocuments({ countryCode: normalized })],
        ['paymentTransactions', payment_transaction_model_1.default.countDocuments({ $or: [{ countryCode: normalized }, { bookingId: { $in: bookingIds } }] })],
        ['paymentWebhookEvents', payment_webhook_event_model_1.default.countDocuments({ $or: [{ 'metadata.countryCode': normalized }, { reference: { $in: referenceValues } }] })],
        ['settlements', provider_settlement_model_1.default.countDocuments({ countryCode: normalized })],
        ['payoutTransactions', payout_transaction_model_1.default.countDocuments({ countryCode: normalized })],
        ['providerPayoutMethods', provider_payout_method_model_1.default.countDocuments({ countryCode: normalized })],
        ['paymentVaults', paymentVault_model_1.default.countDocuments({ countryCode: normalized })],
        ['promotions', promotion_model_1.default.countDocuments({ countryCode: normalized })],
        ['managedCollectionProfiles', managed_collection_model_1.default.countDocuments({ countryCode: normalized })],
        ['managedCollectionJobs', managed_collection_job_model_1.default.countDocuments({ countryCode: normalized })],
        ['managedCollectionPlans', managed_collection_subscription_model_1.ManagedCollectionPlan.countDocuments({ countryCode: normalized })],
        ['managedCollectionSubscriptions', managed_collection_subscription_model_1.ManagedCollectionSubscription.countDocuments({ countryCode: normalized })],
        ['managedCollectionInvoices', managed_collection_subscription_model_1.ManagedCollectionSubscriptionInvoice.countDocuments({ countryCode: normalized })],
        ['serviceWaitlist', service_waitlist_model_1.default.countDocuments({ countryCode: normalized })],
        ['notifications', notification_model_1.default.countDocuments({ 'metadata.countryCode': normalized })],
        ['auditLogs', audit_log_model_1.default.countDocuments({
                $or: [
                    { 'event.resourceId': normalized, 'event.action': { $ne: 'market.create' } },
                    { 'metadata.countryCode': normalized },
                ],
            })],
    ]);
    return Object.fromEntries(entries
        .map(([key, count]) => [key, Number(count)])
        .filter(([, count]) => count > 0));
};
const cityRegex = (cityName) => new RegExp(`^${cityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
const countMarketCityDependencies = async (countryCode, cityName) => {
    const normalizedCountry = countryCode.toUpperCase();
    const normalizedCity = (0, market_city_service_1.normalizeMarketCityName)(cityName);
    const cityMatch = cityRegex(normalizedCity);
    const entries = await Promise.all([
        ['bookings', booking_model_1.default.countDocuments({ countryCode: normalizedCountry, city: cityMatch })],
        ['bookingLocations', booking_model_1.default.countDocuments({ countryCode: normalizedCountry, 'location.city': cityMatch })],
        ['technicians', technician_model_1.default.countDocuments({ countryCode: normalizedCountry, city: cityMatch })],
        ['users', user_model_1.default.countDocuments({ countryCode: normalizedCountry, 'location.city': cityMatch })],
        ['serviceWaitlist', service_waitlist_model_1.default.countDocuments({ countryCode: normalizedCountry, city: cityMatch })],
        ['promotions', promotion_model_1.default.countDocuments({ countryCode: normalizedCountry, cityKeys: cityMatch })],
        ['managedCollectionProfiles', managed_collection_model_1.default.countDocuments({ countryCode: normalizedCountry, city: cityMatch })],
        ['managedCollectionJobs', managed_collection_job_model_1.default.countDocuments({ countryCode: normalizedCountry, city: cityMatch })],
        ['managedCollectionPlans', managed_collection_subscription_model_1.ManagedCollectionPlan.countDocuments({ countryCode: normalizedCountry, city: cityMatch })],
        ['managedCollectionSubscriptions', managed_collection_subscription_model_1.ManagedCollectionSubscription.countDocuments({ countryCode: normalizedCountry, city: cityMatch })],
        ['managedCollectionInvoices', managed_collection_subscription_model_1.ManagedCollectionSubscriptionInvoice.countDocuments({ countryCode: normalizedCountry, city: cityMatch })],
    ]);
    return Object.fromEntries(entries
        .map(([key, count]) => [key, Number(count)])
        .filter(([, count]) => count > 0));
};
const countMarketAreaDependencies = async (countryCode, cityName, areaName) => {
    const normalizedCountry = countryCode.toUpperCase();
    const cityMatch = cityRegex((0, market_city_service_1.normalizeMarketCityName)(cityName));
    const areaMatch = cityRegex((0, market_city_service_1.normalizeMarketAreaName)(areaName));
    const entries = await Promise.all([
        ['bookings', booking_model_1.default.countDocuments({ countryCode: normalizedCountry, city: cityMatch, generalArea: areaMatch })],
        ['bookingLocations', booking_model_1.default.countDocuments({ countryCode: normalizedCountry, 'location.city': cityMatch, 'location.area': areaMatch })],
        ['users', user_model_1.default.countDocuments({ countryCode: normalizedCountry, 'location.city': cityMatch, 'location.area': areaMatch })],
        ['serviceWaitlist', service_waitlist_model_1.default.countDocuments({ countryCode: normalizedCountry, city: cityMatch, area: areaMatch })],
        ['promotions', promotion_model_1.default.countDocuments({ countryCode: normalizedCountry, cityKeys: cityMatch, areaKeys: areaMatch })],
        ['managedCollectionProfiles', managed_collection_model_1.default.countDocuments({ countryCode: normalizedCountry, city: cityMatch, area: areaMatch })],
        ['managedCollectionJobs', managed_collection_job_model_1.default.countDocuments({ countryCode: normalizedCountry, city: cityMatch, area: areaMatch })],
        ['managedCollectionPlans', managed_collection_subscription_model_1.ManagedCollectionPlan.countDocuments({ countryCode: normalizedCountry, city: cityMatch, area: areaMatch })],
        ['managedCollectionSubscriptions', managed_collection_subscription_model_1.ManagedCollectionSubscription.countDocuments({ countryCode: normalizedCountry, city: cityMatch, area: areaMatch })],
        ['managedCollectionInvoices', managed_collection_subscription_model_1.ManagedCollectionSubscriptionInvoice.countDocuments({ countryCode: normalizedCountry, city: cityMatch, area: areaMatch })],
    ]);
    return Object.fromEntries(entries
        .map(([key, count]) => [key, Number(count)])
        .filter(([, count]) => count > 0));
};
const resolveAdminPermissions = (adminRole, extraPermissions = []) => Array.from(new Set([...(ADMIN_ROLE_PERMISSIONS[adminRole] || []), ...extraPermissions]));
const normalizeAdminPermissionsInput = (value) => Array.isArray(value)
    ? Array.from(new Set(value.filter((permission) => Object.values(user_model_1.AdminPermission).includes(permission))))
    : [];
const generateTemporaryPassword = () => `${crypto_1.default.randomBytes(9).toString('base64url')}A1!`;
const normalizePromotionCode = (value) => String(value || '').trim().toUpperCase().replace(/\s+/g, '');
const normalizePromotionKeys = (value) => Array.from(new Set(splitCsv(value).map((item) => (0, service_availability_service_1.normalizeServiceKey)(item)).filter(Boolean)));
const normalizeObjectIds = (value) => splitCsv(value)
    .filter((item) => mongoose_1.default.Types.ObjectId.isValid(item))
    .map((item) => new mongoose_1.default.Types.ObjectId(item));
const normalizeFundingSplit = (body, fundingSource) => {
    const fundingSplit = body.fundingSplitBps && typeof body.fundingSplitBps === 'object'
        ? body.fundingSplitBps
        : {};
    const platform = Number(body.platformFundingBps ?? fundingSplit.platform);
    const technician = Number(body.technicianFundingBps ?? fundingSplit.technician);
    const partner = Number(body.partnerFundingBps ?? fundingSplit.partner);
    const split = {
        platform: Number.isFinite(platform) ? Math.max(0, Math.min(10000, Math.round(platform))) : 0,
        technician: Number.isFinite(technician) ? Math.max(0, Math.min(10000, Math.round(technician))) : 0,
        partner: Number.isFinite(partner) ? Math.max(0, Math.min(10000, Math.round(partner))) : 0,
    };
    if (split.platform + split.technician + split.partner === 0) {
        if (fundingSource === promotion_model_1.PromotionFundingSource.PROVIDER || fundingSource === promotion_model_1.PromotionFundingSource.TECHNICIAN)
            split.technician = 10000;
        else if (fundingSource === promotion_model_1.PromotionFundingSource.PARTNER)
            split.partner = 10000;
        else
            split.platform = 10000;
    }
    const total = split.platform + split.technician + split.partner;
    if (total !== 10000) {
        throw new Error('Promotion funding split must add up to 100%.');
    }
    return split;
};
const normalizeFundingSource = (value) => {
    const raw = String(value || '').trim().toUpperCase();
    if (raw === 'PLATFORM')
        return promotion_model_1.PromotionFundingSource.MYFIXER;
    if (raw === 'TECHNICIAN')
        return promotion_model_1.PromotionFundingSource.PROVIDER;
    return Object.values(promotion_model_1.PromotionFundingSource).includes(raw)
        ? raw
        : promotion_model_1.PromotionFundingSource.MYFIXER;
};
const optionalDate = (value) => {
    if (!value)
        return null;
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date;
};
const normalizePromotionMetadata = (body, existing = {}) => ({
    ...existing,
    customerTitle: String(body.customerTitle || existing.customerTitle || '').trim().slice(0, 160),
    internalNotes: String(body.internalNotes || existing.internalNotes || '').trim().slice(0, 2000),
    partnerReference: String(body.partnerReference || existing.partnerReference || '').trim().slice(0, 160),
});
const normalizePromotionPayload = (body) => {
    const triggerType = Object.values(promotion_model_1.PromotionTriggerType).includes(body.triggerType)
        ? body.triggerType
        : normalizePromotionCode(body.code)
            ? promotion_model_1.PromotionTriggerType.CODE
            : promotion_model_1.PromotionTriggerType.AUTOMATIC;
    const discountType = Object.values(promotion_model_1.PromotionDiscountType).includes(body.discountType)
        ? body.discountType
        : promotion_model_1.PromotionDiscountType.PERCENTAGE;
    const discountValue = Number(body.discountValue);
    const countryCode = String(body.countryCode || '').trim().toUpperCase();
    const currency = String(body.currency || '').trim().toUpperCase();
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
        throw new Error('Discount value must be greater than zero.');
    }
    if (discountType === promotion_model_1.PromotionDiscountType.PERCENTAGE && discountValue > 100) {
        throw new Error('Percentage discounts cannot exceed 100%.');
    }
    const fundingSource = normalizeFundingSource(body.fundingSource);
    return {
        name: String(body.name || '').trim(),
        description: String(body.description || '').trim(),
        status: Object.values(promotion_model_1.PromotionStatus).includes(body.status)
            ? body.status
            : promotion_model_1.PromotionStatus.DRAFT,
        triggerType,
        discountType,
        discountValue,
        maxDiscountMinor: Number.isFinite(Number(body.maxDiscountMinor)) ? Number(body.maxDiscountMinor) : null,
        minBookingAmountMinor: Number.isFinite(Number(body.minBookingAmountMinor)) ? Number(body.minBookingAmountMinor) : 0,
        countryCode: countryCode ? (0, market_config_1.normalizeIsoCountryCode)(countryCode) : null,
        currency: currency ? (0, market_config_1.normalizeIsoCurrencyCode)(currency) : null,
        cityKeys: normalizePromotionKeys(body.cityKeys),
        areaKeys: normalizePromotionKeys(body.areaKeys),
        serviceKeys: normalizePromotionKeys(body.serviceKeys),
        subcategoryKeys: normalizePromotionKeys(body.subcategoryKeys),
        eligibleClientIds: normalizeObjectIds(body.eligibleClientIds),
        excludedClientIds: normalizeObjectIds(body.excludedClientIds),
        firstBookingOnly: body.firstBookingOnly === true,
        priority: Number.isFinite(Number(body.priority)) ? Math.max(0, Math.round(Number(body.priority))) : 100,
        stackingPolicy: Object.values(promotion_model_1.PromotionStackingPolicy).includes(body.stackingPolicy)
            ? body.stackingPolicy
            : promotion_model_1.PromotionStackingPolicy.EXCLUSIVE,
        fundingSource,
        fundingSplitBps: normalizeFundingSplit(body, fundingSource),
        budgetMinor: Number.isFinite(Number(body.budgetMinor)) ? Number(body.budgetMinor) : null,
        startsAt: optionalDate(body.startsAt),
        expiresAt: optionalDate(body.expiresAt),
        usageLimit: Number.isFinite(Number(body.usageLimit)) ? Number(body.usageLimit) : null,
        perClientLimit: Number.isFinite(Number(body.perClientLimit)) ? Number(body.perClientLimit) : null,
        metadata: normalizePromotionMetadata(body),
    };
};
const normalizeServiceStatus = (value) => Object.values(service_catalog_model_1.ServicePublicationStatus).includes(value)
    ? value
    : service_catalog_model_1.ServicePublicationStatus.DRAFT;
const normalizeMarketStatusValue = (value, fallback = market_setting_model_1.MarketStatus.ACTIVE) => Object.values(market_setting_model_1.MarketStatus).includes(value) ? value : fallback;
const MAX_SERVICE_PRICE_MINOR = 100_000_000;
const MAX_SERVICE_IMAGE_BYTES = 5 * 1024 * 1024;
const SERVICE_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const normalizeHttpsImageUrl = (value) => {
    const url = String(value || '').trim();
    if (!url)
        return '';
    if (!/^https:\/\/[^\s]+$/i.test(url)) {
        throw new Error('Image URL must be a valid HTTPS URL.');
    }
    return url;
};
const parseServiceImageDataUri = (value) => {
    const dataUri = String(value || '').trim();
    const match = dataUri.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/i);
    if (!match) {
        throw new Error('Choose a JPG, PNG, or WebP image.');
    }
    const mimeType = match[1].toLowerCase();
    if (!SERVICE_IMAGE_MIME_TYPES.has(mimeType)) {
        throw new Error('Choose a JPG, PNG, or WebP image.');
    }
    const base64 = match[2];
    const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
    const sizeBytes = Math.floor((base64.length * 3) / 4) - padding;
    if (sizeBytes <= 0 || sizeBytes > MAX_SERVICE_IMAGE_BYTES) {
        throw new Error('Service images must be 5 MB or smaller.');
    }
    return { dataUri, mimeType, sizeBytes };
};
const minorFromInput = (minorValue, decimalValue) => {
    if (typeof minorValue === 'number' && Number.isFinite(minorValue)) {
        const rounded = Math.round(minorValue);
        return rounded >= 0 && rounded <= MAX_SERVICE_PRICE_MINOR ? rounded : minorValue;
    }
    if (typeof decimalValue === 'number' && Number.isFinite(decimalValue)) {
        const rounded = Math.round(decimalValue * 100);
        return rounded >= 0 && rounded <= MAX_SERVICE_PRICE_MINOR ? rounded : decimalValue * 100;
    }
    return undefined;
};
const normalizeStringList = (value) => {
    if (Array.isArray(value)) {
        return value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 50);
    }
    if (typeof value === 'string') {
        return value.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 50);
    }
    return [];
};
const normalizeCapabilityRequirements = (value) => {
    const record = value && typeof value === 'object' ? value : {};
    return {
        requiredEvidenceTypes: normalizeStringList(record.requiredEvidenceTypes),
        equipmentRequired: normalizeStringList(record.equipmentRequired),
        licenceRequired: record.licenceRequired === true,
        certificateRequired: record.certificateRequired === true,
        notes: String(record.notes || '').trim().slice(0, 1200),
    };
};
const normalizeServiceSubcategories = (value) => Array.isArray(value)
    ? value
        .map((entry) => {
        if (!entry || typeof entry !== 'object')
            return null;
        const record = entry;
        const label = String(record.label || '').trim();
        const subcategoryKey = (0, service_availability_service_1.normalizeServiceKey)(record.subcategoryKey ?? record.key ?? label);
        if (!subcategoryKey || !label)
            return null;
        const stableServiceKey = (0, service_availability_service_1.normalizeServiceKey)(record.serviceKey ?? subcategoryKey);
        const calloutFeeMinor = minorFromInput(record.calloutFeeMinor, record.calloutFee);
        const minimumChargeMinor = minorFromInput(record.minimumChargeMinor, record.minimumCharge);
        return {
            subcategoryKey,
            serviceKey: stableServiceKey || subcategoryKey,
            label,
            description: String(record.description || '').trim().slice(0, 1200),
            status: normalizeMarketStatusValue(record.status),
            publicationStatus: normalizeServiceStatus(record.publicationStatus ?? service_catalog_model_1.ServicePublicationStatus.PUBLISHED),
            displayOrder: Number.isFinite(Number(record.displayOrder)) ? Math.max(0, Number(record.displayOrder)) : 0,
            imageKey: (0, service_availability_service_1.normalizeServiceKey)(record.imageKey || ''),
            imageUrl: normalizeHttpsImageUrl(record.imageUrl),
            searchKeywords: normalizeStringList(record.searchKeywords),
            synonyms: normalizeStringList(record.synonyms),
            estimatedDurationMinutes: Number.isFinite(Number(record.estimatedDurationMinutes))
                ? Math.max(0, Math.round(Number(record.estimatedDurationMinutes)))
                : undefined,
            inspectionRequired: record.inspectionRequired === true,
            fixedPriceSupported: record.fixedPriceSupported === true,
            requiresCapabilityApproval: record.requiresCapabilityApproval === undefined ? true : record.requiresCapabilityApproval === true,
            capabilityRequirements: normalizeCapabilityRequirements(record.capabilityRequirements),
            ...(calloutFeeMinor !== undefined ? { calloutFeeMinor } : {}),
            ...(minimumChargeMinor !== undefined ? { minimumChargeMinor } : {}),
        };
    })
        .filter(Boolean)
    : [];
const isEmptyDraftGroupAnchorRecord = (service) => service.status === service_catalog_model_1.ServicePublicationStatus.DRAFT &&
    String(service.serviceKey || '').endsWith('_services') &&
    (!Array.isArray(service.subcategories) || service.subcategories.length === 0);
const shouldInferGroupAnchorMetadata = (service) => {
    if (!isEmptyDraftGroupAnchorRecord(service))
        return false;
    const serviceKey = (0, service_availability_service_1.normalizeServiceKey)(service.serviceKey);
    const groupKey = (0, service_availability_service_1.normalizeServiceKey)(service.groupKey);
    if (!serviceKey)
        return false;
    if (!groupKey || groupKey === serviceKey)
        return true;
    const defaultedHomeGroup = groupKey === 'home_services' &&
        serviceKey !== 'home_services' &&
        String(service.groupLabel || '').trim().toLowerCase() === 'home services';
    return defaultedHomeGroup;
};
const serializedGroupKeyForService = (service) => shouldInferGroupAnchorMetadata(service)
    ? (0, service_availability_service_1.normalizeServiceKey)(service.serviceKey)
    : (0, service_availability_service_1.normalizeServiceKey)(service.groupKey || 'home_services') || 'home_services';
const serializedGroupLabelForService = (service) => shouldInferGroupAnchorMetadata(service)
    ? String(service.label || service.serviceKey).trim()
    : String(service.groupLabel || 'Home Services').trim();
const serviceBelongsToAdminGroup = (service, groupKey) => {
    const normalizedGroupKey = (0, service_availability_service_1.normalizeServiceKey)(groupKey);
    if (!normalizedGroupKey)
        return false;
    if ((0, service_availability_service_1.normalizeServiceKey)(service.groupKey) === normalizedGroupKey)
        return true;
    return shouldInferGroupAnchorMetadata(service) && (0, service_availability_service_1.normalizeServiceKey)(service.serviceKey) === normalizedGroupKey;
};
const serializeServiceCatalog = (service) => {
    const groupKey = serializedGroupKeyForService(service);
    const groupLabel = serializedGroupLabelForService(service);
    return {
        id: String(service._id),
        serviceKey: service.serviceKey,
        categoryKey: service.categoryKey || service.serviceKey,
        groupKey,
        groupLabel,
        groupDescription: service.groupDescription || '',
        groupImageKey: service.groupImageKey || '',
        groupImageUrl: service.groupImageUrl || '',
        groupIconKey: service.groupIconKey || '',
        groupStatus: shouldInferGroupAnchorMetadata(service)
            ? service.groupStatus || service.status || service_catalog_model_1.ServicePublicationStatus.DRAFT
            : service.groupStatus || service_catalog_model_1.ServicePublicationStatus.PUBLISHED,
        groupDisplayOrder: service.groupDisplayOrder || 0,
        label: service.label,
        description: service.description || '',
        internalNotes: service.internalNotes || '',
        imageKey: service.imageKey || 'maintenance',
        imageUrl: service.imageUrl || '',
        iconKey: service.iconKey || '',
        searchKeywords: service.searchKeywords || [],
        synonyms: service.synonyms || [],
        status: service.status,
        displayOrder: service.displayOrder || 0,
        defaultCalloutFeeMinor: service.defaultCalloutFeeMinor,
        minimumChargeMinor: service.minimumChargeMinor,
        fixedPriceSupported: service.fixedPriceSupported === true,
        requiresCapabilityApproval: service.requiresCapabilityApproval !== false,
        capabilityRequirements: service.capabilityRequirements || {},
        subcategories: service.subcategories || [],
        createdAt: service.createdAt,
        updatedAt: service.updatedAt,
    };
};
const getServiceDefinitions = async (publishedOnly = false) => {
    const filter = publishedOnly ? { status: service_catalog_model_1.ServicePublicationStatus.PUBLISHED } : {};
    const services = await service_catalog_model_1.default.find(filter).sort({ label: 1 }).lean();
    return services.map(serializeServiceCatalog);
};
const groupBlockedMessage = (groupLabel, reasons) => `${groupLabel} cannot be deleted because it contains or is referenced by ${reasons.join(', ')}. Remove or archive child items first. Historical or operational references must be archived in a later hierarchy step.`;
const countGroupDeleteDependencies = async (groupKey, serviceKeys) => {
    const marketServiceQuery = {
        $or: [
            { 'coverage.serviceCategories.serviceKey': { $in: serviceKeys } },
            { serviceCategories: { $in: serviceKeys } },
            { 'serviceCategories.serviceKey': { $in: serviceKeys } },
            { 'coverage.cityServiceAvailability.services.serviceKey': { $in: serviceKeys } },
            { 'coverage.cityServiceAvailability.areas.services.serviceKey': { $in: serviceKeys } },
            { 'cityServiceAvailability.services.serviceKey': { $in: serviceKeys } },
            { 'cityServiceAvailability.areas.services.serviceKey': { $in: serviceKeys } },
        ],
    };
    const [bookings, technicianCapabilities, markets, promotions, waitlists,] = await Promise.all([
        booking_model_1.default.countDocuments({
            $or: [
                { serviceKey: { $in: serviceKeys } },
                { 'metadata.serviceKey': { $in: serviceKeys } },
                { 'metadata.subcategoryKey': { $in: serviceKeys } },
            ],
        }),
        technician_capability_model_1.default.countDocuments({
            $or: [
                { categorySlug: { $in: serviceKeys } },
                { approvedSpecialties: { $in: serviceKeys } },
            ],
        }),
        market_setting_model_1.default.countDocuments(marketServiceQuery),
        promotion_model_1.default.countDocuments({
            $or: [
                { serviceKeys: { $in: serviceKeys } },
                { subcategoryKeys: { $in: serviceKeys } },
            ],
        }),
        service_waitlist_model_1.default.countDocuments({ serviceKey: { $in: serviceKeys } }),
    ]);
    return {
        groupKey,
        bookings,
        technicianCapabilities,
        markets,
        promotions,
        waitlists,
    };
};
const countServiceDeleteDependencies = async (serviceKeys) => {
    const marketServiceQuery = {
        $or: [
            { 'coverage.serviceCategories.serviceKey': { $in: serviceKeys } },
            { serviceCategories: { $in: serviceKeys } },
            { 'serviceCategories.serviceKey': { $in: serviceKeys } },
            { 'coverage.cityServiceAvailability.services.serviceKey': { $in: serviceKeys } },
            { 'coverage.cityServiceAvailability.areas.services.serviceKey': { $in: serviceKeys } },
            { 'cityServiceAvailability.services.serviceKey': { $in: serviceKeys } },
            { 'cityServiceAvailability.areas.services.serviceKey': { $in: serviceKeys } },
        ],
    };
    const [bookings, technicianCapabilities, markets, promotions, waitlists] = await Promise.all([
        booking_model_1.default.countDocuments({
            $or: [
                { serviceKey: { $in: serviceKeys } },
                { 'metadata.serviceKey': { $in: serviceKeys } },
                { 'metadata.subcategoryKey': { $in: serviceKeys } },
            ],
        }),
        technician_capability_model_1.default.countDocuments({
            $or: [
                { categorySlug: { $in: serviceKeys } },
                { approvedSpecialties: { $in: serviceKeys } },
            ],
        }),
        market_setting_model_1.default.countDocuments(marketServiceQuery),
        promotion_model_1.default.countDocuments({
            $or: [
                { serviceKeys: { $in: serviceKeys } },
                { subcategoryKeys: { $in: serviceKeys } },
            ],
        }),
        service_waitlist_model_1.default.countDocuments({ serviceKey: { $in: serviceKeys } }),
    ]);
    return { bookings, technicianCapabilities, markets, promotions, waitlists };
};
const normalizePromotionPatchPayload = (body) => {
    const updates = {};
    if (body.name !== undefined)
        updates.name = String(body.name || '').trim();
    if (body.description !== undefined)
        updates.description = String(body.description || '').trim();
    if (body.customerTitle !== undefined || body.internalNotes !== undefined || body.partnerReference !== undefined) {
        updates.metadata = normalizePromotionMetadata(body);
    }
    if (body.status !== undefined) {
        updates.status = Object.values(promotion_model_1.PromotionStatus).includes(body.status)
            ? body.status
            : promotion_model_1.PromotionStatus.ACTIVE;
    }
    if (body.triggerType !== undefined) {
        updates.triggerType = Object.values(promotion_model_1.PromotionTriggerType).includes(body.triggerType)
            ? body.triggerType
            : promotion_model_1.PromotionTriggerType.CODE;
    }
    if (body.discountType !== undefined) {
        updates.discountType = Object.values(promotion_model_1.PromotionDiscountType).includes(body.discountType)
            ? body.discountType
            : promotion_model_1.PromotionDiscountType.PERCENTAGE;
    }
    if (body.discountValue !== undefined) {
        const discountValue = Number(body.discountValue);
        if (!Number.isFinite(discountValue) || discountValue <= 0) {
            throw new Error('Discount value must be greater than zero.');
        }
        if (updates.discountType === promotion_model_1.PromotionDiscountType.PERCENTAGE && discountValue > 100) {
            throw new Error('Percentage discounts cannot exceed 100%.');
        }
        updates.discountValue = discountValue;
    }
    if (body.maxDiscountMinor !== undefined)
        updates.maxDiscountMinor = Number.isFinite(Number(body.maxDiscountMinor)) ? Number(body.maxDiscountMinor) : null;
    if (body.minBookingAmountMinor !== undefined)
        updates.minBookingAmountMinor = Number.isFinite(Number(body.minBookingAmountMinor)) ? Number(body.minBookingAmountMinor) : 0;
    if (body.countryCode !== undefined) {
        const countryCode = String(body.countryCode || '').trim().toUpperCase();
        updates.countryCode = countryCode ? (0, market_config_1.normalizeIsoCountryCode)(countryCode) : null;
    }
    if (body.currency !== undefined) {
        const currency = String(body.currency || '').trim().toUpperCase();
        updates.currency = currency ? (0, market_config_1.normalizeIsoCurrencyCode)(currency) : null;
    }
    if (body.serviceKeys !== undefined)
        updates.serviceKeys = normalizePromotionKeys(body.serviceKeys);
    if (body.cityKeys !== undefined)
        updates.cityKeys = normalizePromotionKeys(body.cityKeys);
    if (body.areaKeys !== undefined)
        updates.areaKeys = normalizePromotionKeys(body.areaKeys);
    if (body.subcategoryKeys !== undefined)
        updates.subcategoryKeys = normalizePromotionKeys(body.subcategoryKeys);
    if (body.eligibleClientIds !== undefined)
        updates.eligibleClientIds = normalizeObjectIds(body.eligibleClientIds);
    if (body.excludedClientIds !== undefined)
        updates.excludedClientIds = normalizeObjectIds(body.excludedClientIds);
    if (body.firstBookingOnly !== undefined)
        updates.firstBookingOnly = body.firstBookingOnly === true;
    if (body.priority !== undefined)
        updates.priority = Number.isFinite(Number(body.priority)) ? Math.max(0, Math.round(Number(body.priority))) : 100;
    if (body.stackingPolicy !== undefined) {
        updates.stackingPolicy = Object.values(promotion_model_1.PromotionStackingPolicy).includes(body.stackingPolicy)
            ? body.stackingPolicy
            : promotion_model_1.PromotionStackingPolicy.EXCLUSIVE;
    }
    if (body.fundingSource !== undefined || body.fundingSplitBps !== undefined || body.platformFundingBps !== undefined || body.technicianFundingBps !== undefined || body.partnerFundingBps !== undefined) {
        const fundingSource = normalizeFundingSource(body.fundingSource);
        updates.fundingSource = fundingSource;
        updates.fundingSplitBps = normalizeFundingSplit(body, fundingSource);
    }
    if (body.budgetMinor !== undefined)
        updates.budgetMinor = Number.isFinite(Number(body.budgetMinor)) ? Number(body.budgetMinor) : null;
    if (body.startsAt !== undefined)
        updates.startsAt = optionalDate(body.startsAt);
    if (body.expiresAt !== undefined)
        updates.expiresAt = optionalDate(body.expiresAt);
    if (body.usageLimit !== undefined)
        updates.usageLimit = Number.isFinite(Number(body.usageLimit)) ? Number(body.usageLimit) : null;
    if (body.perClientLimit !== undefined)
        updates.perClientLimit = Number.isFinite(Number(body.perClientLimit)) ? Number(body.perClientLimit) : null;
    return updates;
};
const assertPromotionCanActivate = async (payload) => {
    if (payload.status !== promotion_model_1.PromotionStatus.ACTIVE)
        return;
    const countryCode = typeof payload.countryCode === 'string' ? payload.countryCode.trim().toUpperCase() : '';
    const filter = countryCode
        ? { 'identity.countryCode': countryCode, 'identity.status': market_setting_model_1.MarketStatus.ACTIVE }
        : { 'identity.status': market_setting_model_1.MarketStatus.ACTIVE };
    const hasActiveMarket = await market_setting_model_1.default.exists(filter);
    if (!hasActiveMarket) {
        throw new Error(countryCode
            ? 'Promotion cannot be activated because the selected market is not active.'
            : 'Promotion cannot be activated until at least one market is active. Save it as DRAFT first.');
    }
};
const PROMOTION_MATERIAL_FIELDS = new Set([
    'code',
    'triggerType',
    'discountType',
    'discountValue',
    'maxDiscountMinor',
    'minBookingAmountMinor',
    'countryCode',
    'currency',
    'cityKeys',
    'areaKeys',
    'serviceKeys',
    'subcategoryKeys',
    'eligibleClientIds',
    'excludedClientIds',
    'firstBookingOnly',
    'priority',
    'stackingPolicy',
    'fundingSource',
    'fundingSplitBps',
    'budgetMinor',
    'startsAt',
    'expiresAt',
    'usageLimit',
    'perClientLimit',
]);
const promotionMaterialFieldsChanged = (updates) => Object.keys(updates).filter((key) => PROMOTION_MATERIAL_FIELDS.has(key));
exports.promotionMaterialFieldsChanged = promotionMaterialFieldsChanged;
const hasPromotionActivity = (promotion) => Number(promotion.reservationCount || 0) > 0 ||
    Number(promotion.redemptionCount || 0) > 0 ||
    Boolean(promotion.metadata?.reservationIds && Object.keys(promotion.metadata.reservationIds).length);
const promotionStatusForDisplay = (promotion, now = new Date()) => {
    if (promotion.status === promotion_model_1.PromotionStatus.ARCHIVED)
        return promotion_model_1.PromotionStatus.ARCHIVED;
    if (promotion.status === promotion_model_1.PromotionStatus.PAUSED)
        return promotion_model_1.PromotionStatus.PAUSED;
    if (promotion.status === promotion_model_1.PromotionStatus.DRAFT)
        return promotion_model_1.PromotionStatus.DRAFT;
    if (promotion.status === promotion_model_1.PromotionStatus.ENDED)
        return promotion_model_1.PromotionStatus.ENDED;
    if (promotion.expiresAt && new Date(promotion.expiresAt) < now)
        return promotion_model_1.PromotionStatus.EXPIRED;
    if (promotion.startsAt && new Date(promotion.startsAt) > now)
        return 'SCHEDULED';
    if (promotion.budgetMinor !== null && promotion.budgetMinor !== undefined && Number(promotion.redeemedBudgetMinor || 0) >= Number(promotion.budgetMinor))
        return 'EXHAUSTED';
    if (promotion.usageLimit !== null && promotion.usageLimit !== undefined && Number(promotion.usageCount || 0) >= Number(promotion.usageLimit))
        return 'EXHAUSTED';
    return promotion.status || promotion_model_1.PromotionStatus.DRAFT;
};
const buildPromotionAnalyticsSummary = (promotions, revenueMinor = 0) => {
    const now = new Date();
    return {
        activePromotions: promotions.filter((promotion) => promotionStatusForDisplay(promotion, now) === promotion_model_1.PromotionStatus.ACTIVE).length,
        scheduledPromotions: promotions.filter((promotion) => promotionStatusForDisplay(promotion, now) === 'SCHEDULED').length,
        totalRedemptions: promotions.reduce((sum, promotion) => sum + Number(promotion.redemptionCount || 0), 0),
        totalDiscountGrantedMinor: promotions.reduce((sum, promotion) => sum + Number(promotion.redeemedBudgetMinor || 0), 0),
        revenueInfluencedMinor: revenueMinor,
        remainingCampaignBudgetMinor: promotions.reduce((sum, promotion) => {
            if (promotion.budgetMinor === null || promotion.budgetMinor === undefined)
                return sum;
            return sum + Math.max(0, Number(promotion.budgetMinor || 0) - Number(promotion.redeemedBudgetMinor || 0) - Number(promotion.reservedBudgetMinor || 0));
        }, 0),
        reservedPromotions: promotions.reduce((sum, promotion) => sum + Number(promotion.reservationCount || 0), 0),
        expiredPromotions: promotions.filter((promotion) => promotionStatusForDisplay(promotion, now) === promotion_model_1.PromotionStatus.EXPIRED).length,
    };
};
exports.buildPromotionAnalyticsSummary = buildPromotionAnalyticsSummary;
const promotionDefinitions = {
    totalRedemptions: 'Successfully redeemed promotion reservations.',
    totalDiscountGranted: 'Sum of redeemed promotion discounts from campaign counters.',
    revenueInfluenced: 'Sum of successfully paid invoice totals that contain a promotion snapshot.',
    remainingBudget: 'Configured campaign budget minus redeemed and active reserved amounts.',
    releasedReservations: 'Promotion reservations released before redemption.',
    reversals: 'Redeemed promotions reversed after payment/refund or cancellation handling.',
};
const extractPromotionSnapshots = (metadata, promotionId) => {
    const candidates = [
        ...(Array.isArray(metadata?.promotions) ? metadata.promotions : []),
        ...(Array.isArray(metadata?.promotionSnapshots) ? metadata.promotionSnapshots : []),
        metadata?.promotion,
    ].filter(Boolean);
    return candidates.filter((snapshot) => String(snapshot.promotionId || snapshot.id || '') === promotionId);
};
const sumInvoiceRevenueForPromotion = async (promotionId) => {
    const match = {
        status: 'PAID',
        $or: [
            { 'metadata.promotions.0': { $exists: true } },
            { 'metadata.promotion.promotionId': { $exists: true } },
        ],
    };
    const invoices = await billing_model_1.Invoice.find(match).select('totalAmountMinor metadata').limit(1000).lean();
    return invoices.reduce((sum, invoice) => {
        if (promotionId && !extractPromotionSnapshots(invoice.metadata, promotionId).length)
            return sum;
        return sum + Number(invoice.totalAmountMinor || 0);
    }, 0);
};
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
const serviceStatusScopeKey = (scope, serviceKey) => `${scope}:${serviceKey}`;
const collectServiceStatuses = (args) => {
    const statuses = new Map();
    (0, service_availability_service_1.normalizeServiceEntries)(args.serviceCategories).forEach((service) => {
        statuses.set(serviceStatusScopeKey('country', service.serviceKey), service.status);
    });
    safeJsonArray(args.cityServiceAvailability)
        .map((row) => (0, service_availability_service_1.buildCityAvailability)(row, args.serviceCategories))
        .filter((row) => Boolean(row))
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
const getServiceActivations = (nextStatuses, previousStatuses) => Array.from(nextStatuses.entries())
    .filter(([key, status]) => status === market_setting_model_1.MarketStatus.ACTIVE && previousStatuses.get(key) !== market_setting_model_1.MarketStatus.ACTIVE)
    .map(([key]) => key);
const canActivateMarketServices = (admin) => Boolean(admin?.role === user_model_1.UserRole.ADMIN &&
    ((admin.adminRole || user_model_1.AdminRole.SUPER_ADMIN) === user_model_1.AdminRole.SUPER_ADMIN ||
        (Array.isArray(admin.adminPermissions) && admin.adminPermissions.includes(user_model_1.AdminPermission.MARKETS_SERVICES_ACTIVATE))));
const adminHasPermission = (admin, permission) => {
    if (!admin || admin.role !== user_model_1.UserRole.ADMIN)
        return false;
    const adminRole = Object.values(user_model_1.AdminRole).includes(admin.adminRole)
        ? admin.adminRole
        : user_model_1.AdminRole.READ_ONLY_ADMIN;
    const allowed = new Set([
        ...(ADMIN_ROLE_PERMISSIONS[adminRole] || []),
        ...(Array.isArray(admin.adminPermissions) ? admin.adminPermissions : []),
    ]);
    return allowed.has(permission);
};
const maskEmail = (email) => {
    const value = String(email || '').trim();
    const [local, domain] = value.split('@');
    if (!local || !domain)
        return value ? 'hidden' : '';
    const visible = local.slice(0, Math.min(2, local.length));
    return `${visible}${'*'.repeat(Math.max(3, local.length - visible.length))}@${domain}`;
};
const maskPhone = (phone) => {
    const value = String(phone || '').trim();
    if (!value)
        return '';
    const digits = value.replace(/\D/g, '');
    const last = digits.slice(-4);
    return last ? `*** *** ${last}` : 'hidden';
};
const mergeMarketSetting = (setting) => {
    const identity = setting.identity || {};
    const pricing = setting.pricing || {};
    const coverage = setting.coverage || {};
    const payments = setting.payments || {};
    const support = setting.support || {};
    const countryCode = identity.countryCode || setting.countryCode;
    const status = identity.status || setting.status;
    const paymentProviders = payments.paymentProviders || setting.paymentProviders || [];
    const providerSettings = payments.providerSettings || setting.paymentProviderSettings || [];
    const baseMarket = market_config_1.MARKET_CONFIG[countryCode];
    const normalizedServiceCategories = (0, service_availability_service_1.normalizeServiceEntries)(coverage.serviceCategories ?? setting.serviceCategories ?? []);
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
        timezone: identity.timezone || setting.timezone || '',
        status,
        defaultCalloutFee: typeof pricing.defaultCalloutFeeMinor === 'number'
            ? pricing.defaultCalloutFeeMinor / 100
            : pricing.defaultCalloutFee ?? setting.defaultCalloutFee ?? baseMarket?.defaultCalloutFee ?? 0,
        marketCalloutFeeMinor: pricing.marketCalloutFeeMinor ?? pricing.defaultCalloutFeeMinor,
        platformCommissionBps: pricing.platformCommissionBps ?? setting.platformCommissionBps ?? baseMarket?.platformCommissionBps ?? 1500,
        taxLabel: pricing.taxLabel || setting.taxLabel || baseMarket?.taxLabel || 'VAT',
        taxRateBps: pricing.taxRateBps ?? 0,
        taxInclusive: pricing.taxInclusive === true,
        clientServiceFeeType: pricing.clientServiceFeeType || 'NONE',
        clientServiceFeeBps: pricing.clientServiceFeeBps ?? 0,
        clientServiceFeeMinor: pricing.clientServiceFeeMinor ?? 0,
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
        locale: market.locale,
        timezone: '',
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
        const [totalBookings, activeBookings, pendingBookings, completedBookings, totalTechnicians, pendingTechnicians, approvedTechnicians, pendingQuotes, approvedQuotes, unpaidInvoices, walletLedgerRows, clients,] = await Promise.all([
            booking_model_1.default.countDocuments(),
            booking_model_1.default.countDocuments({
                status: {
                    $in: [
                        booking_model_1.BookingStatus.PENDING,
                        booking_model_1.BookingStatus.ACCEPTED,
                        booking_model_1.BookingStatus.IN_ROUTE,
                        booking_model_1.BookingStatus.ARRIVED,
                        booking_model_1.BookingStatus.IN_PROGRESS,
                        booking_model_1.BookingStatus.DIAGNOSTIC_DONE,
                    ],
                },
            }),
            booking_model_1.default.countDocuments({ status: booking_model_1.BookingStatus.PENDING }),
            booking_model_1.default.countDocuments({ status: booking_model_1.BookingStatus.COMPLETED }),
            technician_model_1.default.countDocuments(),
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
                totalTechnicians,
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
const getAdminClients = async (req, res) => {
    try {
        const limit = parseLimit(req.query.limit, 100);
        const clients = await user_model_1.default.find({ role: user_model_1.UserRole.CUSTOMER })
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
    }
    catch (error) {
        console.error('Failed to load admin clients:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch clients.' });
    }
};
exports.getAdminClients = getAdminClients;
const revealAdminClientContact = async (req, res) => {
    const { id } = req.params;
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        res.status(400).json({ message: 'Invalid client id.' });
        return;
    }
    try {
        const admin = await getRequesterAdmin(req);
        if (!adminHasPermission(admin, user_model_1.AdminPermission.CLIENTS_CONTACT_READ)) {
            res.status(403).json({ message: 'You do not have permission to view client contact details.' });
            return;
        }
        const client = await user_model_1.default.findOne({ _id: id, role: user_model_1.UserRole.CUSTOMER })
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
    }
    catch (error) {
        console.error('Failed to reveal client contact:', error);
        res.status(500).json({ success: false, message: 'Failed to reveal client contact.' });
    }
};
exports.revealAdminClientContact = revealAdminClientContact;
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
        const [customer, technicianUser, technicianProfile] = await Promise.all([
            booking.customerId && mongoose_1.default.Types.ObjectId.isValid(booking.customerId)
                ? user_model_1.default.findById(booking.customerId).select('name email phone profilePhotoUrl').lean()
                : null,
            booking.technicianId && mongoose_1.default.Types.ObjectId.isValid(booking.technicianId)
                ? user_model_1.default.findById(booking.technicianId).select('name email phone profilePhotoUrl').lean()
                : null,
            booking.technicianId && mongoose_1.default.Types.ObjectId.isValid(booking.technicianId)
                ? technician_model_1.default.findOne({ userId: booking.technicianId }).select('documents.profilePhotoUrl documents.profilePhotoStatus approvalStatus').lean()
                : null,
        ]);
        const approvedTechnicianPhotoUrl = technicianProfile?.documents?.profilePhotoStatus === technician_model_1.VerificationStatus.VERIFIED
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
        const serviceDefinitions = await getServiceDefinitions();
        res.status(200).json({
            success: true,
            markets: await getConfiguredMarkets(),
            availableMarkets: await getAvailableMarketOptions(),
            availableStatuses: Object.values(market_setting_model_1.MarketStatus),
            availablePaymentProviders: ['PAYSTACK', 'FLUTTERWAVE', 'MPESA', 'MTN_MOMO', 'AIRTEL_MONEY', 'YOCO', 'OZOW'],
            defaultServiceCategories: serviceDefinitions,
            serviceDefinitions,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to load markets.' });
    }
};
exports.getAdminMarkets = getAdminMarkets;
const getAdminServices = async (_req, res) => {
    try {
        res.status(200).json({
            success: true,
            services: await getServiceDefinitions(),
            statuses: Object.values(service_catalog_model_1.ServicePublicationStatus),
            assignmentStatuses: Object.values(market_setting_model_1.MarketStatus),
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to load services.' });
    }
};
exports.getAdminServices = getAdminServices;
const uploadAdminServiceImage = async (req, res) => {
    try {
        const { dataUri, mimeType, sizeBytes } = parseServiceImageDataUri(req.body?.dataUri);
        const serviceKey = (0, service_availability_service_1.normalizeServiceKey)(req.body?.serviceKey || req.body?.label || 'service-image') || 'service-image';
        const publicId = `${serviceKey}-${Date.now()}-${crypto_1.default.randomInt(100000)}`;
        const uploaded = await (0, media_storage_service_1.uploadImageToCloudinary)({
            dataUri,
            folder: 'myfixer/service-catalog',
            publicId,
        });
        await logAdminAction(req, 'service.image_upload', 'ServiceCatalogImage', uploaded.storageKey, {
            serviceKey,
            mimeType,
            sizeBytes,
            fileName: String(req.body?.fileName || '').trim().slice(0, 180),
        });
        res.status(201).json({
            success: true,
            image: {
                imageKey: uploaded.storageKey,
                imageUrl: uploaded.url,
                thumbnailUrl: uploaded.thumbnailUrl,
                mimeType,
                fileSize: uploaded.fileSize || sizeBytes,
            },
        });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message || 'Unable to upload service image.' });
    }
};
exports.uploadAdminServiceImage = uploadAdminServiceImage;
const createAdminService = async (req, res) => {
    try {
        const body = req.body || {};
        const actor = getActor(req);
        const serviceKey = (0, service_availability_service_1.normalizeServiceKey)(body.serviceKey ?? body.key ?? body.label);
        const label = String(body.label || '').trim();
        const groupKey = (0, service_availability_service_1.normalizeServiceKey)(body.groupKey ?? 'home_services') || 'home_services';
        if (!serviceKey || !label) {
            res.status(400).json({ message: 'Service key and label are required.' });
            return;
        }
        const existing = await service_catalog_model_1.default.findOne({ serviceKey });
        if (existing) {
            res.status(409).json({ message: 'A service with this key already exists.' });
            return;
        }
        const duplicateLabel = await service_catalog_model_1.default.findOne({
            groupKey,
            serviceKey: { $ne: serviceKey },
            label: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
        }).lean();
        if (duplicateLabel) {
            res.status(409).json({ message: 'A service category with this name already exists in this group.' });
            return;
        }
        const service = await service_catalog_model_1.default.create({
            serviceKey,
            categoryKey: (0, service_availability_service_1.normalizeServiceKey)(body.categoryKey ?? serviceKey) || serviceKey,
            groupKey,
            groupLabel: String(body.groupLabel || 'Home Services').trim(),
            groupDescription: String(body.groupDescription || '').trim().slice(0, 1200),
            groupImageKey: (0, service_availability_service_1.normalizeServiceKey)(body.groupImageKey || ''),
            groupImageUrl: normalizeHttpsImageUrl(body.groupImageUrl),
            groupIconKey: (0, service_availability_service_1.normalizeServiceKey)(body.groupIconKey || ''),
            groupStatus: normalizeServiceStatus(body.groupStatus ?? service_catalog_model_1.ServicePublicationStatus.PUBLISHED),
            groupDisplayOrder: Number.isFinite(Number(body.groupDisplayOrder)) ? Math.max(0, Number(body.groupDisplayOrder)) : 0,
            label,
            description: String(body.description || '').trim().slice(0, 1200),
            internalNotes: String(body.internalNotes || '').trim().slice(0, 2000),
            imageKey: (0, service_availability_service_1.normalizeServiceKey)(body.imageKey || serviceKey || 'maintenance'),
            imageUrl: normalizeHttpsImageUrl(body.imageUrl),
            iconKey: (0, service_availability_service_1.normalizeServiceKey)(body.iconKey || ''),
            searchKeywords: normalizeStringList(body.searchKeywords),
            synonyms: normalizeStringList(body.synonyms),
            status: service_catalog_model_1.ServicePublicationStatus.DRAFT,
            displayOrder: Number.isFinite(Number(body.displayOrder)) ? Math.max(0, Number(body.displayOrder)) : 0,
            defaultCalloutFeeMinor: minorFromInput(body.defaultCalloutFeeMinor, body.defaultCalloutFee),
            minimumChargeMinor: minorFromInput(body.minimumChargeMinor, body.minimumCharge),
            fixedPriceSupported: body.fixedPriceSupported === true,
            requiresCapabilityApproval: body.requiresCapabilityApproval === undefined ? true : body.requiresCapabilityApproval === true,
            capabilityRequirements: normalizeCapabilityRequirements(body.capabilityRequirements),
            subcategories: normalizeServiceSubcategories(body.subcategories),
            audit: {
                updatedBy: actor?.id,
                changeHistory: [{ changedBy: actor?.id, changedAt: new Date(), action: 'service.create', after: { serviceKey } }],
            },
        });
        await logAdminAction(req, 'service.create', 'ServiceCatalog', service.serviceKey, { serviceKey });
        res.status(201).json({ success: true, service: serializeServiceCatalog(service) });
    }
    catch (error) {
        console.error('Service create failed:', error);
        res.status(500).json({ success: false, message: 'Failed to create service.' });
    }
};
exports.createAdminService = createAdminService;
const updateAdminServiceGroup = async (req, res) => {
    try {
        const groupKey = (0, service_availability_service_1.normalizeServiceKey)(req.params.groupKey);
        const groupLabel = String(req.body?.groupLabel || req.body?.label || '').trim().replace(/\s+/g, ' ');
        const actor = getActor(req);
        if (!groupKey) {
            res.status(400).json({ message: 'Group key is required.' });
            return;
        }
        if (!groupLabel) {
            res.status(400).json({ message: 'Group name is required.' });
            return;
        }
        const groupCandidates = await service_catalog_model_1.default.find({ $or: [{ groupKey }, { serviceKey: groupKey }] });
        const groupServices = groupCandidates.filter((service) => serviceBelongsToAdminGroup(service, groupKey));
        if (!groupServices.length) {
            res.status(404).json({ message: 'Top-level group is not persisted yet and cannot be renamed.' });
            return;
        }
        const duplicate = await service_catalog_model_1.default.findOne({
            groupKey: { $ne: groupKey },
            groupLabel: new RegExp(`^${groupLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
        }).lean();
        if (duplicate) {
            res.status(409).json({ message: 'A top-level group with this name already exists.' });
            return;
        }
        await Promise.all(groupServices.map((service) => service_catalog_model_1.default.updateOne({ _id: service._id }, {
            $set: {
                groupKey,
                groupLabel,
                groupStatus: service.groupStatus || service.status || service_catalog_model_1.ServicePublicationStatus.DRAFT,
                ...(service.serviceKey === groupKey ? { label: groupLabel } : {}),
                'audit.updatedBy': actor?.id,
            },
            $push: {
                'audit.changeHistory': {
                    changedBy: actor?.id,
                    changedAt: new Date(),
                    action: 'service_group.rename',
                    before: { groupLabel: service.groupLabel },
                    after: { groupLabel },
                },
            },
        }, { runValidators: true })));
        await logAdminAction(req, 'service_group.rename', 'ServiceCatalogGroup', groupKey, { groupKey, groupLabel });
        res.status(200).json({ success: true, group: { groupKey, label: groupLabel } });
    }
    catch (error) {
        console.error('Service group rename failed:', error);
        res.status(500).json({ success: false, message: 'Failed to rename top-level group.' });
    }
};
exports.updateAdminServiceGroup = updateAdminServiceGroup;
const deleteAdminServiceGroup = async (req, res) => {
    try {
        const groupKey = (0, service_availability_service_1.normalizeServiceKey)(req.params.groupKey);
        const actor = getActor(req);
        if (!groupKey) {
            res.status(400).json({ message: 'Group key is required.' });
            return;
        }
        const groupCandidates = await service_catalog_model_1.default.find({ $or: [{ groupKey }, { serviceKey: groupKey }] }).lean();
        const groupServices = groupCandidates.filter((service) => serviceBelongsToAdminGroup(service, groupKey));
        if (!groupServices.length) {
            res.status(404).json({ message: 'This top-level group is not persisted yet and cannot be deleted.' });
            return;
        }
        const groupLabel = String(groupServices[0]?.groupLabel || groupServices[0]?.label || groupKey).trim();
        const categoryCount = groupServices.filter((service) => service.serviceKey !== groupKey).length;
        const bookableCount = groupServices.reduce((total, service) => total + (service.subcategories || []).length, 0);
        const serviceKeys = Array.from(new Set([
            groupKey,
            ...groupServices.map((service) => (0, service_availability_service_1.normalizeServiceKey)(service.serviceKey)).filter(Boolean),
            ...groupServices.flatMap((service) => (service.subcategories || []).map((subcategory) => (0, service_availability_service_1.normalizeServiceKey)(subcategory.serviceKey || subcategory.subcategoryKey)).filter(Boolean)),
        ]));
        const dependencies = await countGroupDeleteDependencies(groupKey, serviceKeys);
        const dependencyReasons = [
            categoryCount ? `${categoryCount} Service ${categoryCount === 1 ? 'Category' : 'Categories'}` : '',
            bookableCount ? `${bookableCount} Bookable ${bookableCount === 1 ? 'Service' : 'Services'}` : '',
            dependencies.bookings ? `${dependencies.bookings} booking ${dependencies.bookings === 1 ? 'reference' : 'references'}` : '',
            dependencies.technicianCapabilities ? `${dependencies.technicianCapabilities} technician capability ${dependencies.technicianCapabilities === 1 ? 'reference' : 'references'}` : '',
            dependencies.markets ? `${dependencies.markets} market ${dependencies.markets === 1 ? 'reference' : 'references'}` : '',
            dependencies.promotions ? `${dependencies.promotions} promotion ${dependencies.promotions === 1 ? 'reference' : 'references'}` : '',
            dependencies.waitlists ? `${dependencies.waitlists} waitlist ${dependencies.waitlists === 1 ? 'reference' : 'references'}` : '',
        ].filter(Boolean);
        const anchor = groupServices.find((service) => service.serviceKey === groupKey);
        const anchorIsDraft = anchor?.status === service_catalog_model_1.ServicePublicationStatus.DRAFT;
        const singleAnchorOnly = groupServices.length === 1 && Boolean(anchor);
        if (!singleAnchorOnly || !anchorIsDraft || dependencyReasons.length) {
            await logAdminAction(req, 'service_group.delete_rejected', 'ServiceCatalogGroup', groupKey, {
                groupKey,
                reasons: dependencyReasons,
                singleAnchorOnly,
                anchorIsDraft,
            }, false);
            res.status(409).json({
                success: false,
                message: dependencyReasons.length
                    ? groupBlockedMessage(groupLabel, dependencyReasons)
                    : `${groupLabel} cannot be deleted because it is not an empty unused draft group.`,
                dependencies: {
                    serviceCategories: categoryCount,
                    bookableServices: bookableCount,
                    ...dependencies,
                },
            });
            return;
        }
        await service_catalog_model_1.default.deleteOne({ _id: anchor._id, serviceKey: groupKey, status: service_catalog_model_1.ServicePublicationStatus.DRAFT });
        await logAdminAction(req, 'service_group.delete', 'ServiceCatalogGroup', groupKey, { groupKey, groupLabel });
        res.status(200).json({ success: true, message: `${groupLabel} was deleted.` });
    }
    catch (error) {
        console.error('Service group delete failed:', error);
        res.status(500).json({ success: false, message: 'Failed to delete top-level group.' });
    }
};
exports.deleteAdminServiceGroup = deleteAdminServiceGroup;
const deleteAdminServiceCategory = async (req, res) => {
    try {
        const serviceKey = (0, service_availability_service_1.normalizeServiceKey)(req.params.serviceKey);
        if (!serviceKey) {
            res.status(400).json({ message: 'Service category key is required.' });
            return;
        }
        const service = await service_catalog_model_1.default.findOne({ serviceKey }).lean();
        if (!service) {
            res.status(404).json({ message: 'Service category not found.' });
            return;
        }
        const label = String(service.label || serviceKey).trim();
        const bookableServices = (service.subcategories || []).length;
        const serviceKeys = Array.from(new Set([
            serviceKey,
            ...(service.subcategories || []).map((subcategory) => (0, service_availability_service_1.normalizeServiceKey)(subcategory.serviceKey || subcategory.subcategoryKey)).filter(Boolean),
        ]));
        const dependencies = await countServiceDeleteDependencies(serviceKeys);
        const dependencyReasons = [
            bookableServices ? `${bookableServices} Bookable ${bookableServices === 1 ? 'Service' : 'Services'}` : '',
            dependencies.bookings ? `${dependencies.bookings} booking ${dependencies.bookings === 1 ? 'reference' : 'references'}` : '',
            dependencies.technicianCapabilities ? `${dependencies.technicianCapabilities} technician capability ${dependencies.technicianCapabilities === 1 ? 'reference' : 'references'}` : '',
            dependencies.markets ? `${dependencies.markets} market ${dependencies.markets === 1 ? 'reference' : 'references'}` : '',
            dependencies.promotions ? `${dependencies.promotions} promotion ${dependencies.promotions === 1 ? 'reference' : 'references'}` : '',
            dependencies.waitlists ? `${dependencies.waitlists} waitlist ${dependencies.waitlists === 1 ? 'reference' : 'references'}` : '',
        ].filter(Boolean);
        const isGroupAnchor = service.serviceKey === service.groupKey;
        if (isGroupAnchor || dependencyReasons.length) {
            await logAdminAction(req, 'service_category.delete_rejected', 'ServiceCatalog', serviceKey, {
                serviceKey,
                groupKey: service.groupKey,
                isGroupAnchor,
                reasons: dependencyReasons,
            }, false);
            res.status(409).json({
                success: false,
                message: dependencyReasons.length
                    ? `${label} cannot be deleted because it contains or is referenced by ${dependencyReasons.join(', ')}. Delete or archive child items first.`
                    : `${label} cannot be deleted because it is a top-level group anchor, not a Service Category.`,
                dependencies: {
                    bookableServices,
                    ...dependencies,
                },
            });
            return;
        }
        await service_catalog_model_1.default.deleteOne({ _id: service._id, serviceKey });
        await logAdminAction(req, 'service_category.delete', 'ServiceCatalog', serviceKey, {
            serviceKey,
            groupKey: service.groupKey,
            label,
        });
        res.status(200).json({ success: true, message: `${label} was deleted.` });
    }
    catch (error) {
        console.error('Service category delete failed:', error);
        res.status(500).json({ success: false, message: 'Failed to delete service category.' });
    }
};
exports.deleteAdminServiceCategory = deleteAdminServiceCategory;
const deleteAdminBookableService = async (req, res) => {
    try {
        const serviceKey = (0, service_availability_service_1.normalizeServiceKey)(req.params.serviceKey);
        const bookableServiceKey = (0, service_availability_service_1.normalizeServiceKey)(req.params.bookableServiceKey);
        const actor = getActor(req);
        if (!serviceKey || !bookableServiceKey) {
            res.status(400).json({ message: 'Service category and bookable service keys are required.' });
            return;
        }
        const service = await service_catalog_model_1.default.findOne({ serviceKey });
        if (!service) {
            res.status(404).json({ message: 'Service category not found.' });
            return;
        }
        const subcategories = Array.isArray(service.subcategories) ? service.subcategories : [];
        const bookableService = subcategories.find((item) => (0, service_availability_service_1.normalizeServiceKey)(item.serviceKey || item.subcategoryKey) === bookableServiceKey);
        if (!bookableService) {
            res.status(404).json({ message: 'Bookable service not found.' });
            return;
        }
        const label = String(bookableService.label || bookableServiceKey).trim();
        const serviceKeys = Array.from(new Set([
            (0, service_availability_service_1.normalizeServiceKey)(bookableService.serviceKey),
            (0, service_availability_service_1.normalizeServiceKey)(bookableService.subcategoryKey),
            bookableServiceKey,
        ].filter(Boolean)));
        const dependencies = await countServiceDeleteDependencies(serviceKeys);
        const dependencyReasons = [
            dependencies.bookings ? `${dependencies.bookings} booking ${dependencies.bookings === 1 ? 'reference' : 'references'}` : '',
            dependencies.technicianCapabilities ? `${dependencies.technicianCapabilities} technician capability ${dependencies.technicianCapabilities === 1 ? 'reference' : 'references'}` : '',
            dependencies.markets ? `${dependencies.markets} market ${dependencies.markets === 1 ? 'reference' : 'references'}` : '',
            dependencies.promotions ? `${dependencies.promotions} promotion ${dependencies.promotions === 1 ? 'reference' : 'references'}` : '',
            dependencies.waitlists ? `${dependencies.waitlists} waitlist ${dependencies.waitlists === 1 ? 'reference' : 'references'}` : '',
        ].filter(Boolean);
        if (dependencyReasons.length) {
            await logAdminAction(req, 'service_bookable.delete_rejected', 'ServiceCatalogBookableService', bookableServiceKey, {
                serviceKey,
                bookableServiceKey,
                reasons: dependencyReasons,
            }, false);
            res.status(409).json({
                success: false,
                message: `${label} cannot be deleted because it is referenced by ${dependencyReasons.join(', ')}.`,
                dependencies,
            });
            return;
        }
        service.subcategories = subcategories.filter((item) => (0, service_availability_service_1.normalizeServiceKey)(item.serviceKey || item.subcategoryKey) !== bookableServiceKey);
        service.audit = {
            ...(service.audit || {}),
            updatedBy: actor?.id,
            changeHistory: [
                ...(service.audit?.changeHistory || []),
                {
                    changedBy: actor?.id,
                    changedAt: new Date(),
                    action: 'service_bookable.delete',
                    before: { serviceKey: bookableServiceKey, label },
                },
            ],
        };
        await service.save();
        await logAdminAction(req, 'service_bookable.delete', 'ServiceCatalogBookableService', bookableServiceKey, {
            serviceKey,
            bookableServiceKey,
            label,
        });
        res.status(200).json({ success: true, message: `${label} was deleted.` });
    }
    catch (error) {
        console.error('Bookable service delete failed:', error);
        res.status(500).json({ success: false, message: 'Failed to delete bookable service.' });
    }
};
exports.deleteAdminBookableService = deleteAdminBookableService;
const updateAdminService = async (req, res) => {
    try {
        const serviceKey = (0, service_availability_service_1.normalizeServiceKey)(req.params.serviceKey);
        const existing = await service_catalog_model_1.default.findOne({ serviceKey });
        if (!existing) {
            res.status(404).json({ message: 'Service not found.' });
            return;
        }
        const body = req.body || {};
        const actor = getActor(req);
        const status = normalizeServiceStatus(body.status ?? existing.status);
        const requestedBodyKey = body.serviceKey === undefined && body.key === undefined
            ? ''
            : (0, service_availability_service_1.normalizeServiceKey)(body.serviceKey ?? body.key);
        if (requestedBodyKey && requestedBodyKey !== serviceKey) {
            res.status(400).json({ message: 'Service keys are stable and cannot be changed after creation.' });
            return;
        }
        const statusChanging = status !== existing.status;
        const operationalStatusChange = statusChanging &&
            [service_catalog_model_1.ServicePublicationStatus.PUBLISHED, service_catalog_model_1.ServicePublicationStatus.PAUSED, service_catalog_model_1.ServicePublicationStatus.ARCHIVED].includes(status);
        const requesterAdmin = operationalStatusChange ? await getRequesterAdmin(req) : null;
        if (operationalStatusChange && !adminHasPermission(requesterAdmin, user_model_1.AdminPermission.MARKETS_SERVICES_ACTIVATE)) {
            await logAdminAction(req, 'service.status_change.denied', 'ServiceCatalog', serviceKey, {
                serviceKey,
                previousStatus: existing.status,
                requestedStatus: status,
                requiredPermission: user_model_1.AdminPermission.MARKETS_SERVICES_ACTIVATE,
            }, false);
            res.status(403).json({
                message: 'Changing service publication status requires service activation permission.',
                requiredPermission: user_model_1.AdminPermission.MARKETS_SERVICES_ACTIVATE,
            });
            return;
        }
        const nextGroupKey = (0, service_availability_service_1.normalizeServiceKey)(body.groupKey ?? existing.groupKey ?? 'home_services') || 'home_services';
        const nextLabel = String(body.label ?? existing.label).trim() || existing.label;
        const duplicateLabel = await service_catalog_model_1.default.findOne({
            serviceKey: { $ne: serviceKey },
            groupKey: nextGroupKey,
            label: new RegExp(`^${nextLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
        }).lean();
        if (duplicateLabel) {
            res.status(409).json({ message: 'A service category with this name already exists in this group.' });
            return;
        }
        const update = {
            label: nextLabel,
            categoryKey: (0, service_availability_service_1.normalizeServiceKey)(body.categoryKey ?? existing.categoryKey ?? existing.serviceKey) || existing.serviceKey,
            groupKey: nextGroupKey,
            groupLabel: String(body.groupLabel ?? existing.groupLabel ?? 'Home Services').trim() || 'Home Services',
            groupDescription: String(body.groupDescription ?? existing.groupDescription ?? '').trim().slice(0, 1200),
            groupImageKey: (0, service_availability_service_1.normalizeServiceKey)(body.groupImageKey ?? existing.groupImageKey ?? ''),
            groupImageUrl: body.groupImageUrl === undefined ? existing.groupImageUrl : normalizeHttpsImageUrl(body.groupImageUrl),
            groupIconKey: (0, service_availability_service_1.normalizeServiceKey)(body.groupIconKey ?? existing.groupIconKey ?? ''),
            groupStatus: normalizeServiceStatus(body.groupStatus ?? existing.groupStatus ?? service_catalog_model_1.ServicePublicationStatus.PUBLISHED),
            groupDisplayOrder: Number.isFinite(Number(body.groupDisplayOrder)) ? Math.max(0, Number(body.groupDisplayOrder)) : existing.groupDisplayOrder,
            description: String(body.description ?? existing.description ?? '').trim().slice(0, 1200),
            internalNotes: String(body.internalNotes ?? existing.internalNotes ?? '').trim().slice(0, 2000),
            imageKey: (0, service_availability_service_1.normalizeServiceKey)(body.imageKey ?? existing.imageKey ?? serviceKey),
            imageUrl: body.imageUrl === undefined ? existing.imageUrl : normalizeHttpsImageUrl(body.imageUrl),
            iconKey: (0, service_availability_service_1.normalizeServiceKey)(body.iconKey ?? existing.iconKey ?? ''),
            searchKeywords: body.searchKeywords === undefined ? existing.searchKeywords : normalizeStringList(body.searchKeywords),
            synonyms: body.synonyms === undefined ? existing.synonyms : normalizeStringList(body.synonyms),
            status,
            displayOrder: Number.isFinite(Number(body.displayOrder)) ? Math.max(0, Number(body.displayOrder)) : existing.displayOrder,
            defaultCalloutFeeMinor: minorFromInput(body.defaultCalloutFeeMinor, body.defaultCalloutFee) ?? existing.defaultCalloutFeeMinor,
            minimumChargeMinor: minorFromInput(body.minimumChargeMinor, body.minimumCharge) ?? existing.minimumChargeMinor,
            fixedPriceSupported: body.fixedPriceSupported === undefined ? existing.fixedPriceSupported : body.fixedPriceSupported === true,
            requiresCapabilityApproval: body.requiresCapabilityApproval === undefined ? existing.requiresCapabilityApproval : body.requiresCapabilityApproval === true,
            capabilityRequirements: body.capabilityRequirements === undefined ? existing.capabilityRequirements : normalizeCapabilityRequirements(body.capabilityRequirements),
            subcategories: body.subcategories === undefined ? existing.subcategories : normalizeServiceSubcategories(body.subcategories),
            audit: {
                updatedBy: actor?.id,
                changeHistory: [
                    ...(existing.audit?.changeHistory || []),
                    { changedBy: actor?.id, changedAt: new Date(), action: 'service.update', before: { status: existing.status }, after: { status } },
                ],
            },
        };
        const service = await service_catalog_model_1.default.findOneAndUpdate({ serviceKey }, update, { new: true, runValidators: true });
        await logAdminAction(req, 'service.update', 'ServiceCatalog', serviceKey, { serviceKey, status });
        res.status(200).json({ success: true, service: serializeServiceCatalog(service) });
    }
    catch (error) {
        console.error('Service update failed:', error);
        res.status(500).json({ success: false, message: 'Failed to update service.' });
    }
};
exports.updateAdminService = updateAdminService;
const getPublicServices = async (_req, res) => {
    try {
        res.status(200).json({ success: true, services: await getServiceDefinitions(true) });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to load service catalogue.' });
    }
};
exports.getPublicServices = getPublicServices;
const previewAdminPricing = async (req, res) => {
    try {
        const countryCode = String(req.body?.countryCode || '').trim().toUpperCase();
        const market = countryCode
            ? await market_setting_model_1.default.findOne({ 'identity.countryCode': countryCode }).lean()
            : null;
        const currency = String(req.body?.currency || market?.identity?.currency || '').trim().toUpperCase();
        if (!/^[A-Z]{3}$/.test(currency)) {
            res.status(400).json({ message: 'Valid currency is required for pricing preview.' });
            return;
        }
        const breakdown = (0, price_breakdown_service_1.calculatePriceBreakdown)({
            currency: currency,
            calloutFeeMinor: minorFromInput(req.body?.calloutFeeMinor, req.body?.calloutFee),
            labourMinor: minorFromInput(req.body?.labourMinor, req.body?.labour),
            partsMinor: minorFromInput(req.body?.partsMinor, req.body?.parts),
            additionalServicesMinor: minorFromInput(req.body?.additionalServicesMinor, req.body?.additionalServices),
            surchargeMinor: minorFromInput(req.body?.surchargeMinor, req.body?.surcharge),
            discountMinor: minorFromInput(req.body?.discountMinor, req.body?.discount),
            marketPricing: {
                ...(market?.pricing || {}),
                ...(req.body?.pricing || {}),
            },
        });
        res.status(200).json({ success: true, breakdown });
    }
    catch (error) {
        res.status(400).json({ message: error.message || 'Unable to preview pricing.' });
    }
};
exports.previewAdminPricing = previewAdminPricing;
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
        const actor = getActor(req);
        const admin = await getRequesterAdmin(req);
        const existingMarket = await market_setting_model_1.default.findOne({ 'identity.countryCode': countryCode }).lean();
        if (existingMarket?.deletionLock?.locked) {
            await logAdminAction(req, 'market.update_rejected', 'MarketSetting', countryCode, {
                countryCode,
                failureReason: 'Market is locked for permanent deletion.',
            }, false);
            res.status(423).json({ message: 'Market is temporarily locked for permanent deletion.' });
            return;
        }
        const requestedStatus = identity.status || req.body.status;
        const status = Object.values(market_setting_model_1.MarketStatus).includes(requestedStatus)
            ? requestedStatus
            : existingMarket?.identity?.status ?? market_setting_model_1.MarketStatus.DRAFT;
        const previousStatus = existingMarket?.identity?.status ?? market_setting_model_1.MarketStatus.DRAFT;
        if (!(0, market_lifecycle_service_1.isAllowedMarketStatusTransition)(previousStatus, status)) {
            await logAdminAction(req, 'market.status_update_rejected', 'MarketSetting', countryCode, {
                countryCode,
                previousStatus,
                requestedStatus: status,
                allowedNextStatuses: market_lifecycle_service_1.MARKET_STATUS_TRANSITIONS[previousStatus] || [],
                failureReason: 'Invalid market lifecycle transition.',
            }, false);
            res.status(400).json({
                message: `Invalid market lifecycle transition from ${previousStatus} to ${status}.`,
                allowedNextStatuses: market_lifecycle_service_1.MARKET_STATUS_TRANSITIONS[previousStatus] || [],
            });
            return;
        }
        const hasCoverageInput = coverage.serviceCategories !== undefined ||
            coverage.supportedCities !== undefined ||
            coverage.cityServiceAvailability !== undefined ||
            req.body.serviceCategories !== undefined ||
            req.body.supportedCities !== undefined ||
            req.body.cityServiceAvailability !== undefined;
        const hasPaymentInput = payments.paymentProviders !== undefined ||
            payments.providerSettings !== undefined ||
            req.body.paymentProviders !== undefined ||
            req.body.paymentProviderSettings !== undefined;
        const paymentProviders = hasPaymentInput
            ? splitCsv(payments.paymentProviders ?? req.body.paymentProviders)
            : (existingMarket?.payments?.paymentProviders || []);
        const serviceCategories = hasCoverageInput
            ? (0, service_availability_service_1.normalizeServiceEntries)(coverage.serviceCategories ?? req.body.serviceCategories)
            : (0, service_availability_service_1.normalizeServiceEntries)(existingMarket?.coverage?.serviceCategories || []);
        const supportedCities = hasCoverageInput
            ? splitCsv(coverage.supportedCities ?? req.body.supportedCities)
            : existingMarket?.coverage?.supportedCities || [];
        const cityServiceAvailability = hasCoverageInput
            ? normalizeCityServiceAvailability(coverage.cityServiceAvailability ?? req.body.cityServiceAvailability)
            : existingMarket?.coverage?.cityServiceAvailability || [];
        const paymentProviderSettings = hasPaymentInput
            ? normalizePaymentProviderSettings(payments.providerSettings ?? req.body.paymentProviderSettings)
            : existingMarket?.payments?.providerSettings || [];
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
                requiredPermission: user_model_1.AdminPermission.MARKETS_SERVICES_ACTIVATE,
                attemptedActivations: serviceActivations,
            });
            return;
        }
        const requestedCurrency = typeof (identity.currency ?? req.body.currency) === 'string' && String(identity.currency ?? req.body.currency).trim()
            ? String(identity.currency ?? req.body.currency).trim().toUpperCase()
            : '';
        const currency = requestedCurrency || baseMarket?.currency;
        const requestedCountryName = typeof (identity.countryName ?? req.body.countryName) === 'string'
            ? String(identity.countryName ?? req.body.countryName).trim()
            : '';
        const countryName = requestedCountryName || existingMarket?.identity?.countryName || baseMarket?.countryName || '';
        const locale = typeof (identity.locale ?? req.body.locale) === 'string' && String(identity.locale ?? req.body.locale).trim()
            ? String(identity.locale ?? req.body.locale).trim()
            : existingMarket?.identity?.locale ?? baseMarket?.locale ?? '';
        const timezone = typeof (identity.timezone ?? req.body.timezone) === 'string' && String(identity.timezone ?? req.body.timezone).trim()
            ? String(identity.timezone ?? req.body.timezone).trim()
            : existingMarket?.identity?.timezone ?? '';
        const defaultCalloutFee = Number.isFinite(Number(pricing.defaultCalloutFeeMinor))
            ? Number(pricing.defaultCalloutFeeMinor) / 100
            : Number.isFinite(Number(pricing.defaultCalloutFee ?? req.body.defaultCalloutFee))
                ? Number(pricing.defaultCalloutFee ?? req.body.defaultCalloutFee)
                : typeof existingMarket?.pricing?.defaultCalloutFeeMinor === 'number'
                    ? existingMarket.pricing.defaultCalloutFeeMinor / 100
                    : baseMarket?.defaultCalloutFee ?? 0;
        const platformCommissionBps = Number.isFinite(Number(pricing.platformCommissionBps ?? req.body.platformCommissionBps))
            ? Number(pricing.platformCommissionBps ?? req.body.platformCommissionBps)
            : existingMarket?.pricing?.platformCommissionBps ?? baseMarket?.platformCommissionBps ?? 1500;
        const taxLabel = typeof (pricing.taxLabel ?? req.body.taxLabel) === 'string' && String(pricing.taxLabel ?? req.body.taxLabel).trim()
            ? String(pricing.taxLabel ?? req.body.taxLabel).trim()
            : existingMarket?.pricing?.taxLabel ?? baseMarket?.taxLabel ?? 'VAT';
        const taxRateBps = Number.isFinite(Number(pricing.taxRateBps ?? req.body.taxRateBps))
            ? Math.max(0, Math.min(10000, Math.round(Number(pricing.taxRateBps ?? req.body.taxRateBps))))
            : existingMarket?.pricing?.taxRateBps ?? 0;
        const clientServiceFeeType = ['PERCENTAGE', 'FIXED', 'NONE'].includes(String(pricing.clientServiceFeeType ?? req.body.clientServiceFeeType))
            ? String(pricing.clientServiceFeeType ?? req.body.clientServiceFeeType)
            : existingMarket?.pricing?.clientServiceFeeType ?? 'NONE';
        const clientServiceFeeBps = Number.isFinite(Number(pricing.clientServiceFeeBps ?? req.body.clientServiceFeeBps))
            ? Math.max(0, Math.min(10000, Math.round(Number(pricing.clientServiceFeeBps ?? req.body.clientServiceFeeBps))))
            : existingMarket?.pricing?.clientServiceFeeBps ?? 0;
        const clientServiceFeeMinor = Number.isFinite(Number(pricing.clientServiceFeeMinor ?? req.body.clientServiceFeeMinor))
            ? Math.max(0, Math.round(Number(pricing.clientServiceFeeMinor ?? req.body.clientServiceFeeMinor)))
            : existingMarket?.pricing?.clientServiceFeeMinor ?? 0;
        const supportEmail = typeof (support.email ?? req.body.supportEmail) === 'string'
            ? String(support.email ?? req.body.supportEmail).trim().toLowerCase()
            : existingMarket?.support?.email ?? '';
        const supportPhone = typeof (support.phone ?? req.body.supportPhone) === 'string'
            ? String(support.phone ?? req.body.supportPhone).trim()
            : existingMarket?.support?.phone ?? '';
        const supportWhatsapp = typeof (support.whatsapp ?? req.body.supportWhatsapp) === 'string'
            ? String(support.whatsapp ?? req.body.supportWhatsapp).trim()
            : existingMarket?.support?.whatsapp ?? '';
        const supportEscalationEmail = typeof (support.escalationEmail ?? req.body.supportEscalationEmail) === 'string'
            ? String(support.escalationEmail ?? req.body.supportEscalationEmail).trim().toLowerCase()
            : existingMarket?.support?.escalationEmail ?? '';
        if (!currency) {
            res.status(400).json({ message: 'Currency is required for custom countries.' });
            return;
        }
        if (status === market_setting_model_1.MarketStatus.ACTIVE) {
            const hasActiveCity = cityServiceAvailability.some((city) => city.status === market_setting_model_1.MarketStatus.ACTIVE);
            const hasActiveProvider = paymentProviderSettings.some((provider) => provider.status === 'ACTIVE');
            const activationErrors = [
                !countryName ? 'Country name is required.' : '',
                !currency ? 'Currency is required.' : '',
                !locale ? 'Locale is required.' : '',
                !timezone ? 'Timezone is required.' : '',
                !cityServiceAvailability.length ? 'At least one city is required.' : '',
                !hasActiveCity ? 'At least one active city is required.' : '',
                !hasActiveProvider ? 'At least one active payment provider is required.' : '',
                !(supportEmail || supportPhone) ? 'At least one support contact is required.' : '',
                defaultCalloutFee <= 0 ? 'Default call-out fee must be greater than zero.' : '',
                platformCommissionBps <= 0 ? 'Platform commission must be greater than zero.' : '',
            ].filter(Boolean);
            if (activationErrors.length) {
                res.status(400).json({
                    message: 'Market cannot be activated until setup is complete.',
                    activationErrors,
                });
                return;
            }
        }
        if (!baseMarket && !countryName) {
            res.status(400).json({ message: 'Country name is required for custom countries.' });
            return;
        }
        const marketUpdate = {
            identity: {
                countryCode,
                countryName,
                currency,
                locale,
                timezone,
                status,
            },
            pricing: {
                defaultCalloutFeeMinor: Math.round(defaultCalloutFee * 100),
                marketCalloutFeeMinor: Math.round(defaultCalloutFee * 100),
                platformCommissionBps,
                taxLabel,
                taxRateBps,
                taxInclusive: pricing.taxInclusive === true || req.body.taxInclusive === true,
                clientServiceFeeType,
                clientServiceFeeBps,
                clientServiceFeeMinor,
                taxableCallout: pricing.taxableCallout !== false,
                taxableLabour: pricing.taxableLabour !== false,
                taxableParts: pricing.taxableParts !== false,
                taxableAdditionalServices: pricing.taxableAdditionalServices !== false,
                taxableClientServiceFee: pricing.taxableClientServiceFee !== false,
                discountsReduceTaxableValue: pricing.discountsReduceTaxableValue !== false,
            },
            coverage: {
                supportedCities,
                serviceCategories,
                cityServiceAvailability,
            },
            payments: {
                paymentProviders,
                providerSettings: paymentProviderSettings.length
                    ? paymentProviderSettings
                    : buildDefaultProviderSettings(paymentProviders),
            },
            support: {
                email: supportEmail,
                phone: supportPhone,
                whatsapp: supportWhatsapp,
                escalationEmail: supportEscalationEmail,
            },
            audit: {
                updatedBy: actor?.id,
            },
        };
        const market = existingMarket
            ? await market_setting_model_1.default.findOneAndUpdate({ 'identity.countryCode': countryCode }, marketUpdate, { new: true, runValidators: true })
            : await new market_setting_model_1.default(marketUpdate).save();
        if (!market) {
            res.status(404).json({ message: 'Market not found.' });
            return;
        }
        await logAdminAction(req, 'market.update', 'MarketSetting', countryCode, {
            countryCode,
            countryName,
            previousStatus,
            status: market.identity.status,
            defaultCalloutFeeMinor: market.pricing.defaultCalloutFeeMinor,
            platformCommissionBps: market.pricing.platformCommissionBps,
            serviceActivations,
        });
        res.status(200).json({ success: true, market });
    }
    catch (error) {
        if (error?.code === 11000) {
            const duplicateKey = JSON.stringify(error.keyValue || {});
            await logAdminAction(req, 'market.update_rejected', 'MarketSetting', String(req.params.countryCode || '').toUpperCase(), {
                countryCode: String(req.params.countryCode || '').toUpperCase(),
                failureReason: 'Duplicate market country index conflict.',
                duplicateKey,
            }, false);
            res.status(409).json({
                success: false,
                message: 'A market with this country code already exists, or the database has a stale country index that must be repaired.',
                duplicateKey: error.keyValue || undefined,
            });
            return;
        }
        console.error('Market update failed:', error);
        res.status(500).json({ success: false, message: 'Failed to update market.' });
    }
};
exports.updateAdminMarket = updateAdminMarket;
const deleteAdminMarket = async (req, res) => {
    try {
        const countryCode = String(req.params.countryCode || '').trim().toUpperCase();
        if (!(await isSuperAdmin(req))) {
            await logAdminAction(req, 'market.delete_rejected', 'MarketSetting', countryCode, {
                countryCode,
                failureReason: 'Only a super admin can delete a market.',
            }, false);
            res.status(403).json({ message: 'Only a super admin can delete a market.' });
            return;
        }
        const market = await market_setting_model_1.default.findOne({ 'identity.countryCode': countryCode });
        if (!market) {
            res.status(404).json({ message: 'Market not found.' });
            return;
        }
        if (market.identity.status !== market_setting_model_1.MarketStatus.DRAFT) {
            await logAdminAction(req, 'market.delete_rejected', 'MarketSetting', countryCode, {
                countryCode,
                countryName: market.identity.countryName,
                status: market.identity.status,
                failureReason: 'Only unused DRAFT markets can be permanently deleted.',
            }, false);
            res.status(409).json({
                message: 'Only unused DRAFT markets can be permanently deleted. Archive the market instead.',
                status: market.identity.status,
            });
            return;
        }
        const firstDependencies = await countMarketDependencies(countryCode);
        if (Object.keys(firstDependencies).length) {
            await logAdminAction(req, 'market.delete_rejected', 'MarketSetting', countryCode, {
                countryCode,
                countryName: market.identity.countryName,
                status: market.identity.status,
                dependencyCheck: firstDependencies,
                failureReason: 'Market contains historical or operational data.',
            }, false);
            res.status(409).json({
                message: 'This market contains historical or operational data and cannot be permanently deleted. Archive the market instead.',
                dependencies: firstDependencies,
            });
            return;
        }
        const deletionToken = crypto_1.default.randomUUID();
        const deleteActor = getActor(req);
        const lockedBy = deleteActor?.id && mongoose_1.default.Types.ObjectId.isValid(String(deleteActor.id))
            ? new mongoose_1.default.Types.ObjectId(String(deleteActor.id))
            : null;
        const lockedMarket = await market_setting_model_1.default.findOneAndUpdate({
            _id: market._id,
            'identity.status': market_setting_model_1.MarketStatus.DRAFT,
            $or: [
                { 'deletionLock.locked': { $ne: true } },
                { deletionLock: { $exists: false } },
            ],
        }, {
            $set: {
                'deletionLock.locked': true,
                'deletionLock.token': deletionToken,
                'deletionLock.lockedAt': new Date(),
                'deletionLock.lockedBy': lockedBy,
            },
        }, { new: true });
        if (!lockedMarket) {
            await logAdminAction(req, 'market.delete_rejected', 'MarketSetting', countryCode, {
                countryCode,
                countryName: market.identity.countryName,
                status: market.identity.status,
                failureReason: 'Market deletion lock could not be acquired.',
            }, false);
            res.status(409).json({ message: 'Market deletion is already in progress or the market state changed.' });
            return;
        }
        const dependencies = await countMarketDependencies(countryCode);
        if (Object.keys(dependencies).length) {
            await market_setting_model_1.default.updateOne({ _id: lockedMarket._id, 'deletionLock.token': deletionToken }, {
                $set: { 'deletionLock.locked': false },
                $unset: { 'deletionLock.token': '', 'deletionLock.lockedAt': '', 'deletionLock.lockedBy': '' },
            });
            await logAdminAction(req, 'market.delete_rejected', 'MarketSetting', countryCode, {
                countryCode,
                countryName: lockedMarket.identity.countryName,
                status: lockedMarket.identity.status,
                dependencyCheck: dependencies,
                failureReason: 'Market contains historical or operational data.',
            }, false);
            res.status(409).json({
                message: 'This market contains historical or operational data and cannot be permanently deleted. Archive the market instead.',
                dependencies,
            });
            return;
        }
        await logAdminAction(req, 'market.delete', 'MarketSetting', countryCode, {
            countryCode,
            countryName: lockedMarket.identity.countryName,
            previousStatus: lockedMarket.identity.status,
            newStatus: 'DELETED',
            dependencyCheck: dependencies,
            deletionLockToken: deletionToken,
        });
        const deleteResult = await market_setting_model_1.default.deleteOne({
            _id: lockedMarket._id,
            'identity.status': market_setting_model_1.MarketStatus.DRAFT,
            'deletionLock.token': deletionToken,
        });
        if (deleteResult.deletedCount !== 1) {
            await market_setting_model_1.default.updateOne({ _id: lockedMarket._id, 'deletionLock.token': deletionToken }, {
                $set: { 'deletionLock.locked': false },
                $unset: { 'deletionLock.token': '', 'deletionLock.lockedAt': '', 'deletionLock.lockedBy': '' },
            });
            res.status(409).json({ success: false, message: 'Market deletion was not completed because the market state changed.' });
            return;
        }
        res.status(200).json({ success: true });
    }
    catch (error) {
        console.error('Market delete failed:', error);
        res.status(500).json({ success: false, message: 'Failed to delete market.' });
    }
};
exports.deleteAdminMarket = deleteAdminMarket;
const createAdminMarketCity = async (req, res) => {
    try {
        const countryCode = (0, market_config_1.normalizeIsoCountryCode)(req.params.countryCode);
        const cityName = (0, market_city_service_1.normalizeMarketCityName)(req.body.cityName ?? req.body.city);
        if (!cityName) {
            res.status(400).json({ message: 'City name is required.' });
            return;
        }
        const market = await market_setting_model_1.default.findOne({ 'identity.countryCode': countryCode });
        if (!market) {
            res.status(404).json({ message: 'Country market not found.' });
            return;
        }
        if (market.deletionLock?.locked) {
            res.status(423).json({ message: 'Market is temporarily locked for permanent deletion.' });
            return;
        }
        let nextCoverage;
        try {
            nextCoverage = (0, market_city_service_1.addCityToCoverage)(market.coverage || {}, cityName);
        }
        catch (error) {
            res.status(409).json({ message: error instanceof Error ? error.message : 'Unable to add city.' });
            return;
        }
        market.coverage.supportedCities = nextCoverage.supportedCities || [];
        market.coverage.cityServiceAvailability = (nextCoverage.cityServiceAvailability || []);
        market.audit.updatedBy = getActor(req)?.id && mongoose_1.default.Types.ObjectId.isValid(String(getActor(req)?.id))
            ? new mongoose_1.default.Types.ObjectId(String(getActor(req)?.id))
            : undefined;
        await market.save();
        await logAdminAction(req, 'market.city.create', 'MarketSetting', countryCode, { countryCode, cityName });
        res.status(200).json({ success: true, market: mergeMarketSetting(market.toObject()), cities: (0, market_city_service_1.cityNamesFromCoverage)(market.coverage) });
    }
    catch (error) {
        console.error('Market city create failed:', error);
        res.status(500).json({ success: false, message: 'Failed to create city.' });
    }
};
exports.createAdminMarketCity = createAdminMarketCity;
const updateAdminMarketCity = async (req, res) => {
    try {
        const countryCode = (0, market_config_1.normalizeIsoCountryCode)(req.params.countryCode);
        const currentCity = (0, market_city_service_1.normalizeMarketCityName)(decodeURIComponent(req.params.cityName || ''));
        const nextCity = (0, market_city_service_1.normalizeMarketCityName)(req.body.cityName ?? req.body.city);
        if (!currentCity || !nextCity) {
            res.status(400).json({ message: 'City name is required.' });
            return;
        }
        const market = await market_setting_model_1.default.findOne({ 'identity.countryCode': countryCode });
        if (!market) {
            res.status(404).json({ message: 'Country market not found.' });
            return;
        }
        if (!(0, market_city_service_1.cityNamesFromCoverage)(market.coverage || {}).some((city) => city.toLowerCase() === currentCity.toLowerCase())) {
            res.status(404).json({ message: 'City not found in this country.' });
            return;
        }
        const dependencies = await countMarketCityDependencies(countryCode, currentCity);
        if (Object.keys(dependencies).length) {
            res.status(409).json({
                message: 'This city has operational references and cannot be renamed safely yet.',
                dependencies,
            });
            return;
        }
        let nextCoverage;
        try {
            nextCoverage = (0, market_city_service_1.renameCityInCoverage)(market.coverage || {}, currentCity, nextCity);
        }
        catch (error) {
            res.status(409).json({ message: error instanceof Error ? error.message : 'Unable to rename city.' });
            return;
        }
        market.coverage.supportedCities = nextCoverage.supportedCities || [];
        market.coverage.cityServiceAvailability = (nextCoverage.cityServiceAvailability || []);
        await market.save();
        await logAdminAction(req, 'market.city.rename', 'MarketSetting', countryCode, { countryCode, previousCityName: currentCity, cityName: nextCity });
        res.status(200).json({ success: true, market: mergeMarketSetting(market.toObject()), cities: (0, market_city_service_1.cityNamesFromCoverage)(market.coverage) });
    }
    catch (error) {
        console.error('Market city rename failed:', error);
        res.status(500).json({ success: false, message: 'Failed to rename city.' });
    }
};
exports.updateAdminMarketCity = updateAdminMarketCity;
const deleteAdminMarketCity = async (req, res) => {
    try {
        const countryCode = (0, market_config_1.normalizeIsoCountryCode)(req.params.countryCode);
        const cityName = (0, market_city_service_1.normalizeMarketCityName)(decodeURIComponent(req.params.cityName || ''));
        if (!cityName) {
            res.status(400).json({ message: 'City name is required.' });
            return;
        }
        const market = await market_setting_model_1.default.findOne({ 'identity.countryCode': countryCode });
        if (!market) {
            res.status(404).json({ message: 'Country market not found.' });
            return;
        }
        if (!(0, market_city_service_1.cityNamesFromCoverage)(market.coverage || {}).some((city) => city.toLowerCase() === cityName.toLowerCase())) {
            res.status(404).json({ message: 'City not found in this country.' });
            return;
        }
        const dependencies = await countMarketCityDependencies(countryCode, cityName);
        if ((0, market_city_service_1.cityHasEmbeddedOperationalConfiguration)(market.coverage || {}, cityName)) {
            dependencies.marketConfiguration = (dependencies.marketConfiguration || 0) + 1;
        }
        if (Object.keys(dependencies).length) {
            res.status(409).json({
                message: 'This city contains service availability or operational data and cannot be permanently deleted.',
                dependencies,
            });
            return;
        }
        const nextCoverage = (0, market_city_service_1.removeCityFromCoverage)(market.coverage || {}, cityName);
        market.coverage.supportedCities = nextCoverage.supportedCities || [];
        market.coverage.cityServiceAvailability = (nextCoverage.cityServiceAvailability || []);
        await market.save();
        await logAdminAction(req, 'market.city.delete', 'MarketSetting', countryCode, { countryCode, cityName });
        res.status(200).json({ success: true, market: mergeMarketSetting(market.toObject()), cities: (0, market_city_service_1.cityNamesFromCoverage)(market.coverage) });
    }
    catch (error) {
        console.error('Market city delete failed:', error);
        res.status(500).json({ success: false, message: 'Failed to delete city.' });
    }
};
exports.deleteAdminMarketCity = deleteAdminMarketCity;
const createAdminMarketArea = async (req, res) => {
    try {
        const countryCode = (0, market_config_1.normalizeIsoCountryCode)(req.params.countryCode);
        const cityName = (0, market_city_service_1.normalizeMarketCityName)(decodeURIComponent(req.params.cityName || ''));
        const areaName = (0, market_city_service_1.normalizeMarketAreaName)(req.body.areaName ?? req.body.area);
        if (!cityName || !areaName) {
            res.status(400).json({ message: 'City and Area name are required.' });
            return;
        }
        const market = await market_setting_model_1.default.findOne({ 'identity.countryCode': countryCode });
        if (!market) {
            res.status(404).json({ message: 'Country market not found.' });
            return;
        }
        let nextCoverage;
        try {
            nextCoverage = (0, market_city_service_1.addAreaToCity)(market.coverage || {}, cityName, areaName);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to add area.';
            res.status(message.includes('not found') ? 404 : 409).json({ message });
            return;
        }
        market.coverage.cityServiceAvailability = (nextCoverage.cityServiceAvailability || []);
        await market.save();
        await logAdminAction(req, 'market.area.create', 'MarketSetting', countryCode, { countryCode, cityName, areaName });
        res.status(200).json({ success: true, market: mergeMarketSetting(market.toObject()), areas: (0, market_city_service_1.areaNamesFromCity)(market.coverage, cityName) });
    }
    catch (error) {
        console.error('Market area create failed:', error);
        res.status(500).json({ success: false, message: 'Failed to create area.' });
    }
};
exports.createAdminMarketArea = createAdminMarketArea;
const updateAdminMarketArea = async (req, res) => {
    try {
        const countryCode = (0, market_config_1.normalizeIsoCountryCode)(req.params.countryCode);
        const cityName = (0, market_city_service_1.normalizeMarketCityName)(decodeURIComponent(req.params.cityName || ''));
        const currentArea = (0, market_city_service_1.normalizeMarketAreaName)(decodeURIComponent(req.params.areaName || ''));
        const nextArea = (0, market_city_service_1.normalizeMarketAreaName)(req.body.areaName ?? req.body.area);
        if (!cityName || !currentArea || !nextArea) {
            res.status(400).json({ message: 'City and Area name are required.' });
            return;
        }
        const market = await market_setting_model_1.default.findOne({ 'identity.countryCode': countryCode });
        if (!market) {
            res.status(404).json({ message: 'Country market not found.' });
            return;
        }
        if (!(0, market_city_service_1.areaNamesFromCity)(market.coverage || {}, cityName).some((area) => area.toLowerCase() === currentArea.toLowerCase())) {
            res.status(404).json({ message: 'Area not found in this city.' });
            return;
        }
        const dependencies = await countMarketAreaDependencies(countryCode, cityName, currentArea);
        if (Object.keys(dependencies).length) {
            res.status(409).json({ message: 'This area has operational references and cannot be renamed safely yet.', dependencies });
            return;
        }
        let nextCoverage;
        try {
            nextCoverage = (0, market_city_service_1.renameAreaInCity)(market.coverage || {}, cityName, currentArea, nextArea);
        }
        catch (error) {
            res.status(409).json({ message: error instanceof Error ? error.message : 'Unable to rename area.' });
            return;
        }
        market.coverage.cityServiceAvailability = (nextCoverage.cityServiceAvailability || []);
        await market.save();
        await logAdminAction(req, 'market.area.rename', 'MarketSetting', countryCode, { countryCode, cityName, previousAreaName: currentArea, areaName: nextArea });
        res.status(200).json({ success: true, market: mergeMarketSetting(market.toObject()), areas: (0, market_city_service_1.areaNamesFromCity)(market.coverage, cityName) });
    }
    catch (error) {
        console.error('Market area rename failed:', error);
        res.status(500).json({ success: false, message: 'Failed to rename area.' });
    }
};
exports.updateAdminMarketArea = updateAdminMarketArea;
const deleteAdminMarketArea = async (req, res) => {
    try {
        const countryCode = (0, market_config_1.normalizeIsoCountryCode)(req.params.countryCode);
        const cityName = (0, market_city_service_1.normalizeMarketCityName)(decodeURIComponent(req.params.cityName || ''));
        const areaName = (0, market_city_service_1.normalizeMarketAreaName)(decodeURIComponent(req.params.areaName || ''));
        if (!cityName || !areaName) {
            res.status(400).json({ message: 'City and Area name are required.' });
            return;
        }
        const market = await market_setting_model_1.default.findOne({ 'identity.countryCode': countryCode });
        if (!market) {
            res.status(404).json({ message: 'Country market not found.' });
            return;
        }
        if (!(0, market_city_service_1.areaNamesFromCity)(market.coverage || {}, cityName).some((area) => area.toLowerCase() === areaName.toLowerCase())) {
            res.status(404).json({ message: 'Area not found in this city.' });
            return;
        }
        const dependencies = await countMarketAreaDependencies(countryCode, cityName, areaName);
        if ((0, market_city_service_1.areaHasEmbeddedOperationalConfiguration)(market.coverage || {}, cityName, areaName)) {
            dependencies.marketConfiguration = (dependencies.marketConfiguration || 0) + 1;
        }
        if (Object.keys(dependencies).length) {
            res.status(409).json({ message: 'This area contains service availability or operational data and cannot be permanently deleted.', dependencies });
            return;
        }
        const nextCoverage = (0, market_city_service_1.removeAreaFromCity)(market.coverage || {}, cityName, areaName);
        market.coverage.cityServiceAvailability = (nextCoverage.cityServiceAvailability || []);
        await market.save();
        await logAdminAction(req, 'market.area.delete', 'MarketSetting', countryCode, { countryCode, cityName, areaName });
        res.status(200).json({ success: true, market: mergeMarketSetting(market.toObject()), areas: (0, market_city_service_1.areaNamesFromCity)(market.coverage, cityName) });
    }
    catch (error) {
        console.error('Market area delete failed:', error);
        res.status(500).json({ success: false, message: 'Failed to delete area.' });
    }
};
exports.deleteAdminMarketArea = deleteAdminMarketArea;
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
        const { name, email, phone, password, adminRole, adminPermissions, countryCode, location } = req.body;
        if (!name || !email || !phone) {
            res.status(400).json({ message: 'Name, email, and phone are required.' });
            return;
        }
        const normalizedEmail = String(email).toLowerCase().trim();
        const exists = await user_model_1.default.findOne({ email: normalizedEmail });
        if (exists) {
            res.status(409).json({ message: 'A user with this email already exists.' });
            return;
        }
        const selectedRole = Object.values(user_model_1.AdminRole).includes(adminRole) ? adminRole : user_model_1.AdminRole.READ_ONLY_ADMIN;
        const requestedCountryCode = String(countryCode || 'ZA').toUpperCase();
        const baseMarket = market_config_1.MARKET_CONFIG[requestedCountryCode];
        if (!baseMarket) {
            res.status(400).json({ message: 'This country is not configured as a MyFixer market yet. Add it in Settings before assigning staff to it.' });
            return;
        }
        const temporaryPassword = typeof password === 'string' && password.trim().length >= 8
            ? password
            : generateTemporaryPassword();
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
            password: await bcrypt_1.default.hash(temporaryPassword, 10),
            role: user_model_1.UserRole.ADMIN,
            adminRole: selectedRole,
            adminPermissions: resolveAdminPermissions(selectedRole, normalizeAdminPermissionsInput(adminPermissions)),
            isActive: true,
            mustChangePassword: true,
        });
        const portalUrl = process.env.ADMIN_PORTAL_URL?.trim().replace(/\/$/, '') || '';
        const onboardingEmailSent = portalUrl
            ? await email_service_1.EmailService.sendStaffOnboardingEmail({
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
        delete result.password;
        res.status(201).json({ success: true, admin: result, onboardingEmailSent });
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
        const targetAdmin = await user_model_1.default.findOne({ _id: id, role: user_model_1.UserRole.ADMIN }).select('adminRole adminPermissions');
        if (!targetAdmin) {
            res.status(404).json({ message: 'Admin user not found.' });
            return;
        }
        const updates = {};
        if (Object.values(user_model_1.AdminRole).includes(req.body.adminRole)) {
            const requestedPermissions = Array.isArray(req.body.adminPermissions)
                ? normalizeAdminPermissionsInput(req.body.adminPermissions)
                : normalizeAdminPermissionsInput(targetAdmin.adminPermissions);
            updates.adminRole = req.body.adminRole;
            updates.adminPermissions = resolveAdminPermissions(req.body.adminRole, requestedPermissions);
        }
        else if (Array.isArray(req.body.adminPermissions)) {
            updates.adminPermissions = resolveAdminPermissions(targetAdmin.adminRole || user_model_1.AdminRole.READ_ONLY_ADMIN, normalizeAdminPermissionsInput(req.body.adminPermissions));
        }
        if (typeof req.body.isActive === 'boolean')
            updates.isActive = req.body.isActive;
        if (typeof req.body.name === 'string' && req.body.name.trim())
            updates.name = req.body.name.trim();
        if (typeof req.body.phone === 'string' && req.body.phone.trim())
            updates.phone = req.body.phone.trim();
        const admin = await user_model_1.default.findOneAndUpdate({ _id: id, role: user_model_1.UserRole.ADMIN }, updates, { new: true, runValidators: true }).select('-password');
        await logAdminAction(req, 'admin.update', 'User', id, updates);
        res.status(200).json({ success: true, admin });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update admin user.' });
    }
};
exports.updateAdminUser = updateAdminUser;
const listAdminPromotions = async (_req, res) => {
    try {
        const promotions = await promotion_model_1.default.find().sort({ createdAt: -1 }).limit(200).lean();
        res.status(200).json({
            success: true,
            promotions: promotions.map((promotion) => ({
                ...promotion,
                displayStatus: promotionStatusForDisplay(promotion),
                hasActivity: hasPromotionActivity(promotion),
            })),
            discountTypes: Object.values(promotion_model_1.PromotionDiscountType),
            statuses: Object.values(promotion_model_1.PromotionStatus),
            triggerTypes: Object.values(promotion_model_1.PromotionTriggerType),
            fundingSources: Object.values(promotion_model_1.PromotionFundingSource),
            stackingPolicies: Object.values(promotion_model_1.PromotionStackingPolicy),
        });
    }
    catch (error) {
        console.error('Failed to load promotions:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch promotions.' });
    }
};
exports.listAdminPromotions = listAdminPromotions;
const getAdminPromotionsSummary = async (_req, res) => {
    try {
        const promotions = await promotion_model_1.default.find().lean();
        const revenueInfluencedMinor = await sumInvoiceRevenueForPromotion();
        res.status(200).json({
            success: true,
            summary: (0, exports.buildPromotionAnalyticsSummary)(promotions, revenueInfluencedMinor),
            definitions: promotionDefinitions,
        });
    }
    catch (error) {
        console.error('Failed to load promotion summary:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch promotion summary.' });
    }
};
exports.getAdminPromotionsSummary = getAdminPromotionsSummary;
const createAdminPromotion = async (req, res) => {
    try {
        const actor = getActor(req);
        const code = normalizePromotionCode(req.body.code);
        const payload = normalizePromotionPayload(req.body);
        if (payload.triggerType === promotion_model_1.PromotionTriggerType.CODE && !code) {
            res.status(400).json({ message: 'Promo code is required.' });
            return;
        }
        if (!payload.name) {
            res.status(400).json({ message: 'Promotion name is required.' });
            return;
        }
        await assertPromotionCanActivate(payload);
        const promotion = await promotion_model_1.default.create({
            ...payload,
            code: payload.triggerType === promotion_model_1.PromotionTriggerType.CODE ? code : null,
            createdBy: actor?.id,
            updatedBy: actor?.id,
        });
        await logAdminAction(req, 'promotion.create', 'Promotion', promotion._id.toString(), {
            code: promotion.code,
            discountType: promotion.discountType,
            discountValue: promotion.discountValue,
        });
        res.status(201).json({ success: true, promotion });
    }
    catch (error) {
        if (error?.code === 11000) {
            res.status(409).json({ message: 'A promotion with this code already exists.' });
            return;
        }
        res.status(400).json({ success: false, message: error.message || 'Failed to create promotion.' });
    }
};
exports.createAdminPromotion = createAdminPromotion;
const getAdminPromotionById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            res.status(400).json({ message: 'Invalid promotion id.' });
            return;
        }
        const promotion = await promotion_model_1.default.findById(id).lean();
        if (!promotion) {
            res.status(404).json({ message: 'Promotion not found.' });
            return;
        }
        res.status(200).json({
            success: true,
            promotion: {
                ...promotion,
                displayStatus: promotionStatusForDisplay(promotion),
                hasActivity: hasPromotionActivity(promotion),
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch promotion.' });
    }
};
exports.getAdminPromotionById = getAdminPromotionById;
const getAdminPromotionPerformance = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            res.status(400).json({ message: 'Invalid promotion id.' });
            return;
        }
        const promotion = await promotion_model_1.default.findById(id).lean();
        if (!promotion) {
            res.status(404).json({ message: 'Promotion not found.' });
            return;
        }
        const revenueInfluencedMinor = await sumInvoiceRevenueForPromotion(id);
        const reservationIds = promotion.metadata?.reservationIds && typeof promotion.metadata.reservationIds === 'object'
            ? Object.values(promotion.metadata.reservationIds)
            : [];
        const releasedReservations = reservationIds.filter((entry) => entry?.status === 'RELEASED').length;
        const reversals = reservationIds.filter((entry) => entry?.status === 'REVERSED').length;
        const reservations = Number(promotion.reservationCount || 0);
        const redemptions = Number(promotion.redemptionCount || 0);
        res.status(200).json({
            success: true,
            performance: {
                reservations,
                redemptions,
                releasedReservations,
                reversals,
                redemptionRate: reservations > 0 ? redemptions / reservations : null,
                totalDiscountGrantedMinor: Number(promotion.redeemedBudgetMinor || 0),
                revenueInfluencedMinor,
                averageBookingValueMinor: redemptions > 0 ? Math.round(revenueInfluencedMinor / redemptions) : null,
                campaignBudgetUsedMinor: Number(promotion.redeemedBudgetMinor || 0) + Number(promotion.reservedBudgetMinor || 0),
                remainingBudgetMinor: promotion.budgetMinor === null || promotion.budgetMinor === undefined
                    ? null
                    : Math.max(0, Number(promotion.budgetMinor || 0) - Number(promotion.redeemedBudgetMinor || 0) - Number(promotion.reservedBudgetMinor || 0)),
                eligibleBookings: null,
                newClientsAcquired: null,
                returningClients: null,
                paymentSuccessRate: null,
            },
            definitions: promotionDefinitions,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch promotion performance.' });
    }
};
exports.getAdminPromotionPerformance = getAdminPromotionPerformance;
const getAdminPromotionRedemptions = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            res.status(400).json({ message: 'Invalid promotion id.' });
            return;
        }
        const limit = parseLimit(req.query.limit, 50);
        const page = Math.max(1, Math.floor(Number(req.query.page || 1)));
        const state = String(req.query.state || '').trim().toUpperCase();
        const bookings = await booking_model_1.default.find({
            $or: [
                { 'metadata.promotions.promotionId': id },
                { 'metadata.promotion.promotionId': id },
            ],
        })
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .select('customerId status paymentStatus metadata createdAt updatedAt')
            .lean();
        const records = bookings.flatMap((booking) => extractPromotionSnapshots(booking.metadata, id).map((snapshot) => ({
            bookingId: String(booking._id),
            clientId: booking.customerId ? String(booking.customerId) : '',
            promotionId: id,
            state: snapshot.reservationStatus || snapshot.status || 'RESERVED',
            discountMinor: Number(snapshot.discountMinor || snapshot.promotionDiscountMinor || 0),
            fundingSource: snapshot.fundingSource || snapshot.promotionFundingSource || '',
            reservedAt: snapshot.reservedAt || null,
            redeemedAt: snapshot.redeemedAt || null,
            releasedAt: snapshot.releasedAt || null,
            reversedAt: snapshot.reversedAt || null,
            bookingStatus: booking.status,
            paymentStatus: booking.paymentStatus,
        }))).filter((record) => !state || String(record.state).toUpperCase() === state);
        res.status(200).json({ success: true, redemptions: records, pagination: { page, limit, count: records.length } });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch promotion redemptions.' });
    }
};
exports.getAdminPromotionRedemptions = getAdminPromotionRedemptions;
const getAdminPromotionAudit = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            res.status(400).json({ message: 'Invalid promotion id.' });
            return;
        }
        const logs = await audit_log_model_1.default.find({ 'event.resourceType': 'Promotion', 'event.resourceId': id })
            .sort({ createdAt: -1 })
            .limit(parseLimit(req.query.limit, 50))
            .lean();
        res.status(200).json({ success: true, logs });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch promotion audit history.' });
    }
};
exports.getAdminPromotionAudit = getAdminPromotionAudit;
const duplicateAdminPromotion = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            res.status(400).json({ message: 'Invalid promotion id.' });
            return;
        }
        const actor = getActor(req);
        const source = await promotion_model_1.default.findById(id).lean();
        if (!source) {
            res.status(404).json({ message: 'Promotion not found.' });
            return;
        }
        const duplicate = await promotion_model_1.default.create({
            code: null,
            name: `${source.name} Copy`.slice(0, 120),
            description: source.description,
            status: promotion_model_1.PromotionStatus.DRAFT,
            triggerType: source.triggerType,
            discountType: source.discountType,
            discountValue: source.discountValue,
            maxDiscountMinor: source.maxDiscountMinor,
            minBookingAmountMinor: source.minBookingAmountMinor,
            countryCode: source.countryCode,
            currency: source.currency,
            cityKeys: source.cityKeys || [],
            areaKeys: source.areaKeys || [],
            serviceKeys: source.serviceKeys || [],
            subcategoryKeys: source.subcategoryKeys || [],
            eligibleClientIds: source.eligibleClientIds || [],
            excludedClientIds: source.excludedClientIds || [],
            firstBookingOnly: source.firstBookingOnly === true,
            priority: source.priority,
            stackingPolicy: source.stackingPolicy,
            fundingSource: source.fundingSource,
            fundingSplitBps: source.fundingSplitBps,
            budgetMinor: source.budgetMinor,
            startsAt: null,
            expiresAt: null,
            usageLimit: source.usageLimit,
            perClientLimit: source.perClientLimit,
            metadata: {
                ...(source.metadata || {}),
                sourcePromotionId: id,
                reservationIds: {},
            },
            createdBy: actor?.id,
            updatedBy: actor?.id,
        });
        await logAdminAction(req, 'promotion.duplicate', 'Promotion', duplicate._id.toString(), { sourcePromotionId: id });
        res.status(201).json({ success: true, promotion: duplicate });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message || 'Failed to duplicate promotion.' });
    }
};
exports.duplicateAdminPromotion = duplicateAdminPromotion;
const transitionAdminPromotion = async (req, res, status, action) => {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            res.status(400).json({ message: 'Invalid promotion id.' });
            return;
        }
        const actor = getActor(req);
        const existing = await promotion_model_1.default.findById(id).select('status countryCode');
        if (!existing) {
            res.status(404).json({ message: 'Promotion not found.' });
            return;
        }
        if (existing.status === promotion_model_1.PromotionStatus.ARCHIVED && status === promotion_model_1.PromotionStatus.ACTIVE) {
            res.status(400).json({ message: 'Archived promotions cannot be activated.' });
            return;
        }
        await assertPromotionCanActivate({ status, countryCode: existing.countryCode });
        const promotion = await promotion_model_1.default.findByIdAndUpdate(id, { $set: { status, updatedBy: actor?.id } }, { new: true, runValidators: true });
        await logAdminAction(req, action, 'Promotion', id, { from: existing.status, to: status });
        res.status(200).json({ success: true, promotion });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message || 'Failed to update promotion status.' });
    }
};
const activateAdminPromotion = (req, res) => transitionAdminPromotion(req, res, promotion_model_1.PromotionStatus.ACTIVE, 'promotion.activate');
exports.activateAdminPromotion = activateAdminPromotion;
const pauseAdminPromotion = (req, res) => transitionAdminPromotion(req, res, promotion_model_1.PromotionStatus.PAUSED, 'promotion.pause');
exports.pauseAdminPromotion = pauseAdminPromotion;
const endAdminPromotion = (req, res) => transitionAdminPromotion(req, res, promotion_model_1.PromotionStatus.ENDED, 'promotion.end');
exports.endAdminPromotion = endAdminPromotion;
const archiveAdminPromotion = (req, res) => transitionAdminPromotion(req, res, promotion_model_1.PromotionStatus.ARCHIVED, 'promotion.archive');
exports.archiveAdminPromotion = archiveAdminPromotion;
const updateAdminPromotion = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            res.status(400).json({ message: 'Invalid promotion id.' });
            return;
        }
        const actor = getActor(req);
        const updates = normalizePromotionPatchPayload(req.body);
        const existing = await promotion_model_1.default.findById(id).select('countryCode status reservationCount redemptionCount metadata');
        if (!existing) {
            res.status(404).json({ message: 'Promotion not found.' });
            return;
        }
        const lockedFields = hasPromotionActivity(existing) ? (0, exports.promotionMaterialFieldsChanged)(updates) : [];
        if (lockedFields.length) {
            res.status(409).json({
                message: 'This campaign has redemptions. Material financial changes require a new version.',
                lockedFields,
            });
            return;
        }
        if (updates.metadata) {
            updates.metadata = {
                ...(existing.metadata || {}),
                ...updates.metadata,
            };
        }
        await assertPromotionCanActivate({
            status: updates.status ?? existing.status,
            countryCode: updates.countryCode ?? existing.countryCode,
        });
        const promotion = await promotion_model_1.default.findByIdAndUpdate(id, { $set: { ...updates, updatedBy: actor?.id } }, { new: true, runValidators: true });
        await logAdminAction(req, 'promotion.update', 'Promotion', id, updates);
        res.status(200).json({ success: true, promotion });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message || 'Failed to update promotion.' });
    }
};
exports.updateAdminPromotion = updateAdminPromotion;
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