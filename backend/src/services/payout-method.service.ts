import mongoose from 'mongoose';
import { IsoCountryCode, IsoCurrencyCode } from '../config/market.config';
import ProviderPayoutMethod, {
  IProviderPayoutMethod,
  ProviderPayoutMethodStatus,
  ProviderPayoutMethodType,
  ProviderPayoutProvider,
} from '../models/provider-payout-method.model';
import TechnicianModel, { TechnicianApprovalStatus } from '../models/technician.model';
import { PaystackService } from './paystack.service';
import { encryptPayoutValue, maskAccountNumber, maskPhoneNumber } from './payout-data-crypto.service';
import { assertMarketAllowsNewPayout } from './market-finance-guard.service';

export class PayoutMethodError extends Error {
  constructor(message: string, public readonly code: string, public readonly statusCode = 400) {
    super(message);
  }
}

const getPaystackBankRecipientType = (): string => (process.env.PAYSTACK_BANK_RECIPIENT_TYPE || 'nuban').trim();
const getPaystackMobileMoneyRecipientType = (): string => (process.env.PAYSTACK_MOBILE_MONEY_RECIPIENT_TYPE || 'mobile_money').trim();
const paystackTransfersEnabled = (): boolean => ['1', 'true', 'yes', 'on'].includes(String(process.env.PAYSTACK_TRANSFERS_ENABLED || 'false').toLowerCase());

const ensureTechnicianApproved = async (technicianId: string) => {
  const profile = await TechnicianModel.findOne({ userId: technicianId }).lean();
  if (!profile) throw new PayoutMethodError('Technician profile not found.', 'TECHNICIAN_PROFILE_NOT_FOUND', 404);
  if (profile.approvalStatus !== TechnicianApprovalStatus.APPROVED) {
    throw new PayoutMethodError('Technician approval is required before adding payout methods.', 'TECHNICIAN_NOT_APPROVED', 403);
  }
  return profile;
};

const ensurePayoutCountryMatchesTechnician = (
  profile: Awaited<ReturnType<typeof ensureTechnicianApproved>>,
  countryCode: IsoCountryCode,
  currency: IsoCurrencyCode
) => {
  const technicianCountryCode = profile.countryCode;
  if (countryCode !== technicianCountryCode) {
    throw new PayoutMethodError('Payout country must match your registered technician country.', 'PAYOUT_COUNTRY_MISMATCH', 403);
  }
};

const serialize = (method: IProviderPayoutMethod) => ({
  id: method.id,
  type: method.type,
  provider: method.provider,
  countryCode: method.countryCode,
  currency: method.currency,
  accountHolderName: method.accountHolderName,
  bankName: method.bankName || '',
  bankCode: method.bankCode || '',
  mobileProvider: method.mobileProvider || '',
  maskedDestination: method.maskedDestination,
  status: method.status,
  isDefault: method.isDefault,
  verifiedAt: method.verifiedAt,
  disabledAt: method.disabledAt,
});

export const serializePayoutMethod = serialize;

export const listTechnicianPayoutMethods = async (technicianId: string) => {
  const methods = await ProviderPayoutMethod.find({ technicianId, status: { $ne: ProviderPayoutMethodStatus.DISABLED } }).sort({ isDefault: -1, createdAt: -1 });
  return methods.map(serialize);
};

const setDefaultIfNeeded = async (method: IProviderPayoutMethod, makeDefault: boolean) => {
  const shouldDefault = makeDefault || !(await ProviderPayoutMethod.exists({
    technicianId: method.technicianId,
    countryCode: method.countryCode,
    currency: method.currency,
    status: ProviderPayoutMethodStatus.VERIFIED,
    isDefault: true,
  }));
  if (!shouldDefault) return method;
  await ProviderPayoutMethod.updateMany(
    { technicianId: method.technicianId, countryCode: method.countryCode, currency: method.currency, _id: { $ne: method._id } },
    { $set: { isDefault: false } }
  );
  method.isDefault = true;
  await method.save();
  return method;
};

