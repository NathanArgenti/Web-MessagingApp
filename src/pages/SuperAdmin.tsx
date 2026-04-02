import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiResponse, Tenant, User, GlobalMetrics } from '@shared/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Plus, Globe, Shield, Activity, Users as UsersIcon, Trash2, UserPlus, Database, ExternalLink, AlertTriangle, ShieldCheck, History } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from "@/lib/utils";
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/store';
export function SuperAdmin() {
  const queryClient = useQueryClient();
  const token = useAuthStore(s => s.token);
  const setSelectedTenantId = useAuthStore(s => s.setSelectedTenantId);
  const [newTenantName, setNewTenantName] = useState('');
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState('');
  // Queries
  const { data: tenants = [] } = useQuery({
    queryKey: ['superadmin', 'tenants'],
    queryFn: async () => {
      const res = await fetch('/api/superadmin/tenants', { headers: { 'Authorization': `Bearer ${token}` } });
      const json = await res.json() as ApiResponse<Tenant[]>;
      return json.data ?? [];
    },
    enabled: !!token
  });
  const { data: users = [] } = useQuery({
    queryKey: ['superadmin', 'users'],
    queryFn: async () => {
      const res = await fetch('/api/superadmin/users', { headers: { 'Authorization': `Bearer ${token}` } });
      const json = await res.json() as ApiResponse<User[]>;
      return json.data ?? [];
    },
    enabled: !!token
  });
  const { data: metrics } = useQuery({
    queryKey: ['superadmin', 'health'],
    queryFn: async () => {
      const res = await fetch('/api/admin/stats', { headers: { 'Authorization': `Bearer ${token}` } });
      const json = await res.json() as ApiResponse<GlobalMetrics>;
      return json.data;
    },
    refetchInterval: 30000,
    enabled: !!token
  });
  // Mutations
  const createTenantMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch('/api/superadmin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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
      const res = await fetch(`/api/superadmin/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Delete failed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin', 'users'] });
      toast.success('User deleted');
    }
  });
  const seedMutation = useMutation({
    mutationFn: async (prod: boolean) => {
      const res = await fetch(`/api/seed?prod=${prod}`, { 
        method: 'POST', 
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      return await res.json();
    },
    onSuccess: (json) => {
      toast.success(json.data || 'Platform maintenance task completed');
      queryClient.invalidateQueries();
      setIsResetModalOpen(false);
      setResetConfirmation('');
    }
  });
  const stats = [
    { label: 'Total Tenants', value: tenants.length, icon: Globe, color: 'text-cyan-600', bg: 'bg-cyan-50' },
    { label: 'Platform Users', value: users.length, icon: UsersIcon, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Total Traffic', value: metrics?.totalMessages?.toLocaleString() || '0', icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50' }
  ];
  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10 lg:py-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Platform Oversight</h1>
            <p className="text-muted-foreground text-sm">Global control plane for tenants, users, and infrastructure health.</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="gap-2 border-cyan-200 text-cyan-700 hover:bg-cyan-50"
              onClick={() => seedMutation.mutate(true)}
              disabled={seedMutation.isPending}
            >
              <ShieldCheck className="w-4 h-4" /> Safe Initialize
            </Button>
            <Dialog open={isResetModalOpen} onOpenChange={setIsResetModalOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2 border-rose-200 text-rose-700 hover:bg-rose-50">
                  <Database className="w-4 h-4" /> Factory Reset
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="text-rose-600 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" /> Dangerous Operation
                  </DialogTitle>
                  <CardDescription>
                    This will permanently delete ALL data including tenants, users, and conversation history. This cannot be undone.
                  </CardDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                  <div className="p-3 bg-rose-50 rounded-lg border border-rose-100 text-rose-900 text-xs font-medium">
                    Type <strong>RESET</strong> below to confirm.
                  </div>
                  <Input 
                    value={resetConfirmation} 
                    onChange={e => setResetConfirmation(e.target.value)}
                    placeholder="Type RESET here"
                    className="border-rose-200 focus-visible:ring-rose-500"
                  />
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setIsResetModalOpen(false)}>Cancel</Button>
                  <Button 
                    variant="destructive" 
                    disabled={resetConfirmation !== 'RESET' || seedMutation.isPending}
                    onClick={() => seedMutation.mutate(false)}
                  >
                    Confirm Wipe & Reset
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {stats.map((s) => (
            <Card key={s.label} className="border-none shadow-sm bg-white overflow-hidden ring-1 ring-slate-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{s.label}</p>
                    <h3 className="text-3xl font-bold mt-1 text-slate-900">{s.value}</h3>
                  </div>
                  <div className={`p-4 rounded-2xl ${s.bg} ${s.color}`}>
                    <s.icon className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Tabs defaultValue="tenants" className="space-y-6">
          <TabsList className="bg-slate-100 p-1 rounded-xl">
            <TabsTrigger value="tenants" className="gap-2 rounded-lg px-6"><Globe className="w-4 h-4" /> Tenants</TabsTrigger>
            <TabsTrigger value="users" className="gap-2 rounded-lg px-6"><UsersIcon className="w-4 h-4" /> Users</TabsTrigger>
            <TabsTrigger value="health" className="gap-2 rounded-lg px-6"><Activity className="w-4 h-4" /> Platform Health</TabsTrigger>
          </TabsList>
          <TabsContent value="tenants" className="space-y-6">
            <Card className="border-none shadow-sm ring-1 ring-slate-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b">
                <div>
                  <CardTitle className="text-lg">Tenant Directory</CardTitle>
                  <CardDescription>Manage multi-tenant logical isolation and sites.</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="New Tenant Name"
                    className="w-48 bg-slate-50"
                    value={newTenantName}
                    onChange={(e) => setNewTenantName(e.target.value)}
                  />
                  <Button className="bg-slate-900 hover:bg-slate-800 gap-2" onClick={() => createTenantMutation.mutate(newTenantName)} disabled={!newTenantName}>
                    <Plus className="w-4 h-4" /> Create
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50">
                      <TableHead className="w-[300px]">Tenant Name</TableHead>
                      <TableHead>Default Site Key</TableHead>
                      <TableHead>Queues</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right px-6">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(tenants ?? []).map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-bold text-slate-800 py-4">{t.name}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{t.sites?.[0]?.key || 'No Sites'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-slate-100">{t.queues?.length ?? 0} active</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span className="text-xs font-medium">Provisioned</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right px-6">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 h-8"
                            onClick={() => {
                              setSelectedTenantId(t.id);
                              toast.info(`Switched context to ${t.name}`);
                            }}
                          >
                            <ExternalLink className="w-3 h-3" /> Manage
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="users" className="space-y-6">
            <Card className="border-none shadow-sm ring-1 ring-slate-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b">
                <div>
                  <CardTitle className="text-lg">User Provisioning</CardTitle>
                  <CardDescription>Assign agents and administrators across any tenant.</CardDescription>
                </div>
                <Dialog open={isUserModalOpen} onOpenChange={setIsUserModalOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-slate-900 gap-2">
                      <UserPlus className="w-4 h-4" /> Provision User
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                      <DialogTitle>Provision New User</DialogTitle>
                      <CardDescription>Users can be assigned to a specific tenant or kept as global admins.</CardDescription>
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
                            <SelectTrigger><SelectValue placeholder="No assignment" /></SelectTrigger>
                            <SelectContent>
                              {tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter className="pt-6">
                        <Button type="submit" className="w-full bg-slate-900" disabled={createUserMutation.isPending}>
                          {createUserMutation.isPending ? 'Provisioning...' : 'Complete Provisioning'}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50">
                      <TableHead className="px-6">Identity</TableHead>
                      <TableHead>Access Role</TableHead>
                      <TableHead>Tenant Assignment</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right px-6">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(users ?? []).map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="px-6 py-4">
                          <div className="font-bold text-slate-800">{u.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{u.email}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize font-semibold border-slate-200">
                            {u.role.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {tenants.find(t => t.id === u.tenantId)?.name || <span className="text-muted-foreground italic text-xs">Mercury Global</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <div className={cn("w-1.5 h-1.5 rounded-full", u.isActive ? "bg-cyan-500" : "bg-slate-300")} />
                            <span className="text-xs font-medium">{u.isActive ? 'Active' : 'Suspended'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right px-6">
                          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-rose-600 transition-colors" onClick={() => deleteUserMutation.mutate(u.id)}>
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
          <TabsContent value="health" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Platform Availability</CardTitle>
                  <CardDescription>Real-time system uptime tracking.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center py-10">
                   <div className="relative w-40 h-40">
                      <svg className="w-full h-full" viewBox="0 0 100 100">
                         <circle className="text-slate-100 stroke-current" strokeWidth="8" fill="transparent" r="40" cx="50" cy="50" />
                         <circle className="text-emerald-500 stroke-current" strokeWidth="8" strokeDasharray="251.2" strokeDashoffset="0" strokeLinecap="round" fill="transparent" r="40" cx="50" cy="50" />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                         <span className="text-2xl font-black text-slate-900">{metrics?.uptime || '99.9%'}</span>
                         <span className="text-[10px] text-muted-foreground font-bold uppercase">Uptime</span>
                      </div>
                   </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Audit & Maintenance</CardTitle>
                  <CardDescription>Critical platform-level operations.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100 text-amber-800">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs font-bold">Production Isolation Active</p>
                      <p className="text-[10px] leading-relaxed">Safety switches are enabled. Use "Safe Initialize" to add missing platform entities without deleting existing data.</p>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full gap-2 border-slate-200" onClick={() => toast.info('Platform activity logs are being synced...')}>
                    <History className="w-4 h-4" /> Download Platform Logs
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}