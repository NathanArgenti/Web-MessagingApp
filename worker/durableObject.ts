import { DurableObject } from "cloudflare:workers";
import type { User, Tenant, Queue, Conversation, Message, PresenceStatus, PublicConfig, SystemEvent, EventType, ConversationStatus } from '@shared/types';
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
                queues: [queues[0], queues[1]],
                workflows: []
            },
            {
                id: 't2',
                name: 'Globex',
                siteKey: 'globex-456',
                branding: { primaryColor: '#F38020', welcomeMessage: 'How can Globex help today?' },
                queues: [],
                workflows: []
            }
        ];
        const users: User[] = [
            { id: 'u1', email: 'admin@mercury.com', name: 'Global Admin', role: 'superadmin', isOnline: true, presenceStatus: 'online' },
            { id: 'u2', email: 'acme_admin@acme.com', name: 'Acme Admin', role: 'tenant_admin', tenantId: 't1', isOnline: true, presenceStatus: 'online' },
            { id: 'u3', email: 'agent1@acme.com', name: 'Acme Agent 1', role: 'agent', tenantId: 't1', isOnline: false, presenceStatus: 'offline' }
        ];
        await this.setStorage('tenants', tenants);
        await this.setStorage('users', users);
        await this.setStorage('queues', queues);
        return true;
    }
    async emitEvent(tenantId: string, type: EventType, payload: any): Promise<void> {
        const outbox = (await this.getStorage<SystemEvent[]>('outbox')) || [];
        const event: SystemEvent = {
            id: nanoid(),
            tenantId,
            type,
            payload,
            timestamp: Date.now(),
            processed: false
        };
        outbox.push(event);
        await this.setStorage('outbox', outbox);
        await this.ctx.storage.setAlarm(Date.now() + 1000);
    }
    async alarm() {
        const outbox = (await this.getStorage<SystemEvent[]>('outbox')) || [];
        const tenants = (await this.getStorage<Tenant[]>('tenants')) || [];
        for (const event of outbox.filter(e => !e.processed)) {
            const tenant = tenants.find(t => t.id === event.tenantId);
            if (tenant) {
                const workflows = tenant.workflows.filter(w => w.eventType === event.type && w.active);
                for (const wf of workflows) {
                    console.log(`[WORKFLOW] Triggered: ${wf.name} | Action: ${wf.actionType} | Target: ${wf.targetUrl}`);
                    // In a real env, we'd perform fetch() here
                }
            }
            event.processed = true;
        }
        await this.setStorage('outbox', outbox.filter(e => !e.processed));
    }
    async getAllTenants(): Promise<Tenant[]> {
        return (await this.getStorage<Tenant[]>('tenants')) || [];
    }
    async createTenant(name: string): Promise<Tenant> {
        const tenants = (await this.getAllTenants());
        const newTenant: Tenant = {
            id: nanoid(),
            name,
            siteKey: nanoid(8),
            branding: { primaryColor: '#06B6D4', welcomeMessage: 'Welcome!' },
            queues: [],
            workflows: []
        };
        tenants.push(newTenant);
        await this.setStorage('tenants', tenants);
        return newTenant;
    }
    async getPublicConfig(siteKey: string): Promise<PublicConfig | null> {
        const tenants = await this.getAllTenants();
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
        const tenants = await this.getAllTenants();
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
        await this.updateConvIndex(newConv.id, tenant.id, newConv.status);
        await this.emitEvent(tenant.id, 'conversation.started', newConv);
        return newConv;
    }
    async endConversation(tenantId: string, conversationId: string): Promise<Conversation | null> {
        const key = `tenant:${tenantId}:conversations`;
        const convs = (await this.getStorage<Conversation[]>(key)) || [];
        const index = convs.findIndex(c => c.id === conversationId);
        if (index === -1) return null;
        convs[index].status = 'ended';
        convs[index].updatedAt = Date.now();
        await this.setStorage(key, convs);
        await this.updateConvIndex(conversationId, tenantId, 'ended');
        await this.emitEvent(tenantId, 'conversation.ended', convs[index]);
        return convs[index];
    }
    async updateTenantSettings(tenantId: string, data: Partial<Tenant>): Promise<boolean> {
        const tenants = await this.getAllTenants();
        const index = tenants.findIndex(t => t.id === tenantId);
        if (index === -1) return false;
        tenants[index] = { ...tenants[index], ...data };
        await this.setStorage('tenants', tenants);
        return true;
    }
    async login(email: string): Promise<{ user: User; token: string; tenant?: Tenant } | null> {
        const users = (await this.getStorage<User[]>('users')) || [];
        const user = users.find(u => u.email === email);
        if (!user) return null;
        const tenants = await this.getAllTenants();
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
        const tenants = await this.getAllTenants();
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
        convs[index] = { ...convs[index], status: 'owned', ownerId: agentId, updatedAt: Date.now() };
        await this.setStorage(key, convs);
        await this.updateConvIndex(conversationId, tenantId, 'owned');
        await this.emitEvent(tenantId, 'agent.assigned', convs[index]);
        return convs[index];
    }
    async getMessages(conversationId: string): Promise<Message[]> {
        return (await this.getStorage<Message[]>(`messages:${conversationId}`)) || [];
    }
    async sendMessage(msg: Message): Promise<Message> {
        const key = `messages:${msg.conversationId}`;
        const msgs = await this.getMessages(msg.conversationId);
        msgs.push(msg);
        await this.setStorage(key, msgs);
        return msg;
    }

    private async updateConvIndex(convId: string, tenantId: string, status: ConversationStatus): Promise<void> {
        const index = await this.getStorage<Record<string, {tenantId: string, status: ConversationStatus}>>('conversations_index') || {};
        index[convId] = {tenantId, status};
        await this.setStorage('conversations_index', index);
    }

    async getPublicConvStatus(convId: string): Promise<{status: string, ended: boolean} | null> {
        const index = await this.getStorage<Record<string, {tenantId: string, status: ConversationStatus}>>('conversations_index') || {};
        const entry = index[convId];
        if (!entry) return null;
        return {status: entry.status, ended: entry.status === 'ended'};
    }
}