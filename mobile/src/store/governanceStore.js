import { create } from 'zustand';
import { get as apiGet, post } from '../services/api';

const useGovernanceStore = create((set, get) => ({
  proposals: [],
  activeProposal: null,
  hasVoted: {},
  isLoading: false,
  error: null,

  /**
   * Fetch all governance proposals.
   */
  fetchProposals: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiGet('/governance/proposals');
      const proposals = response.data.proposals || response.data || [];
      set({ proposals, isLoading: false });
      return proposals;
    } catch (error) {
      const message =
        error.response?.data?.message || 'Failed to load proposals.';
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  /**
   * Create a new governance proposal.
   */
  createProposal: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await post('/governance/proposals', data);
      const proposal = response.data.proposal || response.data;
      set((state) => ({
        proposals: [proposal, ...state.proposals],
        isLoading: false,
      }));
      return proposal;
    } catch (error) {
      const message =
        error.response?.data?.message || 'Failed to create proposal.';
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  /**
   * Cast a vote on a proposal.
   */
  castVote: async (proposalId, vote) => {
    set({ isLoading: true, error: null });
    try {
      const response = await post(`/governance/proposals/${proposalId}/vote`, {
        vote,
      });
      const updatedProposal = response.data.proposal || response.data;

      set((state) => ({
        proposals: state.proposals.map((p) =>
          (p.id || p._id) === proposalId ? { ...p, ...updatedProposal } : p
        ),
        activeProposal:
          (state.activeProposal?.id || state.activeProposal?._id) === proposalId
            ? { ...state.activeProposal, ...updatedProposal }
            : state.activeProposal,
        hasVoted: { ...state.hasVoted, [proposalId]: vote },
        isLoading: false,
      }));
      return updatedProposal;
    } catch (error) {
      const message =
        error.response?.data?.message || 'Failed to cast vote.';
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  /**
   * Fetch results for a specific proposal.
   */
  fetchResults: async (proposalId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiGet(
        `/governance/proposals/${proposalId}/results`
      );
      const results = response.data;
      set((state) => ({
        activeProposal: {
          ...(state.activeProposal || {}),
          ...results,
        },
        isLoading: false,
      }));
      return results;
    } catch (error) {
      const message =
        error.response?.data?.message || 'Failed to load results.';
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  /**
   * Fetch comments for a proposal.
   */
  fetchComments: async (proposalId) => {
    try {
      const response = await apiGet(`/governance/proposals/${proposalId}/comments`);
      return response.data.comments || [];
    } catch (error) {
      console.log('Failed to fetch comments:', error.message);
      return [];
    }
  },

  /**
   * Post a comment on a proposal.
   */
  addComment: async (proposalId, content, parentId = null) => {
    try {
      const response = await post(`/governance/proposals/${proposalId}/comments`, {
        content,
        parentId,
      });
      return response.data.comment;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to post comment');
    }
  },

  /**
   * Fetch governable platform config parameters.
   */
  fetchConfig: async () => {
    try {
      const response = await apiGet('/governance/config');
      return response.data.config || {};
    } catch (error) {
      console.log('Failed to fetch config:', error.message);
      return {};
    }
  },

  /**
   * Fetch user's payout history from surplus redistribution.
   */
  fetchMyPayouts: async () => {
    try {
      const response = await apiGet('/governance/my-payouts');
      return response.data.payouts || [];
    } catch (error) {
      console.log('Failed to fetch payouts:', error.message);
      return [];
    }
  },

  /**
   * Set the active proposal for detail view.
   */
  setActiveProposal: (proposal) => set({ activeProposal: proposal }),

  /**
   * Clear error.
   */
  clearError: () => set({ error: null }),
}));

export default useGovernanceStore;
