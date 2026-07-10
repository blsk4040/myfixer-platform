import assert from 'assert';
import {
  BookingRecipientValidationError,
  getCompatibleServiceRecipient,
  normalizeServiceRecipient,
} from '../src/services/booking-recipient.service';
import {
  canJoinPrivateBookingRoom,
  serializeBookingForAdmin,
  serializeBookingForAssignedTechnician,
  serializeBookingForOwner,
  serializeBookingForUnassignedTechnician,
} from '../src/services/booking-privacy.service';
import { BookingRecipientType, BookingStatus } from '../src/models/booking.model';

const customer = {
  name: 'Amina Owner',
  phone: '+27111222333',
  countryCode: 'ZA',
  location: { country: 'ZA', city: 'Pretoria' },
};

const context = {
  customer,
  countryCode: 'ZA',
  city: 'Pretoria',
  fullAddress: '123 Example Street, Pretoria',
  streetAddress: '123 Example Street',
  hasServiceCoordinates: true,
};

const booking: any = {
  id: 'booking-1',
  _id: 'booking-1',
  customerId: 'customer-1',
  customerName: 'Amina Owner',
  customerEmail: 'owner@example.com',
  technicianId: 'tech-1',
  serviceKey: 'appliance_repair',
  applianceType: 'Fridge',
  faultDescription: 'Fridge is leaking water',
  fullAddress: '123 Example Street, Pretoria',
  complexDetails: 'Unit 4',
  generalArea: 'Hatfield',
  customerLocation: { type: 'Point', coordinates: [28.2293, -25.7479] },
  priceMinor: 45000,
  countryCode: 'ZA',
  currency: 'ZAR',
  status: BookingStatus.ACCEPTED,
  serviceRecipient: {
    type: BookingRecipientType.OTHER,
    fullName: 'Thabo Recipient',
    phoneNumber: '+27825551234',
    relationship: 'Parent',
    email: 'recipient@example.com',
    country: 'ZA',
    city: 'Pretoria',
    streetAddress: '123 Example Street',
    notes: 'Use side entrance',
  },
  createdAt: new Date('2026-07-10T08:00:00.000Z'),
  updatedAt: new Date('2026-07-10T08:10:00.000Z'),
};

const expectRecipientError = (body: Record<string, unknown>, expected: string): void => {
  assert.throws(
    () => normalizeServiceRecipient(body, context),
    (error) => error instanceof BookingRecipientValidationError && error.message.includes(expected)
  );
};

const assertNoPrivateFields = (payload: Record<string, unknown>): void => {
  const text = JSON.stringify(payload);
  const forbidden = [
    'fullAddress',
    'streetAddress',
    'customerLocation',
    'serviceLocation',
    'latitude',
    'longitude',
    'customerPhone',
    'recipientPhone',
    'phoneNumber',
    'recipient@example.com',
    'Thabo Recipient',
    'Use side entrance',
    '123 Example Street',
  ];

  forbidden.forEach((field) => {
    assert(!text.includes(field), `Unassigned payload leaked ${field}`);
  });
};

const selfRecipient = normalizeServiceRecipient({ service_recipient: { type: 'SELF' } }, context);
assert.equal(selfRecipient.type, BookingRecipientType.SELF);
assert.equal(selfRecipient.fullName, customer.name);
assert.equal(selfRecipient.phoneNumber, customer.phone);

const otherRecipient = normalizeServiceRecipient(
  {
    service_recipient: {
      type: 'OTHER',
      fullName: 'Thabo Recipient',
      phoneNumber: '+27825551234',
      relationship: 'Parent',
      country: 'ZA',
      city: 'Pretoria',
      streetAddress: '123 Example Street',
      email: 'recipient@example.com',
      notes: 'Use side entrance',
    },
  },
  context
);
assert.equal(otherRecipient.type, BookingRecipientType.OTHER);

