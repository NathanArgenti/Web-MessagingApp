import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { useAuthStore } from '@/lib/store';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Save, Plus, Trash2, Globe, Shield, Monitor, ListFilter, Users as UsersIcon, UserPlus, Activity } from 'lucide-react';
import { Queue, TenantSite, ApiResponse, User } from '@shared/types';
import { nanoid } from 'nanoid';
import { cn } from "@/lib/utils";
export function TenantAdmin() {
  const queryClient = useQueryClient();
  const tenant = useAuthStore(s => s.tenant);
  const token = useAuthStore(s => s.token);
  const selectedTenantId = useAuthStore(s => s.selectedTenantId);
  const [primaryColor, setPrimaryColor] = useState(tenant?.branding.primaryColor || '#06B6D4');
  const [welcomeMessage, setWelcomeMessage] = useState(tenant?.branding.welcomeMessage || '');
  const [widgetPosition, setWidgetPosition] = useState(tenant?.branding.widgetPosition || 'bottom-right');
  const [themePreset, setThemePreset] = useState(tenant?.branding.themePreset || 'modern');
  const [queues, setQueues] = useState<Queue[]>(tenant?.queues ?? []);
  const [sites, setSites] = useState<TenantSite[]>(tenant?.sites ?? []);
  const [isSaving, setIsSaving] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const { data: agents = [] } = useQuery({
    queryKey: ['admin', 'agents', selectedTenantId],
    queryFn: async () => {
      const res = await fetch('/api/admin/agents', {
        headers: { 'Authorization': `Bearer ${token}`, 'X-Tenant-ID': selectedTenantId || '' }
      });
      const json = await res.json() as ApiResponse<User[]>;
      return json.data ?? [];
    },
    enabled: !!token && !!selectedTenantId
  });
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
      queryClient.invalidateQueries({ queryKey: ['admin', 'agents'] });
      setIsInviteOpen(false);
      toast.success('Agent invited successfully.');
    }
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
          queues,
          sites
        })
      });
      if (res.ok) toast.success('Settings updated successfully');
      else toast.error('Failed to update settings');
    } catch (e) {
      toast.error('Network error');
    } finally {
      setIsSaving(false);
    }
  };
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
  const addQueue = () => {
    setQueues([...queues, { id: nanoid(), tenantId: tenant?.id || '', name: 'New Queue', priority: 0, capacityMax: 10, isDeleted: false, assignedAgentIds: [] }]);
  };
  const addSite = () => {
    setSites([...sites, { id: nanoid(), name: 'New Site', key: nanoid(10) }]);
  };
  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-8 md:py-10 lg:py-12">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Tenant Administration</h1>
              <p className="text-muted-foreground text-sm">Configure multi-site parameters and traffic distribution.</p>
            </div>
            <div className="flex gap-2">
              <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <UserPlus className="w-4 h-4" /> Invite Agent
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Invite New Agent</DialogTitle></DialogHeader>
                  <form className="space-y-4 py-4" onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    inviteMutation.mutate({ email: fd.get('email') as string, name: fd.get('name') as string });
                  }}>
                    <div className="space-y-2"><Label>Name</Label><Input name="name" required /></div>
                    <div className="space-y-2"><Label>Email</Label><Input name="email" type="email" required /></div>
                    <DialogFooter><Button type="submit">Send Invite</Button></DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
              <Button onClick={handleSave} disabled={isSaving} className="bg-slate-900 gap-2">
                <Save className="w-4 h-4" /> {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
          <Tabs defaultValue="sites" className="w-full space-y-6">
            <TabsList className="bg-slate-100 p-1">
              <TabsTrigger value="sites" className="gap-2"><Globe className="w-4 h-4" /> Sites</TabsTrigger>
              <TabsTrigger value="queues" className="gap-2"><ListFilter className="w-4 h-4" /> Queues</TabsTrigger>
              <TabsTrigger value="branding" className="gap-2"><Monitor className="w-4 h-4" /> Branding</TabsTrigger>
              <TabsTrigger value="auth" className="gap-2"><Shield className="w-4 h-4" /> Policies</TabsTrigger>
            </TabsList>
            <TabsContent value="sites">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Tenant Sites</CardTitle>
                    <CardDescription>Logical endpoints for the messaging widget.</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={addSite} className="gap-2"><Plus className="w-4 h-4" /> Add Site</Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {sites.map((site, idx) => (
                    <div key={site.id} className="grid md:grid-cols-4 gap-4 p-4 border rounded-xl bg-slate-50 items-center">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold">Name</Label>
                        <Input value={site.name} onChange={e => {
                          const n = [...sites]; n[idx].name = e.target.value; setSites(n);
                        }} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold">Site Key</Label>
                        <Input value={site.key} readOnly className="bg-white font-mono text-xs" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold">Default Queue</Label>
                        <Select value={site.defaultQueueId} onValueChange={v => {
                          const n = [...sites]; n[idx].defaultQueueId = v; setSites(n);
                        }}>
                          <SelectTrigger className="bg-white"><SelectValue placeholder="Select queue" /></SelectTrigger>
                          <SelectContent>
                            {queues.map(q => <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex justify-end pt-5">
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setSites(sites.filter(s => s.id !== site.id))}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="queues">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Queue Orchestration</CardTitle>
                    <CardDescription>Control how traffic is routed and which agents are assigned.</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={addQueue} className="gap-2"><Plus className="w-4 h-4" /> Add Queue</Button>
                </CardHeader>
                <CardContent className="space-y-6">
                  {queues.map((q, idx) => {
                    const assignedOnlineCount = agents.filter(a => q.assignedAgentIds?.includes(a.id) && a.isOnline).length;
                    return (
                      <div key={q.id} className="p-6 border rounded-2xl space-y-6 bg-white shadow-sm relative overflow-hidden">
                        <div className="grid md:grid-cols-4 gap-6">
                          <div className="space-y-1">
                            <Label>Queue Name</Label>
                            <Input value={q.name} onChange={e => { const n = [...queues]; n[idx].name = e.target.value; setQueues(n); }} />
                          </div>
                          <div className="space-y-1">
                            <Label>Capacity (Max Chats)</Label>
                            <Input type="number" value={q.capacityMax} onChange={e => { const n = [...queues]; n[idx].capacityMax = parseInt(e.target.value); setQueues(n); }} />
                          </div>
                          <div className="space-y-1">
                            <Label>Priority</Label>
                            <Input type="number" value={q.priority} onChange={e => { const n = [...queues]; n[idx].priority = parseInt(e.target.value); setQueues(n); }} />
                          </div>
                          <div className="flex items-center justify-end pt-5">
                             <div className="text-right">
                               <p className="text-[10px] font-bold text-slate-400 uppercase">Live Status</p>
                               <div className="flex items-center gap-2 mt-1">
                                 <Badge variant="outline" className={assignedOnlineCount > 0 ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-50"}>
                                   {assignedOnlineCount} Agents Online
                                 </Badge>
                                 <Button variant="ghost" size="icon" className="text-destructive" onClick={() => {
                                    const n = [...queues]; n[idx].isDeleted = true; setQueues(n);
                                 }}><Trash2 className="w-4 h-4" /></Button>
                               </div>
                             </div>
                          </div>
                        </div>
                        <div className="pt-6 border-t flex flex-col md:flex-row gap-8">
                          <div className="flex-1">
                             <h4 className="text-xs font-bold uppercase text-slate-400 mb-3 flex items-center gap-2">
                                <UsersIcon className="w-3 h-3" /> Assigned Personnel
                             </h4>
                             <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {agents.map(agent => (
                                  <div key={agent.id} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`${q.id}-${agent.id}`}
                                      checked={(q.assignedAgentIds || []).includes(agent.id)}
                                      onCheckedChange={() => toggleAgentInQueue(idx, agent.id)}
                                    />
                                    <Label htmlFor={`${q.id}-${agent.id}`} className={cn("text-xs cursor-pointer", agent.isOnline ? "text-slate-900 font-medium" : "text-slate-500")}>
                                      {agent.name} {agent.isOnline && "●"}
                                    </Label>
                                  </div>
                                ))}
                             </div>
                          </div>
                        </div>
                        {q.isDeleted && <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center font-bold text-destructive">Decommissioned</div>}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="branding">
              <div className="grid lg:grid-cols-2 gap-8">
                <Card>
                  <CardHeader><CardTitle>Visual Identity</CardTitle></CardHeader>
                  <CardContent className="space-y-6">
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Theme Preset</Label>
                          <Select value={themePreset} onValueChange={v => setThemePreset(v as any)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="modern">Modern</SelectItem>
                              <SelectItem value="glass">Glass</SelectItem>
                              <SelectItem value="classic">Classic</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Widget Position</Label>
                          <Select value={widgetPosition} onValueChange={v => setWidgetPosition(v as any)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="bottom-right">Bottom Right</SelectItem>
                              <SelectItem value="bottom-left">Bottom Left</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                     </div>
                     <div className="space-y-2">
                      <Label>Primary Brand Color</Label>
                      <div className="flex gap-4">
                        <Input type="color" className="w-16 h-10 p-1" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} />
                        <Input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="font-mono" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Welcome Message</Label>
                      <Textarea value={welcomeMessage} onChange={e => setWelcomeMessage(e.target.value)} />
                    </div>
                  </CardContent>
                </Card>
                <div className="flex items-center justify-center p-12 bg-slate-50 rounded-4xl border-2 border-dashed">
                    <div className="w-64 bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
                      <div className="h-10 px-4 flex items-center text-white text-xs font-bold" style={{ backgroundColor: primaryColor }}>Preview</div>
                      <div className="p-8 text-center space-y-4">
                         <p className="text-sm text-slate-500 italic">"{welcomeMessage}"</p>
                         <Button size="sm" className="w-full text-white" style={{ backgroundColor: primaryColor }}>Start Chat</Button>
                      </div>
                    </div>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="auth">
              <Card>
                <CardHeader><CardTitle>Access Control Policies</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                   <div className="p-6 border rounded-2xl bg-slate-50/50 flex items-center justify-between">
                     <div className="space-y-1">
                       <h4 className="font-bold">Local Auth</h4>
                       <p className="text-sm text-muted-foreground">Allow developer bypass using only email addresses.</p>
                     </div>
                     <Badge className="bg-cyan-500 text-white">Enabled</Badge>
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