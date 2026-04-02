import { Hono } from "hono";
import { Env } from './core-utils';
import type { ApiResponse, AuthPayload, Conversation, Message, User, Tenant } from '@shared/types';
import { nanoid } from 'nanoid';
type HonoApp = Hono<{ Bindings: Env }>;
export function userRoutes(app: HonoApp) {
    const getTenantId = (c: any) => c.req.header('X-Tenant-ID');
    // PUBLIC
    app.get('/api/public/config/:siteKey', async (c) => {
        const siteKey = c.req.param('siteKey');
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.getPublicConfig(siteKey);
        if (!data) return c.json({ success: false, error: 'Site not found' } as ApiResponse<any>, 404);
        return c.json({ success: true, data } as ApiResponse<any>);
    });
    app.post('/api/public/conversations', async (c) => {
        const { siteKey, queueId, name, email } = await c.req.json();
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.createVisitorConversation(siteKey, queueId, { name, email });
        return c.json({ success: !!data, data, error: !data ? 'Queue capacity reached or invalid' : undefined } as ApiResponse<any>);
    });
    // INTERNAL ADMIN
    app.get('/api/admin/agents', async (c) => {
        const tenantId = getTenantId(c);
        if (!tenantId) return c.json({ success: false, error: 'Missing tenant context' } as ApiResponse<any>, 400);
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.getTenantAgents(tenantId);
        return c.json({ success: true, data } as ApiResponse<User[]>);
    });
    app.put('/api/admin/settings', async (c) => {
        const tenantId = getTenantId(c);
        const body = await c.req.json();
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.updateTenantSettings(tenantId, body);
        return c.json({ success: !!data, data } as ApiResponse<Tenant>);
    });
    // CONVERSATIONS & MESSAGING
    app.get('/api/conversations', async (c) => {
        const tenantId = getTenantId(c);
        if (!tenantId) return c.json({ success: false, error: 'Missing tenant context' } as ApiResponse<any>, 400);
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
        if (!me) return c.json({ success: false, error: 'Unauthorized' } as ApiResponse<any>, 401);
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
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.getMessages(id);
        return c.json({ success: true, data: data || [] } as ApiResponse<Message[]>);
    });
    // OTHER
    app.post('/api/seed', async (c) => {
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        await stub.seedDatabase();
        return c.json({ success: true, data: "Database seeded" });
    });
    app.post('/api/auth/local/login', async (c) => {
        const { email } = await c.req.json();
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.login(email);
        return c.json({ success: !!data, data } as ApiResponse<AuthPayload>);
    });
    app.get('/api/auth/me', async (c) => {
        const authHeader = c.req.header('Authorization');
        const token = authHeader?.split(' ')[1] || '';
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.getMe(token);
        return c.json({ success: !!data, data } as ApiResponse<any>);
    });
    app.get('/api/agent/metrics', async (c) => {
        const tenantId = getTenantId(c);
        if (!tenantId) return c.json({ success: false, error: 'Missing tenant context' } as ApiResponse<any>, 400);
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.getSystemMetrics(tenantId);
        return c.json({ success: true, data } as ApiResponse<any>);
    });
    app.get('/api/admin/stats', async (c) => {
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.getGlobalMetrics();
        return c.json({ success: true, data } as ApiResponse<any>);
    });
    app.get('/api/superadmin/tenants', async (c) => {
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.getAllTenants();
        return c.json({ success: true, data } as ApiResponse<any>);
    });
    app.post('/api/superadmin/tenants', async (c) => {
        const { name } = await c.req.json();
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.createTenant(name);
        return c.json({ success: true, data } as ApiResponse<any>);
    });
}