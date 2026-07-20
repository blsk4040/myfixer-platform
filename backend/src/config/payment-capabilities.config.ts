import { CountryCode, CurrencyCode, IsoCountryCode, IsoCurrencyCode } from './market.config';
import { ProviderPayoutMethodType } from '../models/provider-payout-method.model';

export type CustomerPaymentMethod = 'CARD' | 'INSTANT_EFT' | 'CAPITEC_PAY' | 'SCAN_TO_PAY' | 'BANK' | 'MOBILE_MONEY';

export interface CountryPaymentCapabilities {
  countryCode: IsoCountryCode;
  currency: IsoCurrencyCode;
  collectionProvider: 'PAYSTACK';
  payoutProvider: 'PAYSTACK';
  customerPaymentMethods: CustomerPaymentMethod[];
  providerPayoutMethods: ProviderPayoutMethodType[];
  defaultProviderPayoutMethod: ProviderPayoutMethodType;
  collectionEnabled: boolean;
  payoutsEnabled: boolean;
  adminApprovalRequired: boolean;
}

export interface CountryPaymentFeatureFlags {
  countryCode: IsoCountryCode;
  customerCollectionsEnabled: boolean;
  providerPayoutsEnabled: boolean;
  bankPayoutsEnabled: boolean;
  mobileMoneyCollectionsEnabled: boolean;
  mobileMoneyPayoutsEnabled: boolean;
  automaticPayoutsEnabled: boolean;
  adminApprovalRequired: boolean;
}

const envFlag = (name: string, fallback: boolean): boolean => {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
};

export const COUNTRY_PAYMENT_CAPABILITIES: Record<CountryCode, CountryPaymentCapabilities> = {
  [CountryCode.ZA]: {
    countryCode: CountryCode.ZA,
    currency: CurrencyCode.ZAR,
    collectionProvider: 'PAYSTACK',
    payoutProvider: 'PAYSTACK',
    customerPaymentMethods: ['CARD', 'INSTANT_EFT', 'CAPITEC_PAY', 'SCAN_TO_PAY'],
    providerPayoutMethods: [ProviderPayoutMethodType.BANK_ACCOUNT],
    defaultProviderPayoutMethod: ProviderPayoutMethodType.BANK_ACCOUNT,
    collectionEnabled: true,
    payoutsEnabled: false,
    adminApprovalRequired: true,
  },
  [CountryCode.GH]: {
    countryCode: CountryCode.GH,
    currency: CurrencyCode.GHS,
    collectionProvider: 'PAYSTACK',
    payoutProvider: 'PAYSTACK',
    customerPaymentMethods: ['CARD', 'MOBILE_MONEY'],
    providerPayoutMethods: [ProviderPayoutMethodType.BANK_ACCOUNT, ProviderPayoutMethodType.MOBILE_MONEY],
    defaultProviderPayoutMethod: ProviderPayoutMethodType.MOBILE_MONEY,
    collectionEnabled: false,
    payoutsEnabled: false,
    adminApprovalRequired: true,
  },
  [CountryCode.KE]: {
    countryCode: CountryCode.KE,
    currency: CurrencyCode.KES,
    collectionProvider: 'PAYSTACK',
    payoutProvider: 'PAYSTACK',
    customerPaymentMethods: ['CARD', 'MOBILE_MONEY'],
    providerPayoutMethods: [ProviderPayoutMethodType.BANK_ACCOUNT, ProviderPayoutMethodType.MOBILE_MONEY],
    defaultProviderPayoutMethod: ProviderPayoutMethodType.MOBILE_MONEY,
    collectionEnabled: false,
    payoutsEnabled: false,
    adminApprovalRequired: true,
  },
  [CountryCode.NG]: disabled(CountryCode.NG, CurrencyCode.NGN),
  [CountryCode.UG]: disabled(CountryCode.UG, CurrencyCode.UGX),
  [CountryCode.TZ]: disabled(CountryCode.TZ, CurrencyCode.TZS),
  [CountryCode.RW]: disabled(CountryCode.RW, CurrencyCode.RWF),
  [CountryCode.ZM]: disabled(CountryCode.ZM, CurrencyCode.ZMW),
};

