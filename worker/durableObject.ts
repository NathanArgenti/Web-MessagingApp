import { DurableObject } from "cloudflare:workers";
import type { User, Tenant, Queue, DemoItem } from '@shared/types';
export class GlobalDurableObject extends DurableObject {
    private async getStorage<T>(key: string): Promise<T | undefined> {
        return await this.ctx.storage.get<T>(key);
    }
    private async setStorage<T>(key: string, value: T): Promise<void> {
        await this.ctx.storage.put(key, value);
    }
    async seedDatabase(): Promise<boolean> {
        const tenants: Tenant[] = [
            {
                id: 't1',
                name: 'Acme Corp',
                siteKey: 'acme-123',
                branding: { primaryColor: '#06B6D4', welcomeMessage: 'Welcome to Acme Support!' }
            },
            {
                id: 't2',
                name: 'Globex',
                siteKey: 'globex-456',
                branding: { primaryColor: '#F38020', welcomeMessage: 'How can Globex help today?' }
            }
        ];
        const users: User[] = [
            { id: 'u1', email: 'admin@mercury.com', name: 'Global Admin', role: 'superadmin', isOnline: true },
            { id: 'u2', email: 'acme_admin@acme.com', name: 'Acme Admin', role: 'tenant_admin', tenantId: 't1', isOnline: true },
            { id: 'u3', email: 'agent1@acme.com', name: 'Acme Agent 1', role: 'agent', tenantId: 't1', isOnline: false }
        ];
        const queues: Queue[] = [
            { id: 'q1', tenantId: 't1', name: 'General Support' },
            { id: 'q2', tenantId: 't1', name: 'Sales' }
        ];
        await this.setStorage('tenants', tenants);
        await this.setStorage('users', users);
        await this.setStorage('queues', queues);
        return true;
    }
    async login(email: string): Promise<{ user: User; token: string; tenant?: Tenant } | null> {
        const users = (await this.getStorage<User[]>('users')) || [];
        const user = users.find(u => u.email === email);
        if (!user) return null;
        const tenants = (await this.getStorage<Tenant[]>('tenants')) || [];
        const tenant = tenants.find(t => t.id === user.tenantId);
        return {
            user,
            token: `mock-jwt-${user.id}-${Date.now()}`,
            tenant
        };
    }
    async getMe(token: string): Promise<{ user: User; tenant?: Tenant } | null> {
        const userId = token.split('-')[2];
        const users = (await this.getStorage<User[]>('users')) || [];
        const user = users.find(u => u.id === userId);
        if (!user) return null;
        const tenants = (await this.getStorage<Tenant[]>('tenants')) || [];
        const tenant = tenants.find(t => t.id === user.tenantId);
        return { user, tenant };
    }
    // Legacy Demo Methods
    async getCounterValue(): Promise<number> {
      return (await this.ctx.storage.get("counter_value")) || 0;
    }
    async increment(amount = 1): Promise<number> {
      let value: number = (await this.ctx.storage.get("counter_value")) || 0;
      value += amount;
      await this.ctx.storage.put("counter_value", value);
      return value;
    }
    async getDemoItems(): Promise<DemoItem[]> {
      return (await this.ctx.storage.get("demo_items")) || [];
    }
}