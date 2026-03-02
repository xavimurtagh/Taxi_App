import { create } from 'zustand';
import { get as apiGet } from '../services/api';
import { getSocket } from '../services/socket';

const useChatStore = create((set, get) => ({
  messages: {},       // Map by rideId -> array of messages
  typing: {},         // Map by rideId -> boolean
  unreadCounts: {},   // Map by rideId -> number

  /**
   * Fetch chat messages for a specific ride.
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
   * Send a chat message for a specific ride via socket.
   */
  sendMessage: (rideId, text) => {
    const socket = getSocket();
    if (!socket) return;

    socket.emit('chat:send', { rideId, message: text });
  },

  /**
   * Add a single message to the store for a ride.
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
   * Mark messages as read for a ride (reset unread count).
   */
  markAsRead: (rideId) => {
    set((state) => ({
      unreadCounts: { ...state.unreadCounts, [rideId]: 0 },
    }));
  },

  /**
   * Set typing indicator for a ride.
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