export const createBankPayoutMethod = async (
  technicianId: string,
  input: {
    countryCode: IsoCountryCode;
    currency: IsoCurrencyCode;
    accountHolderName: string;
    bankName: string;
    bankCode: string;
    accountNumber: string;
    makeDefault?: boolean;
  }
) => {
  if (!mongoose.Types.ObjectId.isValid(technicianId)) throw new PayoutMethodError('Invalid technician id.', 'INVALID_TECHNICIAN_ID');
  const profile = await ensureTechnicianApproved(technicianId);
  ensurePayoutCountryMatchesTechnician(profile, input.countryCode, input.currency);
  await assertMarketAllowsNewPayout(input.countryCode, input.currency, ProviderPayoutProvider.PAYSTACK, ProviderPayoutMethodType.BANK_ACCOUNT);

  const accountHolderName = input.accountHolderName.trim();
  const accountNumber = input.accountNumber.replace(/\s+/g, '');
  const bankCode = input.bankCode.trim();
  if (!accountHolderName || !input.bankName.trim() || !bankCode || accountNumber.length < 4) {
    throw new PayoutMethodError('Bank account holder, bank and account number are required.', 'INVALID_BANK_DETAILS');
  }

  let providerRecipientCode = '';
  let providerRecipientId = '';
  let verificationStatus = ProviderPayoutMethodStatus.PENDING_VERIFICATION;
  if (paystackTransfersEnabled()) {
    await PaystackService.resolveBankAccount(accountNumber, bankCode);
    const recipient = await PaystackService.createTransferRecipient({
      type: getPaystackBankRecipientType(),
      name: accountHolderName,
      accountNumber,
      bankCode,
      currency: input.currency,
      metadata: { technicianId, countryCode: input.countryCode },
    });
    providerRecipientCode = String(recipient?.data?.recipient_code || '');
    providerRecipientId = String(recipient?.data?.id || '');
    verificationStatus = providerRecipientCode ? ProviderPayoutMethodStatus.VERIFIED : ProviderPayoutMethodStatus.PENDING_VERIFICATION;
  }

  const method = await ProviderPayoutMethod.create({
    technicianId,
    type: ProviderPayoutMethodType.BANK_ACCOUNT,
    provider: ProviderPayoutProvider.PAYSTACK,
    countryCode: input.countryCode,
    currency: input.currency,
    accountHolderName,
    bankName: input.bankName.trim(),
    bankCode,
    encryptedAccountNumber: encryptPayoutValue(accountNumber),
    maskedDestination: `${input.bankName.trim()} ${maskAccountNumber(accountNumber)}`,
    providerRecipientCode,
    providerRecipientId,
    status: verificationStatus,
    isDefault: false,
    verifiedAt: verificationStatus === ProviderPayoutMethodStatus.VERIFIED ? new Date() : null,
    metadata: { recipientCreationEnabled: paystackTransfersEnabled() },
  });
  await setDefaultIfNeeded(method, Boolean(input.makeDefault));
  return serialize(method);
};

export const createMobileMoneyPayoutMethod = async (
  technicianId: string,
  input: {
    countryCode: IsoCountryCode;
    currency: IsoCurrencyCode;
    operatorCode: string;
    phoneNumber: string;
    accountName?: string;
    makeDefault?: boolean;
  }
) => {
  const profile = await ensureTechnicianApproved(technicianId);
  ensurePayoutCountryMatchesTechnician(profile, input.countryCode, input.currency);
  await assertMarketAllowsNewPayout(input.countryCode, input.currency, ProviderPayoutProvider.PAYSTACK, ProviderPayoutMethodType.MOBILE_MONEY);
  const operatorCode = input.operatorCode.trim();
  const phoneNumber = input.phoneNumber.trim();
  const accountName = (input.accountName || 'Mobile money recipient').trim();
  if (!operatorCode || phoneNumber.length < 4) {
    throw new PayoutMethodError('Mobile-money operator and phone number are required.', 'INVALID_MOBILE_MONEY_DETAILS');
  }

  let providerRecipientCode = '';
  let providerRecipientId = '';
  let verificationStatus = ProviderPayoutMethodStatus.PENDING_VERIFICATION;
  if (paystackTransfersEnabled()) {
    const recipient = await PaystackService.createTransferRecipient({
      type: getPaystackMobileMoneyRecipientType(),
      name: accountName,
      mobileNumber: phoneNumber,
      operatorCode,
      currency: input.currency,
      metadata: { technicianId, countryCode: input.countryCode },
    });
    providerRecipientCode = String(recipient?.data?.recipient_code || '');
    providerRecipientId = String(recipient?.data?.id || '');
    verificationStatus = providerRecipientCode ? ProviderPayoutMethodStatus.VERIFIED : ProviderPayoutMethodStatus.PENDING_VERIFICATION;
  }

  const method = await ProviderPayoutMethod.create({
    technicianId,
    type: ProviderPayoutMethodType.MOBILE_MONEY,
    provider: ProviderPayoutProvider.PAYSTACK,
    countryCode: input.countryCode,
    currency: input.currency,
    accountHolderName: accountName,
    mobileProvider: operatorCode,
    encryptedMobileNumber: encryptPayoutValue(phoneNumber),
    maskedDestination: `${operatorCode} ${maskPhoneNumber(phoneNumber)}`,
    providerRecipientCode,
    providerRecipientId,
    status: verificationStatus,
    isDefault: false,
    verifiedAt: verificationStatus === ProviderPayoutMethodStatus.VERIFIED ? new Date() : null,
    metadata: { recipientCreationEnabled: paystackTransfersEnabled() },
  });
  await setDefaultIfNeeded(method, Boolean(input.makeDefault));
  return serialize(method);
};

export const setDefaultPayoutMethod = async (technicianId: string, methodId: string) => {
  const method = await ProviderPayoutMethod.findOne({ _id: methodId, technicianId, status: ProviderPayoutMethodStatus.VERIFIED });
  if (!method) throw new PayoutMethodError('Verified payout method not found.', 'PAYOUT_METHOD_NOT_FOUND', 404);
  await ProviderPayoutMethod.updateMany(
    { technicianId, countryCode: method.countryCode, currency: method.currency },
    { $set: { isDefault: false } }
  );
  method.isDefault = true;
  await method.save();
  return serialize(method);
};

export const disablePayoutMethod = async (technicianId: string, methodId: string) => {
  const method = await ProviderPayoutMethod.findOneAndUpdate(
    { _id: methodId, technicianId, status: { $ne: ProviderPayoutMethodStatus.DISABLED } },
    { $set: { status: ProviderPayoutMethodStatus.DISABLED, isDefault: false, disabledAt: new Date() } },
    { new: true }
  );
  if (!method) throw new PayoutMethodError('Payout method not found.', 'PAYOUT_METHOD_NOT_FOUND', 404);
  return serialize(method);
};
