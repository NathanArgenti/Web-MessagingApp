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
  selectedTenantId: localStorage.getItem('mercury_tenant_id'),
  token: localStorage.getItem('mercury_token'),
  isAuthenticated: !!localStorage.getItem('mercury_token'),
  presenceStatus: 'online',
  activeConversationId: null,
  setAuth: (user, token, tenant, availableTenants = []) => {
    localStorage.setItem('mercury_token', token);
    // Always prioritize the user's hardcoded tenant assignment on login to ensure isolation
    const initialTenantId = user.tenantId || (availableTenants[0]?.id) || null;
    if (initialTenantId) {
      localStorage.setItem('mercury_tenant_id', initialTenantId);
    }
    set({
      user,
      token,
      tenant: tenant || null,
      availableTenants: availableTenants || [],
      selectedTenantId: initialTenantId,
      isAuthenticated: true,
      presenceStatus: user.presenceStatus || 'online'
    });
  },
  setSelectedTenantId: (selectedTenantId) => {
    if (selectedTenantId) {
      localStorage.setItem('mercury_tenant_id', selectedTenantId);
    } else {
      localStorage.removeItem('mercury_tenant_id');
    }
    set({ selectedTenantId, activeConversationId: null });
  },
  clearAuth: () => {
    localStorage.removeItem('mercury_token');
    localStorage.removeItem('mercury_tenant_id');
    set({
      user: null,
      token: null,
      tenant: null,
      availableTenants: [],
      selectedTenantId: null,
      isAuthenticated: false,
      activeConversationId: null,
      presenceStatus: 'offline'
    });
  },
  setPresenceStatus: (presenceStatus) => set({ presenceStatus }),
  setActiveConversationId: (activeConversationId) => set({ activeConversationId }),
}));