// src/services/matching.service.ts
import mongoose from 'mongoose';
import TechnicianModel, { TechnicianApprovalStatus } from '../models/technician.model';
import Booking, { BookingCancellationBy, BookingDispatchStatus, BookingStatus } from '../models/booking.model';
import TechnicianCapability, { CapabilityStatus } from '../models/technician-capability.model';
import TechnicianTelemetry from '../models/technician-telemetry.model';
import { normalizeServiceKey } from './service-availability.service';

const EARTH_RADIUS_KM = 6371;
const DISPATCH_TIMEOUT_MINUTES = 30;
const DISPATCH_TIMEOUT_MS = DISPATCH_TIMEOUT_MINUTES * 60 * 1000;
const LOCAL_TEST_MIN_RADIUS_KM = 50;
const DEFAULT_SERVICE_RADIUS_KM = 25;
const LIVE_DISPATCH_STATUSES = [BookingDispatchStatus.BROADCASTING, BookingDispatchStatus.STANDBY];
const STANDBY_EXPIRY_MS = 15 * 60 * 1000;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

const getDistanceKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const isDebug = (): boolean =>
  process.env.NODE_ENV !== 'production' || process.env.SOCKET_DEBUG === 'true';

export const normalizeDispatchServiceKey = (value: unknown): string =>
  normalizeServiceKey(value).replace(/-+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');

export interface AvailableBookingPayload {
  id: string;
  serviceKey: string;
  applianceType: string;
  faultDescription: string;
  fullAddress: string;
  complexDetails: string;
  generalArea: string;
  priceMinor: number;
  currency: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  categoryMatch: boolean;
}

const buildAvailableBookingPayload = (
  booking: any,
  technicianLocation: { type: string; coordinates: [number, number] },
  categoryMatch: boolean
): AvailableBookingPayload => {
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
    distanceKm: getDistanceKm(
      technicianLocation.coordinates[1],
      technicianLocation.coordinates[0],
      latitude,
      longitude
    ),
    categoryMatch,
  };
};

const getDispatchExpiry = (booking: { createdAt?: Date; dispatch?: { expiresAt?: Date | null } }): Date => {
  if (booking.dispatch?.expiresAt) return new Date(booking.dispatch.expiresAt);
  const createdAt = booking.createdAt ? new Date(booking.createdAt) : new Date();
  return new Date(createdAt.getTime() + DISPATCH_TIMEOUT_MS);
};

const isBookingDispatchOpen = (booking: any, now = new Date()): boolean => {
  if (booking.status !== BookingStatus.PENDING) return false;
  if (
    booking.dispatch?.status &&
    !LIVE_DISPATCH_STATUSES.includes(booking.dispatch.status)
  ) {
    return false;
  }
  return getDispatchExpiry(booking).getTime() > now.getTime();
};

const technicianDeclinedBooking = (booking: any, technicianId: mongoose.Types.ObjectId): boolean => {
  const declined = booking.dispatch?.declinedByTechnicians;
  return Array.isArray(declined) && declined.some((id) => String(id) === technicianId.toString());
};

const getDispatchServiceCategory = (value: unknown): string => {
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

  return normalizeDispatchServiceKey(value);
};

const getBookingDispatchServiceCategory = (booking: {
  serviceKey?: unknown;
  applianceType?: unknown;
  generalArea?: unknown;
  metadata?: { serviceKey?: unknown } | null;
}): string =>
  getDispatchServiceCategory(
    booking.serviceKey ?? booking.metadata?.serviceKey ?? booking.applianceType ?? booking.generalArea
  );

const normalizeSpecialty = (value: unknown): string => normalizeDispatchServiceKey(value);

const getBookingSpecialty = (booking: {
  metadata?: Record<string, unknown> | null;
}): string => {
  const metadata = booking.metadata ?? {};
  return normalizeSpecialty(
    metadata.specialty ??
      metadata.subSpecialty ??
      metadata.sub_specialty ??
      metadata.subCategory ??
      metadata.sub_category
  );
};

const getBookingCoordinates = (
  booking: { customerLocation?: { coordinates?: [number, number] } | null }
): [number, number] | null => {
  const coordinates = booking.customerLocation?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length !== 2) return null;

  const [longitude, latitude] = coordinates;
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;

  return [longitude, latitude];
};

const categoriesAllowMatch = (
  serviceCategories: string[] | undefined,
  booking: {
    serviceKey?: unknown;
    applianceType?: unknown;
    generalArea?: unknown;
    metadata?: { serviceKey?: unknown } | null;
  }
): boolean => {
  const bookingCategory = getBookingDispatchServiceCategory(booking);

  const technicianCategories = Array.isArray(serviceCategories)
    ? serviceCategories
        .map((item) => getDispatchServiceCategory(item))
        .filter(Boolean)
    : [];

  if (!bookingCategory || technicianCategories.length === 0) return false;

  return technicianCategories.includes(bookingCategory);
};

