import { create } from 'zustand';
import { secureStorage } from '../utils/secureStorage';

interface User {
  id: string;
  email: string;
  username: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  institution?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setUser: (user: User) => void;
  setToken: (token: string) => Promise<void>;
  setAuth: (token: string, user: User) => Promise<void>;
  clearAuth: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  loadStoredAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  setUser: (user) => set({ user, isAuthenticated: true, error: null }),

  setToken: async (token) => {
    try {
      await secureStorage.setItem('auth_token', token);
      set({ token, isAuthenticated: true });
    } catch (error) {
      console.error('Error storing token:', error);
      set({ error: 'Failed to store authentication token' });
    }
  },

  setAuth: async (token, user) => {
    try {
      await secureStorage.setItem('auth_token', token);
      await secureStorage.setItem('user_data', JSON.stringify(user));
      set({ token, user, isAuthenticated: true, error: null });
    } catch (error) {
      console.error('Error storing auth:', error);
      set({ error: 'Failed to store authentication data' });
    }
  },

  clearAuth: async () => {
    try {
      await secureStorage.removeItem('auth_token');
      await secureStorage.removeItem('user_data');
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        error: null,
      });
    } catch (error) {
      console.error('Error clearing auth:', error);
    }
  },

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  loadStoredAuth: async () => {
    try {
      set({ isLoading: true });
      const token = await secureStorage.getItem('auth_token');
      const userDataStr = await secureStorage.getItem('user_data');

      if (token && userDataStr) {
        const user = JSON.parse(userDataStr);
        set({
          token,
          user,
          isAuthenticated: true,
          isLoading: false
        });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Error loading stored auth:', error);
      set({ isLoading: false, error: 'Failed to load authentication' });
    }
  },
}));