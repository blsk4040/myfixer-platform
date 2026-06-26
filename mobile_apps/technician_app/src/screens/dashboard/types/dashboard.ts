// src/screens/dashboard/types/dashboard.ts

export interface DashboardStats {
  jobsToday: number;
  completed: number;
  earnings: number;
  rating: number;
}

export interface IncomingJob {
  id: string;
  applianceType: string;
  faultDescription: string;   // e.g., "Error code 3C, drum won't spin"
  callOutFee: number;         // Fixed MyFixer call-out rate (e.g., 450)
  distance: string;           // e.g., "4.5 km"
  generalArea: string;        // Suburb level masking (e.g., "Bryanston")
  
  // Hidden details safely cached in memory until accepted
  customerName: string;
  fullAddress: string;        
  complexDetails?: string;    // e.g., "Unit 12, Stone Arch Estate"
}

export interface ActiveJob {
  id: string;
  applianceType: string;
  faultDescription: string;
  customerName: string;
  status: 'In Progress' | 'En Route' | 'Arrived';
  distance: string;
  fullAddress: string;        // Synchronized perfectly with handleAcceptJob
  complexDetails?: string;    
}

export interface UpcomingJob {
  id: string;
  time: string;               // e.g., "14:30"
  applianceType: string;
  generalArea: string;
}