import { Audio } from 'expo-av';

type SoundKey = 'incoming-job' | 'job-accepted' | 'job-cancelled' | 'payment' | 'message' | 'arrival';

const SOUND_ASSETS: Record<SoundKey, number> = {
  'incoming-job': require('../../assets/sounds/incoming_job.wav'),
  'job-accepted': require('../../assets/sounds/job_accepted.wav'),
  'job-cancelled': require('../../assets/sounds/job_cancelled.wav'),
  payment: require('../../assets/sounds/payment.wav'),
  message: require('../../assets/sounds/message.wav'),
  arrival: require('../../assets/sounds/arrival.wav'),
};

export class SoundService {
  private static activeSound: Audio.Sound | null = null;
  private static activeKey: SoundKey | null = null;
  private static playedEventIds = new Set<string>();

  static async playIncomingJob(eventId?: string): Promise<void> {
    await this.playOnce('incoming-job', eventId);
  }

  static async playJobAccepted(eventId?: string): Promise<void> {
    await this.playOnce('job-accepted', eventId);
  }

  static async playJobCancelled(eventId?: string): Promise<void> {
    await this.playOnce('job-cancelled', eventId);
  }

  static async playPayment(eventId?: string): Promise<void> {
    await this.playOnce('payment', eventId);
  }

  static async playMessage(eventId?: string): Promise<void> {
    await this.playOnce('message', eventId);
  }

  static async playArrival(eventId?: string): Promise<void> {
    await this.playOnce('arrival', eventId);
  }

  private static async playOnce(soundKey: SoundKey, eventId?: string): Promise<void> {
    const dedupeKey = eventId ? `${soundKey}:${eventId}` : '';
    if (dedupeKey && this.playedEventIds.has(dedupeKey)) return;
    if (dedupeKey) {
      this.playedEventIds.add(dedupeKey);
      if (this.playedEventIds.size > 300) {
        this.playedEventIds = new Set(Array.from(this.playedEventIds).slice(-150));
      }
    }

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
      });

      if (this.activeSound) {
        await this.activeSound.stopAsync().catch(() => undefined);
        await this.activeSound.unloadAsync().catch(() => undefined);
        this.activeSound = null;
        this.activeKey = null;
      }

      const { sound } = await Audio.Sound.createAsync(SOUND_ASSETS[soundKey]);
      this.activeSound = sound;
      this.activeKey = soundKey;

      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;

        if (status.didJustFinish) {
          sound.unloadAsync().catch(() => undefined);
          if (this.activeSound === sound) {
            this.activeSound = null;
            this.activeKey = null;
          }
        }
      });

      await sound.replayAsync();
    } catch (error) {
      if (dedupeKey) this.playedEventIds.delete(dedupeKey);
      console.warn(`${soundKey} sound failed:`, error);
    }
  }
}