const getTechnicianDistanceKm = (
  technician: { lastLocation?: { coordinates?: [number, number] } | null },
  booking: { customerLocation?: { coordinates?: [number, number] } }
): number | null => {
  const techCoordinates = technician.lastLocation?.coordinates;
  const bookingCoordinates = booking.customerLocation?.coordinates;

  if (
    !Array.isArray(techCoordinates) ||
    techCoordinates.length !== 2 ||
    !Array.isArray(bookingCoordinates) ||
    bookingCoordinates.length !== 2
  ) {
    return null;
  }

  const [techLongitude, techLatitude] = techCoordinates;
  const [bookingLongitude, bookingLatitude] = bookingCoordinates;
  if (
    !Number.isFinite(techLatitude) ||
    !Number.isFinite(techLongitude) ||
    !Number.isFinite(bookingLatitude) ||
    !Number.isFinite(bookingLongitude)
  ) {
    return null;
  }

  return getDistanceKm(bookingLatitude, bookingLongitude, techLatitude, techLongitude);
};

interface EligibleTechnicianAggregationResult {
  technicianUserId?: mongoose.Types.ObjectId;
  distanceMeters: number;
  serviceRadiusKm?: number;
}

const findEligibleTechniciansWithTelemetryPipeline = async (
  booking: {
    _id?: unknown;
    serviceKey?: unknown;
    applianceType?: unknown;
    generalArea?: unknown;
    metadata?: Record<string, unknown> | null;
    customerLocation?: { coordinates?: [number, number] } | null;
    countryCode?: unknown;
    dispatch?: { declinedByTechnicians?: mongoose.Types.ObjectId[] };
  }
): Promise<string[]> => {
  const coordinates = getBookingCoordinates(booking);
  const serviceKey = getBookingDispatchServiceCategory(booking);

  if (!coordinates || !serviceKey) return [];

  const [longitude, latitude] = coordinates;
  const specialty = getBookingSpecialty(booking);
  const declinedTechnicianUserIds = Array.isArray(booking.dispatch?.declinedByTechnicians)
    ? booking.dispatch.declinedByTechnicians
        .filter((id) => mongoose.Types.ObjectId.isValid(String(id)))
        .map((id) => new mongoose.Types.ObjectId(String(id)))
    : [];

  const capabilityMatch: Record<string, unknown> = {
    categorySlug: serviceKey,
    verificationStatus: CapabilityStatus.APPROVED,
  };

  if (specialty) {
    capabilityMatch.approvedSpecialties = specialty;
  }

  const pipeline: mongoose.PipelineStage[] = [
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
        from: TechnicianCapability.collection.name,
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
        from: TechnicianModel.collection.name,
        localField: 'technicianId',
        foreignField: '_id',
        as: 'technician',
      },
    },
    { $unwind: '$technician' },
    {
      $match: {
        'technician.approvalStatus': TechnicianApprovalStatus.APPROVED,
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

  const results = await TechnicianTelemetry.aggregate<EligibleTechnicianAggregationResult>(pipeline);
  return results
    .map((result) => result.technicianUserId?.toString())
    .filter((id): id is string => Boolean(id));
};

const matchingService = {
  async findNearbyTechnicians(
    latitude: number,
    longitude: number
  ): Promise<string[]> {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return [];
    }

    const technicians = await TechnicianModel.find({
      approvalStatus: TechnicianApprovalStatus.APPROVED,
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

        const radiusKm =
          typeof technician.serviceRadiusKm === 'number'
            ? technician.serviceRadiusKm
            : 25;

        const distanceKm = getDistanceKm(
          latitude,
          longitude,
          techLatitude,
          techLongitude
        );

        return distanceKm <= radiusKm;
      })
      .map((technician) => technician.userId?.toString())
      .filter((id): id is string => Boolean(id));

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

  async findEligibleOnlineTechniciansForBooking(bookingId: string): Promise<string[]> {
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return [];
    }

    const booking = await Booking.findById(bookingId)
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

  async markBookingStandby(bookingId: string): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return;
    }

    const expiresAt = new Date(Date.now() + STANDBY_EXPIRY_MS);

    await Booking.updateOne(
      {
        _id: bookingId,
        status: BookingStatus.PENDING,
        $or: [
          { 'dispatch.status': BookingDispatchStatus.BROADCASTING },
          { 'dispatch.status': BookingDispatchStatus.STANDBY },
          { 'dispatch.status': { $exists: false } },
        ],
      },
      {
        $set: {
          'dispatch.status': BookingDispatchStatus.STANDBY,
          'dispatch.expiresAt': expiresAt,
          'metadata.fallbackPreference': 'STANDBY',
          'metadata.standbyExpiresAt': expiresAt,
        },
      }
    );
  },

  scheduleStandbyAutoCancellation(bookingId: string): void {
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return;
    }

    const timer = setTimeout(() => {
      void Booking.updateOne(
        {
          _id: bookingId,
          status: BookingStatus.PENDING,
          'dispatch.status': BookingDispatchStatus.STANDBY,
          'dispatch.expiresAt': { $lte: new Date() },
        },
        {
          $set: {
            status: BookingStatus.CANCELLED,
            'dispatch.status': BookingDispatchStatus.EXPIRED,
            cancelledAt: new Date(),
            cancellation: {
              cancelledBy: BookingCancellationBy.SYSTEM,
              reason: 'No technician accepted the standby dispatch within 15 minutes.',
            },
          },
        }
      ).catch((error) => {
        console.error('Failed to auto-cancel standby booking:', error);
      });
    }, STANDBY_EXPIRY_MS);

    timer.unref?.();
  },

  async isTechnicianEligibleForBooking(technicianId: string, bookingId: string): Promise<boolean> {
    const eligibleTechnicianIds = await this.findEligibleOnlineTechniciansForBooking(bookingId);
    return eligibleTechnicianIds.includes(technicianId);
  },

  async markBookingsSentToTechnician(technicianId: string, bookingIds: string[]): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(technicianId) || bookingIds.length === 0) {
      return;
    }

    const validBookingIds = bookingIds
      .filter((bookingId) => mongoose.Types.ObjectId.isValid(bookingId))
      .map((bookingId) => new mongoose.Types.ObjectId(bookingId));

    if (validBookingIds.length === 0) {
      return;
    }

    await Booking.updateMany(
      { _id: { $in: validBookingIds }, status: BookingStatus.PENDING },
      {
        $set: { 'dispatch.status': BookingDispatchStatus.BROADCASTING },
        $addToSet: {
          'dispatch.sentToTechnicians': new mongoose.Types.ObjectId(technicianId),
        },
      }
    );
  },

  async findNearbyPendingBookingsForTechnician(
    technicianId: string
  ): Promise<AvailableBookingPayload[]> {
    if (!mongoose.Types.ObjectId.isValid(technicianId)) {
      return [];
    }

    const technician = await TechnicianModel.findOne({
      userId: new mongoose.Types.ObjectId(technicianId),
      approvalStatus: TechnicianApprovalStatus.APPROVED,
      'availability.isOnline': true,
    })
      .select('lastLocation serviceRadiusKm serviceCategories countryCode')
      .lean();

    if (!technician) {
      return [];
    }

    const maxDistance =
      typeof technician.serviceRadiusKm === 'number' && technician.serviceRadiusKm > 0
        ? technician.serviceRadiusKm * 1000
        : 25000;

    const normalizedTechnicianCategories = Array.isArray(technician.serviceCategories)
      ? technician.serviceCategories.map((item) => getDispatchServiceCategory(item))
      : [];

    const now = new Date();
    const createdAfter = new Date(now.getTime() - DISPATCH_TIMEOUT_MS);
    const basePendingFilter = {
      status: BookingStatus.PENDING,
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
            { 'dispatch.declinedByTechnicians': { $ne: new mongoose.Types.ObjectId(technicianId) } },
            { 'dispatch.declinedByTechnicians': { $exists: false } },
          ],
        },
      ],
    };

    const bookings = await Booking.find(
      technician.lastLocation?.coordinates?.length
        ? {
            ...basePendingFilter,
            customerLocation: {
              $nearSphere: {
                $geometry: technician.lastLocation,
                $maxDistance: Math.max(maxDistance, LOCAL_TEST_MIN_RADIUS_KM * 1000),
              },
            },
          }
        : basePendingFilter
    )
      .select(
        'serviceKey applianceType faultDescription customerLocation fullAddress complexDetails generalArea metadata priceMinor currency countryCode dispatch createdAt status'
      )
      .lean();

    const availableJobs = bookings
      .map((booking) => {
        const bookingCategory = getBookingDispatchServiceCategory(booking);
        const categoryMatch =
          !!bookingCategory && normalizedTechnicianCategories.includes(bookingCategory);
        
        if (!isBookingDispatchOpen(booking, now)) {
          return null;
        }

        if (!categoriesAllowMatch(technician.serviceCategories, booking)) {
          return null;
        }

        const technicianLocation =
          technician.lastLocation ??
          ({
            type: 'Point',
            coordinates: booking.customerLocation.coordinates,
          } as { type: string; coordinates: [number, number] });

        return buildAvailableBookingPayload(booking, technicianLocation, categoryMatch);
      })
      .filter((job): job is AvailableBookingPayload => Boolean(job))
      .sort((a, b) => {
        if (a.categoryMatch === b.categoryMatch) return a.distanceKm - b.distanceKm;
        return a.categoryMatch ? -1 : 1;
      });

    const matchedJobs = availableJobs.filter((job) => job.categoryMatch);
    return matchedJobs.length > 0 ? matchedJobs : availableJobs;
  },
};

export default matchingService;
