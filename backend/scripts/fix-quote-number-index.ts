import dns from 'dns';
import { promises as dnsPromises } from 'dns';
import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import JobQuote from '../src/models/quote.model';

dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '1.1.1.1']);
dnsPromises.setServers(['8.8.8.8', '1.1.1.1']);

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const main = async (): Promise<void> => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000, autoIndex: false });

  const duplicates = await JobQuote.aggregate([
    { $match: { quoteNumber: { $type: 'string', $ne: '' } } },
    { $group: { _id: '$quoteNumber', count: { $sum: 1 }, ids: { $push: '$_id' } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 10 },
  ]);
  if (duplicates.length) {
    throw new Error(`Cannot create quoteNumber index: duplicate quote numbers exist (${duplicates.map((row) => row._id).join(', ')}).`);
  }

  await JobQuote.collection.createIndex(
    { quoteNumber: 1 },
    {
      name: 'quoteNumber_1',
      unique: true,
      partialFilterExpression: { quoteNumber: { $type: 'string', $gt: '' } },
      background: true,
    }
  );

  console.log('quoteNumber_1 index is present.');
};

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });
