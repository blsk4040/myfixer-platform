const dns = require('dns').promises;
require('dns').setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '1.1.1.1']);

require('ts-node/register/transpile-only');

const path = require('path');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const User = require('../src/models/user.model').default;
const {
  AccountStatus,
  AdminPermission,
  AdminRole,
  UserRole,
} = require('../src/models/user.model');

const setupKey = process.env.ADMIN_SETUP_KEY || '';
const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD || '';
const adminName = (process.env.ADMIN_NAME || '').trim();
const adminPhone = (process.env.ADMIN_PHONE || '').trim();

const assertSafeToRun = () => {
  if (!setupKey) {
    throw new Error('ADMIN_SETUP_KEY is required.');
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required.');
  }

  if (!adminEmail) {
    throw new Error('ADMIN_EMAIL is required.');
  }
};

const buildAdminFields = () => ({
  role: UserRole.ADMIN,
  adminRole: AdminRole.SUPER_ADMIN,
  isActive: true,
  adminPermissions: Object.values(AdminPermission),
});

const main = async () => {
  assertSafeToRun();
  await mongoose.connect(process.env.MONGODB_URI);

  const existingUser = await User.findOne({ email: adminEmail }).select('+password');
  const adminFields = buildAdminFields();

  if (existingUser) {
    const update = { ...adminFields };

    if (adminPassword) {
      if (adminPassword.length < 6) {
        throw new Error('ADMIN_PASSWORD must be at least 6 characters when provided.');
      }
      update.password = await bcrypt.hash(adminPassword, 10);
      update.lastPasswordChangeAt = new Date();
    }

    await User.updateOne({ _id: existingUser._id }, { $set: update });
    console.log(`SUPER_ADMIN repaired for ${adminEmail}.`);
    return;
  }

  if (!adminPassword || adminPassword.length < 6) {
    throw new Error('ADMIN_PASSWORD is required and must be at least 6 characters when creating a SUPER_ADMIN.');
  }

  if (!adminName) {
    throw new Error('ADMIN_NAME is required when creating a SUPER_ADMIN.');
  }

  if (!adminPhone) {
    throw new Error('ADMIN_PHONE is required when creating a SUPER_ADMIN.');
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const user = await User.create({
    ...adminFields,
    name: adminName,
    email: adminEmail,
    phone: adminPhone,
    password: passwordHash,
    accountStatus: AccountStatus.ACTIVE,
    emailVerified: true,
    phoneVerified: true,
    location: {
      country: 'South Africa',
      city: 'Johannesburg',
    },
  });

  console.log(`SUPER_ADMIN created for ${user.email}.`);
};

let failed = false;

main()
  .catch((error) => {
    failed = true;
    console.error(`SUPER_ADMIN setup failed: ${error.message}`);
  })
  .finally(async () => {
    await mongoose.disconnect();
    if (failed) {
      process.exit(1);
    }
  });
