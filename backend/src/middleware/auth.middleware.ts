import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { AdminPermission, AdminRole, normalizeUserRole, UserRole } from '../models/user.model';

const ADMIN_ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  [AdminRole.SUPER_ADMIN]: Object.values(AdminPermission),
  [AdminRole.OPERATIONS_MANAGER]: [
    AdminPermission.OVERVIEW_READ,
    AdminPermission.BOOKINGS_READ,
    AdminPermission.BOOKINGS_UPDATE,
    AdminPermission.TECHNICIANS_READ,
    AdminPermission.CLIENTS_CONTACT_READ,
    AdminPermission.SETTINGS_READ,
  ],
  [AdminRole.DISPATCHER]: [
    AdminPermission.OVERVIEW_READ,
    AdminPermission.BOOKINGS_READ,
    AdminPermission.BOOKINGS_UPDATE,
  ],
  [AdminRole.FINANCE_ADMIN]: [
    AdminPermission.OVERVIEW_READ,
    AdminPermission.FINANCE_READ,
    AdminPermission.PROMOTIONS_READ,
    AdminPermission.PROMOTIONS_CREATE,
    AdminPermission.PROMOTIONS_UPDATE,
    AdminPermission.PROMOTIONS_ACTIVATE,
    AdminPermission.PROMOTIONS_PAUSE,
    AdminPermission.PROMOTIONS_ARCHIVE,
    AdminPermission.PROMOTIONS_PERFORMANCE_READ,
    AdminPermission.PROMOTIONS_REDEMPTIONS_READ,
    AdminPermission.SETTINGS_READ,
  ],
  [AdminRole.SUPPORT_AGENT]: [
    AdminPermission.OVERVIEW_READ,
    AdminPermission.BOOKINGS_READ,
    AdminPermission.TECHNICIANS_READ,
    AdminPermission.CLIENTS_CONTACT_READ,
    AdminPermission.SUPPORT_READ,
    AdminPermission.SUPPORT_REPLY,
    AdminPermission.SUPPORT_UPDATE,
  ],
  [AdminRole.TECHNICIAN_REVIEWER]: [
    AdminPermission.OVERVIEW_READ,
    AdminPermission.TECHNICIANS_READ,
    AdminPermission.TECHNICIANS_REVIEW,
  ],
  [AdminRole.MARKET_MANAGER]: [
    AdminPermission.OVERVIEW_READ,
    AdminPermission.MARKETS_READ,
    AdminPermission.MARKETS_UPDATE,
    AdminPermission.SETTINGS_READ,
  ],
  [AdminRole.READ_ONLY_ADMIN]: [
    AdminPermission.OVERVIEW_READ,
    AdminPermission.BOOKINGS_READ,
    AdminPermission.TECHNICIANS_READ,
    AdminPermission.FINANCE_READ,
    AdminPermission.PROMOTIONS_READ,
    AdminPermission.MARKETS_READ,
    AdminPermission.ADMINS_READ,
    AdminPermission.SETTINGS_READ,
  ],
};

export const authenticateToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    res.status(500).json({ message: 'JWT secret is not configured' });
    return;
  }

  if (!authHeader) {
    res.status(401).json({ message: 'No token provided' });
    return;
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    res.status(401).json({ message: 'Invalid authorization header' });
    return;
  }

  try {
    const decoded = jwt.verify(token, secret);
    if (!decoded || typeof decoded !== 'object') {
      res.status(403).json({ message: 'Invalid token' });
      return;
    }

    const payload = decoded as jwt.JwtPayload & { id?: string; _id?: string; email?: string; role?: string; tokenVersion?: number };
    const userId = payload._id ?? payload.id;
    if (!userId) {
      res.status(403).json({ message: 'Invalid token payload' });
      return;
    }

    const user = await User.findById(userId).select('role isActive accountStatus +refreshTokenVersion');
    if (!user || user.isActive === false) {
      res.status(403).json({ message: 'This account session is no longer active.' });
      return;
    }

    const currentTokenVersion = Number(user.refreshTokenVersion || 0);
    const presentedTokenVersion = Number.isFinite(Number(payload.tokenVersion))
      ? Number(payload.tokenVersion)
      : 0;
    if (presentedTokenVersion !== currentTokenVersion) {
      res.status(401).json({ message: 'This session has expired. Please sign in again.' });
      return;
    }

    (req as any).user = {
      ...payload,
      id: userId,
      _id: userId,
      role: normalizeUserRole(user.role || payload.role),
    };
    next();
  } catch (err) {
    res.status(403).json({ message: 'Invalid token' });
  }
};

export const requireRole =
  (allowedRoles: UserRole[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const role = normalizeUserRole((req as any).user?.role);

    if (!allowedRoles.includes(role)) {
      res.status(403).json({ message: 'This account is not allowed to perform this action.' });
      return;
    }

    next();
  };

export const requireAdminPermission =
  (permission: AdminPermission) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authUser = (req as any).user as { id?: string; role?: UserRole } | undefined;
    const role = normalizeUserRole(authUser?.role);

    if (role !== UserRole.ADMIN || !authUser?.id) {
      res.status(403).json({ message: 'This portal is only available to internal admin staff.' });
      return;
    }

    const admin = await User.findById(authUser.id).select('role adminRole adminPermissions isActive accountStatus');
    if (!admin || admin.role !== UserRole.ADMIN || admin.isActive === false) {
      res.status(403).json({ message: 'This admin account is not active.' });
      return;
    }

    const adminRole = admin.adminRole || AdminRole.READ_ONLY_ADMIN;
    const allowed = new Set([
      ...(ADMIN_ROLE_PERMISSIONS[adminRole] || []),
      ...(admin.adminPermissions || []),
    ]);

    if (!allowed.has(permission)) {
      res.status(403).json({ message: 'You do not have permission to perform this action.' });
      return;
    }

    next();
  };
