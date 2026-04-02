import { Hono } from "hono";
import { Env } from './core-utils';
import type { ApiResponse, AuthPayload, Conversation, Message, PresenceStatus, PublicConfig, Tenant } from '@shared/types';
import { nanoid } from 'nanoid';
export function userRoutes(app: Hono<{ Bindings: Env }>) {
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
    app.post('/api/public/messages', async (c) => {
        const { conversationId, content, visitorId } = await c.req.json();
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const message: Message = {
            id: nanoid(),
            conversationId,
            senderId: visitorId || 'anonymous',
            senderType: 'visitor',
            content,
            timestamp: Date.now()
        };
        const data = await stub.sendMessage(message);
        return c.json({ success: true, data } as ApiResponse<Message>);
    });
    // SUPERADMIN ROUTES
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
    // ADMIN ROUTES
    app.put('/api/admin/settings', async (c) => {
        const authHeader = c.req.header('Authorization');
        const token = authHeader?.split(' ')[1] || '';
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const me = await stub.getMe(token);
        if (!me || (me.user.role !== 'tenant_admin' && me.user.role !== 'superadmin')) {
            return c.json({ success: false, error: 'Unauthorized' }, 401);
        }
        const body = await c.req.json();
        const success = await stub.updateTenantSettings(me.user.tenantId || body.tenantId, body);
        return c.json({ success });
    });
    // AGENT ROUTES
    app.post('/api/conversations/:id/end', async (c) => {
        const id = c.req.param('id');
        const authHeader = c.req.header('Authorization');
        const token = authHeader?.split(' ')[1] || '';
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const me = await stub.getMe(token);
        if (!me || !me.user.tenantId) return c.json({ success: false, error: 'Unauthorized' }, 401);
        const data = await stub.endConversation(me.user.tenantId, id);
        return c.json({ success: !!data, data } as ApiResponse<Conversation>);
    });
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
    app.get('/api/auth/entra/mock', async (c) => {
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.login('admin@mercury.com');
        return c.json({ success: !!data, data } as ApiResponse<AuthPayload>);
    });
    app.get('/api/auth/me', async (c) => {
        const authHeader = c.req.header('Authorization');
        const token = authHeader?.split(' ')[1] || '';
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.getMe(token);
        return c.json({ success: !!data, data } as ApiResponse<any>);
    });
    app.put('/api/presence', async (c) => {
        const { status } = await c.req.json<{ status: PresenceStatus }>();
        const authHeader = c.req.header('Authorization');
        const token = authHeader?.split(' ')[1] || '';
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const me = await stub.getMe(token);
        if (!me) return c.json({ success: false, error: 'Unauthorized' }, 401);
        await stub.updatePresence(me.user.id, status);
        return c.json({ success: true });
    });
    app.get('/api/conversations', async (c) => {
        const authHeader = c.req.header('Authorization');
        const token = authHeader?.split(' ')[1] || '';
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const me = await stub.getMe(token);
        if (!me || !me.user.tenantId) return c.json({ success: false, error: 'Unauthorized' }, 401);
        const data = await stub.getConversations(me.user.tenantId);
        return c.json({ success: true, data: data || [] } as ApiResponse<Conversation[]>);
    });
    app.post('/api/conversations/:id/claim', async (c) => {
        const id = c.req.param('id');
        const authHeader = c.req.header('Authorization');
        const token = authHeader?.split(' ')[1] || '';
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const me = await stub.getMe(token);
        if (!me || !me.user.tenantId) return c.json({ success: false, error: 'Unauthorized' }, 401);
        const data = await stub.claimConversation(me.user.tenantId, id, me.user.id);
        return c.json({ success: !!data, data } as ApiResponse<Conversation>);
    });
    app.get('/api/conversations/:id/messages', async (c) => {
        const id = c.req.param('id');
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.getMessages(id);
        return c.json({ success: true, data: data || [] } as ApiResponse<Message[]>);
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
}