import assert from 'node:assert/strict';
import Booking, { BookingStatus } from '../src/models/booking.model';
import {
  BookingWorkflowError,
  confirmBookingArrival,
  getValidBookingTransitions,
  transitionBookingStatus,
} from '../src/services/booking-workflow.service';
import { UserRole } from '../src/models/user.model';

const originalEnv = { ...process.env };
const originalFindById = Booking.findById;
const originalFindOneAndUpdate = Booking.findOneAndUpdate;

process.env.ARRIVAL_RADIUS_METERS = '100';
process.env.ARRIVAL_CONFIRMATION_SECONDS = '10';
process.env.ARRIVAL_REQUIRED_READINGS = '2';
process.env.ARRIVAL_MAX_GPS_ACCURACY_METERS = '50';
process.env.ARRIVAL_MAX_READING_AGE_SECONDS = '30';

type FakeBooking = {
  id: string;
  _id: string;
  customerId: string;
  technicianId: string;
  status: BookingStatus;
  applianceType: string;
  customerLocation: { type: 'Point'; coordinates: [number, number] };
  metadata: Record<string, unknown>;
  savedCount: number;
  finalBilling?: unknown;
  scheduledAt?: Date | null;
  acceptedAt?: Date | null;
  inRouteAt?: Date | null;
  routeStartedAt?: Date | null;
  arrivedAt?: Date | null;
  inProgressAt?: Date | null;
  workStartedAt?: Date | null;
  completedAt?: Date | null;
  cancelledAt?: Date | null;
  save: () => Promise<FakeBooking>;
};

const ids = {
  booking: '507f1f77bcf86cd799439011',
  customer: '507f1f77bcf86cd799439012',
  technician: '507f1f77bcf86cd799439013',
  otherTechnician: '507f1f77bcf86cd799439014',
};

let activeBooking: FakeBooking | null = null;
let forceAtomicConflict = false;

const makeBooking = (status: BookingStatus): FakeBooking => ({
  id: ids.booking,
  _id: ids.booking,
  customerId: ids.customer,
  technicianId: ids.technician,
  status,
  applianceType: 'Appliance repair',
  customerLocation: { type: 'Point', coordinates: [28.1878, -25.8603] },
  metadata: {},
  savedCount: 0,
  async save() {
    this.savedCount += 1;
    return this;
  },
});

const technicianActor = { id: ids.technician, role: UserRole.TECHNICIAN };
const otherTechnicianActor = { id: ids.otherTechnician, role: UserRole.TECHNICIAN };
const customerActor = { id: ids.customer, role: UserRole.CUSTOMER };

const expectWorkflowError = async (promise: Promise<unknown>, code: string): Promise<void> => {
  await assert.rejects(
    promise,
    (error: unknown) => error instanceof BookingWorkflowError && error.code === code
  );
};

const matchesFilter = (booking: FakeBooking, filter: Record<string, any>): boolean => {
  if (filter._id && String(filter._id) !== booking._id) return false;
  if (filter.status && filter.status !== booking.status) return false;
  if (filter.technicianId && String(filter.technicianId) !== booking.technicianId) return false;
  if (filter.customerId && String(filter.customerId) !== booking.customerId) return false;
  return true;
};

const installBookingMocks = (): void => {
  (Booking.findById as unknown as (id: string) => Promise<FakeBooking | null>) = async () => activeBooking;
  (Booking.findOneAndUpdate as unknown as (filter: Record<string, any>, update: Record<string, any>) => Promise<FakeBooking | null>) =
    async (filter, update) => {
      if (!activeBooking || forceAtomicConflict || !matchesFilter(activeBooking, filter)) return null;
      Object.assign(activeBooking, update.$set ?? {});
      return activeBooking;
    };
};

const setBooking = (booking: FakeBooking | null): FakeBooking | null => {
  activeBooking = booking;
  forceAtomicConflict = false;
  return booking;
};

