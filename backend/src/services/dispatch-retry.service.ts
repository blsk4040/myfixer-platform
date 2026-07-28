import mongoose from 'mongoose';
import { Server as SocketIOServer } from 'socket.io';
import Booking, { BookingDispatchStatus, BookingStatus, IBooking } from '../models/booking.model';
import { NotificationChannel } from '../models/notification.model';
import { connectRedis } from '../config/redis';
import { serializeBookingForUnassignedTechnician } from './booking-privacy.service';
import matchingService, { normalizeDispatchServiceKey, RankedTechnicianCandidate } from './matching.service';
import { createNotifications } from './notification.service';
import { incrementMetric } from './metrics.service';
import {
  enqueueWorkerTask,
  isWorkerQueueEnabled,
  WorkerQueueName,
} from './worker-queue.service';
import { emitSocketRoomEvent } from '../sockets/redis-emitter';

const STANDBY_RETRY_INTERVAL_MS = 60 * 1000;
const STANDBY_RETRY_WINDOW_MS = 15 * 60 * 1000;
const DISPATCH_WAVE_SIZE = 3;
const DISPATCH_RETRY_LOCK_TTL_MS = 45 * 1000;

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

const buildIncomingRequestPayload = (booking: IBooking) =>
  serializeBookingForUnassignedTechnician(booking, { categoryMatch: true });

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

const emitIncomingRequest = async (
  io: SocketIOServer | undefined,
  technicianId: string,
  payload: Record<string, unknown>
): Promise<void> => {
  const room = `technician:${technicianId}`;
  if (!io) {
    await emitSocketRoomEvent(room, 'incoming_request', payload);
    return;
  }

  io.to(room).emit('incoming_request', payload);

  const sockets = await io.fetchSockets();
  const matchingSockets = sockets.filter(
    (socket) => getSocketIdentity(socket) === technicianId
  );

  logSocketDebug('booking broadcast targeting technician', {
    technicianId,
    matchingSocketCount: matchingSockets.length,
    room,
  });

  matchingSockets.forEach((socket) => {
    socket.emit('incoming_request', payload);
  });
};

export const notifyTechniciansForBooking = async (
  io: SocketIOServer | undefined,
  booking: IBooking,
  technicianIds: string[]
): Promise<void> => {
  if (!technicianIds.length) return;

  const incomingRequestPayload = buildIncomingRequestPayload(booking);
  await Promise.all(
    technicianIds.map((technicianId) =>
      emitIncomingRequest(io, technicianId, incomingRequestPayload)
    )
  );

  await Promise.all(
    technicianIds.map(async (technicianId) => {
      const jobs = await matchingService.findNearbyPendingBookingsForTechnician(technicianId);
      const room = `technician:${technicianId}`;
      if (io) {
        io.to(room).emit('available_jobs', jobs);
      } else {
        await emitSocketRoomEvent(room, 'available_jobs', jobs);
      }
    })
  );

  await Promise.all(
    technicianIds.map((technicianId) =>
      createTechnicianJobNotification(technicianId, booking)
    )
  );
};

export const nextDispatchWave = (
  booking: Pick<IBooking, 'dispatch'>,
  candidates: RankedTechnicianCandidate[],
  waveSize = DISPATCH_WAVE_SIZE
): { wave: number; candidates: RankedTechnicianCandidate[] } => {
  const alreadyInvited = new Set((booking.dispatch?.sentToTechnicians || []).map((id) => id.toString()));
  const alreadyAttempted = new Set((booking.dispatch?.attempts || []).map((attempt) => attempt.technicianId.toString()));
  const declined = new Set((booking.dispatch?.declinedByTechnicians || []).map((id) => id.toString()));
  const wave = Number(booking.dispatch?.currentWave || 0) + 1;
  return {
    wave,
    candidates: candidates
      .filter((candidate) =>
        !alreadyInvited.has(candidate.technicianId) &&
        !alreadyAttempted.has(candidate.technicianId) &&
        !declined.has(candidate.technicianId)
      )
      .slice(0, waveSize),
  };
};

