// src/controllers/booking.controller.ts
import { Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import mongoose from 'mongoose';
// 1. IMPORT BookingStatus ENUM HERE
import Booking, { BookingCancellationBy, BookingDispatchStatus, BookingStatus, IBooking } from '../models/booking.model';
import BookingReview, { BookingReviewStatus } from '../models/booking-review.model';
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
import PaymentTransaction, {
  PaymentProvider,
  PaymentTransactionStatus,
} from '../models/payment-transaction.model';
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
import { calculatePriceBreakdown } from '../services/price-breakdown.service';
import {
  AppliedPromotionSnapshot,
  PromotionCampaignError,
  redeemPromotions,
  releasePromotionReservations,
  reservePromotions,
  reverseRedeemedPromotions,
  resolvePromotionsForPricing,
} from '../services/promotion-campaign.service';
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
import { ledgerType, recordLedgerEntries } from '../services/financial-ledger.service';
import {
  BookingRecipientValidationError,
  normalizeServiceRecipient,
} from '../services/booking-recipient.service';
import {
  isAssignedTechnicianWithPreciseAccess,
  serializeBookingForAdmin,
  serializeBookingForAssignedTechnician,
  serializeBookingForOwner,
} from '../services/booking-privacy.service';
import { assertActiveMarket, MarketFinanceGuardError } from '../services/market-finance-guard.service';
import { markReferralFirstBookingCreated } from '../services/provider-referral.service';
import { markCustomerReferralFirstBookingCreated } from '../services/customer-referral.service';
import { getProviderReputation, refreshProviderReputationStats } from '../services/provider-reputation.service';
import {
  nextDispatchWave,
  notifyTechniciansForBooking,
  recordDispatchWave,
  scheduleStandbyDispatchRetry,
} from '../services/dispatch-retry.service';

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
  subcategory_key?: unknown;
  subcategoryKey?: unknown;
  sub_category_key?: unknown;
  subCategory?: unknown;
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

interface SubmitBookingReviewRequestBody {
  rating?: unknown;
  professional?: unknown;
  onTime?: unknown;
  qualityWork?: unknown;
  communication?: unknown;
  comment?: unknown;
  wouldBookAgain?: unknown;
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

const isBookingStatus = (value: unknown): value is BookingStatus =>
  typeof value === 'string' && Object.values(BookingStatus).includes(value as BookingStatus);

const toReviewBoolean = (value: unknown): boolean | null =>
  typeof value === 'boolean' ? value : null;

const serializeBookingReview = (review: any) => review ? {
  id: String(review._id),
  bookingId: String(review.bookingId),
  rating: Number(review.rating || 0),
  professional: Boolean(review.professional),
  onTime: Boolean(review.onTime),
  qualityWork: Boolean(review.qualityWork),
  communication: Boolean(review.communication),
  comment: review.comment || '',
  wouldBookAgain: Boolean(review.wouldBookAgain),
  status: review.status,
  createdAt: review.createdAt,
} : null;

type DispatchFallbackPreference = 'STANDBY' | 'SCHEDULED' | 'WAITLIST';

const normalizeFallbackPreference = (value: unknown): DispatchFallbackPreference => {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return normalized === 'SCHEDULED' || normalized === 'WAITLIST' ? normalized : 'STANDBY';
};

const parseDateInput = (value: unknown): Date | null =>
  typeof value === 'string' || value instanceof Date ? new Date(value) : null;

const isValidDate = (value: Date | null): value is Date =>
  Boolean(value && !Number.isNaN(value.getTime()));

const getAuthenticatedUser = (request: Request) =>
  (request as any).user as
    | { id?: string; _id?: string; email?: string; role?: string }
    | undefined;

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

const providerRoleForService = (_serviceKey: unknown): string => 'Service Provider';

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
  countryCode: string;
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
  const requestedSubcategoryKey = normalizeDispatchServiceKey(
    body.subcategory_key ?? body.subcategoryKey ?? body.sub_category_key ?? body.subCategory
  );
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
  const manualPromoCode = normalizePromoCode(body.promoCode ?? body.promo_code);
  let promoCode = manualPromoCode;
  let autoReferralPromoCode = '';
  
  const latitude = toFiniteNumber(body.latitude);
  const longitude = toFiniteNumber(body.longitude);

  let countryCode = '';
  let customer: any = null;
  if (mongoose.Types.ObjectId.isValid(customerId)) {
    customer = await User.findById(customerId)
      .select('name phone role countryCode location defaultServiceAddress profileCompleted isEmailVerified emailVerified metadata')
      .lean();
    countryCode = normalizeCountryCode(body.country_code ?? customer?.countryCode ?? customer?.location?.country);
  } else {
    countryCode = normalizeCountryCode(body.country_code);
  }

  const activeMarket = await assertActiveMarket(countryCode);
  const market = {
    countryCode: activeMarket.identity.countryCode as CountryCode,
    countryName: activeMarket.identity.countryName,
    currency: activeMarket.identity.currency as any,
    defaultCalloutFee: fromMinorUnits(activeMarket.pricing.defaultCalloutFeeMinor, activeMarket.identity.currency as any),
    platformCommissionBps: activeMarket.pricing.platformCommissionBps,
  };
  const callOutFee = market.defaultCalloutFee;
  let originalPriceMinor = activeMarket.pricing.defaultCalloutFeeMinor;
  let priceMinor = originalPriceMinor;
  let promotionDiscountMinor = 0;
  let appliedPromotions: AppliedPromotionSnapshot[] = [];

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

  if (!promoCode) {
    autoReferralPromoCode = normalizePromoCode(customer?.metadata?.customerReferralFriendDiscountCode);
    promoCode = autoReferralPromoCode;
  }

  if (body.call_out_fee !== undefined && Math.round(Number(body.call_out_fee) * 100) !== originalPriceMinor) {
    response.status(400).json({
      message: 'Call-out fee must match the active market service configuration.',
    });
    return;
  }

  const promotionContext = {
    promoCode,
    customerId,
    amountMinor: originalPriceMinor,
    countryCode: market.countryCode,
    currency: market.currency,
    city,
    area,
    serviceKey: requestedServiceKey,
    subcategoryKey: requestedSubcategoryKey,
  };

  try {
    const promotionResolution = await resolvePromotionsForPricing(promotionContext);
    promotionDiscountMinor = promotionResolution.promotionDiscountMinor;
    appliedPromotions = promotionResolution.promotions;
  } catch (error: any) {
    if (manualPromoCode || !(error instanceof PromotionCampaignError) || !autoReferralPromoCode) {
      response.status(400).json({ message: error.message || 'Promotion could not be applied.' });
      return;
    }
    const fallbackPromotionResolution = await resolvePromotionsForPricing({
      ...promotionContext,
      promoCode: '',
    });
    promotionDiscountMinor = fallbackPromotionResolution.promotionDiscountMinor;
    appliedPromotions = fallbackPromotionResolution.promotions;
  }

  const promotionTechnicianFundedMinor = appliedPromotions.reduce(
    (sum, promotion) => sum + Math.round((promotion.discountMinor * (promotion.fundingSplitBps.technician || 0)) / 10000),
    0
  );
  const promotionPartnerFundedMinor = appliedPromotions.reduce(
    (sum, promotion) => sum + Math.round((promotion.discountMinor * (promotion.fundingSplitBps.partner || 0)) / 10000),
    0
  );
  const priceBreakdown = calculatePriceBreakdown({
    currency: market.currency,
    calloutFeeMinor: originalPriceMinor,
    calloutFeeDeductible: availability.service?.calloutFeeDeductible !== false && originalPriceMinor > 0,
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
      await reservePromotions(appliedPromotions);
      promotionReservationCommitted = true;
    } catch (error: any) {
      response.status(409).json({ message: error.message || 'Promotion could not be reserved.' });
      return;
    }
  }

  try {
    // 1. Save directly into MongoDB Atlas with updated keys
    const booking = await Booking.create({
      customerId: new mongoose.Types.ObjectId(customerId),
      customerName,
      customerEmail: authUser?.email ?? 'onboarding@hellopadi.com',
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
        status: isPreBook ? BookingDispatchStatus.SCHEDULED : BookingDispatchStatus.BROADCASTING,
        expiresAt: isPreBook ? null : matchingService.getDispatchExpiry({ createdAt: new Date() }),
        sentToTechnicians: [],
        declinedByTechnicians: [],
        preferredTechnicianId: preferredRebooking.preferredTechnicianObjectId ?? null,
      },
    });

    const bookingId = booking.id;
    bookingCreated = true;
    await markReferralFirstBookingCreated({
      customerId: booking.customerId,
      bookingId: booking._id,
    });
    await markCustomerReferralFirstBookingCreated({
      customerId: booking.customerId,
      bookingId: booking._id,
    });
    const io = request.app.get('io') as SocketIOServer | undefined;

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
        promotionDiscountMinor,
        promotionIds: appliedPromotions.map((promotion) => promotion.promotionId),
        scheduledAt: isPreBook && isValidDate(scheduledAt) ? scheduledAt.toISOString() : null,
        bookingStatus: isPreBook ? BookingStatus.SCHEDULED : BookingStatus.PENDING,
      }
    );
    
    // 2. Broadcast the open request to the best first wave of eligible online approved technicians.
    const rankedCandidates =
      fallbackPreference === 'SCHEDULED' || isPreBook
        ? []
        : await matchingService.rankEligibleOnlineTechniciansForBooking(bookingId);
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
      notifiedTechnicianIds = recordDispatchWave(
        booking,
        firstWave.candidates,
        firstWave.wave,
        BookingDispatchStatus.BROADCASTING,
        matchingService.getDispatchExpiry(booking)
      );
      await booking.save();
      await scheduleStandbyDispatchRetry({ bookingId, io });
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
          'onboarding@hellopadi.com';
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
        await scheduleStandbyDispatchRetry({ bookingId, io });
        await createCustomerBookingNotification(
          booking,
          'PROVIDER_SEARCH_STANDBY',
          'Still looking for a provider',
          `We are still looking for a nearby ${providerRoleForService(requestedServiceKey)}. Your request is open and we will notify you when someone accepts.`,
          {
            dispatchStatus: BookingDispatchStatus.STANDBY,
            standbyExpiresAt: booking.dispatch?.expiresAt,
          }
        );
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
      standbyExpiresAt: booking.dispatch?.status === BookingDispatchStatus.STANDBY ? booking.dispatch.expiresAt : null,
      message: booking.dispatch?.status === BookingDispatchStatus.STANDBY
        ? 'We are still looking for a nearby provider. Your request is open and we will notify you when someone accepts.'
        : undefined,
      preferredTechnicianId: preferredTechnicianUserId || null,
      notifiedTechnicianIds,
      priceBreakdown,
      promotion: appliedPromotions[0] || null,
      promotions: appliedPromotions,
    });
  } catch (error) {
    if (promotionReservationCommitted && !bookingCreated) {
      await releasePromotionReservations(appliedPromotions).catch(() => undefined);
    }
    if (error instanceof MarketFinanceGuardError) {
      response.status(error.statusCode).json({ message: error.message, code: error.code });
      return;
    }
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
      ? await TechnicianModel.findOne({ userId: booking.technicianId }).select('approvalStatus stats lastLocation documents.profilePhotoUrl documents.profilePhotoStatus updatedAt').lean()
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
        reputation: getProviderReputation(technicianProfile),
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
      ? await TechnicianModel.findOne({ userId: booking.technicianId }).select('approvalStatus stats lastLocation documents.profilePhotoUrl documents.profilePhotoStatus updatedAt').lean()
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
          reputation: getProviderReputation(technicianProfile),
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

export const getMyActiveBookings = async (
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

    const technicianIds = bookings
      .map((booking) => booking.technicianId)
      .filter((technicianId): technicianId is mongoose.Types.ObjectId => Boolean(technicianId && mongoose.Types.ObjectId.isValid(technicianId)));

    const [technicianUsers, technicianProfiles] = await Promise.all([
      technicianIds.length
        ? User.find({ _id: { $in: technicianIds } }).select('name phone profilePhotoUrl').lean()
        : [],
      technicianIds.length
        ? TechnicianModel.find({ userId: { $in: technicianIds } }).select('userId approvalStatus stats lastLocation documents.profilePhotoUrl documents.profilePhotoStatus updatedAt').lean()
        : [],
    ]);

    const usersById = new Map(technicianUsers.map((user) => [String(user._id), user]));
    const profilesByUserId = new Map(technicianProfiles.map((profile) => [String(profile.userId), profile]));

    response.status(200).json({
      active: bookings.length > 0,
      bookings: bookings.map((booking) => {
        const [longitude, latitude] = booking.customerLocation.coordinates;
        const technicianId = booking.technicianId ? String(booking.technicianId) : '';
        const technicianUser = technicianId ? usersById.get(technicianId) : null;
        const technicianProfile = technicianId ? profilesByUserId.get(technicianId) : null;
        const approvedTechnicianPhotoUrl = technicianProfile?.documents?.profilePhotoStatus === VerificationStatus.VERIFIED
          ? technicianProfile.documents.profilePhotoUrl
          : '';

        return {
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
            id: technicianId,
            name: technicianUser.name,
            phone: technicianUser.phone,
            profilePhotoUrl: technicianUser.profilePhotoUrl || approvedTechnicianPhotoUrl || '',
            lastLocation: technicianProfile?.lastLocation ? {
              longitude: technicianProfile.lastLocation.coordinates[0],
              latitude: technicianProfile.lastLocation.coordinates[1],
            } : null,
            lastGpsUpdate: technicianProfile?.updatedAt ?? null,
            reputation: getProviderReputation(technicianProfile),
          } : null,
          createdAt: booking.createdAt,
          updatedAt: booking.updatedAt,
        };
      }),
    });
  } catch (error) {
    console.error('Failed to fetch active bookings:', error);
    response.status(500).json({ message: 'Failed to fetch active bookings' });
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
    const [invoices, reviews] = await Promise.all([
      Invoice.find({ bookingId: { $in: bookingIds } }).lean(),
      BookingReview.find({ bookingId: { $in: bookingIds }, customerId }).lean(),
    ]);
    const invoiceByBookingId = new Map(invoices.map((invoice) => [String(invoice.bookingId), invoice]));
    const reviewByBookingId = new Map(reviews.map((review) => [String(review.bookingId), review]));
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
        .select('userId approvalStatus stats documents.profilePhotoUrl documents.profilePhotoStatus')
        .lean(),
    ]);
    const technicianUserById = new Map(technicianUsers.map((user) => [String(user._id), user]));
    const technicianProfileByUserId = new Map(technicianProfiles.map((profile) => [String(profile.userId), profile]));

    response.status(200).json({
      success: true,
      bookings: bookings.map((booking) => {
        const invoice = invoiceByBookingId.get(String(booking._id));
        const review = reviewByBookingId.get(String(booking._id));
        const technicianUserId = booking.technicianId ? String(booking.technicianId) : '';
        const technicianUser = technicianUserById.get(technicianUserId);
        const technicianProfile = technicianProfileByUserId.get(technicianUserId);
        const approvedTechnicianPhotoUrl = technicianProfile?.documents?.profilePhotoStatus === VerificationStatus.VERIFIED
          ? technicianProfile.documents.profilePhotoUrl
          : '';
        const invoicePriceBreakdown = invoice?.metadata?.priceBreakdown && typeof invoice.metadata.priceBreakdown === 'object'
          ? invoice.metadata.priceBreakdown as Record<string, unknown>
          : null;
        const invoicePromotion = invoice?.metadata?.promotion && typeof invoice.metadata.promotion === 'object'
          ? invoice.metadata.promotion as Record<string, unknown>
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
          canReview: booking.status === BookingStatus.COMPLETED && Boolean(booking.technicianId) && !review,
          review: serializeBookingReview(review),
          technician: technicianUser ? {
            id: technicianUserId,
            name: technicianUser.name,
            phone: technicianUser.phone,
            profilePhotoUrl: technicianUser.profilePhotoUrl || approvedTechnicianPhotoUrl || '',
            reputation: getProviderReputation(technicianProfile),
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
  } catch (error) {
    console.error('Failed to fetch booking history:', error);
    response.status(500).json({ message: 'Failed to fetch booking history.' });
  }
};

export const getBookingReview = async (
  request: Request,
  response: Response
): Promise<void> => {
  const { bookingId } = request.params;
  const authUser = getAuthenticatedUser(request);
  const customerId = String(authUser?.id ?? authUser?._id ?? '').trim();

  if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
    response.status(401).json({ message: 'Please sign in again to continue.' });
    return;
  }

  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    response.status(400).json({ message: 'Invalid booking id.' });
    return;
  }

  try {
    const review = await BookingReview.findOne({ bookingId, customerId }).lean();
    response.status(200).json({ success: true, review: serializeBookingReview(review) });
  } catch (error) {
    console.error('Failed to fetch booking review:', error);
    response.status(500).json({ message: 'Unable to load this review right now.' });
  }
};

export const submitBookingReview = async (
  request: Request,
  response: Response
): Promise<void> => {
  const { bookingId } = request.params;
  const body = request.body as SubmitBookingReviewRequestBody;
  const authUser = getAuthenticatedUser(request);
  const customerId = String(authUser?.id ?? authUser?._id ?? '').trim();

  if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
    response.status(401).json({ message: 'Please sign in again to continue.' });
    return;
  }

  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    response.status(400).json({ message: 'Invalid booking id.' });
    return;
  }

  const rating = Math.round(Number(body.rating));
  const professional = toReviewBoolean(body.professional);
  const onTime = toReviewBoolean(body.onTime);
  const qualityWork = toReviewBoolean(body.qualityWork);
  const communication = toReviewBoolean(body.communication);
  const wouldBookAgain = typeof body.wouldBookAgain === 'boolean' ? body.wouldBookAgain : true;
  const comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, 1200) : '';

  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    response.status(400).json({ message: 'Choose a rating from 1 to 5 stars.' });
    return;
  }

  if ([professional, onTime, qualityWork, communication].some((value) => value === null)) {
    response.status(400).json({ message: 'Please answer each review question.' });
    return;
  }

  try {
    const booking = await Booking.findOne({
      _id: bookingId,
      customerId: new mongoose.Types.ObjectId(customerId),
    })
      .select('_id customerId technicianId serviceKey applianceType status countryCode city generalArea fullAddress completedAt')
      .lean();

    if (!booking) {
      response.status(404).json({ message: 'Booking not found.' });
      return;
    }

    if (booking.status !== BookingStatus.COMPLETED) {
      response.status(409).json({ message: 'You can review this booking after it is completed.' });
      return;
    }

    if (!booking.technicianId || !mongoose.Types.ObjectId.isValid(booking.technicianId)) {
      response.status(409).json({ message: 'This booking does not have an assigned provider to review.' });
      return;
    }

    const existing = await BookingReview.findOne({ bookingId: booking._id }).lean();
    if (existing) {
      response.status(409).json({ message: 'You have already reviewed this booking.' });
      return;
    }

    const review = await BookingReview.create({
      bookingId: booking._id,
      customerId: new mongoose.Types.ObjectId(customerId),
      technicianId: booking.technicianId,
      serviceKey: String(booking.serviceKey || ''),
      serviceName: booking.applianceType,
      countryCode: String(booking.countryCode || '').toUpperCase(),
      city: String((booking as any).city || booking.generalArea || ''),
      rating,
      professional,
      onTime,
      qualityWork,
      communication,
      comment,
      wouldBookAgain,
      status: BookingReviewStatus.PUBLISHED,
      metadata: {
        completedAt: booking.completedAt ?? null,
        fullAddress: booking.fullAddress ? 'captured' : '',
      },
    });

    await refreshProviderReputationStats(booking.technicianId);

    response.status(201).json({
      success: true,
      review: serializeBookingReview(review),
      message: 'Thank you for helping keep Padi trusted.',
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      response.status(409).json({ message: 'You have already reviewed this booking.' });
      return;
    }
    console.error('Failed to submit booking review:', error);
    response.status(500).json({ message: 'Unable to save your review right now.' });
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

    await Booking.updateOne(
      { _id: booking._id, 'dispatch.attempts.technicianId': acceptedByTechnician },
      {
        $set: {
          'dispatch.attempts.$.status': 'ACCEPTED',
          'dispatch.attempts.$.respondedAt': now,
        },
      }
    ).catch((error) => {
      console.warn('Failed to mark accepted dispatch attempt:', error);
    });

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

    await Booking.updateOne(
      { _id: booking._id, 'dispatch.attempts.technicianId': technicianObjectId },
      {
        $set: {
          'dispatch.attempts.$.status': 'DECLINED',
          'dispatch.attempts.$.respondedAt': new Date(),
        },
      }
    ).catch((error) => {
      console.warn('Failed to mark declined dispatch attempt:', error);
    });

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
        title: 'Service provider has arrived',
        message: `Your service provider has arrived for ${serviceLabelForNotification(booking)}.`,
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
      const snapshots = Array.isArray(booking.metadata?.promotions)
        ? booking.metadata.promotions as AppliedPromotionSnapshot[]
        : [];
      if (snapshots.length) {
        const redeemed = snapshots.some((promotion) => promotion.reservationStatus === 'REDEEMED' || promotion.redeemedAt);
        const nextPromotions = redeemed
          ? await reverseRedeemedPromotions(snapshots, 'BOOKING_CANCELLED')
          : await releasePromotionReservations(snapshots, 'BOOKING_CANCELLED');
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
        `Your ${providerRole} has started work on ${booking.applianceType}. Padi keeps approvals and payment steps together for this booking.`
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
        message: 'Work cannot begin until all Padi approval and payment requirements are satisfied.',
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
      `Your ${providerRole} has started work on ${booking.applianceType}. Padi keeps approvals and payment steps together for this booking.`
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
      `Your ${providerRole} has started inspection for ${booking.applianceType}. Padi keeps approvals and payment steps together for this booking.`
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
      'Service provider has arrived',
      `Your service provider has arrived for ${booking.applianceType}. Padi keeps job communication, approvals and payment steps together.`
    );

    response.status(200).json({
      success: true,
      bookingId: booking.id,
      status: booking.status,
      message: 'Arrival confirmed. Padi keeps job communication, approvals and payment steps together.',
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

    const bookingPriceBreakdown = booking.metadata?.priceBreakdown && typeof booking.metadata.priceBreakdown === 'object'
      ? booking.metadata.priceBreakdown as Record<string, any>
      : null;
    const bookingCalloutMinor = typeof bookingPriceBreakdown?.calloutFeeMinor === 'number'
      ? Math.max(0, Math.round(bookingPriceBreakdown.calloutFeeMinor))
      : booking.priceMinor;
    const fallbackBaseAmount = toFiniteNumber(body.baseAmount) ?? decimalFromMinor(bookingCalloutMinor);
    const fallbackAdditionalLabor = toFiniteNumber(body.additionalLabor) ?? 0;
    const fallbackPartsAmount = toFiniteNumber(body.partsAmount) ?? 0;

    const baseAmount = approvedQuote
      ? approvedQuote.lineItems
          .filter((item) => item.type === QuoteLineItemType.CALLOUT || item.type === QuoteLineItemType.CALL_OUT)
          .reduce((sum, item) => sum + decimalFromMinor(item.totalAmountMinor), 0) || decimalFromMinor(booking.priceMinor)
      : fallbackBaseAmount;
    const additionalLabor = approvedQuote
      ? approvedQuote.lineItems
          .filter((item) =>
            item.type === QuoteLineItemType.LABOR ||
            item.type === QuoteLineItemType.LABOUR ||
            item.type === QuoteLineItemType.ADD_ON ||
            item.type === QuoteLineItemType.SURCHARGE
          )
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
    const marketSetting = await MarketSetting.findOne({ 'identity.countryCode': booking.countryCode }).lean();
    const quotePriceBreakdown = approvedQuote?.metadata?.priceBreakdown && typeof approvedQuote.metadata.priceBreakdown === 'object'
      ? approvedQuote.metadata.priceBreakdown as Record<string, any>
      : null;
    const promotionSnapshot = booking.metadata?.promotion && typeof booking.metadata.promotion === 'object'
      ? booking.metadata.promotion as Record<string, unknown>
      : null;
    const promotionSnapshots = Array.isArray(booking.metadata?.promotions)
      ? booking.metadata.promotions as AppliedPromotionSnapshot[]
      : promotionSnapshot
        ? [promotionSnapshot as unknown as AppliedPromotionSnapshot]
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
    const legacyPriceBreakdown = calculatePriceBreakdown({
      currency: booking.currency as any,
      calloutFeeMinor: applyBookingPromoToInvoice ? promoOriginalPriceMinor : baseAmountMinor,
      labourMinor: additionalLaborMinor,
      partsMinor: partsAmountMinor,
      promotionDiscountMinor: applyBookingPromoToInvoice ? promoDiscountMinor : 0,
      otherDiscountMinor: 0,
      promotionFundingSource: typeof promotionSnapshot?.fundingSource === 'string' ? promotionSnapshot.fundingSource as any : 'PLATFORM',
      promotionTechnicianFundedMinor: applyBookingPromoToInvoice && promotionSnapshot?.fundingSplitBps && typeof promotionSnapshot.fundingSplitBps === 'object'
        ? Math.round((promoDiscountMinor * Number((promotionSnapshot.fundingSplitBps as any).technician || 0)) / 10000)
        : 0,
      promotionPartnerFundedMinor: applyBookingPromoToInvoice && promotionSnapshot?.fundingSplitBps && typeof promotionSnapshot.fundingSplitBps === 'object'
        ? Math.round((promoDiscountMinor * Number((promotionSnapshot.fundingSplitBps as any).partner || 0)) / 10000)
        : 0,
      marketPricing: {
        ...(marketSetting?.pricing || {}),
        platformCommissionBps: marketSetting?.pricing?.platformCommissionBps ?? 1500,
      },
    });
    const priceBreakdown: any = quotePriceBreakdown || (
      !approvedQuote && bookingPriceBreakdown && additionalLaborMinor === 0 && partsAmountMinor === 0
        ? bookingPriceBreakdown
        : legacyPriceBreakdown
    );
    const platformCommissionBps = Number.isFinite(Number(priceBreakdown.platformCommissionBps)) ? Number(priceBreakdown.platformCommissionBps) : 1500;
    const platformCommissionAmountMinor = Number.isFinite(Number(priceBreakdown.platformCommissionMinor)) ? Math.max(0, Math.round(Number(priceBreakdown.platformCommissionMinor))) : 0;
    const technicianNetAmountMinor = Number.isFinite(Number(priceBreakdown.technicianNetMinor)) ? Math.max(0, Math.round(Number(priceBreakdown.technicianNetMinor))) : 0;
    const invoiceTotalMinor = Number.isFinite(Number(priceBreakdown.totalMinor)) ? Math.max(0, Math.round(Number(priceBreakdown.totalMinor))) : totalAmountMinor;
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
      baseAmount: fromMinorUnits(applyBookingPromoToInvoice ? promoOriginalPriceMinor : baseAmountMinor, booking.currency),
      baseAmountMinor: applyBookingPromoToInvoice ? promoOriginalPriceMinor : baseAmountMinor,
      additionalLabor,
      additionalLaborMinor,
      partsAmount,
      partsAmountMinor,
      totalAmount: fromMinorUnits(invoiceTotalMinor, booking.currency),
      totalAmountMinor: invoiceTotalMinor,
      proofPhoto
    });

    await booking.save();

    let finalizedInvoiceNumber = '';
    let finalizedInvoiceId = '';

    if (
      mongoose.Types.ObjectId.isValid(booking.customerId) &&
      booking.technicianId &&
      mongoose.Types.ObjectId.isValid(booking.technicianId)
    ) {
      const fallbackInvoiceNumber = `INV-PADI-${new Date().getFullYear()}-${booking.id.slice(-6).toUpperCase()}`;
      const existingInvoice = await Invoice.findOne({ bookingId: booking._id });
      const successfulPayment = await PaymentTransaction.findOne({
        bookingId: booking._id,
        provider: PaymentProvider.PAYSTACK,
        status: PaymentTransactionStatus.SUCCESS,
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
        ? await redeemPromotions(promotionSnapshots)
        : promotionSnapshots;

      const invoice = await Invoice.findOneAndUpdate(
        { bookingId: booking._id },
        {
          invoiceNumber,
          bookingId: booking._id,
          customerId: new mongoose.Types.ObjectId(booking.customerId),
          technicianId: new mongoose.Types.ObjectId(booking.technicianId),
          countryCode: booking.countryCode,
          currency: booking.currency,
          baseAmountMinor: applyBookingPromoToInvoice ? promoOriginalPriceMinor : baseAmountMinor,
          additionalLaborMinor,
          partsAmountMinor,
          totalAmountMinor: invoiceTotalMinor,
          platformCommissionBps,
          platformCommissionAmountMinor,
          technicianNetAmountMinor,
          status: successfulPayment ? InvoiceStatus.PAID : InvoiceStatus.UNPAID,
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
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      finalizedInvoiceNumber = invoice.invoiceNumber;
      finalizedInvoiceId = invoice._id.toString();

      await recordLedgerEntries([
        {
          idempotencyKey: `invoice:${invoice.id}:issued:v${invoice.updatedAt?.getTime?.() || Date.now()}`,
          entryType: ledgerType.INVOICE_ISSUED,
          amountMinor: invoiceTotalMinor,
          direction: 'DEBIT',
          component: 'MEMO',
          description: existingInvoice ? 'Invoice updated' : 'Invoice issued',
          bookingId: booking._id,
          invoiceId: invoice._id,
          quoteId: approvedQuote?._id ?? null,
          customerId: new mongoose.Types.ObjectId(booking.customerId),
          technicianId: new mongoose.Types.ObjectId(booking.technicianId),
          countryCode: booking.countryCode,
          currency: booking.currency,
          metadata: {
            invoiceNumber: invoice.invoiceNumber,
            priceBreakdown,
            status: invoice.status,
          },
        },
        {
          idempotencyKey: `invoice:${invoice.id}:provider-earning:${technicianNetAmountMinor}`,
          entryType: ledgerType.PROVIDER_EARNING_RECOGNIZED,
          amountMinor: technicianNetAmountMinor,
          direction: 'CREDIT',
          component: 'PAYOUT',
          description: 'Provider earning recognized',
          bookingId: booking._id,
          invoiceId: invoice._id,
          quoteId: approvedQuote?._id ?? null,
          customerId: new mongoose.Types.ObjectId(booking.customerId),
          technicianId: new mongoose.Types.ObjectId(booking.technicianId),
          countryCode: booking.countryCode,
          currency: booking.currency,
          metadata: {
            invoiceNumber: invoice.invoiceNumber,
            providerGrossMinor: priceBreakdown?.technicianGrossMinor,
            platformCommissionBaseMinor: priceBreakdown?.platformCommissionBaseMinor,
          },
        },
        {
          idempotencyKey: `invoice:${invoice.id}:platform-revenue:${platformCommissionAmountMinor}`,
          entryType: ledgerType.PLATFORM_REVENUE_RECOGNIZED,
          amountMinor: platformCommissionAmountMinor,
          direction: 'CREDIT',
          component: 'PLATFORM_FEE',
          description: 'Padi revenue recognized',
          bookingId: booking._id,
          invoiceId: invoice._id,
          quoteId: approvedQuote?._id ?? null,
          customerId: new mongoose.Types.ObjectId(booking.customerId),
          technicianId: new mongoose.Types.ObjectId(booking.technicianId),
          countryCode: booking.countryCode,
          currency: booking.currency,
          metadata: {
            invoiceNumber: invoice.invoiceNumber,
            platformCommissionBps,
            platformCommissionBaseMinor: priceBreakdown?.platformCommissionBaseMinor,
          },
        },
      ]);

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
            amountMinor: invoiceTotalMinor,
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
      {
        feed: 'inbox',
        documentType: 'INVOICE',
        invoiceId: finalizedInvoiceId,
        invoiceNumber: finalizedInvoiceNumber,
        totalAmountMinor: invoiceTotalMinor,
        currency: booking.currency,
      }
    );
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
    const recipientEmail = booking.customerEmail || 'onboarding@hellopadi.com';

    // The compiler can now resolve 'EmailService' cleanly 📬
    const emailSent = await EmailService.sendJobInvoiceEmail({
      recipientEmail,
      customerName: booking.customerName || 'Client',
      bookingId,
      baseAmount,
      additionalLabor,
      partsAmount,
      totalAmount: fromMinorUnits(invoiceTotalMinor, booking.currency),
      discountAmount: fromMinorUnits(applyBookingPromoToInvoice ? promoDiscountMinor : 0, booking.currency),
      calloutCreditAmount: typeof priceBreakdown.calloutCreditMinor === 'number'
        ? fromMinorUnits(priceBreakdown.calloutCreditMinor, booking.currency)
        : 0,
      promoCode: typeof promotionSnapshot?.code === 'string' ? promotionSnapshot.code : '',
      promotionLabel: typeof promotionSnapshot?.campaignName === 'string'
        ? promotionSnapshot.campaignName
        : typeof promotionSnapshot?.code === 'string'
          ? `Promotion - ${promotionSnapshot.code}`
          : applyBookingPromoToInvoice && promoDiscountMinor > 0
            ? 'Promotion'
            : '',
      subtotalAmount: typeof priceBreakdown.subtotalMinor === 'number'
        ? fromMinorUnits(priceBreakdown.subtotalMinor, booking.currency)
        : undefined,
      clientServiceFee: typeof priceBreakdown.clientServiceFeeMinor === 'number'
        ? fromMinorUnits(priceBreakdown.clientServiceFeeMinor, booking.currency)
        : 0,
      taxAmount: typeof priceBreakdown.taxMinor === 'number'
        ? fromMinorUnits(priceBreakdown.taxMinor, booking.currency)
        : 0,
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

  } catch (error) {
    if (error instanceof BookingWorkflowError) {
      response.status(error.statusCode).json({ message: error.message, code: error.code });
      return;
    }
    console.error('Failed to settle final billing operations endpoint run:', error);
    response.status(500).json({ message: 'Failed to process job closure accounting entries' });
  }
};
