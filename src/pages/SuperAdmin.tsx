import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiResponse, Tenant, User, UserRole } from '@shared/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Plus, Globe, Shield, Activity, Search, Users as UsersIcon, Trash2, UserPlus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
export function SuperAdmin() {
  const queryClient = useQueryClient();
  const [newTenantName, setNewTenantName] = useState('');
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  // Queries
  const { data: tenants = [], isLoading: loadingTenants } = useQuery({
    queryKey: ['superadmin', 'tenants'],
    queryFn: async () => {
      const res = await fetch('/api/superadmin/tenants');
      const json = await res.json() as ApiResponse<Tenant[]>;
      return json.data ?? [];
    }
  });
  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['superadmin', 'users'],
    queryFn: async () => {
      const res = await fetch('/api/superadmin/users');
      const json = await res.json() as ApiResponse<User[]>;
      return json.data ?? [];
    }
  });
  // Mutations
  const createTenantMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch('/api/superadmin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'tenants'] });
      setNewTenantName('');
      toast.success('Tenant created successfully');
    }
  });
  const createUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      const res = await fetch('/api/superadmin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'users'] });
      setIsUserModalOpen(false);
      toast.success('User provisioned successfully');
    }
  });
  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/superadmin/users/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'users'] });
      toast.success('User deleted');
    }
  });
  const stats = [
    { label: 'Total Tenants', value: tenants.length, icon: Globe, color: 'text-cyan-600' },
    { label: 'Platform Users', value: users.length, icon: UsersIcon, color: 'text-indigo-600' },
    { label: 'Platform Health', value: '100%', icon: Shield, color: 'text-green-600' }
  ];
  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10 lg:py-12">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Platform Oversight</h1>
            <p className="text-muted-foreground">Global management for all Mercury tenants and users.</p>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {stats.map((s) => (
            <Card key={s.label}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{s.label}</p>
                    <h3 className="text-2xl font-bold mt-1">{s.value}</h3>
                  </div>
                  <div className={`p-3 rounded-xl bg-slate-50 ${s.color}`}>
                    <s.icon className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Tabs defaultValue="tenants" className="space-y-6">
          <TabsList className="bg-slate-100 p-1">
            <TabsTrigger value="tenants" className="gap-2"><Globe className="w-4 h-4" /> Tenants</TabsTrigger>
            <TabsTrigger value="users" className="gap-2"><UsersIcon className="w-4 h-4" /> Users</TabsTrigger>
          </TabsList>
          <TabsContent value="tenants">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>Tenants</CardTitle>
                  <CardDescription>Manage multi-tenant logical isolation and sites.</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Tenant Name"
                    className="w-48"
                    value={newTenantName}
                    onChange={(e) => setNewTenantName(e.target.value)}
                  />
                  <Button className="bg-slate-900 gap-2" onClick={() => createTenantMutation.mutate(newTenantName)} disabled={!newTenantName}>
                    <Plus className="w-4 h-4" /> Create Tenant
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tenant Name</TableHead>
                      <TableHead>Default Site Key</TableHead>
                      <TableHead>Queues</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingTenants ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-10">Loading tenants...</TableCell></TableRow>
                    ) : (tenants ?? []).map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell className="font-mono text-xs">{t.sites?.[0]?.key || 'None'}</TableCell>
                        <TableCell>{t.queues?.length ?? 0} active</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Active</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">Manage</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="users">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>Platform Users</CardTitle>
                  <CardDescription>Provision agents and administrators across all tenants.</CardDescription>
                </div>
                <Dialog open={isUserModalOpen} onOpenChange={setIsUserModalOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-slate-900 gap-2">
                      <UserPlus className="w-4 h-4" /> Provision User
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Provision New User</DialogTitle>
                    </DialogHeader>
                    <form className="space-y-4 py-4" onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      createUserMutation.mutate(Object.fromEntries(formData));
                    }}>
                      <div className="space-y-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input id="name" name="name" required placeholder="John Doe" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input id="email" name="email" type="email" required placeholder="john@example.com" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="role">Role</Label>
                          <Select name="role" defaultValue="agent">
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="agent">Agent</SelectItem>
                              <SelectItem value="tenant_admin">Tenant Admin</SelectItem>
                              <SelectItem value="superadmin">Super Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="tenantId">Tenant Assignment</Label>
                          <Select name="tenantId">
                            <SelectTrigger><SelectValue placeholder="Select Tenant" /></SelectTrigger>
                            <SelectContent>
                              {tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter className="pt-4">
                        <Button type="submit" disabled={createUserMutation.isPending}>
                          {createUserMutation.isPending ? 'Provisioning...' : 'Provision User'}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingUsers ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-10">Loading users...</TableCell></TableRow>
                    ) : (users ?? []).map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="font-medium">{u.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{u.email}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {u.role.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {tenants.find(t => t.id === u.tenantId)?.name || <span className="text-muted-foreground italic">None (Global)</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={u.isActive ? 'default' : 'secondary'} className={u.isActive ? 'bg-cyan-500' : ''}>
                            {u.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteUserMutation.mutate(u.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}