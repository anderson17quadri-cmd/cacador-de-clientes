import { create } from 'zustand';
import type { UserProfile, Search, Company } from '@leadhunter/types';

interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: UserProfile, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  updateUser: (user: Partial<UserProfile>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  setAuth: (user, accessToken, refreshToken) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
    }
    set({ user, accessToken, refreshToken, isAuthenticated: true });
  },
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
  },
  updateUser: (updates) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...updates } : null,
    })),
}));

interface SearchState {
  currentSearch: Search | null;
  searchProgress: { progress: number; totalFound: number; totalEnriched: number; status: string } | null;
  searchLogs: Array<{ message: string; level: string; timestamp: string }>;
  setCurrentSearch: (search: Search | null) => void;
  setSearchProgress: (progress: any) => void;
  addSearchLog: (log: any) => void;
  clearSearch: () => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  currentSearch: null,
  searchProgress: null,
  searchLogs: [],
  setCurrentSearch: (search) => set({ currentSearch: search }),
  setSearchProgress: (progress) => set({ searchProgress: progress }),
  addSearchLog: (log) =>
    set((state) => ({ searchLogs: [log, ...state.searchLogs].slice(0, 100) })),
  clearSearch: () =>
    set({ currentSearch: null, searchProgress: null, searchLogs: [] }),
}));

interface UIState {
  sidebarOpen: boolean;
  theme: 'light' | 'dark' | 'system';
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  theme: 'dark',
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setTheme: (theme) => set({ theme }),
}));
