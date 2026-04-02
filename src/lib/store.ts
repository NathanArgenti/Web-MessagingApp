import { create } from 'zustand';
import { User, Tenant, PresenceStatus } from '@shared/types';
interface AuthState {
  user: User | null;
  tenant: Tenant | null;
  token: string | null;
  isAuthenticated: boolean;
  presenceStatus: PresenceStatus;
  activeConversationId: string | null;
  setAuth: (user: User, token: string, tenant?: Tenant) => void;
  clearAuth: () => void;
  setPresenceStatus: (status: PresenceStatus) => void;
  setActiveConversationId: (id: string | null) => void;
}
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  tenant: null,
  token: localStorage.getItem('mercury_token'),
  isAuthenticated: false,
  presenceStatus: 'online',
  activeConversationId: null,
  setAuth: (user, token, tenant) => {
    localStorage.setItem('mercury_token', token);
    set({ user, token, tenant, isAuthenticated: true });
  },
  clearAuth: () => {
    localStorage.removeItem('mercury_token');
    set({ user: null, token: null, tenant: null, isAuthenticated: false, activeConversationId: null });
  },
  setPresenceStatus: (presenceStatus) => set({ presenceStatus }),
  setActiveConversationId: (activeConversationId) => set({ activeConversationId }),
}));