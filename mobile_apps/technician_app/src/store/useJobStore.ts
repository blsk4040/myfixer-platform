// src/store/useJobStore.ts
import { create } from 'zustand';

// 🚀 Upgraded JobStatus to include all operational evolution checkpoints
export type JobStatus = 'IDLE' | 'ACCEPTED' | 'IN_ROUTE' | 'ARRIVED' | 'IN_PROGRESS' | 'DIAGNOSTIC_DONE' | 'COMPLETED';
export type InspectionStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'NOT_REQUIRED';
export type QuoteStatus =
  | 'NOT_REQUIRED'
  | 'DRAFT'
  | 'SUBMITTED'
  | 'SENT_TO_CLIENT'
  | 'CLARIFICATION_REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'SUPERSEDED'
  | 'CANCELLED';
export type BookingPaymentStatus = 'NOT_REQUIRED' | 'PENDING' | 'SECURED' | 'FAILED' | 'UNDER_REVIEW' | 'REFUNDED';
export type WorkAuthorizationStatus =
  | 'BLOCKED'
  | 'AWAITING_INSPECTION'
  | 'AWAITING_QUOTE'
  | 'AWAITING_QUOTE_APPROVAL'
  | 'AWAITING_PAYMENT'
  | 'AUTHORIZED';

interface BaseJobPayload {
  id: string;
  applianceType: string;
  faultDescription?: string; 
  price: number;
  currency: string;
  distance?: string;
  generalArea?: string;      // Masked view e.g., "Bryanston"
  scheduledTime?: string;    // Used for future queue buckets
  rating?: number;
  jobStatus?: JobStatus;     // Attached inline status variant tracking
  inspectionStatus?: InspectionStatus;
  quoteStatus?: QuoteStatus;
  quoteRequired?: boolean;
  paymentStatus?: BookingPaymentStatus;
  workAuthorizationStatus?: WorkAuthorizationStatus;
  workAuthorizationReason?: string;
}

export interface PrivacySafeIncomingJob extends BaseJobPayload {
  hasPreciseLocation: false;
  customerId?: never;
  customerName?: never;
  fullAddress?: never;
  complexDetails?: never;
  latitude?: never;
  longitude?: never;
  customerPhone?: never;
  recipientPhone?: never;
}

export interface AssignedBookingDetails extends BaseJobPayload {
  hasPreciseLocation: true;
  customerId: string;
  customerName?: string;
  latitude: number;
  longitude: number;
  fullAddress: string;
  complexDetails?: string;   // Complex / Estate detail lines
  customerPhone?: string;
  recipientPhone?: string;
}

export type JobPayload = PrivacySafeIncomingJob | AssignedBookingDetails;

interface JobStoreState {
  // Original Base States
  currentJob: JobPayload | null;
  jobStatus: JobStatus;
  isOnline: boolean;

  // New Phase 2 Pipeline Arrays
  incomingJobs: JobPayload[];
  activeJobs: JobPayload[];
  scheduledJobs: JobPayload[];
  completedJobs: JobPayload[];

  // New Phase 2 Financial Tickers
  earningsToday: number;
  earningsWeek: number;
  earningsMonth: number;

  // Actions Matrix
  setOnlineStatus: (isOnline: boolean) => void;
  upsertIncomingJob: (jobPayload: JobPayload) => boolean;
  replaceIncomingJobs: (jobs: JobPayload[]) => void;
  removeIncomingJob: (jobId: string) => void;
  acceptJob: (jobPayload: JobPayload) => void;
  declineJob: (jobId: string) => void;
  updateJobStatus: (status: JobStatus) => void;
  patchJob: (jobId: string, patch: Partial<JobPayload>) => void;
  advanceJobStatus: (jobId: string) => void; // ⚡ New Workflow Action
  completeJob: (jobId: string) => void;
  clearJob: () => void;
}

const initialIncoming: JobPayload[] = [];
const initialScheduled: JobPayload[] = [];

