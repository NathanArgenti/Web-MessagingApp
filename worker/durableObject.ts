import { DurableObject } from "cloudflare:workers";
import type { User, Tenant, Queue, Conversation, Message, PresenceStatus, PublicConfig } from '@shared/types';
import { nanoid } from 'nanoid';
export class GlobalDurableObject extends DurableObject {
    private async getStorage<T>(key: string): Promise<T | undefined> {
        return await this.ctx.storage.get<T>(key);
    }
    private async setStorage<T>(key: string, value: T): Promise<void> {
        await this.ctx.storage.put(key, value);
    }
    async seedDatabase(): Promise<boolean> {
        const queues: Queue[] = [
            { id: 'q1', tenantId: 't1', name: 'General Support' },
            { id: 'q2', tenantId: 't1', name: 'Sales' }
        ];
        const tenants: Tenant[] = [
            {
                id: 't1',
                name: 'Acme Corp',
                siteKey: 'acme-123',
                branding: { primaryColor: '#06B6D4', welcomeMessage: 'Welcome to Acme Support!' },
                queues: [queues[0], queues[1]]
            },
            {
                id: 't2',
                name: 'Globex',
                siteKey: 'globex-456',
                branding: { primaryColor: '#F38020', welcomeMessage: 'How can Globex help today?' },
                queues: []
            }
        ];
        const users: User[] = [
            { id: 'u1', email: 'admin@mercury.com', name: 'Global Admin', role: 'superadmin', isOnline: true, presenceStatus: 'online' },
            { id: 'u2', email: 'acme_admin@acme.com', name: 'Acme Admin', role: 'tenant_admin', tenantId: 't1', isOnline: true, presenceStatus: 'online' },
            { id: 'u3', email: 'agent1@acme.com', name: 'Acme Agent 1', role: 'agent', tenantId: 't1', isOnline: false, presenceStatus: 'offline' }
        ];
        const conversations: Conversation[] = [
          {
            id: 'c1',
            tenantId: 't1',
            queueId: 'q1',
            status: 'unassigned',
            contactName: 'John Doe',
            contactEmail: 'john@example.com',
            createdAt: Date.now() - 100000,
            updatedAt: Date.now() - 100000
          }
        ];
        await this.setStorage('tenants', tenants);
        await this.setStorage('users', users);
        await this.setStorage('queues', queues);
        await this.setStorage('tenant:t1:conversations', conversations);
        return true;
    }
    async getPublicConfig(siteKey: string): Promise<PublicConfig | null> {
        const tenants = (await this.getStorage<Tenant[]>('tenants')) || [];
        const tenant = tenants.find(t => t.siteKey === siteKey);
        if (!tenant) return null;
        return {
            tenantId: tenant.id,
            name: tenant.name,
            branding: tenant.branding,
            queues: tenant.queues.map(q => ({ id: q.id, name: q.name }))
        };
    }
    async createVisitorConversation(siteKey: string, queueId: string, contact: { name: string, email?: string }): Promise<Conversation | null> {
        const tenants = (await this.getStorage<Tenant[]>('tenants')) || [];
        const tenant = tenants.find(t => t.siteKey === siteKey);
        if (!tenant) return null;
        const newConv: Conversation = {
            id: nanoid(),
            tenantId: tenant.id,
            queueId,
            status: 'unassigned',
            contactName: contact.name,
            contactEmail: contact.email,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        const key = `tenant:${tenant.id}:conversations`;
        const convs = (await this.getStorage<Conversation[]>(key)) || [];
        convs.push(newConv);
        await this.setStorage(key, convs);
        return newConv;
    }
    async updateTenantSettings(tenantId: string, branding: Tenant['branding'], queues: Queue[]): Promise<boolean> {
        const tenants = (await this.getStorage<Tenant[]>('tenants')) || [];
        const index = tenants.findIndex(t => t.id === tenantId);
        if (index === -1) return false;
        tenants[index].branding = branding;
        tenants[index].queues = queues;
        await this.setStorage('tenants', tenants);
        return true;
    }
    async login(email: string): Promise<{ user: User; token: string; tenant?: Tenant } | null> {
        const users = (await this.getStorage<User[]>('users')) || [];
        const user = users.find(u => u.email === email);
        if (!user) return null;
        const tenants = (await this.getStorage<Tenant[]>('tenants')) || [];
        const tenant = tenants.find(t => t.id === user.tenantId);
        return {
            user,
            token: `mock-jwt-${user.id}-${Date.now()}`,
            tenant
        };
    }
    async getMe(token: string): Promise<{ user: User; tenant?: Tenant } | null> {
        const parts = token.split('-');
        if (parts.length < 3) return null;
        const userId = parts[2];
        const users = (await this.getStorage<User[]>('users')) || [];
        const user = users.find(u => u.id === userId);
        if (!user) return null;
        const tenants = (await this.getStorage<Tenant[]>('tenants')) || [];
        const tenant = tenants.find(t => t.id === user.tenantId);
        return { user, tenant };
    }
    async updatePresence(userId: string, status: PresenceStatus): Promise<void> {
        const users = (await this.getStorage<User[]>('users')) || [];
        const updatedUsers = users.map(u => u.id === userId ? { ...u, presenceStatus: status, isOnline: status !== 'offline' } : u);
        await this.setStorage('users', updatedUsers);
    }
    async getConversations(tenantId: string): Promise<Conversation[]> {
        return (await this.getStorage<Conversation[]>(`tenant:${tenantId}:conversations`)) || [];
    }
    async claimConversation(tenantId: string, conversationId: string, agentId: string): Promise<Conversation | null> {
        const key = `tenant:${tenantId}:conversations`;
        const convs = (await this.getStorage<Conversation[]>(key)) || [];
        const index = convs.findIndex(c => c.id === conversationId);
        if (index === -1) return null;
        const updated = { ...convs[index], status: 'owned' as const, ownerId: agentId, updatedAt: Date.now() };
        convs[index] = updated;
        await this.setStorage(key, convs);
        return updated;
    }
    async getMessages(conversationId: string): Promise<Message[]> {
        return (await this.getStorage<Message[]>(`messages:${conversationId}`)) || [];
    }
    async sendMessage(msg: Message): Promise<Message> {
        const key = `messages:${msg.conversationId}`;
        const msgs = (await this.getStorage<Message[]>(key)) || [];
        msgs.push(msg);
        await this.setStorage(key, msgs);
        return msg;
    }
}