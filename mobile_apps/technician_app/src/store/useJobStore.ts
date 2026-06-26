// src/store/useJobStore.ts
import { create } from 'zustand';

// 🚀 Upgraded JobStatus to include all operational evolution checkpoints
export type JobStatus = 'IDLE' | 'ACCEPTED' | 'IN_ROUTE' | 'ARRIVED' | 'DIAGNOSTIC_DONE' | 'COMPLETED';

// Unified payload schema supporting Phase 1 structures & Phase 2 South African layouts
export interface JobPayload {
  id: string;
  customerId: string;
  customerName?: string;
  applianceType: string;
  faultDescription?: string; 
  price: number;
  currency: string;
  latitude: number;
  longitude: number;
  distance?: string;
  generalArea?: string;      // Masked view e.g., "Bryanston"
  fullAddress?: string;      // Unlocked post-acceptance
  complexDetails?: string;   // Complex / Estate detail lines
  scheduledTime?: string;    // Used for future queue buckets
  rating?: number;
  jobStatus?: JobStatus;     // Attached inline status variant tracking
}

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
  acceptJob: (jobPayload: JobPayload) => void;
  declineJob: (jobId: string) => void;
  updateJobStatus: (status: JobStatus) => void;
  advanceJobStatus: (jobId: string) => void; // ⚡ New Workflow Action
  completeJob: (jobId: string) => void;
  clearJob: () => void;
}

// Mock initial queues matching your South African service locations perfectly
const initialIncoming: JobPayload[] = [
  { id: 'job_001', customerId: 'c_01', customerName: 'Sarah M.', applianceType: 'Defy Double Door Fridge', faultDescription: 'Compressor clicking, not cooling down properly.', price: 450, currency: 'ZAR', latitude: -26.2215, longitude: 28.1432, distance: '2.4 km', generalArea: 'Germiston', fullAddress: 'Unit 12, Stone Arch Estate', complexDetails: 'Phase 2', jobStatus: 'IDLE' },
  { id: 'job_002', customerId: 'c_02', customerName: 'Dumisani K.', applianceType: 'Samsung EcoBubble Washer', faultDescription: 'Error code E4, won\'t drain mid-cycle.', price: 450, currency: 'ZAR', latitude: -26.1189, longitude: 28.1256, distance: '4.1 km', generalArea: 'Greenstone Hill', fullAddress: '45 Greenstone Avenue', complexDetails: 'Block C', jobStatus: 'IDLE' }
];

const initialScheduled: JobPayload[] = [
  { id: 'job_003', customerId: 'c_03', customerName: 'Johan van Zyl', applianceType: 'Whirlpool Dishwasher', price: 450, currency: 'ZAR', latitude: -25.7923, longitude: 28.2912, distance: '8.5 km', generalArea: 'Garsfontein', fullAddress: '12 Garsfontein Road', scheduledTime: 'Tomorrow, 09:00', jobStatus: 'IDLE' }
];

export const useJobStore = create<JobStoreState>((set) => ({
  // Seed state baselines
  currentJob: null,
  jobStatus: 'IDLE',
  isOnline: false,
  incomingJobs: initialIncoming,
  activeJobs: [],
  scheduledJobs: initialScheduled,
  completedJobs: [],
  earningsToday: 1250,
  earningsWeek: 6800,
  earningsMonth: 27400,

  setOnlineStatus: (isOnline) => set({ isOnline }),

  // Upgraded Accept Action: Satisfies old dashboard bindings AND populates Phase 2 active tracking pipes
  acceptJob: (jobPayload) => set((state) => {
    const updatedJob = { ...jobPayload, jobStatus: 'ACCEPTED' as const };
    return {
      currentJob: updatedJob,
      jobStatus: 'ACCEPTED',
      incomingJobs: state.incomingJobs.filter(j => j.id !== jobPayload.id),
      activeJobs: [...state.activeJobs, updatedJob]
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
    // Stage 3: Arrived -> Diagnostic Complete
    else if (job.jobStatus === 'ARRIVED') {
      job.jobStatus = 'DIAGNOSTIC_DONE';
      updatedActive[activeJobIndex] = job;
      return {
        activeJobs: updatedActive,
        jobStatus: 'DIAGNOSTIC_DONE',
        currentJob: state.currentJob && state.currentJob.id === jobId ? job : state.currentJob
      };
    } 
    // Stage 4: Diagnostic complete -> Collect Payment, close, and add to earnings!
    else if (job.jobStatus === 'DIAGNOSTIC_DONE') {
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