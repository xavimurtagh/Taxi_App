import { create } from 'zustand';
import { get as apiGet, post, put, del } from '../services/api';

const useSchedulingStore = create((set, get) => ({
  scheduledRides: [],
  upcoming: [],
  isLoading: false,
  error: null,

  /**
   * Fetch all scheduled rides.
   */
  fetchScheduledRides: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiGet('/scheduling');
      const rides = response.data.rides || response.data || [];
      set({ scheduledRides: rides, isLoading: false });
      return rides;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to load scheduled rides.';
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  /**
   * Create a new scheduled ride.
   */
  createScheduledRide: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await post('/scheduling', data);
      const ride = response.data.ride || response.data;

      set((state) => ({
        scheduledRides: [ride, ...state.scheduledRides],
        isLoading: false,
      }));

      return ride;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to schedule ride.';
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  /**
   * Cancel a scheduled ride.
   */
  cancelScheduledRide: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await del(`/scheduling/${id}`);

      set((state) => ({
        scheduledRides: state.scheduledRides.filter(
          (r) => (r.id || r._id) !== id
        ),
        upcoming: state.upcoming.filter((r) => (r.id || r._id) !== id),
        isLoading: false,
      }));
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to cancel scheduled ride.';
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  /**
   * Fetch upcoming scheduled rides.
   */
  fetchUpcoming: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiGet('/scheduling/upcoming');
      const rides = response.data.rides || response.data || [];
      set({ upcoming: rides, isLoading: false });
      return rides;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to load upcoming rides.';
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  /**
   * Update an existing scheduled ride.
   */
  updateScheduledRide: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await put(`/scheduling/${id}`, data);
      const updatedRide = response.data.ride || response.data;

      set((state) => ({
        scheduledRides: state.scheduledRides.map((r) =>
          (r.id || r._id) === id ? updatedRide : r
        ),
        upcoming: state.upcoming.map((r) =>
          (r.id || r._id) === id ? updatedRide : r
        ),
        isLoading: false,
      }));

      return updatedRide;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to update scheduled ride.';
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  /**
   * Clear any error.
   */
  clearError: () => set({ error: null }),
}));

export default useSchedulingStore;
