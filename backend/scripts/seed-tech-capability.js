const dns = require('dns').promises;
require('dns').setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const Technician = require('../dist/models/technician.model').default;
const TechnicianCapability = require('../dist/models/technician-capability.model').default;
const { CapabilityStatus } = require('../dist/models/technician-capability.model');

const inputTechnicianId = process.env.TEST_TECHNICIAN_ID || '6a46c6bb629c8c02b867c126';
const categorySlug = process.env.TEST_CAPABILITY_CATEGORY || 'appliance_repair';
const serviceRadiusKm = Number(process.env.TEST_CAPABILITY_RADIUS_KM || 50);

const assertSafeToRun = () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required.');
  }

  if (!mongoose.Types.ObjectId.isValid(inputTechnicianId)) {
    throw new Error(`Invalid TEST_TECHNICIAN_ID: ${inputTechnicianId}`);
  }

  if (!Number.isFinite(serviceRadiusKm) || serviceRadiusKm < 1 || serviceRadiusKm > 150) {
    throw new Error('TEST_CAPABILITY_RADIUS_KM must be between 1 and 150.');
  }
};

const main = async () => {
  assertSafeToRun();
  await mongoose.connect(process.env.MONGODB_URI);

  const objectId = new mongoose.Types.ObjectId(inputTechnicianId);
  const technician = await Technician.findOne({
    $or: [{ _id: objectId }, { userId: objectId }],
  });

  if (!technician) {
    throw new Error(`Technician profile not found for id/userId ${inputTechnicianId}.`);
  }

  const capability = await TechnicianCapability.findOneAndUpdate(
    {
      technicianId: technician._id,
      categorySlug,
    },
    {
      $set: {
        verificationStatus: CapabilityStatus.APPROVED,
        serviceRadiusKm,
        rejectionReason: null,
      },
      $setOnInsert: {
        technicianId: technician._id,
        categorySlug,
        approvedSpecialties: [],
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await Technician.updateOne(
    { _id: technician._id },
    { $addToSet: { serviceCategories: categorySlug } }
  );

  console.log('Seeded technician capability for dispatch test:', {
    inputTechnicianId,
    technicianId: technician._id.toString(),
    technicianUserId: technician.userId?.toString(),
    capabilityId: capability._id.toString(),
    categorySlug: capability.categorySlug,
    verificationStatus: capability.verificationStatus,
    serviceRadiusKm: capability.serviceRadiusKm,
  });
};

main()
  .catch((error) => {
    console.error('Failed to seed technician capability:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
