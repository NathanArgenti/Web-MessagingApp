import { create } from 'zustand';
import { User, Tenant } from '@shared/types';
interface AuthState {
  user: User | null;
  tenant: Tenant | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string, tenant?: Tenant) => void;
  clearAuth: () => void;
}
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  tenant: null,
  token: localStorage.getItem('mercury_token'),
  isAuthenticated: false,
  setAuth: (user, token, tenant) => {
    localStorage.setItem('mercury_token', token);
    set({ user, token, tenant, isAuthenticated: true });
  },
  clearAuth: () => {
    localStorage.removeItem('mercury_token');
    set({ user: null, token: null, tenant: null, isAuthenticated: false });
  },
}));