import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    return res.status(500).json({ message: 'JWT secret is not configured' });
  }

  if (!authHeader) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Invalid authorization header' });
  }

  try {
    const decoded = jwt.verify(token, secret);
    if (!decoded || typeof decoded !== 'object') {
      return res.status(403).json({ message: 'Invalid token' });
    }

    const payload = decoded as jwt.JwtPayload & { id?: string; _id?: string; email?: string; role?: string };
    const userId = payload._id ?? payload.id;
    if (!userId) {
      return res.status(403).json({ message: 'Invalid token payload' });
    }

    (req as any).user = {
      ...payload,
      id: userId,
      _id: userId,
    };
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Invalid token' });
  }
};
