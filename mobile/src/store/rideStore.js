import { create } from 'zustand';
import { post, get as apiGet } from '../services/api';
import { getSocket } from '../services/socket';

const useRideStore = create((set, get) => ({
  currentRide: null,
  rideStatus: null,
  nearbyDrivers: [],
  fareEstimate: null,
  rideHistory: [],
  isLoading: false,
  error: null,

  /**
   * Request a new ride.
   */
  requestRide: async (pickup, dropoff, vehicleType) => {
    set({ isLoading: true, error: null });
    try {
      const response = await post('/rides', {
        pickup,
        dropoff,
        vehicleType,
      });
      const ride = response.data.ride || response.data;

      set({
        currentRide: ride,
        rideStatus: 'requested',
        isLoading: false,
      });

      // Listen for real-time ride updates via socket
      const socket = getSocket();
      if (socket) {
        socket.on('ride:status_update', (data) => {
          set({
            currentRide: { ...get().currentRide, ...data },
            rideStatus: data.status,
          });
        });

        socket.on('ride:driver_assigned', (data) => {
          set({
            currentRide: { ...get().currentRide, driver: data.driver, status: 'accepted' },
            rideStatus: 'accepted',
          });
        });

        socket.on('ride:driver_location', (data) => {
          const currentRide = get().currentRide;
          if (currentRide) {
            set({
              currentRide: {
                ...currentRide,
                driverLocation: data.location,
                driverEta: data.eta,
              },
            });
          }
        });

        socket.on('ride:completed', (data) => {
          set({
            currentRide: { ...get().currentRide, ...data, status: 'completed' },
            rideStatus: 'completed',
          });
        });

        socket.on('ride:cancelled', (data) => {
          set({
            currentRide: { ...get().currentRide, ...data, status: 'cancelled' },
            rideStatus: 'cancelled',
          });
        });

        // Emit the ride request event
        socket.emit('ride:request', {
          rideId: ride.id || ride._id,
          pickup,
          dropoff,
          vehicleType,
        });
      }

      return ride;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to request ride.';
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  /**
   * Cancel an active ride.
   */
  cancelRide: async (rideId, reason) => {
    set({ isLoading: true, error: null });
    try {
      await post(`/rides/${rideId}/cancel`, { reason });

      const socket = getSocket();
      if (socket) {
        socket.emit('ride:cancel', { rideId, reason });
        socket.off('ride:status_update');
        socket.off('ride:driver_assigned');
        socket.off('ride:driver_location');
        socket.off('ride:completed');
        socket.off('ride:cancelled');
      }

      set({
        currentRide: null,
        rideStatus: null,
        isLoading: false,
      });
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to cancel ride.';
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  /**
   * Get a fare estimate for a trip.
   */
  getFareEstimate: async (pickup, dropoff, vehicleType) => {
    set({ isLoading: true, error: null });
    try {
      const response = await post('/rides/estimate', {
        pickup,
        dropoff,
        vehicleType,
      });
      const estimate = response.data.estimate || response.data;
      set({ fareEstimate: estimate, isLoading: false });
      return estimate;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to get fare estimate.';
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  /**
   * Fetch the user's ride history.
   */
  fetchRideHistory: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiGet('/rides/history');
      const rides = response.data.rides || response.data || [];
      set({ rideHistory: rides, isLoading: false });
      return rides;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to load ride history.';
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  /**
   * Set the current ride (e.g. from a socket event or navigation param).
   */
  setCurrentRide: (ride) => set({ currentRide: ride, rideStatus: ride?.status || null }),

  /**
   * Update ride status.
   */
  updateRideStatus: (status) => set({ rideStatus: status }),

  /**
   * Set nearby drivers (received from socket or API).
   */
  setNearbyDrivers: (drivers) => set({ nearbyDrivers: drivers }),

  /**
   * Clear fare estimate.
   */
  clearFareEstimate: () => set({ fareEstimate: null }),

  /**
   * Reset ride state.
   */
  resetRide: () => {
    const socket = getSocket();
    if (socket) {
      socket.off('ride:status_update');
      socket.off('ride:driver_assigned');
      socket.off('ride:driver_location');
      socket.off('ride:completed');
      socket.off('ride:cancelled');
    }
    set({
      currentRide: null,
      rideStatus: null,
      fareEstimate: null,
      error: null,
    });
  },

  /**
   * Clear any error.
   */
  clearError: () => set({ error: null }),
}));

export default useRideStore;
