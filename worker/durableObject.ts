import { DurableObject } from "cloudflare:workers";
import type {
    User, Tenant, Queue, Conversation, Message, PresenceStatus,
    PublicConfig, SystemEvent, EventType, ConversationStatus,
    OfflineRequest, SystemMetrics, GlobalMetrics, MetricPoint, TenantSite,
    UserCreateInput, UserUpdateInput, QueueStatus
} from '@shared/types';
import { nanoid } from 'nanoid';
export class GlobalDurableObject extends DurableObject {
    private async getStorage<T>(key: string): Promise<T | undefined> {
        return await this.ctx.storage.get<T>(key);
    }
    private async setStorage<T>(key: string, value: T): Promise<void> {
        await this.ctx.storage.put(key, value);
    }
    async seedDatabase(): Promise<boolean> {
        await this.ctx.storage.deleteAll();
        const queues: Queue[] = [
            { id: 'q1', tenantId: 't1', name: 'General Support', priority: 10, capacityMax: 10, isDeleted: false, assignedAgentIds: ['u3'] },
            { id: 'q2', tenantId: 't1', name: 'Sales Flow', priority: 5, capacityMax: 5, isDeleted: false, assignedAgentIds: [] }
        ];
        const tenants: Tenant[] = [
            {
                id: 't1',
                name: 'Acme Global',
                sites: [{ id: 's1', name: 'Corporate Site', key: 'acme-123', defaultQueueId: 'q1' }],
                branding: {
                  primaryColor: '#06B6D4',
                  welcomeMessage: 'Welcome to Acme Global Support. How can we help?',
                  widgetPosition: 'bottom-right',
                  themePreset: 'modern'
                },
                queues: [queues[0], queues[1]],
                workflows: [],
                authPolicy: { allowLocalAuth: true }
            }
        ];
        const users: User[] = [
            { id: 'u1', email: 'admin@mercury.com', name: 'Mercury Global Admin', role: 'superadmin', isOnline: true, presenceStatus: 'online', isActive: true, createdAt: Date.now() },
            { id: 'u2', email: 'acme_admin@acme.com', name: 'Acme Tenant Admin', role: 'tenant_admin', tenantId: 't1', isOnline: true, presenceStatus: 'online', isActive: true, createdAt: Date.now() },
            { id: 'u3', email: 'agent1@acme.com', name: 'Acme Support Agent', role: 'agent', tenantId: 't1', isOnline: true, presenceStatus: 'online', isActive: true, createdAt: Date.now() }
        ];
        await this.setStorage('tenants', tenants);
        await this.setStorage('users', users);
        return true;
    }
    async getUsers(tenantId?: string, role?: string): Promise<User[]> {
        const users = (await this.getStorage<User[]>('users')) || [];
        return users.filter(u => {
            if (tenantId && u.tenantId !== tenantId) return false;
            if (role && u.role !== role) return false;
            return true;
        });
    }
    async upsertUser(input: UserCreateInput & { id?: string }): Promise<User> {
        const users = (await this.getStorage<User[]>('users')) || [];
        const existingIdx = users.findIndex(u => (input.id && u.id === input.id) || u.email === input.email);
        if (existingIdx > -1) {
            const updated = { ...users[existingIdx], ...input };
            users[existingIdx] = updated as User;
            await this.setStorage('users', users);
            return users[existingIdx];
        }
        const newUser: User = {
            id: input.id || nanoid(),
            email: input.email,
            name: input.name,
            role: input.role,
            tenantId: input.tenantId,
            isActive: true,
            isOnline: false,
            presenceStatus: 'offline',
            createdAt: Date.now(),
            passwordHashStub: 'mock_hash'
        };
        users.push(newUser);
        await this.setStorage('users', users);
        return newUser;
    }
    async deleteUser(userId: string): Promise<boolean> {
        const users = (await this.getStorage<User[]>('users')) || [];
        const filtered = users.filter(u => u.id !== userId);
        if (filtered.length === users.length) return false;
        await this.setStorage('users', filtered);
        return true;
    }
    async updateTenantSettings(tenantId: string, settings: Partial<Tenant>): Promise<Tenant | null> {
        const tenants = (await this.getStorage<Tenant[]>('tenants')) || [];
        const idx = tenants.findIndex(t => t.id === tenantId);
        if (idx === -1) return null;
        tenants[idx] = { 
            ...tenants[idx], 
            ...settings,
            id: tenantId // Ensure ID can't be changed
        };
        await this.setStorage('tenants', tenants);
        return tenants[idx];
    }
    async getGlobalMetrics(): Promise<GlobalMetrics> {
        const tenants = (await this.getStorage<Tenant[]>('tenants')) || [];
        const users = (await this.getStorage<User[]>('users')) || [];
        // Mock aggregation from DO state
        let totalConvs = 0;
        for (const t of tenants) {
            const convs = await this.getConversations(t.id);
            totalConvs += convs.length;
        }
        return { 
            totalTenants: tenants.length, 
            totalMessages: totalConvs * 8, // Estimated scale
            activeAgentsPlatform: users.filter(u => u.isOnline).length, 
            uptime: '99.99%' 
        };
    }
    async getAllTenants(): Promise<Tenant[]> {
        return (await this.getStorage<Tenant[]>('tenants')) || [];
    }
    async createTenant(name: string): Promise<Tenant> {
        const tenants = await this.getAllTenants();
        const newTenant: Tenant = { 
            id: nanoid(), 
            name, 
            sites: [], 
            branding: { 
                primaryColor: '#06B6D4', 
                welcomeMessage: 'Welcome to our platform!' 
            }, 
            queues: [], 
            workflows: [],
            authPolicy: { allowLocalAuth: true }
        };
        tenants.push(newTenant);
        await this.setStorage('tenants', tenants);
        return newTenant;
    }
    async login(email: string): Promise<AuthPayload | null> {
        const users = (await this.getStorage<User[]>('users')) || [];
        const user = users.find(u => u.email === email && u.isActive);
        if (!user) return null;
        const tenants = await this.getAllTenants();
        const tenant = tenants.find(t => t.id === user.tenantId);
        return { 
            user, 
            token: `mock-jwt-${user.id}-${Date.now()}`, 
            tenant, 
            availableTenants: user.role === 'superadmin' 
                ? tenants.map(t => ({ id: t.id, name: t.name })) 
                : (tenant ? [{ id: tenant.id, name: tenant.name }] : []) 
        };
    }
    async getMe(token: string): Promise<any | null> {
        const parts = token.split('-');
        if (parts.length < 3) return null;
        const userId = parts[2];
        const users = (await this.getStorage<User[]>('users')) || [];
        const user = users.find(u => u.id === userId && u.isActive);
        if (!user) return null;
        const tenants = await this.getAllTenants();
        const tenant = tenants.find(t => t.id === user.tenantId);
        return { 
            user, 
            tenant, 
            availableTenants: user.role === 'superadmin' 
                ? tenants.map(t => ({ id: t.id, name: t.name })) 
                : (tenant ? [{ id: tenant.id, name: tenant.name }] : []) 
        };
    }
    async updatePresence(userId: string, status: PresenceStatus): Promise<void> {
        const users = (await this.getStorage<User[]>('users')) || [];
        const updatedUsers = users.map(u => u.id === userId ? { ...u, presenceStatus: status, isOnline: status !== 'offline' } : u);
        await this.setStorage('users', updatedUsers);
    }
    async getConversations(tenantId: string): Promise<Conversation[]> {
        return (await this.getStorage<Conversation[]>(`tenant:${tenantId}:conversations`)) || [];
    }
    async getMessages(conversationId: string): Promise<Message[]> {
        return (await this.getStorage<Message[]>(`messages:${conversationId}`)) || [];
    }
    async sendMessage(msg: Message): Promise<Message> {
        const key = `messages:${msg.conversationId}`;
        const msgs = (await this.getMessages(msg.conversationId)) || [];
        msgs.push(msg);
        await this.setStorage(key, msgs);
        return msg;
    }
}