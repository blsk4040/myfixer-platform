const dns = require('dns').promises;
require('dns').setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const Booking = require('../dist/models/booking.model').default;
const JobQuote = require('../dist/models/quote.model').default;
const ChatMessage = require('../dist/models/chat-message.model').default;
const JobMedia = require('../dist/models/job-media.model').default;
const Notification = require('../dist/models/notification.model').default;
const PaymentTransaction = require('../dist/models/payment-transaction.model').default;
const ProviderSettlement = require('../dist/models/provider-settlement.model').default;
const PayoutTransaction = require('../dist/models/payout-transaction.model').default;
const { Invoice, WalletTransaction } = require('../dist/models/billing.model');

const ACTIVE_TEST_STATUSES = [
  'PENDING',
  'SCHEDULED',
  'ACCEPTED',
  'IN_ROUTE',
  'ARRIVED',
  'IN_PROGRESS',
  'DIAGNOSTIC_DONE',
];

const shouldApply = process.argv.includes('--apply');

const deleteAndTrack = async (results, label, Model, filter) => {
  const count = await Model.countDocuments(filter);
  let removed = 0;
  if (shouldApply && count > 0) {
    const result = await Model.deleteMany(filter);
    removed = result.deletedCount || 0;
  }
  results.push({ label, matched: count, removed });
};

const main = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required.');
  }

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });

  const candidateBookings = await Booking.find({ status: { $in: ACTIVE_TEST_STATUSES } })
    .select('_id status applianceType customerName customerEmail technicianId createdAt updatedAt')
    .sort({ updatedAt: -1 })
    .lean();
  const bookingIds = candidateBookings.map((booking) => booking._id);
  const bookingIdStrings = bookingIds.map((id) => String(id));

  const results = [];
  const bookingFilter = { _id: { $in: bookingIds } };
  const bookingLinkFilter = { bookingId: { $in: bookingIds } };
  const notificationFilter = {
    $or: [
      { 'metadata.bookingId': { $in: bookingIdStrings } },
      { 'metadata.bookingId': { $in: bookingIds } },
    ],
  };

  await deleteAndTrack(results, 'Notifications linked to active test bookings', Notification, notificationFilter);
  await deleteAndTrack(results, 'Chat messages linked to active test bookings', ChatMessage, bookingLinkFilter);
  await deleteAndTrack(results, 'Job media linked to active test bookings', JobMedia, bookingLinkFilter);
  await deleteAndTrack(results, 'Payment transactions linked to active test bookings', PaymentTransaction, bookingLinkFilter);
  await deleteAndTrack(results, 'Provider settlements linked to active test bookings', ProviderSettlement, bookingLinkFilter);
  await deleteAndTrack(results, 'Payout transactions linked to active test bookings', PayoutTransaction, bookingLinkFilter);
  await deleteAndTrack(results, 'Wallet transactions linked to active test bookings', WalletTransaction, bookingLinkFilter);
  await deleteAndTrack(results, 'Invoices linked to active test bookings', Invoice, bookingLinkFilter);
  await deleteAndTrack(results, 'Quotes linked to active test bookings', JobQuote, bookingLinkFilter);
  await deleteAndTrack(results, 'Active test bookings', Booking, bookingFilter);

  const activeRemaining = await Booking.countDocuments({ status: { $in: ACTIVE_TEST_STATUSES } });

  console.log(shouldApply ? 'Active test request cleanup applied.' : 'Active test request cleanup dry run.');
  console.log(`Candidate active bookings: ${candidateBookings.length}`);
  console.table(
    candidateBookings.map((booking) => ({
      id: String(booking._id),
      status: booking.status,
      service: booking.applianceType,
      customer: booking.customerName || booking.customerEmail || '',
      updatedAt: booking.updatedAt,
    }))
  );
  console.table(results);
  console.log(`Active bookings remaining after ${shouldApply ? 'cleanup' : 'dry run'}: ${activeRemaining}`);
  if (!shouldApply) {
    console.log('No data was deleted. Re-run with --apply to delete these active booking records and direct child records.');
  }
};

let failed = false;

main()
  .catch((error) => {
    failed = true;
    console.error(`Active test request cleanup failed: ${error.message}`);
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
    if (failed) process.exit(1);
  });
