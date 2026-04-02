import { Hono } from "hono";
import { Env } from './core-utils';
import type { ApiResponse, AuthPayload, Conversation, Message, PresenceStatus } from '@shared/types';
import { nanoid } from 'nanoid';
export function userRoutes(app: Hono<{ Bindings: Env }>) {
    app.post('/api/seed', async (c) => {
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        await stub.seedDatabase();
        return c.json({ success: true, data: "Database seeded" });
    });
    app.post('/api/auth/local/login', async (c) => {
        const { email } = await c.req.json();
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.login(email);
        if (!data) return c.json({ success: false, error: 'Invalid credentials' }, 401);
        return c.json({ success: true, data } as ApiResponse<AuthPayload>);
    });
    app.get('/api/auth/entra/mock', async (c) => {
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.login('admin@mercury.com');
        if (!data) return c.json({ success: false, error: 'Login failed' }, 500);
        return c.json({ success: true, data } as ApiResponse<AuthPayload>);
    });
    app.get('/api/auth/me', async (c) => {
        const authHeader = c.req.header('Authorization');
        if (!authHeader?.startsWith('Bearer ')) return c.json({ success: false, error: 'No token' }, 401);
        const token = authHeader.split(' ')[1];
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.getMe(token);
        if (!data) return c.json({ success: false, error: 'Session expired' }, 401);
        return c.json({ success: true, data } as ApiResponse<any>);
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
        return c.json({ success: true, data } as ApiResponse<Conversation[]>);
    });
    app.post('/api/conversations/:id/claim', async (c) => {
        const id = c.req.param('id');
        const authHeader = c.req.header('Authorization');
        const token = authHeader?.split(' ')[1] || '';
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const me = await stub.getMe(token);
        if (!me || !me.user.tenantId) return c.json({ success: false, error: 'Unauthorized' }, 401);
        const data = await stub.claimConversation(me.user.tenantId, id, me.user.id);
        return c.json({ success: true, data } as ApiResponse<Conversation>);
    });
    app.get('/api/conversations/:id/messages', async (c) => {
        const id = c.req.param('id');
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.getMessages(id);
        return c.json({ success: true, data } as ApiResponse<Message[]>);
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