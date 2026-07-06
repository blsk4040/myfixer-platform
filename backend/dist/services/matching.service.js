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
exports.normalizeDispatchServiceKey = void 0;
// src/services/matching.service.ts
const mongoose_1 = __importDefault(require("mongoose"));
const technician_model_1 = __importStar(require("../models/technician.model"));
const booking_model_1 = __importStar(require("../models/booking.model"));
const technician_capability_model_1 = __importStar(require("../models/technician-capability.model"));
const technician_telemetry_model_1 = __importDefault(require("../models/technician-telemetry.model"));
const service_availability_service_1 = require("./service-availability.service");
const EARTH_RADIUS_KM = 6371;
const DISPATCH_TIMEOUT_MINUTES = 30;
const DISPATCH_TIMEOUT_MS = DISPATCH_TIMEOUT_MINUTES * 60 * 1000;
const LOCAL_TEST_MIN_RADIUS_KM = 50;
const DEFAULT_SERVICE_RADIUS_KM = 25;
const LIVE_DISPATCH_STATUSES = [booking_model_1.BookingDispatchStatus.BROADCASTING, booking_model_1.BookingDispatchStatus.STANDBY];
const STANDBY_EXPIRY_MS = 15 * 60 * 1000;
const toRadians = (degrees) => (degrees * Math.PI) / 180;
const getDistanceKm = (lat1, lon1, lat2, lon2) => {
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(lat1)) *
            Math.cos(toRadians(lat2)) *
            Math.sin(dLon / 2) ** 2;
    return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
