import { create } from 'zustand';
import {
  startLocationTracking as startTracking,
  stopLocationTracking as stopTracking,
  getCurrentLocation,
} from '../services/location';

const useLocationStore = create((set, get) => ({
  currentLocation: null,
  driverLocation: null,
  isTracking: false,
  heading: null,

  /**
   * Update the current device location.
   */
  updateCurrentLocation: (location) =>
    set({
      currentLocation: location,
      heading: location?.heading ?? get().heading,
    }),

  /**
   * Set the driver's location (used by passenger to track driver).
   */
  setDriverLocation: (location) => set({ driverLocation: location }),

  /**
   * Start continuous location tracking.
   */
  startTracking: async () => {
    if (get().isTracking) return;

    try {
      // Get initial location first
      const initial = await getCurrentLocation();
      set({ currentLocation: initial, isTracking: true });

      await startTracking((location) => {
        set({
          currentLocation: {
            latitude: location.latitude,
            longitude: location.longitude,
          },
          heading: location.heading,
        });
      }, 5000);
    } catch (error) {
      console.warn('[LocationStore] Failed to start tracking:', error);
      set({ isTracking: false });
    }
  },

  /**
   * Stop continuous location tracking.
   */
  stopTracking: async () => {
    await stopTracking();
    set({ isTracking: false });
  },

  /**
   * Clear driver location.
   */
  clearDriverLocation: () => set({ driverLocation: null }),
}));

export default useLocationStore;
