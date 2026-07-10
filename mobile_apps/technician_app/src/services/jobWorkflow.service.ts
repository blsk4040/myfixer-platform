import { Alert } from 'react-native';
import apiService from './api.service';
import { TrackingService } from './TrackingService';
import { NotificationService } from './notification.service';
import { AssignedBookingDetails, JobPayload, PrivacySafeIncomingJob, useJobStore } from '../store/useJobStore';

export function normalizeJobPayload(payload: any): JobPayload {
  const priceMinor = Number(payload.priceMinor);
  const rawPrice = Number(payload.callOutFee ?? payload.price);
  const price = Number.isFinite(priceMinor)
    ? priceMinor / 100
    : Number.isFinite(rawPrice)
      ? rawPrice
      : 450;

  const hasPreciseLocation =
    payload.hasPreciseLocation === true &&
    Number.isFinite(Number(payload.latitude)) &&
    Number.isFinite(Number(payload.longitude));

  if (!hasPreciseLocation) {
    const incoming: PrivacySafeIncomingJob = {
      id: String(payload.bookingId || payload.id || ''),
      applianceType: payload.applianceType || 'Unknown Service',
      faultDescription: payload.problemSummary || payload.faultDescription || 'No description provided.',
      price,
      currency: payload.currency || 'ZAR',
      distance: payload.distanceText || payload.distance || 'Nearby',
      generalArea: payload.approximateArea || payload.generalArea || 'Local Area',
      scheduledTime: payload.scheduledAt || payload.scheduledTime,
      hasPreciseLocation: false,
    };
    return incoming;
  }

  const assigned: AssignedBookingDetails = {
    id: String(payload.bookingId || payload.id || ''),
    customerId: String(payload.customerId || ''),
    applianceType: payload.applianceType || 'Unknown Service',
    faultDescription: payload.faultDescription || 'No description provided.',
    price,
    currency: payload.currency || 'ZAR',
    latitude: Number(payload.latitude),
    longitude: Number(payload.longitude),
    distance: payload.distanceText || payload.distance || 'Nearby',
    generalArea: payload.generalArea || 'Local Area',
    customerName: payload.customerName || 'Client',
    fullAddress: payload.fullAddress || '',
    complexDetails: payload.complexDetails || '',
    customerPhone: payload.customerPhone || payload.recipientPhone || '',
    recipientPhone: payload.recipientPhone || payload.customerPhone || '',
    hasPreciseLocation: true,
  };
  return assigned;
}

export async function refreshAvailableJobs(): Promise<void> {
  const response = await apiService.getAvailableJobsForTechnician();
  useJobStore.getState().replaceIncomingJobs(
    Array.isArray(response.jobs) ? response.jobs.map(normalizeJobPayload) : []
  );
}

export async function acceptBookingWorkflow(job: JobPayload, technicianId?: string): Promise<void> {
  if (!technicianId) {
    throw new Error('Please sign in again before accepting jobs.');
  }

  const response = await apiService.acceptBooking(job.id);
  const assignedJob = response.booking ? normalizeJobPayload(response.booking) : job;

  if (assignedJob.hasPreciseLocation !== true) {
    throw new Error('Booking accepted, but exact service details were not returned. Please refresh and try again.');
  }

  useJobStore.getState().acceptJob(assignedJob);
  await NotificationService.handleJobAccepted(job.id);

  const trackingLaunched = await TrackingService.startLiveTracking(technicianId, job.id);
  if (!trackingLaunched) {
    Alert.alert('Telemetry Offline', 'Background location tracking engine failed to initialize.');
  }
}

export async function declineBookingWorkflow(jobId: string): Promise<void> {
  await apiService.declineBooking(jobId);
  useJobStore.getState().declineJob(jobId);
}
