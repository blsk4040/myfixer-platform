import { Request } from 'express';
import mongoose from 'mongoose';
import User, { AdminRole, UserRole } from '../models/user.model';

export class AdminMarketScopeError extends Error {
  statusCode = 403;
  code = 'ADMIN_MARKET_SCOPE_DENIED';
}

export interface AdminMarketScope {
  canViewAllMarkets: boolean;
  allowedCountryCodes: string[];
  requestedCountryCode: string;
  effectiveCountryCodes: string[];
}

const normalizeCountryCode = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toUpperCase() : '';

const authUserId = (req: Request): string => {
  const user = (req as any).user as { id?: string; _id?: string } | undefined;
  return String(user?.id ?? user?._id ?? '').trim();
};

export const getAdminMarketScope = async (req: Request, countryCodeOverride?: unknown): Promise<AdminMarketScope> => {
  const userId = authUserId(req);
  if (!mongoose.Types.ObjectId.isValid(userId)) throw new AdminMarketScopeError('Admin identity is required.');

  const admin = await User.findOne({ _id: userId, role: UserRole.ADMIN, isActive: { $ne: false } })
    .select('adminRole countryCode')
    .lean();
  if (!admin) throw new AdminMarketScopeError('Admin account is not active.');

  const requestedCountryCode = normalizeCountryCode(countryCodeOverride ?? req.query.countryCode);
  const canViewAllMarkets = admin.adminRole === AdminRole.SUPER_ADMIN;
  const adminCountryCode = normalizeCountryCode(admin.countryCode);
  const allowedCountryCodes = canViewAllMarkets ? [] : [adminCountryCode].filter(Boolean);

  if (!canViewAllMarkets && !allowedCountryCodes.length) {
    throw new AdminMarketScopeError('This admin account is not assigned to a market.');
  }

  if (requestedCountryCode && !/^[A-Z]{2}$/.test(requestedCountryCode)) {
    throw new AdminMarketScopeError('Requested market is invalid.');
  }

  if (!canViewAllMarkets && requestedCountryCode && !allowedCountryCodes.includes(requestedCountryCode)) {
    throw new AdminMarketScopeError('You are not allowed to view this market.');
  }

  return {
    canViewAllMarkets,
    allowedCountryCodes,
    requestedCountryCode,
    effectiveCountryCodes: requestedCountryCode ? [requestedCountryCode] : allowedCountryCodes,
  };
};

export const countryScopeFilter = (scope: AdminMarketScope): Record<string, unknown> =>
  scope.effectiveCountryCodes.length ? { countryCode: { $in: scope.effectiveCountryCodes } } : {};

export const assertAdminCountryAccess = async (req: Request, countryCode: unknown): Promise<void> => {
  const requested = normalizeCountryCode(countryCode);
  const scope = await getAdminMarketScope(req, requested);
  if (!scope.canViewAllMarkets && !scope.effectiveCountryCodes.includes(requested)) {
    throw new AdminMarketScopeError('You are not allowed to access this market.');
  }
};

export const handleAdminMarketScopeError = (res: { status: (code: number) => { json: (body: unknown) => void } }, error: unknown): boolean => {
  if (error instanceof AdminMarketScopeError) {
    res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    return true;
  }
  return false;
};
