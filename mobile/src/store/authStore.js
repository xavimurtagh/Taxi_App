import { create } from 'zustand';
import { post } from '../services/api';
import {
  saveToken,
  getToken,
  removeToken,
  saveRefreshToken,
  getRefreshToken,
  removeRefreshToken,
  saveUserRole,
  getUserRole,
} from '../services/storage';
import { connectSocket, disconnectSocket } from '../services/socket';

const useAuthStore = create((set, get) => ({
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,
  activeRole: 'passenger',
  error: null,

  /**
   * Log in with email and password.
   */
  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await post('/auth/login', { email, password });
      const { user, token, refreshToken } = response.data;

      await saveToken(token);
      await saveRefreshToken(refreshToken);

      const storedRole = await getUserRole();
      const activeRole = storedRole || (user.role === 'driver' ? 'driver' : 'passenger');
      await saveUserRole(activeRole);

      connectSocket(token);

      set({
        user,
        token,
        refreshToken,
        isAuthenticated: true,
        isLoading: false,
        activeRole,
        error: null,
      });
    } catch (error) {
      const message =
        error.response?.data?.message || 'Login failed. Please try again.';
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  /**
   * Register a new account.
   */
  register: async (userData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await post('/auth/register', userData);
      const { user, token, refreshToken } = response.data;

      await saveToken(token);
      await saveRefreshToken(refreshToken);

      const activeRole = user.role === 'driver' ? 'driver' : 'passenger';
      await saveUserRole(activeRole);

      connectSocket(token);

      set({
        user,
        token,
        refreshToken,
        isAuthenticated: true,
        isLoading: false,
        activeRole,
        error: null,
      });
    } catch (error) {
      const message =
        error.response?.data?.message || 'Registration failed. Please try again.';
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  /**
   * Log out the current user.
   */
  logout: async () => {
    try {
      await post('/auth/logout');
    } catch (error) {
      // Ignore logout API errors — proceed with local cleanup
    }

    disconnectSocket();
    await removeToken();
    await removeRefreshToken();

    set({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      activeRole: 'passenger',
      error: null,
    });
  },

  /**
   * Set the active role (passenger or driver) for users with both roles.
   */
  setActiveRole: async (role) => {
    await saveUserRole(role);
    set({ activeRole: role });
  },

  /**
   * Load authentication state from SecureStore on app launch.
   */
  loadStoredAuth: async () => {
    set({ isLoading: true });
    try {
      const token = await getToken();
      const refreshTokenVal = await getRefreshToken();
      const storedRole = await getUserRole();

      if (token) {
        // Validate token by fetching user profile
        const { default: api } = await import('../services/api');
        const response = await api.get('/auth/me');
        const user = response.data.user || response.data;

        connectSocket(token);

        set({
          user,
          token,
          refreshToken: refreshTokenVal,
          isAuthenticated: true,
          isLoading: false,
          activeRole: storedRole || 'passenger',
        });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      // Token is invalid or expired — clear stored data
      await removeToken();
      await removeRefreshToken();
      set({
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  /**
   * Refresh the current session using the refresh token.
   */
  refreshSession: async () => {
    try {
      const currentRefreshToken = await getRefreshToken();
      if (!currentRefreshToken) {
        throw new Error('No refresh token');
      }

      const response = await post('/auth/refresh', {
        refreshToken: currentRefreshToken,
      });
      const { token, refreshToken: newRefreshToken } = response.data;

      await saveToken(token);
      if (newRefreshToken) {
        await saveRefreshToken(newRefreshToken);
      }

      set({ token, refreshToken: newRefreshToken || currentRefreshToken });
    } catch (error) {
      await get().logout();
      throw error;
    }
  },

  /**
   * Clear any error messages.
   */
  clearError: () => set({ error: null }),
}));

export default useAuthStore;
