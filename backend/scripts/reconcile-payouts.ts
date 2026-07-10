import PayoutTransaction, { PayoutTransactionStatus } from '../src/models/payout-transaction.model';

const dryRun = !process.argv.includes('--apply');

async function main() {
  const processing = await PayoutTransaction.countDocuments({ status: PayoutTransactionStatus.PROCESSING });
  const failed = await PayoutTransaction.countDocuments({ status: PayoutTransactionStatus.FAILED });
  const underReview = await PayoutTransaction.countDocuments({ status: PayoutTransactionStatus.UNDER_REVIEW });
  console.log(JSON.stringify({ dryRun, processing, failed, underReview }, null, 2));
  if (!dryRun) {
    console.log('No automatic payout repairs are implemented. Use admin retry/hold workflows after review.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
