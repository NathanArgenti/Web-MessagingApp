import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiResponse, Tenant } from '@shared/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Globe, Shield, Activity, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
export function SuperAdmin() {
  const queryClient = useQueryClient();
  const [newTenantName, setNewTenantName] = useState('');
  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['superadmin', 'tenants'],
    queryFn: async () => {
      const res = await fetch('/api/superadmin/tenants');
      const json = await res.json() as ApiResponse<Tenant[]>;
      return json.data ?? [];
    }
  });
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
  const stats = [
    { label: 'Total Tenants', value: tenants.length, icon: Globe, color: 'text-cyan-600' },
    { label: 'Active Sessions', value: 12, icon: Activity, color: 'text-green-600' },
    { label: 'Platform Health', value: '100%', icon: Shield, color: 'text-indigo-600' }
  ];
  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10 lg:py-12">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Platform Oversight</h1>
            <p className="text-muted-foreground">Global management for all Mercury tenants.</p>
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Tenants</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Filter tenants..." className="pl-8" />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant Name</TableHead>
                  <TableHead>Site Key</TableHead>
                  <TableHead>Queues</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-10">Loading tenants...</TableCell></TableRow>
                ) : (tenants ?? []).map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="font-mono text-xs">{t.siteKey}</TableCell>
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
      </div>
    </MainLayout>
  );
}