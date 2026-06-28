import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

export const BACKGROUND_LOCATION_TASK = 'BACKGROUND_LOCATION_TRACKING';

export interface TechnicianLocationUpdatePayload {
  latitude: number;
  longitude: number;
  recordedAt: string;
}

export type TechnicianLocationUpdateEmitter = (
  payload: TechnicianLocationUpdatePayload,
) => void | Promise<void>;

interface BackgroundLocationTaskData {
  locations?: Location.LocationObject[];
}

let locationUpdateEmitter: TechnicianLocationUpdateEmitter | null = null;

const isBackgroundLocationTaskData = (data: unknown): data is BackgroundLocationTaskData => {
  if (!data || typeof data !== 'object' || !('locations' in data)) {
    return false;
  }

  const candidate = data as BackgroundLocationTaskData;
  return Array.isArray(candidate.locations);
};

export const registerBackgroundLocationUpdateEmitter = (
  emitter: TechnicianLocationUpdateEmitter,
): void => {
  locationUpdateEmitter = emitter;
};

export const clearBackgroundLocationUpdateEmitter = (): void => {
  locationUpdateEmitter = null;
};

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    return;
  }

  if (!isBackgroundLocationTaskData(data) || !data.locations?.length) {
    return;
  }

  const latestLocation = data.locations[data.locations.length - 1];
  const { latitude, longitude } = latestLocation.coords;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return;
  }

  const payload: TechnicianLocationUpdatePayload = {
    latitude,
    longitude,
    recordedAt: new Date(latestLocation.timestamp).toISOString(),
  };

  void locationUpdateEmitter?.(payload);
});
