import { Response } from 'express';
import { normalizeCountryCode, isCurrencyCode } from '../config/market.config';
import { AuthenticatedRequest } from '../types/auth.types';
import {
  PayoutMethodError,
  createBankPayoutMethod,
  createMobileMoneyPayoutMethod,
  disablePayoutMethod,
  listTechnicianPayoutMethods,
  setDefaultPayoutMethod,
} from '../services/payout-method.service';
import { logAuditEvent } from '../services/audit.service';
import TechnicianModel from '../models/technician.model';
import { assertActiveMarket, MarketFinanceGuardError } from '../services/market-finance-guard.service';

const handleError = (res: Response, error: unknown, fallback: string): void => {
  if (error instanceof PayoutMethodError || error instanceof Error) {
    const statusCode =
      error instanceof PayoutMethodError || error instanceof MarketFinanceGuardError
        ? error.statusCode
        : 400;
    res.status(statusCode).json({
      success: false,
      message: error.message,
      code:
        error instanceof PayoutMethodError || error instanceof MarketFinanceGuardError
          ? error.code
          : 'PAYOUT_METHOD_ERROR',
    });
    return;
  }
  res.status(500).json({ success: false, message: fallback });
};

const technicianId = (req: AuthenticatedRequest): string => String(req.user.id ?? req.user._id);

const getTechnicianMarketInput = async (req: AuthenticatedRequest) => {
  const profile = await TechnicianModel.findOne({ userId: technicianId(req) }).select('countryCode').lean();
  const countryCode = normalizeCountryCode(req.body?.countryCode || req.body?.country || profile?.countryCode);
  const market = await assertActiveMarket(countryCode);
  return {
    countryCode,
    currency: market.identity.currency,
  };
};

export const getMyPayoutMethods = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    res.status(200).json({ success: true, methods: await listTechnicianPayoutMethods(technicianId(req)) });
  } catch (error) {
    handleError(res, error, 'Unable to load payout methods.');
  }
};

export const addBankPayoutMethod = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { countryCode, currency } = await getTechnicianMarketInput(req);
    if (!isCurrencyCode(currency)) {
      res.status(409).json({ success: false, message: 'Technician payout currency is not configured.', code: 'PAYOUT_CURRENCY_REQUIRED' });
      return;
    }
    const method = await createBankPayoutMethod(technicianId(req), {
      countryCode,
      currency,
      accountHolderName: String(req.body?.accountHolderName || ''),
      bankName: String(req.body?.bankName || ''),
      bankCode: String(req.body?.bankCode || ''),
      accountNumber: String(req.body?.accountNumber || ''),
      makeDefault: req.body?.makeDefault !== false,
    });
    await logAuditEvent(req, {
      action: 'payout_method.bank.create',
      module: 'PAYMENTS',
      resourceType: 'ProviderPayoutMethod',
      resourceId: method.id,
      metadata: { countryCode, currency, maskedDestination: method.maskedDestination },
    });
    res.status(201).json({ success: true, method });
  } catch (error) {
    handleError(res, error, 'Unable to add bank payout method.');
  }
};

export const addMobileMoneyPayoutMethod = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { countryCode, currency } = await getTechnicianMarketInput(req);
    if (!isCurrencyCode(currency)) {
      res.status(409).json({ success: false, message: 'Technician payout currency is not configured.', code: 'PAYOUT_CURRENCY_REQUIRED' });
      return;
    }
    const method = await createMobileMoneyPayoutMethod(technicianId(req), {
      countryCode,
      currency,
      operatorCode: String(req.body?.operatorCode || ''),
      phoneNumber: String(req.body?.phoneNumber || ''),
      accountName: String(req.body?.accountName || ''),
      makeDefault: req.body?.makeDefault !== false,
    });
    res.status(201).json({ success: true, method });
  } catch (error) {
    handleError(res, error, 'Unable to add mobile-money payout method.');
  }
};

export const makeDefaultPayoutMethod = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const method = await setDefaultPayoutMethod(technicianId(req), String(req.params.id || ''));
    res.status(200).json({ success: true, method });
  } catch (error) {
    handleError(res, error, 'Unable to update default payout method.');
  }
};

export const deletePayoutMethod = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const method = await disablePayoutMethod(technicianId(req), String(req.params.id || ''));
    res.status(200).json({ success: true, method });
  } catch (error) {
    handleError(res, error, 'Unable to disable payout method.');
  }
};
