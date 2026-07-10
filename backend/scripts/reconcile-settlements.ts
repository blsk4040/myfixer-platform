import ProviderSettlement, { ProviderSettlementStatus } from '../src/models/provider-settlement.model';

const dryRun = !process.argv.includes('--apply');

async function main() {
  const stuckProcessing = await ProviderSettlement.countDocuments({ status: ProviderSettlementStatus.PAYOUT_PROCESSING });
  const approvalRequired = await ProviderSettlement.countDocuments({ status: ProviderSettlementStatus.APPROVAL_REQUIRED });
  const paidWithoutTimestamp = await ProviderSettlement.countDocuments({ status: ProviderSettlementStatus.PAID, paidAt: null });
  console.log(JSON.stringify({ dryRun, stuckProcessing, approvalRequired, paidWithoutTimestamp }, null, 2));
  if (!dryRun) {
    console.log('No automatic settlement repairs are implemented. Review the report and apply manual fixes through admin workflows.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
