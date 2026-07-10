import assert from 'assert';
import {
  ProviderPayoutMethodStatus,
  ProviderPayoutMethodType,
} from '../src/models/provider-payout-method.model';
import { PayoutTransactionStatus } from '../src/models/payout-transaction.model';
import { encryptPayoutValue, decryptPayoutValue, maskAccountNumber, maskPhoneNumber } from '../src/services/payout-data-crypto.service';

process.env.PAYOUT_DATA_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef';

const encrypted = encryptPayoutValue('1234567890');
assert.notStrictEqual(encrypted, '1234567890');
assert.strictEqual(decryptPayoutValue(encrypted), '1234567890');
assert.strictEqual(maskAccountNumber('1234567890'), '****7890');
assert.strictEqual(maskPhoneNumber('+27721234567'), '+27****67');

assert.strictEqual(ProviderPayoutMethodType.BANK_ACCOUNT, 'BANK_ACCOUNT');
assert.strictEqual(ProviderPayoutMethodType.MOBILE_MONEY, 'MOBILE_MONEY');
assert.strictEqual(ProviderPayoutMethodStatus.VERIFIED, 'VERIFIED');
assert.strictEqual(PayoutTransactionStatus.SUCCESS, 'SUCCESS');
assert.strictEqual(PayoutTransactionStatus.UNDER_REVIEW, 'UNDER_REVIEW');

console.log('Payout encryption and status tests passed.');
