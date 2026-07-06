// src/store/useJobStore.ts
import { create } from 'zustand';

export interface JobPayload {
  id: string;
  category?: string;
  subCategory?: string;
  applianceType: string;
  faultDescription?: string;
  price: number;
  currency: string;
  customerName?: string;
  fullAddress?: string;
  complexDetails?: string;
  distance?: string;
  timeString?: string;
  scheduledTime?: string;
  generalArea?: string;
  jobStatus?: 'ACCEPTED' | 'IN_ROUTE' | 'ARRIVED' | 'DIAGNOSTIC_DONE' | 'COMPLETED';
}

interface JobState {
  incomingJobs: JobPayload[];
  activeJobs: JobPayload[];
  scheduledJobs: JobPayload[];
  completedJobs: JobPayload[];

  acceptJob: (jobId: string) => void;
  declineJob: (jobId: string) => void;
  advanceJobStatus: (jobId: string) => void;
  setIncomingJobs: (jobs: JobPayload[]) => void;
}

export const useJobStore = create<JobState>((set) => ({
  incomingJobs: [],
  activeJobs: [],
  scheduledJobs: [],
  completedJobs: [],

  acceptJob: (jobId) => set((state) => {
    const jobToAccept = state.incomingJobs.find((job) => job.id === jobId);
    if (!jobToAccept) return {};

    const updatedJob: JobPayload = {
      ...jobToAccept,
      jobStatus: 'ACCEPTED',
    };

    return {
      incomingJobs: state.incomingJobs.filter((job) => job.id !== jobId),
      activeJobs: [...state.activeJobs, updatedJob],
    };
  }),

  declineJob: (jobId) => set((state) => ({
    incomingJobs: state.incomingJobs.filter((job) => job.id !== jobId),
  })),

  advanceJobStatus: (jobId) => set((state) => {
    const activeJob = state.activeJobs.find((job) => job.id === jobId);

    if (!activeJob) {
      const scheduledJob = state.scheduledJobs.find((job) => job.id === jobId);
      if (scheduledJob) {
        return {
          scheduledJobs: state.scheduledJobs.filter((job) => job.id !== jobId),
          activeJobs: [...state.activeJobs, { ...scheduledJob, jobStatus: 'ACCEPTED' as const }],
        };
      }
      return {};
    }

    switch (activeJob.jobStatus) {
      case 'ACCEPTED':
        return {
          activeJobs: state.activeJobs.map((job) => (
            job.id === jobId ? { ...job, jobStatus: 'IN_ROUTE' as const } : job
          )),
        };
      case 'IN_ROUTE':
        return {
          activeJobs: state.activeJobs.map((job) => (
            job.id === jobId ? { ...job, jobStatus: 'ARRIVED' as const } : job
          )),
        };
      case 'ARRIVED':
        return {
          activeJobs: state.activeJobs.map((job) => (
            job.id === jobId ? { ...job, jobStatus: 'DIAGNOSTIC_DONE' as const } : job
          )),
        };
      case 'DIAGNOSTIC_DONE':
        return {
          activeJobs: state.activeJobs.filter((job) => job.id !== jobId),
          completedJobs: [{ ...activeJob, jobStatus: 'COMPLETED' as const }, ...state.completedJobs],
        };
      default:
        return {};
    }
  }),

  setIncomingJobs: (jobs) => set({ incomingJobs: jobs }),
}));
