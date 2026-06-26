// src/store/useJobStore.ts
import { create } from 'zustand';

// 1. Declare explicit structure properties matching your UI interfaces
export interface JobPayload {
  id: string;
  category?: string;
  subCategory?: string;
  applianceType: string;         // Used by Active, Completed, & Scheduled Tabs
  faultDescription?: string;     // Used by ActiveJobsTab
  price: number;                 // Strictly typed to number for clean arithmetic aggregation
  currency: string;              // e.g., 'R' for South African Rand
  customerName?: string;         // Used by ActiveJobsTab
  fullAddress?: string;          // Used by ActiveJobsTab
  complexDetails?: string;       // Used by ActiveJobsTab
  distance?: string;             // Used by Scheduled & Incoming templates
  timeString?: string;           // Optional relative timestamp
  scheduledTime?: string;        // Used by ScheduledJobsTab
  generalArea?: string;          // Used by ScheduledJobsTab
  jobStatus?: 'ACCEPTED' | 'IN_ROUTE' | 'ARRIVED' | 'DIAGNOSTIC_DONE' | 'COMPLETED';
}

interface JobState {
  incomingJobs: JobPayload[];
  activeJobs: JobPayload[];
  scheduledJobs: JobPayload[];
  completedJobs: JobPayload[];
  
  // Action Handlers called by your tab files
  acceptJob: (jobId: string) => void;
  declineJob: (jobId: string) => void;
  advanceJobStatus: (jobId: string) => void;
  
  // Initialization tools for streaming items down networks safely
  setIncomingJobs: (jobs: JobPayload[]) => void;
}

export const useJobStore = create<JobState>((set) => ({
  // Mocked base initial seeds to demonstrate clean execution values out of the box
  incomingJobs: [
    {
      id: 'job_001',
      category: 'Appliance Repair',
      subCategory: 'Fridge Repair',
      applianceType: 'Defy Double Door Fridge',
      faultDescription: 'Compressor clicking constantly and unit failing to cool down the interior fresh food segment.',
      price: 450,
      currency: 'R',
      customerName: 'Sarah Khumalo',
      fullAddress: '14 Cascade Blvd, Waterfall Ridge',
      complexDetails: 'Block C, Apartment 204',
      distance: '2.4 km away',
      timeString: 'Received 2m ago'
    }
  ],
  activeJobs: [],
  scheduledJobs: [
    {
      id: 'job_sched_01',
      applianceType: 'Samsung EcoBubble Washer',
      price: 650,
      currency: 'R',
      scheduledTime: 'Fri, 26 June • 10:00 AM',
      generalArea: 'Rustenburg Central',
      distance: '4.2'
    }
  ],
  completedJobs: [],

  // 📥 Accept incoming job banner: moves out of incoming array straight into active pipeline tracking
  acceptJob: (jobId) => set((state) => {
    const jobToAccept = state.incomingJobs.find(j => j.id === jobId);
    if (!jobToAccept) return {};

    const updatedJob: JobPayload = {
      ...jobToAccept,
      jobStatus: 'ACCEPTED' // Initializes matching your action state structure layout
    };

    return {
      incomingJobs: state.incomingJobs.filter(j => j.id !== jobId),
      activeJobs: [...state.activeJobs, updatedJob]
    };
  }),

  // 🚫 Drop visibility tracking frame for local user session if rejected
  declineJob: (jobId) => set((state) => ({
    incomingJobs: state.incomingJobs.filter(j => j.id !== jobId)
  })),

  // 🔄 The Core State Transition Engine: drives step stages sequentially
  advanceJobStatus: (jobId) => set((state) => {
    const activeJob = state.activeJobs.find(j => j.id === jobId);
    
    if (!activeJob) {
      // Offline fallback: if actioned offline or from scheduled tracking layout elements
      const scheduledJob = state.scheduledJobs.find(j => j.id === jobId);
      if (scheduledJob) {
        return {
          scheduledJobs: state.scheduledJobs.filter(j => j.id !== jobId),
          activeJobs: [...state.activeJobs, { ...scheduledJob, jobStatus: 'ACCEPTED' }]
        };
      }
      return {};
    }

    // Determine target execution point based on current job state label
    switch (activeJob.jobStatus) {
      case 'ACCEPTED':
        return {
          activeJobs: state.activeJobs.map(j => j.id === jobId ? { ...j, jobStatus: 'IN_ROUTE' } : j)
        };
      case 'IN_ROUTE':
        return {
          activeJobs: state.activeJobs.map(j => j.id === jobId ? { ...j, jobStatus: 'ARRIVED' } : j)
        };
      case 'ARRIVED':
        return {
          activeJobs: state.activeJobs.map(j => j.id === jobId ? { ...j, jobStatus: 'DIAGNOSTIC_DONE' } : j)
        };
      case 'DIAGNOSTIC_DONE':
        // Move clean out of active data tracking arrays and drop inside completed transaction grid
        return {
          activeJobs: state.activeJobs.filter(j => j.id !== jobId),
          completedJobs: [...state.completedJobs, { ...activeJob, jobStatus: 'COMPLETED' }]
        };
      default:
        return {};
    }
  }),

  // Hook tool to dynamically reload list buffers from Socket endpoints
  setIncomingJobs: (jobs) => set({ incomingJobs: jobs })
}));