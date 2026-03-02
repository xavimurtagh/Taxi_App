import { create } from 'zustand';
import { get as apiGet, post } from '../services/api';

const useRidesharingStore = create((set, get) => ({
  availableSharedRides: [],
  activeSharedRide: null,
  isLoading: false,
  error: null,

  /**
   * Find available shared rides matching a route.
   */
  findSharedRides: async (pickup, dropoff) => {
    set({ isLoading: true, error: null });
    try {
      const response = await post('/ridesharing/available', { pickup, dropoff });
      const rides = response.data.rides || response.data || [];
      set({ availableSharedRides: rides, isLoading: false });
      return rides;
    } catch (error) {
      const message =
        error.response?.data?.message || 'Failed to find shared rides.';
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  /**
   * Join an existing shared ride.
   */
  joinSharedRide: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const response = await post(`/ridesharing/${id}/join`);
      const ride = response.data.ride || response.data;
      set({ activeSharedRide: ride, isLoading: false });
      return ride;
    } catch (error) {
      const message =
        error.response?.data?.message || 'Failed to join shared ride.';
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  /**
   * Leave a shared ride.
   */
  leaveSharedRide: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await post(`/ridesharing/${id}/leave`);
      set({ activeSharedRide: null, isLoading: false });
    } catch (error) {
      const message =
        error.response?.data?.message || 'Failed to leave shared ride.';
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  /**
   * Request a new shared ride.
   */
  requestSharedRide: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await post('/ridesharing/request', data);
      const ride = response.data.ride || response.data;
      set({ activeSharedRide: ride, isLoading: false });
      return ride;
    } catch (error) {
      const message =
        error.response?.data?.message || 'Failed to request shared ride.';
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  /**
   * Fetch the user's active shared ride.
   */
  fetchActiveSharedRide: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiGet('/ridesharing/active');
      const ride = response.data.ride || response.data || null;
      set({ activeSharedRide: ride, isLoading: false });
      return ride;
    } catch (error) {
      const message =
        error.response?.data?.message || 'Failed to load active shared ride.';
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  /**
   * Clear any error.
   */
  clearError: () => set({ error: null }),

  /**
   * Reset ridesharing state.
   */
  reset: () =>
    set({
      availableSharedRides: [],
      activeSharedRide: null,
      isLoading: false,
      error: null,
    }),
}));

export default useRidesharingStore;
