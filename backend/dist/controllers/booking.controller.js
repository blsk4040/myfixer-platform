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
exports.finalizeJobInvoice = exports.confirmArrival = exports.completeInspection = exports.startInspection = exports.startJob = exports.startRoute = exports.updateBookingStatus = exports.declineBooking = exports.acceptBooking = exports.getMyBookingHistory = exports.getMyActiveBooking = exports.getBookingById = exports.createBooking = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
// 1. IMPORT BookingStatus ENUM HERE
const booking_model_1 = __importStar(require("../models/booking.model"));
const matching_service_1 = __importStar(require("../services/matching.service"));
// 2. UNCOMMENT AND USE YOUR ACTUAL EMAIL SERVICE UTILITY
const email_service_1 = require("../services/email/email.service");
const billing_model_1 = require("../models/billing.model");
const payment_transaction_model_1 = __importStar(require("../models/payment-transaction.model"));
const user_model_1 = require("../models/user.model");
const user_model_2 = __importDefault(require("../models/user.model"));
const quote_model_1 = __importStar(require("../models/quote.model"));
const technician_model_1 = __importStar(require("../models/technician.model"));
const technician_capability_model_1 = __importStar(require("../models/technician-capability.model"));
const service_waitlist_model_1 = __importStar(require("../models/service-waitlist.model"));
const market_setting_model_1 = __importDefault(require("../models/market-setting.model"));
const audit_service_1 = require("../services/audit.service");
const audit_log_model_1 = require("../models/audit-log.model");
const market_config_1 = require("../config/market.config");
const service_availability_service_1 = require("../services/service-availability.service");
const price_breakdown_service_1 = require("../services/price-breakdown.service");
const promotion_campaign_service_1 = require("../services/promotion-campaign.service");
const notification_service_1 = require("../services/notification.service");
const notification_model_1 = require("../models/notification.model");
const booking_workflow_service_1 = require("../services/booking-workflow.service");
const inspection_workflow_service_1 = require("../services/inspection-workflow.service");
const booking_recipient_service_1 = require("../services/booking-recipient.service");
const booking_privacy_service_1 = require("../services/booking-privacy.service");
const market_finance_guard_service_1 = require("../services/market-finance-guard.service");
const toFiniteNumber = (value) => {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};
const decimalFromMinor = (valueMinor) => valueMinor / 100;
const normalizePromoCode = (value) => typeof value === 'string' ? value.trim().toUpperCase().replace(/\s+/g, '') : '';
const isBookingStatus = (value) => typeof value === 'string' && Object.values(booking_model_1.BookingStatus).includes(value);
const normalizeFallbackPreference = (value) => {
    const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
    return normalized === 'SCHEDULED' || normalized === 'WAITLIST' ? normalized : 'STANDBY';
};
const STANDBY_RETRY_INTERVAL_MS = 60 * 1000;
const STANDBY_RETRY_WINDOW_MS = 15 * 60 * 1000;
const DISPATCH_WAVE_SIZE = 3;
const parseDateInput = (value) => typeof value === 'string' || value instanceof Date ? new Date(value) : null;
const isValidDate = (value) => Boolean(value && !Number.isNaN(value.getTime()));
const getAuthenticatedUser = (request) => request.user;
const getSocketIdentity = (socket) => {
    const query = socket.handshake.query;
    const candidate = query.technicianId ??
        query.technician_id ??
        query.userId ??
        query.user_id ??
        socket.handshake.auth?.technicianId ??
        socket.data?.technicianId;
    if (Array.isArray(candidate)) {
        return candidate[0] ?? null;
    }
    return typeof candidate === 'string' ? candidate : null;
};
const isSocketDebugEnabled = () => process.env.NODE_ENV !== 'production' || process.env.SOCKET_DEBUG === 'true';
const logSocketDebug = (message, metadata) => {
    if (!isSocketDebugEnabled())
        return;
    console.info(`[tech-socket-debug] ${message}`, metadata ?? '');
};
const emitIncomingRequest = async (io, technicianId, payload) => {
    io.to(`technician:${technicianId}`).emit('incoming_request', payload);
    const sockets = await io.fetchSockets();
    const matchingSockets = sockets.filter((socket) => getSocketIdentity(socket) === technicianId);
    logSocketDebug('booking broadcast targeting technician', {
        technicianId,
        matchingSocketCount: matchingSockets.length,
        room: `technician:${technicianId}`,
    });
    matchingSockets.forEach((socket) => {
        socket.emit('incoming_request', payload);
    });
};
const buildIncomingRequestPayload = (booking) => (0, booking_privacy_service_1.serializeBookingForUnassignedTechnician)(booking, { categoryMatch: true });
const safelyLogAuditEvent = async (request, input) => {
    try {
        await (0, audit_service_1.logAuditEvent)(request, input);
    }
    catch (error) {
        console.warn('Audit event could not be recorded:', {
            action: input.action,
            resourceType: input.resourceType,
            resourceId: input.resourceId,
        });
    }
};
const createCustomerBookingNotification = async (booking, eventType, title, message, metadata = {}) => {
    const customerId = String(booking.customerId || '').trim();
    if (!mongoose_1.default.Types.ObjectId.isValid(customerId))
        return [];
    return (0, notification_service_1.createNotifications)({
        userId: customerId,
        email: booking.customerEmail || '',
        name: booking.customerName || 'Client',
        channels: [notification_model_1.NotificationChannel.IN_APP, notification_model_1.NotificationChannel.PUSH],
        type: eventType,
        title,
        message,
        metadata: {
            bookingId: typeof booking.id === 'string' ? booking.id : String(booking._id || ''),
            applianceType: booking.applianceType || '',
            status: booking.status || '',
            ...metadata,
        },
    });
};
const stripScheduleMarker = (value) => {
    const text = typeof value === 'string' ? value.trim() : '';
    return text.replace(/\s*\((ASAP|Urgent \/ Right Now|[^)]*\d{1,2}:\d{2}[^)]*)\)\s*$/i, '').trim() || text || 'service';
};
const providerRoleForService = (serviceKey) => {
    const key = (0, matching_service_1.normalizeDispatchServiceKey)(serviceKey);
    if (key === 'cleaning')
        return 'cleaner';
    if (key === 'plumbing')
        return 'plumber';
    if (key === 'electrical')
        return 'electrician';
    if (key === 'gardening')
        return 'gardener';
    if (key === 'painting')
        return 'painter';
    if (key === 'automotive')
        return 'mechanic';
    return 'technician';
};
const serviceLabelForNotification = (booking) => stripScheduleMarker(booking.applianceType || booking.metadata?.serviceKey || booking.serviceKey || 'service');
const formatScheduledBookingTime = (value) => value.toLocaleString('en-ZA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
});
const createTechnicianJobNotification = async (technicianId, booking) => {
    if (!mongoose_1.default.Types.ObjectId.isValid(technicianId))
        return [];
    return (0, notification_service_1.createNotifications)({
        userId: technicianId,
        channels: [notification_model_1.NotificationChannel.PUSH],
        type: 'NEW_JOB_REQUEST',
        title: 'New job request',
        message: `${booking.applianceType || 'Service request'} in ${booking.generalArea || 'your area'}.`,
        metadata: {
            bookingId: typeof booking.id === 'string' ? booking.id : String(booking._id || ''),
            applianceType: booking.applianceType || '',
            priceMinor: booking.priceMinor,
            currency: booking.currency,
        },
    });
};
const notifyTechniciansForBooking = async (io, booking, technicianIds) => {
    if (!technicianIds.length)
        return;
    const incomingRequestPayload = buildIncomingRequestPayload(booking);
    if (io) {
        await Promise.all(technicianIds.map((technicianId) => emitIncomingRequest(io, technicianId, incomingRequestPayload)));
        await Promise.all(technicianIds.map(async (technicianId) => {
            const jobs = await matching_service_1.default.findNearbyPendingBookingsForTechnician(technicianId);
            io.to(`technician:${technicianId}`).emit('available_jobs', jobs);
        }));
    }
    await Promise.all(technicianIds.map((technicianId) => createTechnicianJobNotification(technicianId, booking)));
};
const nextDispatchWave = (booking, candidates, waveSize = DISPATCH_WAVE_SIZE) => {
    const alreadyInvited = new Set((booking.dispatch?.sentToTechnicians || []).map((id) => id.toString()));
    const alreadyAttempted = new Set((booking.dispatch?.attempts || []).map((attempt) => attempt.technicianId.toString()));
    const declined = new Set((booking.dispatch?.declinedByTechnicians || []).map((id) => id.toString()));
    const wave = Number(booking.dispatch?.currentWave || 0) + 1;
    return {
        wave,
        candidates: candidates
            .filter((candidate) => !alreadyInvited.has(candidate.technicianId) &&
            !alreadyAttempted.has(candidate.technicianId) &&
            !declined.has(candidate.technicianId))
            .slice(0, waveSize),
    };
};
const recordDispatchWave = (booking, candidates, wave, status, expiresAt) => {
    const technicianIds = candidates.map((candidate) => candidate.technicianId);
    const sentToTechnicians = [
        ...(booking.dispatch?.sentToTechnicians || []),
        ...technicianIds.map((technicianId) => new mongoose_1.default.Types.ObjectId(technicianId)),
    ];
    const attempts = [
        ...(booking.dispatch?.attempts || []),
        ...candidates.map((candidate) => ({
            technicianId: new mongoose_1.default.Types.ObjectId(candidate.technicianId),
            wave,
            status: 'SENT',
            distanceKm: candidate.distanceKm,
            score: candidate.score,
            reason: 'ranked_dispatch_wave',
            sentAt: new Date(),
            respondedAt: null,
        })),
    ];
    booking.dispatch = {
        ...(booking.dispatch ?? {
            declinedByTechnicians: [],
            preferredTechnicianId: null,
        }),
        status,
        expiresAt: expiresAt ?? booking.dispatch?.expiresAt ?? matching_service_1.default.getDispatchExpiry(booking),
        sentToTechnicians,
        declinedByTechnicians: booking.dispatch?.declinedByTechnicians || [],
        acceptedByTechnician: booking.dispatch?.acceptedByTechnician ?? null,
        preferredTechnicianId: booking.dispatch?.preferredTechnicianId ?? null,
        currentWave: wave,
        nextRetryAt: [booking_model_1.BookingDispatchStatus.BROADCASTING, booking_model_1.BookingDispatchStatus.STANDBY].includes(status)
            ? new Date(Date.now() + STANDBY_RETRY_INTERVAL_MS)
            : null,
        attempts,
    };
    booking.set('metadata.dispatchEngine', 'RANKED_PROGRESSIVE_WAVES_V1');
    booking.set('metadata.lastDispatchWave', wave);
    return technicianIds;
};
const scheduleStandbyProviderRetries = (bookingId, io, retryUntil = new Date(Date.now() + STANDBY_RETRY_WINDOW_MS)) => {
    if (!mongoose_1.default.Types.ObjectId.isValid(bookingId))
        return;
    const timer = setTimeout(async () => {
        try {
            const booking = await booking_model_1.default.findById(bookingId);
            if (!booking)
                return;
            if (booking.status !== booking_model_1.BookingStatus.PENDING ||
                ![booking_model_1.BookingDispatchStatus.BROADCASTING, booking_model_1.BookingDispatchStatus.STANDBY].includes(booking.dispatch?.status))
                return;
            const dispatchExpiry = booking.dispatch?.expiresAt ? new Date(booking.dispatch.expiresAt) : retryUntil;
            const now = new Date();
            const stopAt = dispatchExpiry < retryUntil ? dispatchExpiry : retryUntil;
            if (stopAt.getTime() <= now.getTime())
                return;
            const rankedCandidates = await matching_service_1.default.rankEligibleOnlineTechniciansForBooking(bookingId);
            const nextWave = nextDispatchWave(booking, rankedCandidates);
            if (nextWave.candidates.length) {
                const nextTechnicianIds = recordDispatchWave(booking, nextWave.candidates, nextWave.wave, booking_model_1.BookingDispatchStatus.BROADCASTING, dispatchExpiry);
                booking.set('metadata.standbyProviderFoundAt', now);
                await booking.save();
                await notifyTechniciansForBooking(io, booking, nextTechnicianIds);
                await createCustomerBookingNotification(booking, 'PROVIDER_SEARCH_UPDATED', 'Provider search updated', `We found nearby ${providerRoleForService(booking.serviceKey)} options for your ${serviceLabelForNotification(booking)} request.`, {
                    dispatchStatus: booking_model_1.BookingDispatchStatus.BROADCASTING,
                    matchedCount: nextTechnicianIds.length,
                });
                return;
            }
            scheduleStandbyProviderRetries(bookingId, io, stopAt);
        }
        catch (error) {
            console.error('Failed to retry standby dispatch:', error);
        }
    }, STANDBY_RETRY_INTERVAL_MS);
    timer.unref?.();
};
const saveCapacityWaitlistEntry = async (input) => {
    return service_waitlist_model_1.default.findOneAndUpdate({
        email: input.email,
        countryCode: input.countryCode,
        city: input.city,
        area: input.area,
        serviceKey: input.categorySlug,
    }, {
        $set: {
            location: {
                type: 'Point',
                coordinates: [input.longitude, input.latitude],
            },
            metadata: {
                categorySlug: input.categorySlug,
                coordinates: [input.longitude, input.latitude],
                reason: 'NO_ACTIVE_TECHNICIANS',
                sourceBookingId: input.bookingId,
            },
        },
        $setOnInsert: {
            customerId: mongoose_1.default.Types.ObjectId.isValid(input.customerId)
                ? new mongoose_1.default.Types.ObjectId(input.customerId)
                : undefined,
            email: input.email,
            phone: input.phone,
            countryCode: input.countryCode,
            city: input.city,
            area: input.area,
            serviceKey: input.categorySlug,
            status: service_waitlist_model_1.ServiceWaitlistStatus.WAITING,
            source: service_waitlist_model_1.ServiceWaitlistSource.CLIENT_APP,
        },
    }, { upsert: true, new: true, setDefaultsOnInsert: true });
};
const getBookingServiceKeyForClaim = (booking) => (0, matching_service_1.normalizeDispatchServiceKey)(booking.serviceKey ?? booking.metadata?.serviceKey ?? booking.applianceType ?? booking.generalArea);
const canTechnicianClaimOpenBooking = async (technicianUserId, booking) => {
    if (!mongoose_1.default.Types.ObjectId.isValid(technicianUserId))
        return false;
    const categorySlug = getBookingServiceKeyForClaim(booking);
    if (!categorySlug)
        return false;
    const technician = await technician_model_1.default.findOne({
        userId: new mongoose_1.default.Types.ObjectId(technicianUserId),
        approvalStatus: technician_model_1.TechnicianApprovalStatus.APPROVED,
    })
        .select('_id countryCode serviceCategories documents.profilePhotoStatus')
        .lean();
    if (!technician)
        return false;
    if (technician.documents?.profilePhotoStatus !== technician_model_1.VerificationStatus.VERIFIED)
        return false;
    if (booking.countryCode && technician.countryCode !== booking.countryCode)
        return false;
    const capability = await technician_capability_model_1.default.findOne({
        technicianId: technician._id,
        categorySlug,
        verificationStatus: technician_capability_model_1.CapabilityStatus.APPROVED,
    })
        .select('_id')
        .lean();
    if (capability)
        return true;
    const legacyCategories = Array.isArray(technician.serviceCategories)
        ? technician.serviceCategories.map((item) => (0, matching_service_1.normalizeDispatchServiceKey)(item))
        : [];
    return legacyCategories.includes(categorySlug);
};
const validatePreferredProviderRebooking = async (input) => {
    if (!input.preferredTechnicianId && !input.rebookFromBookingId)
        return { allowed: true };
    if (!mongoose_1.default.Types.ObjectId.isValid(input.preferredTechnicianId)) {
        return { allowed: false, message: 'Invalid preferred provider.' };
    }
    if (!mongoose_1.default.Types.ObjectId.isValid(input.rebookFromBookingId)) {
        return { allowed: false, message: 'A previous completed MyFixer booking is required to rebook a preferred provider.' };
    }
    const sourceBooking = await booking_model_1.default.findOne({
        _id: input.rebookFromBookingId,
        customerId: new mongoose_1.default.Types.ObjectId(input.customerId),
        technicianId: new mongoose_1.default.Types.ObjectId(input.preferredTechnicianId),
        status: booking_model_1.BookingStatus.COMPLETED,
    })
        .select('serviceKey metadata countryCode technicianId')
        .lean();
    if (!sourceBooking) {
        return { allowed: false, message: 'You can only rebook a provider from your own completed MyFixer jobs.' };
    }
    const previousServiceKey = (0, matching_service_1.normalizeDispatchServiceKey)(sourceBooking.serviceKey ?? sourceBooking.metadata?.serviceKey);
    if (previousServiceKey && previousServiceKey !== input.requestedServiceKey) {
        return { allowed: false, message: 'This provider can only be rebooked for the same service category.' };
    }
    if (sourceBooking.countryCode !== input.countryCode) {
        return { allowed: false, message: 'Preferred provider rebooking is only available in the same country.' };
    }
    const canClaim = await canTechnicianClaimOpenBooking(input.preferredTechnicianId, {
        serviceKey: input.requestedServiceKey,
        countryCode: input.countryCode,
    });
    if (!canClaim) {
        return { allowed: false, message: 'This provider is not currently approved for that service.' };
    }
    return {
        allowed: true,
        preferredTechnicianObjectId: new mongoose_1.default.Types.ObjectId(input.preferredTechnicianId),
    };
};
const hasValidDefaultServiceAddress = (user) => {
    const address = user?.defaultServiceAddress;
    return Boolean(address?.fullAddress && address?.city && address?.suburb);
};
const isCustomerReadyToBook = (user) => {
    if (!user || (0, user_model_1.normalizeUserRole)(user.role) !== user_model_1.UserRole.CUSTOMER)
        return true;
    if (user.profileCompleted === true && (user.isEmailVerified === true || user.emailVerified === true))
        return true;
    const legacyProfileComplete = Boolean(user.name &&
        user.phone &&
        user.countryCode &&
        user.location?.city &&
        user.location?.area &&
        hasValidDefaultServiceAddress(user));
    return legacyProfileComplete && (user.isEmailVerified === true || user.emailVerified === true);
};
const createBooking = async (request, response) => {
    const body = request.body;
    const authUser = getAuthenticatedUser(request);
    const customerId = String(authUser?.id ?? authUser?._id ?? '').trim();
    const customerName = typeof body.customer_name === 'string' ? body.customer_name.trim() : 'Client';
    const applianceType = typeof body.appliance_type === 'string' ? body.appliance_type.trim() : '';
    const faultDescription = typeof body.fault_description === 'string' ? body.fault_description.trim() : 'No description provided.';
    const fullAddress = typeof body.full_address === 'string' ? body.full_address.trim() : '';
    const streetAddress = typeof body.street_address === 'string' ? body.street_address.trim() : '';
    const suburb = typeof body.suburb === 'string' ? body.suburb.trim() : '';
    const postalCode = typeof body.postal_code === 'string' ? body.postal_code.trim() : '';
    const saveAsDefaultAddress = body.save_as_default_address === true;
    const complexDetails = typeof body.complex_details === 'string' ? body.complex_details.trim() : '';
    const generalArea = typeof body.general_area === 'string' ? body.general_area.trim() : 'Local Area';
    const requestedCity = typeof body.city === 'string' ? body.city.trim() : '';
    const requestedArea = typeof body.area === 'string'
        ? body.area.trim()
        : typeof body.neighbourhood === 'string'
            ? body.neighbourhood.trim()
            : typeof body.neighborhood === 'string'
                ? body.neighborhood.trim()
                : '';
    const requestedServiceKey = (0, matching_service_1.normalizeDispatchServiceKey)(body.service_key ?? body.category ?? body.general_area ?? applianceType);
    const requestedSubcategoryKey = (0, matching_service_1.normalizeDispatchServiceKey)(body.subcategory_key ?? body.subcategoryKey ?? body.sub_category_key ?? body.subCategory);
    const preferredTechnicianId = typeof (body.preferredTechnicianId ?? body.preferred_technician_id) === 'string'
        ? String(body.preferredTechnicianId ?? body.preferred_technician_id).trim()
        : '';
    const rebookFromBookingId = typeof (body.rebookFromBookingId ?? body.rebook_from_booking_id) === 'string'
        ? String(body.rebookFromBookingId ?? body.rebook_from_booking_id).trim()
        : '';
    const fallbackPreference = normalizeFallbackPreference(body.fallbackPreference ?? body.fallback_preference);
    const scheduledAtInput = body.scheduledStartTime ?? body.scheduled_start_time ?? body.scheduledAt ?? body.scheduled_at;
    const scheduledAt = parseDateInput(scheduledAtInput);
    const scheduledEndAt = parseDateInput(body.scheduledEndTime ?? body.scheduled_end_time);
    const isPreBook = isValidDate(scheduledAt) && scheduledAt.getTime() > Date.now();
    const promoCode = normalizePromoCode(body.promoCode ?? body.promo_code);
    const latitude = toFiniteNumber(body.latitude);
    const longitude = toFiniteNumber(body.longitude);
    let countryCode = '';
    let customer = null;
    if (mongoose_1.default.Types.ObjectId.isValid(customerId)) {
        customer = await user_model_2.default.findById(customerId)
            .select('name phone role countryCode location defaultServiceAddress profileCompleted isEmailVerified emailVerified')
            .lean();
        countryCode = (0, market_config_1.normalizeCountryCode)(body.country_code ?? customer?.countryCode ?? customer?.location?.country);
    }
    else {
        countryCode = (0, market_config_1.normalizeCountryCode)(body.country_code);
    }
    const activeMarket = await (0, market_finance_guard_service_1.assertActiveMarket)(countryCode);
    const market = {
        countryCode: activeMarket.identity.countryCode,
        countryName: activeMarket.identity.countryName,
        currency: activeMarket.identity.currency,
        defaultCalloutFee: (0, market_config_1.fromMinorUnits)(activeMarket.pricing.defaultCalloutFeeMinor, activeMarket.identity.currency),
        platformCommissionBps: activeMarket.pricing.platformCommissionBps,
    };
    const callOutFee = market.defaultCalloutFee;
    let originalPriceMinor = activeMarket.pricing.defaultCalloutFeeMinor;
    let priceMinor = originalPriceMinor;
    let promotionDiscountMinor = 0;
    let appliedPromotions = [];
    if (!customerId || !applianceType || !fullAddress || latitude === null || longitude === null) {
        response.status(400).json({ message: 'Missing or invalid booking layout items' });
        return;
    }
    if (!mongoose_1.default.Types.ObjectId.isValid(customerId)) {
        response.status(401).json({ message: 'Invalid customer identity.' });
        return;
    }
    if (!customer) {
        response.status(404).json({ message: 'Customer profile not found.' });
        return;
    }
    if ((0, user_model_1.normalizeUserRole)(customer.role) === user_model_1.UserRole.CUSTOMER && !isCustomerReadyToBook(customer)) {
        response.status(403).json({
            message: 'Please complete your profile and verify your email before booking a service.',
            code: customer.profileCompleted === true ? 'EMAIL_VERIFICATION_REQUIRED' : 'PROFILE_REQUIRED',
        });
        return;
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 || callOutFee < 0) {
        response.status(400).json({ message: 'Invalid location or pricing metrics input' });
        return;
    }
    let serviceRecipient;
    try {
        serviceRecipient = (0, booking_recipient_service_1.normalizeServiceRecipient)(body, {
            customer,
            countryCode,
            city: requestedCity || customer?.location?.city || '',
            fullAddress,
            streetAddress: streetAddress || fullAddress,
            hasServiceCoordinates: latitude !== null && longitude !== null,
        });
    }
    catch (error) {
        if (error instanceof booking_recipient_service_1.BookingRecipientValidationError) {
            response.status(400).json({ message: error.message });
            return;
        }
        throw error;
    }
    if ((fallbackPreference === 'SCHEDULED' || scheduledAtInput) && !isValidDate(scheduledAt)) {
        response.status(400).json({ message: 'Invalid scheduled booking date.' });
        return;
    }
    if (scheduledEndAt && (!isValidDate(scheduledEndAt) || (isValidDate(scheduledAt) && scheduledEndAt <= scheduledAt))) {
        response.status(400).json({ message: 'Invalid scheduled booking end date.' });
        return;
    }
    if (body.currency && (!(0, market_config_1.isCurrencyCode)(body.currency) || body.currency !== market.currency)) {
        response.status(400).json({
            message: `Currency for ${market.countryName} must be ${market.currency}`,
        });
        return;
    }
    const city = requestedCity || customer?.location?.city || '';
    const area = requestedArea || customer?.location?.area || '';
    const availability = await (0, service_availability_service_1.validateServiceBookable)({
        countryCode,
        city,
        area,
        serviceKey: requestedServiceKey,
        subcategoryKey: requestedSubcategoryKey,
    });
    if (!availability.allowed) {
        response.status(409).json({
            message: availability.message || 'This service is not available in your selected location.',
            serviceStatus: availability.service?.status,
            serviceKey: requestedServiceKey,
            subcategoryKey: requestedSubcategoryKey,
        });
        return;
    }
    if (typeof availability.service?.calloutFeeMinor === 'number') {
        originalPriceMinor = availability.service.calloutFeeMinor;
        priceMinor = originalPriceMinor;
    }
    if (body.call_out_fee !== undefined && Math.round(Number(body.call_out_fee) * 100) !== originalPriceMinor) {
        response.status(400).json({
            message: 'Call-out fee must match the active market service configuration.',
        });
        return;
    }
    try {
        const promotionResolution = await (0, promotion_campaign_service_1.resolvePromotionsForPricing)({
            promoCode,
            customerId,
            amountMinor: originalPriceMinor,
            countryCode: market.countryCode,
            currency: market.currency,
            city,
            area,
            serviceKey: requestedServiceKey,
            subcategoryKey: requestedSubcategoryKey,
        });
        promotionDiscountMinor = promotionResolution.promotionDiscountMinor;
        appliedPromotions = promotionResolution.promotions;
    }
    catch (error) {
        if (error instanceof promotion_campaign_service_1.PromotionCampaignError || promoCode) {
            response.status(400).json({ message: error.message || 'Promotion could not be applied.' });
            return;
        }
        throw error;
    }
    const promotionTechnicianFundedMinor = appliedPromotions.reduce((sum, promotion) => sum + Math.round((promotion.discountMinor * (promotion.fundingSplitBps.technician || 0)) / 10000), 0);
    const promotionPartnerFundedMinor = appliedPromotions.reduce((sum, promotion) => sum + Math.round((promotion.discountMinor * (promotion.fundingSplitBps.partner || 0)) / 10000), 0);
    const priceBreakdown = (0, price_breakdown_service_1.calculatePriceBreakdown)({
        currency: market.currency,
        calloutFeeMinor: originalPriceMinor,
        promotionDiscountMinor,
        otherDiscountMinor: 0,
        promotionFundingSource: appliedPromotions.some((promotion) => promotion.fundingSource === 'SHARED')
            ? 'SHARED'
            : appliedPromotions.some((promotion) => promotion.fundingSource === 'PROVIDER' || promotion.fundingSource === 'TECHNICIAN')
                ? 'PROVIDER'
                : appliedPromotions.some((promotion) => promotion.fundingSource === 'PARTNER')
                    ? 'PARTNER'
                    : 'MYFIXER',
        promotionTechnicianFundedMinor,
        promotionPartnerFundedMinor,
        marketPricing: {
            ...activeMarket.pricing,
            platformCommissionBps: activeMarket.pricing.platformCommissionBps ?? 1500,
        },
    });
    priceMinor = priceBreakdown.totalMinor;
    const preferredRebooking = await validatePreferredProviderRebooking({
        customerId,
        preferredTechnicianId,
        rebookFromBookingId,
        requestedServiceKey,
        countryCode: market.countryCode,
    });
    if (!preferredRebooking.allowed) {
        response.status(403).json({ message: preferredRebooking.message || 'Preferred provider rebooking is not allowed for this request.' });
        return;
    }
    let promotionReservationCommitted = false;
    let bookingCreated = false;
    if (appliedPromotions.length) {
        try {
            await (0, promotion_campaign_service_1.reservePromotions)(appliedPromotions);
            promotionReservationCommitted = true;
        }
        catch (error) {
            response.status(409).json({ message: error.message || 'Promotion could not be reserved.' });
            return;
        }
    }
    try {
        // 1. Save directly into MongoDB Atlas with updated keys
        const booking = await booking_model_1.default.create({
            customerId: new mongoose_1.default.Types.ObjectId(customerId),
            customerName,
            customerEmail: authUser?.email ?? 'client@myfixer.co.za',
            serviceKey: requestedServiceKey,
            applianceType,
            faultDescription,
            customerLocation: {
                type: 'Point',
                coordinates: [longitude, latitude]
            },
            fullAddress,
            complexDetails,
            generalArea,
            serviceRecipient,
            status: isPreBook ? booking_model_1.BookingStatus.SCHEDULED : booking_model_1.BookingStatus.PENDING,
            scheduledAt: isPreBook && isValidDate(scheduledAt) ? scheduledAt : null,
            appointmentWindow: isPreBook
                ? {
                    isPreBook: true,
                    scheduledStartTime: scheduledAt,
                    scheduledEndTime: isValidDate(scheduledEndAt) ? scheduledEndAt : null,
                }
                : {
                    isPreBook: false,
                    scheduledStartTime: null,
                    scheduledEndTime: null,
                },
            metadata: {
                streetAddress,
                suburb,
                city,
                postalCode,
                serviceKey: requestedServiceKey,
                subcategoryKey: requestedSubcategoryKey,
                subcategoryLabel: applianceType,
                pricingSource: availability.service?.pricingSource || '',
                fallbackPreference,
                scheduledAt: isValidDate(scheduledAt) ? scheduledAt : null,
                preferredTechnicianId: preferredRebooking.preferredTechnicianObjectId?.toString() || '',
                rebookFromBookingId,
                rebookPolicy: preferredRebooking.preferredTechnicianObjectId
                    ? 'PREFERRED_PROVIDER_FIRST_WITH_MYFIXER_PROTECTION'
                    : '',
                promotion: appliedPromotions[0],
                promotions: appliedPromotions,
                priceBreakdown,
                pricingRuleVersion: 'market-pricing-v1',
            },
            priceMinor,
            countryCode: market.countryCode,
            currency: market.currency,
            dispatch: {
                status: isPreBook ? booking_model_1.BookingDispatchStatus.SCHEDULED : booking_model_1.BookingDispatchStatus.BROADCASTING,
                expiresAt: isPreBook ? null : matching_service_1.default.getDispatchExpiry({ createdAt: new Date() }),
                sentToTechnicians: [],
                declinedByTechnicians: [],
                preferredTechnicianId: preferredRebooking.preferredTechnicianObjectId ?? null,
            },
        });
        const bookingId = booking.id;
        bookingCreated = true;
        const io = request.app.get('io');
        await safelyLogAuditEvent(request, {
            action: serviceRecipient.type === 'OTHER' ? 'booking.create.for_other' : 'booking.create.for_self',
            module: 'BOOKINGS',
            resourceType: 'Booking',
            resourceId: bookingId,
            metadata: {
                recipientType: serviceRecipient.type,
                hasRecipientPhone: Boolean(serviceRecipient.phoneNumber),
                hasServiceLocation: true,
            },
        });
        if (saveAsDefaultAddress) {
            await user_model_2.default.findByIdAndUpdate(customerId, {
                $set: {
                    defaultServiceAddress: {
                        streetAddress,
                        suburb,
                        city,
                        postalCode,
                        countryCode: market.countryCode,
                        fullAddress,
                        coordinates: {
                            type: 'Point',
                            coordinates: [longitude, latitude],
                        },
                        updatedAt: new Date(),
                    },
                    'location.city': city,
                    'location.area': suburb,
                },
            });
        }
        const notificationServiceLabel = serviceLabelForNotification(booking);
        const scheduledNotificationText = isPreBook && isValidDate(scheduledAt)
            ? formatScheduledBookingTime(scheduledAt)
            : '';
        await createCustomerBookingNotification(booking, 'BOOKING_CREATED', `${notificationServiceLabel} request ${isPreBook ? 'scheduled' : 'submitted'}`, isPreBook && scheduledNotificationText
            ? `Your ${notificationServiceLabel} request is scheduled for ${scheduledNotificationText}. We will notify you when a provider is assigned.`
            : `We are finding a ${providerRoleForService(requestedServiceKey)} near you. We will notify you when someone accepts.`, {
            serviceKey: requestedServiceKey,
            promotionDiscountMinor,
            promotionIds: appliedPromotions.map((promotion) => promotion.promotionId),
            scheduledAt: isPreBook && isValidDate(scheduledAt) ? scheduledAt.toISOString() : null,
            bookingStatus: isPreBook ? booking_model_1.BookingStatus.SCHEDULED : booking_model_1.BookingStatus.PENDING,
        });
        // 2. Broadcast the open request to the best first wave of eligible online approved technicians.
        const rankedCandidates = fallbackPreference === 'SCHEDULED' || isPreBook
            ? []
            : await matching_service_1.default.rankEligibleOnlineTechniciansForBooking(bookingId);
        const preferredTechnicianUserId = preferredRebooking.preferredTechnicianObjectId?.toString() || '';
        const orderedCandidates = preferredTechnicianUserId && rankedCandidates.some((candidate) => candidate.technicianId === preferredTechnicianUserId)
            ? [
                ...rankedCandidates.filter((candidate) => candidate.technicianId === preferredTechnicianUserId),
                ...rankedCandidates.filter((candidate) => candidate.technicianId !== preferredTechnicianUserId),
            ]
            : rankedCandidates;
        const firstWave = nextDispatchWave(booking, orderedCandidates);
        let notifiedTechnicianIds = firstWave.candidates.map((candidate) => candidate.technicianId);
        console.info('[dispatch-test] findEligibleTechniciansWithTelemetryPipeline output', {
            bookingId,
            serviceKey: requestedServiceKey,
            customerCoordinates: [longitude, latitude],
            eligibleTechnicianIds: orderedCandidates.map((candidate) => candidate.technicianId),
            firstWaveTechnicianIds: notifiedTechnicianIds,
            preferredTechnicianId: preferredTechnicianUserId,
            matchedCount: orderedCandidates.length,
        });
        if (firstWave.candidates.length > 0) {
            notifiedTechnicianIds = recordDispatchWave(booking, firstWave.candidates, firstWave.wave, booking_model_1.BookingDispatchStatus.BROADCASTING, matching_service_1.default.getDispatchExpiry(booking));
            await booking.save();
            scheduleStandbyProviderRetries(bookingId, io);
        }
        else {
            if (fallbackPreference === 'SCHEDULED' || isPreBook) {
                booking.dispatch = {
                    ...(booking.dispatch ?? {
                        sentToTechnicians: [],
                        declinedByTechnicians: [],
                    }),
                    status: booking_model_1.BookingDispatchStatus.SCHEDULED,
                    expiresAt: null,
                    sentToTechnicians: booking.dispatch?.sentToTechnicians ?? [],
                    declinedByTechnicians: booking.dispatch?.declinedByTechnicians ?? [],
                };
                booking.metadata = {
                    ...(booking.metadata ?? {}),
                    fallbackPreference,
                    scheduledAt: isValidDate(scheduledAt) ? scheduledAt : null,
                    queue: 'UPCOMING',
                };
                await booking.save();
            }
            else if (fallbackPreference === 'WAITLIST') {
                const email = (typeof body.email === 'string' ? body.email.trim().toLowerCase() : '') ||
                    authUser?.email ||
                    'client@myfixer.co.za';
                const waitlist = await saveCapacityWaitlistEntry({
                    customerId,
                    email,
                    phone: typeof body.phone === 'string' ? body.phone.trim() : '',
                    countryCode: market.countryCode,
                    city: city || 'Unknown City',
                    area,
                    categorySlug: requestedServiceKey,
                    longitude,
                    latitude,
                    bookingId,
                });
                booking.status = booking_model_1.BookingStatus.CANCELLED;
                booking.cancelledAt = new Date();
                booking.cancellation = {
                    cancelledBy: booking_model_1.BookingCancellationBy.SYSTEM,
                    reason: 'Area capacity reached; customer interest logged on waitlist.',
                };
                booking.dispatch = {
                    ...(booking.dispatch ?? {
                        sentToTechnicians: [],
                        declinedByTechnicians: [],
                    }),
                    status: booking_model_1.BookingDispatchStatus.CANCELLED,
                    expiresAt: null,
                    sentToTechnicians: booking.dispatch?.sentToTechnicians ?? [],
                    declinedByTechnicians: booking.dispatch?.declinedByTechnicians ?? [],
                };
                booking.metadata = {
                    ...(booking.metadata ?? {}),
                    fallbackPreference,
                    waitlistId: waitlist._id.toString(),
                    capacityLoggedAt: new Date(),
                };
                await booking.save();
                response.status(201).json({
                    success: true,
                    bookingId,
                    fallbackPreference,
                    dispatchStatus: booking.dispatch.status,
                    waitlistLogged: true,
                    message: 'No active technicians are available in this area right now. Your interest has been logged.',
                    waitlist: {
                        id: waitlist._id,
                        serviceKey: waitlist.serviceKey,
                        status: waitlist.status,
                    },
                    notifiedTechnicianIds: [],
                });
                return;
            }
            else {
                await matching_service_1.default.markBookingStandby(bookingId);
                matching_service_1.default.scheduleStandbyAutoCancellation(bookingId);
                const refreshedBooking = await booking_model_1.default.findById(bookingId);
                if (refreshedBooking?.dispatch) {
                    booking.dispatch = refreshedBooking.dispatch;
                }
                booking.metadata = {
                    ...(booking.metadata ?? {}),
                    fallbackPreference,
                };
                await booking.save();
                scheduleStandbyProviderRetries(bookingId, io);
                await createCustomerBookingNotification(booking, 'PROVIDER_SEARCH_STANDBY', 'Still looking for a provider', `We are still looking for a nearby ${providerRoleForService(requestedServiceKey)}. Your request is open and we will notify you when someone accepts.`, {
                    dispatchStatus: booking_model_1.BookingDispatchStatus.STANDBY,
                    standbyExpiresAt: booking.dispatch?.expiresAt,
                });
            }
        }
        // 3. Formulate the precise JSON parameters expected by DashboardScreen.tsx
        await notifyTechniciansForBooking(io, booking, notifiedTechnicianIds);
        if (!io && notifiedTechnicianIds.length) {
            console.warn('Socket.io server instance unavailable; skipped technician broadcasts');
        }
        response.status(201).json({
            success: true,
            bookingId,
            fallbackPreference,
            dispatchStatus: booking.dispatch?.status,
            standbyExpiresAt: booking.dispatch?.status === booking_model_1.BookingDispatchStatus.STANDBY ? booking.dispatch.expiresAt : null,
            message: booking.dispatch?.status === booking_model_1.BookingDispatchStatus.STANDBY
                ? 'We are still looking for a nearby provider. Your request is open and we will notify you when someone accepts.'
                : undefined,
            preferredTechnicianId: preferredTechnicianUserId || null,
            notifiedTechnicianIds,
            priceBreakdown,
            promotion: appliedPromotions[0] || null,
            promotions: appliedPromotions,
        });
    }
    catch (error) {
        if (promotionReservationCommitted && !bookingCreated) {
            await (0, promotion_campaign_service_1.releasePromotionReservations)(appliedPromotions).catch(() => undefined);
        }
        if (error instanceof market_finance_guard_service_1.MarketFinanceGuardError) {
            response.status(error.statusCode).json({ message: error.message, code: error.code });
            return;
        }
        console.error('Failed to create booking in MongoDB:', error);
        response.status(500).json({ message: 'Failed to create booking' });
    }
};
exports.createBooking = createBooking;
// ==========================================
// ✅ FINALIZE INVOICE ENGINE WORKER
// ==========================================
const getBookingById = async (request, response) => {
    const { id } = request.params;
    const authUser = getAuthenticatedUser(request);
    const userId = String(authUser?.id ?? authUser?._id ?? '').trim();
    const role = (0, user_model_1.normalizeUserRole)(authUser?.role);
    try {
        let booking = await booking_model_1.default.findById(id);
        if (!booking) {
            response.status(404).json({ message: 'Booking not found' });
            return;
        }
        const isAdmin = role === user_model_1.UserRole.ADMIN;
        const isCustomer = String(booking.customerId) === userId;
        const isAssignedTechnician = String(booking.technicianId || '') === userId;
        if (!isAdmin && !isCustomer && !isAssignedTechnician) {
            await safelyLogAuditEvent(request, {
                action: 'booking.precise_location.rejected',
                module: 'BOOKINGS',
                resourceType: 'Booking',
                resourceId: booking.id,
                severity: audit_log_model_1.AuditSeverity.WARNING,
                metadata: {
                    actorRole: role,
                    reason: 'not_owner_or_assigned_technician',
                },
                success: false,
            });
            response.status(403).json({ message: 'This account cannot access this booking.' });
            return;
        }
        const technicianUser = booking.technicianId && mongoose_1.default.Types.ObjectId.isValid(booking.technicianId)
            ? await user_model_2.default.findById(booking.technicianId).select('name phone profilePhotoUrl').lean()
            : null;
        const technicianProfile = booking.technicianId && mongoose_1.default.Types.ObjectId.isValid(booking.technicianId)
            ? await technician_model_1.default.findOne({ userId: booking.technicianId }).select('lastLocation documents.profilePhotoUrl documents.profilePhotoStatus updatedAt').lean()
            : null;
        const approvedTechnicianPhotoUrl = technicianProfile?.documents?.profilePhotoStatus === technician_model_1.VerificationStatus.VERIFIED
            ? technicianProfile.documents.profilePhotoUrl
            : '';
        const serialized = isAdmin
            ? (0, booking_privacy_service_1.serializeBookingForAdmin)(booking)
            : isCustomer
                ? (0, booking_privacy_service_1.serializeBookingForOwner)(booking)
                : (0, booking_privacy_service_1.serializeBookingForAssignedTechnician)(booking);
        if (isAssignedTechnician) {
            if (!(0, booking_privacy_service_1.isAssignedTechnicianWithPreciseAccess)(booking, userId)) {
                await safelyLogAuditEvent(request, {
                    action: 'booking.precise_location.rejected',
                    module: 'BOOKINGS',
                    resourceType: 'Booking',
                    resourceId: booking.id,
                    severity: audit_log_model_1.AuditSeverity.WARNING,
                    metadata: {
                        actorRole: role,
                        reason: 'status_not_eligible_for_precise_location',
                        status: booking.status,
                    },
                    success: false,
                });
                response.status(403).json({ message: 'Precise service details are not available for this booking status.' });
                return;
            }
            await safelyLogAuditEvent(request, {
                action: 'booking.precise_location.release',
                module: 'BOOKINGS',
                resourceType: 'Booking',
                resourceId: booking.id,
                metadata: {
                    actorRole: role,
                    status: booking.status,
                },
            });
        }
        response.status(200).json({
            ...serialized,
            price: decimalFromMinor(booking.priceMinor),
            technicianId: booking.technicianId,
            technician: technicianUser ? {
                id: String(booking.technicianId),
                name: technicianUser.name,
                phone: technicianUser.phone,
                profilePhotoUrl: technicianUser.profilePhotoUrl || approvedTechnicianPhotoUrl || '',
                lastLocation: technicianProfile?.lastLocation ? {
                    longitude: technicianProfile.lastLocation.coordinates[0],
                    latitude: technicianProfile.lastLocation.coordinates[1],
                } : null,
                lastGpsUpdate: technicianProfile?.updatedAt ?? null,
            } : null,
            createdAt: booking.createdAt,
            updatedAt: booking.updatedAt,
        });
    }
    catch (error) {
        console.error('Failed to fetch booking details:', error);
        response.status(500).json({ message: 'Failed to fetch booking details' });
    }
};
exports.getBookingById = getBookingById;
const getMyActiveBooking = async (request, response) => {
    const authUser = getAuthenticatedUser(request);
    const customerId = String(authUser?.id ?? authUser?._id ?? '').trim();
    if (!customerId) {
        response.status(401).json({ message: 'Unauthorized. User context missing.' });
        return;
    }
    try {
        const booking = await booking_model_1.default.findOne({
            customerId,
            status: {
                $in: [
                    booking_model_1.BookingStatus.PENDING,
                    booking_model_1.BookingStatus.SCHEDULED,
                    booking_model_1.BookingStatus.ACCEPTED,
                    booking_model_1.BookingStatus.IN_ROUTE,
                    booking_model_1.BookingStatus.ARRIVED,
                    booking_model_1.BookingStatus.IN_PROGRESS,
                    booking_model_1.BookingStatus.DIAGNOSTIC_DONE,
                ],
            },
        }).sort({ updatedAt: -1 });
        if (!booking) {
            response.status(200).json({ active: false, booking: null });
            return;
        }
        const [longitude, latitude] = booking.customerLocation.coordinates;
        const technicianUser = booking.technicianId && mongoose_1.default.Types.ObjectId.isValid(booking.technicianId)
            ? await user_model_2.default.findById(booking.technicianId).select('name phone profilePhotoUrl').lean()
            : null;
        const technicianProfile = booking.technicianId && mongoose_1.default.Types.ObjectId.isValid(booking.technicianId)
            ? await technician_model_1.default.findOne({ userId: booking.technicianId }).select('lastLocation documents.profilePhotoUrl documents.profilePhotoStatus updatedAt').lean()
            : null;
        const approvedTechnicianPhotoUrl = technicianProfile?.documents?.profilePhotoStatus === technician_model_1.VerificationStatus.VERIFIED
            ? technicianProfile.documents.profilePhotoUrl
            : '';
        response.status(200).json({
            active: true,
            booking: {
                id: booking.id,
                status: booking.status,
                customerId: booking.customerId,
                customerName: booking.customerName,
                serviceKey: booking.serviceKey,
                applianceType: booking.applianceType,
                faultDescription: booking.faultDescription,
                fullAddress: booking.fullAddress,
                complexDetails: booking.complexDetails,
                generalArea: booking.generalArea,
                price: decimalFromMinor(booking.priceMinor),
                priceMinor: booking.priceMinor,
                countryCode: booking.countryCode,
                currency: booking.currency,
                customerLocation: { latitude, longitude },
                technicianId: booking.technicianId,
                technician: technicianUser ? {
                    id: String(booking.technicianId),
                    name: technicianUser.name,
                    phone: technicianUser.phone,
                    profilePhotoUrl: technicianUser.profilePhotoUrl || approvedTechnicianPhotoUrl || '',
                    lastLocation: technicianProfile?.lastLocation ? {
                        longitude: technicianProfile.lastLocation.coordinates[0],
                        latitude: technicianProfile.lastLocation.coordinates[1],
                    } : null,
                    lastGpsUpdate: technicianProfile?.updatedAt ?? null,
                } : null,
                createdAt: booking.createdAt,
                updatedAt: booking.updatedAt,
            },
        });
    }
    catch (error) {
        console.error('Failed to fetch active booking:', error);
        response.status(500).json({ message: 'Failed to fetch active booking' });
    }
};
exports.getMyActiveBooking = getMyActiveBooking;
const getMyBookingHistory = async (request, response) => {
    const authUser = getAuthenticatedUser(request);
    const customerId = String(authUser?.id ?? authUser?._id ?? '').trim();
    if (!customerId) {
        response.status(401).json({ message: 'Unauthorized. User context missing.' });
        return;
    }
    try {
        const bookings = await booking_model_1.default.find({
            customerId,
            $or: [
                {
                    status: {
                        $in: [
                            booking_model_1.BookingStatus.PENDING,
                            booking_model_1.BookingStatus.SCHEDULED,
                            booking_model_1.BookingStatus.ACCEPTED,
                            booking_model_1.BookingStatus.IN_ROUTE,
                            booking_model_1.BookingStatus.ARRIVED,
                            booking_model_1.BookingStatus.IN_PROGRESS,
                            booking_model_1.BookingStatus.DIAGNOSTIC_DONE,
                            booking_model_1.BookingStatus.COMPLETED,
                            booking_model_1.BookingStatus.CANCELLED,
                        ],
                    },
                },
                { 'dispatch.status': booking_model_1.BookingDispatchStatus.STANDBY },
            ],
        })
            .sort({ updatedAt: -1 })
            .limit(100)
            .lean();
        const bookingIds = bookings.map((booking) => booking._id);
        const invoices = await billing_model_1.Invoice.find({ bookingId: { $in: bookingIds } }).lean();
        const invoiceByBookingId = new Map(invoices.map((invoice) => [String(invoice.bookingId), invoice]));
        const technicianUserIds = Array.from(new Set(bookings
            .map((booking) => booking.technicianId)
            .filter((id) => Boolean(id && mongoose_1.default.Types.ObjectId.isValid(id)))
            .map((id) => id.toString())));
        const [technicianUsers, technicianProfiles] = await Promise.all([
            user_model_2.default.find({ _id: { $in: technicianUserIds } }).select('name phone profilePhotoUrl').lean(),
            technician_model_1.default.find({ userId: { $in: technicianUserIds } })
                .select('userId documents.profilePhotoUrl documents.profilePhotoStatus')
                .lean(),
        ]);
        const technicianUserById = new Map(technicianUsers.map((user) => [String(user._id), user]));
        const technicianProfileByUserId = new Map(technicianProfiles.map((profile) => [String(profile.userId), profile]));
        response.status(200).json({
            success: true,
            bookings: bookings.map((booking) => {
                const invoice = invoiceByBookingId.get(String(booking._id));
                const technicianUserId = booking.technicianId ? String(booking.technicianId) : '';
                const technicianUser = technicianUserById.get(technicianUserId);
                const technicianProfile = technicianProfileByUserId.get(technicianUserId);
                const approvedTechnicianPhotoUrl = technicianProfile?.documents?.profilePhotoStatus === technician_model_1.VerificationStatus.VERIFIED
                    ? technicianProfile.documents.profilePhotoUrl
                    : '';
                const invoicePriceBreakdown = invoice?.metadata?.priceBreakdown && typeof invoice.metadata.priceBreakdown === 'object'
                    ? invoice.metadata.priceBreakdown
                    : null;
                const invoicePromotion = invoice?.metadata?.promotion && typeof invoice.metadata.promotion === 'object'
                    ? invoice.metadata.promotion
                    : null;
                return {
                    id: String(booking._id),
                    serviceKey: String(booking.serviceKey || booking.metadata?.serviceKey || ''),
                    applianceType: booking.applianceType,
                    faultDescription: booking.faultDescription,
                    status: booking.status,
                    fullAddress: booking.fullAddress,
                    generalArea: booking.generalArea,
                    currency: booking.currency,
                    priceMinor: booking.priceMinor,
                    completedAt: booking.completedAt,
                    cancelledAt: booking.cancelledAt,
                    createdAt: booking.createdAt,
                    updatedAt: booking.updatedAt,
                    technician: technicianUser ? {
                        id: technicianUserId,
                        name: technicianUser.name,
                        phone: technicianUser.phone,
                        profilePhotoUrl: technicianUser.profilePhotoUrl || approvedTechnicianPhotoUrl || '',
                    } : null,
                    invoice: invoice ? {
                        id: String(invoice._id),
                        invoiceNumber: invoice.invoiceNumber,
                        baseAmountMinor: invoice.baseAmountMinor,
                        additionalLaborMinor: invoice.additionalLaborMinor,
                        partsAmountMinor: invoice.partsAmountMinor,
                        totalAmountMinor: invoice.totalAmountMinor,
                        promoDiscountMinor: typeof invoicePriceBreakdown?.promotionDiscountMinor === 'number'
                            ? invoicePriceBreakdown.promotionDiscountMinor
                            : typeof invoicePromotion?.discountMinor === 'number'
                                ? invoicePromotion.discountMinor
                                : 0,
                        promotion: invoicePromotion,
                        priceBreakdown: invoicePriceBreakdown,
                        status: invoice.status,
                    } : null,
                };
            }),
        });
    }
    catch (error) {
        console.error('Failed to fetch booking history:', error);
        response.status(500).json({ message: 'Failed to fetch booking history.' });
    }
};
exports.getMyBookingHistory = getMyBookingHistory;
const acceptBooking = async (request, response) => {
    const { id } = request.params;
    const body = request.body;
    const authUser = getAuthenticatedUser(request);
    const role = (0, user_model_1.normalizeUserRole)(authUser?.role);
    if (role !== user_model_1.UserRole.TECHNICIAN && role !== user_model_1.UserRole.ADMIN) {
        response.status(403).json({ message: 'Only technician or admin accounts can accept bookings.' });
        return;
    }
    const technicianId = role === user_model_1.UserRole.ADMIN && typeof body.technicianId === 'string' && body.technicianId.trim()
        ? body.technicianId.trim()
        : String(authUser?.id ?? authUser?._id ?? '').trim();
    if (!technicianId) {
        response.status(400).json({ message: 'Missing technician identity.' });
        return;
    }
    try {
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            response.status(400).json({ message: 'Invalid booking id.' });
            return;
        }
        if (!mongoose_1.default.Types.ObjectId.isValid(technicianId)) {
            response.status(400).json({ message: 'Invalid technician identity.' });
            return;
        }
        const existingBooking = await booking_model_1.default.findById(id)
            .select('status serviceKey applianceType generalArea metadata countryCode dispatch createdAt')
            .lean();
        if (!existingBooking) {
            response.status(404).json({ message: 'Booking not found' });
            return;
        }
        if (![booking_model_1.BookingStatus.PENDING, booking_model_1.BookingStatus.SCHEDULED].includes(existingBooking.status)) {
            response.status(409).json({ message: `Booking cannot be accepted from ${existingBooking.status} status.` });
            return;
        }
        const expiresAt = matching_service_1.default.getDispatchExpiry(existingBooking);
        if (existingBooking.dispatch?.status !== booking_model_1.BookingDispatchStatus.SCHEDULED && expiresAt.getTime() <= Date.now()) {
            await booking_model_1.default.updateOne({ _id: id, status: booking_model_1.BookingStatus.PENDING }, { $set: { 'dispatch.status': booking_model_1.BookingDispatchStatus.EXPIRED } });
            response.status(409).json({ message: 'Booking dispatch has expired.' });
            return;
        }
        const technician = mongoose_1.default.Types.ObjectId.isValid(technicianId)
            ? await technician_model_1.default.findOne({
                userId: new mongoose_1.default.Types.ObjectId(technicianId),
            })
                .select('_id approvalStatus documents.profilePhotoStatus')
                .lean()
            : null;
        console.log('[accept-debug] Evaluating booking claim conditions:', {
            bookingId: existingBooking._id,
            dispatchStatus: existingBooking.dispatch?.status,
            serviceKey: existingBooking.serviceKey,
            technicianUserId: authUser?.id ?? authUser?._id,
            technicianProfileId: technician?._id,
            profileStatus: technician?.approvalStatus,
        });
        const sentToTechnicians = existingBooking.dispatch?.sentToTechnicians ?? [];
        const isOpenPoolClaim = existingBooking.status === booking_model_1.BookingStatus.PENDING ||
            existingBooking.status === booking_model_1.BookingStatus.SCHEDULED ||
            existingBooking.dispatch?.status === booking_model_1.BookingDispatchStatus.STANDBY ||
            existingBooking.dispatch?.status === booking_model_1.BookingDispatchStatus.SCHEDULED ||
            String(existingBooking.dispatch?.status || '') === 'PENDING' ||
            sentToTechnicians.length === 0;
        const hasApprovedTechnicianProfile = technician?.approvalStatus === technician_model_1.TechnicianApprovalStatus.APPROVED &&
            technician.documents?.profilePhotoStatus === technician_model_1.VerificationStatus.VERIFIED;
        const canClaimOpenPool = isOpenPoolClaim && hasApprovedTechnicianProfile
            ? await canTechnicianClaimOpenBooking(technicianId, existingBooking)
            : false;
        const isEligible = role === user_model_1.UserRole.ADMIN ||
            (await matching_service_1.default.isTechnicianEligibleForBooking(technicianId, id)) ||
            canClaimOpenPool;
        if (!isEligible) {
            response.status(403).json({ message: 'This booking is not available to this technician.' });
            return;
        }
        const now = new Date();
        const acceptedByTechnician = new mongoose_1.default.Types.ObjectId(technicianId);
        const booking = await booking_model_1.default.findOneAndUpdate({
            _id: id,
            status: { $in: [booking_model_1.BookingStatus.PENDING, booking_model_1.BookingStatus.SCHEDULED] },
            $or: [
                { 'dispatch.status': booking_model_1.BookingDispatchStatus.SCHEDULED },
                { 'dispatch.expiresAt': { $gt: now } },
                { 'dispatch.expiresAt': { $exists: false }, createdAt: { $gte: new Date(now.getTime() - 30 * 60 * 1000) } },
            ],
        }, {
            $set: {
                technicianId: acceptedByTechnician,
                status: booking_model_1.BookingStatus.ACCEPTED,
                acceptedAt: now,
                'dispatch.status': booking_model_1.BookingDispatchStatus.ACCEPTED,
                'dispatch.acceptedByTechnician': acceptedByTechnician,
            },
        }, { new: true });
        if (!booking) {
            response.status(409).json({ message: 'Booking is no longer available.' });
            return;
        }
        await booking_model_1.default.updateOne({ _id: booking._id, 'dispatch.attempts.technicianId': acceptedByTechnician }, {
            $set: {
                'dispatch.attempts.$.status': 'ACCEPTED',
                'dispatch.attempts.$.respondedAt': now,
            },
        }).catch((error) => {
            console.warn('Failed to mark accepted dispatch attempt:', error);
        });
        const io = request.app.get('io');
        io?.to(`booking:${booking.id}`).emit('booking_assigned', {
            bookingId: booking.id,
            technicianId,
            status: booking.status,
            acceptedAt: booking.acceptedAt,
        });
        io?.to(`technician:${technicianId}`).emit('booking_accepted', {
            bookingId: booking.id,
            technicianId,
            status: booking.status,
            acceptedAt: booking.acceptedAt,
            booking: (0, booking_privacy_service_1.serializeBookingForAssignedTechnician)(booking),
        });
        const inboxMessages = await createCustomerBookingNotification(booking, 'TECHNICIAN_ACCEPTED', `${providerRoleForService(booking.serviceKey)} found`, `Your ${providerRoleForService(booking.serviceKey)} accepted the ${serviceLabelForNotification(booking)} request.`, { technicianId });
        inboxMessages.forEach((message) => {
            io?.to(`customer:${booking.customerId.toString()}`).emit('new_inbox_message', message);
        });
        const previouslySentTechnicianIds = (booking.dispatch?.sentToTechnicians || [])
            .map((targetId) => targetId.toString())
            .filter((targetId) => targetId !== technicianId);
        previouslySentTechnicianIds.forEach((targetId) => {
            io?.to(`technician:${targetId}`).emit('job_taken', {
                bookingId: booking.id,
                technicianId,
                status: booking.status,
            });
            io?.to(`technician:${targetId}`).emit('job_unavailable', {
                bookingId: booking.id,
                reason: 'accepted',
            });
        });
        await safelyLogAuditEvent(request, {
            action: 'booking.assigned',
            module: 'BOOKINGS',
            resourceType: 'Booking',
            resourceId: booking.id,
            metadata: {
                technicianId,
                status: booking.status,
            },
        });
        await safelyLogAuditEvent(request, {
            action: 'booking.precise_location.release',
            module: 'BOOKINGS',
            resourceType: 'Booking',
            resourceId: booking.id,
            metadata: {
                technicianId,
                releaseChannel: 'accept_booking_response',
            },
        });
        response.status(200).json({
            success: true,
            bookingId: booking.id,
            technicianId,
            status: booking.status,
            booking: (0, booking_privacy_service_1.serializeBookingForAssignedTechnician)(booking),
        });
    }
    catch (error) {
        console.error('Failed to accept booking:', error);
        response.status(500).json({ message: 'Failed to accept booking' });
    }
};
exports.acceptBooking = acceptBooking;
const declineBooking = async (request, response) => {
    const { id } = request.params;
    const authUser = getAuthenticatedUser(request);
    const role = (0, user_model_1.normalizeUserRole)(authUser?.role);
    const technicianId = String(authUser?.id ?? authUser?._id ?? '').trim();
    if (role !== user_model_1.UserRole.TECHNICIAN) {
        response.status(403).json({ message: 'Only technician accounts can decline bookings.' });
        return;
    }
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        response.status(400).json({ message: 'Invalid booking id.' });
        return;
    }
    if (!mongoose_1.default.Types.ObjectId.isValid(technicianId)) {
        response.status(400).json({ message: 'Invalid technician identity.' });
        return;
    }
    try {
        const technicianObjectId = new mongoose_1.default.Types.ObjectId(technicianId);
        const booking = await booking_model_1.default.findOneAndUpdate({ _id: id, status: booking_model_1.BookingStatus.PENDING }, {
            $set: {
                'dispatch.status': booking_model_1.BookingDispatchStatus.BROADCASTING,
            },
            $addToSet: {
                'dispatch.declinedByTechnicians': technicianObjectId,
            },
        }, { new: true });
        if (!booking) {
            response.status(404).json({ message: 'Pending booking not found.' });
            return;
        }
        await booking_model_1.default.updateOne({ _id: booking._id, 'dispatch.attempts.technicianId': technicianObjectId }, {
            $set: {
                'dispatch.attempts.$.status': 'DECLINED',
                'dispatch.attempts.$.respondedAt': new Date(),
            },
        }).catch((error) => {
            console.warn('Failed to mark declined dispatch attempt:', error);
        });
        const io = request.app.get('io');
        io?.to(`technician:${technicianId}`).emit('job_unavailable', {
            bookingId: booking.id,
            reason: 'declined',
        });
        response.status(200).json({
            success: true,
            bookingId: booking.id,
            status: booking.status,
        });
    }
    catch (error) {
        console.error('Failed to decline booking:', error);
        response.status(500).json({ message: 'Failed to decline booking' });
    }
};
exports.declineBooking = declineBooking;
const updateBookingStatus = async (request, response) => {
    const { id } = request.params;
    const body = request.body;
    const nextStatus = body.status;
    const authUser = getAuthenticatedUser(request);
    const role = (0, user_model_1.normalizeUserRole)(authUser?.role);
    if (!isBookingStatus(nextStatus)) {
        response.status(400).json({ message: 'Invalid booking status.' });
        return;
    }
    if ([booking_model_1.BookingStatus.ARRIVED, booking_model_1.BookingStatus.IN_PROGRESS, booking_model_1.BookingStatus.COMPLETED].includes(nextStatus)) {
        response.status(400).json({
            message: 'Use the dedicated booking workflow endpoint for this status transition.',
        });
        return;
    }
    try {
        let booking = await booking_model_1.default.findById(id);
        if (!booking) {
            response.status(404).json({ message: 'Booking not found' });
            return;
        }
        const before = {
            status: booking.status,
            completedAt: booking.completedAt,
        };
        booking = await (0, booking_workflow_service_1.transitionBookingStatus)({
            booking,
            actor: authUser,
            nextStatus,
            action: nextStatus === booking_model_1.BookingStatus.CANCELLED ? 'CANCEL_BOOKING' : 'START_ROUTE',
        });
        await (0, audit_service_1.logAuditEvent)(request, {
            action: 'booking.status.update',
            module: 'BOOKINGS',
            resourceType: 'Booking',
            resourceId: booking.id,
            changes: {
                before,
                after: {
                    status: booking.status,
                    completedAt: booking.completedAt,
                },
            },
            metadata: {
                requestedStatus: nextStatus,
                actorRole: role,
            },
        });
        const io = request.app.get('io');
        io?.to(`booking:${booking.id}`).emit('booking_status_changed', {
            bookingId: booking.id,
            status: booking.status,
            updatedAt: booking.updatedAt,
        });
        const statusNotificationMap = {
            [booking_model_1.BookingStatus.IN_ROUTE]: {
                type: 'TECHNICIAN_EN_ROUTE',
                title: `${providerRoleForService(booking.serviceKey)} on the way`,
                message: `Your ${providerRoleForService(booking.serviceKey)} is heading to your ${serviceLabelForNotification(booking)} job.`,
            },
            [booking_model_1.BookingStatus.ARRIVED]: {
                type: 'TECHNICIAN_ARRIVED',
                title: `${providerRoleForService(booking.serviceKey)} arrived`,
                message: `Your ${providerRoleForService(booking.serviceKey)} has arrived for ${serviceLabelForNotification(booking)}.`,
            },
            [booking_model_1.BookingStatus.IN_PROGRESS]: {
                type: 'JOB_STARTED',
                title: `${serviceLabelForNotification(booking)} in progress`,
                message: `Work has started on your ${serviceLabelForNotification(booking)} request.`,
            },
            [booking_model_1.BookingStatus.COMPLETED]: {
                type: 'BOOKING_COMPLETED',
                title: `${serviceLabelForNotification(booking)} completed`,
                message: `Your ${serviceLabelForNotification(booking)} job is complete. Please review the service.`,
            },
            [booking_model_1.BookingStatus.CANCELLED]: {
                type: 'BOOKING_CANCELLED',
                title: `${serviceLabelForNotification(booking)} cancelled`,
                message: `Your ${serviceLabelForNotification(booking)} request has been cancelled.`,
            },
        };
        const notification = statusNotificationMap[nextStatus];
        if (notification) {
            await createCustomerBookingNotification(booking, notification.type, notification.title, notification.message);
        }
        if (nextStatus === booking_model_1.BookingStatus.CANCELLED) {
            const snapshots = Array.isArray(booking.metadata?.promotions)
                ? booking.metadata.promotions
                : [];
            if (snapshots.length) {
                const redeemed = snapshots.some((promotion) => promotion.reservationStatus === 'REDEEMED' || promotion.redeemedAt);
                const nextPromotions = redeemed
                    ? await (0, promotion_campaign_service_1.reverseRedeemedPromotions)(snapshots, 'BOOKING_CANCELLED')
                    : await (0, promotion_campaign_service_1.releasePromotionReservations)(snapshots, 'BOOKING_CANCELLED');
                booking.set('metadata.promotions', nextPromotions);
                booking.set('metadata.promotion', nextPromotions[0] || null);
                await booking.save();
            }
            (booking.dispatch?.sentToTechnicians || []).forEach((targetId) => {
                io?.to(`technician:${targetId.toString()}`).emit('job_unavailable', {
                    bookingId: booking.id,
                    reason: 'cancelled',
                });
            });
        }
        if (nextStatus === booking_model_1.BookingStatus.ARRIVED && booking.technicianId) {
            io?.to(`technician:${booking.technicianId.toString()}`).emit('technician_arrived', {
                bookingId: booking.id,
                status: booking.status,
            });
        }
        response.status(200).json({
            success: true,
            bookingId: booking.id,
            status: booking.status,
        });
    }
    catch (error) {
        if (error instanceof booking_workflow_service_1.BookingWorkflowError) {
            response.status(error.statusCode).json({ message: error.message, code: error.code });
            return;
        }
        console.error('Failed to update booking status:', error);
        response.status(500).json({ message: 'Failed to update booking status' });
    }
};
exports.updateBookingStatus = updateBookingStatus;
const runWorkflowStatusAction = async (request, response, nextStatus, action) => {
    const bookingId = request.params.id ?? request.params.bookingId;
    try {
        let booking = await (0, booking_workflow_service_1.findBookingForWorkflow)(bookingId);
        const before = { status: booking.status, completedAt: booking.completedAt };
        booking = await (0, booking_workflow_service_1.transitionBookingStatus)({
            booking,
            actor: getAuthenticatedUser(request),
            nextStatus,
            action,
        });
        await (0, audit_service_1.logAuditEvent)(request, {
            action: action === 'START_ROUTE' ? 'booking.start_route' : 'booking.start_job',
            module: 'BOOKINGS',
            resourceType: 'Booking',
            resourceId: booking.id,
            changes: {
                before,
                after: { status: booking.status, completedAt: booking.completedAt },
            },
        });
        const io = request.app.get('io');
        io?.to(`booking:${booking.id}`).emit('booking_status_changed', {
            bookingId: booking.id,
            status: booking.status,
            updatedAt: booking.updatedAt,
        });
        if (nextStatus === booking_model_1.BookingStatus.IN_PROGRESS) {
            const providerRole = providerRoleForService(booking.serviceKey);
            await createCustomerBookingNotification(booking, 'JOB_STARTED', 'Job started', `Your ${providerRole} has started work on ${booking.applianceType}. Padi keeps approvals and payment steps together for this booking.`);
        }
        response.status(200).json({ success: true, bookingId: booking.id, status: booking.status });
    }
    catch (error) {
        if (error instanceof booking_workflow_service_1.BookingWorkflowError) {
            response.status(error.statusCode).json({ message: error.message, code: error.code });
            return;
        }
        console.error('Failed to run booking workflow action:', error);
        response.status(500).json({ message: 'Failed to update booking workflow.' });
    }
};
const startRoute = async (request, response) => {
    await runWorkflowStatusAction(request, response, booking_model_1.BookingStatus.IN_ROUTE, 'START_ROUTE');
};
exports.startRoute = startRoute;
const startJob = async (request, response) => {
    const bookingId = request.params.id ?? request.params.bookingId;
    try {
        let booking = await (0, booking_workflow_service_1.findBookingForWorkflow)(bookingId);
        const eligibility = await (0, inspection_workflow_service_1.evaluateWorkStartEligibility)(booking, getAuthenticatedUser(request));
        await (0, inspection_workflow_service_1.persistWorkStartEligibility)(booking, eligibility);
        if (!eligibility.allowed) {
            await (0, audit_service_1.logAuditEvent)(request, {
                action: 'booking.start_work.denied',
                module: 'BOOKINGS',
                resourceType: 'Booking',
                resourceId: booking.id,
                metadata: {
                    reasonCode: eligibility.reasonCode,
                    requirements: eligibility.requirements,
                },
                success: false,
            });
            const io = request.app.get('io');
            io?.to(`booking:${booking.id}`).emit('work_start_blocked', {
                bookingId: booking.id,
                reasonCode: eligibility.reasonCode,
                requirements: eligibility.requirements,
                updatedAt: new Date().toISOString(),
            });
            response.status(409).json({
                success: false,
                message: 'Work cannot begin until all Padi approval and payment requirements are satisfied.',
                code: eligibility.reasonCode,
                eligibility,
            });
            return;
        }
        const before = { status: booking.status, workStartedAt: booking.workStartedAt };
        booking = await (0, booking_workflow_service_1.transitionBookingStatus)({
            booking,
            actor: getAuthenticatedUser(request),
            nextStatus: booking_model_1.BookingStatus.IN_PROGRESS,
            action: 'START_JOB',
        });
        await (0, audit_service_1.logAuditEvent)(request, {
            action: 'booking.start_work.authorized',
            module: 'BOOKINGS',
            resourceType: 'Booking',
            resourceId: booking.id,
            changes: {
                before,
                after: { status: booking.status, workStartedAt: booking.workStartedAt },
            },
            metadata: {
                requirements: eligibility.requirements,
            },
        });
        const io = request.app.get('io');
        io?.to(`booking:${booking.id}`).emit('work_authorized', {
            bookingId: booking.id,
            status: booking.status,
            updatedAt: booking.updatedAt,
        });
        io?.to(`booking:${booking.id}`).emit('booking_status_changed', {
            bookingId: booking.id,
            status: booking.status,
            updatedAt: booking.updatedAt,
        });
        const providerRole = providerRoleForService(booking.serviceKey);
        await createCustomerBookingNotification(booking, 'JOB_STARTED', 'Job started', `Your ${providerRole} has started work on ${booking.applianceType}. Padi keeps approvals and payment steps together for this booking.`);
        response.status(200).json({ success: true, bookingId: booking.id, status: booking.status, eligibility });
    }
    catch (error) {
        if (error instanceof booking_workflow_service_1.BookingWorkflowError || error instanceof inspection_workflow_service_1.InspectionWorkflowError) {
            response.status(error.statusCode).json({ message: error.message, code: error.code });
            return;
        }
        console.error('Failed to start job:', error);
        response.status(500).json({ message: 'Failed to start job.' });
    }
};
exports.startJob = startJob;
const getInspectionReading = (body) => {
    const latitude = toFiniteNumber(body.latitude);
    const longitude = toFiniteNumber(body.longitude);
    const accuracyMeters = toFiniteNumber(body.accuracyMeters);
    const recordedAt = parseDateInput(body.recordedAt);
    if (latitude === null || longitude === null || accuracyMeters === null || !isValidDate(recordedAt)) {
        throw new inspection_workflow_service_1.InspectionWorkflowError('Valid latitude, longitude, accuracyMeters and recordedAt are required.', 'INVALID_INSPECTION_GPS');
    }
    return { latitude, longitude, accuracyMeters, recordedAt };
};
const startInspection = async (request, response) => {
    const { bookingId } = request.params;
    const body = request.body;
    try {
        const booking = await (0, inspection_workflow_service_1.startInspectionForBooking)(bookingId, getAuthenticatedUser(request), getInspectionReading(body), body.acknowledgePlatformRules === true);
        await (0, audit_service_1.logAuditEvent)(request, {
            action: 'booking.inspection.started',
            module: 'BOOKINGS',
            resourceType: 'Booking',
            resourceId: booking.id,
            metadata: { status: booking.inspection?.status },
        });
        const io = request.app.get('io');
        io?.to(`booking:${booking.id}`).emit('inspection_started', {
            bookingId: booking.id,
            inspection: booking.inspection,
            updatedAt: booking.updatedAt,
        });
        const providerRole = providerRoleForService(booking.serviceKey);
        await createCustomerBookingNotification(booking, 'INSPECTION_STARTED', 'Inspection started', `Your ${providerRole} has started inspection for ${booking.applianceType}. Padi keeps approvals and payment steps together for this booking.`);
        response.status(200).json({ success: true, bookingId: booking.id, inspection: booking.inspection });
    }
    catch (error) {
        if (error instanceof inspection_workflow_service_1.InspectionWorkflowError) {
            response.status(error.statusCode).json({ message: error.message, code: error.code });
            return;
        }
        console.error('Failed to start inspection:', error);
        response.status(500).json({ message: 'Failed to start inspection.' });
    }
};
exports.startInspection = startInspection;
const completeInspection = async (request, response) => {
    const { bookingId } = request.params;
    const body = request.body;
    try {
        const booking = await (0, inspection_workflow_service_1.completeInspectionForBooking)(bookingId, getAuthenticatedUser(request), {
            ...getInspectionReading(body),
            diagnosisNotes: typeof body.diagnosisNotes === 'string' ? body.diagnosisNotes : '',
            technicalObservations: typeof body.technicalObservations === 'string' ? body.technicalObservations : '',
            quoteRequired: body.quoteRequired === true,
            partsRequired: Array.isArray(body.partsRequired) ? body.partsRequired : [],
            evidenceMediaIds: Array.isArray(body.evidenceMediaIds) ? body.evidenceMediaIds.map(String) : [],
        });
        const eligibility = await (0, inspection_workflow_service_1.evaluateWorkStartEligibility)(booking, getAuthenticatedUser(request));
        await (0, inspection_workflow_service_1.persistWorkStartEligibility)(booking, eligibility);
        await (0, audit_service_1.logAuditEvent)(request, {
            action: 'booking.inspection.completed',
            module: 'BOOKINGS',
            resourceType: 'Booking',
            resourceId: booking.id,
            metadata: {
                quoteRequired: booking.inspection?.quoteRequired,
                partsCount: booking.inspection?.partsRequired?.length ?? 0,
                workAuthorization: eligibility.reasonCode,
            },
        });
        const io = request.app.get('io');
        io?.to(`booking:${booking.id}`).emit('inspection_completed', {
            bookingId: booking.id,
            inspection: booking.inspection,
            workAuthorization: eligibility,
            updatedAt: booking.updatedAt,
        });
        const providerRole = providerRoleForService(booking.serviceKey);
        await createCustomerBookingNotification(booking, 'INSPECTION_COMPLETED', 'Inspection completed', booking.inspection?.quoteRequired
            ? `Your ${providerRole} completed inspection and will send a quote for approval.`
            : `Your ${providerRole} completed inspection. Payment is required before work can begin.`);
        response.status(200).json({
            success: true,
            bookingId: booking.id,
            inspection: booking.inspection,
            workAuthorization: eligibility,
        });
    }
    catch (error) {
        if (error instanceof inspection_workflow_service_1.InspectionWorkflowError) {
            response.status(error.statusCode).json({ message: error.message, code: error.code });
            return;
        }
        console.error('Failed to complete inspection:', error);
        response.status(500).json({ message: 'Failed to complete inspection.' });
    }
};
exports.completeInspection = completeInspection;
const confirmArrival = async (request, response) => {
    const { bookingId } = request.params;
    const body = request.body;
    const latitude = toFiniteNumber(body.latitude);
    const longitude = toFiniteNumber(body.longitude);
    const accuracyMeters = toFiniteNumber(body.accuracyMeters);
    const recordedAt = parseDateInput(body.recordedAt);
    if (latitude === null || longitude === null || accuracyMeters === null || !isValidDate(recordedAt)) {
        response.status(400).json({ message: 'Valid latitude, longitude, accuracyMeters and recordedAt are required.' });
        return;
    }
    try {
        const io = request.app.get('io');
        const booking = await (0, booking_workflow_service_1.confirmBookingArrival)({
            bookingId,
            actor: getAuthenticatedUser(request),
            reading: { latitude, longitude, accuracyMeters, recordedAt },
            io,
        });
        const providerRole = providerRoleForService(booking.serviceKey);
        await createCustomerBookingNotification(booking, 'TECHNICIAN_ARRIVED', `${providerRole} has arrived`, `Your ${providerRole} has arrived for ${booking.applianceType}. Padi keeps job communication, approvals and payment steps together.`);
        response.status(200).json({
            success: true,
            bookingId: booking.id,
            status: booking.status,
            message: 'Arrival confirmed. Padi keeps job communication, approvals and payment steps together.',
        });
    }
    catch (error) {
        if (error instanceof booking_workflow_service_1.BookingWorkflowError) {
            response.status(error.statusCode).json({
                success: error.statusCode === 202,
                message: error.message,
                code: error.code,
            });
            return;
        }
        console.error('Failed to confirm arrival:', error);
        response.status(500).json({ message: 'Failed to confirm arrival.' });
    }
};
exports.confirmArrival = confirmArrival;
const finalizeJobInvoice = async (request, response) => {
    const body = request.body;
    const authUser = getAuthenticatedUser(request);
    const role = (0, user_model_1.normalizeUserRole)(authUser?.role);
    const userId = String(authUser?.id ?? authUser?._id ?? '');
    const bookingId = typeof body.bookingId === 'string' ? body.bookingId.trim() : '';
    const proofPhoto = typeof body.proofPhoto === 'string' ? body.proofPhoto.trim() : '';
    if (!bookingId) {
        response.status(400).json({ message: 'Missing require bookingId identity parameter' });
        return;
    }
    try {
        // 1. Find document inside MongoDB Atlas
        let booking = await booking_model_1.default.findById(bookingId);
        if (!booking) {
            response.status(404).json({ message: 'Booking entry record not found in system storage' });
            return;
        }
        const isAssignedTechnician = String(booking.technicianId || '') === userId;
        if (role !== user_model_1.UserRole.ADMIN && !isAssignedTechnician) {
            response.status(403).json({ message: 'Only the assigned technician or admin can finalize this job.' });
            return;
        }
        const approvedQuote = await quote_model_1.default.findOne({
            bookingId: booking._id,
            status: quote_model_1.QuoteStatus.APPROVED,
        }).sort({ approvedAt: -1 });
        const bookingPriceBreakdown = booking.metadata?.priceBreakdown && typeof booking.metadata.priceBreakdown === 'object'
            ? booking.metadata.priceBreakdown
            : null;
        const bookingCalloutMinor = typeof bookingPriceBreakdown?.calloutFeeMinor === 'number'
            ? Math.max(0, Math.round(bookingPriceBreakdown.calloutFeeMinor))
            : booking.priceMinor;
        const fallbackBaseAmount = toFiniteNumber(body.baseAmount) ?? decimalFromMinor(bookingCalloutMinor);
        const fallbackAdditionalLabor = toFiniteNumber(body.additionalLabor) ?? 0;
        const fallbackPartsAmount = toFiniteNumber(body.partsAmount) ?? 0;
        const baseAmount = approvedQuote
            ? approvedQuote.lineItems
                .filter((item) => item.type === quote_model_1.QuoteLineItemType.CALLOUT || item.type === quote_model_1.QuoteLineItemType.CALL_OUT)
                .reduce((sum, item) => sum + decimalFromMinor(item.totalAmountMinor), 0) || decimalFromMinor(booking.priceMinor)
            : fallbackBaseAmount;
        const additionalLabor = approvedQuote
            ? approvedQuote.lineItems
                .filter((item) => item.type === quote_model_1.QuoteLineItemType.LABOR ||
                item.type === quote_model_1.QuoteLineItemType.LABOUR ||
                item.type === quote_model_1.QuoteLineItemType.ADD_ON ||
                item.type === quote_model_1.QuoteLineItemType.SURCHARGE)
                .reduce((sum, item) => sum + decimalFromMinor(item.totalAmountMinor), 0)
            : fallbackAdditionalLabor;
        const partsAmount = approvedQuote
            ? approvedQuote.lineItems
                .filter((item) => item.type === quote_model_1.QuoteLineItemType.PART)
                .reduce((sum, item) => sum + decimalFromMinor(item.totalAmountMinor), 0)
            : fallbackPartsAmount;
        const totalAmount = approvedQuote
            ? decimalFromMinor(approvedQuote.totalAmountMinor)
            : toFiniteNumber(body.totalAmount) ?? (baseAmount + additionalLabor + partsAmount);
        const baseAmountMinor = (0, market_config_1.toMinorUnits)(baseAmount, booking.currency);
        const additionalLaborMinor = (0, market_config_1.toMinorUnits)(additionalLabor, booking.currency);
        const partsAmountMinor = (0, market_config_1.toMinorUnits)(partsAmount, booking.currency);
        const totalAmountMinor = (0, market_config_1.toMinorUnits)(totalAmount, booking.currency);
        const marketSetting = await market_setting_model_1.default.findOne({ 'identity.countryCode': booking.countryCode }).lean();
        const quotePriceBreakdown = approvedQuote?.metadata?.priceBreakdown && typeof approvedQuote.metadata.priceBreakdown === 'object'
            ? approvedQuote.metadata.priceBreakdown
            : null;
        const promotionSnapshot = booking.metadata?.promotion && typeof booking.metadata.promotion === 'object'
            ? booking.metadata.promotion
            : null;
        const promotionSnapshots = Array.isArray(booking.metadata?.promotions)
            ? booking.metadata.promotions
            : promotionSnapshot
                ? [promotionSnapshot]
                : [];
        const promoDiscountMinor = typeof promotionSnapshot?.discountMinor === 'number'
            ? Math.max(0, Math.round(promotionSnapshot.discountMinor))
            : typeof bookingPriceBreakdown?.promotionDiscountMinor === 'number'
                ? Math.max(0, Math.round(bookingPriceBreakdown.promotionDiscountMinor))
                : 0;
        const promoOriginalPriceMinor = typeof promotionSnapshot?.originalPriceMinor === 'number'
            ? Math.max(0, Math.round(promotionSnapshot.originalPriceMinor))
            : typeof bookingPriceBreakdown?.calloutFeeMinor === 'number'
                ? Math.max(0, Math.round(bookingPriceBreakdown.calloutFeeMinor))
                : baseAmountMinor;
        const applyBookingPromoToInvoice = promoDiscountMinor > 0 && !approvedQuote;
        const legacyPriceBreakdown = (0, price_breakdown_service_1.calculatePriceBreakdown)({
            currency: booking.currency,
            calloutFeeMinor: applyBookingPromoToInvoice ? promoOriginalPriceMinor : baseAmountMinor,
            labourMinor: additionalLaborMinor,
            partsMinor: partsAmountMinor,
            promotionDiscountMinor: applyBookingPromoToInvoice ? promoDiscountMinor : 0,
            otherDiscountMinor: 0,
            promotionFundingSource: typeof promotionSnapshot?.fundingSource === 'string' ? promotionSnapshot.fundingSource : 'PLATFORM',
            promotionTechnicianFundedMinor: applyBookingPromoToInvoice && promotionSnapshot?.fundingSplitBps && typeof promotionSnapshot.fundingSplitBps === 'object'
                ? Math.round((promoDiscountMinor * Number(promotionSnapshot.fundingSplitBps.technician || 0)) / 10000)
                : 0,
            promotionPartnerFundedMinor: applyBookingPromoToInvoice && promotionSnapshot?.fundingSplitBps && typeof promotionSnapshot.fundingSplitBps === 'object'
                ? Math.round((promoDiscountMinor * Number(promotionSnapshot.fundingSplitBps.partner || 0)) / 10000)
                : 0,
            marketPricing: {
                ...(marketSetting?.pricing || {}),
                platformCommissionBps: marketSetting?.pricing?.platformCommissionBps ?? 1500,
            },
        });
        const priceBreakdown = quotePriceBreakdown || (!approvedQuote && bookingPriceBreakdown && additionalLaborMinor === 0 && partsAmountMinor === 0
            ? bookingPriceBreakdown
            : legacyPriceBreakdown);
        const platformCommissionBps = Number.isFinite(Number(priceBreakdown.platformCommissionBps)) ? Number(priceBreakdown.platformCommissionBps) : 1500;
        const platformCommissionAmountMinor = Number.isFinite(Number(priceBreakdown.platformCommissionMinor)) ? Math.max(0, Math.round(Number(priceBreakdown.platformCommissionMinor))) : 0;
        const technicianNetAmountMinor = Number.isFinite(Number(priceBreakdown.technicianNetMinor)) ? Math.max(0, Math.round(Number(priceBreakdown.technicianNetMinor))) : 0;
        const invoiceTotalMinor = Number.isFinite(Number(priceBreakdown.totalMinor)) ? Math.max(0, Math.round(Number(priceBreakdown.totalMinor))) : totalAmountMinor;
        const platformCommissionAmount = (0, market_config_1.fromMinorUnits)(platformCommissionAmountMinor, booking.currency);
        const technicianNetAmount = (0, market_config_1.fromMinorUnits)(technicianNetAmountMinor, booking.currency);
        const beforeFinalization = {
            status: booking.status,
            completedAt: booking.completedAt,
            finalBilling: booking.finalBilling || null,
        };
        // 2. ASSIGN USING THE ENUM INSTEAD OF A RAW STRING LITERAL 🎯
        booking = await (0, booking_workflow_service_1.transitionBookingStatus)({
            booking,
            actor: authUser,
            nextStatus: booking_model_1.BookingStatus.COMPLETED,
            action: 'COMPLETE_JOB',
        });
        booking.set('finalBilling', {
            baseAmount: (0, market_config_1.fromMinorUnits)(applyBookingPromoToInvoice ? promoOriginalPriceMinor : baseAmountMinor, booking.currency),
            baseAmountMinor: applyBookingPromoToInvoice ? promoOriginalPriceMinor : baseAmountMinor,
            additionalLabor,
            additionalLaborMinor,
            partsAmount,
            partsAmountMinor,
            totalAmount: (0, market_config_1.fromMinorUnits)(invoiceTotalMinor, booking.currency),
            totalAmountMinor: invoiceTotalMinor,
            proofPhoto
        });
        await booking.save();
        let finalizedInvoiceNumber = '';
        let finalizedInvoiceId = '';
        if (mongoose_1.default.Types.ObjectId.isValid(booking.customerId) &&
            booking.technicianId &&
            mongoose_1.default.Types.ObjectId.isValid(booking.technicianId)) {
            const fallbackInvoiceNumber = `INV-PADI-${new Date().getFullYear()}-${booking.id.slice(-6).toUpperCase()}`;
            const existingInvoice = await billing_model_1.Invoice.findOne({ bookingId: booking._id });
            const successfulPayment = await payment_transaction_model_1.default.findOne({
                bookingId: booking._id,
                provider: payment_transaction_model_1.PaymentProvider.PAYSTACK,
                status: payment_transaction_model_1.PaymentTransactionStatus.SUCCESS,
            }).sort({ paidAt: -1, verifiedAt: -1, createdAt: -1 });
            const invoiceNumber = existingInvoice?.invoiceNumber || fallbackInvoiceNumber;
            const invoiceBefore = existingInvoice
                ? {
                    status: existingInvoice.status,
                    totalAmountMinor: existingInvoice.totalAmountMinor,
                    platformCommissionAmountMinor: existingInvoice.platformCommissionAmountMinor,
                    technicianNetAmountMinor: existingInvoice.technicianNetAmountMinor,
                }
                : null;
            const walletPendingDeltaMinor = existingInvoice
                ? technicianNetAmountMinor - existingInvoice.technicianNetAmountMinor
                : technicianNetAmountMinor;
            const redeemedPromotions = applyBookingPromoToInvoice
                ? await (0, promotion_campaign_service_1.redeemPromotions)(promotionSnapshots)
                : promotionSnapshots;
            const invoice = await billing_model_1.Invoice.findOneAndUpdate({ bookingId: booking._id }, {
                invoiceNumber,
                bookingId: booking._id,
                customerId: new mongoose_1.default.Types.ObjectId(booking.customerId),
                technicianId: new mongoose_1.default.Types.ObjectId(booking.technicianId),
                countryCode: booking.countryCode,
                currency: booking.currency,
                baseAmountMinor: applyBookingPromoToInvoice ? promoOriginalPriceMinor : baseAmountMinor,
                additionalLaborMinor,
                partsAmountMinor,
                totalAmountMinor: invoiceTotalMinor,
                platformCommissionBps,
                platformCommissionAmountMinor,
                technicianNetAmountMinor,
                status: successfulPayment ? billing_model_1.InvoiceStatus.PAID : billing_model_1.InvoiceStatus.UNPAID,
                paymentGateway: successfulPayment?.provider || existingInvoice?.paymentGateway || '',
                paymentReference: successfulPayment?.reference || existingInvoice?.paymentReference || '',
                paidAt: successfulPayment?.paidAt || successfulPayment?.verifiedAt || existingInvoice?.paidAt,
                metadata: {
                    ...(existingInvoice?.metadata || {}),
                    bookingId: booking.id,
                    market: {
                        countryCode: booking.countryCode,
                        currency: booking.currency,
                    },
                    service: {
                        serviceKey: booking.serviceKey || booking.metadata?.serviceKey || '',
                        subcategoryKey: booking.metadata?.subcategoryKey || '',
                        label: booking.applianceType,
                    },
                    promotion: redeemedPromotions[0] ? {
                        ...redeemedPromotions[0],
                        discountMinor: promoDiscountMinor,
                        appliedToInvoice: applyBookingPromoToInvoice,
                    } : null,
                    promotions: redeemedPromotions.map((promotion) => ({
                        ...promotion,
                        appliedToInvoice: applyBookingPromoToInvoice,
                    })),
                    priceBreakdown,
                    pricingRuleVersion: 'market-pricing-v1',
                },
            }, { upsert: true, new: true, setDefaultsOnInsert: true });
            finalizedInvoiceNumber = invoice.invoiceNumber;
            finalizedInvoiceId = invoice._id.toString();
            await (0, audit_service_1.logAuditEvent)(request, {
                action: existingInvoice ? 'invoice.update' : 'invoice.create',
                module: 'PAYMENTS',
                resourceType: 'Invoice',
                resourceId: invoice._id.toString(),
                changes: {
                    before: invoiceBefore,
                    after: {
                        status: invoice.status,
                        totalAmountMinor: invoice.totalAmountMinor,
                        platformCommissionAmountMinor: invoice.platformCommissionAmountMinor,
                        technicianNetAmountMinor: invoice.technicianNetAmountMinor,
                    },
                },
                metadata: {
                    bookingId: booking.id,
                    invoiceNumber,
                    currency: booking.currency,
                },
            });
            if (walletPendingDeltaMinor !== 0) {
                await billing_model_1.Wallet.findOneAndUpdate({ technicianId: new mongoose_1.default.Types.ObjectId(booking.technicianId) }, {
                    $setOnInsert: {
                        countryCode: booking.countryCode,
                        currency: booking.currency,
                        availableBalanceMinor: 0,
                        totalEarnedMinor: 0,
                        totalWithdrawnMinor: 0,
                    },
                    $inc: {
                        pendingBalanceMinor: walletPendingDeltaMinor,
                    },
                    $set: {
                        lastTransactionAt: new Date(),
                    },
                }, { upsert: true, new: true, setDefaultsOnInsert: true });
            }
            const ledgerBase = {
                bookingId: booking._id,
                invoiceId: invoice._id,
                customerId: new mongoose_1.default.Types.ObjectId(booking.customerId),
                technicianId: new mongoose_1.default.Types.ObjectId(booking.technicianId),
                countryCode: booking.countryCode,
                currency: booking.currency,
                metadata: { quoteId: approvedQuote?.id ?? null },
            };
            if (!existingInvoice) {
                await billing_model_1.WalletTransaction.create([
                    {
                        ...ledgerBase,
                        type: billing_model_1.WalletTransactionType.CLIENT_PAYMENT,
                        status: billing_model_1.WalletTransactionStatus.PENDING,
                        amountMinor: invoiceTotalMinor,
                        description: 'Client payment due for completed job',
                    },
                    {
                        ...ledgerBase,
                        type: billing_model_1.WalletTransactionType.PLATFORM_COMMISSION,
                        status: billing_model_1.WalletTransactionStatus.POSTED,
                        amountMinor: platformCommissionAmountMinor,
                        description: `MyFixer platform commission (${platformCommissionBps / 100}%)`,
                    },
                    {
                        ...ledgerBase,
                        type: billing_model_1.WalletTransactionType.TECHNICIAN_EARNING_PENDING,
                        status: billing_model_1.WalletTransactionStatus.POSTED,
                        amountMinor: technicianNetAmountMinor,
                        description: 'Technician net earning pending release',
                    },
                ]);
            }
            else if (walletPendingDeltaMinor !== 0) {
                await billing_model_1.WalletTransaction.create({
                    ...ledgerBase,
                    type: billing_model_1.WalletTransactionType.ADJUSTMENT,
                    status: billing_model_1.WalletTransactionStatus.POSTED,
                    amountMinor: walletPendingDeltaMinor,
                    description: 'Invoice adjustment delta after refinalization',
                });
            }
        }
        else {
            console.warn(`Skipped invoice/wallet linkage for booking ${bookingId}; customer or technician id is not a Mongo ObjectId.`);
        }
        const io = request.app.get('io');
        io?.to(`booking:${booking.id}`).emit('booking_status_changed', {
            bookingId: booking.id,
            status: booking.status,
            updatedAt: booking.updatedAt,
        });
        const invoiceInboxMessages = await createCustomerBookingNotification(booking, 'INVOICE_GENERATED', 'Invoice generated', `Your invoice for ${booking.applianceType} has been generated.`, {
            feed: 'inbox',
            documentType: 'INVOICE',
            invoiceId: finalizedInvoiceId,
            invoiceNumber: finalizedInvoiceNumber,
            totalAmountMinor: invoiceTotalMinor,
            currency: booking.currency,
        });
        invoiceInboxMessages.forEach((message) => {
            io?.to(`customer:${booking.customerId.toString()}`).emit('new_inbox_message', message);
        });
        if (booking.technicianId) {
            io?.to(`technician:${booking.technicianId.toString()}`).emit('payment_confirmed', {
                bookingId: booking.id,
                totalAmountMinor: invoiceTotalMinor,
                currency: booking.currency,
            });
        }
        // 3. Trigger your Resend Email Worker pipeline
        const recipientEmail = booking.customerEmail || 'admin@myfixer.co.za';
        // The compiler can now resolve 'EmailService' cleanly 📬
        const emailSent = await email_service_1.EmailService.sendJobInvoiceEmail({
            recipientEmail,
            customerName: booking.customerName || 'Client',
            bookingId,
            baseAmount,
            additionalLabor,
            partsAmount,
            totalAmount: (0, market_config_1.fromMinorUnits)(invoiceTotalMinor, booking.currency),
            discountAmount: (0, market_config_1.fromMinorUnits)(applyBookingPromoToInvoice ? promoDiscountMinor : 0, booking.currency),
            promoCode: typeof promotionSnapshot?.code === 'string' ? promotionSnapshot.code : '',
            promotionLabel: typeof promotionSnapshot?.campaignName === 'string'
                ? promotionSnapshot.campaignName
                : typeof promotionSnapshot?.code === 'string'
                    ? `Promotion - ${promotionSnapshot.code}`
                    : applyBookingPromoToInvoice && promoDiscountMinor > 0
                        ? 'Promotion'
                        : '',
            subtotalAmount: typeof priceBreakdown.subtotalMinor === 'number'
                ? (0, market_config_1.fromMinorUnits)(priceBreakdown.subtotalMinor, booking.currency)
                : undefined,
            clientServiceFee: typeof priceBreakdown.clientServiceFeeMinor === 'number'
                ? (0, market_config_1.fromMinorUnits)(priceBreakdown.clientServiceFeeMinor, booking.currency)
                : 0,
            taxAmount: typeof priceBreakdown.taxMinor === 'number'
                ? (0, market_config_1.fromMinorUnits)(priceBreakdown.taxMinor, booking.currency)
                : 0,
            currency: booking.currency
        });
        if (!emailSent) {
            console.warn(`⚠️ Invoice database updated, but transaction verification email failed to dispatch via Resend`);
        }
        await (0, audit_service_1.logAuditEvent)(request, {
            action: 'booking.finalize_invoice',
            module: 'BOOKINGS',
            resourceType: 'Booking',
            resourceId: booking.id,
            changes: {
                before: beforeFinalization,
                after: {
                    status: booking.status,
                    completedAt: booking.completedAt,
                    finalBilling: booking.finalBilling || null,
                },
            },
            metadata: {
                totalAmountMinor: invoiceTotalMinor,
                platformCommissionAmountMinor,
                technicianNetAmountMinor,
                emailSent,
            },
        });
        response.status(200).json({
            success: true,
            message: 'Job finalized, financial matrices captured, and invoice dispatched successfully.',
            bookingId
        });
    }
    catch (error) {
        if (error instanceof booking_workflow_service_1.BookingWorkflowError) {
            response.status(error.statusCode).json({ message: error.message, code: error.code });
            return;
        }
        console.error('Failed to settle final billing operations endpoint run:', error);
        response.status(500).json({ message: 'Failed to process job closure accounting entries' });
    }
};
exports.finalizeJobInvoice = finalizeJobInvoice;
//# sourceMappingURL=booking.controller.js.map