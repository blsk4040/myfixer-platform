import assert from 'assert';
import mongoose from 'mongoose';
import Booking, { BookingStatus } from '../src/models/booking.model';
import BookingReview, { BookingReviewStatus } from '../src/models/booking-review.model';
import Technician, { TechnicianApprovalStatus } from '../src/models/technician.model';
import { getProviderReputation, refreshProviderReputationStats } from '../src/services/provider-reputation.service';

const providerUserId = new mongoose.Types.ObjectId();
let completedCount = 0;
let reviewSummary: Array<{ averageRating: number; reviewCount: number }> = [];
let savedStats: Record<string, unknown> = {};

(Booking.countDocuments as any) = async (filter: any) => {
  assert.strictEqual(String(filter.technicianId), String(providerUserId));
  assert.strictEqual(filter.status, BookingStatus.COMPLETED);
  return completedCount;
};

(BookingReview.aggregate as any) = async (pipeline: any[]) => {
  assert.strictEqual(String(pipeline[0].$match.technicianId), String(providerUserId));
  assert.strictEqual(pipeline[0].$match.status, BookingReviewStatus.PUBLISHED);
  return reviewSummary;
};

(Technician.findOneAndUpdate as any) = (filter: any, update: any) => {
  assert.strictEqual(String(filter.userId), String(providerUserId));
  savedStats = update.$set;
  const profile = {
    approvalStatus: TechnicianApprovalStatus.APPROVED,
    stats: {
      averageRating: savedStats['stats.averageRating'],
      reviewCount: savedStats['stats.reviewCount'],
      completedJobs: savedStats['stats.completedJobs'],
    },
  };
  return { lean: async () => profile };
};

async function run() {
  completedCount = 137;
  reviewSummary = [{ averageRating: 4.833, reviewCount: 243 }];
  const reputation = await refreshProviderReputationStats(providerUserId);
  assert.deepStrictEqual(savedStats, {
    'stats.averageRating': 4.83,
    'stats.reviewCount': 243,
    'stats.completedJobs': 137,
  });
  assert.deepStrictEqual(reputation, {
    averageRating: 4.83,
    reviewCount: 243,
    completedJobs: 137,
    verified: true,
  });

  completedCount = 3;
  reviewSummary = [];
  const noReviews = await refreshProviderReputationStats(providerUserId);
  assert.deepStrictEqual(savedStats, {
    'stats.averageRating': 0,
    'stats.reviewCount': 0,
    'stats.completedJobs': 3,
  });
  assert.deepStrictEqual(noReviews, {
    averageRating: null,
    reviewCount: 0,
    completedJobs: 3,
    verified: true,
  });

  assert.deepStrictEqual(getProviderReputation({
    approvalStatus: TechnicianApprovalStatus.PENDING_REVIEW,
    stats: { averageRating: 4.9, reviewCount: 10, completedJobs: 12 },
  }), {
    averageRating: 4.9,
    reviewCount: 10,
    completedJobs: 12,
    verified: false,
  });

  console.log('Provider reputation tests passed.');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
