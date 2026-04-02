import React, { useState, useEffect, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store';
import { useChat } from '@/hooks/use-chat';
import { Conversation, ApiResponse, PresenceStatus, OfflineRequest, SystemMetrics } from '@shared/types';
import { MessageCircle, User as UserIcon, Send, Clock, Power, Inbox, BarChart3, MailCheck, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { toast } from 'sonner';
export function AgentDashboard() {
  const token = useAuthStore(s => s.token);
  const userId = useAuthStore(s => s.user?.id);
  const tenant = useAuthStore(s => s.tenant);
  const selectedTenantId = useAuthStore(s => s.selectedTenantId);
  const activeId = useAuthStore(s => s.activeConversationId);
  const setActiveId = useAuthStore(s => s.setActiveConversationId);
  const presenceStatus = useAuthStore(s => s.user?.presenceStatus);
  const isOnline = useAuthStore(s => s.user?.isOnline);
  const contactName = useAuthStore(s => s.user?.name);
  const [msgInput, setMsgInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations', selectedTenantId],
    queryFn: async () => {
      const res = await fetch('/api/conversations', {
        headers: { 'Authorization': `Bearer ${token}`, 'X-Tenant-ID': selectedTenantId || '' }
      });
      const json = await res.json() as ApiResponse<Conversation[]>;
      return json.data ?? [];
    },
    refetchInterval: 5000,
    enabled: !!token && !!selectedTenantId,
  });
  const { data: offlineRequests = [] } = useQuery({
    queryKey: ['offline', selectedTenantId],
    queryFn: async () => {
      const res = await fetch('/api/internal/offline', {
        headers: { 'Authorization': `Bearer ${token}`, 'X-Tenant-ID': selectedTenantId || '' }
      });
      const json = await res.json() as ApiResponse<OfflineRequest[]>;
      return json.data ?? [];
    },
    refetchInterval: 10000,
    enabled: !!token && !!selectedTenantId,
  });
  const { data: metrics } = useQuery({
    queryKey: ['metrics', selectedTenantId],
    queryFn: async () => {
      const res = await fetch('/api/agent/metrics', {
        headers: { 'Authorization': `Bearer ${token}`, 'X-Tenant-ID': selectedTenantId || '' }
      });
      const json = await res.json() as ApiResponse<SystemMetrics>;
      return json.data;
    },
    refetchInterval: 30000,
    enabled: !!token && !!selectedTenantId,
  });
  const { messages, sendMessage, claimConversation, endConversation } = useChat(activeId);
  const presenceMutation = useMutation({
    mutationFn: async (status: PresenceStatus) => {
      const res = await fetch('/api/presence', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error('Update failed');
      return await res.json();
    },
    onSuccess: () => {
      toast.success('Presence updated');
      queryClient.invalidateQueries();
    }
  });
  const membershipMutation = useMutation({
    mutationFn: async ({ queueId, action }: { queueId: string, action: 'join' | 'leave' }) => {
      const res = await fetch(`/api/agent/queues/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ queueId })
      });
      return await res.json();
    },
    onSuccess: () => {
      toast.success("Queue membership updated");
      queryClient.invalidateQueries();
    }
  });
  const dispatchMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const res = await fetch(`/api/internal/offline/${requestId}/dispatch`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': selectedTenantId || ''
        }
      });
      if (!res.ok) throw new Error('Dispatch failed');
      return await res.json();
    },
    onSuccess: () => {
      toast.success('Request dispatched');
      queryClient.invalidateQueries({ queryKey: ['offline', selectedTenantId] });
    }
  });
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgInput.trim()) return;
    sendMessage(msgInput);
    setMsgInput('');
  };
  const myChats = (conversations ?? []).filter(c => c.ownerId === userId && c.status === 'owned');
  const unassigned = (conversations ?? []).filter(c => c.status === 'unassigned');
  const activeConv = (conversations ?? []).find(c => c.id === activeId);
  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-8 md:py-10 lg:py-12 flex flex-col gap-8">
          <Tabs defaultValue="live" className="w-full">
            <div className="flex items-center justify-between mb-6">
              <div className="space-y-1">
                <h1 className="text-3xl font-bold tracking-tight text-foreground">Agent Console</h1>
                <p className="text-sm text-muted-foreground">Manage your presence and multi-tenant traffic.</p>
              </div>
              <TabsList className="bg-secondary p-1">
                <TabsTrigger value="live" className="gap-2"><MessageCircle className="w-4 h-4" /> Live</TabsTrigger>
                <TabsTrigger value="inbox" className="gap-2"><Inbox className="w-4 h-4" /> Inbox</TabsTrigger>
                <TabsTrigger value="insights" className="gap-2"><BarChart3 className="w-4 h-4" /> Insights</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="live" className="mt-0">
              <div className="h-[calc(100vh-18rem)] grid grid-cols-12 gap-6">
                <div className="col-span-3 flex flex-col gap-4 overflow-hidden">
                  <Card className="shadow-sm flex flex-col h-fit">
                    <CardHeader className="p-4 border-b bg-muted/50">
                      <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Agent Presence</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold capitalize">{presenceStatus ?? 'offline'}</p>
                        <p className="text-xs text-muted-foreground">{isOnline ? 'Available for chats' : 'Offline'}</p>
                      </div>
                      <Switch
                        id="presence"
                        checked={isOnline ?? false}
                        onCheckedChange={(checked) => presenceMutation.mutate((checked ? 'online' : 'offline') as PresenceStatus)}
                      />
                    </CardContent>
                  </Card>
                  <Card className="flex flex-col overflow-hidden shadow-sm">
                    <CardHeader className="p-4 border-b bg-muted/50">
                       <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">My Queues</CardTitle>
                    </CardHeader>
                    <ScrollArea className="flex-1">
                       <div className="p-4 space-y-4">
                          {tenant?.queues?.map(q => (
                            <div key={q.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-background border">
                               <span className="text-xs font-medium truncate">{q.name}</span>
                               <Switch
                                 checked={q.assignedAgentIds?.includes(userId || '')}
                                 onCheckedChange={(checked) => membershipMutation.mutate({ queueId: q.id, action: checked ? 'join' : 'leave' })}
                               />
                            </div>
                          ))}
                       </div>
                    </ScrollArea>
                  </Card>
                  <Card className="flex flex-col flex-1 overflow-hidden shadow-sm">
                    <CardHeader className="p-4 border-b bg-muted/50">
                       <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Live Traffic</CardTitle>
                    </CardHeader>
                    <ScrollArea className="flex-1">
                      <div className="p-4 space-y-6">
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase">Personal Batch ({myChats.length})</p>
                          {myChats.map(c => (
                            <div key={c.id} onClick={() => setActiveId(c.id)} className={cn("p-3 rounded-xl cursor-pointer border transition-all text-sm", activeId === c.id ? "bg-accent text-accent-foreground border-primary shadow-sm" : "hover:bg-accent/50 bg-background")}>
                              <div className="font-bold truncate">{c.contactName}</div>
                              <div className="text-[10px] text-muted-foreground">{formatDistanceToNow(c.updatedAt, { addSuffix: true })}</div>
                            </div>
                          ))}
                        </div>
                        <div className="space-y-2 pt-4 border-t">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase">Available Queue ({unassigned.length})</p>
                          {unassigned.map(c => (
                            <div key={c.id} className="p-3 rounded-xl border bg-background space-y-2 border-dashed">
                              <div className="font-medium text-xs">{c.contactName}</div>
                              <Button size="sm" variant="outline" className="w-full h-7 text-[10px]" onClick={() => claimConversation(c.id)}>Claim Session</Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </ScrollArea>
                  </Card>
                </div>
                <Card className="col-span-6 flex flex-col overflow-hidden shadow-soft">
                  {!activeId ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-12 text-center bg-muted/10">
                       <div className="w-20 h-20 bg-background rounded-3xl shadow-sm border flex items-center justify-center mb-6"><MessageCircle className="w-10 h-10 text-muted/50" /></div>
                       <h3 className="font-bold text-foreground text-lg">Waiting for Traffic</h3>
                       <p className="text-sm max-w-[240px] mx-auto mt-2">Claim an unassigned chat or select one from your batch to begin responding.</p>
                    </div>
                  ) : (
                    <>
                      <div className="p-4 border-b bg-background flex justify-between items-center shadow-sm z-10">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-secondary border flex items-center justify-center text-secondary-foreground text-xs font-bold">{activeConv?.contactName[0]}</div>
                          <span className="font-bold text-foreground">{activeConv?.contactName}</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => endConversation(activeId)} className="text-destructive hover:bg-destructive/10"><Power className="w-4 h-4 mr-2" /> Close Chat</Button>
                      </div>
                      <ScrollArea className="flex-1 p-6 bg-background">
                        <div className="space-y-6">
                          {messages.map(m => (
                            <div key={m.id} className={cn("flex flex-col max-w-[85%]", m.senderType === 'agent' ? "ml-auto items-end" : "mr-auto items-start")}>
                              <div className={cn("px-4 py-2.5 rounded-2xl text-sm shadow-sm", m.senderType === 'agent' ? "bg-primary text-primary-foreground rounded-br-none" : "bg-muted border text-muted-foreground rounded-bl-none")}>
                                {m.content}
                              </div>
                              <span className="text-[10px] text-muted-foreground mt-1.5 px-1">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          ))}
                          <div ref={scrollRef} />
                        </div>
                      </ScrollArea>
                      <div className="p-4 border-t bg-secondary/50 backdrop-blur-md">
                        <form onSubmit={handleSend} className="flex gap-2 bg-background p-1 rounded-xl border shadow-sm focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                          <Input placeholder="Compose message..." className="bg-transparent border-0 shadow-none focus-visible:ring-0" value={msgInput} onChange={(e) => setMsgInput(e.target.value)} />
                          <Button type="submit" size="icon" className="shrink-0 h-10 w-10 rounded-lg" disabled={!msgInput.trim()}><Send className="w-4 h-4" /></Button>
                        </form>
                      </div>
                    </>
                  )}
                </Card>
                <div className="col-span-3 flex flex-col gap-4">
                  <Card className="flex flex-col overflow-hidden shadow-sm">
                    <CardHeader className="p-4 border-b bg-muted/50">
                       <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Visitor Profile</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 text-center">
                      {activeConv ? (
                        <div className="space-y-6">
                          <div className="w-20 h-20 bg-muted rounded-full mx-auto flex items-center justify-center border-4 border-background shadow-md"><UserIcon className="w-10 h-10 text-muted-foreground/50" /></div>
                          <div>
                            <h4 className="font-bold text-lg text-foreground">{activeConv.contactName}</h4>
                            <p className="text-xs text-muted-foreground">{activeConv.contactEmail || 'No verified email'}</p>
                          </div>
                          <div className="pt-6 border-t text-left space-y-4">
                            <div><label className="text-[10px] font-bold text-muted-foreground uppercase">Created</label><p className="text-sm font-medium">{formatDistanceToNow(activeConv.createdAt)} ago</p></div>
                          </div>
                        </div>
                      ) : (
                        <div className="py-12 opacity-40"><UserIcon className="w-12 h-12 mx-auto text-muted-foreground" /><p className="text-[10px] mt-2 uppercase font-bold tracking-widest">Awaiting Active Session</p></div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="inbox" className="mt-0">
              <Card className="shadow-soft">
                <CardHeader>
                  <CardTitle>Offline Leads</CardTitle>
                  <CardDescription>Customer inquiries captured when the queue was unavailable.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Visitor</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Received</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {offlineRequests.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground italic">No offline requests found</TableCell></TableRow>
                      ) : offlineRequests.map(r => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <div className="font-bold">{r.visitorName}</div>
                            <div className="text-xs text-muted-foreground">{r.visitorEmail}</div>
                          </TableCell>
                          <TableCell className="max-w-xs truncate">{r.subject}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant={r.status === 'pending' ? 'outline' : 'secondary'}>
                              {r.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8"
                              onClick={() => dispatchMutation.mutate(r.id)}
                              disabled={r.status !== 'pending' || dispatchMutation.isPending}
                            >
                              {r.status === 'pending' ? 'Dispatch' : <Check className="w-4 h-4" />}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="insights" className="mt-0">
               <div className="grid md:grid-cols-4 gap-6 mb-8">
                  {[
                    { label: 'Avg Response Time', value: `${metrics?.avgResponseTime ?? 0}s`, icon: Clock },
                    { label: 'Resolution Rate', value: `${metrics?.resolutionRate ?? 0}%`, icon: MailCheck },
                    { label: 'Live Agents', value: metrics?.activeAgents ?? 0, icon: UserIcon },
                    { label: 'Total Volume', value: metrics?.totalConvs ?? 0, icon: MessageCircle },
                  ].map(stat => (
                    <Card key={stat.label} className="shadow-sm">
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start mb-2">
                           <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                           <stat.icon className="w-4 h-4 text-primary" />
                        </div>
                        <h3 className="text-3xl font-bold text-foreground">{stat.value}</h3>
                      </CardContent>
                    </Card>
                  ))}
               </div>
               <Card className="shadow-soft">
                  <CardHeader><CardTitle>Conversation Trends (Mock)</CardTitle></CardHeader>
                  <CardContent>
                    <div className="h-[400px] w-full">
                      <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={metrics?.hourlyMessageVolume || []}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="timestamp" axisLine={false} tickLine={false} fontSize={12} tick={{ fill: '#94a3b8' }} />
                          <YAxis axisLine={false} tickLine={false} fontSize={12} tick={{ fill: '#94a3b8' }} />
                          <Tooltip
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            cursor={{ fill: '#f8fafc' }}
                          />
                          <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
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