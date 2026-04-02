import { Hono } from "hono";
import { Env } from './core-utils';
import type { 
    ApiResponse, AuthPayload, Conversation, Message, PresenceStatus, 
    PublicConfig, Tenant, OfflineRequest, SystemMetrics, GlobalMetrics 
} from '@shared/types';
import { nanoid } from 'nanoid';
export function userRoutes(app: Hono<{ Bindings: Env }>) {
    // Middleware-like helper for tenant context
    const getTenantId = (c: any) => c.req.header('X-Tenant-ID');
    // PUBLIC ROUTES
    app.get('/api/public/config/:siteKey', async (c) => {
        const siteKey = c.req.param('siteKey');
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.getPublicConfig(siteKey);
        if (!data) return c.json({ success: false, error: 'Site not found' }, 404);
        return c.json({ success: true, data } as ApiResponse<PublicConfig>);
    });
    app.post('/api/public/conversations', async (c) => {
        const { siteKey, queueId, name, email } = await c.req.json();
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.createVisitorConversation(siteKey, queueId, { name, email });
        return c.json({ success: !!data, data } as ApiResponse<Conversation>);
    });
    app.post('/api/public/offline', async (c) => {
        const body = await c.req.json();
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.createOfflineRequest(body);
        return c.json({ success: true, data } as ApiResponse<OfflineRequest>);
    });
    // AGENT/ADMIN DASHBOARD ROUTES
    app.get('/api/internal/offline', async (c) => {
        const tenantId = getTenantId(c);
        if (!tenantId) return c.json({ success: false, error: 'Missing tenant context' }, 400);
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.getOfflineRequests(tenantId);
        return c.json({ success: true, data } as ApiResponse<OfflineRequest[]>);
    });
    app.post('/api/internal/offline/:id/dispatch', async (c) => {
        const id = c.req.param('id');
        const tenantId = getTenantId(c);
        const { agentName } = await c.req.json();
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const success = await stub.dispatchOfflineRequest(tenantId, id, agentName);
        return c.json({ success } as ApiResponse<boolean>);
    });
    app.get('/api/agent/metrics', async (c) => {
        const tenantId = getTenantId(c);
        if (!tenantId) return c.json({ success: false, error: 'Missing tenant context' }, 400);
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.getSystemMetrics(tenantId);
        return c.json({ success: true, data } as ApiResponse<SystemMetrics>);
    });
    app.get('/api/admin/stats', async (c) => {
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.getGlobalMetrics();
        return c.json({ success: true, data } as ApiResponse<GlobalMetrics>);
    });
    // LEGACY & AUTH
    app.get('/api/superadmin/tenants', async (c) => {
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.getAllTenants();
        return c.json({ success: true, data } as ApiResponse<Tenant[]>);
    });
    app.post('/api/superadmin/tenants', async (c) => {
        const { name } = await c.req.json();
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.createTenant(name);
        return c.json({ success: true, data } as ApiResponse<Tenant>);
    });
    app.get('/api/auth/me', async (c) => {
        const authHeader = c.req.header('Authorization');
        const token = authHeader?.split(' ')[1] || '';
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.getMe(token);
        return c.json({ success: !!data, data } as ApiResponse<any>);
    });
    app.post('/api/auth/local/login', async (c) => {
        const { email } = await c.req.json();
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.login(email);
        return c.json({ success: !!data, data } as ApiResponse<AuthPayload>);
    });
    app.get('/api/conversations', async (c) => {
        const tenantId = getTenantId(c);
        if (!tenantId) return c.json({ success: false, error: 'Missing tenant context' }, 400);
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.getConversations(tenantId);
        return c.json({ success: true, data: data || [] } as ApiResponse<Conversation[]>);
    });
    app.post('/api/conversations/:id/messages', async (c) => {
        const id = c.req.param('id');
        const body = await c.req.json();
        const authHeader = c.req.header('Authorization');
        const token = authHeader?.split(' ')[1] || '';
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const me = await stub.getMe(token);
        if (!me) return c.json({ success: false, error: 'Unauthorized' }, 401);
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
    app.post('/api/conversations/:id/claim', async (c) => {
        const id = c.req.param('id');
        const tenantId = getTenantId(c);
        const authHeader = c.req.header('Authorization');
        const token = authHeader?.split(' ')[1] || '';
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const me = await stub.getMe(token);
        if (!me) return c.json({ success: false, error: 'Unauthorized' }, 401);
        const data = await stub.claimConversation(tenantId, id, me.user.id);
        return c.json({ success: !!data, data } as ApiResponse<Conversation>);
    });
    app.post('/api/conversations/:id/end', async (c) => {
        const id = c.req.param('id');
        const tenantId = getTenantId(c);
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.endConversation(tenantId, id);
        return c.json({ success: !!data, data } as ApiResponse<Conversation>);
    });
    app.get('/api/conversations/:id/messages', async (c) => {
        const id = c.req.param('id');
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.getMessages(id);
        return c.json({ success: true, data: data || [] } as ApiResponse<Message[]>);
    });
    app.post('/api/seed', async (c) => {
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        await stub.seedDatabase();
        return c.json({ success: true, data: "Database seeded" });
    });
}