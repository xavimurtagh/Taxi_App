import { create } from 'zustand';
import { get as apiGet, post } from '../services/api';

const useReferralStore = create((set, get) => ({
  referralCode: null,
  referrals: [],
  rewards: [],
  stats: null,
  isLoading: false,
  error: null,

  /**
   * Fetch the current user's referral code.
   */
  fetchReferralCode: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiGet('/referrals/code');
      const code = response.data.code || response.data.referralCode || response.data;
      set({ referralCode: code, isLoading: false });
      return code;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to load referral code.';
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  /**
   * Apply a referral code.
   */
  applyCode: async (code) => {
    set({ isLoading: true, error: null });
    try {
      const response = await post('/referrals/apply', { code });
      const result = response.data;
      set({ isLoading: false });
      return result;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to apply referral code.';
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  /**
   * Fetch the list of referrals made by the user.
   */
  fetchReferrals: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiGet('/referrals');
      const referrals = response.data.referrals || response.data || [];
      set({ referrals, isLoading: false });
      return referrals;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to load referrals.';
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  /**
   * Fetch available rewards.
   */
  fetchRewards: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiGet('/referrals/rewards');
      const rewards = response.data.rewards || response.data || [];
      set({ rewards, isLoading: false });
      return rewards;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to load rewards.';
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  /**
   * Claim a reward by ID.
   */
  claimReward: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const response = await post(`/referrals/rewards/${id}/claim`);
      const result = response.data;

      set((state) => ({
        rewards: state.rewards.map((r) =>
          (r.id || r._id) === id ? { ...r, claimed: true } : r
        ),
        isLoading: false,
      }));

      return result;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to claim reward.';
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  /**
   * Fetch referral statistics.
   */
  fetchStats: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiGet('/referrals/stats');
      const stats = response.data.stats || response.data;
      set({ stats, isLoading: false });
      return stats;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to load referral stats.';
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  /**
   * Clear any error.
   */
  clearError: () => set({ error: null }),
}));

export default useReferralStore;
