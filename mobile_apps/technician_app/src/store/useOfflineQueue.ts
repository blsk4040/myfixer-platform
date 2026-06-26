// src/store/useOfflineQueue.ts
import { create } from 'zustand'; // 👈 Changed to a named import syntax
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface OfflineAction {
  jobId: string;
  targetStatus: string;
  timestamp: number;
  photoUri?: string;
}

interface OfflineQueueState {
  queue: OfflineAction[];
  loadQueue: () => Promise<void>;
  enqueueAction: (action: OfflineAction) => Promise<void>;
  clearQueue: () => Promise<void>;
}

// 👈 Passed type parameter down the line and structured explicit factory definitions
export const useOfflineQueue = create<OfflineQueueState>((set, get) => ({
  queue: [],

  loadQueue: async () => {
    try {
      const saved = await AsyncStorage.getItem('@myfixer_offline_queue');
      if (saved) {
        set({ queue: JSON.parse(saved) });
      }
    } catch (err) {
      console.error('Failed loading offline queue telemetry hooks:', err);
    }
  },

  enqueueAction: async (action: OfflineAction) => {
    const updatedQueue = [...get().queue, action];
    set({ queue: updatedQueue });
    try {
      await AsyncStorage.setItem('@myfixer_offline_queue', JSON.stringify(updatedQueue));
    } catch (err) {
      console.error('Failed persisting offline action queue cache item:', err);
    }
  },

  clearQueue: async () => {
    set({ queue: [] });
    try {
      await AsyncStorage.removeItem('@myfixer_offline_queue');
    } catch (err) {
      console.error('Failed clearing persistent offline state layers:', err);
    }
  },
}));