expectRecipientError({ service_recipient: { type: 'OTHER', phoneNumber: '1', relationship: 'Parent', country: 'ZA', city: 'Pretoria', streetAddress: 'A' } }, 'Recipient name');
expectRecipientError({ service_recipient: { type: 'OTHER', fullName: 'Name', relationship: 'Parent', country: 'ZA', city: 'Pretoria', streetAddress: 'A' } }, 'Recipient phone');
expectRecipientError({ service_recipient: { type: 'OTHER', fullName: 'Name', phoneNumber: '1', country: 'ZA', city: 'Pretoria', streetAddress: 'A' } }, 'Recipient relationship');
expectRecipientError({ service_recipient: { type: 'OTHER', fullName: 'Name', phoneNumber: '1', relationship: 'Parent', city: 'Pretoria', streetAddress: 'A' } }, 'Recipient country');
expectRecipientError({ service_recipient: { type: 'OTHER', fullName: 'Name', phoneNumber: '1', relationship: 'Parent', country: 'ZA', streetAddress: 'A' } }, 'Recipient city');
assert.throws(
  () => normalizeServiceRecipient(
    { service_recipient: { type: 'OTHER', fullName: 'Name', phoneNumber: '1', relationship: 'Parent', country: 'ZA', city: 'Pretoria' } },
    { ...context, fullAddress: '', streetAddress: '' }
  ),
  BookingRecipientValidationError
);
assert.throws(
  () => normalizeServiceRecipient(
    { service_recipient: { type: 'OTHER', fullName: 'Name', phoneNumber: '1', relationship: 'Parent', country: 'ZA', city: 'Pretoria', streetAddress: 'A' } },
    { ...context, hasServiceCoordinates: false }
  ),
  BookingRecipientValidationError
);
assert.throws(
  () => normalizeServiceRecipient(
    { service_recipient: { type: 'OTHER', fullName: 'Name', phoneNumber: '1', relationship: 'Parent', country: 'ZA', city: 'Pretoria', streetAddress: 'A', email: 'bad-email' } },
    context
  ),
  BookingRecipientValidationError
);

const compatible = getCompatibleServiceRecipient({ customerName: 'Legacy Owner', fullAddress: 'Legacy Address', countryCode: 'ZA', generalArea: 'Sunnyside' });
assert.equal(compatible.type, BookingRecipientType.SELF);
assert.equal(compatible.fullName, 'Legacy Owner');

const unassigned = serializeBookingForUnassignedTechnician(booking, { distanceKm: 12.34, categoryMatch: true });
assert.deepEqual(Object.keys(unassigned).sort(), [
  'applianceType',
  'approximateArea',
  'bookingId',
  'callOutFee',
  'categoryMatch',
  'countryCode',
  'currency',
  'distanceKm',
  'distanceText',
  'faultDescription',
  'generalArea',
  'hasPreciseLocation',
  'id',
  'priceMinor',
  'problemSummary',
  'scheduledAt',
  'serviceKey',
].sort());
assertNoPrivateFields(unassigned);

const assigned = serializeBookingForAssignedTechnician(booking);
assert.equal(assigned.hasPreciseLocation, true);
assert.equal(assigned.latitude, -25.7479);
assert.equal(assigned.longitude, 28.2293);
assert.equal(assigned.fullAddress, booking.fullAddress);
assert.equal(assigned.serviceRecipient.fullName, 'Thabo Recipient');

const owner = serializeBookingForOwner(booking);
assert.equal(owner.serviceRecipient.fullName, 'Thabo Recipient');

const admin = serializeBookingForAdmin(booking);
assert.equal(admin.customerEmail, 'owner@example.com');

assert.equal(canJoinPrivateBookingRoom(booking, 'tech-1', 'TECHNICIAN'), true);
assert.equal(canJoinPrivateBookingRoom(booking, 'tech-2', 'TECHNICIAN'), false);
assert.equal(canJoinPrivateBookingRoom({ ...booking, status: BookingStatus.PENDING }, 'tech-1', 'TECHNICIAN'), false);
assert.equal(canJoinPrivateBookingRoom(booking, 'customer-1', 'CUSTOMER'), true);
assert.equal(canJoinPrivateBookingRoom(booking, 'customer-2', 'CUSTOMER'), false);

console.info('booking recipient and privacy tests passed');
