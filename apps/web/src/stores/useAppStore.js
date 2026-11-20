import { create } from 'zustand';

export const useAppStore = create((set, get) => ({
  user: null,
  authLoading: true,
  theme: localStorage.getItem('flows_hd_theme') || 'light',
  sidebarCollapsed: false,
  toasts: [],

  setUser: (user) => set({ user, authLoading: false }),
  clearUser: () => set({ user: null, authLoading: false }),

  hasPermission: (permKey) => {
    const u = get().user;
    return Boolean(u?.permissions?.includes(permKey));
  },

  toggleTheme: () => {
    const next = get().theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('flows_hd_theme', next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    set({ theme: next });
  },

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  addToast: (message, type = 'info') => {
    const id = Date.now() + Math.random();
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 3500);
  }
}));