const isDebug = () => process.env.NODE_ENV !== 'production' || process.env.SOCKET_DEBUG === 'true';
const normalizeDispatchServiceKey = (value) => (0, service_availability_service_1.normalizeServiceKey)(value).replace(/-+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
exports.normalizeDispatchServiceKey = normalizeDispatchServiceKey;
const buildAvailableBookingPayload = (booking, technicianLocation, categoryMatch) => {
    const [longitude, latitude] = booking.customerLocation.coordinates;
    return {
        id: booking._id?.toString() ?? booking.id,
        serviceKey: getBookingDispatchServiceCategory(booking),
        applianceType: booking.applianceType,
        faultDescription: booking.faultDescription || 'No description provided.',
        fullAddress: booking.fullAddress,
        complexDetails: booking.complexDetails || '',
        generalArea: booking.generalArea || 'Local Area',
        priceMinor: booking.priceMinor,
        currency: booking.currency,
        countryCode: booking.countryCode,
        latitude,
        longitude,
        distanceKm: getDistanceKm(technicianLocation.coordinates[1], technicianLocation.coordinates[0], latitude, longitude),
        categoryMatch,
    };
};
const getDispatchExpiry = (booking) => {
    if (booking.dispatch?.expiresAt)
        return new Date(booking.dispatch.expiresAt);
    const createdAt = booking.createdAt ? new Date(booking.createdAt) : new Date();
    return new Date(createdAt.getTime() + DISPATCH_TIMEOUT_MS);
};
const isBookingDispatchOpen = (booking, now = new Date()) => {
    if (booking.status !== booking_model_1.BookingStatus.PENDING)
        return false;
    if (booking.dispatch?.status &&
        !LIVE_DISPATCH_STATUSES.includes(booking.dispatch.status)) {
        return false;
    }
    return getDispatchExpiry(booking).getTime() > now.getTime();
};
const technicianDeclinedBooking = (booking, technicianId) => {
    const declined = booking.dispatch?.declinedByTechnicians;
    return Array.isArray(declined) && declined.some((id) => String(id) === technicianId.toString());
};
const getDispatchServiceCategory = (value) => {
    const raw = String(value || '').toLowerCase();
    const applianceKeywords = [
        'appliance',
        'fridge',
        'freezer',
        'washing',
        'tumbler',
        'dishwasher',
        'stove',
        'oven',
        'coffee',
        'air condition',
        'aircon',
        'air conditioner',
        'tv',
        'television',
    ];
    if (applianceKeywords.some((keyword) => raw.includes(keyword))) {
        return 'appliance_repair';
    }
    return (0, exports.normalizeDispatchServiceKey)(value);
};
const getBookingDispatchServiceCategory = (booking) => getDispatchServiceCategory(booking.serviceKey ?? booking.metadata?.serviceKey ?? booking.applianceType ?? booking.generalArea);
const normalizeSpecialty = (value) => (0, exports.normalizeDispatchServiceKey)(value);
const getBookingSpecialty = (booking) => {
    const metadata = booking.metadata ?? {};
    return normalizeSpecialty(metadata.specialty ??
        metadata.subSpecialty ??
        metadata.sub_specialty ??
        metadata.subCategory ??
        metadata.sub_category);
};
const getBookingCoordinates = (booking) => {
    const coordinates = booking.customerLocation?.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length !== 2)
        return null;
    const [longitude, latitude] = coordinates;
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude))
        return null;
    return [longitude, latitude];
};
const categoriesAllowMatch = (serviceCategories, booking) => {
    const bookingCategory = getBookingDispatchServiceCategory(booking);
    const technicianCategories = Array.isArray(serviceCategories)
        ? serviceCategories
            .map((item) => getDispatchServiceCategory(item))
            .filter(Boolean)
        : [];
    if (!bookingCategory || technicianCategories.length === 0)
        return false;
    return technicianCategories.includes(bookingCategory);
};
const getTechnicianDistanceKm = (technician, booking) => {
    const techCoordinates = technician.lastLocation?.coordinates;
    const bookingCoordinates = booking.customerLocation?.coordinates;
    if (!Array.isArray(techCoordinates) ||
        techCoordinates.length !== 2 ||
        !Array.isArray(bookingCoordinates) ||
        bookingCoordinates.length !== 2) {
        return null;
    }
    const [techLongitude, techLatitude] = techCoordinates;
    const [bookingLongitude, bookingLatitude] = bookingCoordinates;
    if (!Number.isFinite(techLatitude) ||
        !Number.isFinite(techLongitude) ||
        !Number.isFinite(bookingLatitude) ||
        !Number.isFinite(bookingLongitude)) {
        return null;
    }
    return getDistanceKm(bookingLatitude, bookingLongitude, techLatitude, techLongitude);
};
const findEligibleTechniciansWithTelemetryPipeline = async (booking) => {
    const coordinates = getBookingCoordinates(booking);
    const serviceKey = getBookingDispatchServiceCategory(booking);
    if (!coordinates || !serviceKey)
        return [];
    const [longitude, latitude] = coordinates;
    const specialty = getBookingSpecialty(booking);
    const declinedTechnicianUserIds = Array.isArray(booking.dispatch?.declinedByTechnicians)
        ? booking.dispatch.declinedByTechnicians
            .filter((id) => mongoose_1.default.Types.ObjectId.isValid(String(id)))
            .map((id) => new mongoose_1.default.Types.ObjectId(String(id)))
        : [];
    const capabilityMatch = {
        categorySlug: serviceKey,
        verificationStatus: technician_capability_model_1.CapabilityStatus.APPROVED,
    };
    if (specialty) {
        capabilityMatch.approvedSpecialties = specialty;
    }
    const pipeline = [
        {
            $geoNear: {
                near: {
                    type: 'Point',
                    coordinates: [longitude, latitude],
                },
                distanceField: 'distanceMeters',
                spherical: true,
                query: {
                    isOnDuty: true,
                    connectionStatus: 'CONNECTED',
                    location: { $ne: null },
                },
            },
        },
        {
            $lookup: {
                from: technician_capability_model_1.default.collection.name,
                localField: 'technicianId',
                foreignField: 'technicianId',
                as: 'capability',
            },
        },
        { $unwind: '$capability' },
        { $match: Object.fromEntries(Object.entries(capabilityMatch).map(([key, value]) => [`capability.${key}`, value])) },
        {
            $addFields: {
                capabilityRadiusMeters: {
                    $multiply: [
                        {
                            $ifNull: ['$capability.serviceRadiusKm', DEFAULT_SERVICE_RADIUS_KM],
                        },
                        1000,
                    ],
                },
            },
        },
        {
            $match: {
                $expr: {
                    $lte: ['$distanceMeters', '$capabilityRadiusMeters'],
                },
            },
        },
        {
            $lookup: {
                from: technician_model_1.default.collection.name,
                localField: 'technicianId',
                foreignField: '_id',
                as: 'technician',
            },
        },
        { $unwind: '$technician' },
        {
            $match: {
                'technician.approvalStatus': technician_model_1.TechnicianApprovalStatus.APPROVED,
                'technician.countryCode': booking.countryCode,
                'technician.userId': {
                    $exists: true,
                    ...(declinedTechnicianUserIds.length ? { $nin: declinedTechnicianUserIds } : {}),
                },
            },
        },
        { $sort: { distanceMeters: 1 } },
        {
            $project: {
                _id: 0,
                technicianUserId: '$technician.userId',
                distanceMeters: 1,
                serviceRadiusKm: '$capability.serviceRadiusKm',
            },
        },
    ];
    const results = await technician_telemetry_model_1.default.aggregate(pipeline);
    return results
        .map((result) => result.technicianUserId?.toString())
        .filter((id) => Boolean(id));
};
const matchingService = {
    async findNearbyTechnicians(latitude, longitude) {
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            return [];
        }
        const technicians = await technician_model_1.default.find({
            approvalStatus: technician_model_1.TechnicianApprovalStatus.APPROVED,
            'availability.isOnline': true,
            lastLocation: { $ne: null },
            userId: { $exists: true },
        })
            .select('userId lastLocation serviceRadiusKm approvalStatus availability.isOnline serviceCategories')
            .lean();
        const matchingTechnicianUserIds = technicians
            .filter((technician) => {
            const coordinates = technician.lastLocation?.coordinates;
            if (!Array.isArray(coordinates) || coordinates.length !== 2) {
                return false;
            }
            const [techLongitude, techLatitude] = coordinates;
            if (!Number.isFinite(techLatitude) || !Number.isFinite(techLongitude)) {
                return false;
            }
            const radiusKm = typeof technician.serviceRadiusKm === 'number'
                ? technician.serviceRadiusKm
                : 25;
            const distanceKm = getDistanceKm(latitude, longitude, techLatitude, techLongitude);
            return distanceKm <= radiusKm;
        })
            .map((technician) => technician.userId?.toString())
            .filter((id) => Boolean(id));
        if (isDebug()) {
            console.info('[matching-debug] nearby real technicians matched', {
                latitude,
                longitude,
                matchedCount: matchingTechnicianUserIds.length,
                technicianUserIds: matchingTechnicianUserIds,
            });
        }
        return matchingTechnicianUserIds;
    },
    getDispatchExpiry,
    async findEligibleOnlineTechniciansForBooking(bookingId) {
        if (!mongoose_1.default.Types.ObjectId.isValid(bookingId)) {
            return [];
        }
        const booking = await booking_model_1.default.findById(bookingId)
            .select('status serviceKey applianceType generalArea metadata customerLocation countryCode dispatch createdAt')
            .lean();
        if (!booking || !isBookingDispatchOpen(booking)) {
            return [];
        }
        const eligible = await findEligibleTechniciansWithTelemetryPipeline(booking);
        if (isDebug()) {
            console.info('[matching-debug] eligible telemetry technicians for booking', {
                bookingId,
                matchedCount: eligible.length,
                technicianUserIds: eligible,
            });
        }
        return eligible;
    },
    async markBookingStandby(bookingId) {
        if (!mongoose_1.default.Types.ObjectId.isValid(bookingId)) {
            return;
        }
        const expiresAt = new Date(Date.now() + STANDBY_EXPIRY_MS);
        await booking_model_1.default.updateOne({
            _id: bookingId,
            status: booking_model_1.BookingStatus.PENDING,
            $or: [
                { 'dispatch.status': booking_model_1.BookingDispatchStatus.BROADCASTING },
                { 'dispatch.status': booking_model_1.BookingDispatchStatus.STANDBY },
                { 'dispatch.status': { $exists: false } },
            ],
        }, {
            $set: {
                'dispatch.status': booking_model_1.BookingDispatchStatus.STANDBY,
                'dispatch.expiresAt': expiresAt,
                'metadata.fallbackPreference': 'STANDBY',
                'metadata.standbyExpiresAt': expiresAt,
            },
        });
    },
    scheduleStandbyAutoCancellation(bookingId) {
        if (!mongoose_1.default.Types.ObjectId.isValid(bookingId)) {
            return;
        }
        const timer = setTimeout(() => {
            void booking_model_1.default.updateOne({
                _id: bookingId,
                status: booking_model_1.BookingStatus.PENDING,
                'dispatch.status': booking_model_1.BookingDispatchStatus.STANDBY,
                'dispatch.expiresAt': { $lte: new Date() },
            }, {
                $set: {
                    status: booking_model_1.BookingStatus.CANCELLED,
                    'dispatch.status': booking_model_1.BookingDispatchStatus.EXPIRED,
                    cancelledAt: new Date(),
                    cancellation: {
                        cancelledBy: booking_model_1.BookingCancellationBy.SYSTEM,
                        reason: 'No technician accepted the standby dispatch within 15 minutes.',
                    },
                },
            }).catch((error) => {
                console.error('Failed to auto-cancel standby booking:', error);
            });
        }, STANDBY_EXPIRY_MS);
        timer.unref?.();
    },
    async isTechnicianEligibleForBooking(technicianId, bookingId) {
        const eligibleTechnicianIds = await this.findEligibleOnlineTechniciansForBooking(bookingId);
        return eligibleTechnicianIds.includes(technicianId);
    },
    async markBookingsSentToTechnician(technicianId, bookingIds) {
        if (!mongoose_1.default.Types.ObjectId.isValid(technicianId) || bookingIds.length === 0) {
            return;
        }
        const validBookingIds = bookingIds
            .filter((bookingId) => mongoose_1.default.Types.ObjectId.isValid(bookingId))
            .map((bookingId) => new mongoose_1.default.Types.ObjectId(bookingId));
        if (validBookingIds.length === 0) {
            return;
        }
        await booking_model_1.default.updateMany({ _id: { $in: validBookingIds }, status: booking_model_1.BookingStatus.PENDING }, {
            $set: { 'dispatch.status': booking_model_1.BookingDispatchStatus.BROADCASTING },
            $addToSet: {
                'dispatch.sentToTechnicians': new mongoose_1.default.Types.ObjectId(technicianId),
            },
        });
    },
    async findNearbyPendingBookingsForTechnician(technicianId) {
        if (!mongoose_1.default.Types.ObjectId.isValid(technicianId)) {
            return [];
        }
        const technician = await technician_model_1.default.findOne({
            userId: new mongoose_1.default.Types.ObjectId(technicianId),
            approvalStatus: technician_model_1.TechnicianApprovalStatus.APPROVED,
            'availability.isOnline': true,
        })
            .select('lastLocation serviceRadiusKm serviceCategories countryCode')
            .lean();
        if (!technician) {
            return [];
        }
        const maxDistance = typeof technician.serviceRadiusKm === 'number' && technician.serviceRadiusKm > 0
            ? technician.serviceRadiusKm * 1000
            : 25000;
        const normalizedTechnicianCategories = Array.isArray(technician.serviceCategories)
            ? technician.serviceCategories.map((item) => getDispatchServiceCategory(item))
            : [];
        const now = new Date();
        const createdAfter = new Date(now.getTime() - DISPATCH_TIMEOUT_MS);
        const basePendingFilter = {
            status: booking_model_1.BookingStatus.PENDING,
            countryCode: technician.countryCode,
            $and: [
                {
                    $or: [
                        { 'dispatch.status': { $in: LIVE_DISPATCH_STATUSES } },
                        { 'dispatch.status': { $exists: false } },
                    ],
                },
                {
                    $or: [
                        { 'dispatch.expiresAt': { $gt: now } },
                        {
                            'dispatch.expiresAt': { $exists: false },
                            createdAt: { $gte: createdAfter },
                        },
                    ],
                },
                {
                    $or: [
                        { 'dispatch.declinedByTechnicians': { $ne: new mongoose_1.default.Types.ObjectId(technicianId) } },
                        { 'dispatch.declinedByTechnicians': { $exists: false } },
                    ],
                },
            ],
        };
        const bookings = await booking_model_1.default.find(technician.lastLocation?.coordinates?.length
            ? {
                ...basePendingFilter,
                customerLocation: {
                    $nearSphere: {
                        $geometry: technician.lastLocation,
                        $maxDistance: Math.max(maxDistance, LOCAL_TEST_MIN_RADIUS_KM * 1000),
                    },
                },
            }
            : basePendingFilter)
            .select('serviceKey applianceType faultDescription customerLocation fullAddress complexDetails generalArea metadata priceMinor currency countryCode dispatch createdAt status')
            .lean();
        const availableJobs = bookings
            .map((booking) => {
            const bookingCategory = getBookingDispatchServiceCategory(booking);
            const categoryMatch = !!bookingCategory && normalizedTechnicianCategories.includes(bookingCategory);
            if (!isBookingDispatchOpen(booking, now)) {
                return null;
            }
            if (!categoriesAllowMatch(technician.serviceCategories, booking)) {
                return null;
            }
            const technicianLocation = technician.lastLocation ??
                {
                    type: 'Point',
                    coordinates: booking.customerLocation.coordinates,
                };
            return buildAvailableBookingPayload(booking, technicianLocation, categoryMatch);
        })
            .filter((job) => Boolean(job))
            .sort((a, b) => {
            if (a.categoryMatch === b.categoryMatch)
                return a.distanceKm - b.distanceKm;
            return a.categoryMatch ? -1 : 1;
        });
        const matchedJobs = availableJobs.filter((job) => job.categoryMatch);
        return matchedJobs.length > 0 ? matchedJobs : availableJobs;
    },
};
exports.default = matchingService;
//# sourceMappingURL=matching.service.js.map