export const recordDispatchWave = (
  booking: IBooking,
  candidates: RankedTechnicianCandidate[],
  wave: number,
  status: BookingDispatchStatus,
  expiresAt?: Date | null
): string[] => {
  const technicianIds = candidates.map((candidate) => candidate.technicianId);
  const sentToTechnicians = [
    ...(booking.dispatch?.sentToTechnicians || []),
    ...technicianIds.map((technicianId) => new mongoose.Types.ObjectId(technicianId)),
  ];
  const attempts = [
    ...(booking.dispatch?.attempts || []),
    ...candidates.map((candidate) => ({
      technicianId: new mongoose.Types.ObjectId(candidate.technicianId),
      wave,
      status: 'SENT' as const,
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
    expiresAt: expiresAt ?? booking.dispatch?.expiresAt ?? matchingService.getDispatchExpiry(booking),
    sentToTechnicians,
    declinedByTechnicians: booking.dispatch?.declinedByTechnicians || [],
    acceptedByTechnician: booking.dispatch?.acceptedByTechnician ?? null,
    preferredTechnicianId: booking.dispatch?.preferredTechnicianId ?? null,
    currentWave: wave,
    nextRetryAt: [BookingDispatchStatus.BROADCASTING, BookingDispatchStatus.STANDBY].includes(status)
      ? new Date(Date.now() + STANDBY_RETRY_INTERVAL_MS)
      : null,
    attempts,
  };

  booking.set('metadata.dispatchEngine', 'RANKED_PROGRESSIVE_WAVES_V1');
  booking.set('metadata.lastDispatchWave', wave);
  return technicianIds;
};

const acquireDispatchRetryLock = async (bookingId: string): Promise<string | null> => {
  const redis = await connectRedis();
  if (!redis) return `local-${process.pid}-${Date.now()}`;

  const token = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const result = await redis.set(
    `padi:dispatch-retry-lock:${bookingId}`,
    token,
    'PX',
    DISPATCH_RETRY_LOCK_TTL_MS,
    'NX'
  );
  return result === 'OK' ? token : null;
};

const releaseDispatchRetryLock = async (bookingId: string, token: string): Promise<void> => {
  if (token.startsWith('local-')) return;
  const redis = await connectRedis();
  if (!redis) return;

  const key = `padi:dispatch-retry-lock:${bookingId}`;
  const currentToken = await redis.get(key);
  if (currentToken === token) {
    await redis.del(key);
  }
};

export const scheduleStandbyDispatchRetry = async (input: {
  bookingId: string;
  io?: SocketIOServer;
  retryUntil?: Date;
}): Promise<void> => {
  const retryUntil = input.retryUntil ?? new Date(Date.now() + STANDBY_RETRY_WINDOW_MS);
  if (!mongoose.Types.ObjectId.isValid(input.bookingId)) return;

  if (isWorkerQueueEnabled()) {
    const queued = await enqueueWorkerTask({
      name: WorkerQueueName.DISPATCH_RETRY,
      id: input.bookingId,
      payload: {
        retryUntil: retryUntil.toISOString(),
      },
      runAt: new Date(Date.now() + STANDBY_RETRY_INTERVAL_MS).toISOString(),
    });
    if (queued) {
      incrementMetric('dispatch_retry_scheduled_total', { mode: 'worker' });
      return;
    }
  }

  const timer = setTimeout(() => {
    processStandbyDispatchRetry({
      bookingId: input.bookingId,
      io: input.io,
      retryUntil,
    }).catch((error) => {
      console.error('Failed to retry standby dispatch:', error);
    });
  }, STANDBY_RETRY_INTERVAL_MS);

  timer.unref?.();
  incrementMetric('dispatch_retry_scheduled_total', { mode: 'local_timer' });
};

export const processStandbyDispatchRetry = async (input: {
  bookingId: string;
  io?: SocketIOServer;
  retryUntil?: Date;
}): Promise<void> => {
  const bookingId = input.bookingId;
  if (!mongoose.Types.ObjectId.isValid(bookingId)) return;

  const lockToken = await acquireDispatchRetryLock(bookingId);
  if (!lockToken) {
    incrementMetric('dispatch_retry_skipped_total', { reason: 'locked' });
    return;
  }

  try {
    const retryUntil = input.retryUntil ?? new Date(Date.now() + STANDBY_RETRY_WINDOW_MS);
    const booking = await Booking.findById(bookingId);
    if (!booking) return;
    if (
      booking.status !== BookingStatus.PENDING ||
      ![BookingDispatchStatus.BROADCASTING, BookingDispatchStatus.STANDBY].includes(booking.dispatch?.status as BookingDispatchStatus)
    ) return;

    const dispatchExpiry = booking.dispatch?.expiresAt ? new Date(booking.dispatch.expiresAt) : retryUntil;
    const now = new Date();
    const stopAt = dispatchExpiry < retryUntil ? dispatchExpiry : retryUntil;
    if (stopAt.getTime() <= now.getTime()) {
      incrementMetric('dispatch_retry_finished_total', { reason: 'expired' });
      return;
    }

    const rankedCandidates = await matchingService.rankEligibleOnlineTechniciansForBooking(bookingId);
    const nextWave = nextDispatchWave(booking, rankedCandidates);

    if (nextWave.candidates.length) {
      const nextTechnicianIds = recordDispatchWave(
        booking,
        nextWave.candidates,
        nextWave.wave,
        BookingDispatchStatus.BROADCASTING,
        dispatchExpiry
      );
      booking.set('metadata.standbyProviderFoundAt', now);
      await booking.save();
      await notifyTechniciansForBooking(input.io, booking, nextTechnicianIds);
      await createCustomerBookingNotification(
        booking,
        'PROVIDER_SEARCH_UPDATED',
        'Provider search updated',
        `We found nearby ${providerRoleForService(booking.serviceKey)} options for your ${serviceLabelForNotification(booking)} request.`,
        {
          dispatchStatus: BookingDispatchStatus.BROADCASTING,
          matchedCount: nextTechnicianIds.length,
        }
      );
      incrementMetric('dispatch_retry_matched_total', { mode: input.io ? 'socket_server' : 'worker' });
      return;
    }

    await scheduleStandbyDispatchRetry({ bookingId, io: input.io, retryUntil: stopAt });
    incrementMetric('dispatch_retry_no_match_total');
  } finally {
    await releaseDispatchRetryLock(bookingId, lockToken);
  }
};
