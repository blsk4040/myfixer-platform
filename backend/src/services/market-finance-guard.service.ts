import MarketSetting, { IMarketSettingDocument, MarketStatus, PaymentProviderStatus } from '../models/market-setting.model';
import { PaymentProviderCode } from '../config/market.config';
import { ProviderPayoutMethodType } from '../models/provider-payout-method.model';

export class MarketFinanceGuardError extends Error {
  constructor(message: string, public readonly code: string, public readonly statusCode = 409) {
    super(message);
  }
}

type ProviderSetting = IMarketSettingDocument['payments']['providerSettings'][number];

const normalize = (value: unknown): string => String(value || '').trim().toUpperCase();

const methodAliases: Record<ProviderPayoutMethodType, string[]> = {
  [ProviderPayoutMethodType.BANK_ACCOUNT]: ['BANK_ACCOUNT', 'BANK', 'BANK_TRANSFER'],
  [ProviderPayoutMethodType.MOBILE_MONEY]: ['MOBILE_MONEY', 'MOMO', 'WALLET'],
};

const findProvider = (
  market: IMarketSettingDocument,
  provider: PaymentProviderCode | string,
  usage: 'collection' | 'payout'
): ProviderSetting | null => {
  const providerCode = normalize(provider);
  const configured = market.payments?.providerSettings || [];
  const match = configured.find((setting) => normalize(setting.provider) === providerCode);
  if (!match) return null;
  if (match.status !== PaymentProviderStatus.ACTIVE) return null;
  if (usage === 'payout' && match.payoutEnabled !== true) return null;
  return match;
};

export const assertActiveMarket = async (countryCode: unknown): Promise<IMarketSettingDocument> => {
  const normalizedCountryCode = normalize(countryCode);
  if (!normalizedCountryCode) {
    throw new MarketFinanceGuardError('Market country is required.', 'MARKET_COUNTRY_REQUIRED', 400);
  }

  const market = await MarketSetting.findOne({ 'identity.countryCode': normalizedCountryCode });
  if (!market) {
    throw new MarketFinanceGuardError('Market is not configured.', 'MARKET_NOT_CONFIGURED', 404);
  }
  if (market.deletionLock?.locked) {
    throw new MarketFinanceGuardError('Market is temporarily locked for administrative deletion.', 'MARKET_DELETE_PENDING', 423);
  }
  if (market.identity.status !== MarketStatus.ACTIVE) {
    throw new MarketFinanceGuardError('Market is not active for this operation.', 'MARKET_NOT_ACTIVE', 409);
  }

  return market;
};

export const assertMarketAllowsPaymentCollection = async (
  countryCode: unknown,
  currency: unknown,
  provider: PaymentProviderCode | string = 'PAYSTACK'
): Promise<{ market: IMarketSettingDocument; provider: ProviderSetting }> => {
  const market = await assertActiveMarket(countryCode);
  const expectedCurrency = normalize(market.identity.currency);
  if (normalize(currency) !== expectedCurrency) {
    throw new MarketFinanceGuardError('Payment currency must match the active booking market.', 'PAYMENT_CURRENCY_MISMATCH', 409);
  }

  const providerSetting = findProvider(market, provider, 'collection');
  if (!providerSetting) {
    throw new MarketFinanceGuardError('Payment provider is not active for this market.', 'PAYMENT_PROVIDER_INACTIVE', 409);
  }

  return { market, provider: providerSetting };
};

export const assertMarketAllowsNewPayout = async (
  countryCode: unknown,
  currency: unknown,
  provider: PaymentProviderCode | string = 'PAYSTACK',
  methodType?: ProviderPayoutMethodType
): Promise<{ market: IMarketSettingDocument; provider: ProviderSetting }> => {
  const market = await assertActiveMarket(countryCode);
  const expectedCurrency = normalize(market.identity.currency);
  if (normalize(currency) !== expectedCurrency) {
    throw new MarketFinanceGuardError('Payout currency must match the active technician market.', 'PAYOUT_CURRENCY_MISMATCH', 409);
  }

  const providerSetting = findProvider(market, provider, 'payout');
  if (!providerSetting) {
    throw new MarketFinanceGuardError('Payout provider is not active for this market.', 'PAYOUT_PROVIDER_INACTIVE', 409);
  }

  if (methodType) {
    const aliases = methodAliases[methodType] || [methodType];
    const enabledMethods = (providerSetting.methods || []).map(normalize);
    if (!aliases.some((alias) => enabledMethods.includes(alias))) {
      throw new MarketFinanceGuardError('Payout method is not enabled for this market provider.', 'PAYOUT_METHOD_DISABLED', 409);
    }
  }

  return { market, provider: providerSetting };
};

export const getMarketPayoutCapabilities = async (countryCode: unknown): Promise<{
  countryCode: string;
  currency: string;
  providerPayoutMethods: ProviderPayoutMethodType[];
  defaultProviderPayoutMethod: ProviderPayoutMethodType;
  payoutsEnabled: boolean;
  adminApprovalRequired: boolean;
}> => {
  try {
    const market = await assertActiveMarket(countryCode);
    const payoutProviders = (market.payments?.providerSettings || [])
      .filter((setting) => setting.status === PaymentProviderStatus.ACTIVE && setting.payoutEnabled === true);
    const methodSet = new Set<ProviderPayoutMethodType>();
    payoutProviders.forEach((setting) => {
      const methods = (setting.methods || []).map(normalize);
      if (methodAliases.BANK_ACCOUNT.some((alias) => methods.includes(alias))) methodSet.add(ProviderPayoutMethodType.BANK_ACCOUNT);
      if (methodAliases.MOBILE_MONEY.some((alias) => methods.includes(alias))) methodSet.add(ProviderPayoutMethodType.MOBILE_MONEY);
    });
    const providerPayoutMethods = Array.from(methodSet);
    return {
      countryCode: market.identity.countryCode,
      currency: market.identity.currency,
      providerPayoutMethods,
      defaultProviderPayoutMethod: providerPayoutMethods[0] || ProviderPayoutMethodType.BANK_ACCOUNT,
      payoutsEnabled: providerPayoutMethods.length > 0,
      adminApprovalRequired: true,
    };
  } catch {
    return {
      countryCode: normalize(countryCode),
      currency: '',
      providerPayoutMethods: [],
      defaultProviderPayoutMethod: ProviderPayoutMethodType.BANK_ACCOUNT,
      payoutsEnabled: false,
      adminApprovalRequired: true,
    };
  }
};
