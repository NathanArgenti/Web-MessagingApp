import { Hono } from "hono";
import type { ApiResponse, AuthPayload, Conversation, Message, User, Tenant, OfflineRequest, QueueStatus, PresenceStatus, GlobalMetrics, SystemMetrics } from '@shared/types';

export function userRoutes(rawApp: any) {
    const app = rawApp as Hono;
    const getAuthToken = (c: any) => c.req.header('Authorization')?.split(' ')[1] || '';
    const getStub = (c: any) => {
        const env = c.env as any;
        return env.GlobalDurableObject.get(env.GlobalDurableObject.idFromName("global"));
    };
    const enforceTenantContext = async (c: any, next: any) => {
        const token = getAuthToken(c);
        const stub = getStub(c);
        const me = await stub.getMe(token);
        const targetTenantId = c.req.header('X-Tenant-ID');
        if (!me) return c.json({ success: false, error: 'Unauthorized' }, 401);
        if (me.user.role === 'superadmin') return await next();
        if (targetTenantId && me.user.tenantId !== targetTenantId) {
            return c.json({ success: false, error: 'Access denied: Tenant isolation violation' }, 403);
        }
        return await next();
    };
    // PUBLIC ENDPOINTS
    app.get('/api/public/config/:siteKey', async (c) => {
        const siteKey = c.req.param('siteKey');
        const stub = getStub(c);
        const data = await stub.getPublicConfig(siteKey);
        if (!data) return c.json({ success: false, error: 'Site not found' }, 404);
        return c.json({ success: true, data });
    });
    app.get('/api/public/queue/:id/status', async (c) => {
        const id = c.req.param('id');
        const stub = getStub(c);
        const data = await stub.getQueueStatus(id);
        return c.json({ success: true, data });
    });
    app.post('/api/public/conversations', async (c) => {
        const { siteKey, queueId, name } = await c.req.json();
        const stub = getStub(c);
        const data = await stub.createConversation(siteKey, queueId, name);
        if (!data) return c.json({ success: false, error: 'Could not start conversation' }, 400);
        return c.json({ success: true, data });
    });
    app.post('/api/public/offline', async (c) => {
        const body = await c.req.json();
        const stub = getStub(c);
        const data = await stub.saveOfflineRequest({
            id: crypto.randomUUID(),
            ...body,
            status: 'pending',
            createdAt: Date.now()
        });
        return c.json({ success: true, data });
    });
    // AUTH & AGENT ENDPOINTS
    app.get('/api/auth/me', async (c) => {
        const token = getAuthToken(c);
        const stub = getStub(c);
        const data = await stub.getMe(token);
        return c.json({ success: !!data, data });
    });
    app.put('/api/presence', async (c) => {
        const { status } = await c.req.json<{ status: PresenceStatus }>();
        const token = getAuthToken(c);
        const stub = getStub(c);
        const me = await stub.getMe(token);
        if (!me) return c.json({ success: false, error: 'Unauthorized' }, 401);
        await stub.updatePresence(me.user.id, status);
        return c.json({ success: true });
    });
    app.post('/api/conversations/:id/claim', async (c) => {
        const id = c.req.param('id');
        const token = getAuthToken(c);
        const stub = getStub(c);
        const me = await stub.getMe(token);
        if (!me) return c.json({ success: false, error: 'Unauthorized' }, 401);
        const data = await stub.claimConversation(me.user.id, id);
        return c.json({ success: !!data, data });
    });
    app.post('/api/conversations/:id/end', async (c) => {
        const id = c.req.param('id');
        const stub = getStub(c);
        const data = await stub.endConversation(id);
        return c.json({ success: !!data, data });
    });
    app.get('/api/agent/metrics', enforceTenantContext, async (c) => {
        const tenantId = c.req.header('X-Tenant-ID');
        if (!tenantId) return c.json({ success: false, error: 'Tenant ID required' }, 400);
        const stub = getStub(c);
        const data = await stub.getAgentMetrics(tenantId);
        return c.json({ success: true, data });
    });
    app.post('/api/agent/queues/join', async (c) => {
        const { queueId } = await c.req.json();
        const token = getAuthToken(c);
        const stub = getStub(c);
        const me = await stub.getMe(token);
        if (!me) return c.json({ success: false, error: 'Unauthorized' }, 401);
        await stub.joinQueue(me.user.id, queueId);
        return c.json({ success: true });
    });
    app.post('/api/agent/queues/leave', async (c) => {
        const { queueId } = await c.req.json();
        const token = getAuthToken(c);
        const stub = getStub(c);
        const me = await stub.getMe(token);
        if (!me) return c.json({ success: false, error: 'Unauthorized' }, 401);
        await stub.leaveQueue(me.user.id, queueId);
        return c.json({ success: true });
    });
    // ADMIN & INTERNAL
    app.get('/api/admin/agents', enforceTenantContext, async (c) => {
        const tenantId = c.req.header('X-Tenant-ID');
        if (!tenantId) return c.json({ success: false, error: 'Tenant ID required' }, 400);
        const stub = getStub(c);
        const data = await stub.getUsers(tenantId, 'agent');
        const admins = await stub.getUsers(tenantId, 'tenant_admin');
        return c.json({ success: true, data: [...data, ...admins] });
    });
    app.get('/api/internal/offline', enforceTenantContext, async (c) => {
        const tenantId = c.req.header('X-Tenant-ID');
        if (!tenantId) return c.json({ success: false, error: 'Tenant ID required' }, 400);
        const stub = getStub(c);
        const data = await stub.getOfflineRequests(tenantId);
        return c.json({ success: true, data });
    });
    app.post('/api/internal/offline/:id/dispatch', enforceTenantContext, async (c) => {
        const id = c.req.param('id');
        const tenantId = c.req.header('X-Tenant-ID');
        if (!tenantId) return c.json({ success: false, error: 'Tenant ID required' }, 400);
        const stub = getStub(c);
        const ok = await stub.dispatchOfflineRequest(tenantId, id);
        return c.json({ success: ok });
    });

    app.put('/api/admin/settings', enforceTenantContext, async (c) => {
        const tenantId = c.req.header('X-Tenant-ID');
        if (!tenantId) return c.json({ success: false, error: 'Tenant ID required' }, 400);
        const settings = await c.req.json<any>();
        const stub = getStub(c);
        await stub.updateTenantSettings(tenantId, settings);
        return c.json({ success: true });
    });
    app.get('/api/superadmin/tenants', async (c) => {
        const token = getAuthToken(c);
        const stub = getStub(c);
        const me = await stub.getMe(token);
        if (me?.user.role !== 'superadmin') return c.json({ success: false, error: 'Forbidden' }, 403);
        const data = await stub.getAllTenants();
        return c.json({ success: true, data });
    });
    app.post('/api/superadmin/tenants', async (c) => {
        const token = getAuthToken(c);
        const stub = getStub(c);
        const me = await stub.getMe(token);
        if (me?.user.role !== 'superadmin') return c.json({ success: false, error: 'Forbidden' }, 403);
        const { name } = await c.req.json();
        const data = await stub.createTenant(name);
        return c.json({ success: true, data });
    });
    app.get('/api/superadmin/users', async (c) => {
        const token = getAuthToken(c);
        const stub = getStub(c);
        const me = await stub.getMe(token);
        if (me?.user.role !== 'superadmin') return c.json({ success: false, error: 'Forbidden' }, 403);
        const data = await stub.getUsers();
        return c.json({ success: true, data });
    });
    app.post('/api/superadmin/users', async (c) => {
        const token = getAuthToken(c);
        const stub = getStub(c);
        const me = await stub.getMe(token);
        if (me?.user.role !== 'superadmin') return c.json({ success: false, error: 'Forbidden' }, 403);
        const body = await c.req.json();
        const data = await stub.upsertUser(body);
        return c.json({ success: true, data });
    });
    app.get('/api/admin/stats', async (c) => {
        const stub = getStub(c);
        const data = await stub.getGlobalMetrics();
        return c.json({ success: true, data });
    });
    app.get('/api/conversations', enforceTenantContext, async (c) => {
        const tenantId = c.req.header('X-Tenant-ID');
        if (!tenantId) return c.json({ success: false, error: 'Tenant ID required' }, 400);
        const stub = getStub(c);
        const data = await stub.getConversations(tenantId);
        return c.json({ success: true, data });
    });
    app.post('/api/seed', async (c) => {
        const stub = getStub(c);
        await stub.seedDatabase();
        return c.json({ success: true, data: "Database reset to defaults" });
    });
    app.post('/api/auth/local/login', async (c) => {
        const { email } = await c.req.json();
        const stub = getStub(c);
        const data = await stub.login(email);
        return c.json({ success: !!data, data });
    });
    app.get('/api/conversations/:id/messages', async (c) => {
        const id = c.req.param('id');
        const stub = getStub(c);
        const data = await stub.getMessages(id);
        return c.json({ success: true, data: data || [] });
    });
    app.post('/api/conversations/:id/messages', async (c) => {
        const id = c.req.param('id');
        const body = await c.req.json();
        const token = getAuthToken(c);
        const stub = getStub(c);
        let message: Message;
        if (token) {
            const me = await stub.getMe(token);
            if (!me) return c.json({ success: false, error: 'Unauthorized' }, 401);
            message = {
                id: crypto.randomUUID(),
                conversationId: id,
                senderId: me.user.id,
                senderType: 'agent',
                content: body.content,
                timestamp: Date.now()
            };
        } else {
            message = {
                id: crypto.randomUUID(),
                conversationId: id,
                senderId: 'visitor',
                senderType: 'visitor',
                content: body.content,
                timestamp: Date.now()
            };
        }
        const data = await stub.sendMessage(message);
        return c.json({ success: true, data });
    });
}