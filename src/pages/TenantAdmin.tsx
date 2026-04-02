import React, { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { Save, Plus, Trash2 } from 'lucide-react';
import { Queue } from '@shared/types';
export function TenantAdmin({ title = "Tenant Settings" }: { title?: string }) {
  const tenant = useAuthStore(s => s.tenant);
  const token = useAuthStore(s => s.token);
  const [primaryColor, setPrimaryColor] = useState(tenant?.branding.primaryColor || '#06B6D4');
  const [welcomeMessage, setWelcomeMessage] = useState(tenant?.branding.welcomeMessage || '');
  const [queues, setQueues] = useState<Queue[]>(tenant?.queues || []);
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
          queues
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
      id: Math.random().toString(36).substr(2, 9),
      tenantId: tenant?.id || '',
      name: 'New Queue',
      description: ''
    };
    setQueues([...queues, newQueue]);
  };
  const removeQueue = (id: string) => {
    setQueues(queues.filter(q => q.id !== id));
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
                <CardHeader>
                  <CardTitle>Visual Identity</CardTitle>
                  <CardDescription>How your organization appears to visitors.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="color">Primary Brand Color</Label>
                    <div className="flex gap-4">
                      <Input 
                        id="color" 
                        type="color" 
                        className="w-16 h-10 p-1" 
                        value={primaryColor} 
                        onChange={(e) => setPrimaryColor(e.target.value)} 
                      />
                      <Input 
                        type="text" 
                        value={primaryColor} 
                        onChange={(e) => setPrimaryColor(e.target.value)} 
                        className="font-mono"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="welcome">Welcome Message</Label>
                    <Textarea 
                      id="welcome" 
                      placeholder="Hi! How can we help you today?" 
                      className="min-h-[120px]"
                      value={welcomeMessage}
                      onChange={(e) => setWelcomeMessage(e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-slate-50 border-dashed">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Preview</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center p-12">
                  <div className="w-64 bg-white rounded-xl shadow-xl overflow-hidden border">
                    <div className="h-10 px-4 flex items-center text-white text-xs font-bold" style={{ backgroundColor: primaryColor }}>
                      {tenant?.name || 'Your Company'}
                    </div>
                    <div className="p-6 text-center space-y-4">
                      <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center" style={{ backgroundColor: primaryColor + '20' }}>
                        <div className="w-6 h-6 rounded-full" style={{ backgroundColor: primaryColor }} />
                      </div>
                      <p className="text-xs text-slate-600 italic">"{welcomeMessage || 'Your welcome message...'}"</p>
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
                <div>
                  <CardTitle>Conversation Queues</CardTitle>
                  <CardDescription>Route visitors to the right department.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={addQueue} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add Queue
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {queues.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed rounded-lg">
                      <p className="text-sm text-muted-foreground">No queues configured yet.</p>
                    </div>
                  ) : (
                    queues.map((q, idx) => (
                      <div key={q.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border">
                        <div className="flex-1 grid md:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-slate-400">Queue Name</Label>
                            <Input 
                              value={q.name} 
                              onChange={(e) => {
                                const newQueues = [...queues];
                                newQueues[idx].name = e.target.value;
                                setQueues(newQueues);
                              }}
                              className="bg-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-slate-400">Description (Internal)</Label>
                            <Input 
                              value={q.description || ''} 
                              onChange={(e) => {
                                const newQueues = [...queues];
                                newQueues[idx].description = e.target.value;
                                setQueues(newQueues);
                              }}
                              placeholder="e.g. Technical support inquiries"
                              className="bg-white"
                            />
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-destructive" onClick={() => removeQueue(q.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="workflows">
            <Card>
              <CardHeader>
                <CardTitle>Event-Driven Workflows</CardTitle>
                <CardDescription>Connect chat events to your favorite tools.</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px] flex flex-col items-center justify-center border-2 border-dashed rounded-md m-6 space-y-4">
                 <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                    <Save className="w-6 h-6 text-slate-300" />
                 </div>
                 <div className="text-center">
                    <p className="font-medium text-slate-900">Workflow Engine Locked</p>
                    <p className="text-sm text-slate-500 max-w-xs mx-auto">Visual logic builder for webhooks and automated responses coming in Phase 4.</p>
                 </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}