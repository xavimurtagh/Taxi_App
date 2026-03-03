import { create } from 'zustand';
import { get as apiGet, post } from '../services/api';

const useFeedbackStore = create((set, get) => ({
  feedbackItems: [],
  isLoading: false,
  error: null,
  pagination: { page: 1, totalPages: 1, total: 0 },

  /**
   * Submit new feedback.
   */
  submitFeedback: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await post('/feedback', data);
      const newItem = response.data.feedback || response.data;
      set((state) => ({
        feedbackItems: [newItem, ...state.feedbackItems],
        isLoading: false,
      }));
      return newItem;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to submit feedback.';
      set({ error: message, isLoading: false });
      throw new Error(message);
    }
  },

  /**
   * Fetch the current user's feedback submissions (paginated).
   */
  fetchMyFeedback: async (page = 1) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiGet(`/feedback?page=${page}&limit=20`);
      const data = response.data;
      const items = data.feedback || data.data || [];
      const pagination = data.pagination || { page, totalPages: 1, total: items.length };

      set({
        feedbackItems: page === 1 ? items : [...get().feedbackItems, ...items],
        pagination,
        isLoading: false,
      });
      return items;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to load feedback.';
      set({ error: message, isLoading: false });
      throw new Error(message);
    }
  },

  /**
   * Upvote a feature request.
   */
  voteFeedback: async (id) => {
    try {
      const response = await post(`/feedback/${id}/vote`);
      const updated = response.data.feedback || response.data;

      set((state) => ({
        feedbackItems: state.feedbackItems.map((item) =>
          item.id === id
            ? { ...item, metadata: { ...item.metadata, voteCount: updated.voteCount, hasVoted: true } }
            : item
        ),
      }));
      return updated;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to vote.';
      throw new Error(message);
    }
  },

  /**
   * Clear any error.
   */
  clearError: () => set({ error: null }),

  /**
   * Clear store state.
   */
  reset: () => {
    set({ feedbackItems: [], isLoading: false, error: null, pagination: { page: 1, totalPages: 1, total: 0 } });
  },
}));

export default useFeedbackStore;
