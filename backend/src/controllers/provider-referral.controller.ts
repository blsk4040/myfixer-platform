import { Request, Response } from 'express';
import Technician from '../models/technician.model';
import {
  getOrCreateProviderReferralCode,
  getProviderReferralEligibility,
  getProviderReferralSummary,
} from '../services/provider-referral.service';

const getAuthUser = (req: Request): { id?: string; _id?: string } | undefined => (req as any).user;

export const getMyProviderReferralProgram = async (req: Request, res: Response): Promise<void> => {
  const authUser = getAuthUser(req);
  const userId = String(authUser?.id ?? authUser?._id ?? '').trim();

  if (!userId) {
    res.status(401).json({ message: 'Authentication is required.' });
    return;
  }

  try {
    const technician = await Technician.findOne({ userId }).populate('userId', 'name isActive').exec();
    if (!technician) {
      res.status(404).json({ message: 'Padi Pro profile not found.' });
      return;
    }

    const providerName = typeof technician.userId === 'object' && technician.userId && 'name' in technician.userId
      ? String((technician.userId as any).name || '')
      : '';
    const referralCode = await getOrCreateProviderReferralCode(technician, providerName);
    const appLinkBase = (process.env.CLIENT_APP_SHARE_URL || process.env.CLIENT_APP_URL || 'https://padi.app').replace(/\/$/, '');
    const inviteUrl = `${appLinkBase}/invite/${encodeURIComponent(referralCode)}`;
    const summary = await getProviderReferralSummary(technician._id);
    const eligibility = await getProviderReferralEligibility(technician);
    const shareMessage = eligibility.eligible
      ? `Book trusted home services through Padi. Use my invite code ${referralCode} when you sign up: ${inviteUrl}`
      : '';

    res.status(200).json({
      success: true,
      referral: {
        referralCode,
        inviteUrl,
        shareMessage,
        summary,
        eligibility,
        rewardsEnabled: eligibility.eligible,
        rewardMessage: eligibility.eligible
          ? 'Rewards are issued only after the invited customer completes a legitimate paid booking.'
          : eligibility.reason,
      },
    });
  } catch (error) {
    console.error('Failed to load provider referral program:', error);
    res.status(500).json({ message: 'Unable to load referral details right now.' });
  }
};
