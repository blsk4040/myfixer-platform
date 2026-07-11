// src/controllers/booking.controller.ts
import { Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import mongoose from 'mongoose';
// 1. IMPORT BookingStatus ENUM HERE
import Booking, { BookingCancellationBy, BookingDispatchStatus, BookingStatus, IBooking } from '../models/booking.model';
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
import TechnicianModel, { TechnicianApprovalStatus, VerificationStatus } from '../models/technician.model';
import TechnicianCapability, { CapabilityStatus } from '../models/technician-capability.model';
import ServiceWaitlist, {
  ServiceWaitlistSource,
  ServiceWaitlistStatus,
} from '../models/service-waitlist.model';
import MarketSetting, { MarketStatus } from '../models/market-setting.model';
import Promotion, { PromotionDiscountType, PromotionStatus } from '../models/promotion.model';
import { logAuditEvent } from '../services/audit.service';
import { AuditSeverity } from '../models/audit-log.model';
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
import {
  BookingWorkflowError,
  confirmBookingArrival,
  findBookingForWorkflow,
  transitionBookingStatus,
} from '../services/booking-workflow.service';
import {
  InspectionWorkflowError,
  completeInspectionForBooking,
  evaluateWorkStartEligibility,
  persistWorkStartEligibility,
  startInspectionForBooking,
} from '../services/inspection-workflow.service';
import {
  BookingRecipientValidationError,
  normalizeServiceRecipient,
} from '../services/booking-recipient.service';
import {
  isAssignedTechnicianWithPreciseAccess,
  serializeBookingForAdmin,
  serializeBookingForAssignedTechnician,
  serializeBookingForOwner,
  serializeBookingForUnassignedTechnician,
} from '../services/booking-privacy.service';

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
  preferred_technician_id?: unknown;
  preferredTechnicianId?: unknown;
  rebook_from_booking_id?: unknown;
  rebookFromBookingId?: unknown;
  fallbackPreference?: unknown;
  fallback_preference?: unknown;
  scheduledAt?: unknown;
  scheduled_at?: unknown;
  scheduledStartTime?: unknown;
  scheduled_start_time?: unknown;
  scheduledEndTime?: unknown;
  scheduled_end_time?: unknown;
  email?: unknown;
  phone?: unknown;
  service_recipient?: unknown;
  serviceRecipient?: unknown;
  recipient?: unknown;
  is_for_someone_else?: unknown;
  isForSomeoneElse?: unknown;
  onsite_contact_name?: unknown;
  onsite_contact_phone?: unknown;
  contactName?: unknown;
  contactPhone?: unknown;
  promo_code?: unknown;
  promoCode?: unknown;
}

interface AcceptBookingRequestBody {
  technicianId?: unknown;
}

interface UpdateBookingStatusRequestBody {
  status?: unknown;
}

interface ArrivalConfirmationRequestBody {
  latitude?: unknown;
  longitude?: unknown;
  accuracyMeters?: unknown;
  recordedAt?: unknown;
}

