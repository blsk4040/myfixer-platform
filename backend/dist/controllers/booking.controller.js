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
exports.finalizeJobInvoice = exports.updateBookingStatus = exports.declineBooking = exports.acceptBooking = exports.getMyBookingHistory = exports.getMyActiveBooking = exports.getBookingById = exports.createBooking = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
// 1. IMPORT BookingStatus ENUM HERE
const booking_model_1 = __importStar(require("../models/booking.model"));
const matching_service_1 = __importStar(require("../services/matching.service"));
// 2. UNCOMMENT AND USE YOUR ACTUAL EMAIL SERVICE UTILITY
const email_service_1 = require("../services/email/email.service");
const billing_model_1 = require("../models/billing.model");
const user_model_1 = require("../models/user.model");
const user_model_2 = __importDefault(require("../models/user.model"));
const quote_model_1 = __importStar(require("../models/quote.model"));
const technician_model_1 = __importStar(require("../models/technician.model"));
const technician_capability_model_1 = __importStar(require("../models/technician-capability.model"));
const service_waitlist_model_1 = __importStar(require("../models/service-waitlist.model"));
const market_setting_model_1 = __importStar(require("../models/market-setting.model"));
const audit_service_1 = require("../services/audit.service");
const market_config_1 = require("../config/market.config");
const service_availability_service_1 = require("../services/service-availability.service");
const notification_service_1 = require("../services/notification.service");
const notification_model_1 = require("../models/notification.model");
const toFiniteNumber = (value) => {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};
const decimalFromMinor = (valueMinor) => valueMinor / 100;
const isBookingStatus = (value) => typeof value === 'string' && Object.values(booking_model_1.BookingStatus).includes(value);
const normalizeFallbackPreference = (value) => {
    const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
    return normalized === 'SCHEDULED' || normalized === 'WAITLIST' ? normalized : 'STANDBY';
};
const parseDateInput = (value) => typeof value === 'string' || value instanceof Date ? new Date(value) : null;
const isValidDate = (value) => Boolean(value && !Number.isNaN(value.getTime()));
const isMarketServiceExplicitlyActive = async (countryCode, serviceKey) => {
    const setting = await market_setting_model_1.default.findOne({ 'identity.countryCode': countryCode })
        .select('identity.countryCode coverage.serviceCategories coverage.cityServiceAvailability')
        .lean();
    if (!setting)
        return false;
    const normalizeEntry = (entry) => {
        if (typeof entry === 'string') {
            return { serviceKey: (0, matching_service_1.normalizeDispatchServiceKey)(entry), status: market_setting_model_1.MarketStatus.ACTIVE };
        }
        if (!entry || typeof entry !== 'object')
            return null;
        const record = entry;
        return {
            serviceKey: (0, matching_service_1.normalizeDispatchServiceKey)(record.serviceKey ?? record.key ?? record.value ?? record.label),
            status: Object.values(market_setting_model_1.MarketStatus).includes(record.status)
                ? record.status
                : market_setting_model_1.MarketStatus.DISABLED,
        };
    };
    const matches = [
        ...((setting.coverage?.serviceCategories || []).map(normalizeEntry)),
        ...((setting.coverage?.cityServiceAvailability || []).flatMap((city) => {
            const record = city;
            const services = Array.isArray(record.services) ? record.services : [];
            const areas = Array.isArray(record.areas) ? record.areas : [];
            return [
                ...services.map(normalizeEntry),
                ...areas.flatMap((area) => {
                    const areaRecord = area;
                    return Array.isArray(areaRecord.services) ? areaRecord.services.map(normalizeEntry) : [];
                }),
            ];
        })),
    ].filter((entry) => Boolean(entry?.serviceKey));
    return matches.some((entry) => entry.serviceKey === serviceKey && entry.status === market_setting_model_1.MarketStatus.ACTIVE);
};
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
const buildIncomingRequestPayload = (booking) => {
    const [longitude, latitude] = booking.customerLocation.coordinates;
    const bookingId = typeof booking.id === 'string' && booking.id
        ? booking.id
        : String(booking._id ?? '');
    return {
        bookingId,
        customerId: String(booking.customerId),
        customerName: booking.customerName,
        serviceKey: booking.serviceKey,
        applianceType: booking.applianceType,
        faultDescription: booking.faultDescription,
        priceMinor: booking.priceMinor,
        callOutFee: decimalFromMinor(booking.priceMinor),
        distance: 'Nearby',
        generalArea: booking.generalArea,
        fullAddress: booking.fullAddress,
        complexDetails: booking.complexDetails || '',
        latitude,
        longitude,
        countryCode: booking.countryCode,
        currency: booking.currency,
    };
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
        .select('_id countryCode serviceCategories')
        .lean();
    if (!technician)
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
    const fallbackPreference = normalizeFallbackPreference(body.fallbackPreference ?? body.fallback_preference);
    const scheduledAtInput = body.scheduledStartTime ?? body.scheduled_start_time ?? body.scheduledAt ?? body.scheduled_at;
    const scheduledAt = parseDateInput(scheduledAtInput);
    const scheduledEndAt = parseDateInput(body.scheduledEndTime ?? body.scheduled_end_time);
    const isPreBook = isValidDate(scheduledAt) && scheduledAt.getTime() > Date.now();
    const latitude = toFiniteNumber(body.latitude);
    const longitude = toFiniteNumber(body.longitude);
    let countryCode = market_config_1.CountryCode.ZA;
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
    const market = (0, market_config_1.getMarketByCountry)(countryCode);
    const callOutFee = toFiniteNumber(body.call_out_fee) ?? market.defaultCalloutFee;
    const priceMinor = (0, market_config_1.toMinorUnits)(callOutFee, market.currency);
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
    });
    if (!availability.allowed) {
        response.status(409).json({
            message: availability.message || 'This service is not available in your selected location.',
            serviceStatus: availability.service?.status,
            serviceKey: requestedServiceKey,
        });
        return;
    }
    const explicitlyActive = await isMarketServiceExplicitlyActive(market.countryCode, requestedServiceKey);
    if (!explicitlyActive) {
        response.status(409).json({
            message: 'This service is not active in the selected market coverage settings.',
            serviceStatus: market_setting_model_1.MarketStatus.DISABLED,
            serviceKey: requestedServiceKey,
        });
        return;
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
            status: isPreBook ? booking_model_1.BookingStatus.SCHEDULED : booking_model_1.BookingStatus.PENDING,
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
                fallbackPreference,
                scheduledAt: isValidDate(scheduledAt) ? scheduledAt : null,
            },
            priceMinor,
            countryCode: market.countryCode,
            currency: market.currency,
            dispatch: {
                status: isPreBook ? booking_model_1.BookingDispatchStatus.SCHEDULED : booking_model_1.BookingDispatchStatus.BROADCASTING,
                expiresAt: isPreBook ? null : matching_service_1.default.getDispatchExpiry({ createdAt: new Date() }),
                sentToTechnicians: [],
                declinedByTechnicians: [],
            },
        });
        const bookingId = booking.id;
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
        await createCustomerBookingNotification(booking, 'BOOKING_CREATED', 'Booking request created', `Your ${applianceType} request has been created and is being sent to available technicians.`);
        // 2. Broadcast the open request to every eligible online approved technician.
        const eligibleTechnicianIds = fallbackPreference === 'SCHEDULED' || isPreBook
            ? []
            : await matching_service_1.default.findEligibleOnlineTechniciansForBooking(bookingId);
        console.info('[dispatch-test] findEligibleTechniciansWithTelemetryPipeline output', {
            bookingId,
            serviceKey: requestedServiceKey,
            customerCoordinates: [longitude, latitude],
            eligibleTechnicianIds,
            matchedCount: eligibleTechnicianIds.length,
        });
        if (eligibleTechnicianIds.length > 0) {
            booking.dispatch = {
                ...(booking.dispatch ?? {
                    status: booking_model_1.BookingDispatchStatus.BROADCASTING,
                    expiresAt: matching_service_1.default.getDispatchExpiry(booking),
                    sentToTechnicians: [],
                    declinedByTechnicians: [],
                }),
                sentToTechnicians: eligibleTechnicianIds.map((technicianId) => new mongoose_1.default.Types.ObjectId(technicianId)),
            };
            await booking.save();
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
            }
        }
        // 3. Formulate the precise JSON parameters expected by DashboardScreen.tsx
        const incomingRequestPayload = buildIncomingRequestPayload(booking);
        const io = request.app.get('io');
        if (io) {
            await Promise.all(eligibleTechnicianIds.map((technicianId) => emitIncomingRequest(io, technicianId, incomingRequestPayload)));
            await Promise.all(eligibleTechnicianIds.map((technicianId) => createTechnicianJobNotification(technicianId, booking)));
            await Promise.all(eligibleTechnicianIds.map(async (technicianId) => {
                const jobs = await matching_service_1.default.findNearbyPendingBookingsForTechnician(technicianId);
                io.to(`technician:${technicianId}`).emit('available_jobs', jobs.map((job) => ({
                    bookingId: job.id,
                    applianceType: job.applianceType,
                    faultDescription: job.faultDescription,
                    fullAddress: job.fullAddress,
                    complexDetails: job.complexDetails,
                    generalArea: job.generalArea,
                    priceMinor: job.priceMinor,
                    currency: job.currency,
                    countryCode: job.countryCode,
                    latitude: job.latitude,
                    longitude: job.longitude,
                    distanceKm: job.distanceKm,
                    distanceText: `${job.distanceKm.toFixed(1)} km`,
                    categoryMatch: job.categoryMatch,
                })));
            }));
        }
        else {
            console.warn('Socket.io server instance unavailable; skipped technician broadcasts');
        }
        response.status(201).json({
            success: true,
            bookingId,
            fallbackPreference,
            dispatchStatus: booking.dispatch?.status,
            notifiedTechnicianIds: eligibleTechnicianIds
        });
    }
    catch (error) {
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
    try {
        const booking = await booking_model_1.default.findById(id);
        if (!booking) {
            response.status(404).json({ message: 'Booking not found' });
            return;
        }
        const [longitude, latitude] = booking.customerLocation.coordinates;
        const technicianUser = booking.technicianId && mongoose_1.default.Types.ObjectId.isValid(booking.technicianId)
            ? await user_model_2.default.findById(booking.technicianId).select('name phone profilePhotoUrl').lean()
            : null;
        const technicianProfile = booking.technicianId && mongoose_1.default.Types.ObjectId.isValid(booking.technicianId)
            ? await technician_model_1.default.findOne({ userId: booking.technicianId }).select('lastLocation documents.profilePhotoUrl updatedAt').lean()
            : null;
        response.status(200).json({
            id: booking.id,
            status: booking.status,
            customerId: booking.customerId,
            customerName: booking.customerName,
            applianceType: booking.applianceType,
            faultDescription: booking.faultDescription,
            fullAddress: booking.fullAddress,
            complexDetails: booking.complexDetails,
            generalArea: booking.generalArea,
            price: decimalFromMinor(booking.priceMinor),
            priceMinor: booking.priceMinor,
            countryCode: booking.countryCode,
            currency: booking.currency,
            customerLocation: {
                latitude,
                longitude,
            },
            technicianId: booking.technicianId,
            technician: technicianUser ? {
                id: String(booking.technicianId),
                name: technicianUser.name,
                phone: technicianUser.phone,
                profilePhotoUrl: technicianUser.profilePhotoUrl || technicianProfile?.documents?.profilePhotoUrl || '',
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
            ? await technician_model_1.default.findOne({ userId: booking.technicianId }).select('lastLocation documents.profilePhotoUrl updatedAt').lean()
            : null;
        response.status(200).json({
            active: true,
            booking: {
                id: booking.id,
                status: booking.status,
                customerId: booking.customerId,
                customerName: booking.customerName,
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
                    profilePhotoUrl: technicianUser.profilePhotoUrl || technicianProfile?.documents?.profilePhotoUrl || '',
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
        response.status(200).json({
            success: true,
            bookings: bookings.map((booking) => {
                const invoice = invoiceByBookingId.get(String(booking._id));
                return {
                    id: String(booking._id),
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
                    invoice: invoice ? {
                        id: String(invoice._id),
                        invoiceNumber: invoice.invoiceNumber,
                        baseAmountMinor: invoice.baseAmountMinor,
                        additionalLaborMinor: invoice.additionalLaborMinor,
                        partsAmountMinor: invoice.partsAmountMinor,
                        totalAmountMinor: invoice.totalAmountMinor,
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
                .select('_id approvalStatus')
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
        const hasApprovedTechnicianProfile = technician?.approvalStatus === technician_model_1.TechnicianApprovalStatus.APPROVED;
        const isEligible = role === user_model_1.UserRole.ADMIN ||
            (await matching_service_1.default.isTechnicianEligibleForBooking(technicianId, id)) ||
            (isOpenPoolClaim && hasApprovedTechnicianProfile);
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
        });
        const inboxMessages = await createCustomerBookingNotification(booking, 'TECHNICIAN_ACCEPTED', 'Technician accepted your request', `A technician has accepted your ${booking.applianceType} request.`, { technicianId });
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
        response.status(200).json({
            success: true,
            bookingId: booking.id,
            technicianId,
            status: booking.status,
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
    try {
        const booking = await booking_model_1.default.findById(id);
        if (!booking) {
            response.status(404).json({ message: 'Booking not found' });
            return;
        }
        const userId = String(authUser?.id ?? authUser?._id ?? '');
        const isAssignedTechnician = String(booking.technicianId || '') === userId;
        const isCustomer = String(booking.customerId) === userId;
        const isAdmin = role === user_model_1.UserRole.ADMIN;
        if (!isAdmin && !isAssignedTechnician && !(isCustomer && nextStatus === booking_model_1.BookingStatus.CANCELLED)) {
            response.status(403).json({ message: 'This account cannot update this booking.' });
            return;
        }
        const before = {
            status: booking.status,
            completedAt: booking.completedAt,
        };
        booking.status = nextStatus;
        if (nextStatus === booking_model_1.BookingStatus.COMPLETED)
            booking.completedAt = new Date();
        if (nextStatus === booking_model_1.BookingStatus.IN_ROUTE)
            booking.inRouteAt = new Date();
        if (nextStatus === booking_model_1.BookingStatus.ARRIVED)
            booking.arrivedAt = new Date();
        if (nextStatus === booking_model_1.BookingStatus.DIAGNOSTIC_DONE)
            booking.diagnosticDoneAt = new Date();
        if (nextStatus === booking_model_1.BookingStatus.CANCELLED) {
            booking.cancelledAt = new Date();
            booking.dispatch = {
                ...(booking.dispatch ?? {
                    status: booking_model_1.BookingDispatchStatus.CANCELLED,
                    sentToTechnicians: [],
                    declinedByTechnicians: [],
                }),
                status: booking_model_1.BookingDispatchStatus.CANCELLED,
            };
        }
        await booking.save();
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
                title: 'Technician is on the way',
                message: `Your technician is on the way for ${booking.applianceType}.`,
            },
            [booking_model_1.BookingStatus.ARRIVED]: {
                type: 'TECHNICIAN_ARRIVED',
                title: 'Technician has arrived',
                message: `Your technician has arrived for ${booking.applianceType}.`,
            },
            [booking_model_1.BookingStatus.COMPLETED]: {
                type: 'BOOKING_COMPLETED',
                title: 'Booking completed',
                message: `Your ${booking.applianceType} booking has been completed.`,
            },
            [booking_model_1.BookingStatus.CANCELLED]: {
                type: 'BOOKING_CANCELLED',
                title: 'Booking cancelled',
                message: `Your ${booking.applianceType} booking has been cancelled.`,
            },
        };
        const notification = statusNotificationMap[nextStatus];
        if (notification) {
            await createCustomerBookingNotification(booking, notification.type, notification.title, notification.message);
        }
        if (nextStatus === booking_model_1.BookingStatus.CANCELLED) {
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
        console.error('Failed to update booking status:', error);
        response.status(500).json({ message: 'Failed to update booking status' });
    }
};
exports.updateBookingStatus = updateBookingStatus;
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
        const booking = await booking_model_1.default.findById(bookingId);
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
        const fallbackBaseAmount = toFiniteNumber(body.baseAmount) ?? decimalFromMinor(booking.priceMinor);
        const fallbackAdditionalLabor = toFiniteNumber(body.additionalLabor) ?? 0;
        const fallbackPartsAmount = toFiniteNumber(body.partsAmount) ?? 0;
        const baseAmount = approvedQuote
            ? approvedQuote.lineItems
                .filter((item) => item.type === quote_model_1.QuoteLineItemType.CALLOUT)
                .reduce((sum, item) => sum + decimalFromMinor(item.totalAmountMinor), 0) || decimalFromMinor(booking.priceMinor)
            : fallbackBaseAmount;
        const additionalLabor = approvedQuote
            ? approvedQuote.lineItems
                .filter((item) => item.type === quote_model_1.QuoteLineItemType.LABOR || item.type === quote_model_1.QuoteLineItemType.ADD_ON || item.type === quote_model_1.QuoteLineItemType.SURCHARGE)
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
        const market = (0, market_config_1.getMarketByCountry)(booking.countryCode);
        const platformCommissionBps = market.platformCommissionBps;
        const platformCommissionAmountMinor = Math.round((totalAmountMinor * platformCommissionBps) / 10000);
        const technicianNetAmountMinor = Math.max(totalAmountMinor - platformCommissionAmountMinor, 0);
        const platformCommissionAmount = (0, market_config_1.fromMinorUnits)(platformCommissionAmountMinor, booking.currency);
        const technicianNetAmount = (0, market_config_1.fromMinorUnits)(technicianNetAmountMinor, booking.currency);
        const beforeFinalization = {
            status: booking.status,
            completedAt: booking.completedAt,
            finalBilling: booking.finalBilling || null,
        };
        // 2. ASSIGN USING THE ENUM INSTEAD OF A RAW STRING LITERAL 🎯
        booking.status = booking_model_1.BookingStatus.COMPLETED;
        booking.completedAt = new Date();
        booking.set('finalBilling', {
            baseAmount,
            baseAmountMinor,
            additionalLabor,
            additionalLaborMinor,
            partsAmount,
            partsAmountMinor,
            totalAmount,
            totalAmountMinor,
            proofPhoto
        });
        await booking.save();
        if (mongoose_1.default.Types.ObjectId.isValid(booking.customerId) &&
            booking.technicianId &&
            mongoose_1.default.Types.ObjectId.isValid(booking.technicianId)) {
            const invoiceNumber = `INV-${new Date().getFullYear()}-${booking.id.slice(-6).toUpperCase()}`;
            const existingInvoice = await billing_model_1.Invoice.findOne({ bookingId: booking._id });
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
            const invoice = await billing_model_1.Invoice.findOneAndUpdate({ bookingId: booking._id }, {
                invoiceNumber,
                bookingId: booking._id,
                customerId: new mongoose_1.default.Types.ObjectId(booking.customerId),
                technicianId: new mongoose_1.default.Types.ObjectId(booking.technicianId),
                countryCode: booking.countryCode,
                currency: booking.currency,
                baseAmountMinor,
                additionalLaborMinor,
                partsAmountMinor,
                totalAmountMinor,
                platformCommissionBps,
                platformCommissionAmountMinor,
                technicianNetAmountMinor,
                status: billing_model_1.InvoiceStatus.UNPAID,
            }, { upsert: true, new: true, setDefaultsOnInsert: true });
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
                        amountMinor: totalAmountMinor,
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
        const invoiceInboxMessages = await createCustomerBookingNotification(booking, 'INVOICE_GENERATED', 'Invoice generated', `Your invoice for ${booking.applianceType} has been generated.`, { totalAmountMinor, currency: booking.currency });
        invoiceInboxMessages.forEach((message) => {
            io?.to(`customer:${booking.customerId.toString()}`).emit('new_inbox_message', message);
        });
        if (booking.technicianId) {
            io?.to(`technician:${booking.technicianId.toString()}`).emit('payment_confirmed', {
                bookingId: booking.id,
                totalAmountMinor,
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
            totalAmount,
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
                totalAmountMinor,
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
        console.error('Failed to settle final billing operations endpoint run:', error);
        response.status(500).json({ message: 'Failed to process job closure accounting entries' });
    }
};
exports.finalizeJobInvoice = finalizeJobInvoice;
//# sourceMappingURL=booking.controller.js.map