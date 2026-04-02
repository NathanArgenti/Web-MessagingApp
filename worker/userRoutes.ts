import { Hono } from "hono";
import { Env } from './core-utils';
import type { ApiResponse, AuthPayload } from '@shared/types';
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
        if (!data) {
            return c.json({ success: false, error: 'Invalid credentials' }, 401);
        }
        return c.json({ success: true, data } satisfies ApiResponse<AuthPayload>);
    });
    app.get('/api/auth/entra/mock', async (c) => {
        // Simulating a redirect or SSO callback
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.login('admin@mercury.com');
        return c.json({ success: true, data } satisfies ApiResponse<AuthPayload>);
    });
    app.get('/api/auth/me', async (c) => {
        const authHeader = c.req.header('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return c.json({ success: false, error: 'No token' }, 401);
        }
        const token = authHeader.split(' ')[1];
        const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
        const data = await stub.getMe(token);
        if (!data) return c.json({ success: false, error: 'Session expired' }, 401);
        return c.json({ success: true, data } satisfies ApiResponse<any>);
    });
}