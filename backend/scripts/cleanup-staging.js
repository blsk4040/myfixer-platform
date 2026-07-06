const dns = require('dns').promises;
require('dns').setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '1.1.1.1']);

require('ts-node/register/transpile-only');

const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const User = require('../src/models/user.model').default;
const Technician = require('../src/models/technician.model').default;
const Booking = require('../src/models/booking.model').default;
const JobQuote = require('../src/models/quote.model').default;
const {
  Invoice,
  Wallet,
  WalletTransaction,
} = require('../src/models/billing.model');
const ManagedCollectionProfile = require('../src/models/managed-collection.model').default;
const ManagedCollectionJob = require('../src/models/managed-collection-job.model').default;
const {
  ManagedCollectionSubscription,
  ManagedCollectionSubscriptionInvoice,
} = require('../src/models/managed-collection-subscription.model');
const NotificationReminder = require('../src/models/notification-reminder.model').default;
const Notification = require('../src/models/notification.model').default;
const ServiceWaitlist = require('../src/models/service-waitlist.model').default;
const AuditLog = require('../src/models/audit-log.model').default;
const MarketSetting = require('../src/models/market-setting.model').default;

const seedKey = process.env.STAGING_SEED_KEY || 'myfixer-staging-seed-v1';
const seedEmails = [
  'seed.superadmin@myfixer.test',
  'seed.customer@myfixer.test',
  'seed.technician@myfixer.test',
];

const assertSafeToRun = () => {
  if (process.env.STAGING_CLEANUP_ENABLED !== 'true') {
    throw new Error('Refusing to cleanup. Set STAGING_CLEANUP_ENABLED=true.');
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to cleanup while NODE_ENV=production.');
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required.');
  }
};

const compactObjectIds = (values) =>
  values
    .filter(Boolean)
    .map((value) => value._id || value)
    .filter((value) => mongoose.Types.ObjectId.isValid(value))
    .map((value) => new mongoose.Types.ObjectId(value));

const compactStrings = (values) =>
  values
    .filter(Boolean)
    .map((value) => String(value));

const markerFilter = () => ({
  $or: [
    { 'metadata.seedKey': seedKey },
    { 'metadata.seedKey': 'myfixer-staging-seed-v1' },
    { 'metadata.qaKey': { $exists: true } },
    { seedKey },
  ],
});

const marketSeedFilter = () => ({
  $and: [
    {
      $or: [
        { 'audit.changeHistory.after.seedKey': seedKey },
        { 'audit.changeHistory.after.seedKey': 'myfixer-staging-seed-v1' },
      ],
    },
    { 'support.email': 'seed-support@myfixer.test' },
    { 'support.escalationEmail': 'seed-escalation@myfixer.test' },
  ],
});

const withOr = (conditions) => {
  const filtered = conditions.filter(Boolean);
  return filtered.length ? { $or: filtered } : { _id: { $in: [] } };
};

const idIn = (field, ids) => (ids.length ? { [field]: { $in: ids } } : null);
const valueIn = (field, values) => (values.length ? { [field]: { $in: values } } : null);

const deleteAndTrack = async (results, label, Model, filter) => {
  const result = await Model.deleteMany(filter);
  results.push({ label, removed: result.deletedCount || 0 });
};

const findIds = async (Model, filter) =>
  compactObjectIds(await Model.find(filter).select('_id').lean());

