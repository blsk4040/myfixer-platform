import { User } from './user.model';

export interface GeoPoint {
  longitude: number;
  latitude: number;
}

export interface TechnicianProfile {
  id: string;
  userId: string;
  isOnline: boolean;
  lastLocation: GeoPoint | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TechnicianProfileWithUser extends TechnicianProfile {
  user: User;
}

export interface CreateTechnicianProfileInput {
  userId: string;
  isOnline?: boolean;
  lastLocation?: GeoPoint | null;
}

export interface UpdateTechnicianLocationInput {
  technicianProfileId: string;
  lastLocation: GeoPoint;
  isOnline?: boolean;
}

export interface TechnicianProfileRow {
  id: string;
  user_id: string;
  is_online: boolean;
  last_location: unknown;
  created_at: Date;
  updated_at: Date;
}