export const useJobStore = create<JobStoreState>((set) => ({
  // Empty production baselines are populated from real booking/socket data.
  currentJob: null,
  jobStatus: 'IDLE',
  isOnline: false,
  incomingJobs: initialIncoming,
  activeJobs: [],
  scheduledJobs: initialScheduled,
  completedJobs: [],
  earningsToday: 0,
  earningsWeek: 0,
  earningsMonth: 0,

  setOnlineStatus: (isOnline) => set({ isOnline }),

  upsertIncomingJob: (jobPayload) => {
    let inserted = false;
    set((state) => {
      if (!jobPayload.id) return {};
      inserted = !(state.incomingJobs || []).some((job) => job.id === jobPayload.id);
      return {
        incomingJobs: [
          jobPayload,
          ...(state.incomingJobs || []).filter((job) => job.id !== jobPayload.id),
        ],
      };
    });
    return inserted;
  },

  replaceIncomingJobs: (jobs) => set({
    incomingJobs: Array.from(
      new Map(jobs.filter((job) => job.id).map((job) => [job.id, job])).values()
    ),
  }),

  removeIncomingJob: (jobId) => set((state) => ({
    incomingJobs: state.incomingJobs.filter(j => j.id !== jobId)
  })),

  // Upgraded Accept Action: Satisfies old dashboard bindings AND populates Phase 2 active tracking pipes
  acceptJob: (jobPayload) => set((state) => {
    const updatedJob = { ...jobPayload, jobStatus: 'ACCEPTED' as const };
    const activeJobs = [
      ...state.activeJobs.filter(j => j.id !== jobPayload.id),
      updatedJob,
    ];
    return {
      currentJob: updatedJob,
      jobStatus: 'ACCEPTED',
      incomingJobs: state.incomingJobs.filter(j => j.id !== jobPayload.id),
      activeJobs
    };
  }),

  declineJob: (jobId) => set((state) => ({
    incomingJobs: state.incomingJobs.filter(j => j.id !== jobId)
  })),

  updateJobStatus: (status) => set((state) => {
    // Sync the status changes across both the legacy pointer and the activeJobs array items
    const updatedActive = state.activeJobs.map(job => 
      state.currentJob && job.id === state.currentJob.id ? { ...job, jobStatus: status } : job
    );
    return { 
      jobStatus: status,
      activeJobs: updatedActive,
      currentJob: state.currentJob ? { ...state.currentJob, jobStatus: status } : null
    };
  }),

  patchJob: (jobId, patch) => set((state) => {
    const patchOne = (job: JobPayload): JobPayload => job.id === jobId ? { ...job, ...patch } as JobPayload : job;
    return {
      currentJob: state.currentJob && state.currentJob.id === jobId ? patchOne(state.currentJob) : state.currentJob,
      activeJobs: state.activeJobs.map(patchOne),
      incomingJobs: state.incomingJobs.map(patchOne),
      scheduledJobs: state.scheduledJobs.map(patchOne),
      completedJobs: state.completedJobs.map(patchOne),
    };
  }),

  // 🚀 Integrated Action Engine: Sequentially cycles and clears pipeline settlements cleanly
  advanceJobStatus: (jobId: string) => set((state) => {
    const activeJobIndex = state.activeJobs.findIndex(j => j.id === jobId);
    if (activeJobIndex === -1) return {};

    const updatedActive = [...state.activeJobs];
    const job = { ...updatedActive[activeJobIndex] };

    // Stage 1: Accepted -> In Route
    if (!job.jobStatus || job.jobStatus === 'ACCEPTED') {
      job.jobStatus = 'IN_ROUTE';
      updatedActive[activeJobIndex] = job;
      return {
        activeJobs: updatedActive,
        jobStatus: 'IN_ROUTE',
        currentJob: state.currentJob && state.currentJob.id === jobId ? job : state.currentJob
      };
    } 
    // Stage 2: In Route -> Arrived at client site
    else if (job.jobStatus === 'IN_ROUTE') {
      job.jobStatus = 'ARRIVED';
      updatedActive[activeJobIndex] = job;
      return {
        activeJobs: updatedActive,
        jobStatus: 'ARRIVED',
        currentJob: state.currentJob && state.currentJob.id === jobId ? job : state.currentJob
      };
    } 
    // Stage 3: Arrived stays parked until backend inspection, quote and payment gates allow Start Work.
    else if (job.jobStatus === 'ARRIVED') {
      return {
        activeJobs: updatedActive,
        jobStatus: 'ARRIVED',
        currentJob: state.currentJob && state.currentJob.id === jobId ? job : state.currentJob
      };
    } 
    // Stage 4: Work in progress -> Collect Payment, close, and add to earnings.
    else if (job.jobStatus === 'IN_PROGRESS' || job.jobStatus === 'DIAGNOSTIC_DONE') {
      const finalizedJob = { ...job, jobStatus: 'COMPLETED' as const, rating: 5 };
      
      return {
        currentJob: state.currentJob && state.currentJob.id === jobId ? null : state.currentJob,
        jobStatus: state.currentJob && state.currentJob.id === jobId ? 'IDLE' : state.jobStatus,
        activeJobs: state.activeJobs.filter(j => j.id !== jobId),
        completedJobs: [finalizedJob, ...state.completedJobs],
        earningsToday: state.earningsToday + job.price,
        earningsWeek: state.earningsWeek + job.price,
        earningsMonth: state.earningsMonth + job.price
      };
    }

    return {};
  }),

  completeJob: (jobId) => set((state) => {
    const targetJob = state.activeJobs.find(j => j.id === jobId) || state.currentJob;
    if (!targetJob) return {};

    const finishedJob = { ...targetJob, jobStatus: 'COMPLETED' as const, rating: 5 };

    return {
      currentJob: null,
      jobStatus: 'IDLE',
      activeJobs: state.activeJobs.filter(j => j.id !== jobId),
      completedJobs: [finishedJob, ...state.completedJobs],
      earningsToday: state.earningsToday + targetJob.price,
      earningsWeek: state.earningsWeek + targetJob.price,
      earningsMonth: state.earningsMonth + targetJob.price
    };
  }),

  clearJob: () => set({
    currentJob: null,
    jobStatus: 'IDLE',
  }),
}));
