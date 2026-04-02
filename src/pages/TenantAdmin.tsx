import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { Save, Plus, Trash2, Zap, ArrowRight } from 'lucide-react';
import { Queue, Workflow, EventType, ActionType } from '@shared/types';
import { nanoid } from 'nanoid';
export function TenantAdmin({ title = "Tenant Settings" }: { title?: string }) {
  const tenant = useAuthStore(s => s.tenant);
  const token = useAuthStore(s => s.token);
  const [primaryColor, setPrimaryColor] = useState(tenant?.branding.primaryColor || '#06B6D4');
  const [welcomeMessage, setWelcomeMessage] = useState(tenant?.branding.welcomeMessage || '');
  const [queues, setQueues] = useState<Queue[]>(tenant?.queues ?? []);
  const [workflows, setWorkflows] = useState<Workflow[]>(tenant?.workflows ?? []);
  const [isSaving, setIsSaving] = useState(false);
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          branding: { primaryColor, welcomeMessage },
          queues,
          workflows
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
  const addQueue = () => {
    const newQueue: Queue = {
      id: nanoid(),
      tenantId: tenant?.id || '',
      name: 'New Queue',
      description: ''
    };
    setQueues([...queues, newQueue]);
  };
  const addWorkflow = () => {
    const newWF: Workflow = {
      id: nanoid(),
      name: 'New Automation',
      eventType: 'conversation.ended',
      actionType: 'webhook',
      active: true
    };
    setWorkflows([...workflows, newWF]);
  };
  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10 lg:py-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
            <p className="text-muted-foreground">Customize your widget and manage incoming traffic.</p>
          </div>
          <Button onClick={handleSave} disabled={isSaving} className="bg-slate-900 gap-2">
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save All Changes'}
          </Button>
        </div>
        <Tabs defaultValue="branding" className="w-full space-y-6">
          <TabsList className="bg-slate-100 p-1">
            <TabsTrigger value="branding">Branding</TabsTrigger>
            <TabsTrigger value="queues">Queues</TabsTrigger>
            <TabsTrigger value="workflows">Workflows</TabsTrigger>
          </TabsList>
          <TabsContent value="branding">
            <div className="grid lg:grid-cols-2 gap-8">
              <Card>
                <CardHeader><CardTitle>Visual Identity</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>Primary Brand Color</Label>
                    <div className="flex gap-4">
                      <Input type="color" className="w-16 h-10 p-1" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
                      <Input type="text" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="font-mono" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Welcome Message</Label>
                    <Textarea placeholder="Hi! How can we help?" className="min-h-[120px]" value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)} />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-slate-50 border-dashed">
                <CardContent className="flex items-center justify-center p-12">
                  <div className="w-64 bg-white rounded-xl shadow-xl overflow-hidden border">
                    <div className="h-10 px-4 flex items-center text-white text-xs font-bold" style={{ backgroundColor: primaryColor }}>{tenant?.name}</div>
                    <div className="p-6 text-center space-y-4">
                      <p className="text-xs text-slate-600 italic">"{welcomeMessage}"</p>
                      <Button size="sm" className="w-full text-[10px] h-8" style={{ backgroundColor: primaryColor }}>Start Chat</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          <TabsContent value="queues">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div><CardTitle>Conversation Queues</CardTitle></div>
                <Button variant="outline" size="sm" onClick={addQueue} className="gap-2"><Plus className="w-4 h-4" /> Add Queue</Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(queues ?? []).map((q, idx) => (
                    <div key={q.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border">
                      <div className="flex-1 grid md:grid-cols-2 gap-4">
                        <Input value={q.name} onChange={(e) => {
                          const n = [...queues]; n[idx].name = e.target.value; setQueues(n);
                        }} />
                        <Input value={q.description || ''} placeholder="Description" onChange={(e) => {
                          const n = [...queues]; n[idx].description = e.target.value; setQueues(n);
                        }} />
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => setQueues(queues.filter(x => x.id !== q.id))}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="workflows">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div><CardTitle>Event Automations</CardTitle></div>
                <Button variant="outline" size="sm" onClick={addWorkflow} className="gap-2"><Plus className="w-4 h-4" /> Add Workflow</Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {(workflows ?? []).map((w, idx) => (
                  <div key={w.id} className="p-6 bg-white rounded-xl border shadow-sm space-y-6">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-cyan-50 rounded-lg"><Zap className="w-4 h-4 text-cyan-600" /></div>
                        <Input value={w.name} className="font-bold border-none h-auto p-0 focus-visible:ring-0 w-64" onChange={(e) => {
                          const n = [...workflows]; n[idx].name = e.target.value; setWorkflows(n);
                        }} />
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => setWorkflows(workflows.filter(x => x.id !== w.id))}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                    <div className="flex flex-col md:flex-row items-center gap-6">
                      <div className="flex-1 space-y-2">
                        <Label>When this happens...</Label>
                        <Select value={w.eventType} onValueChange={(val: EventType) => {
                           const n = [...workflows]; n[idx].eventType = val; setWorkflows(n);
                        }}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="conversation.started">Conversation Started</SelectItem>
                            <SelectItem value="conversation.ended">Conversation Ended</SelectItem>
                            <SelectItem value="agent.assigned">Agent Assigned</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <ArrowRight className="text-slate-300 hidden md:block" />
                      <div className="flex-1 space-y-2">
                        <Label>Then do this...</Label>
                        <Select value={w.actionType} onValueChange={(val: ActionType) => {
                           const n = [...workflows]; n[idx].actionType = val; setWorkflows(n);
                        }}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="webhook">Send Webhook (POST)</SelectItem>
                            <SelectItem value="log">Log to Console</SelectItem>
                            <SelectItem value="email_mock">Mock Email Alert</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {w.actionType === 'webhook' && (
                      <div className="space-y-2">
                        <Label>Target Endpoint URL</Label>
                        <Input placeholder="https://api.myapp.com/webhooks/mercury" value={w.targetUrl || ''} onChange={(e) => {
                          const n = [...workflows]; n[idx].targetUrl = e.target.value; setWorkflows(n);
                        }} />
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}