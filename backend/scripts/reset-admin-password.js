const dns = require('dns').promises;
require('dns').setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const path = require('path');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const [, , emailArg, passwordArg] = process.argv;
const adminEmail = (process.env.RESET_ADMIN_EMAIL || emailArg || '').trim().toLowerCase();
const newPassword = process.env.RESET_ADMIN_PASSWORD || passwordArg || '';

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing from backend/.env.');
  }

  if (!newPassword || newPassword.length < 6) {
    throw new Error('Provide a new password with at least 6 characters.');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const users = mongoose.connection.collection('users');

  const adminQuery = adminEmail ? { email: adminEmail, role: 'ADMIN' } : { role: 'ADMIN' };
  const adminCount = await users.countDocuments(adminQuery);

  if (!adminCount) {
    throw new Error(adminEmail ? `No admin user found for ${adminEmail}.` : 'No admin user found.');
  }

  if (!adminEmail && adminCount > 1) {
    throw new Error('Multiple admin users found. Re-run with the admin email address.');
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const result = await users.updateOne(adminQuery, {
    $set: {
      password: passwordHash,
      isActive: true,
      lastPasswordChangeAt: new Date(),
      updatedAt: new Date(),
    },
  });

  if (result.modifiedCount !== 1) {
    throw new Error('Password reset did not modify exactly one admin user.');
  }

  console.log(`Admin password reset for ${adminEmail || 'the only admin user'}.`);
}

main()
  .catch((error) => {
    console.error(`Password reset failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
