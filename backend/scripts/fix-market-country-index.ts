import { normalizeIsoCountryCode } from '../src/config/market.config';
import { configureMaintenanceDnsFromEnv } from './maintenance-dns';

const uri = process.env.MONGODB_URI || process.env.MONGO_URI || '';
const apply = process.argv.includes('--apply');
const appEnv = String(process.env.APP_ENV || process.env.NODE_ENV || '').toLowerCase();
const allowProduction = process.env.ALLOW_MARKET_COUNTRY_INDEX_FIX === 'true';

type MarketDocument = {
  _id: unknown;
  countryCode?: unknown;
  identity?: {
    countryCode?: unknown;
    countryName?: unknown;
  };
};

const maskIndex = (index: any) => ({
  name: index.name,
  key: index.key,
  unique: index.unique === true,
  sparse: index.sparse === true,
  partialFilterExpression: index.partialFilterExpression,
});

const normalizeCountry = (value: unknown): { valid: boolean; value?: string; reason?: string } => {
  try {
    return { valid: true, value: normalizeIsoCountryCode(value) };
  } catch (error) {
    return { valid: false, reason: error instanceof Error ? error.message : 'Invalid country code.' };
  }
};

async function main(): Promise<void> {
  if (!uri.trim()) {
    console.error('Missing MONGODB_URI or MONGO_URI. No database changes were made.');
    process.exit(1);
  }

  if (apply && ['production', 'prod'].includes(appEnv) && !allowProduction) {
    console.error('Refusing to apply in production without ALLOW_MARKET_COUNTRY_INDEX_FIX=true. No database changes were made.');
    process.exit(1);
  }

  const dnsServers = configureMaintenanceDnsFromEnv();
  if (dnsServers.length) {
    console.log(`Using maintenance DNS servers: ${dnsServers.join(', ')}`);
  }

  const mongoose = (await import('mongoose')).default;
  await mongoose.connect(uri);
  try {
    const collection = mongoose.connection.collection<MarketDocument>('marketsettings');
    const indexes = await collection.indexes();
    const obsoleteIndex = indexes.find((index) => index.name === 'countryCode_1');
    const identityIndex = indexes.find((index) => index.name === 'identity.countryCode_1');
    const records = await collection.find({}).toArray();

    const missingIdentityCountryCode: unknown[] = [];
    const invalidIdentityCountryCode: Array<{ _id: unknown; value: unknown; reason?: string }> = [];
    const legacyTopLevelCountryCode: Array<{ _id: unknown; countryCode: unknown; identityCountryCode: unknown }> = [];
    const legacyMismatches: Array<{ _id: unknown; countryCode: unknown; identityCountryCode: unknown }> = [];
    const identityCounts = new Map<string, unknown[]>();

    records.forEach((record) => {
      const identityCountryCode = record.identity?.countryCode;
      if (!identityCountryCode) {
        missingIdentityCountryCode.push(record._id);
      } else {
        const normalized = normalizeCountry(identityCountryCode);
        if (!normalized.valid) {
          invalidIdentityCountryCode.push({ _id: record._id, value: identityCountryCode, reason: normalized.reason });
        } else {
          identityCounts.set(normalized.value!, [...(identityCounts.get(normalized.value!) || []), record._id]);
        }
      }

      if (Object.prototype.hasOwnProperty.call(record, 'countryCode')) {
        legacyTopLevelCountryCode.push({
          _id: record._id,
          countryCode: record.countryCode,
          identityCountryCode,
        });
        if (record.countryCode && identityCountryCode && String(record.countryCode).toUpperCase() !== String(identityCountryCode).toUpperCase()) {
          legacyMismatches.push({
            _id: record._id,
            countryCode: record.countryCode,
            identityCountryCode,
          });
        }
      }
    });

    const duplicateIdentityCountryCodes = Array.from(identityCounts.entries())
      .filter(([, ids]) => ids.length > 1)
      .map(([countryCode, ids]) => ({ countryCode, ids }));

    const report = {
      dryRun: !apply,
      collection: 'marketsettings',
      totalRecords: records.length,
      indexes: indexes.map(maskIndex),
      obsoleteCountryCodeIndexPresent: Boolean(obsoleteIndex),
      identityCountryCodeIndexPresent: Boolean(identityIndex),
      identityCountryCodeIndexCorrect: Boolean(identityIndex?.unique && JSON.stringify(identityIndex.key) === JSON.stringify({ 'identity.countryCode': 1 })),
      missingIdentityCountryCode,
      invalidIdentityCountryCode,
      duplicateIdentityCountryCodes,
      legacyTopLevelCountryCode,
      legacyMismatches,
      plannedActions: [
        !identityIndex ? 'Create unique index identity.countryCode_1 on identity.countryCode.' : '',
        obsoleteIndex ? 'Drop obsolete top-level countryCode_1 index.' : '',
      ].filter(Boolean),
    };

    console.log(JSON.stringify(report, null, 2));

    const blockers = [
      missingIdentityCountryCode.length ? 'records missing identity.countryCode' : '',
      invalidIdentityCountryCode.length ? 'records with invalid identity.countryCode' : '',
      duplicateIdentityCountryCodes.length ? 'duplicate identity.countryCode values' : '',
      legacyMismatches.length ? 'legacy countryCode values that disagree with identity.countryCode' : '',
      identityIndex && (!identityIndex.unique || JSON.stringify(identityIndex.key) !== JSON.stringify({ 'identity.countryCode': 1 }))
        ? 'identity.countryCode_1 exists but is not the expected unique identity.countryCode index'
        : '',
    ].filter(Boolean);

    if (blockers.length) {
      if (apply) {
        console.error(`Apply stopped: ${blockers.join(', ')}.`);
        process.exitCode = 1;
      }
      return;
    }

    if (!apply) {
      console.log('Dry-run complete. Zero database writes occurred.');
      return;
    }

    if (!identityIndex) {
      await collection.createIndex({ 'identity.countryCode': 1 }, { unique: true, name: 'identity.countryCode_1' });
      console.log('Created unique index identity.countryCode_1.');
    } else {
      console.log('Correct identity.countryCode_1 index already exists.');
    }

    if (obsoleteIndex) {
      await collection.dropIndex('countryCode_1');
      console.log('Dropped obsolete top-level countryCode_1 index.');
    } else {
      console.log('Obsolete top-level countryCode_1 index was not present.');
    }

    console.log('Market country index repair completed.');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
