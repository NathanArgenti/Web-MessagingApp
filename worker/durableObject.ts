import { DurableObject } from "cloudflare:workers";
import type {
    User, Tenant, Queue, Conversation, Message, PresenceStatus,
    PublicConfig, SystemEvent, EventType, ConversationStatus,
    OfflineRequest, SystemMetrics, GlobalMetrics, MetricPoint, TenantSite,
    UserCreateInput, UserUpdateInput, QueueStatus, AuthPayload, Workflow
} from '@shared/types';
export class GlobalDurableObject extends DurableObject {
    private async getStorage<T>(key: string): Promise<T | undefined> {
        return await this.ctx.storage.get<T>(key);
    }
    private async setStorage<T>(key: string, value: T): Promise<void> {
        await this.ctx.storage.put(key, value);
    }
    async seedDatabase(isProd: boolean = false): Promise<boolean> {
        const existingTenants = await this.getStorage<Tenant[]>('tenants');
        if (isProd && existingTenants && existingTenants.length > 0) {
            const users = (await this.getStorage<User[]>('users')) || [];
            if (!users.some(u => u.email === 'admin@mercury.com')) {
                users.push({
                    id: 'u-super-prod',
                    email: 'admin@mercury.com',
                    name: 'Mercury Global Admin',
                    role: 'superadmin',
                    isOnline: false,
                    presenceStatus: 'offline',
                    isActive: true,
                    createdAt: Date.now()
                });
                await this.setStorage('users', users);
            }
            return false;
        }
        if (!isProd) {
            await this.ctx.storage.deleteAll();
        }
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
                workflows: [
                    { id: 'wf1', name: 'Notify Slack on Chat', eventType: 'conversation.started', actionType: 'webhook', targetUrl: 'https://hooks.slack.com/services/mock', active: true }
                ],
                authPolicy: { allowLocalAuth: true }
            }
        ];
        const users: User[] = [
            { id: 'u1', email: 'admin@mercury.com', name: 'Mercury Global Admin', role: 'superadmin', isOnline: false, presenceStatus: 'offline', isActive: true, createdAt: Date.now() },
            { id: 'u2', email: 'acme_admin@acme.com', name: 'Acme Tenant Admin', role: 'tenant_admin', tenantId: 't1', isOnline: false, presenceStatus: 'offline', isActive: true, createdAt: Date.now() },
            { id: 'u3', email: 'agent1@acme.com', name: 'Acme Support Agent', role: 'agent', tenantId: 't1', isOnline: false, presenceStatus: 'offline', isActive: true, createdAt: Date.now() }
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
            id: input.id || crypto.randomUUID(),
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
            id: tenantId
        };
        await this.setStorage('tenants', tenants);
        return tenants[idx];
    }
    async getGlobalMetrics(): Promise<GlobalMetrics> {
        const tenants = (await this.getStorage<Tenant[]>('tenants')) || [];
        const users = (await this.getStorage<User[]>('users')) || [];
        let totalConvs = 0;
        for (const t of tenants) {
            const convs = await this.getConversations(t.id);
            totalConvs += convs.length;
        }
        return {
            totalTenants: tenants.length,
            totalMessages: totalConvs * 8,
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
            id: crypto.randomUUID(),
            name,
            sites: [],
            branding: { primaryColor: '#06B6D4', welcomeMessage: 'Welcome to our platform!' },
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
    async getQueues(tenantId: string): Promise<Queue[]> {
        const tenants = await this.getAllTenants();
        const tenant = tenants.find(t => t.id === tenantId);
        return tenant?.queues || [];
    }
    // --- WORKFLOW ENGINE & EVENT OUTBOX ---
    async getEvents(tenantId: string): Promise<SystemEvent[]> {
        return (await this.getStorage<SystemEvent[]>(`tenant:${tenantId}:events`)) || [];
    }
    private async emitEvent(tenantId: string, type: EventType, payload: Record<string, any>): Promise<void> {
        const tenants = await this.getAllTenants();
        const tenant = tenants.find(t => t.id === tenantId);
        if (!tenant) return;
        const matchedWorkflows = (tenant.workflows || []).filter(w => w.active && w.eventType === type);
        const eventLog = await this.getEvents(tenantId);
        for (const workflow of matchedWorkflows) {
            const event: SystemEvent = {
                id: crypto.randomUUID(),
                tenantId,
                type,
                payload: { ...payload, workflowId: workflow.id, action: workflow.actionType },
                timestamp: Date.now(),
                processed: true // Mock immediate processing
            };
            eventLog.push(event);
            console.log(`[WORKFLOW EXECUTION] Tenant ${tenantId}: Executed ${workflow.name} for ${type}`);
        }
        // Limit log size
        const trimmedLog = eventLog.slice(-100);
        await this.setStorage(`tenant:${tenantId}:events`, trimmedLog);
    }
    // --- CONVERSATION METHODS ---
    async getConversations(tenantId: string): Promise<Conversation[]> {
        return (await this.getStorage<Conversation[]>(`tenant:${tenantId}:conversations`)) || [];
    }
    async getConversationById(conversationId: string): Promise<Conversation | null> {
        const tenants = await this.getAllTenants();
        for (const t of tenants) {
            const convs = await this.getConversations(t.id);
            const found = convs.find(c => c.id === conversationId);
            if (found) return found;
        }
        return null;
    }
    async createConversation(siteKey: string, queueId: string, contactName: string): Promise<Conversation | null> {
        const tenants = await this.getAllTenants();
        let tenantId = "";
        for (const t of tenants) {
            if (t.sites.some(s => s.key === siteKey)) {
                tenantId = t.id;
                break;
            }
        }
        if (!tenantId) return null;
        const convs = await this.getConversations(tenantId);
        const newConv: Conversation = {
            id: crypto.randomUUID(),
            tenantId,
            queueId,
            status: 'unassigned',
            contactName,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        convs.push(newConv);
        await this.setStorage(`tenant:${tenantId}:conversations`, convs);
        await this.emitEvent(tenantId, 'conversation.started', { conversationId: newConv.id, contactName });
        return newConv;
    }
    async claimConversation(userId: string, conversationId: string): Promise<Conversation | null> {
        const users = (await this.getStorage<User[]>('users')) || [];
        const user = users.find(u => u.id === userId);
        if (!user || !user.tenantId) return null;
        const convs = await this.getConversations(user.tenantId);
        const idx = convs.findIndex(c => c.id === conversationId);
        if (idx === -1) return null;
        convs[idx] = {
            ...convs[idx],
            status: 'owned',
            ownerId: userId,
            updatedAt: Date.now()
        };
        await this.setStorage(`tenant:${user.tenantId}:conversations`, convs);
        await this.emitEvent(user.tenantId, 'agent.assigned', { conversationId, agentId: userId });
        return convs[idx];
    }
    async endConversation(conversationId: string): Promise<Conversation | null> {
        const tenants = await this.getAllTenants();
        for (const tenant of tenants) {
            const convs = await this.getConversations(tenant.id);
            const idx = convs.findIndex(c => c.id === conversationId);
            if (idx !== -1) {
                const conv = convs[idx];
                convs[idx] = { ...conv, status: 'ended', updatedAt: Date.now() };
                await this.setStorage(`tenant:${tenant.id}:conversations`, convs);
                await this.emitEvent(tenant.id, 'conversation.ended', { conversationId, ownerId: conv.ownerId });
                return convs[idx];
            }
        }
        return null;
    }
    // --- MESSAGE METHODS ---
    async getMessages(conversationId: string): Promise<Message[]> {
        return (await this.getStorage<Message[]>(`messages:${conversationId}`)) || [];
    }
    async sendMessage(msg: Message, tenantId?: string): Promise<Message> {
        const key = `messages:${msg.conversationId}`;
        const msgs = await this.getMessages(msg.conversationId);
        msgs.push(msg);
        await this.setStorage(key, msgs);
        if (tenantId) {
            const convs = await this.getConversations(tenantId);
            const idx = convs.findIndex(c => c.id === msg.conversationId);
            if (idx !== -1) {
                convs[idx].updatedAt = Date.now();
                await this.setStorage(`tenant:${tenantId}:conversations`, convs);
            }
        }
        return msg;
    }
    // --- PUBLIC CONFIG & STATUS ---
    async getPublicConfig(siteKey: string): Promise<PublicConfig | null> {
        const tenants = await this.getAllTenants();
        for (const t of tenants) {
            const site = t.sites.find(s => s.key === siteKey);
            if (site) {
                const defaultQid = site.defaultQueueId || t.queues[0]?.id || '';
                return {
                    tenantId: t.id,
                    name: t.name,
                    branding: t.branding,
                    defaultQueueId: defaultQid,
                    queues: t.queues.map(q => ({ id: q.id, name: q.name, priority: q.priority || 0 })),
                    initialQueueStatus: await this.getQueueStatus(defaultQid)
                };
            }
        }
        return null;
    }
    async getQueueStatus(queueId?: string): Promise<QueueStatus> {
        if (!queueId) return { available: false, agentsOnline: 0, capacityUsed: 0, capacityMax: 10, isFull: true };
        const tenants = await this.getAllTenants();
        let targetQueue: Queue | undefined;
        let tenantId = '';
        for (const tenant of tenants) {
            targetQueue = (tenant.queues || []).find(q => q.id === queueId);
            if (targetQueue) {
                tenantId = tenant.id;
                break;
            }
        }
        if (!targetQueue) return { available: false, agentsOnline: 0, capacityUsed: 0, capacityMax: 10, isFull: true };
        const users = (await this.getStorage<User[]>('users')) || [];
        const onlineAgents = users.filter(u => u.isOnline && u.tenantId === tenantId && (targetQueue!.assignedAgentIds || []).includes(u.id));
        const convs = await this.getConversations(tenantId);
        const activeConvs = convs.filter(c => c.queueId === queueId && c.status === 'owned');
        return {
            available: onlineAgents.length > 0,
            agentsOnline: onlineAgents.length,
            capacityUsed: activeConvs.length,
            capacityMax: targetQueue.capacityMax || 10,
            isFull: activeConvs.length >= (targetQueue.capacityMax || 10)
        };
    }
    // --- OFFLINE & METRICS ---
    async saveOfflineRequest(req: OfflineRequest): Promise<OfflineRequest> {
        const key = `tenant:${req.tenantId}:offline`;
        const list = (await this.getStorage<OfflineRequest[]>(key)) || [];
        list.push(req);
        await this.setStorage(key, list);
        return req;
    }
    async getOfflineRequests(tenantId: string): Promise<OfflineRequest[]> {
        return (await this.getStorage<OfflineRequest[]>(`tenant:${tenantId}:offline`)) || [];
    }
    async dispatchOfflineRequest(tenantId: string, requestId: string): Promise<boolean> {
        const key = `tenant:${tenantId}:offline`;
        const list = (await this.getStorage<OfflineRequest[]>(key)) || [];
        const idx = list.findIndex(r => r.id === requestId);
        if (idx === -1) return false;
        list[idx].status = 'dispatched';
        list[idx].dispatchTimestamp = Date.now();
        await this.setStorage(key, list);
        return true;
    }
    async getAgentMetrics(tenantId: string): Promise<SystemMetrics> {
        const convs = await this.getConversations(tenantId);
        const users = (await this.getStorage<User[]>('users')) || [];
        const activeAgents = users.filter(u => u.tenantId === tenantId && u.isOnline).length;
        return {
            hourlyMessageVolume: [
                { timestamp: '08:00', value: 12 }, { timestamp: '12:00', value: 45 },
                { timestamp: '16:00', value: 30 }, { timestamp: '20:00', value: 15 }
            ],
            avgResponseTime: 42,
            resolutionRate: 88,
            activeAgents,
            totalConvs: convs.length
        };
    }
    async joinQueue(userId: string, queueId: string): Promise<void> {
        const users = (await this.getStorage<User[]>('users')) || [];
        const user = users.find(u => u.id === userId);
        if (!user?.tenantId) return;
        const tenants = await this.getAllTenants();
        const tenant = tenants.find(t => t.id === user.tenantId);
        if (!tenant) return;
        const qIdx = tenant.queues.findIndex(q => q.id === queueId);
        if (qIdx !== -1) {
            const ids = tenant.queues[qIdx].assignedAgentIds || [];
            if (!ids.includes(userId)) {
                tenant.queues[qIdx].assignedAgentIds = [...ids, userId];
                await this.setStorage('tenants', tenants);
            }
        }
    }
    async leaveQueue(userId: string, queueId: string): Promise<void> {
        const users = (await this.getStorage<User[]>('users')) || [];
        const user = users.find(u => u.id === userId);
        if (!user?.tenantId) return;
        const tenants = await this.getAllTenants();
        const tenant = tenants.find(t => t.id === user.tenantId);
        if (!tenant) return;
        const qIdx = tenant.queues.findIndex(q => q.id === queueId);
        if (qIdx !== -1) {
            const ids = tenant.queues[qIdx].assignedAgentIds || [];
            tenant.queues[qIdx].assignedAgentIds = ids.filter(id => id !== userId);
            await this.setStorage('tenants', tenants);
        }
    }
}