async function run(): Promise<void> {
  installBookingMocks();

  const table = getValidBookingTransitions();
  assert.deepEqual(table[BookingStatus.PENDING], [BookingStatus.SCHEDULED, BookingStatus.ACCEPTED, BookingStatus.CANCELLED]);
  assert.deepEqual(table[BookingStatus.SCHEDULED], [BookingStatus.ACCEPTED, BookingStatus.CANCELLED]);
  assert.ok(!table[BookingStatus.SCHEDULED]?.includes(BookingStatus.IN_ROUTE));
  assert.ok(!table[BookingStatus.SCHEDULED]?.includes(BookingStatus.ARRIVED));
  assert.ok(!table[BookingStatus.SCHEDULED]?.includes(BookingStatus.IN_PROGRESS));
  assert.ok(!table[BookingStatus.SCHEDULED]?.includes(BookingStatus.COMPLETED));
  assert.ok(!Object.values(table).some((statuses) => statuses?.includes(BookingStatus.DIAGNOSTIC_DONE)));

  const scheduled = setBooking(makeBooking(BookingStatus.PENDING))!;
  const scheduledResult = await transitionBookingStatus({
    booking: scheduled as any,
    actor: { id: ids.customer, role: UserRole.ADMIN },
    nextStatus: BookingStatus.SCHEDULED,
    action: 'SUPPORT_CANCEL',
  });
  assert.equal(scheduledResult.status, BookingStatus.SCHEDULED);
  assert.ok(scheduledResult.scheduledAt instanceof Date);

  await expectWorkflowError(
    transitionBookingStatus({
      booking: makeBooking(BookingStatus.SCHEDULED) as any,
      actor: technicianActor,
      nextStatus: BookingStatus.IN_ROUTE,
      action: 'START_ROUTE',
    }),
    'INVALID_STATUS_TRANSITION'
  );

  await expectWorkflowError(
    transitionBookingStatus({
      booking: makeBooking(BookingStatus.SCHEDULED) as any,
      actor: technicianActor,
      nextStatus: BookingStatus.COMPLETED,
      action: 'COMPLETE_JOB',
    }),
    'INVALID_STATUS_TRANSITION'
  );

  const routeBooking = setBooking(makeBooking(BookingStatus.ACCEPTED))!;
  const routed = await transitionBookingStatus({
    booking: routeBooking as any,
    actor: technicianActor,
    nextStatus: BookingStatus.IN_ROUTE,
    action: 'START_ROUTE',
  });
  assert.equal(routed.status, BookingStatus.IN_ROUTE);
  assert.ok(routed.inRouteAt instanceof Date);
  assert.ok(routed.routeStartedAt instanceof Date);

  const conflictBooking = setBooking(makeBooking(BookingStatus.ACCEPTED))!;
  forceAtomicConflict = true;
  await expectWorkflowError(
    transitionBookingStatus({
      booking: conflictBooking as any,
      actor: technicianActor,
      nextStatus: BookingStatus.IN_ROUTE,
      action: 'START_ROUTE',
    }),
    'STATUS_TRANSITION_CONFLICT'
  );
  forceAtomicConflict = false;

  await expectWorkflowError(
    transitionBookingStatus({
      booking: makeBooking(BookingStatus.PENDING) as any,
      actor: technicianActor,
      nextStatus: BookingStatus.IN_ROUTE,
      action: 'START_ROUTE',
    }),
    'INVALID_STATUS_TRANSITION'
  );

  await expectWorkflowError(
    transitionBookingStatus({
      booking: makeBooking(BookingStatus.ACCEPTED) as any,
      actor: technicianActor,
      nextStatus: BookingStatus.COMPLETED,
      action: 'COMPLETE_JOB',
    }),
    'INVALID_STATUS_TRANSITION'
  );

  await expectWorkflowError(
    transitionBookingStatus({
      booking: makeBooking(BookingStatus.ARRIVED) as any,
      actor: technicianActor,
      nextStatus: BookingStatus.ACCEPTED,
      action: 'START_ROUTE',
    }),
    'INVALID_STATUS_TRANSITION'
  );

  await expectWorkflowError(
    transitionBookingStatus({
      booking: makeBooking(BookingStatus.COMPLETED) as any,
      actor: technicianActor,
      nextStatus: BookingStatus.IN_PROGRESS,
      action: 'START_JOB',
    }),
    'INVALID_STATUS_TRANSITION'
  );

  await expectWorkflowError(
    transitionBookingStatus({
      booking: makeBooking(BookingStatus.CANCELLED) as any,
      actor: technicianActor,
      nextStatus: BookingStatus.ARRIVED,
      action: 'CONFIRM_ARRIVAL',
    }),
    'INVALID_STATUS_TRANSITION'
  );

  await expectWorkflowError(
    transitionBookingStatus({
      booking: makeBooking(BookingStatus.ACCEPTED) as any,
      actor: customerActor,
      nextStatus: BookingStatus.IN_ROUTE,
      action: 'START_ROUTE',
    }),
    'BOOKING_STATUS_FORBIDDEN'
  );

  const now = Date.now();
  const arrivalBooking = setBooking(makeBooking(BookingStatus.IN_ROUTE))!;
  await expectWorkflowError(
    confirmBookingArrival({
      bookingId: ids.booking,
      actor: technicianActor,
      reading: { latitude: -25.8603, longitude: 28.1878, accuracyMeters: 18, recordedAt: new Date(now - 12000) },
    }),
    'ARRIVAL_MORE_READINGS_REQUIRED'
  );
  assert.equal(arrivalBooking.savedCount, 1);

  const emitted: Array<{ room: string; event: string; payload: unknown }> = [];
  const io = {
    to(room: string) {
      return {
        emit(event: string, payload: unknown) {
          emitted.push({ room, event, payload });
        },
      };
    },
  };
  const confirmed = await confirmBookingArrival({
    bookingId: ids.booking,
    actor: technicianActor,
    reading: { latitude: -25.86031, longitude: 28.18781, accuracyMeters: 18, recordedAt: new Date(now) },
    io: io as any,
  });
  assert.equal(confirmed.status, BookingStatus.ARRIVED);
  assert.equal(confirmed.finalBilling, undefined);
  assert.ok(confirmed.arrivedAt instanceof Date);
  assert.ok(emitted.some((item) => item.event === 'technician_arrived'));
  assert.ok(emitted.some((item) => item.event === 'booking_status_changed'));

  const idempotent = await confirmBookingArrival({
    bookingId: ids.booking,
    actor: technicianActor,
    reading: { latitude: -25.86031, longitude: 28.18781, accuracyMeters: 18, recordedAt: new Date(now + 1000) },
  });
  assert.equal(idempotent.status, BookingStatus.ARRIVED);

  setBooking(makeBooking(BookingStatus.IN_ROUTE));
  await expectWorkflowError(
    confirmBookingArrival({
      bookingId: ids.booking,
      actor: technicianActor,
      reading: { latitude: -25.80, longitude: 28.10, accuracyMeters: 18, recordedAt: new Date() },
    }),
    'OUTSIDE_ARRIVAL_RADIUS'
  );

  setBooking(makeBooking(BookingStatus.IN_ROUTE));
  await expectWorkflowError(
    confirmBookingArrival({
      bookingId: ids.booking,
      actor: technicianActor,
      reading: { latitude: -25.8603, longitude: 28.1878, accuracyMeters: 18, recordedAt: new Date(Date.now() - 60000) },
    }),
    'GPS_READING_STALE'
  );

  setBooking(makeBooking(BookingStatus.IN_ROUTE));
  await expectWorkflowError(
    confirmBookingArrival({
      bookingId: ids.booking,
      actor: technicianActor,
      reading: { latitude: -25.8603, longitude: 28.1878, accuracyMeters: 80, recordedAt: new Date() },
    }),
    'POOR_GPS_ACCURACY'
  );

  setBooking(makeBooking(BookingStatus.ACCEPTED));
  await expectWorkflowError(
    confirmBookingArrival({
      bookingId: ids.booking,
      actor: technicianActor,
      reading: { latitude: -25.8603, longitude: 28.1878, accuracyMeters: 18, recordedAt: new Date() },
    }),
    'ARRIVAL_INVALID_STATUS'
  );

  setBooking(makeBooking(BookingStatus.IN_ROUTE));
  await expectWorkflowError(
    confirmBookingArrival({
      bookingId: ids.booking,
      actor: otherTechnicianActor,
      reading: { latitude: -25.8603, longitude: 28.1878, accuracyMeters: 18, recordedAt: new Date() },
    }),
    'ARRIVAL_FORBIDDEN'
  );

  const startable = setBooking(makeBooking(BookingStatus.ARRIVED))!;
  const started = await transitionBookingStatus({
    booking: startable as any,
    actor: technicianActor,
    nextStatus: BookingStatus.IN_PROGRESS,
    action: 'START_JOB',
  });
  assert.equal(started.status, BookingStatus.IN_PROGRESS);
  assert.ok(started.inProgressAt instanceof Date);
  assert.ok(started.workStartedAt instanceof Date);

  const legacy = setBooking(makeBooking(BookingStatus.DIAGNOSTIC_DONE))!;
  const completedLegacy = await transitionBookingStatus({
    booking: legacy as any,
    actor: technicianActor,
    nextStatus: BookingStatus.COMPLETED,
    action: 'COMPLETE_JOB',
  });
  assert.equal(completedLegacy.status, BookingStatus.COMPLETED);
  assert.ok(completedLegacy.completedAt instanceof Date);

  await expectWorkflowError(
    transitionBookingStatus({
      booking: makeBooking(BookingStatus.ARRIVED) as any,
      actor: technicianActor,
      nextStatus: BookingStatus.COMPLETED,
      action: 'COMPLETE_JOB',
    }),
    'INVALID_STATUS_TRANSITION'
  );
}

run()
  .then(() => {
    (Booking.findById as unknown as typeof originalFindById) = originalFindById;
    (Booking.findOneAndUpdate as unknown as typeof originalFindOneAndUpdate) = originalFindOneAndUpdate;
    process.env = originalEnv;
    console.info('Booking workflow tests passed.');
  })
  .catch((error) => {
    (Booking.findById as unknown as typeof originalFindById) = originalFindById;
    (Booking.findOneAndUpdate as unknown as typeof originalFindOneAndUpdate) = originalFindOneAndUpdate;
    process.env = originalEnv;
    console.error(error);
    process.exit(1);
  });
