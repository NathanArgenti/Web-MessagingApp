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
        const queues: Queue[] = [
            { id: 'q1', tenantId: 't1', name: 'General Support', priority: 1, capacityMax: 10, isDeleted: false, assignedAgentIds: ['u3'] },
            { id: 'q2', tenantId: 't1', name: 'Sales', priority: 2, capacityMax: 5, isDeleted: false, assignedAgentIds: [] }
        ];
        const tenants: Tenant[] = [
            {
                id: 't1',
                name: 'Acme Corp',
                sites: [{ id: 's1', name: 'Main Site', key: 'acme-123', defaultQueueId: 'q1' }],
                branding: {
                  primaryColor: '#06B6D4',
                  welcomeMessage: 'Welcome to Acme Support!',
                  widgetPosition: 'bottom-right',
                  themePreset: 'modern'
                },
                queues: [queues[0], queues[1]],
                workflows: [],
                authPolicy: { allowLocalAuth: true }
            }
        ];
        const users: User[] = [
            { id: 'u1', email: 'admin@mercury.com', name: 'Global Admin', role: 'superadmin', isOnline: true, presenceStatus: 'online', isActive: true, createdAt: Date.now() },
            { id: 'u2', email: 'acme_admin@acme.com', name: 'Acme Admin', role: 'tenant_admin', tenantId: 't1', isOnline: true, presenceStatus: 'online', isActive: true, createdAt: Date.now() },
            { id: 'u3', email: 'agent1@acme.com', name: 'Acme Agent 1', role: 'agent', tenantId: 't1', isOnline: false, presenceStatus: 'offline', isActive: true, createdAt: Date.now() }
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
        const existingIdx = users.findIndex(u => u.id === input.id || u.email === input.email);
        if (existingIdx > -1) {
            const updated = { ...users[existingIdx], ...input, id: users[existingIdx].id };
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
    async getQueueStatus(tenantId: string, queueId: string): Promise<QueueStatus | null> {
        const tenants = (await this.getStorage<Tenant[]>('tenants')) || [];
        const tenant = tenants.find(t => t.id === tenantId);
        if (!tenant) return null;
        const queue = tenant.queues?.find(q => q.id === queueId);
        if (!queue) return null;
        const users = (await this.getStorage<User[]>('users')) || [];
        const agentsOnline = users.filter(u => 
            u.tenantId === tenantId && 
            u.isOnline && 
            queue.assignedAgentIds?.includes(u.id)
        ).length;
        const conversations = (await this.getStorage<Conversation[]>(`tenant:${tenantId}:conversations`)) || [];
        const activeInQueue = conversations.filter(c => c.queueId === queueId && c.status !== 'ended').length;
        const capacityMax = queue.capacityMax || 10;
        const isFull = activeInQueue >= capacityMax;
        return {
            available: agentsOnline > 0 && !isFull,
            agentsOnline,
            capacityUsed: activeInQueue,
            capacityMax,
            isFull
        };
    }
    async createOfflineRequest(tenantId: string, data: Omit<OfflineRequest, 'id' | 'status' | 'createdAt' | 'tenantId'>): Promise<OfflineRequest> {
        const key = `tenant:${tenantId}:offline_requests`;
        const requests = (await this.getStorage<OfflineRequest[]>(key)) || [];
        const newReq: OfflineRequest = {
            ...data,
            id: nanoid(),
            tenantId,
            status: 'pending',
            createdAt: Date.now()
        };
        requests.push(newReq);
        await this.setStorage(key, requests);
        return newReq;
    }
    async getOfflineRequests(tenantId: string): Promise<OfflineRequest[]> {
        return (await this.getStorage<OfflineRequest[]>(`tenant:${tenantId}:offline_requests`)) || [];
    }
    async toggleQueueMembership(userId: string, tenantId: string, queueId: string, action: 'join' | 'leave'): Promise<boolean> {
        const tenants = (await this.getStorage<Tenant[]>('tenants')) || [];
        const tIdx = tenants.findIndex(t => t.id === tenantId);
        if (tIdx === -1) return false;
        const qIdx = tenants[tIdx].queues?.findIndex(q => q.id === queueId);
        if (qIdx === -1 || qIdx === undefined) return false;
        const assigned = tenants[tIdx].queues[qIdx].assignedAgentIds || [];
        if (action === 'join') {
            if (!assigned.includes(userId)) assigned.push(userId);
        } else {
            tenants[tIdx].queues[qIdx].assignedAgentIds = assigned.filter(id => id !== userId);
        }
        await this.setStorage('tenants', tenants);
        return true;
    }
    async getPublicConfig(siteKey: string): Promise<PublicConfig | null> {
        const tenants = (await this.getStorage<Tenant[]>('tenants')) || [];
        for (const tenant of tenants) {
            const site = tenant.sites?.find(s => s.key === siteKey);
            if (site) {
                const queues = (tenant.queues || [])
                        .filter(q => !q.isDeleted)
                        .map(q => ({ id: q.id, name: q.name, priority: q.priority || 0 }))
                        .sort((a, b) => (b.priority || 0) - (a.priority || 0));
                const defaultQueueId = site.defaultQueueId || queues[0]?.id;
                let initialStatus: QueueStatus | undefined;
                if (defaultQueueId) {
                    initialStatus = await this.getQueueStatus(tenant.id, defaultQueueId) || undefined;
                }
                return {
                    tenantId: tenant.id,
                    name: tenant.name,
                    branding: tenant.branding,
                    queues,
                    initialQueueStatus: initialStatus
                };
            }
        }
        return null;
    }
    async updateTenantSettings(tenantId: string, settings: Partial<Tenant>): Promise<Tenant | null> {
        const tenants = (await this.getStorage<Tenant[]>('tenants')) || [];
        const idx = tenants.findIndex(t => t.id === tenantId);
        if (idx === -1) return null;
        if (settings.queues) {
            settings.queues = settings.queues.map(q => ({
                ...q,
                assignedAgentIds: q.assignedAgentIds || []
            }));
        }
        tenants[idx] = { ...tenants[idx], ...settings };
        await this.setStorage('tenants', tenants);
        return tenants[idx];
    }
    async createVisitorConversation(siteKey: string, queueId: string, contact: { name: string, email?: string }): Promise<Conversation | null> {
        const tenants = (await this.getStorage<Tenant[]>('tenants')) || [];
        let targetTenant: Tenant | null = null;
        let targetSite: TenantSite | null = null;
        for (const t of tenants) {
            const s = t.sites?.find(site => site.key === siteKey);
            if (s) {
                targetTenant = t;
                targetSite = s;
                break;
            }
        }
        if (!targetTenant) return null;
        const availableQueues = targetTenant.queues.filter(q => !q.isDeleted);
        let finalQueue = availableQueues.find(q => q.id === queueId);
        if (!finalQueue) {
            finalQueue = availableQueues.find(q => q.id === targetSite?.defaultQueueId) || availableQueues[0];
        }
        if (!finalQueue) return null;
        const status = await this.getQueueStatus(targetTenant.id, finalQueue.id);
        if (!status?.available) {
            await this.createOfflineRequest(targetTenant.id, {
                queueId: finalQueue.id,
                visitorName: contact.name,
                visitorEmail: contact.email || '',
                subject: 'Live Chat Request (Unavailable)',
                message: `Live chat attempt by ${contact.name} (${contact.email || 'no email'}). No agents online or queue full.`
            });
            return null;
        }
        const conversationsKey = `tenant:${targetTenant.id}:conversations`;
        const existingConvs = (await this.getStorage<Conversation[]>(conversationsKey)) || [];
        const activeInQueue = existingConvs.filter(c => c.queueId === finalQueue?.id && c.status !== 'ended').length;
        if (finalQueue.capacityMax && activeInQueue >= finalQueue.capacityMax) {
            return null;
        }
        const newConv: Conversation = {
            id: nanoid(),
            tenantId: targetTenant.id,
            queueId: finalQueue.id,
            status: 'unassigned',
            contactName: contact.name,
            contactEmail: contact.email,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        existingConvs.push(newConv);
        await this.setStorage(conversationsKey, existingConvs);
        const index = await this.getStorage<Record<string, {tenantId: string, status: ConversationStatus}>>('conversations_index') || {};
        index[newConv.id] = { tenantId: targetTenant.id, status: 'unassigned' };
        await this.setStorage('conversations_index', index);
        await this.emitEvent(targetTenant.id, 'conversation.started', newConv);
        return newConv;
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
                const workflows = tenant.workflows?.filter(w => w.eventType === event.type && w.active) || [];
                for (const wf of workflows) {
                    console.log(`[WORKFLOW] Triggered: ${wf.name} | Action: ${wf.actionType} | Target: ${wf.targetUrl}`);
                }
            }
            event.processed = true;
        }
        await this.setStorage('outbox', outbox);
    }
    async getSystemMetrics(tenantId: string): Promise<SystemMetrics> {
        const conversations = (await this.getStorage<Conversation[]>(`tenant:${tenantId}:conversations`)) || [];
        const users = (await this.getStorage<User[]>('users')) || [];
        const activeAgents = users.filter(u => u.tenantId === tenantId && u.isOnline).length;
        const hourlyVolume: MetricPoint[] = Array.from({ length: 24 }).map((_, i) => ({ timestamp: `${i}:00`, value: Math.floor(Math.random() * 20) }));
        return { hourlyMessageVolume: hourlyVolume, avgResponseTime: 45, resolutionRate: 88, activeAgents, totalConvs: conversations.length };
    }
    async getGlobalMetrics(): Promise<GlobalMetrics> {
        const tenants = (await this.getStorage<Tenant[]>('tenants')) || [];
        const users = (await this.getStorage<User[]>('users')) || [];
        return { totalTenants: tenants.length, totalMessages: 15420, activeAgentsPlatform: users.filter(u => u.isOnline).length, uptime: '99.99%' };
    }
    async getAllTenants(): Promise<Tenant[]> {
        return (await this.getStorage<Tenant[]>('tenants')) || [];
    }
    async createTenant(name: string): Promise<Tenant> {
        const tenants = (await this.getAllTenants());
        const newTenant: Tenant = { id: nanoid(), name, sites: [], branding: { primaryColor: '#06B6D4', welcomeMessage: 'Welcome!' }, queues: [], workflows: [] };
        tenants.push(newTenant);
        await this.setStorage('tenants', tenants);
        return newTenant;
    }
    async endConversation(tenantId: string, conversationId: string): Promise<Conversation | null> {
        const key = `tenant:${tenantId}:conversations`;
        const convs = (await this.getStorage<Conversation[]>(key)) || [];
        const index = convs.findIndex(c => c.id === conversationId);
        if (index === -1) return null;
        convs[index].status = 'ended';
        convs[index].updatedAt = Date.now();
        await this.setStorage(key, convs);
        const idxStore = await this.getStorage<Record<string, any>>('conversations_index') || {};
        if (idxStore[conversationId]) {
            idxStore[conversationId].status = 'ended';
            await this.setStorage('conversations_index', idxStore);
        }
        await this.emitEvent(tenantId, 'conversation.ended', convs[index]);
        return convs[index];
    }
    async login(email: string): Promise<{ user: User; token: string; tenant?: Tenant; availableTenants: any[] } | null> {
        const users = (await this.getStorage<User[]>('users')) || [];
        const user = users.find(u => u.email === email && u.isActive);
        if (!user) return null;
        const tenants = await this.getAllTenants();
        const tenant = tenants.find(t => t.id === user.tenantId);
        return { user, token: `mock-jwt-${user.id}-${Date.now()}`, tenant, availableTenants: user.role === 'superadmin' ? tenants.map(t => ({ id: t.id, name: t.name })) : (tenant ? [{ id: tenant.id, name: tenant.name }] : []) };
    }
    async getMe(token: string): Promise<{ user: User; tenant?: Tenant; availableTenants: any[] } | null> {
        const parts = token.split('-');
        if (parts.length < 3) return null;
        const userId = parts[2];
        const users = (await this.getStorage<User[]>('users')) || [];
        const user = users.find(u => u.id === userId && u.isActive);
        if (!user) return null;
        const tenants = await this.getAllTenants();
        const tenant = tenants.find(t => t.id === user.tenantId);
        return { user, tenant, availableTenants: user.role === 'superadmin' ? tenants.map(t => ({ id: t.id, name: t.name })) : (tenant ? [{ id: tenant.id, name: tenant.name }] : []) };
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
        const idxStore = await this.getStorage<Record<string, any>>('conversations_index') || {};
        if (idxStore[conversationId]) {
            idxStore[conversationId].status = 'owned';
            await this.setStorage('conversations_index', idxStore);
        }
        await this.emitEvent(tenantId, 'agent.assigned', convs[index]);
        return convs[index];
    }
    async dispatchOfflineRequest(tenantId: string, offlineId: string, agentId: string): Promise<OfflineRequest | null> {
        const key = `tenant:${tenantId}:offline_requests`;
        const requests = (await this.getStorage<OfflineRequest[]>(key)) || [];
        const idx = requests.findIndex(r => r.id === offlineId);
        if (idx === -1) return null;
        requests[idx].status = 'dispatched';
        requests[idx].dispatchedBy = agentId;
        requests[idx].dispatchTimestamp = Date.now();
        await this.setStorage(key, requests);
        return requests[idx];
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
}