import { create } from 'zustand';
import { checkAuth, logout as logoutUser, type User } from '@/lib/auth';

interface AuthState {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (user: User) => void;
    logout: () => Promise<void>;
    refreshAuth: () => Promise<void>;
    initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    isLoading: true,
    isAuthenticated: false,

    login: (user: User) => {
        set({ user, isAuthenticated: true });
    },

    logout: async () => {
        try {
            await logoutUser();
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            set({ user: null, isAuthenticated: false });
        }
    },

    refreshAuth: async () => {
        try {
            const user = await checkAuth();
            if (user) {
                set({ user, isAuthenticated: true });
            } else {
                set({ user: null, isAuthenticated: false });
            }
        } catch (error) {
            console.error('Auth check error:', error);
            set({ user: null, isAuthenticated: false });
        }
    },

    initialize: async () => {
        set({ isLoading: true });
        try {
            const user = await checkAuth();
            if (user) {
                set({ user, isAuthenticated: true, isLoading: false });
            } else {
                set({ user: null, isAuthenticated: false, isLoading: false });
            }
        } catch (error) {
            console.error('Auth initialization error:', error);
            set({ user: null, isAuthenticated: false, isLoading: false });
        }
    },
}));