interface InspectionRequestBody {
  latitude?: unknown;
  longitude?: unknown;
  accuracyMeters?: unknown;
  recordedAt?: unknown;
  acknowledgePlatformRules?: unknown;
  diagnosisNotes?: unknown;
  technicalObservations?: unknown;
  quoteRequired?: unknown;
  partsRequired?: unknown;
  evidenceMediaIds?: unknown;
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

const normalizePromoCode = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toUpperCase().replace(/\s+/g, '') : '';

const calculatePromotionDiscount = async (args: {
  promoCode: string;
  customerId: string;
  amountMinor: number;
  countryCode: CountryCode;
  currency: string;
}): Promise<{ discountMinor: number; promotion: any } | null> => {
  if (!args.promoCode) return null;

  const now = new Date();
  const promotion = await Promotion.findOne({
    code: args.promoCode,
    status: PromotionStatus.ACTIVE,
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
      { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
      { $or: [{ countryCode: null }, { countryCode: args.countryCode }] },
      { $or: [{ currency: null }, { currency: args.currency }] },
    ],
  });

  if (!promotion) {
    throw new Error('Promo code is invalid or expired.');
  }

  if (promotion.usageLimit !== null && promotion.usageLimit !== undefined && promotion.usageCount >= promotion.usageLimit) {
    throw new Error('Promo code usage limit has been reached.');
  }

  if (args.amountMinor < promotion.minBookingAmountMinor) {
    throw new Error('Promo code minimum booking amount has not been met.');
  }

  let discountMinor = promotion.discountType === PromotionDiscountType.PERCENTAGE
    ? Math.floor((args.amountMinor * promotion.discountValue) / 100)
    : Math.round(promotion.discountValue);

  if (promotion.maxDiscountMinor !== null && promotion.maxDiscountMinor !== undefined) {
    discountMinor = Math.min(discountMinor, promotion.maxDiscountMinor);
  }

  discountMinor = Math.min(Math.max(discountMinor, 0), args.amountMinor);
  return { discountMinor, promotion };
};

const isBookingStatus = (value: unknown): value is BookingStatus =>
  typeof value === 'string' && Object.values(BookingStatus).includes(value as BookingStatus);

type DispatchFallbackPreference = 'STANDBY' | 'SCHEDULED' | 'WAITLIST';

const normalizeFallbackPreference = (value: unknown): DispatchFallbackPreference => {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return normalized === 'SCHEDULED' || normalized === 'WAITLIST' ? normalized : 'STANDBY';
};

const parseDateInput = (value: unknown): Date | null =>
  typeof value === 'string' || value instanceof Date ? new Date(value) : null;

const isValidDate = (value: Date | null): value is Date =>
  Boolean(value && !Number.isNaN(value.getTime()));

const isMarketServiceExplicitlyActive = async (countryCode: string, serviceKey: string): Promise<boolean> => {
  const setting = await MarketSetting.findOne({ 'identity.countryCode': countryCode })
    .select('identity.countryCode coverage.serviceCategories coverage.cityServiceAvailability')
    .lean();

  if (!setting) return false;

  const normalizeEntry = (entry: unknown): { serviceKey: string; status: MarketStatus } | null => {
    if (typeof entry === 'string') {
      return { serviceKey: normalizeDispatchServiceKey(entry), status: MarketStatus.ACTIVE };
    }
    if (!entry || typeof entry !== 'object') return null;
    const record = entry as Record<string, unknown>;
    return {
      serviceKey: normalizeDispatchServiceKey(record.serviceKey ?? record.key ?? record.value ?? record.label),
      status: Object.values(MarketStatus).includes(record.status as MarketStatus)
        ? (record.status as MarketStatus)
        : MarketStatus.DISABLED,
    };
  };

  const matches = [
    ...((setting.coverage?.serviceCategories || []).map(normalizeEntry)),
    ...((setting.coverage?.cityServiceAvailability || []).flatMap((city) => {
      const record = city as Record<string, unknown>;
      const services = Array.isArray(record.services) ? record.services : [];
      const areas = Array.isArray(record.areas) ? record.areas : [];
      return [
        ...services.map(normalizeEntry),
        ...areas.flatMap((area) => {
          const areaRecord = area as Record<string, unknown>;
          return Array.isArray(areaRecord.services) ? areaRecord.services.map(normalizeEntry) : [];
        }),
      ];
    })),
  ].filter((entry): entry is { serviceKey: string; status: MarketStatus } => Boolean(entry?.serviceKey));

  return matches.some((entry) => entry.serviceKey === serviceKey && entry.status === MarketStatus.ACTIVE);
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

const buildIncomingRequestPayload = (booking: IBooking) =>
  serializeBookingForUnassignedTechnician(booking, { categoryMatch: true });

const safelyLogAuditEvent = async (
  request: Request,
  input: Parameters<typeof logAuditEvent>[1]
): Promise<void> => {
  try {
    await logAuditEvent(request, input);
  } catch (error) {
    console.warn('Audit event could not be recorded:', {
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
    });
  }
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
): Promise<any[]> => {
  const customerId = String(booking.customerId || '').trim();
  if (!mongoose.Types.ObjectId.isValid(customerId)) return [];

  return createNotifications({
    userId: customerId,
    email: booking.customerEmail || '',
    name: booking.customerName || 'Client',
    channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
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

const stripScheduleMarker = (value: unknown): string => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text.replace(/\s*\((ASAP|Urgent \/ Right Now|[^)]*\d{1,2}:\d{2}[^)]*)\)\s*$/i, '').trim() || text || 'service';
};

const providerRoleForService = (serviceKey: unknown): string => {
  const key = normalizeDispatchServiceKey(serviceKey);
  if (key === 'cleaning') return 'cleaner';
  if (key === 'plumbing') return 'plumber';
  if (key === 'electrical') return 'electrician';
  if (key === 'gardening') return 'gardener';
  if (key === 'painting') return 'painter';
  if (key === 'automotive') return 'mechanic';
  return 'technician';
};

const serviceLabelForNotification = (booking: { serviceKey?: unknown; applianceType?: unknown; metadata?: Record<string, unknown> | null }): string =>
  stripScheduleMarker(booking.applianceType || booking.metadata?.serviceKey || booking.serviceKey || 'service');

const formatScheduledBookingTime = (value: Date): string =>
  value.toLocaleString('en-ZA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const createTechnicianJobNotification = async (
  technicianId: string,
  booking: {
    id?: string;
    _id?: unknown;
    applianceType?: string;
    generalArea?: string;
    priceMinor?: number;
    currency?: string;
  }
): Promise<any[]> => {
  if (!mongoose.Types.ObjectId.isValid(technicianId)) return [];

  return createNotifications({
    userId: technicianId,
    channels: [NotificationChannel.PUSH],
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
    .select('_id countryCode serviceCategories documents.profilePhotoStatus')
    .lean();

  if (!technician) return false;
  if (technician.documents?.profilePhotoStatus !== VerificationStatus.VERIFIED) return false;
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

const validatePreferredProviderRebooking = async (input: {
  customerId: string;
  preferredTechnicianId: string;
  rebookFromBookingId: string;
  requestedServiceKey: string;
  countryCode: CountryCode;
}): Promise<{ allowed: boolean; message?: string; preferredTechnicianObjectId?: mongoose.Types.ObjectId }> => {
  if (!input.preferredTechnicianId && !input.rebookFromBookingId) return { allowed: true };

  if (!mongoose.Types.ObjectId.isValid(input.preferredTechnicianId)) {
    return { allowed: false, message: 'Invalid preferred provider.' };
  }

  if (!mongoose.Types.ObjectId.isValid(input.rebookFromBookingId)) {
    return { allowed: false, message: 'A previous completed MyFixer booking is required to rebook a preferred provider.' };
  }

  const sourceBooking = await Booking.findOne({
    _id: input.rebookFromBookingId,
    customerId: new mongoose.Types.ObjectId(input.customerId),
    technicianId: new mongoose.Types.ObjectId(input.preferredTechnicianId),
    status: BookingStatus.COMPLETED,
  })
    .select('serviceKey metadata countryCode technicianId')
    .lean();

  if (!sourceBooking) {
    return { allowed: false, message: 'You can only rebook a provider from your own completed MyFixer jobs.' };
  }

  const previousServiceKey = normalizeDispatchServiceKey(sourceBooking.serviceKey ?? sourceBooking.metadata?.serviceKey);
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
    preferredTechnicianObjectId: new mongoose.Types.ObjectId(input.preferredTechnicianId),
  };
};

const hasValidDefaultServiceAddress = (user: any): boolean => {
  const address = user?.defaultServiceAddress;
  return Boolean(address?.fullAddress && address?.city && address?.suburb);
};

const isCustomerReadyToBook = (user: any): boolean => {
  if (!user || normalizeUserRole(user.role) !== UserRole.CUSTOMER) return true;
  if (user.profileCompleted === true && (user.isEmailVerified === true || user.emailVerified === true)) return true;

  const legacyProfileComplete = Boolean(
    user.name &&
    user.phone &&
    user.countryCode &&
    user.location?.city &&
    user.location?.area &&
    hasValidDefaultServiceAddress(user)
  );

  return legacyProfileComplete && (user.isEmailVerified === true || user.emailVerified === true);
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
  const preferredTechnicianId =
    typeof (body.preferredTechnicianId ?? body.preferred_technician_id) === 'string'
      ? String(body.preferredTechnicianId ?? body.preferred_technician_id).trim()
      : '';
  const rebookFromBookingId =
    typeof (body.rebookFromBookingId ?? body.rebook_from_booking_id) === 'string'
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

  let countryCode = CountryCode.ZA;
  let customer: any = null;
  if (mongoose.Types.ObjectId.isValid(customerId)) {
    customer = await User.findById(customerId)
      .select('name phone role countryCode location defaultServiceAddress profileCompleted isEmailVerified emailVerified')
      .lean();
    countryCode = normalizeCountryCode(body.country_code ?? customer?.countryCode ?? customer?.location?.country);
  } else {
    countryCode = normalizeCountryCode(body.country_code);
  }

  const market = getMarketByCountry(countryCode);
  const callOutFee = toFiniteNumber(body.call_out_fee) ?? market.defaultCalloutFee;
  const originalPriceMinor = toMinorUnits(callOutFee, market.currency);
  let priceMinor = originalPriceMinor;
  let appliedPromotion: { discountMinor: number; promotion: any } | null = null;

  if (!customerId || !applianceType || !fullAddress || latitude === null || longitude === null) {
    response.status(400).json({ message: 'Missing or invalid booking layout items' });
    return;
  }

  if (!mongoose.Types.ObjectId.isValid(customerId)) {
    response.status(401).json({ message: 'Invalid customer identity.' });
    return;
  }

  if (!customer) {
    response.status(404).json({ message: 'Customer profile not found.' });
    return;
  }

  if (normalizeUserRole(customer.role) === UserRole.CUSTOMER && !isCustomerReadyToBook(customer)) {
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

  if (promoCode) {
    try {
      appliedPromotion = await calculatePromotionDiscount({
        promoCode,
        customerId,
        amountMinor: originalPriceMinor,
        countryCode: market.countryCode,
        currency: market.currency,
      });
      if (appliedPromotion) {
        priceMinor = Math.max(originalPriceMinor - appliedPromotion.discountMinor, 0);
      }
    } catch (error: any) {
      response.status(400).json({ message: error.message || 'Promo code could not be applied.' });
      return;
    }
  }

  let serviceRecipient;
  try {
    serviceRecipient = normalizeServiceRecipient(body as Record<string, unknown>, {
      customer,
      countryCode,
      city: requestedCity || customer?.location?.city || '',
      fullAddress,
      streetAddress: streetAddress || fullAddress,
      hasServiceCoordinates: latitude !== null && longitude !== null,
    });
  } catch (error) {
    if (error instanceof BookingRecipientValidationError) {
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

  const explicitlyActive = await isMarketServiceExplicitlyActive(market.countryCode, requestedServiceKey);
  if (!explicitlyActive) {
    response.status(409).json({
      message: 'This service is not active in the selected market coverage settings.',
      serviceStatus: MarketStatus.DISABLED,
      serviceKey: requestedServiceKey,
    });
    return;
  }

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
      serviceRecipient,
      status: isPreBook ? BookingStatus.SCHEDULED : BookingStatus.PENDING,
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
        fallbackPreference,
        scheduledAt: isValidDate(scheduledAt) ? scheduledAt : null,
        preferredTechnicianId: preferredRebooking.preferredTechnicianObjectId?.toString() || '',
        rebookFromBookingId,
        rebookPolicy: preferredRebooking.preferredTechnicianObjectId
          ? 'PREFERRED_PROVIDER_FIRST_WITH_MYFIXER_PROTECTION'
          : '',
        promotion: appliedPromotion ? {
          code: appliedPromotion.promotion.code,
          promotionId: appliedPromotion.promotion._id.toString(),
          discountType: appliedPromotion.promotion.discountType,
          discountValue: appliedPromotion.promotion.discountValue,
          originalPriceMinor,
          discountMinor: appliedPromotion.discountMinor,
        } : undefined,
      },
      priceMinor,
      countryCode: market.countryCode,
      currency: market.currency,
      dispatch: {
        status: isPreBook ? BookingDispatchStatus.SCHEDULED : BookingDispatchStatus.BROADCASTING,
        expiresAt: isPreBook ? null : matchingService.getDispatchExpiry({ createdAt: new Date() }),
        sentToTechnicians: [],
        declinedByTechnicians: [],
        preferredTechnicianId: preferredRebooking.preferredTechnicianObjectId ?? null,
      },
    });

    const bookingId = booking.id;

    if (appliedPromotion) {
      await Promotion.updateOne(
        { _id: appliedPromotion.promotion._id },
        { $inc: { usageCount: 1 } }
      );
    }

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
    const notificationServiceLabel = serviceLabelForNotification(booking);
    const scheduledNotificationText = isPreBook && isValidDate(scheduledAt)
      ? formatScheduledBookingTime(scheduledAt)
      : '';
    await createCustomerBookingNotification(
      booking,
      'BOOKING_CREATED',
      `${notificationServiceLabel} request ${isPreBook ? 'scheduled' : 'submitted'}`,
      isPreBook && scheduledNotificationText
        ? `Your ${notificationServiceLabel} request is scheduled for ${scheduledNotificationText}. We will notify you when a provider is assigned.`
        : `We are finding a ${providerRoleForService(requestedServiceKey)} near you. We will notify you when someone accepts.`,
      {
        serviceKey: requestedServiceKey,
        scheduledAt: isPreBook && isValidDate(scheduledAt) ? scheduledAt.toISOString() : null,
        bookingStatus: isPreBook ? BookingStatus.SCHEDULED : BookingStatus.PENDING,
      }
    );
    
    // 2. Broadcast the open request to every eligible online approved technician.
    const eligibleTechnicianIds =
      fallbackPreference === 'SCHEDULED' || isPreBook
        ? []
        : await matchingService.findEligibleOnlineTechniciansForBooking(bookingId);
    const preferredTechnicianUserId = preferredRebooking.preferredTechnicianObjectId?.toString() || '';
    const orderedEligibleTechnicianIds = preferredTechnicianUserId && eligibleTechnicianIds.includes(preferredTechnicianUserId)
      ? [
          preferredTechnicianUserId,
          ...eligibleTechnicianIds.filter((technicianId) => technicianId !== preferredTechnicianUserId),
        ].filter((technicianId, index, list) => list.indexOf(technicianId) === index)
      : eligibleTechnicianIds;

    console.info('[dispatch-test] findEligibleTechniciansWithTelemetryPipeline output', {
      bookingId,
      serviceKey: requestedServiceKey,
      customerCoordinates: [longitude, latitude],
      eligibleTechnicianIds: orderedEligibleTechnicianIds,
      preferredTechnicianId: preferredTechnicianUserId,
      matchedCount: orderedEligibleTechnicianIds.length,
    });

    if (orderedEligibleTechnicianIds.length > 0) {
      booking.dispatch = {
        ...(booking.dispatch ?? {
          status: BookingDispatchStatus.BROADCASTING,
          expiresAt: matchingService.getDispatchExpiry(booking),
          sentToTechnicians: [],
          declinedByTechnicians: [],
        }),
        sentToTechnicians: orderedEligibleTechnicianIds.map((technicianId) => new mongoose.Types.ObjectId(technicianId)),
      };
      await booking.save();
    } else {
      if (fallbackPreference === 'SCHEDULED' || isPreBook) {
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
          scheduledAt: isValidDate(scheduledAt) ? scheduledAt : null,
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
        orderedEligibleTechnicianIds.map((technicianId) =>
          emitIncomingRequest(io, technicianId, incomingRequestPayload)
        )
      );
      await Promise.all(
        orderedEligibleTechnicianIds.map((technicianId) =>
          createTechnicianJobNotification(technicianId, booking)
        )
      );
      await Promise.all(
        orderedEligibleTechnicianIds.map(async (technicianId) => {
          const jobs = await matchingService.findNearbyPendingBookingsForTechnician(technicianId);
          io.to(`technician:${technicianId}`).emit('available_jobs', jobs);
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
      preferredTechnicianId: preferredTechnicianUserId || null,
      notifiedTechnicianIds: orderedEligibleTechnicianIds
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
  const authUser = getAuthenticatedUser(request);
  const userId = String(authUser?.id ?? authUser?._id ?? '').trim();
  const role = normalizeUserRole(authUser?.role);

  try {
    let booking = await Booking.findById(id);
    if (!booking) {
      response.status(404).json({ message: 'Booking not found' });
      return;
    }

    const isAdmin = role === UserRole.ADMIN;
    const isCustomer = String(booking.customerId) === userId;
    const isAssignedTechnician = String(booking.technicianId || '') === userId;
    if (!isAdmin && !isCustomer && !isAssignedTechnician) {
      await safelyLogAuditEvent(request, {
        action: 'booking.precise_location.rejected',
        module: 'BOOKINGS',
        resourceType: 'Booking',
        resourceId: booking.id,
        severity: AuditSeverity.WARNING,
        metadata: {
          actorRole: role,
          reason: 'not_owner_or_assigned_technician',
        },
        success: false,
      });
      response.status(403).json({ message: 'This account cannot access this booking.' });
      return;
    }

    const technicianUser = booking.technicianId && mongoose.Types.ObjectId.isValid(booking.technicianId)
      ? await User.findById(booking.technicianId).select('name phone profilePhotoUrl').lean()
      : null;
    const technicianProfile = booking.technicianId && mongoose.Types.ObjectId.isValid(booking.technicianId)
      ? await TechnicianModel.findOne({ userId: booking.technicianId }).select('lastLocation documents.profilePhotoUrl documents.profilePhotoStatus updatedAt').lean()
      : null;
    const approvedTechnicianPhotoUrl = technicianProfile?.documents?.profilePhotoStatus === VerificationStatus.VERIFIED
      ? technicianProfile.documents.profilePhotoUrl
      : '';

    const serialized = isAdmin
      ? serializeBookingForAdmin(booking)
      : isCustomer
        ? serializeBookingForOwner(booking)
        : serializeBookingForAssignedTechnician(booking);

    if (isAssignedTechnician) {
      if (!isAssignedTechnicianWithPreciseAccess(booking, userId)) {
        await safelyLogAuditEvent(request, {
          action: 'booking.precise_location.rejected',
          module: 'BOOKINGS',
          resourceType: 'Booking',
          resourceId: booking.id,
          severity: AuditSeverity.WARNING,
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
          BookingStatus.SCHEDULED,
          BookingStatus.ACCEPTED,
          BookingStatus.IN_ROUTE,
          BookingStatus.ARRIVED,
          BookingStatus.IN_PROGRESS,
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
      ? await TechnicianModel.findOne({ userId: booking.technicianId }).select('lastLocation documents.profilePhotoUrl documents.profilePhotoStatus updatedAt').lean()
      : null;
    const approvedTechnicianPhotoUrl = technicianProfile?.documents?.profilePhotoStatus === VerificationStatus.VERIFIED
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
      $or: [
        {
          status: {
            $in: [
              BookingStatus.PENDING,
              BookingStatus.SCHEDULED,
              BookingStatus.ACCEPTED,
              BookingStatus.IN_ROUTE,
              BookingStatus.ARRIVED,
              BookingStatus.IN_PROGRESS,
              BookingStatus.DIAGNOSTIC_DONE,
              BookingStatus.COMPLETED,
              BookingStatus.CANCELLED,
            ],
          },
        },
        { 'dispatch.status': BookingDispatchStatus.STANDBY },
      ],
    })
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();

    const bookingIds = bookings.map((booking) => booking._id);
    const invoices = await Invoice.find({ bookingId: { $in: bookingIds } }).lean();
    const invoiceByBookingId = new Map(invoices.map((invoice) => [String(invoice.bookingId), invoice]));
    const technicianUserIds = Array.from(
      new Set(
        bookings
          .map((booking) => booking.technicianId)
          .filter((id): id is mongoose.Types.ObjectId => Boolean(id && mongoose.Types.ObjectId.isValid(id)))
          .map((id) => id.toString())
      )
    );
    const [technicianUsers, technicianProfiles] = await Promise.all([
      User.find({ _id: { $in: technicianUserIds } }).select('name phone profilePhotoUrl').lean(),
      TechnicianModel.find({ userId: { $in: technicianUserIds } })
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
        const approvedTechnicianPhotoUrl = technicianProfile?.documents?.profilePhotoStatus === VerificationStatus.VERIFIED
          ? technicianProfile.documents.profilePhotoUrl
          : '';
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

    if (![BookingStatus.PENDING, BookingStatus.SCHEDULED].includes(existingBooking.status)) {
      response.status(409).json({ message: `Booking cannot be accepted from ${existingBooking.status} status.` });
      return;
    }

    const expiresAt = matchingService.getDispatchExpiry(existingBooking);
    if (existingBooking.dispatch?.status !== BookingDispatchStatus.SCHEDULED && expiresAt.getTime() <= Date.now()) {
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
    const isOpenPoolClaim =
      existingBooking.status === BookingStatus.PENDING ||
      existingBooking.status === BookingStatus.SCHEDULED ||
      existingBooking.dispatch?.status === BookingDispatchStatus.STANDBY ||
      existingBooking.dispatch?.status === BookingDispatchStatus.SCHEDULED ||
      String(existingBooking.dispatch?.status || '') === 'PENDING' ||
      sentToTechnicians.length === 0;
    const hasApprovedTechnicianProfile =
      technician?.approvalStatus === TechnicianApprovalStatus.APPROVED &&
      technician.documents?.profilePhotoStatus === VerificationStatus.VERIFIED;

    const canClaimOpenPool = isOpenPoolClaim && hasApprovedTechnicianProfile
      ? await canTechnicianClaimOpenBooking(technicianId, existingBooking)
      : false;

    const isEligible =
      role === UserRole.ADMIN ||
      (await matchingService.isTechnicianEligibleForBooking(technicianId, id)) ||
      canClaimOpenPool;

    if (!isEligible) {
      response.status(403).json({ message: 'This booking is not available to this technician.' });
      return;
    }

    const now = new Date();
    const acceptedByTechnician = new mongoose.Types.ObjectId(technicianId);
    const booking = await Booking.findOneAndUpdate(
      {
        _id: id,
        status: { $in: [BookingStatus.PENDING, BookingStatus.SCHEDULED] },
        $or: [
          { 'dispatch.status': BookingDispatchStatus.SCHEDULED },
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
      booking: serializeBookingForAssignedTechnician(booking),
    });

    const inboxMessages = await createCustomerBookingNotification(
      booking,
      'TECHNICIAN_ACCEPTED',
      `${providerRoleForService(booking.serviceKey)} found`,
      `Your ${providerRoleForService(booking.serviceKey)} accepted the ${serviceLabelForNotification(booking)} request.`,
      { technicianId }
    );
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
      booking: serializeBookingForAssignedTechnician(booking),
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

  if ([BookingStatus.ARRIVED, BookingStatus.IN_PROGRESS, BookingStatus.COMPLETED].includes(nextStatus)) {
    response.status(400).json({
      message: 'Use the dedicated booking workflow endpoint for this status transition.',
    });
    return;
  }

  try {
    let booking: IBooking | null = await Booking.findById(id);
    if (!booking) {
      response.status(404).json({ message: 'Booking not found' });
      return;
    }

    const before = {
      status: booking.status,
      completedAt: booking.completedAt,
    };

    booking = await transitionBookingStatus({
      booking,
      actor: authUser,
      nextStatus,
      action: nextStatus === BookingStatus.CANCELLED ? 'CANCEL_BOOKING' : 'START_ROUTE',
    });

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
        title: `${providerRoleForService(booking.serviceKey)} on the way`,
        message: `Your ${providerRoleForService(booking.serviceKey)} is heading to your ${serviceLabelForNotification(booking)} job.`,
      },
      [BookingStatus.ARRIVED]: {
        type: 'TECHNICIAN_ARRIVED',
        title: `${providerRoleForService(booking.serviceKey)} arrived`,
        message: `Your ${providerRoleForService(booking.serviceKey)} has arrived for ${serviceLabelForNotification(booking)}.`,
      },
      [BookingStatus.IN_PROGRESS]: {
        type: 'JOB_STARTED',
        title: `${serviceLabelForNotification(booking)} in progress`,
        message: `Work has started on your ${serviceLabelForNotification(booking)} request.`,
      },
      [BookingStatus.COMPLETED]: {
        type: 'BOOKING_COMPLETED',
        title: `${serviceLabelForNotification(booking)} completed`,
        message: `Your ${serviceLabelForNotification(booking)} job is complete. Please review the service.`,
      },
      [BookingStatus.CANCELLED]: {
        type: 'BOOKING_CANCELLED',
        title: `${serviceLabelForNotification(booking)} cancelled`,
        message: `Your ${serviceLabelForNotification(booking)} request has been cancelled.`,
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
    if (error instanceof BookingWorkflowError) {
      response.status(error.statusCode).json({ message: error.message, code: error.code });
      return;
    }
    console.error('Failed to update booking status:', error);
    response.status(500).json({ message: 'Failed to update booking status' });
  }
};

const runWorkflowStatusAction = async (
  request: Request,
  response: Response,
  nextStatus: BookingStatus,
  action: 'START_ROUTE' | 'START_JOB'
): Promise<void> => {
  const bookingId = request.params.id ?? request.params.bookingId;

  try {
    let booking = await findBookingForWorkflow(bookingId);
    const before = { status: booking.status, completedAt: booking.completedAt };
    booking = await transitionBookingStatus({
      booking,
      actor: getAuthenticatedUser(request),
      nextStatus,
      action,
    });

    await logAuditEvent(request, {
      action: action === 'START_ROUTE' ? 'booking.start_route' : 'booking.start_job',
      module: 'BOOKINGS',
      resourceType: 'Booking',
      resourceId: booking.id,
      changes: {
        before,
        after: { status: booking.status, completedAt: booking.completedAt },
      },
    });

    const io = request.app.get('io') as SocketIOServer | undefined;
    io?.to(`booking:${booking.id}`).emit('booking_status_changed', {
      bookingId: booking.id,
      status: booking.status,
      updatedAt: booking.updatedAt,
    });

    if (nextStatus === BookingStatus.IN_PROGRESS) {
      const providerRole = providerRoleForService(booking.serviceKey);
      await createCustomerBookingNotification(
        booking,
        'JOB_STARTED',
        'Job started',
        `Your ${providerRole} has started work on ${booking.applianceType}. Keep approvals and payments inside MyFixer.`
      );
    }

    response.status(200).json({ success: true, bookingId: booking.id, status: booking.status });
  } catch (error) {
    if (error instanceof BookingWorkflowError) {
      response.status(error.statusCode).json({ message: error.message, code: error.code });
      return;
    }
    console.error('Failed to run booking workflow action:', error);
    response.status(500).json({ message: 'Failed to update booking workflow.' });
  }
};

export const startRoute = async (request: Request, response: Response): Promise<void> => {
  await runWorkflowStatusAction(request, response, BookingStatus.IN_ROUTE, 'START_ROUTE');
};

export const startJob = async (request: Request, response: Response): Promise<void> => {
  const bookingId = request.params.id ?? request.params.bookingId;

  try {
    let booking = await findBookingForWorkflow(bookingId);
    const eligibility = await evaluateWorkStartEligibility(booking, getAuthenticatedUser(request));
    await persistWorkStartEligibility(booking, eligibility);

    if (!eligibility.allowed) {
      await logAuditEvent(request, {
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

      const io = request.app.get('io') as SocketIOServer | undefined;
      io?.to(`booking:${booking.id}`).emit('work_start_blocked', {
        bookingId: booking.id,
        reasonCode: eligibility.reasonCode,
        requirements: eligibility.requirements,
        updatedAt: new Date().toISOString(),
      });

      response.status(409).json({
        success: false,
        message: 'Work cannot begin until all MyFixer approval and payment requirements are satisfied.',
        code: eligibility.reasonCode,
        eligibility,
      });
      return;
    }

    const before = { status: booking.status, workStartedAt: booking.workStartedAt };
    booking = await transitionBookingStatus({
      booking,
      actor: getAuthenticatedUser(request),
      nextStatus: BookingStatus.IN_PROGRESS,
      action: 'START_JOB',
    });

    await logAuditEvent(request, {
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

    const io = request.app.get('io') as SocketIOServer | undefined;
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
    await createCustomerBookingNotification(
      booking,
      'JOB_STARTED',
      'Job started',
      `Your ${providerRole} has started work on ${booking.applianceType}. Keep approvals and payments inside MyFixer.`
    );

    response.status(200).json({ success: true, bookingId: booking.id, status: booking.status, eligibility });
  } catch (error) {
    if (error instanceof BookingWorkflowError || error instanceof InspectionWorkflowError) {
      response.status(error.statusCode).json({ message: error.message, code: error.code });
      return;
    }
    console.error('Failed to start job:', error);
    response.status(500).json({ message: 'Failed to start job.' });
  }
};

const getInspectionReading = (body: InspectionRequestBody) => {
  const latitude = toFiniteNumber(body.latitude);
  const longitude = toFiniteNumber(body.longitude);
  const accuracyMeters = toFiniteNumber(body.accuracyMeters);
  const recordedAt = parseDateInput(body.recordedAt);
  if (latitude === null || longitude === null || accuracyMeters === null || !isValidDate(recordedAt)) {
    throw new InspectionWorkflowError('Valid latitude, longitude, accuracyMeters and recordedAt are required.', 'INVALID_INSPECTION_GPS');
  }
  return { latitude, longitude, accuracyMeters, recordedAt };
};

export const startInspection = async (request: Request, response: Response): Promise<void> => {
  const { bookingId } = request.params;
  const body = request.body as InspectionRequestBody;

  try {
    const booking = await startInspectionForBooking(
      bookingId,
      getAuthenticatedUser(request),
      getInspectionReading(body),
      body.acknowledgePlatformRules === true
    );

    await logAuditEvent(request, {
      action: 'booking.inspection.started',
      module: 'BOOKINGS',
      resourceType: 'Booking',
      resourceId: booking.id,
      metadata: { status: booking.inspection?.status },
    });

    const io = request.app.get('io') as SocketIOServer | undefined;
    io?.to(`booking:${booking.id}`).emit('inspection_started', {
      bookingId: booking.id,
      inspection: booking.inspection,
      updatedAt: booking.updatedAt,
    });

    const providerRole = providerRoleForService(booking.serviceKey);
    await createCustomerBookingNotification(
      booking,
      'INSPECTION_STARTED',
      'Inspection started',
      `Your ${providerRole} has started inspection for ${booking.applianceType}. Keep approvals and payments inside MyFixer.`
    );

    response.status(200).json({ success: true, bookingId: booking.id, inspection: booking.inspection });
  } catch (error) {
    if (error instanceof InspectionWorkflowError) {
      response.status(error.statusCode).json({ message: error.message, code: error.code });
      return;
    }
    console.error('Failed to start inspection:', error);
    response.status(500).json({ message: 'Failed to start inspection.' });
  }
};

export const completeInspection = async (request: Request, response: Response): Promise<void> => {
  const { bookingId } = request.params;
  const body = request.body as InspectionRequestBody;

  try {
    const booking = await completeInspectionForBooking(bookingId, getAuthenticatedUser(request), {
      ...getInspectionReading(body),
      diagnosisNotes: typeof body.diagnosisNotes === 'string' ? body.diagnosisNotes : '',
      technicalObservations: typeof body.technicalObservations === 'string' ? body.technicalObservations : '',
      quoteRequired: body.quoteRequired === true,
      partsRequired: Array.isArray(body.partsRequired) ? body.partsRequired as any[] : [],
      evidenceMediaIds: Array.isArray(body.evidenceMediaIds) ? body.evidenceMediaIds.map(String) : [],
    });

    const eligibility = await evaluateWorkStartEligibility(booking, getAuthenticatedUser(request));
    await persistWorkStartEligibility(booking, eligibility);

    await logAuditEvent(request, {
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

    const io = request.app.get('io') as SocketIOServer | undefined;
    io?.to(`booking:${booking.id}`).emit('inspection_completed', {
      bookingId: booking.id,
      inspection: booking.inspection,
      workAuthorization: eligibility,
      updatedAt: booking.updatedAt,
    });

    const providerRole = providerRoleForService(booking.serviceKey);
    await createCustomerBookingNotification(
      booking,
      'INSPECTION_COMPLETED',
      'Inspection completed',
      booking.inspection?.quoteRequired
        ? `Your ${providerRole} completed inspection and will send a quote for approval.`
        : `Your ${providerRole} completed inspection. Payment is required before work can begin.`
    );

    response.status(200).json({
      success: true,
      bookingId: booking.id,
      inspection: booking.inspection,
      workAuthorization: eligibility,
    });
  } catch (error) {
    if (error instanceof InspectionWorkflowError) {
      response.status(error.statusCode).json({ message: error.message, code: error.code });
      return;
    }
    console.error('Failed to complete inspection:', error);
    response.status(500).json({ message: 'Failed to complete inspection.' });
  }
};

export const confirmArrival = async (
  request: Request,
  response: Response
): Promise<void> => {
  const { bookingId } = request.params;
  const body = request.body as ArrivalConfirmationRequestBody;
  const latitude = toFiniteNumber(body.latitude);
  const longitude = toFiniteNumber(body.longitude);
  const accuracyMeters = toFiniteNumber(body.accuracyMeters);
  const recordedAt = parseDateInput(body.recordedAt);

  if (latitude === null || longitude === null || accuracyMeters === null || !isValidDate(recordedAt)) {
    response.status(400).json({ message: 'Valid latitude, longitude, accuracyMeters and recordedAt are required.' });
    return;
  }

  try {
    const io = request.app.get('io') as SocketIOServer | undefined;
    const booking = await confirmBookingArrival({
      bookingId,
      actor: getAuthenticatedUser(request),
      reading: { latitude, longitude, accuracyMeters, recordedAt },
      io,
    });

    const providerRole = providerRoleForService(booking.serviceKey);
    await createCustomerBookingNotification(
      booking,
      'TECHNICIAN_ARRIVED',
      `${providerRole} has arrived`,
      `Your ${providerRole} has arrived for ${booking.applianceType}. Keep all job communication, approvals and payments inside MyFixer.`
    );

    response.status(200).json({
      success: true,
      bookingId: booking.id,
      status: booking.status,
      message: 'Arrival confirmed. Keep all job communication, approvals and payments inside MyFixer.',
    });
  } catch (error) {
    if (error instanceof BookingWorkflowError) {
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
    let booking: IBooking | null = await Booking.findById(bookingId);
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
    booking = await transitionBookingStatus({
      booking,
      actor: authUser,
      nextStatus: BookingStatus.COMPLETED,
      action: 'COMPLETE_JOB',
    });
    
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
    const invoiceInboxMessages = await createCustomerBookingNotification(
      booking,
      'INVOICE_GENERATED',
      'Invoice generated',
      `Your invoice for ${booking.applianceType} has been generated.`,
      { totalAmountMinor, currency: booking.currency }
    );
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
