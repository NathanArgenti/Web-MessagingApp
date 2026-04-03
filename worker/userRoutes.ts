import { Hono } from "hono";
import type { ApiResponse, AuthPayload, Conversation, Message, User, Tenant, OfflineRequest, QueueStatus, PresenceStatus, GlobalMetrics, SystemMetrics } from '../shared/types';
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
            console.error(`[SECURITY] Tenant mismatch for user ${me.user.id}. Header: ${targetTenantId}, User: ${me.user.tenantId}`);
            return c.json({ success: false, error: 'Access denied: Tenant isolation violation' }, 403);
        }
        return await next();
    };
    // WIDGET LOADER SCRIPT
    app.get('/widget.js', (c) => {
        const url = new URL(c.req.url);
        const siteKey = url.searchParams.get('siteKey') || '';
        const origin = url.origin;
        const script = `
        (function() {
            var siteKey = "${siteKey}" || (function() {
                var scripts = document.getElementsByTagName('script');
                for (var i = 0; i < scripts.length; i++) {
                    if (scripts[i].src.indexOf('widget.js') !== -1) {
                        var url = new URL(scripts[i].src);
                        return url.searchParams.get('siteKey');
                    }
                }
                return '';
            })();
            if (!siteKey) {
                console.error('Mercury Messaging: Missing siteKey in widget script.');
                return;
            }
            var container = document.createElement('div');
            container.id = 'mercury-widget-root';
            container.style.position = 'fixed';
            container.style.bottom = '0';
            container.style.right = '0';
            container.style.zIndex = '999999';
            container.style.width = '400px';
            container.style.height = '600px';
            container.style.pointerEvents = 'none';
            document.body.appendChild(container);
            var iframe = document.createElement('iframe');
            iframe.src = "${origin}/widget-frame?siteKey=" + siteKey;
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = 'none';
            iframe.style.background = 'transparent';
            iframe.style.pointerEvents = 'all';
            iframe.setAttribute('allow', 'clipboard-read; clipboard-write');
            container.appendChild(iframe);
        })();
        `;
        return c.text(script, 200, { 'Content-Type': 'application/javascript' });
    });
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
    app.get('/api/auth/entra/mock', async (c) => {
        const stub = getStub(c);
        const data = await stub.login('admin@mercury.com');
        if (!data) return c.json({ success: false, error: 'SSO Simulation Failed' }, 500);
        return c.json({ success: true, data });
    });
    app.put('/api/presence', enforceTenantContext, async (c) => {
        const { status } = await c.req.json<{ status: PresenceStatus }>();
        const token = getAuthToken(c);
        const stub = getStub(c);
        const me = await stub.getMe(token);
        if (!me) return c.json({ success: false, error: 'Unauthorized' }, 401);
        await stub.updatePresence(me.user.id, status);
        return c.json({ success: true });
    });
    app.post('/api/conversations/:id/claim', enforceTenantContext, async (c) => {
        const id = c.req.param('id');
        const token = getAuthToken(c);
        const stub = getStub(c);
        const me = await stub.getMe(token);
        if (!me) return c.json({ success: false, error: 'Unauthorized' }, 401);
        const data = await stub.claimConversation(me.user.id, id);
        return c.json({ success: !!data, data });
    });
    app.post('/api/conversations/:id/end', enforceTenantContext, async (c) => {
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
    app.post('/api/agent/queues/join', enforceTenantContext, async (c) => {
        const { queueId } = await c.req.json();
        const token = getAuthToken(c);
        const stub = getStub(c);
        const me = await stub.getMe(token);
        if (!me) return c.json({ success: false, error: 'Unauthorized' }, 401);
        await stub.joinQueue(me.user.id, queueId);
        return c.json({ success: true });
    });
    app.post('/api/agent/queues/leave', enforceTenantContext, async (c) => {
        const { queueId } = await c.req.json();
        const token = getAuthToken(c);
        const stub = getStub(c);
        const me = await stub.getMe(token);
        if (!me) return c.json({ success: false, error: 'Unauthorized' }, 401);
        await stub.leaveQueue(me.user.id, queueId);
        return c.json({ success: true });
    });
    // MESSAGES (HARDENED)
    app.get('/api/conversations/:id/messages', async (c) => {
        const id = c.req.param('id');
        const token = getAuthToken(c);
        const stub = getStub(c);
        const targetTenantId = c.req.header('X-Tenant-ID');
        // Security: If internal user (token present), verify tenant context
        if (token) {
            const me = await stub.getMe(token);
            if (!me) return c.json({ success: false, error: 'Unauthorized' }, 401);
            if (me.user.role !== 'superadmin') {
                const conv = await stub.getConversationById(id);
                if (!conv || conv.tenantId !== me.user.tenantId) {
                    return c.json({ success: false, error: 'Access denied: Conversation isolation' }, 403);
                }
            }
        }
        const data = await stub.getMessages(id);
        return c.json({ success: true, data: data || [] });
    });
    app.post('/api/conversations/:id/messages', async (c) => {
        const id = c.req.param('id');
        const body = await c.req.json();
        const token = getAuthToken(c);
        const stub = getStub(c);
        const targetTenantId = c.req.header('X-Tenant-ID');
        let message: Message;
        let tenantId: string | undefined;
        if (token) {
            const me = await stub.getMe(token);
            if (!me) return c.json({ success: false, error: 'Unauthorized' }, 401);
            const conv = await stub.getConversationById(id);
            if (!conv) return c.json({ success: false, error: 'Conversation not found' }, 404);
            if (me.user.role !== 'superadmin' && me.user.tenantId !== conv.tenantId) {
                 return c.json({ success: false, error: 'Tenant context mismatch' }, 403);
            }
            tenantId = conv.tenantId;
            message = {
                id: crypto.randomUUID(),
                conversationId: id,
                senderId: me.user.id,
                senderType: 'agent',
                content: body.content,
                timestamp: Date.now()
            };
        } else {
            const conv = await stub.getConversationById(id);
            if (!conv) return c.json({ success: false, error: 'Conversation not found' }, 404);
            tenantId = conv.tenantId;
            message = {
                id: crypto.randomUUID(),
                conversationId: id,
                senderId: 'visitor',
                senderType: 'visitor',
                content: body.content,
                timestamp: Date.now()
            };
        }
        const data = await stub.sendMessage(message, tenantId);
        return c.json({ success: true, data });
    });
    // ADMIN & INTERNAL
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
    app.get('/api/internal/offline', enforceTenantContext, async (c) => {
        const tenantId = c.req.header('X-Tenant-ID');
        const stub = getStub(c);
        const data = await stub.getOfflineRequests(tenantId);
        return c.json({ success: true, data });
    });
    app.post('/api/internal/offline/:id/dispatch', enforceTenantContext, async (c) => {
        const id = c.req.param('id');
        const tenantId = c.req.header('X-Tenant-ID');
        const stub = getStub(c);
        const ok = await stub.dispatchOfflineRequest(tenantId, id);
        return c.json({ success: ok });
    });
    app.put('/api/admin/settings', enforceTenantContext, async (c) => {
        const tenantId = c.req.header('X-Tenant-ID');
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
    app.delete('/api/superadmin/users/:id', async (c) => {
        const id = c.req.param('id');
        const token = getAuthToken(c);
        const stub = getStub(c);
        const me = await stub.getMe(token);
        if (me?.user.role !== 'superadmin') return c.json({ success: false, error: 'Forbidden' }, 403);
        const ok = await stub.deleteUser(id);
        return c.json({ success: ok });
    });
    app.get('/api/admin/stats', async (c) => {
        const stub = getStub(c);
        const data = await stub.getGlobalMetrics();
        return c.json({ success: true, data });
    });
    app.get('/api/conversations', enforceTenantContext, async (c) => {
        const tenantId = c.req.header('X-Tenant-ID');
        const stub = getStub(c);
        const data = await stub.getConversations(tenantId!);
        return c.json({ success: true, data });
    });
    app.post('/api/seed', async (c) => {
        const isProd = c.req.query('prod') === 'true';
        const stub = getStub(c);
        const seeded = await stub.seedDatabase(isProd);
        return c.json({
            success: true,
            data: seeded ? "Database reset/initialized" : "Database already has data; production safety check prevented wipe"
        });
    });
    app.post('/api/auth/local/login', async (c) => {
        const { email } = await c.req.json();
        const stub = getStub(c);
        const data = await stub.login(email);
        return c.json({ success: !!data, data });
    });
}