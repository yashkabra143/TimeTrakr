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
                // If checkAuth fails (e.g. session expired), clear local storage unless we want to keep it for offline mode
                // For now, let's keep it if checkAuth returns null (not authenticated)
                if (!storedUser) {
                    set({ user: null, isAuthenticated: false, isLoading: false });
                } else {
                    // If we have stored user but checkAuth failed, we might want to keep the user logged in visually 
                    // but they might fail API calls. 
                    // Given the current setup without real session cookies, checkAuth returns null.
                    // So we rely on localStorage.
                    set({ isLoading: false });
                }
            }
        } catch (error) {
            console.error('Auth initialization error:', error);
            set({ user: null, isAuthenticated: false, isLoading: false });
        }
    },
}));
