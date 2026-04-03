import React, { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { useAuthStore } from '@/lib/store';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Save, Plus, Trash2, Globe, Shield, Monitor, ListFilter, Users as UsersIcon, UserPlus, Fingerprint, Lock, Loader2 } from 'lucide-react';
import { Queue, TenantSite, ApiResponse, User } from '@shared/types';
import { nanoid } from 'nanoid';
import { cn } from "@/lib/utils";
import { useCallback } from 'react';
import { useForm } from 'react-hook-form';
export function TenantAdmin() {
  const queryClient = useQueryClient();
  const token = useAuthStore(s => s.token);
  const refreshMe = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const json = await res.json() as ApiResponse<{user: any, tenant: any, availableTenants: any[]}>;

      if (json.success && json.data) {
        useAuthStore.getState().setAuth(json.data.user, token, json.data.tenant, json.data.availableTenants);
      }
    } catch (e) {
      console.error('Failed to refresh identity context', e);
    }
  }, [token]);

  const tenant = useAuthStore(s => s.tenant);
  const selectedTenantId = useAuthStore(s => s.selectedTenantId);
  const [primaryColor, setPrimaryColor] = useState(tenant?.branding.primaryColor || '#06B6D4');
  const [welcomeMessage, setWelcomeMessage] = useState(tenant?.branding.welcomeMessage || '');
  const [widgetPosition, setWidgetPosition] = useState(tenant?.branding.widgetPosition || 'bottom-right');
  const [themePreset, setThemePreset] = useState(tenant?.branding.themePreset || 'modern');
  const [queues, setQueues] = useState<Queue[]>(tenant?.queues ?? []);
  const [sites, setSites] = useState<TenantSite[]>(tenant?.sites ?? []);
  const [entraClientId, setEntraClientId] = useState(tenant?.authPolicy?.entraClientId || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const inviteForm = useForm<{ email: string; name: string }>();
  useEffect(() => {
    if (tenant) {
      setPrimaryColor(tenant.branding?.primaryColor || '#06B6D4');
      setWelcomeMessage(tenant.branding?.welcomeMessage || '');
      setWidgetPosition(tenant.branding?.widgetPosition || 'bottom-right');
      setThemePreset(tenant.branding?.themePreset || 'modern');
      setQueues(tenant.queues ?? []);
      setSites(tenant.sites ?? []);
      setEntraClientId(tenant.authPolicy?.entraClientId || '');
    }
  }, [tenant]);
  const { data: agents = [], isLoading: isLoadingAgents } = useQuery({
    queryKey: ['admin', 'agents', selectedTenantId],
    queryFn: async () => {
      const res = await fetch('/api/admin/agents', {
        headers: { 
          'Authorization': `Bearer ${token}`, 
          'X-Tenant-ID': selectedTenantId || '' 
        }
      });
      const json = await res.json() as ApiResponse<User[]>;
      return json.data ?? [];
    },
    enabled: !!token && !!selectedTenantId
  });
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': selectedTenantId || ''
        },
        body: JSON.stringify({
          branding: { primaryColor, welcomeMessage, widgetPosition, themePreset },
          queues: queues.filter(q => !q.isDeleted),
          sites,
          authPolicy: {
            allowLocalAuth: true,
            entraClientId
          }
        })
      });
      if (res.ok) {
        toast.success('Tenant settings synchronized');
        queryClient.invalidateQueries();
        refreshMe();
      } else toast.error('Failed to synchronize context');
    } catch (e) {
      toast.error('Network error during synchronization');
    } finally {
      setIsSaving(false);
    }
  };
  const inviteMutation = useMutation({
    mutationFn: async (data: { email: string, name: string }) => {
      const res = await fetch('/api/admin/agents/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': selectedTenantId || ''
        },
        body: JSON.stringify(data)
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'agents', selectedTenantId] });
      setIsInviteOpen(false);
      inviteForm.reset();
      toast.success('Staff access provisioned');
    }
  });
  const toggleAgentInQueue = (queueIdx: number, agentId: string) => {
    const newQueues = [...queues];
    const current = newQueues[queueIdx].assignedAgentIds || [];
    if (current.includes(agentId)) {
      newQueues[queueIdx].assignedAgentIds = current.filter(id => id !== agentId);
    } else {
      newQueues[queueIdx].assignedAgentIds = [...current, agentId];
    }
    setQueues(newQueues);
  };
  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-8 md:py-10 lg:py-12">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Tenant Configuration</h1>
              <p className="text-muted-foreground text-sm">Managing logical isolation for {tenant?.name || 'Loading...'}.</p>
            </div>
            <div className="flex gap-2">
              <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2 rounded-xl">
                    <UserPlus className="w-4 h-4" /> Invite Staff
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-2xl">
                  <DialogHeader>
                    <DialogTitle>Provision Agent Access</DialogTitle>
                    <CardDescription>Invited users will have access only to this tenant's queues and conversations.</CardDescription>
                  </DialogHeader>
                  <form className="space-y-4 py-4" onSubmit={inviteForm.handleSubmit(data => inviteMutation.mutate(data))}>
                    <div className="space-y-2">
                      <Label>Staff Name</Label>
                      <Input {...inviteForm.register('name', { required: true })} placeholder="Jane Smith" />
                    </div>
                    <div className="space-y-2">
                      <Label>Enterprise Email</Label>
                      <Input {...inviteForm.register('email', { required: true })} type="email" placeholder="jane@company.com" />
                    </div>
                    <DialogFooter className="pt-4">
                      <Button type="submit" className="w-full bg-slate-900" disabled={inviteMutation.isPending}>
                        {inviteMutation.isPending ? 'Provisioning...' : 'Complete Invite'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
              <Button onClick={handleSave} disabled={isSaving} className="bg-cyan-600 hover:bg-cyan-700 gap-2 rounded-xl shadow-lg shadow-cyan-100">
                <Save className="w-4 h-4" /> {isSaving ? 'Synchronizing...' : 'Save Context'}
              </Button>
            </div>
          </div>
          <Tabs defaultValue="sites" className="w-full space-y-6">
            <TabsList className="bg-slate-100 p-1 rounded-xl">
              <TabsTrigger value="sites" className="gap-2 px-6 rounded-lg"><Globe className="w-4 h-4" /> Site Links</TabsTrigger>
              <TabsTrigger value="queues" className="gap-2 px-6 rounded-lg"><ListFilter className="w-4 h-4" /> Flow Control</TabsTrigger>
              <TabsTrigger value="branding" className="gap-2 px-6 rounded-lg"><Monitor className="w-4 h-4" /> UI Persona</TabsTrigger>
              <TabsTrigger value="auth" className="gap-2 px-6 rounded-lg"><Lock className="w-4 h-4" /> Enterprise SSO</TabsTrigger>
            </TabsList>
            <TabsContent value="sites">
              <Card className="border-none shadow-sm ring-1 ring-slate-200">
                <CardHeader className="flex flex-row items-center justify-between border-b">
                  <div>
                    <CardTitle>Endpoint Registry</CardTitle>
                    <CardDescription>Mapping public domains to Mercury routing logic.</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setSites([...sites, { id: nanoid(), name: 'New Site', key: nanoid(12) }])} className="gap-2 rounded-lg">
                    <Plus className="w-4 h-4" /> Register Site
                  </Button>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  {sites.map((site, idx) => (
                    <div key={site.id} className="grid md:grid-cols-4 gap-4 p-4 border rounded-2xl bg-slate-50 items-center">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-black text-slate-400">Site Name</Label>
                        <Input value={site.name} className="bg-white" onChange={e => {
                          const n = [...sites]; n[idx].name = e.target.value; setSites(n);
                        }} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-black text-slate-400">Environment Key</Label>
                        <Input value={site.key} readOnly className="bg-slate-100 font-mono text-[10px] uppercase tracking-tighter" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-black text-slate-400">Default Flow</Label>
                        <Select value={site.defaultQueueId} onValueChange={v => {
                          const n = [...sites]; n[idx].defaultQueueId = v; setSites(n);
                        }}>
                          <SelectTrigger className="bg-white"><SelectValue placeholder="Select queue" /></SelectTrigger>
                          <SelectContent>
                            {queues.filter(q => !q.isDeleted).map(q => <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex justify-end pt-5">
                        <Button variant="ghost" size="icon" className="text-rose-400 hover:text-rose-600 hover:bg-rose-50" onClick={() => setSites(sites.filter(s => s.id !== site.id))}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {sites.length === 0 && <div className="py-10 text-center text-muted-foreground italic border-2 border-dashed rounded-2xl">No sites registered for this tenant</div>}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="queues">
              <Card className="border-none shadow-sm ring-1 ring-slate-200">
                <CardHeader className="flex flex-row items-center justify-between border-b">
                  <div>
                    <CardTitle>Queue Orchestration</CardTitle>
                    <CardDescription>Logical silos for conversation traffic and agent matching.</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setQueues([...queues, { id: nanoid(), tenantId: selectedTenantId || '', name: 'New Support Tier', priority: 0, capacityMax: 20, isDeleted: false, assignedAgentIds: [] }])} className="gap-2 rounded-lg">
                    <Plus className="w-4 h-4" /> Define Queue
                  </Button>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {queues.map((q, idx) => {
                    const assignedOnlineCount = agents.filter(a => q.assignedAgentIds?.includes(a.id) && a.isOnline).length;
                    return (
                      <div key={q.id} className="p-6 border rounded-2xl space-y-6 bg-white shadow-sm relative overflow-hidden transition-all hover:shadow-md">
                        <div className="grid md:grid-cols-4 gap-6">
                          <div className="space-y-1">
                            <Label className="text-xs font-bold text-slate-400">Queue Name</Label>
                            <Input value={q.name} onChange={e => { const n = [...queues]; n[idx].name = e.target.value; setQueues(n); }} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs font-bold text-slate-400">Hard Capacity</Label>
                            <Input type="number" value={q.capacityMax} onChange={e => { const n = [...queues]; n[idx].capacityMax = parseInt(e.target.value); setQueues(n); }} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs font-bold text-slate-400">Routing Priority</Label>
                            <Input type="number" value={q.priority} onChange={e => { const n = [...queues]; n[idx].priority = parseInt(e.target.value); setQueues(n); }} />
                          </div>
                          <div className="flex items-center justify-end pt-5">
                             <div className="text-right">
                               <p className="text-[10px] font-bold text-slate-400 uppercase">Live Capacity</p>
                               <div className="flex items-center gap-2 mt-1">
                                 <Badge className={cn("px-2 py-0.5 rounded-md", assignedOnlineCount > 0 ? "bg-emerald-500" : "bg-slate-400")}>
                                   {assignedOnlineCount} Agents Ready
                                 </Badge>
                                 <Button variant="ghost" size="icon" className="text-rose-400" onClick={() => {
                                    const n = [...queues]; n[idx].isDeleted = true; setQueues(n);
                                 }}><Trash2 className="w-4 h-4" /></Button>
                               </div>
                             </div>
                          </div>
                        </div>
                        <div className="pt-6 border-t flex flex-col md:flex-row gap-8">
                          <div className="flex-1">
                             <h4 className="text-[10px] font-black uppercase text-slate-400 mb-4 flex items-center gap-2">
                                <UsersIcon className="w-3 h-3" /> Tenant Staff Access
                             </h4>
                             {isLoadingAgents ? (
                               <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> Loading agents...</div>
                             ) : (
                               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                  {agents.map(agent => (
                                    <div key={agent.id} className="flex items-center space-x-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 transition-colors hover:bg-slate-100">
                                      <Checkbox
                                        id={`${q.id}-${agent.id}`}
                                        checked={(q.assignedAgentIds || []).includes(agent.id)}
                                        onCheckedChange={() => toggleAgentInQueue(idx, agent.id)}
                                      />
                                      <Label htmlFor={`${q.id}-${agent.id}`} className={cn("text-xs cursor-pointer truncate", agent.isOnline ? "text-slate-900 font-bold" : "text-slate-500")}>
                                        {agent.name}
                                      </Label>
                                    </div>
                                  ))}
                               </div>
                             )}
                          </div>
                        </div>
                        {q.isDeleted && <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center font-black text-rose-600 uppercase tracking-widest text-sm">Archived Queue</div>}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="branding">
              <Card className="border-none shadow-sm ring-1 ring-slate-200">
                <CardHeader className="border-b">
                  <CardTitle>UI Persona</CardTitle>
                  <CardDescription>Custom brand identity and widget behavior.</CardDescription>
                </CardHeader>
                <CardContent className="p-8 space-y-8">
                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <Label>Primary Color</Label>
                      <Input
                        type="color"
                        value={primaryColor}
                        onChange={e => setPrimaryColor(e.target.value)}
                        className="h-12 w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Widget Position</Label>
                      <Select value={widgetPosition} onValueChange={setWidgetPosition as any}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bottom-right">Bottom Right</SelectItem>
                          <SelectItem value="bottom-left">Bottom Left</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <Label>Welcome Message</Label>
                      <Textarea
                        value={welcomeMessage}
                        onChange={e => setWelcomeMessage(e.target.value)}
                        placeholder="Welcome! How may we assist?"
                        rows={4}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Theme Preset</Label>
                      <Select value={themePreset} onValueChange={setThemePreset as any}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="modern">Modern</SelectItem>
                          <SelectItem value="glass">Glass</SelectItem>
                          <SelectItem value="classic">Classic</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="auth">
              <Card className="border-none shadow-sm ring-1 ring-slate-200">
                <CardHeader className="border-b">
                   <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm ring-1 ring-indigo-200">
                        <Fingerprint className="w-6 h-6" />
                     </div>
                     <div>
                       <CardTitle>Enterprise Identity Protection</CardTitle>
                       <CardDescription>Configure Microsoft Entra ID (Azure AD) for staff Single Sign-On.</CardDescription>
                     </div>
                   </div>
                </CardHeader>
                <CardContent className="p-8 space-y-8">
                   <div className="max-w-2xl space-y-6">
                      <div className="space-y-2">
                        <Label className="text-slate-900 font-bold">Client ID / Application ID</Label>
                        <Input
                          placeholder="e.g. 00000000-0000-0000-0000-000000000000"
                          value={entraClientId}
                          onChange={e => setEntraClientId(e.target.value)}
                          className="font-mono text-xs"
                        />
                      </div>
                      <div className="space-y-4 pt-4">
                        <h4 className="text-sm font-bold text-slate-800">Provisioning Logic (Group Sync)</h4>
                        <div className="p-6 border-2 border-dashed rounded-2xl bg-slate-50 flex flex-col items-center justify-center text-center space-y-3">
                           <Shield className="w-8 h-8 text-slate-300" />
                           <p className="text-xs text-slate-500 font-medium">Automatic agent provisioning based on Entra ID groups is an Enterprise feature.</p>
                           <Button variant="outline" size="sm" className="h-8 text-[10px] uppercase font-bold">Upgrade to Premium</Button>
                        </div>
                      </div>
                   </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </MainLayout>
  );
}