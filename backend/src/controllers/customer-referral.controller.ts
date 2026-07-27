import { Request, Response } from 'express';
import User, { UserRole } from '../models/user.model';
import {
  getCustomerReferralSummary,
  getOrCreateCustomerReferralCode,
  listActiveCustomerReferralPromotions,
} from '../services/customer-referral.service';

const getAuthUser = (req: Request): { id?: string; _id?: string } | undefined => (req as any).user;

export const getMyCustomerReferralProgram = async (req: Request, res: Response): Promise<void> => {
  const authUser = getAuthUser(req);
  const userId = String(authUser?.id ?? authUser?._id ?? '').trim();

  if (!userId) {
    res.status(401).json({ message: 'Authentication is required.' });
    return;
  }

  try {
    const customer = await User.findOne({ _id: userId, role: UserRole.CUSTOMER }).select('name').lean();
    if (!customer) {
      res.status(404).json({ message: 'Customer account not found.' });
      return;
    }

    const referralCode = await getOrCreateCustomerReferralCode(userId);
    const appLinkBase = (process.env.CLIENT_APP_SHARE_URL || process.env.CLIENT_APP_URL || 'https://padi.app').replace(/\/$/, '');
    const inviteUrl = `${appLinkBase}/invite/${encodeURIComponent(referralCode)}`;
    const [summary, rewards] = await Promise.all([
      getCustomerReferralSummary(userId),
      listActiveCustomerReferralPromotions(userId),
    ]);

    res.status(200).json({
      success: true,
      referral: {
        referralCode,
        inviteUrl,
        shareMessage: `I booked through Padi. Use my invite code ${referralCode} when you sign up and get a discount on your first qualifying booking: ${inviteUrl}`,
        summary,
        rewards,
        friendDiscountMessage: 'Your friend gets a discount on their first qualifying booking.',
        rewardMessage: 'Your reward is issued after your friend completes a real paid booking.',
      },
    });
  } catch (error) {
    console.error('Failed to load customer referral program:', error);
    res.status(500).json({ message: 'Unable to load referral details right now.' });
  }
};
