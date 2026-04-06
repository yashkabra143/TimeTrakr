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
        localStorage.setItem('user', JSON.stringify(user));
        set({ user, isAuthenticated: true });
    },

    logout: async () => {
        try {
            await logoutUser();
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            localStorage.removeItem('user');
            set({ user: null, isAuthenticated: false });
        }
    },

    refreshAuth: async () => {
        try {
            const user = await checkAuth();
            if (user) {
                localStorage.setItem('user', JSON.stringify(user));
                set({ user, isAuthenticated: true });
            } else {
                localStorage.removeItem('user');
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
            // Try to restore from local storage first for immediate UI
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
                set({ user: JSON.parse(storedUser), isAuthenticated: true });
            }

            const user = await checkAuth();
            if (user) {
                localStorage.setItem('user', JSON.stringify(user));
                set({ user, isAuthenticated: true, isLoading: false });
            } else {
                // Session is gone (expired or never existed) — clear everything and redirect to login
                localStorage.removeItem('user');
                set({ user: null, isAuthenticated: false, isLoading: false });
            }
        } catch (error) {
            console.error('Auth initialization error:', error);
            set({ user: null, isAuthenticated: false, isLoading: false });
        }
    },
}));
