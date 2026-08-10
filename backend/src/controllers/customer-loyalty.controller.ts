import { Request, Response } from 'express';
import { getCustomerLoyaltyProgram } from '../services/customer-loyalty-reward.service';

const getAuthUser = (req: Request): { id?: string; _id?: string } | undefined => (req as any).user;

export const getMyCustomerLoyaltyProgram = async (req: Request, res: Response): Promise<void> => {
  const authUser = getAuthUser(req);
  const userId = String(authUser?.id ?? authUser?._id ?? '').trim();

  if (!userId) {
    res.status(401).json({ message: 'Authentication is required.' });
    return;
  }

  try {
    const loyalty = await getCustomerLoyaltyProgram(userId);
    res.status(200).json({
      success: true,
      loyalty,
    });
  } catch (error) {
    console.error('Failed to load customer loyalty program:', error);
    res.status(500).json({ message: 'Unable to load loyalty rewards right now.' });
  }
};
