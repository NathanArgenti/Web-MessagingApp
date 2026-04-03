import { Hono } from "hono";
import type { ApiResponse, Conversation, Message, PresenceStatus } from '../shared/types';
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
        if (!targetTenantId || me.user.tenantId !== targetTenantId) {
            return c.json({ success: false, error: 'Tenant isolation violation' }, 403);
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
    app.get('/api/public/conversations/:id/status', async (c) => {
        const id = c.req.param('id');
        const stub = getStub(c);
        const conv = await stub.getConversationById(id);
        const ended = conv ? conv.status === 'ended' : true;
        return c.json({ success: true, data: { status: conv?.status || 'ended', ended } });
    });
    // AUTH & AGENT ENDPOINTS
    app.get('/api/auth/me', async (c) => {
        const token = getAuthToken(c);
        const stub = getStub(c);
        const data = await stub.getMe(token);
        return c.json({ success: !!data, data });
    });
    app.get('/api/admin/events', enforceTenantContext, async (c) => {
        const tenantId = c.req.header('X-Tenant-ID')!;
        const stub = getStub(c);
        const data = await stub.getEvents(tenantId);
        return c.json({ success: true, data });
    });
    app.put('/api/presence', enforceTenantContext, async (c) => {
        const { status } = await c.req.json<{ status: PresenceStatus }>();
        const token = getAuthToken(c);
        const stub = getStub(c);
        const me = await stub.getMe(token);
        if (me) await stub.updatePresence(me.user.id, status);
        return c.json({ success: true });
    });
    app.post('/api/conversations/:id/claim', enforceTenantContext, async (c) => {
        const id = c.req.param('id');
        const token = getAuthToken(c);
        const stub = getStub(c);
        const me = await stub.getMe(token);
        const data = await stub.claimConversation(me.user.id, id);
        return c.json({ success: !!data, data });
    });
    app.post('/api/conversations/:id/end', enforceTenantContext, async (c) => {
        const id = c.req.param('id');
        const stub = getStub(c);
        const data = await stub.endConversation(id);
        return c.json({ success: !!data, data });
    });
    app.get('/api/conversations', enforceTenantContext, async (c) => {
        const tenantId = c.req.header('X-Tenant-ID')!;
        const stub = getStub(c);
        const data = await stub.getConversations(tenantId);
        return c.json({ success: true, data });
    });
    app.get('/api/queues', enforceTenantContext, async (c) => {
        const tenantId = c.req.header('X-Tenant-ID')!;
        const stub = getStub(c);
        const data = await stub.getQueues(tenantId);
        return c.json({ success: true, data });
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
        const conv = await stub.getConversationById(id);
        if (!conv) return c.json({ success: false, error: 'Conversation not found' }, 404);
        const message = {
            id: crypto.randomUUID(),
            conversationId: id,
            senderId: token ? (await stub.getMe(token)).user.id : 'visitor',
            senderType: token ? 'agent' : 'visitor',
            content: body.content,
            timestamp: Date.now()
        };
        const data = await stub.sendMessage(message, conv.tenantId);
        return c.json({ success: true, data });
    });
    // ADMIN CONFIG
    app.put('/api/admin/settings', enforceTenantContext, async (c) => {
        const tenantId = c.req.header('X-Tenant-ID')!;
        const settings = await c.req.json<any>();
        const stub = getStub(c);
        await stub.updateTenantSettings(tenantId, settings);
        return c.json({ success: true });
    });
    app.get('/api/admin/agents', enforceTenantContext, async (c) => {
        const tenantId = c.req.header('X-Tenant-ID')!;
        const stub = getStub(c);
        const data = await stub.getUsers(tenantId, 'agent');
        const admins = await stub.getUsers(tenantId, 'tenant_admin');
        return c.json({ success: true, data: [...data, ...admins] });
    });
    app.post('/api/admin/agents/invite', enforceTenantContext, async (c) => {
        const tenantId = c.req.header('X-Tenant-ID')!;
        const { email, name } = await c.req.json();
        const stub = getStub(c);
        const data = await stub.upsertUser({ email, name, role: 'agent', tenantId });
        return c.json({ success: true, data });
    });
    app.get('/api/internal/offline', enforceTenantContext, async (c) => {
        const tenantId = c.req.header('X-Tenant-ID')!;
        const stub = getStub(c);
        const data = await stub.getOfflineRequests(tenantId);
        return c.json({ success: true, data });
    });
    app.post('/api/internal/offline/:id/dispatch', enforceTenantContext, async (c) => {
        const id = c.req.param('id');
        const tenantId = c.req.header('X-Tenant-ID')!;
        const stub = getStub(c);
        const ok = await stub.dispatchOfflineRequest(tenantId, id);
        return c.json({ success: ok });
    });
    app.post('/api/seed', async (c) => {
        const stub = getStub(c);
        const ok = await stub.seedDatabase(c.req.query('prod') === 'true');
        return c.json({ success: true, data: ok ? "Reset complete" : "Skipped" });
    });
    app.post('/api/auth/local/login', async (c) => {
        const { email } = await c.req.json();
        const stub = getStub(c);
        const data = await stub.login(email);
        return c.json({ success: !!data, data });
    });
}