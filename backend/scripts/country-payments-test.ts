import assert from 'assert';
import { CountryCode, CurrencyCode } from '../src/config/market.config';
import {
  getCountryPaymentCapabilities,
  getCountryPaymentFeatureFlags,
} from '../src/config/payment-capabilities.config';
import { ProviderPayoutMethodType } from '../src/models/provider-payout-method.model';

process.env.PROVIDER_PAYOUTS_ENABLED = 'false';
process.env.ZA_BANK_PAYOUTS_ENABLED = 'false';
process.env.GH_MOBILE_MONEY_PAYOUTS_ENABLED = 'true';

const za = getCountryPaymentCapabilities(CountryCode.ZA);
assert.strictEqual(za.currency, CurrencyCode.ZAR);
assert.deepStrictEqual(za.providerPayoutMethods, [ProviderPayoutMethodType.BANK_ACCOUNT]);
assert(!za.providerPayoutMethods.includes(ProviderPayoutMethodType.MOBILE_MONEY));
assert.strictEqual(getCountryPaymentFeatureFlags(CountryCode.ZA).bankPayoutsEnabled, false);

const gh = getCountryPaymentCapabilities(CountryCode.GH);
assert.strictEqual(gh.currency, CurrencyCode.GHS);
assert(gh.providerPayoutMethods.includes(ProviderPayoutMethodType.MOBILE_MONEY));
assert.strictEqual(getCountryPaymentFeatureFlags(CountryCode.GH).mobileMoneyPayoutsEnabled, false);

const ke = getCountryPaymentCapabilities(CountryCode.KE);
assert.strictEqual(ke.currency, CurrencyCode.KES);
assert(ke.providerPayoutMethods.includes(ProviderPayoutMethodType.BANK_ACCOUNT));

console.log('Country payment capability tests passed.');
