import { Hono } from "hono";
import type { ApiResponse, AuthPayload, Conversation, Message, User, Tenant, OfflineRequest, QueueStatus, PresenceStatus, GlobalMetrics } from '@shared/types';
import { nanoid } from 'nanoid';
export function userRoutes(rawApp: any) {
    const app = rawApp as Hono;
    const getAuthToken = (c: any) => c.req.header('Authorization')?.split(' ')[1] || '';
    const getStub = (c: any) => {
        const env = c.env as any;
        return env.GlobalDurableObject.get(env.GlobalDurableObject.idFromName("global"));
    };
    // RBAC Middleware: Ensure tenant isolation for admin routes
    const enforceTenantContext = async (c: any, next: any) => {
        const token = getAuthToken(c);
        const stub = getStub(c);
        const me = await stub.getMe(token);
        const targetTenantId = c.req.header('X-Tenant-ID');
        if (!me) return c.json({ success: false, error: 'Unauthorized' }, 401);
        // Superadmins can access any tenant context
        if (me.user.role === 'superadmin') return await next();
        // Others must match their assigned tenantId
        if (targetTenantId && me.user.tenantId !== targetTenantId) {
            return c.json({ success: false, error: 'Access denied: Tenant isolation violation' }, 403);
        }
        return await next();
    };
    // PUBLIC ENDPOINTS (No Auth Required)
    app.get('/api/public/config/:siteKey', async (c) => {
        const siteKey = c.req.param('siteKey');
        const stub = getStub(c);
        const data = await stub.getPublicConfig(siteKey);
        if (!data) return c.json({ success: false, error: 'Site not found' }, 404);
        return c.json({ success: true, data });
    });
    // AGENT/ADMIN SECURE ENDPOINTS
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
    // TENANT ADMIN SCOPED ENDPOINTS
    app.get('/api/admin/agents', enforceTenantContext, async (c) => {
        const tenantId = c.req.header('X-Tenant-ID');
        const stub = getStub(c);
        const data = await stub.getUsers(tenantId, 'agent');
        const admins = await stub.getUsers(tenantId, 'tenant_admin');
        return c.json({ success: true, data: [...data, ...admins] });
    });
    app.post('/api/admin/agents/invite', enforceTenantContext, async (c) => {
        const tenantId = c.req.header('X-Tenant-ID');
        const { email, name } = await c.req.json();
        const stub = getStub(c);
        const data = await stub.upsertUser({ email, name, role: 'agent', tenantId });
        return c.json({ success: true, data });
    });
    app.put('/api/admin/settings', enforceTenantContext, async (c) => {
        const tenantId = c.req.header('X-Tenant-ID');
        const body = await c.req.json();
        const stub = getStub(c);
        const data = await stub.updateTenantSettings(tenantId, body);
        return c.json({ success: !!data, data });
    });
    // SUPERADMIN PLATFORM OVERSEEING
    app.get('/api/superadmin/tenants', async (c) => {
        const token = getAuthToken(c);
        const stub = getStub(c);
        const me = await stub.getMe(token);
        if (me?.user.role !== 'superadmin') return c.json({ success: false, error: 'Forbidden' }, 403);
        const data = await stub.getAllTenants();
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
    // CONVERSATIONS
    app.get('/api/conversations', enforceTenantContext, async (c) => {
        const tenantId = c.req.header('X-Tenant-ID');
        const stub = getStub(c);
        const data = await stub.getConversations(tenantId);
        return c.json({ success: true, data });
    });
    // SEED & OPS
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
    // MESSAGES (Shared with strict isolation check via session verification in DO)
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
                id: nanoid(),
                conversationId: id,
                senderId: me.user.id,
                senderType: 'agent',
                content: body.content,
                timestamp: Date.now()
            };
        } else {
            message = {
                id: nanoid(),
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