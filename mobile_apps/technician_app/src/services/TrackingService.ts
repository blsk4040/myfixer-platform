// src/services/TrackingService.ts
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { techSocketService } from './tech_socket.service';
import { BRAND } from '../config/brand';

const BACKGROUND_TRACKING_TASK = 'MYFIXER_TECH_BACKGROUND_TRACKING';
let currentActiveBookingId: string | null = null;

/**
 * Global Task Manager System Hook Definition
 */
TaskManager.defineTask(BACKGROUND_TRACKING_TASK, async ({ data, error }: any) => {
  if (error) {
    console.error('[Tracking Task Error]:', error.message);
    return;
  }

  if (data && currentActiveBookingId) {
    const { locations } = data;
    if (!locations || locations.length === 0) return;

    const freshGpsFrame = locations[0];
    const { latitude, longitude, heading, speed } = freshGpsFrame.coords;

    try {
      // Stream calculations directly down the primary websocket pipeline
      techSocketService.emitTelemetryUpdate({
        bookingId: currentActiveBookingId,
        latitude,
        longitude,
        heading: heading ?? 0,
        speed: speed ?? 0
      });

      console.log(`📡 [BG-Telemetry] Lat: ${latitude.toFixed(5)}, Lng: ${longitude.toFixed(5)} -> Shared via Unified Engine Socket`);
    } catch (err) {
      console.warn('[Tracking Task Error] Engine websocket was uninitialized when position ticked.', err);
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
        console.warn('Location lookup access permissions were rejected.');
        return false;
      }

      // Ensure core socket instance connection context is fully populated
      techSocketService.initializeConnection(technicianId);
      techSocketService.joinBookingRoom(bookingId);

      await Location.startLocationUpdatesAsync(BACKGROUND_TRACKING_TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 5000,
        distanceInterval: 5,
        foregroundService: {
          notificationTitle: `${BRAND.displayName} Dispatch Active`,
          notificationBody: "Routing real-time updates safely to the customer map viewport.",
          notificationColor: "#0B0B0D"
        }
      });

      console.info(`✅ High frequency background tracking engine safely launched for Booking: ${bookingId}`);
      return true;
    } catch (err) {
      console.error('Fatal failure launching background location loops:', err);
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
      console.log('🛑 Background spatial tracking service paused safely.');
    } catch (err) {
      console.error('Error disabling location lookup frames safely:', err);
    }
  }
};