const main = async () => {
  assertSafeToRun();
  await mongoose.connect(process.env.MONGODB_URI);

  const results = [];
  const seededUsers = await User.find({ email: { $in: seedEmails } }).select('_id email').lean();
  const seededUserIds = compactObjectIds(seededUsers);
  const seededUserIdStrings = compactStrings(seededUserIds);
  const seededUserEmails = seededUsers.map((user) => user.email).filter(Boolean);

  const bookingFilter = withOr([
    idIn('customerId', seededUserIds),
    idIn('technicianId', seededUserIds),
    valueIn('customerEmail', seededUserEmails),
    markerFilter(),
  ]);
  const bookingIds = await findIds(Booking, bookingFilter);

  const managedProfileFilter = withOr([
    idIn('customerId', seededUserIds),
    valueIn('customerEmail', seededUserEmails),
    markerFilter(),
  ]);
  const managedProfileIds = await findIds(ManagedCollectionProfile, managedProfileFilter);

  const managedSubscriptionFilter = withOr([
    idIn('customerId', seededUserIds),
    idIn('profileId', managedProfileIds),
    valueIn('customerEmail', seededUserEmails),
    markerFilter(),
  ]);
  const managedSubscriptionIds = await findIds(ManagedCollectionSubscription, managedSubscriptionFilter);

  const managedPlanIds = compactObjectIds(
    await ManagedCollectionSubscription.find({ _id: { $in: managedSubscriptionIds } }).select('planId').lean()
      .then((rows) => rows.map((row) => row.planId))
  );

  const invoiceFilter = withOr([
    idIn('bookingId', bookingIds),
    idIn('customerId', seededUserIds),
    idIn('technicianId', seededUserIds),
    markerFilter(),
  ]);
  const invoiceIds = await findIds(Invoice, invoiceFilter);

  const notificationFilter = withOr([
    idIn('recipient.userId', seededUserIds),
    valueIn('recipient.email', seededUserEmails),
    markerFilter(),
  ]);
  const notificationIds = await findIds(Notification, notificationFilter);

  await deleteAndTrack(results, 'Managed Collection Subscription Invoices', ManagedCollectionSubscriptionInvoice, withOr([
    idIn('subscriptionId', managedSubscriptionIds),
    idIn('planId', managedPlanIds),
    idIn('customerId', seededUserIds),
    markerFilter(),
  ]));

  await deleteAndTrack(results, 'Managed Collection Subscriptions', ManagedCollectionSubscription, managedSubscriptionFilter);

  await deleteAndTrack(results, 'Notification Reminders', NotificationReminder, withOr([
    idIn('customerId', seededUserIds),
    idIn('targetId', managedProfileIds),
    idIn('targetId', notificationIds),
  ]));

  await deleteAndTrack(results, 'Notifications', Notification, notificationFilter);

  await deleteAndTrack(results, 'Managed Collection Jobs', ManagedCollectionJob, withOr([
    idIn('profileId', managedProfileIds),
    idIn('customerId', seededUserIds),
    valueIn('customerEmail', seededUserEmails),
    markerFilter(),
  ]));

  await deleteAndTrack(results, 'Managed Collection Profiles', ManagedCollectionProfile, managedProfileFilter);

  await deleteAndTrack(results, 'Service Waitlists', ServiceWaitlist, withOr([
    idIn('customerId', seededUserIds),
    valueIn('email', seededUserEmails),
  ]));

  await deleteAndTrack(results, 'Wallet Transactions', WalletTransaction, withOr([
    idIn('bookingId', bookingIds),
    idIn('invoiceId', invoiceIds),
    idIn('customerId', seededUserIds),
    idIn('technicianId', seededUserIds),
    markerFilter(),
    { externalReference: seedKey },
    { externalReference: 'myfixer-staging-seed-v1' },
  ]));

  await deleteAndTrack(results, 'Wallets', Wallet, idIn('technicianId', seededUserIds) || { _id: { $in: [] } });

  await deleteAndTrack(results, 'Invoices', Invoice, invoiceFilter);

  await deleteAndTrack(results, 'Quotes', JobQuote, withOr([
    idIn('bookingId', bookingIds),
    idIn('customerId', seededUserIds),
    idIn('technicianId', seededUserIds),
    markerFilter(),
  ]));

  await deleteAndTrack(results, 'Bookings', Booking, bookingFilter);

  await deleteAndTrack(results, 'Technician Profiles', Technician, withOr([
    idIn('userId', seededUserIds),
    markerFilter(),
  ]));

  await deleteAndTrack(results, 'Audit Logs', AuditLog, withOr([
    idIn('actor.id', seededUserIds),
    valueIn('actor.email', seededUserEmails),
    valueIn('event.resourceId', seededUserIdStrings),
    valueIn('event.resourceId', compactStrings(bookingIds)),
    valueIn('event.resourceId', compactStrings(invoiceIds)),
    valueIn('event.resourceId', compactStrings(managedProfileIds)),
    valueIn('event.resourceId', compactStrings(managedSubscriptionIds)),
    markerFilter(),
  ]));

  await deleteAndTrack(results, 'Market Settings', MarketSetting, marketSeedFilter());

  await deleteAndTrack(results, 'Users', User, { email: { $in: seedEmails } });

  console.log('Staging cleanup completed.');
  console.table(results);
  console.log('Only seed-owned users, related seed-owned records, explicit QA metadata, and seed-created market settings were eligible for deletion.');
};

let failed = false;

main()
  .catch((error) => {
    failed = true;
    console.error(`Staging cleanup failed: ${error.message}`);
  })
  .finally(async () => {
    await mongoose.disconnect();
    if (failed) {
      process.exit(1);
    }
  });
