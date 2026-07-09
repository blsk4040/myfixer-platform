import { Request, Response } from 'express';
import mongoose from 'mongoose';
import PushToken from '../models/push-token.model';
import NotificationPreference from '../models/notification-preference.model';

const getAuthUser = (req: Request) =>
  (req as any).user as { id?: string; _id?: string; email?: string; role?: string } | undefined;

const normalizePlatform = (value: unknown): 'ios' | 'android' | 'web' | 'unknown' => {
  const platform = typeof value === 'string' ? value.toLowerCase().trim() : '';
  return platform === 'ios' || platform === 'android' || platform === 'web' ? platform : 'unknown';
};

const normalizeApp = (value: unknown): 'client' | 'technician' | 'admin' | 'unknown' => {
  const app = typeof value === 'string' ? value.toLowerCase().trim() : '';
  return app === 'client' || app === 'technician' || app === 'admin' ? app : 'unknown';
};

const isExpoPushToken = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const token = value.trim();
  return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
};

export const registerPushToken = async (req: Request, res: Response): Promise<void> => {
  const authUser = getAuthUser(req);
  const userId = String(authUser?.id ?? authUser?._id ?? '').trim();
  const { token, deviceId } = req.body || {};

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    res.status(401).json({ message: 'Valid user identity is required.' });
    return;
  }

  if (!isExpoPushToken(token)) {
    res.status(400).json({ message: 'A valid Expo push token is required.' });
    return;
  }

  const normalizedToken = token.trim();
  const now = new Date();

  try {
    const pushToken = await PushToken.findOneAndUpdate(
      { token: normalizedToken },
      {
        $set: {
          userId: new mongoose.Types.ObjectId(userId),
          platform: normalizePlatform(req.body.platform),
          app: normalizeApp(req.body.app),
          deviceId: typeof deviceId === 'string' ? deviceId.trim() : '',
          isActive: true,
          lastRegisteredAt: now,
          disabledAt: null,
        },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    await NotificationPreference.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId) },
      {
        $setOnInsert: {
          userId: new mongoose.Types.ObjectId(userId),
          channels: {
            inApp: true,
            email: true,
            push: true,
            sms: false,
            whatsapp: false,
          },
        },
        $set: {
          'channels.push': true,
        },
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({ success: true, pushTokenId: pushToken._id });
  } catch (error) {
    console.error('Failed to register push token:', error);
    res.status(500).json({ message: 'Failed to register push token.' });
  }
};

export const unregisterPushToken = async (req: Request, res: Response): Promise<void> => {
  const authUser = getAuthUser(req);
  const userId = String(authUser?.id ?? authUser?._id ?? '').trim();
  const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    res.status(401).json({ message: 'Valid user identity is required.' });
    return;
  }

  if (!token) {
    res.status(400).json({ message: 'Push token is required.' });
    return;
  }

  await PushToken.updateOne(
    { token, userId: new mongoose.Types.ObjectId(userId) },
    { $set: { isActive: false, disabledAt: new Date() } }
  );

  res.status(200).json({ success: true });
};
