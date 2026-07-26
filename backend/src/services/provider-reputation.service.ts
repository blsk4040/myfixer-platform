import mongoose from 'mongoose';
import Booking, { BookingStatus } from '../models/booking.model';
import BookingReview, { BookingReviewStatus } from '../models/booking-review.model';
import TechnicianModel from '../models/technician.model';

export interface ProviderReputationSnapshot {
  averageRating: number | null;
  reviewCount: number;
  completedJobs: number;
  verified: boolean;
}

const toObjectId = (value: mongoose.Types.ObjectId | string): mongoose.Types.ObjectId =>
  value instanceof mongoose.Types.ObjectId ? value : new mongoose.Types.ObjectId(String(value));

export const getProviderReputation = (profile: any): ProviderReputationSnapshot => {
  const reviewCount = Number(profile?.stats?.reviewCount || 0);
  const averageRating = reviewCount > 0 ? Number(profile?.stats?.averageRating || 0) : null;
  return {
    averageRating,
    reviewCount,
    completedJobs: Number(profile?.stats?.completedJobs || 0),
    verified: profile?.approvalStatus === 'APPROVED',
  };
};

export const refreshProviderReputationStats = async (
  providerUserId: mongoose.Types.ObjectId | string
): Promise<ProviderReputationSnapshot> => {
  const technicianId = toObjectId(providerUserId);
  const [reviewSummary, completedJobs] = await Promise.all([
    BookingReview.aggregate([
      { $match: { technicianId, status: BookingReviewStatus.PUBLISHED } },
      {
        $group: {
          _id: '$technicianId',
          averageRating: { $avg: '$rating' },
          reviewCount: { $sum: 1 },
        },
      },
    ]),
    Booking.countDocuments({
      technicianId,
      status: BookingStatus.COMPLETED,
    }),
  ]);

  const summary = reviewSummary[0];
  const stats = {
    averageRating: summary ? Number(Number(summary.averageRating || 0).toFixed(2)) : 0,
    reviewCount: summary ? Number(summary.reviewCount || 0) : 0,
    completedJobs,
  };

  const updated = await TechnicianModel.findOneAndUpdate(
    { userId: technicianId },
    {
      $set: {
        'stats.averageRating': stats.averageRating,
        'stats.reviewCount': stats.reviewCount,
        'stats.completedJobs': stats.completedJobs,
      },
    },
    { new: true }
  ).lean();

  return getProviderReputation(updated || { stats });
};
