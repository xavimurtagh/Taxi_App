import { create } from 'zustand';
import { get as apiGet } from '../services/api';
import { getSocket } from '../services/socket';

const useChatStore = create((set, get) => ({
  messages: {},
  typing: {},
  unreadCounts: {},

  /**
   * Fetch chat messages for a ride from the API.
   */
  fetchMessages: async (rideId) => {
    try {
      const response = await apiGet(`/chat/${rideId}/messages`);
      const msgs = response.data.messages || response.data || [];

      set((state) => ({
        messages: { ...state.messages, [rideId]: msgs },
      }));

      return msgs;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to load messages.';
      throw new Error(message);
    }
  },

  /**
   * Send a message via socket.
   */
  sendMessage: (rideId, text) => {
    const socket = getSocket();
    if (!socket) return;

    socket.emit('chat:send', { rideId, message: text });
  },

  /**
   * Add a message to the local store (called when receiving from socket or after sending).
   */
  addMessage: (rideId, message) => {
    set((state) => {
      const existing = state.messages[rideId] || [];
      return {
        messages: { ...state.messages, [rideId]: [...existing, message] },
      };
    });
  },

  /**
   * Mark all messages as read for a ride.
   */
  markAsRead: (rideId) => {
    set((state) => ({
      unreadCounts: { ...state.unreadCounts, [rideId]: 0 },
    }));
  },

  /**
   * Set typing status for a ride.
   */
  setTyping: (rideId, isTyping) => {
    set((state) => ({
      typing: { ...state.typing, [rideId]: isTyping },
    }));
  },

  /**
   * Set unread count for a ride.
   */
  setUnreadCount: (rideId, count) => {
    set((state) => ({
      unreadCounts: { ...state.unreadCounts, [rideId]: count },
    }));
  },
}));

export default useChatStore;
