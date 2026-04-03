import { Hono } from "hono";
import type { ApiResponse, Conversation, Message, PresenceStatus } from '@shared/types';
export function userRoutes(app: Hono<{ Bindings: any }>): void {
    const app_ = app as any;

    const getAuthToken = (c: any): string => c.req.header('Authorization')?.split(' ')[1] || '';
    const getStub = (c: any) => {
        const env = c.env;
        return env.GlobalDurableObject.get(env.GlobalDurableObject.idFromName("global"));
    };
    const enforceTenantContext = async (c: any, next: any): Promise<Response> => {
        const token = getAuthToken(c);
        const stub = getStub(c);
        const me = await stub.getMe(token);
        const targetTenantId = c.req.header('X-Tenant-ID');
        if (!me.user) return c.json({ success: false, error: 'Unauthorized' }, 401);
        if (me.user.role === 'superadmin') return await next();
        if (!targetTenantId || me.user.tenantId !== targetTenantId) {
            return c.json({ success: false, error: 'Tenant isolation violation' }, 403);
        }
        return await next();
    };
    // PUBLIC ENDPOINTS
    app_.get('/api/public/config/:siteKey', async (c: any) => {
        const siteKey = c.req.param('siteKey');
        const stub = getStub(c);
        const data = await stub.getPublicConfig(siteKey);
        if (!data) return c.json({ success: false, error: 'Site not found' }, 404);
        return c.json({ success: true, data });
    });
    app_.get('/api/public/conversations/:id/status', async (c: any) => {
        const id = c.req.param('id');
        const stub = getStub(c);
        const conv = await stub.getConversationById(id);
        const ended = conv ? conv.status === 'ended' : true;
        return c.json({ success: true, data: { status: conv ? (conv.status || 'ended') : 'ended', ended } });
    });

    app_.get('/api/public/queue/:id/status', async (c: any) => {
        const id = c.req.param('id');
        const stub = getStub(c);
        const data = await stub.getQueueStatus(id);
        return c.json({ success: true, data });
    });
    // AUTH & AGENT ENDPOINTS
    app_.get('/api/auth/me', async (c: any) => {
        const token = getAuthToken(c);
        const stub = getStub(c);
        const data = await stub.getMe(token);
        return c.json({ success: !!data, data });
    });
    app_.get('/api/admin/events', enforceTenantContext, async (c: any) => {
        const tenantId = c.req.header('X-Tenant-ID');
        if (!tenantId) return c.json({ success: false, error: 'Tenant ID required' }, 400);
        const stub = getStub(c);
        const data = await stub.getEvents(tenantId);
        return c.json({ success: true, data });
    });
    app_.put('/api/presence', enforceTenantContext, async (c: any) => {
        const tenantId = c.req.header('X-Tenant-ID');
        if (!tenantId) return c.json({ success: false, error: 'Tenant ID required' }, 400);
        const { status } = await c.req.json();
        const token = getAuthToken(c);
        const stub = getStub(c);
        const me = await stub.getMe(token);
        if (me.user) await stub.updatePresence(me.user.id, status);
        return c.json({ success: true });
    });
    app_.post('/api/conversations/:id/claim', enforceTenantContext, async (c: any) => {
        const tenantId = c.req.header('X-Tenant-ID');
        if (!tenantId) return c.json({ success: false, error: 'Tenant ID required' }, 400);
        const id = c.req.param('id');
        const token = getAuthToken(c);
        const stub = getStub(c);
        const me = await stub.getMe(token);
        if (!me.user) return c.json({ success: false, error: 'Unauthorized' }, 401);
        const data = await stub.claimConversation(me.user.id, id);
        return c.json({ success: !!data, data });
    });
    app_.post('/api/conversations/:id/end', enforceTenantContext, async (c: any) => {
        const tenantId = c.req.header('X-Tenant-ID');
        if (!tenantId) return c.json({ success: false, error: 'Tenant ID required' }, 400);
        const id = c.req.param('id');
        const stub = getStub(c);
        const data = await stub.endConversation(id);
        return c.json({ success: !!data, data });
    });
    app_.get('/api/conversations', enforceTenantContext, async (c: any) => {
        const tenantId = c.req.header('X-Tenant-ID');
        if (!tenantId) return c.json({ success: false, error: 'Tenant ID required' }, 400);
        const stub = getStub(c);
        const data = await stub.getConversations(tenantId);
        return c.json({ success: true, data });
    });
    app_.get('/api/queues', enforceTenantContext, async (c: any) => {
        const tenantId = c.req.header('X-Tenant-ID');
        if (!tenantId) return c.json({ success: false, error: 'Tenant ID required' }, 400);
        const stub = getStub(c);
        const data = await stub.getQueues(tenantId);
        return c.json({ success: true, data });
    });

    app_.post('/api/queues/:queueId/join', enforceTenantContext, async (c: any) => {
        const queueId = c.req.param('queueId');
        const token = getAuthToken(c);
        const stub = getStub(c);
        const me = await stub.getMe(token);
        if (me.user.role === 'superadmin') return c.json({ success: false, error: 'Forbidden' }, 403);
        await stub.joinQueue(me.user.id, queueId);
        return c.json({ success: true });
    });

    app_.post('/api/queues/:queueId/leave', enforceTenantContext, async (c: any) => {
        const queueId = c.req.param('queueId');
        const token = getAuthToken(c);
        const stub = getStub(c);
        const me = await stub.getMe(token);
        if (me.user.role === 'superadmin') return c.json({ success: false, error: 'Forbidden' }, 403);
        await stub.leaveQueue(me.user.id, queueId);
        return c.json({ success: true });
    });
    app_.get('/api/conversations/:id/messages', async (c: any) => {
        const id = c.req.param('id');
        const stub = getStub(c);
        const data = await stub.getMessages(id);
        return c.json({ success: true, data: data || [] });
    });
    app_.post('/api/conversations/:id/messages', async (c: any) => {
        const id = c.req.param('id');
        const body = await c.req.json();
        if (!body.content || typeof body.content !== 'string') {
            return c.json({ success: false, error: 'Content required' }, 400);
        }
        const token = getAuthToken(c);
        const stub = getStub(c);
        const conv = await stub.getConversationById(id);
        if (!conv) return c.json({ success: false, error: 'Conversation not found' }, 404);
        const me = token ? await stub.getMe(token) : null;
        const message: Message = {
            id: crypto.randomUUID(),
            conversationId: id,
            senderId: token && me?.user ? me.user.id : 'visitor',
            senderType: token && me?.user ? 'agent' : 'visitor',
            content: body.content,
            timestamp: Date.now()
        };
        const data = await stub.sendMessage(message, conv.tenantId);
        return c.json({ success: true, data });
    });
    // ADMIN CONFIG
    app_.put('/api/admin/settings', enforceTenantContext, async (c: any) => {
        const tenantId = c.req.header('X-Tenant-ID');
        if (!tenantId) return c.json({ success: false, error: 'Tenant ID required' }, 400);
        const settings = await c.req.json();
        const stub = getStub(c);
        await stub.updateTenantSettings(tenantId, settings);
        return c.json({ success: true });
    });
    app_.get('/api/admin/agents', enforceTenantContext, async (c: any) => {
        const tenantId = c.req.header('X-Tenant-ID');
        if (!tenantId) return c.json({ success: false, error: 'Tenant ID required' }, 400);
        const stub = getStub(c);
        const data = await stub.getUsers(tenantId, 'agent');
        const admins = await stub.getUsers(tenantId, 'tenant_admin');
        return c.json({ success: true, data: [...data, ...admins] });
    });
    app_.post('/api/admin/agents/invite', enforceTenantContext, async (c: any) => {
        const tenantId = c.req.header('X-Tenant-ID');
        if (!tenantId) return c.json({ success: false, error: 'Tenant ID required' }, 400);
        const { email, name } = await c.req.json();
        const stub = getStub(c);
        const data = await stub.upsertUser({ email, name, role: 'agent', tenantId });
        return c.json({ success: true, data });
    });
    app_.get('/api/internal/offline', enforceTenantContext, async (c: any) => {
        const tenantId = c.req.header('X-Tenant-ID');
        if (!tenantId) return c.json({ success: false, error: 'Tenant ID required' }, 400);
        const stub = getStub(c);
        const data = await stub.getOfflineRequests(tenantId);
        return c.json({ success: true, data });
    });
    app_.post('/api/internal/offline/:id/dispatch', enforceTenantContext, async (c: any) => {
        const id = c.req.param('id');
        const tenantId = c.req.header('X-Tenant-ID');
        if (!tenantId) return c.json({ success: false, error: 'Tenant ID required' }, 400);
        const stub = getStub(c);
        const ok = await stub.dispatchOfflineRequest(tenantId, id);
        return c.json({ success: ok });
    });
    app_.post('/api/seed', async (c: any) => {
        const stub = getStub(c);
        const ok = await stub.seedDatabase(c.req.query('prod') === 'true');
        return c.json({ success: true, data: ok ? "Reset complete" : "Skipped" });
    });
    app_.post('/api/auth/local/login', async (c: any) => {
        const { email } = await c.req.json();
        const stub = getStub(c);
        const data = await stub.login(email);
        return c.json({ success: !!data, data });
    });
}