import { create } from 'zustand';
import { User, Tenant, PresenceStatus } from '@shared/types';
interface AuthState {
  user: User | null;
  tenant: Tenant | null;
  availableTenants: { id: string; name: string }[];
  selectedTenantId: string | null;
  token: string | null;
  isAuthenticated: boolean;
  presenceStatus: PresenceStatus;
  activeConversationId: string | null;
  setAuth: (user: User, token: string, tenant?: Tenant, availableTenants?: { id: string; name: string }[]) => void;
  setSelectedTenantId: (id: string | null) => void;
  clearAuth: () => void;
  setPresenceStatus: (status: PresenceStatus) => void;
  setActiveConversationId: (id: string | null) => void;
}
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  tenant: null,
  availableTenants: [],
  selectedTenantId: null,
  token: localStorage.getItem('mercury_token'),
  isAuthenticated: false,
  presenceStatus: 'online',
  activeConversationId: null,
  setAuth: (user, token, tenant, availableTenants = []) => {
    localStorage.setItem('mercury_token', token);
    set({ 
      user, 
      token, 
      tenant, 
      availableTenants, 
      selectedTenantId: user.tenantId || (availableTenants[0]?.id) || null,
      isAuthenticated: true 
    });
  },
  setSelectedTenantId: (selectedTenantId) => set({ selectedTenantId }),
  clearAuth: () => {
    localStorage.removeItem('mercury_token');
    set({ 
      user: null, 
      token: null, 
      tenant: null, 
      availableTenants: [], 
      selectedTenantId: null,
      isAuthenticated: false, 
      activeConversationId: null 
    });
  },
  setPresenceStatus: (presenceStatus) => set({ presenceStatus }),
  setActiveConversationId: (activeConversationId) => set({ activeConversationId }),
}));