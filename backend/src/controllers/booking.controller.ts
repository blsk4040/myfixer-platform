// src/controllers/booking.controller.ts
import { Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import mongoose from 'mongoose';
// 1. IMPORT BookingStatus ENUM HERE
import Booking, { BookingCancellationBy, BookingDispatchStatus, BookingStatus } from '../models/booking.model';
import matchingService, { normalizeDispatchServiceKey } from '../services/matching.service';
// 2. UNCOMMENT AND USE YOUR ACTUAL EMAIL SERVICE UTILITY
import { EmailService } from '../services/email/email.service'; 
import {
  Invoice,
  InvoiceStatus,
  Wallet,
  WalletTransaction,
  WalletTransactionStatus,
  WalletTransactionType,
} from '../models/billing.model';
import { normalizeUserRole, UserRole } from '../models/user.model';
import User from '../models/user.model';
import JobQuote, { QuoteLineItemType, QuoteStatus } from '../models/quote.model';
import TechnicianModel, { TechnicianApprovalStatus } from '../models/technician.model';
import TechnicianCapability, { CapabilityStatus } from '../models/technician-capability.model';
import ServiceWaitlist, {
  ServiceWaitlistSource,
  ServiceWaitlistStatus,
} from '../models/service-waitlist.model';
import { logAuditEvent } from '../services/audit.service';
import {
  CountryCode,
  getMarketByCountry,
  isCurrencyCode,
  normalizeCountryCode,
  fromMinorUnits,
  toMinorUnits,
} from '../config/market.config';
import { validateServiceBookable } from '../services/service-availability.service';
import { createNotifications } from '../services/notification.service';
import { NotificationChannel } from '../models/notification.model';

interface CreateBookingRequestBody {
  customer_id?: unknown;
  customer_name?: unknown;     // Unlocks post-acceptance
  appliance_type?: unknown;
  fault_description?: unknown;  // Crucial operational context
  latitude?: unknown;
  longitude?: unknown;
  call_out_fee?: unknown;       // Fixed fee tracking
  currency?: unknown;
  country_code?: unknown;
  full_address?: unknown;       // Street number and name
  street_address?: unknown;
  suburb?: unknown;
  postal_code?: unknown;
  save_as_default_address?: unknown;
  complex_details?: unknown;    // Townhouses/Estates details
  general_area?: unknown;       // Masked suburb name (e.g. "Bryanston")
  city?: unknown;
  area?: unknown;
  neighbourhood?: unknown;
  neighborhood?: unknown;
  service_key?: unknown;
  category?: unknown;
  fallbackPreference?: unknown;
  fallback_preference?: unknown;
  scheduledAt?: unknown;
  scheduled_at?: unknown;
  email?: unknown;
  phone?: unknown;
}

interface AcceptBookingRequestBody {
  technicianId?: unknown;
}

interface UpdateBookingStatusRequestBody {
  status?: unknown;
}

// Add this interface to validate incoming request bodies from the mobile app
interface FinalizeInvoiceRequestBody {
  bookingId?: unknown;
  baseAmount?: unknown;
  additionalLabor?: unknown;
  partsAmount?: unknown;
  totalAmount?: unknown;
  proofPhoto?: unknown;
}

const toFiniteNumber = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const decimalFromMinor = (valueMinor: number): number => valueMinor / 100;

const isBookingStatus = (value: unknown): value is BookingStatus =>
  typeof value === 'string' && Object.values(BookingStatus).includes(value as BookingStatus);

type DispatchFallbackPreference = 'STANDBY' | 'SCHEDULED' | 'WAITLIST';

const normalizeFallbackPreference = (value: unknown): DispatchFallbackPreference => {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return normalized === 'SCHEDULED' || normalized === 'WAITLIST' ? normalized : 'STANDBY';
};

const getAuthenticatedUser = (request: Request) =>
  (request as any).user as
    | { id?: string; _id?: string; email?: string; role?: string }
    | undefined;

const getSocketIdentity = (socket: {
  handshake: {
    query: Record<string, string | string[] | undefined>;
    auth?: Record<string, unknown>;
  };
  data?: Record<string, unknown>;
}): string | null => {
  const query = socket.handshake.query;
  const candidate =
    query.technicianId ??
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

const isSocketDebugEnabled = (): boolean =>
  process.env.NODE_ENV !== 'production' || process.env.SOCKET_DEBUG === 'true';

const logSocketDebug = (message: string, metadata?: Record<string, unknown>): void => {
  if (!isSocketDebugEnabled()) return;
  console.info(`[tech-socket-debug] ${message}`, metadata ?? '');
};

const emitIncomingRequest = async (
  io: SocketIOServer,
  technicianId: string,
  payload: Record<string, unknown>
): Promise<void> => {
  io.to(`technician:${technicianId}`).emit('incoming_request', payload);

  const sockets = await io.fetchSockets();
  const matchingSockets = sockets.filter(
    (socket) => getSocketIdentity(socket) === technicianId
  );

  logSocketDebug('booking broadcast targeting technician', {
    technicianId,
    matchingSocketCount: matchingSockets.length,
    room: `technician:${technicianId}`,
  });

  matchingSockets.forEach((socket) => {
    socket.emit('incoming_request', payload);
  });
};

const buildIncomingRequestPayload = (booking: {
  id?: string;
  _id?: unknown;
  customerId: unknown;
  customerName: string;
  serviceKey?: string;
  applianceType: string;
  faultDescription: string;
  fullAddress: string;
  complexDetails?: string;
  generalArea: string;
  priceMinor: number;
  countryCode: string;
  currency: string;
  customerLocation: { coordinates: [number, number] };
}) => {
  const [longitude, latitude] = booking.customerLocation.coordinates;
  const bookingId =
    typeof booking.id === 'string' && booking.id
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

const createCustomerBookingNotification = async (
  booking: {
    id?: string;
    _id?: unknown;
    customerId: unknown;
    customerName?: string;
    customerEmail?: string;
    applianceType?: string;
    status?: string;
  },
  eventType: string,
  title: string,
  message: string,
  metadata: Record<string, unknown> = {}
): Promise<void> => {
  const customerId = String(booking.customerId || '').trim();
  if (!mongoose.Types.ObjectId.isValid(customerId)) return;

  await createNotifications({
    userId: customerId,
    email: booking.customerEmail || '',
    name: booking.customerName || 'Client',
    channels: [NotificationChannel.IN_APP],
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

const saveCapacityWaitlistEntry = async (input: {
  customerId: string;
  email: string;
  phone: string;
  countryCode: string;
  city: string;
  area: string;
  categorySlug: string;
  longitude: number;
  latitude: number;
  bookingId: string;
}) => {
  return ServiceWaitlist.findOneAndUpdate(
    {
      email: input.email,
      countryCode: input.countryCode,
      city: input.city,
      area: input.area,
      serviceKey: input.categorySlug,
    },
    {
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
        customerId: mongoose.Types.ObjectId.isValid(input.customerId)
          ? new mongoose.Types.ObjectId(input.customerId)
          : undefined,
        email: input.email,
        phone: input.phone,
        countryCode: input.countryCode,
        city: input.city,
        area: input.area,
        serviceKey: input.categorySlug,
        status: ServiceWaitlistStatus.WAITING,
        source: ServiceWaitlistSource.CLIENT_APP,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

const getBookingServiceKeyForClaim = (booking: {
  serviceKey?: unknown;
  applianceType?: unknown;
  generalArea?: unknown;
  metadata?: Record<string, unknown> | null;
}): string =>
  normalizeDispatchServiceKey(
    booking.serviceKey ?? booking.metadata?.serviceKey ?? booking.applianceType ?? booking.generalArea
  );

const canTechnicianClaimOpenBooking = async (
  technicianUserId: string,
  booking: {
    serviceKey?: unknown;
    applianceType?: unknown;
    generalArea?: unknown;
    metadata?: Record<string, unknown> | null;
    countryCode?: unknown;
  }
): Promise<boolean> => {
  if (!mongoose.Types.ObjectId.isValid(technicianUserId)) return false;

  const categorySlug = getBookingServiceKeyForClaim(booking);
  if (!categorySlug) return false;

  const technician = await TechnicianModel.findOne({
    userId: new mongoose.Types.ObjectId(technicianUserId),
    approvalStatus: TechnicianApprovalStatus.APPROVED,
  })
    .select('_id countryCode serviceCategories')
    .lean();

  if (!technician) return false;
  if (booking.countryCode && technician.countryCode !== booking.countryCode) return false;

  const capability = await TechnicianCapability.findOne({
    technicianId: technician._id,
    categorySlug,
    verificationStatus: CapabilityStatus.APPROVED,
  })
    .select('_id')
    .lean();

  if (capability) return true;

  const legacyCategories = Array.isArray(technician.serviceCategories)
    ? technician.serviceCategories.map((item) => normalizeDispatchServiceKey(item))
    : [];

  return legacyCategories.includes(categorySlug);
};

export const createBooking = async (
  request: Request,
  response: Response
): Promise<void> => {
  const body = request.body as CreateBookingRequestBody;
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
  const requestedArea =
    typeof body.area === 'string'
      ? body.area.trim()
      : typeof body.neighbourhood === 'string'
        ? body.neighbourhood.trim()
        : typeof body.neighborhood === 'string'
          ? body.neighborhood.trim()
          : '';
  const requestedServiceKey = normalizeDispatchServiceKey(body.service_key ?? body.category ?? body.general_area ?? applianceType);
  const fallbackPreference = normalizeFallbackPreference(body.fallbackPreference ?? body.fallback_preference);
  const scheduledAtInput = body.scheduledAt ?? body.scheduled_at;
  const scheduledAt =
    typeof scheduledAtInput === 'string' || scheduledAtInput instanceof Date
      ? new Date(scheduledAtInput)
      : null;
  
  const latitude = toFiniteNumber(body.latitude);
  const longitude = toFiniteNumber(body.longitude);

  let countryCode = CountryCode.ZA;
  let customer: { countryCode?: unknown; location?: { country?: unknown; city?: string; area?: string } } | null = null;
  if (mongoose.Types.ObjectId.isValid(customerId)) {
    customer = await User.findById(customerId).select('countryCode location').lean();
    countryCode = normalizeCountryCode(body.country_code ?? customer?.countryCode ?? customer?.location?.country);
  } else {
    countryCode = normalizeCountryCode(body.country_code);
  }

  const market = getMarketByCountry(countryCode);
  const callOutFee = toFiniteNumber(body.call_out_fee) ?? market.defaultCalloutFee;
  const priceMinor = toMinorUnits(callOutFee, market.currency);

  if (!customerId || !applianceType || !fullAddress || latitude === null || longitude === null) {
    response.status(400).json({ message: 'Missing or invalid booking layout items' });
    return;
  }

  if (!mongoose.Types.ObjectId.isValid(customerId)) {
    response.status(401).json({ message: 'Invalid customer identity.' });
    return;
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 || callOutFee < 0) {
    response.status(400).json({ message: 'Invalid location or pricing metrics input' });
    return;
  }

  if (fallbackPreference === 'SCHEDULED' && scheduledAt && Number.isNaN(scheduledAt.getTime())) {
    response.status(400).json({ message: 'Invalid scheduled booking date.' });
    return;
  }

  if (body.currency && (!isCurrencyCode(body.currency) || body.currency !== market.currency)) {
    response.status(400).json({
      message: `Currency for ${market.countryName} must be ${market.currency}`,
    });
    return;
  }

  const city = requestedCity || customer?.location?.city || '';
  const area = requestedArea || customer?.location?.area || '';
  const availability = await validateServiceBookable({
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

  try {
    // 1. Save directly into MongoDB Atlas with updated keys
    const booking = await Booking.create({
      customerId: new mongoose.Types.ObjectId(customerId),
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
      metadata: {
        streetAddress,
        suburb,
        city,
        postalCode,
        serviceKey: requestedServiceKey,
        fallbackPreference,
        scheduledAt: scheduledAt && !Number.isNaN(scheduledAt.getTime()) ? scheduledAt : null,
      },
      priceMinor,
      countryCode: market.countryCode,
      currency: market.currency,
      dispatch: {
        status: BookingDispatchStatus.BROADCASTING,
        expiresAt: matchingService.getDispatchExpiry({ createdAt: new Date() }),
        sentToTechnicians: [],
        declinedByTechnicians: [],
      },
    });

    const bookingId = booking.id;
    if (saveAsDefaultAddress) {
      await User.findByIdAndUpdate(customerId, {
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
    await createCustomerBookingNotification(
      booking,
      'BOOKING_CREATED',
      'Booking request created',
      `Your ${applianceType} request has been created and is being sent to available technicians.`
    );
    
    // 2. Broadcast the open request to every eligible online approved technician.
    const eligibleTechnicianIds =
      fallbackPreference === 'SCHEDULED'
        ? []
        : await matchingService.findEligibleOnlineTechniciansForBooking(bookingId);

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
          status: BookingDispatchStatus.BROADCASTING,
          expiresAt: matchingService.getDispatchExpiry(booking),
          sentToTechnicians: [],
          declinedByTechnicians: [],
        }),
        sentToTechnicians: eligibleTechnicianIds.map((technicianId) => new mongoose.Types.ObjectId(technicianId)),
      };
      await booking.save();
    } else {
      if (fallbackPreference === 'SCHEDULED') {
        booking.dispatch = {
          ...(booking.dispatch ?? {
            sentToTechnicians: [],
            declinedByTechnicians: [],
          }),
          status: BookingDispatchStatus.SCHEDULED,
          expiresAt: null,
          sentToTechnicians: booking.dispatch?.sentToTechnicians ?? [],
          declinedByTechnicians: booking.dispatch?.declinedByTechnicians ?? [],
        };
        booking.metadata = {
          ...(booking.metadata ?? {}),
          fallbackPreference,
          scheduledAt: scheduledAt && !Number.isNaN(scheduledAt.getTime()) ? scheduledAt : null,
          queue: 'UPCOMING',
        };
        await booking.save();
      } else if (fallbackPreference === 'WAITLIST') {
        const email =
          (typeof body.email === 'string' ? body.email.trim().toLowerCase() : '') ||
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

        booking.status = BookingStatus.CANCELLED;
        booking.cancelledAt = new Date();
        booking.cancellation = {
          cancelledBy: BookingCancellationBy.SYSTEM,
          reason: 'Area capacity reached; customer interest logged on waitlist.',
        };
        booking.dispatch = {
          ...(booking.dispatch ?? {
            sentToTechnicians: [],
            declinedByTechnicians: [],
          }),
          status: BookingDispatchStatus.CANCELLED,
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
      } else {
        await matchingService.markBookingStandby(bookingId);
        matchingService.scheduleStandbyAutoCancellation(bookingId);
        const refreshedBooking = await Booking.findById(bookingId);
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

    const io = request.app.get('io') as SocketIOServer | undefined;

    if (io) {
      await Promise.all(
        eligibleTechnicianIds.map((technicianId) =>
          emitIncomingRequest(io, technicianId, incomingRequestPayload)
        )
      );
      await Promise.all(
        eligibleTechnicianIds.map(async (technicianId) => {
          const jobs = await matchingService.findNearbyPendingBookingsForTechnician(technicianId);
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
        })
      );
    } else {
      console.warn('Socket.io server instance unavailable; skipped technician broadcasts');
    }

    response.status(201).json({
      success: true,
      bookingId,
      fallbackPreference,
      dispatchStatus: booking.dispatch?.status,
      notifiedTechnicianIds: eligibleTechnicianIds
    });
  } catch (error) {
    console.error('Failed to create booking in MongoDB:', error);
    response.status(500).json({ message: 'Failed to create booking' });
  }
};

// ==========================================
// ✅ FINALIZE INVOICE ENGINE WORKER
// ==========================================

export const getBookingById = async (
  request: Request,
  response: Response
): Promise<void> => {
  const { id } = request.params;

  try {
    const booking = await Booking.findById(id);
    if (!booking) {
      response.status(404).json({ message: 'Booking not found' });
      return;
    }

    const [longitude, latitude] = booking.customerLocation.coordinates;

    const technicianUser = booking.technicianId && mongoose.Types.ObjectId.isValid(booking.technicianId)
      ? await User.findById(booking.technicianId).select('name phone profilePhotoUrl').lean()
      : null;
    const technicianProfile = booking.technicianId && mongoose.Types.ObjectId.isValid(booking.technicianId)
      ? await TechnicianModel.findOne({ userId: booking.technicianId }).select('lastLocation documents.profilePhotoUrl updatedAt').lean()
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
  } catch (error) {
    console.error('Failed to fetch booking details:', error);
    response.status(500).json({ message: 'Failed to fetch booking details' });
  }
};

export const getMyActiveBooking = async (
  request: Request,
  response: Response
): Promise<void> => {
  const authUser = getAuthenticatedUser(request);
  const customerId = String(authUser?.id ?? authUser?._id ?? '').trim();

  if (!customerId) {
    response.status(401).json({ message: 'Unauthorized. User context missing.' });
    return;
  }

  try {
    const booking = await Booking.findOne({
      customerId,
      status: {
        $in: [
          BookingStatus.PENDING,
          BookingStatus.ACCEPTED,
          BookingStatus.IN_ROUTE,
          BookingStatus.ARRIVED,
          BookingStatus.DIAGNOSTIC_DONE,
        ],
      },
    }).sort({ updatedAt: -1 });

    if (!booking) {
      response.status(200).json({ active: false, booking: null });
      return;
    }

    const [longitude, latitude] = booking.customerLocation.coordinates;

    const technicianUser = booking.technicianId && mongoose.Types.ObjectId.isValid(booking.technicianId)
      ? await User.findById(booking.technicianId).select('name phone profilePhotoUrl').lean()
      : null;
    const technicianProfile = booking.technicianId && mongoose.Types.ObjectId.isValid(booking.technicianId)
      ? await TechnicianModel.findOne({ userId: booking.technicianId }).select('lastLocation documents.profilePhotoUrl updatedAt').lean()
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
  } catch (error) {
    console.error('Failed to fetch active booking:', error);
    response.status(500).json({ message: 'Failed to fetch active booking' });
  }
};

export const getMyBookingHistory = async (
  request: Request,
  response: Response
): Promise<void> => {
  const authUser = getAuthenticatedUser(request);
  const customerId = String(authUser?.id ?? authUser?._id ?? '').trim();

  if (!customerId) {
    response.status(401).json({ message: 'Unauthorized. User context missing.' });
    return;
  }

  try {
    const bookings = await Booking.find({
      customerId,
      status: { $in: [BookingStatus.COMPLETED, BookingStatus.CANCELLED] },
    })
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();

    const bookingIds = bookings.map((booking) => booking._id);
    const invoices = await Invoice.find({ bookingId: { $in: bookingIds } }).lean();
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
  } catch (error) {
    console.error('Failed to fetch booking history:', error);
    response.status(500).json({ message: 'Failed to fetch booking history.' });
  }
};

export const acceptBooking = async (
  request: Request,
  response: Response
): Promise<void> => {
  const { id } = request.params;
  const body = request.body as AcceptBookingRequestBody;
  const authUser = getAuthenticatedUser(request);
  const role = normalizeUserRole(authUser?.role);

  if (role !== UserRole.TECHNICIAN && role !== UserRole.ADMIN) {
    response.status(403).json({ message: 'Only technician or admin accounts can accept bookings.' });
    return;
  }

  const technicianId =
    role === UserRole.ADMIN && typeof body.technicianId === 'string' && body.technicianId.trim()
      ? body.technicianId.trim()
      : String(authUser?.id ?? authUser?._id ?? '').trim();

  if (!technicianId) {
    response.status(400).json({ message: 'Missing technician identity.' });
    return;
  }

  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      response.status(400).json({ message: 'Invalid booking id.' });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(technicianId)) {
      response.status(400).json({ message: 'Invalid technician identity.' });
      return;
    }

    const existingBooking = await Booking.findById(id)
      .select('status serviceKey applianceType generalArea metadata countryCode dispatch createdAt')
      .lean();

    if (!existingBooking) {
      response.status(404).json({ message: 'Booking not found' });
      return;
    }

    if (existingBooking.status !== BookingStatus.PENDING) {
      response.status(409).json({ message: `Booking cannot be accepted from ${existingBooking.status} status.` });
      return;
    }

    const expiresAt = matchingService.getDispatchExpiry(existingBooking);
    if (expiresAt.getTime() <= Date.now()) {
      await Booking.updateOne(
        { _id: id, status: BookingStatus.PENDING },
        { $set: { 'dispatch.status': BookingDispatchStatus.EXPIRED } }
      );
      response.status(409).json({ message: 'Booking dispatch has expired.' });
      return;
    }

    const technician = mongoose.Types.ObjectId.isValid(technicianId)
      ? await TechnicianModel.findOne({
          userId: new mongoose.Types.ObjectId(technicianId),
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
    const isOpenPoolClaim =
      existingBooking.status === BookingStatus.PENDING ||
      existingBooking.dispatch?.status === BookingDispatchStatus.STANDBY ||
      String(existingBooking.dispatch?.status || '') === 'PENDING' ||
      sentToTechnicians.length === 0;
    const hasApprovedTechnicianProfile =
      technician?.approvalStatus === TechnicianApprovalStatus.APPROVED;

    const isEligible =
      role === UserRole.ADMIN ||
      (await matchingService.isTechnicianEligibleForBooking(technicianId, id)) ||
      (isOpenPoolClaim && hasApprovedTechnicianProfile);

    if (!isEligible) {
      response.status(403).json({ message: 'This booking is not available to this technician.' });
      return;
    }

    const now = new Date();
    const acceptedByTechnician = new mongoose.Types.ObjectId(technicianId);
    const booking = await Booking.findOneAndUpdate(
      {
        _id: id,
        status: BookingStatus.PENDING,
        $or: [
          { 'dispatch.expiresAt': { $gt: now } },
          { 'dispatch.expiresAt': { $exists: false }, createdAt: { $gte: new Date(now.getTime() - 30 * 60 * 1000) } },
        ],
      },
      {
        $set: {
          technicianId: acceptedByTechnician,
          status: BookingStatus.ACCEPTED,
          acceptedAt: now,
          'dispatch.status': BookingDispatchStatus.ACCEPTED,
          'dispatch.acceptedByTechnician': acceptedByTechnician,
        },
      },
      { new: true }
    );

    if (!booking) {
      response.status(409).json({ message: 'Booking is no longer available.' });
      return;
    }

    const io = request.app.get('io') as SocketIOServer | undefined;
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

    await createCustomerBookingNotification(
      booking,
      'TECHNICIAN_ACCEPTED',
      'Technician accepted your request',
      `A technician has accepted your ${booking.applianceType} request.`,
      { technicianId }
    );

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
  } catch (error) {
    console.error('Failed to accept booking:', error);
    response.status(500).json({ message: 'Failed to accept booking' });
  }
};

export const declineBooking = async (
  request: Request,
  response: Response
): Promise<void> => {
  const { id } = request.params;
  const authUser = getAuthenticatedUser(request);
  const role = normalizeUserRole(authUser?.role);
  const technicianId = String(authUser?.id ?? authUser?._id ?? '').trim();

  if (role !== UserRole.TECHNICIAN) {
    response.status(403).json({ message: 'Only technician accounts can decline bookings.' });
    return;
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    response.status(400).json({ message: 'Invalid booking id.' });
    return;
  }

  if (!mongoose.Types.ObjectId.isValid(technicianId)) {
    response.status(400).json({ message: 'Invalid technician identity.' });
    return;
  }

  try {
    const technicianObjectId = new mongoose.Types.ObjectId(technicianId);
    const booking = await Booking.findOneAndUpdate(
      { _id: id, status: BookingStatus.PENDING },
      {
        $set: {
          'dispatch.status': BookingDispatchStatus.BROADCASTING,
        },
        $addToSet: {
          'dispatch.declinedByTechnicians': technicianObjectId,
        },
      },
      { new: true }
    );

    if (!booking) {
      response.status(404).json({ message: 'Pending booking not found.' });
      return;
    }

    const io = request.app.get('io') as SocketIOServer | undefined;
    io?.to(`technician:${technicianId}`).emit('job_unavailable', {
      bookingId: booking.id,
      reason: 'declined',
    });

    response.status(200).json({
      success: true,
      bookingId: booking.id,
      status: booking.status,
    });
  } catch (error) {
    console.error('Failed to decline booking:', error);
    response.status(500).json({ message: 'Failed to decline booking' });
  }
};

export const updateBookingStatus = async (
  request: Request,
  response: Response
): Promise<void> => {
  const { id } = request.params;
  const body = request.body as UpdateBookingStatusRequestBody;
  const nextStatus = body.status;
  const authUser = getAuthenticatedUser(request);
  const role = normalizeUserRole(authUser?.role);

  if (!isBookingStatus(nextStatus)) {
    response.status(400).json({ message: 'Invalid booking status.' });
    return;
  }

  try {
    const booking = await Booking.findById(id);
    if (!booking) {
      response.status(404).json({ message: 'Booking not found' });
      return;
    }

    const userId = String(authUser?.id ?? authUser?._id ?? '');
    const isAssignedTechnician = String(booking.technicianId || '') === userId;
    const isCustomer = String(booking.customerId) === userId;
    const isAdmin = role === UserRole.ADMIN;

    if (!isAdmin && !isAssignedTechnician && !(isCustomer && nextStatus === BookingStatus.CANCELLED)) {
      response.status(403).json({ message: 'This account cannot update this booking.' });
      return;
    }

    const before = {
      status: booking.status,
      completedAt: booking.completedAt,
    };

    booking.status = nextStatus;
    if (nextStatus === BookingStatus.COMPLETED) booking.completedAt = new Date();
    if (nextStatus === BookingStatus.IN_ROUTE) booking.inRouteAt = new Date();
    if (nextStatus === BookingStatus.ARRIVED) booking.arrivedAt = new Date();
    if (nextStatus === BookingStatus.DIAGNOSTIC_DONE) booking.diagnosticDoneAt = new Date();
    if (nextStatus === BookingStatus.CANCELLED) {
      booking.cancelledAt = new Date();
      booking.dispatch = {
        ...(booking.dispatch ?? {
          status: BookingDispatchStatus.CANCELLED,
          sentToTechnicians: [],
          declinedByTechnicians: [],
        }),
        status: BookingDispatchStatus.CANCELLED,
      };
    }
    await booking.save();

    await logAuditEvent(request, {
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

    const io = request.app.get('io') as SocketIOServer | undefined;
    io?.to(`booking:${booking.id}`).emit('booking_status_changed', {
      bookingId: booking.id,
      status: booking.status,
      updatedAt: booking.updatedAt,
    });
    const statusNotificationMap: Partial<Record<BookingStatus, { type: string; title: string; message: string }>> = {
      [BookingStatus.IN_ROUTE]: {
        type: 'TECHNICIAN_EN_ROUTE',
        title: 'Technician is on the way',
        message: `Your technician is on the way for ${booking.applianceType}.`,
      },
      [BookingStatus.ARRIVED]: {
        type: 'TECHNICIAN_ARRIVED',
        title: 'Technician has arrived',
        message: `Your technician has arrived for ${booking.applianceType}.`,
      },
      [BookingStatus.COMPLETED]: {
        type: 'BOOKING_COMPLETED',
        title: 'Booking completed',
        message: `Your ${booking.applianceType} booking has been completed.`,
      },
      [BookingStatus.CANCELLED]: {
        type: 'BOOKING_CANCELLED',
        title: 'Booking cancelled',
        message: `Your ${booking.applianceType} booking has been cancelled.`,
      },
    };
    const notification = statusNotificationMap[nextStatus];
    if (notification) {
      await createCustomerBookingNotification(
        booking,
        notification.type,
        notification.title,
        notification.message
      );
    }
    if (nextStatus === BookingStatus.CANCELLED) {
      (booking.dispatch?.sentToTechnicians || []).forEach((targetId) => {
        io?.to(`technician:${targetId.toString()}`).emit('job_unavailable', {
          bookingId: booking.id,
          reason: 'cancelled',
        });
      });
    }
    if (nextStatus === BookingStatus.ARRIVED && booking.technicianId) {
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
  } catch (error) {
    console.error('Failed to update booking status:', error);
    response.status(500).json({ message: 'Failed to update booking status' });
  }
};

export const finalizeJobInvoice = async (
  request: Request,
  response: Response
): Promise<void> => {
  const body = request.body as FinalizeInvoiceRequestBody;
  const authUser = getAuthenticatedUser(request);
  const role = normalizeUserRole(authUser?.role);
  const userId = String(authUser?.id ?? authUser?._id ?? '');

  const bookingId = typeof body.bookingId === 'string' ? body.bookingId.trim() : '';
  const proofPhoto = typeof body.proofPhoto === 'string' ? body.proofPhoto.trim() : '';

  if (!bookingId) {
    response.status(400).json({ message: 'Missing require bookingId identity parameter' });
    return;
  }

  try {
    // 1. Find document inside MongoDB Atlas
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      response.status(404).json({ message: 'Booking entry record not found in system storage' });
      return;
    }

    const isAssignedTechnician = String(booking.technicianId || '') === userId;
    if (role !== UserRole.ADMIN && !isAssignedTechnician) {
      response.status(403).json({ message: 'Only the assigned technician or admin can finalize this job.' });
      return;
    }

    const approvedQuote = await JobQuote.findOne({
      bookingId: booking._id,
      status: QuoteStatus.APPROVED,
    }).sort({ approvedAt: -1 });

    const fallbackBaseAmount = toFiniteNumber(body.baseAmount) ?? decimalFromMinor(booking.priceMinor);
    const fallbackAdditionalLabor = toFiniteNumber(body.additionalLabor) ?? 0;
    const fallbackPartsAmount = toFiniteNumber(body.partsAmount) ?? 0;

    const baseAmount = approvedQuote
      ? approvedQuote.lineItems
          .filter((item) => item.type === QuoteLineItemType.CALLOUT)
          .reduce((sum, item) => sum + decimalFromMinor(item.totalAmountMinor), 0) || decimalFromMinor(booking.priceMinor)
      : fallbackBaseAmount;
    const additionalLabor = approvedQuote
      ? approvedQuote.lineItems
          .filter((item) => item.type === QuoteLineItemType.LABOR || item.type === QuoteLineItemType.ADD_ON || item.type === QuoteLineItemType.SURCHARGE)
          .reduce((sum, item) => sum + decimalFromMinor(item.totalAmountMinor), 0)
      : fallbackAdditionalLabor;
    const partsAmount = approvedQuote
      ? approvedQuote.lineItems
          .filter((item) => item.type === QuoteLineItemType.PART)
          .reduce((sum, item) => sum + decimalFromMinor(item.totalAmountMinor), 0)
      : fallbackPartsAmount;
    const totalAmount = approvedQuote
      ? decimalFromMinor(approvedQuote.totalAmountMinor)
      : toFiniteNumber(body.totalAmount) ?? (baseAmount + additionalLabor + partsAmount);

    const baseAmountMinor = toMinorUnits(baseAmount, booking.currency);
    const additionalLaborMinor = toMinorUnits(additionalLabor, booking.currency);
    const partsAmountMinor = toMinorUnits(partsAmount, booking.currency);
    const totalAmountMinor = toMinorUnits(totalAmount, booking.currency);
    const market = getMarketByCountry(booking.countryCode);
    const platformCommissionBps = market.platformCommissionBps;
    const platformCommissionAmountMinor = Math.round((totalAmountMinor * platformCommissionBps) / 10000);
    const technicianNetAmountMinor = Math.max(totalAmountMinor - platformCommissionAmountMinor, 0);
    const platformCommissionAmount = fromMinorUnits(platformCommissionAmountMinor, booking.currency);
    const technicianNetAmount = fromMinorUnits(technicianNetAmountMinor, booking.currency);

    const beforeFinalization = {
      status: booking.status,
      completedAt: booking.completedAt,
      finalBilling: booking.finalBilling || null,
    };

    // 2. ASSIGN USING THE ENUM INSTEAD OF A RAW STRING LITERAL 🎯
    booking.status = BookingStatus.COMPLETED;
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

    if (
      mongoose.Types.ObjectId.isValid(booking.customerId) &&
      booking.technicianId &&
      mongoose.Types.ObjectId.isValid(booking.technicianId)
    ) {
      const invoiceNumber = `INV-${new Date().getFullYear()}-${booking.id.slice(-6).toUpperCase()}`;
      const existingInvoice = await Invoice.findOne({ bookingId: booking._id });
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

      const invoice = await Invoice.findOneAndUpdate(
        { bookingId: booking._id },
        {
          invoiceNumber,
          bookingId: booking._id,
          customerId: new mongoose.Types.ObjectId(booking.customerId),
          technicianId: new mongoose.Types.ObjectId(booking.technicianId),
          countryCode: booking.countryCode,
          currency: booking.currency,
          baseAmountMinor,
          additionalLaborMinor,
          partsAmountMinor,
          totalAmountMinor,
          platformCommissionBps,
          platformCommissionAmountMinor,
          technicianNetAmountMinor,
          status: InvoiceStatus.UNPAID,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      await logAuditEvent(request, {
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
        await Wallet.findOneAndUpdate(
          { technicianId: new mongoose.Types.ObjectId(booking.technicianId) },
          {
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
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }

      const ledgerBase = {
        bookingId: booking._id,
        invoiceId: invoice._id,
        customerId: new mongoose.Types.ObjectId(booking.customerId),
        technicianId: new mongoose.Types.ObjectId(booking.technicianId),
        countryCode: booking.countryCode,
        currency: booking.currency,
        metadata: { quoteId: approvedQuote?.id ?? null },
      };

      if (!existingInvoice) {
        await WalletTransaction.create([
          {
            ...ledgerBase,
            type: WalletTransactionType.CLIENT_PAYMENT,
            status: WalletTransactionStatus.PENDING,
            amountMinor: totalAmountMinor,
            description: 'Client payment due for completed job',
          },
          {
            ...ledgerBase,
            type: WalletTransactionType.PLATFORM_COMMISSION,
            status: WalletTransactionStatus.POSTED,
            amountMinor: platformCommissionAmountMinor,
            description: `MyFixer platform commission (${platformCommissionBps / 100}%)`,
          },
          {
            ...ledgerBase,
            type: WalletTransactionType.TECHNICIAN_EARNING_PENDING,
            status: WalletTransactionStatus.POSTED,
            amountMinor: technicianNetAmountMinor,
            description: 'Technician net earning pending release',
          },
        ]);
      } else if (walletPendingDeltaMinor !== 0) {
        await WalletTransaction.create({
          ...ledgerBase,
          type: WalletTransactionType.ADJUSTMENT,
          status: WalletTransactionStatus.POSTED,
          amountMinor: walletPendingDeltaMinor,
          description: 'Invoice adjustment delta after refinalization',
        });
      }
    } else {
      console.warn(`Skipped invoice/wallet linkage for booking ${bookingId}; customer or technician id is not a Mongo ObjectId.`);
    }

    const io = request.app.get('io') as SocketIOServer | undefined;
    io?.to(`booking:${booking.id}`).emit('booking_status_changed', {
      bookingId: booking.id,
      status: booking.status,
      updatedAt: booking.updatedAt,
    });
    await createCustomerBookingNotification(
      booking,
      'INVOICE_GENERATED',
      'Invoice generated',
      `Your invoice for ${booking.applianceType} has been generated.`,
      { totalAmountMinor, currency: booking.currency }
    );
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
    const emailSent = await EmailService.sendJobInvoiceEmail({
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

    await logAuditEvent(request, {
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

  } catch (error) {
    console.error('Failed to settle final billing operations endpoint run:', error);
    response.status(500).json({ message: 'Failed to process job closure accounting entries' });
  }
};
