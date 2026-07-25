// src/services/TrackingService.ts
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { techSocketService } from './tech_socket.service';
import { BRAND } from '../config/brand';

const BACKGROUND_TRACKING_TASK = 'MYFIXER_TECH_BACKGROUND_TRACKING';
let currentActiveBookingId: string | null = null;

TaskManager.defineTask(BACKGROUND_TRACKING_TASK, async ({ data, error }: any) => {
  if (error) {
    console.error('Live tracking task failed:', error.message);
    return;
  }

  if (data && currentActiveBookingId) {
    const { locations } = data;
    if (!locations || locations.length === 0) return;

    const freshGpsFrame = locations[0];
    const { latitude, longitude, heading, speed } = freshGpsFrame.coords;

    try {
      techSocketService.emitTelemetryUpdate({
        bookingId: currentActiveBookingId,
        latitude,
        longitude,
        heading: heading ?? 0,
        speed: speed ?? 0,
      });
    } catch (err) {
      console.warn('Live location update could not be sent.', err);
    }
  }
});

export const TrackingService = {
  startLiveTracking: async (technicianId: string, bookingId: string): Promise<boolean> => {
    currentActiveBookingId = bookingId;

    try {
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();

      if (fgStatus !== 'granted' || bgStatus !== 'granted') {
        console.warn('Location permission was not granted.');
        return false;
      }

      techSocketService.initializeConnection(technicianId);
      techSocketService.joinBookingRoom(bookingId);

      await Location.startLocationUpdatesAsync(BACKGROUND_TRACKING_TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 5000,
        distanceInterval: 5,
        foregroundService: {
          notificationTitle: `${BRAND.displayName} Dispatch Active`,
          notificationBody: 'Sharing your live job location with the customer.',
          notificationColor: '#0B0B0D',
        },
      });

      return true;
    } catch (err) {
      console.error('Could not start live job tracking:', err);
      return false;
    }
  },

  stopLiveTracking: async (): Promise<void> => {
    try {
      const isRunning = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TRACKING_TASK);
      if (isRunning) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_TRACKING_TASK);
      }
      currentActiveBookingId = null;
    } catch (err) {
      console.error('Could not stop live job tracking:', err);
    }
  },
};
