import { SoundService } from './sound.service';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { BRAND } from '../config/brand';

export class NotificationService {
  private static notifiedIncomingBookingIds = new Set<string>();

  static async configureJobAlertChannel(): Promise<void> {
    if (Platform.OS !== 'android') return;

    await Notifications.setNotificationChannelAsync('job-alerts', {
      name: 'Padi Pro job alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 350, 180, 350],
      lightColor: '#B8FF3D',
      sound: 'incoming_job.wav',
    });
  }

  static async handleIncomingJob(bookingId?: string, details?: { title?: string; body?: string }): Promise<void> {
    if (bookingId && this.notifiedIncomingBookingIds.has(bookingId)) return;
    if (bookingId) {
      this.notifiedIncomingBookingIds.add(bookingId);
      if (this.notifiedIncomingBookingIds.size > 300) {
        this.notifiedIncomingBookingIds = new Set(Array.from(this.notifiedIncomingBookingIds).slice(-150));
      }
    }

    await SoundService.playIncomingJob(bookingId);
    await this.showLocalIncomingJobNotification(details);
  }

  static async handleJobAccepted(bookingId?: string): Promise<void> {
    await SoundService.playJobAccepted(bookingId);
  }

  static async handleJobCancelled(bookingId?: string): Promise<void> {
    await SoundService.playJobCancelled(bookingId);
  }

  static async handlePayment(bookingId?: string): Promise<void> {
    await SoundService.playPayment(bookingId);
  }

  static async handleMessage(messageId?: string): Promise<void> {
    await SoundService.playMessage(messageId);
  }

  static async handleArrival(bookingId?: string): Promise<void> {
    await SoundService.playArrival(bookingId);
  }

  static async testAlertSound(): Promise<void> {
    await SoundService.playIncomingJob(`test-${Date.now()}`);
    await this.showLocalIncomingJobNotification({
      title: `${BRAND.displayName} alert test`,
      body: 'If your device supports notification sounds in this build, you should hear this alert.',
    });
  }

  private static async showLocalIncomingJobNotification(details?: { title?: string; body?: string }): Promise<void> {
    try {
      await this.configureJobAlertChannel();

      const permissions = await Notifications.getPermissionsAsync();
      if (!permissions.granted) {
        const requested = await Notifications.requestPermissionsAsync();
        if (!requested.granted) return;
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: details?.title || 'New Job Request',
          body: details?.body || `A new service request is available. Open ${BRAND.displayName} to review it.`,
          sound: 'incoming_job.wav',
        },
        trigger: Platform.OS === 'android' ? { channelId: 'job-alerts' } : null,
      });
    } catch (error) {
      console.warn('Incoming job notification failed:', error);
    }
  }
}