function disabled(countryCode: IsoCountryCode, currency: IsoCurrencyCode): CountryPaymentCapabilities {
  return {
    countryCode,
    currency,
    collectionProvider: 'PAYSTACK',
    payoutProvider: 'PAYSTACK',
    customerPaymentMethods: [],
    providerPayoutMethods: [],
    defaultProviderPayoutMethod: ProviderPayoutMethodType.BANK_ACCOUNT,
    collectionEnabled: false,
    payoutsEnabled: false,
    adminApprovalRequired: true,
  };
}

export const getCountryPaymentCapabilities = (countryCode: IsoCountryCode): CountryPaymentCapabilities =>
  COUNTRY_PAYMENT_CAPABILITIES[countryCode as CountryCode] ?? disabled(countryCode, '');

export const getCountryPaymentFeatureFlags = (countryCode: IsoCountryCode): CountryPaymentFeatureFlags => {
  const capabilities = getCountryPaymentCapabilities(countryCode);
  const globalPayouts = envFlag('PROVIDER_PAYOUTS_ENABLED', false);
  return {
    countryCode,
    customerCollectionsEnabled: capabilities.collectionEnabled && envFlag(`${countryCode}_CUSTOMER_COLLECTIONS_ENABLED`, capabilities.collectionEnabled),
    providerPayoutsEnabled: globalPayouts && envFlag(`${countryCode}_PROVIDER_PAYOUTS_ENABLED`, capabilities.payoutsEnabled),
    bankPayoutsEnabled:
      capabilities.providerPayoutMethods.includes(ProviderPayoutMethodType.BANK_ACCOUNT) &&
      globalPayouts &&
      envFlag(`${countryCode}_BANK_PAYOUTS_ENABLED`, false),
    mobileMoneyCollectionsEnabled:
      capabilities.customerPaymentMethods.includes('MOBILE_MONEY') &&
      envFlag(`${countryCode}_MOBILE_MONEY_COLLECTIONS_ENABLED`, false),
    mobileMoneyPayoutsEnabled:
      capabilities.providerPayoutMethods.includes(ProviderPayoutMethodType.MOBILE_MONEY) &&
      globalPayouts &&
      envFlag(`${countryCode}_MOBILE_MONEY_PAYOUTS_ENABLED`, false),
    automaticPayoutsEnabled: envFlag('AUTOMATIC_PAYOUTS_ENABLED', false),
    adminApprovalRequired: envFlag('ADMIN_PAYOUT_APPROVAL_REQUIRED', capabilities.adminApprovalRequired),
  };
};

export const assertPayoutMethodSupported = (
  countryCode: IsoCountryCode,
  currency: IsoCurrencyCode,
  methodType: ProviderPayoutMethodType
): void => {
  const capabilities = getCountryPaymentCapabilities(countryCode);
  if (capabilities.currency !== currency) {
    throw new Error(`Payout currency ${currency} is not supported for ${countryCode}.`);
  }
  if (!capabilities.providerPayoutMethods.includes(methodType)) {
    throw new Error(`${methodType} payouts are not supported for ${countryCode}.`);
  }
};

export const validatePayoutStartupConfiguration = (): void => {
  const payoutsEnabled = envFlag('PROVIDER_PAYOUTS_ENABLED', false);
  const transfersEnabled = envFlag('PAYSTACK_TRANSFERS_ENABLED', false);
  const automaticPayoutsEnabled = envFlag('AUTOMATIC_PAYOUTS_ENABLED', false);
  const adminApprovalRequired = envFlag('ADMIN_PAYOUT_APPROVAL_REQUIRED', true);
  if (automaticPayoutsEnabled && adminApprovalRequired) {
    throw new Error('AUTOMATIC_PAYOUTS_ENABLED cannot be true while ADMIN_PAYOUT_APPROVAL_REQUIRED=true.');
  }
  if (!payoutsEnabled && !transfersEnabled) return;
  if (!process.env.PAYOUT_DATA_ENCRYPTION_KEY?.trim()) {
    throw new Error('PAYOUT_DATA_ENCRYPTION_KEY must be configured when provider payouts are enabled.');
  }
  if (!process.env.PAYSTACK_SECRET_KEY?.trim()) {
    throw new Error('PAYSTACK_SECRET_KEY must be configured when Paystack transfers are enabled.');
  }
  if (!process.env.PAYSTACK_TRANSFER_SOURCE?.trim()) {
    throw new Error('PAYSTACK_TRANSFER_SOURCE must be configured when Paystack transfers are enabled.');
  }
};
