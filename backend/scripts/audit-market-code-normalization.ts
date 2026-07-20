import mongoose from 'mongoose';
import { normalizeIsoCountryCode, normalizeIsoCurrencyCode } from '../src/config/market.config';

const uri = process.env.MONGODB_URI || process.env.MONGO_URI || '';
const apply = process.env.APPLY_MARKET_CODE_NORMALIZATION === 'true';
const appEnv = String(process.env.APP_ENV || '').toLowerCase();

if (!uri.trim()) throw new Error('MONGODB_URI or MONGO_URI is required.');
if (appEnv === 'production' && apply) {
  throw new Error('Refusing to mutate production. Run this script as dry-run only for production.');
}

const collections = [
  'users',
  'technicians',
  'techniciancapabilities',
  'bookings',
  'jobquotes',
  'invoices',
  'wallets',
  'wallettransactions',
  'paymenttransactions',
  'providersettlements',
  'payouttransactions',
  'providerpayoutmethods',
  'promotions',
  'managedcollectionprofiles',
  'managedcollectionjobs',
  'managedcollectionplans',
  'managedcollectionsubscriptions',
  'managedcollectionsubscriptioninvoices',
  'servicewaitlists',
];

const normalizeField = (field: 'countryCode' | 'currency', value: unknown): { ok: boolean; normalized?: string; reason?: string } => {
  if (value === null || value === undefined || value === '') return { ok: true, normalized: value as string };
  try {
    return {
      ok: true,
      normalized: field === 'countryCode' ? normalizeIsoCountryCode(value) : normalizeIsoCurrencyCode(value),
    };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'Invalid value' };
  }
};

async function main(): Promise<void> {
  await mongoose.connect(uri);
  try {
    const report: Record<string, unknown[]> = {};
    for (const collectionName of collections) {
      const collection = mongoose.connection.collection(collectionName);
      const cursor = collection.find({
        $or: [
          { countryCode: { $exists: true } },
          { currency: { $exists: true } },
        ],
      });
      for await (const document of cursor) {
        const updates: Record<string, string> = {};
        const failures: Record<string, string> = {};
        for (const field of ['countryCode', 'currency'] as const) {
          if (!(field in document)) continue;
          const result = normalizeField(field, document[field]);
          if (!result.ok) failures[field] = String(result.reason || 'Invalid value');
          else if (typeof result.normalized === 'string' && result.normalized !== document[field]) updates[field] = result.normalized;
        }
        if (Object.keys(failures).length || Object.keys(updates).length) {
          report[collectionName] ??= [];
          report[collectionName].push({ _id: document._id, current: { countryCode: document.countryCode, currency: document.currency }, updates, failures });
          if (apply && !Object.keys(failures).length && Object.keys(updates).length) {
            await collection.updateOne({ _id: document._id }, { $set: updates });
          }
        }
      }
    }

    console.log(JSON.stringify({ dryRun: !apply, report }, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
