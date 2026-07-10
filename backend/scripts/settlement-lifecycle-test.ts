import assert from 'assert';
import { BookingStatus, CompletionStatus } from '../src/models/booking.model';
import { ProviderSettlementStatus } from '../src/models/provider-settlement.model';

const coreStatuses = Object.values(BookingStatus);
assert(coreStatuses.includes(BookingStatus.COMPLETED));
assert(!coreStatuses.includes('CUSTOMER_CONFIRMED' as BookingStatus));
assert(!coreStatuses.includes('READY_FOR_PAYOUT' as BookingStatus));

assert.deepStrictEqual(
  [
    CompletionStatus.NOT_SUBMITTED,
    CompletionStatus.CUSTOMER_CONFIRMATION_PENDING,
    CompletionStatus.CUSTOMER_CONFIRMED,
    CompletionStatus.ISSUE_REPORTED,
  ].every(Boolean),
  true
);

assert.deepStrictEqual(
  [
    ProviderSettlementStatus.APPROVAL_REQUIRED,
    ProviderSettlementStatus.PAYOUT_PROCESSING,
    ProviderSettlementStatus.PAID,
    ProviderSettlementStatus.PAYOUT_FAILED,
    ProviderSettlementStatus.ON_HOLD,
  ].every(Boolean),
  true
);

const terminalSettlementStates = new Set([
  ProviderSettlementStatus.PAID,
  ProviderSettlementStatus.REVERSED,
  ProviderSettlementStatus.CANCELLED,
]);
assert(terminalSettlementStates.has(ProviderSettlementStatus.PAID));
assert(!terminalSettlementStates.has(ProviderSettlementStatus.APPROVAL_REQUIRED));

console.log('Settlement lifecycle tests passed.');
