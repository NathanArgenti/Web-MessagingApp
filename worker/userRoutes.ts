import { Hono } from "hono";
import { Env } from './core-utils';
import type { ApiResponse, AuthPayload, Conversation, Message, User, Tenant, OfflineRequest, QueueStatus, PresenceStatus } from '@shared/types';
import { nanoid } from 'nanoid';
export function userRoutes(rawApp: any) {
    const app = rawApp as Hono;
    const getAuthToken = (c: any) => c.req.header('Authorization')?.split(' ')[1] || '';
    const getStub = (c: any) => {
        const env = c.env as any;
        return env.GlobalDurableObject.get(env.GlobalDurableObject.idFromName("global"));
    };
    // PUBLIC
    app.get('/api/public/config/:siteKey', async (c) => {
        const siteKey = c.req.param('siteKey');
        const stub = getStub(c);
        const data = await stub.getPublicConfig(siteKey);
        if (!data) return c.json({ success: false, error: 'Site not found' } as ApiResponse<any>, 404);
        return c.json({ success: true, data } as ApiResponse<any>);
    });
    app.get('/api/public/queue/:queueId/status', async (c) => {
        const queueId = c.req.param('queueId');
        const tenantId = c.req.query('tenantId');
        if (!tenantId) return c.json({ success: false, error: 'Missing tenantId' }, 400);
        const stub = getStub(c);
        const data = await stub.getQueueStatus(tenantId, queueId);
        return c.json({ success: true, data } as ApiResponse<QueueStatus>);
    });
    app.post('/api/public/offline', async (c) => {
        const body = await c.req.json();
        const { tenantId, ...leadData } = body;
        if (!tenantId) return c.json({ success: false, error: 'Missing tenantId' }, 400);
        const stub = getStub(c);
        const data = await stub.createOfflineRequest(tenantId, leadData);
        return c.json({ success: true, data } as ApiResponse<OfflineRequest>);
    });
    app.post('/api/public/conversations', async (c) => {
        const { siteKey, queueId, name, email } = await c.req.json();
        const stub = getStub(c);
        const data = await stub.createVisitorConversation(siteKey, queueId, { name, email });
        return c.json({ success: !!data, data, error: !data ? 'Queue capacity reached or invalid' : undefined } as ApiResponse<any>);
    });
    // AGENT CONTROLS
    app.put('/api/presence', async (c) => {
        const { status } = await c.req.json<{ status: PresenceStatus }>();
        const token = getAuthToken(c);
        const stub = getStub(c);
        const me = await stub.getMe(token);
        if (!me || !me.user) return c.json({ success: false, error: 'Unauthorized' }, 401);
        await stub.updatePresence(me.user.id, status);
        return c.json({ success: true });
    });
    app.post('/api/agent/queues/:action', async (c) => {
        const action = c.req.param('action') as 'join' | 'leave';
        const { queueId } = await c.req.json();
        const token = getAuthToken(c);
        const stub = getStub(c);
        const me = await stub.getMe(token);
        if (!me || !me.user.tenantId) return c.json({ success: false, error: 'Unauthorized' }, 401);
        const success = await stub.toggleQueueMembership(me.user.id, me.user.tenantId, queueId, action);
        return c.json({ success } as ApiResponse<boolean>);
    });
    // INTERNAL ADMIN
    app.get('/api/admin/agents', async (c) => {
        const tenantId = c.req.header('X-Tenant-ID');
        if (!tenantId) return c.json({ success: false, error: 'Missing tenant context' }, 400);
        const stub = getStub(c);
        const data = await stub.getUsers(tenantId, 'agent');
        const admins = await stub.getUsers(tenantId, 'tenant_admin');
        return c.json({ success: true, data: [...data, ...admins] } as ApiResponse<User[]>);
    });
    app.post('/api/admin/agents/invite', async (c) => {
        const tenantId = c.req.header('X-Tenant-ID');
        const { email, name } = await c.req.json();
        const stub = getStub(c);
        const data = await stub.upsertUser({ email, name, role: 'agent', tenantId });
        return c.json({ success: true, data } as ApiResponse<User>);
    });
    app.put('/api/admin/settings', async (c) => {
        const tenantId = c.req.header('X-Tenant-ID');
        const body = await c.req.json();
        const stub = getStub(c);
        const data = await stub.updateTenantSettings(tenantId, body);
        return c.json({ success: !!data, data } as ApiResponse<Tenant>);
    });
    app.get('/api/internal/offline', async (c) => {
        const tenantId = c.req.header('X-Tenant-ID');
        if (!tenantId) return c.json({ success: false, error: 'Missing tenant' }, 400);
        const stub = getStub(c);
        const data = await stub.getOfflineRequests(tenantId);
        return c.json({ success: true, data } as ApiResponse<OfflineRequest[]>);
    });

    app.post('/api/internal/offline/:id/dispatch', async (c) => {
        const id = c.req.param('id');
        const token = getAuthToken(c);
        const stub = getStub(c);
        const me = await stub.getMe(token);
        if (!me || !me.user || !me.user.tenantId) return c.json({ success: false, error: 'Unauthorized' } as ApiResponse<null>, 401);
        const tenantId = c.req.header('X-Tenant-ID') || me.user.tenantId;
        const data = await stub.dispatchOfflineRequest(tenantId, id, me.user.id);
        return c.json({ success: !!data, data } as ApiResponse<OfflineRequest>);
    });
    // SUPERADMIN
    app.get('/api/superadmin/users', async (c) => {
        const stub = getStub(c);
        const data = await stub.getUsers();
        return c.json({ success: true, data } as ApiResponse<User[]>);
    });
    app.post('/api/superadmin/users', async (c) => {
        const body = await c.req.json();
        const stub = getStub(c);
        const data = await stub.upsertUser(body);
        return c.json({ success: true, data } as ApiResponse<User>);
    });
    app.delete('/api/superadmin/users/:id', async (c) => {
        const id = c.req.param('id');
        const stub = getStub(c);
        const success = await stub.deleteUser(id);
        return c.json({ success } as ApiResponse<boolean>);
    });
    // CONVERSATIONS & MESSAGING
    app.get('/api/conversations', async (c) => {
        const tenantId = c.req.header('X-Tenant-ID');
        const token = getAuthToken(c);
        const stub = getStub(c);
        const me = await stub.getMe(token);
        const finalTenantId = tenantId || me?.user.tenantId;
        if (!finalTenantId) return c.json({ success: false, error: 'Missing tenant context' }, 400);
        const data = await stub.getConversations(finalTenantId);
        return c.json({ success: true, data: data || [] } as ApiResponse<Conversation[]>);
    });
    app.post('/api/conversations/:id/claim', async (c) => {
        const id = c.req.param('id');
        const token = getAuthToken(c);
        const stub = getStub(c);
        const me = await stub.getMe(token);
        if (!me || !me.user.tenantId) return c.json({ success: false, error: 'Unauthorized' }, 401);
        const data = await stub.claimConversation(me.user.tenantId, id, me.user.id);
        return c.json({ success: !!data, data } as ApiResponse<Conversation>);
    });
    app.post('/api/conversations/:id/end', async (c) => {
        const id = c.req.param('id');
        const token = getAuthToken(c);
        const stub = getStub(c);
        const me = await stub.getMe(token);
        if (!me || !me.user.tenantId) return c.json({ success: false, error: 'Unauthorized' }, 401);
        const data = await stub.endConversation(me.user.tenantId, id);
        return c.json({ success: !!data, data } as ApiResponse<Conversation>);
    });
    app.post('/api/conversations/:id/messages', async (c) => {
        const id = c.req.param('id');
        const body = await c.req.json();
        const token = getAuthToken(c);
        const stub = getStub(c);
        const me = await stub.getMe(token);
        if (!me || !me.user || !body?.content) return c.json({ success: false, error: 'Unauthorized or missing content' }, 401);
        const message: Message = {
            id: nanoid(),
            conversationId: id,
            senderId: me.user.id,
            senderType: 'agent',
            content: body.content,
            timestamp: Date.now()
        };
        const data = await stub.sendMessage(message);
        return c.json({ success: true, data } as ApiResponse<Message>);
    });
    app.get('/api/conversations/:id/messages', async (c) => {
        const id = c.req.param('id');
        const stub = getStub(c);
        const data = await stub.getMessages(id);
        return c.json({ success: true, data: data || [] } as ApiResponse<Message[]>);
    });
    // AUTH & OPS
    app.post('/api/seed', async (c) => {
        const stub = getStub(c);
        await stub.seedDatabase();
        return c.json({ success: true, data: "Database seeded" });
    });
    app.post('/api/auth/local/login', async (c) => {
        const { email } = await c.req.json();
        const stub = getStub(c);
        const data = await stub.login(email);
        return c.json({ success: !!data, data } as ApiResponse<AuthPayload>);
    });
    app.get('/api/auth/me', async (c) => {
        const token = getAuthToken(c);
        const stub = getStub(c);
        const data = await stub.getMe(token);
        return c.json({ success: !!data, data } as ApiResponse<any>);
    });
    app.get('/api/agent/metrics', async (c) => {
        const tenantId = c.req.header('X-Tenant-ID');
        const stub = getStub(c);
        const token = getAuthToken(c);
        const me = await stub.getMe(token);
        const finalTenantId = tenantId || me?.user.tenantId;
        if (!finalTenantId) return c.json({ success: false, error: 'Missing tenant context' }, 400);
        const data = await stub.getSystemMetrics(finalTenantId);
        return c.json({ success: true, data } as ApiResponse<any>);
    });
    app.get('/api/admin/stats', async (c) => {
        const stub = getStub(c);
        const data = await stub.getGlobalMetrics();
        return c.json({ success: true, data } as ApiResponse<any>);
    });
    app.get('/api/superadmin/tenants', async (c) => {
        const stub = getStub(c);
        const data = await stub.getAllTenants();
        return c.json({ success: true, data } as ApiResponse<any>);
    });
    app.post('/api/superadmin/tenants', async (c) => {
        const { name } = await c.req.json();
        const stub = getStub(c);
        const data = await stub.createTenant(name);
        return c.json({ success: true, data } as ApiResponse<any>);
    });
}