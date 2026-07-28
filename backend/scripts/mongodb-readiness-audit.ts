import mongoose, { Model } from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import dns from 'dns';
import { promises as dnsPromises } from 'dns';

dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '1.1.1.1']);
dnsPromises.setServers(['8.8.8.8', '1.1.1.1']);

import Booking from '../src/models/booking.model';
import Technician from '../src/models/technician.model';
import User from '../src/models/user.model';
import ServiceCatalog from '../src/models/service-catalog.model';
import MarketSetting from '../src/models/market-setting.model';
import Notification from '../src/models/notification.model';
import ChatMessage from '../src/models/chat-message.model';
import JobQuote from '../src/models/quote.model';
import PaymentTransaction from '../src/models/payment-transaction.model';
import { Invoice, WalletTransaction } from '../src/models/billing.model';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

type IndexAuditRow = {
  collection: string;
  declared: number;
  existing: number;
  missing: string;
};

type ExplainRow = {
  query: string;
  collection: string;
  totalDocsExamined: number;
  totalKeysExamined: number;
  executionTimeMillis: number;
  planSummary: string;
};

const models: Model<unknown>[] = [
  Booking as unknown as Model<unknown>,
  Technician as unknown as Model<unknown>,
  User as unknown as Model<unknown>,
  ServiceCatalog as unknown as Model<unknown>,
  MarketSetting as unknown as Model<unknown>,
  Notification as unknown as Model<unknown>,
  ChatMessage as unknown as Model<unknown>,
  JobQuote as unknown as Model<unknown>,
  PaymentTransaction as unknown as Model<unknown>,
  Invoice as unknown as Model<unknown>,
  WalletTransaction as unknown as Model<unknown>,
];

const stringifyIndexKey = (key: Record<string, unknown>): string => JSON.stringify(key);

const planSummaryFromExplain = (value: any): string => {
  const stages: string[] = [];
  const visit = (node: any): void => {
    if (!node || typeof node !== 'object') return;
    if (typeof node.stage === 'string') stages.push(node.stage);
    if (node.inputStage) visit(node.inputStage);
    if (node.inputStages) node.inputStages.forEach(visit);
    if (node.executionStages) visit(node.executionStages);
    if (node.queryPlan) visit(node.queryPlan);
    if (node.winningPlan) visit(node.winningPlan);
    if (node.shards) Object.values(node.shards).forEach(visit);
  };
  visit(value);
  return [...new Set(stages)].join(' > ') || 'unknown';
};

const auditIndexes = async (): Promise<IndexAuditRow[]> => {
  const rows: IndexAuditRow[] = [];
  for (const model of models) {
    const declared = model.schema.indexes().map(([key]) => stringifyIndexKey(key as Record<string, unknown>));
    const existing = await model.collection.indexes();
    const existingKeys = new Set(existing.map((index) => stringifyIndexKey(index.key as Record<string, unknown>)));
    const missing = declared.filter((index) => !existingKeys.has(index));
    rows.push({
      collection: model.collection.name,
      declared: declared.length,
      existing: existing.length,
      missing: missing.length ? missing.join('; ') : '-',
    });
  }
  return rows;
};

const explainCriticalQueries = async (): Promise<ExplainRow[]> => {
  const countryCode = process.env.MONGO_AUDIT_COUNTRY || 'ZA';
  const city = process.env.MONGO_AUDIT_CITY || 'Johannesburg';
  const rows: ExplainRow[] = [];
  const queries = [
    {
      name: 'published service catalogue',
      collection: ServiceCatalog.collection,
      cursor: ServiceCatalog.find({
        $or: [
          { publicationStatus: 'PUBLISHED' },
          { status: 'PUBLISHED' },
          { status: 'ACTIVE' },
        ],
      }).sort({ groupKey: 1, displayOrder: 1, label: 1 }).limit(200),
    },
    {
      name: 'market by country',
      collection: MarketSetting.collection,
      cursor: MarketSetting.find({ 'identity.countryCode': countryCode }).limit(1),
    },
    {
      name: 'admin active bookings by country',
      collection: Booking.collection,
      cursor: Booking.find({ countryCode, status: { $in: ['PENDING', 'ACCEPTED', 'IN_ROUTE', 'ARRIVED', 'IN_PROGRESS'] } })
        .sort({ createdAt: -1 })
        .limit(50),
    },
    {
      name: 'provider matching prefilter',
      collection: Technician.collection,
      cursor: Technician.find({
        countryCode,
        city,
        approvalStatus: 'APPROVED',
        'availability.isOnline': true,
      }).limit(100),
    },
    {
      name: 'user country staff lookup',
      collection: User.collection,
      cursor: User.find({ countryCode, role: 'ADMIN' }).limit(100),
    },
    {
      name: 'notification feed',
      collection: Notification.collection,
      cursor: Notification.find({ channel: 'IN_APP', status: { $ne: 'ARCHIVED' } }).sort({ createdAt: -1 }).limit(100),
    },
  ];

  for (const query of queries) {
    const explain = await query.cursor.explain('executionStats') as any;
    const stats = explain.executionStats || {};
    rows.push({
      query: query.name,
      collection: query.collection.name,
      totalDocsExamined: Number(stats.totalDocsExamined || 0),
      totalKeysExamined: Number(stats.totalKeysExamined || 0),
      executionTimeMillis: Number(stats.executionTimeMillis || 0),
      planSummary: planSummaryFromExplain(explain),
    });
  }
  return rows;
};

const main = async (): Promise<void> => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required.');
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    autoIndex: false,
  });

  const indexRows = await auditIndexes();
  console.log('Mongo index readiness audit');
  console.table(indexRows);

  const explainRows = await explainCriticalQueries();
  console.log('Critical query explain summary');
  console.table(explainRows);

  const missingCount = indexRows.filter((row) => row.missing !== '-').length;
  const collectionScans = explainRows.filter((row) => row.planSummary.includes('COLLSCAN'));
  if (missingCount > 0) {
    console.warn(`${missingCount} collections have declared indexes that are not present in MongoDB.`);
  }
  if (collectionScans.length > 0) {
    console.warn(`${collectionScans.length} critical queries used a collection scan.`);
  }
};

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });
