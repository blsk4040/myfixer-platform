import mongoose from 'mongoose';
require('../../config/load-platform-config').loadPlatformConfig({ override: true });
import PaymentTransaction, { PaymentProvider, PaymentTransactionStatus } from '../src/models/payment-transaction.model';
import { verifyAndSecurePayment } from '../src/services/payment-workflow.service';

const dryRun = process.argv.includes('--dry-run') || process.env.DRY_RUN === 'true';
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : Number(process.env.RECONCILE_LIMIT || 100);

async function run(): Promise<void> {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required for reconciliation.');
  }
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });

  const query = {
    provider: PaymentProvider.PAYSTACK,
    status: { $in: [PaymentTransactionStatus.INITIALIZED, PaymentTransactionStatus.PENDING, PaymentTransactionStatus.UNDER_REVIEW] },
  };
  const transactions = await PaymentTransaction.find(query).sort({ createdAt: 1 }).limit(Number.isFinite(limit) ? limit : 100);
  const summary = {
    scanned: transactions.length,
    verified: 0,
    skippedDryRun: 0,
    failed: 0,
    mismatches: 0,
  };

  for (const transaction of transactions) {
    if (dryRun) {
      summary.skippedDryRun += 1;
      console.log(`[dry-run] would verify ${transaction.reference} (${transaction.status})`);
      continue;
    }
    try {
      const result = await verifyAndSecurePayment(transaction.reference);
      summary.verified += 1;
      if (result.transaction.status === PaymentTransactionStatus.UNDER_REVIEW) summary.mismatches += 1;
      console.log(`verified ${transaction.reference}: ${result.transaction.status}`);
    } catch (error: any) {
      summary.failed += 1;
      console.error(`failed ${transaction.reference}: ${error?.message || error}`);
    }
  }

  console.log(JSON.stringify(summary, null, 2));
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });
