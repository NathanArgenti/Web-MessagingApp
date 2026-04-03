import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { Conversation, ApiResponse, PresenceStatus, OfflineRequest, SystemMetrics, Queue } from '@shared/types';
import { MessageCircle, User as UserIcon, Send, Clock, Power, Inbox, BarChart3, MailCheck, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { ChartContainer } from '@/components/ui/chart';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'framer-motion';
export function AgentDashboard() {
  const token = useAuthStore(s => s.token);
  const user = useAuthStore(s => s.user);
  const tenant = useAuthStore(s => s.tenant);
  const selectedTenantId = useAuthStore(s => s.selectedTenantId);
  const activeId = useAuthStore(s => s.activeConversationId);
  const setActiveId = useAuthStore(s => s.setActiveConversationId);
  const userId = user?.id;
  const presenceStatus = user?.presenceStatus;
  const isOnline = user?.isOnline;
  const effectiveTenantId = selectedTenantId || user?.tenantId || tenant?.id || '';
  const [msgInput, setMsgInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const refreshMe = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json() as ApiResponse<{user: any, tenant: any, availableTenants: any[]}>;
      if (json.success && json.data) {
        useAuthStore.getState().setAuth(json.data.user, token, json.data.tenant, json.data.availableTenants);
      }
    } catch (e) {
      console.error('Failed to refresh identity context', e);
    }
  }, [token]);
  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations', effectiveTenantId],
    queryFn: async () => {
      if (!token || !effectiveTenantId) return [];
      const res = await fetch('/api/conversations', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': effectiveTenantId,
          'Content-Type': 'application/json'
        }
      });
      const json = await res.json() as ApiResponse<Conversation[]>;
      return json.data ?? [];
    },
    refetchInterval: 5000,
    enabled: !!token && !!effectiveTenantId,
  });
  const { data: offlineRequests = [] } = useQuery({
    queryKey: ['offline', effectiveTenantId],
    queryFn: async () => {
      if (!token || !effectiveTenantId) return [];
      const res = await fetch('/api/internal/offline', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': effectiveTenantId,
          'Content-Type': 'application/json'
        }
      });
      const json = await res.json() as ApiResponse<OfflineRequest[]>;
      return json.data ?? [];
    },
    enabled: !!token && !!effectiveTenantId,
  });
  const { data: metrics } = useQuery({
    queryKey: ['metrics', effectiveTenantId],
    queryFn: async () => {
      if (!token || !effectiveTenantId) return null;
      const res = await fetch('/api/agent/metrics', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': effectiveTenantId,
          'Content-Type': 'application/json'
        }
      });
      const json = await res.json() as ApiResponse<SystemMetrics>;
      return json.data ?? null;
    },
    enabled: !!token && !!effectiveTenantId,
  });

  const { data: queues = [], isLoading: isLoadingQueues } = useQuery({
    queryKey: ['queues', effectiveTenantId],
    queryFn: async () => {
      if (!token || !effectiveTenantId) return [];
      const res = await fetch('/api/queues', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': effectiveTenantId,
          'Content-Type': 'application/json'
        }
      });
      const json = await res.json() as ApiResponse<Queue[]>;
      return json.data ?? [];
    },
    enabled: !!token && !!effectiveTenantId,
  });
  const { messages, sendMessage, claimConversation, endConversation } = useChat(activeId);
  const presenceMutation = useMutation({
    mutationFn: async (status: PresenceStatus) => {
      const res = await fetch('/api/presence', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': effectiveTenantId
        },
        body: JSON.stringify({ status })
      });
      const json = await res.json() as ApiResponse;
      if (!json.success) throw new Error(json.error || "Update failed");
      return json;
    },
    onSuccess: () => {
      toast.success('Presence updated');
      queryClient.invalidateQueries({ queryKey: ['conversations', effectiveTenantId] });
      refreshMe();
    },
    onError: (err: Error) => toast.error(err.message)
  });
  const membershipMutation = useMutation({
    mutationFn: async ({ queueId, action }: { queueId: string, action: 'join' | 'leave' }) => {
      const res = await fetch(`/api/agent/queues/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': effectiveTenantId
        },
        body: JSON.stringify({ queueId })
      });
      const json = await res.json() as ApiResponse;
      if (!json.success) throw new Error(json.error || "Membership change failed");
      return json;
    },
    onSuccess: () => {
      toast.success('Queue membership updated');
      queryClient.invalidateQueries({ queryKey: ['queues', effectiveTenantId] });
      refreshMe();
    },
    onError: (err: Error) => toast.error(err.message)
  });
  const dispatchMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const res = await fetch(`/api/internal/offline/${requestId}/dispatch`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': effectiveTenantId,
          'Content-Type': 'application/json'
        }
      });
      const json = await res.json() as ApiResponse;
      if (!json.success) throw new Error(json.error || "Dispatch failed");
      return json;
    },
    onSuccess: () => {
      toast.success('Lead dispatched');
      queryClient.invalidateQueries({ queryKey: ['offline', effectiveTenantId] });
    },
    onError: (err: Error) => toast.error(err.message)
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
            <TabsContent value="live" className="mt-0 h-[calc(100vh-16rem)] min-h-[600px]">
              <div className="h-full grid grid-cols-12 gap-6">
                <div className="col-span-3 flex flex-col gap-4 h-full overflow-hidden">
                  <Card className="shadow-sm flex flex-col h-fit shrink-0">
                    <CardHeader className="p-4 border-b bg-muted/50">
                      <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Agent Presence</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <p className="text-sm font-bold capitalize">{presenceStatus ?? 'offline'}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">{isOnline ? 'Available' : 'Away'}</p>
                      </div>
                      <Switch
                        id="presence"
                        checked={isOnline ?? false}
                        disabled={presenceMutation.isPending}
                        onCheckedChange={(checked) => presenceMutation.mutate(checked ? 'online' : 'away')}
                      />
                    </CardContent>
                  </Card>
                  <Card className="flex flex-col flex-1 overflow-hidden shadow-soft">
                    <CardHeader className="p-4 border-b bg-muted/50 shrink-0">
                       <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Traffic Queues</CardTitle>
                    </CardHeader>
                    <ScrollArea className="flex-1">
                      <div className="p-4 space-y-6">
                        {isLoadingQueues ? (
                          <div className="p-4 flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Loading queues...
                          </div>
                        ) : (
                          <div className="space-y-3 pb-6 border-b border-slate-200 mx-4 mt-4">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                              Queue Membership ({queues.filter((q: any) => !q.isDeleted && q.assignedAgentIds?.includes(userId || '')).length})
                            </p>
                            {queues.filter((q: any) => !q.isDeleted).map((q: any) => (
                              <div key={q.id} className="group flex items-center space-x-3 p-3 rounded-xl border cursor-pointer hover:bg-accent hover:shadow-sm transition-all">
                                <Checkbox
                                  id={`queue-${q.id}`}
                                  checked={q.assignedAgentIds?.includes(userId || '')}
                                  onCheckedChange={(checked) => membershipMutation.mutate({ queueId: q.id, action: checked ? 'join' : 'leave' })}
                                />
                                <Label htmlFor={`queue-${q.id}`} className="text-sm font-medium cursor-pointer flex-1">
                                  {q.name}
                                </Label>
                                <div className="text-[10px] text-muted-foreground hidden md:block">
                                  {q.priority}p /{q.capacityMax}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">My Batch ({myChats.length})</p>
                          <AnimatePresence mode="popLayout">
                            {myChats.map(c => (
                              <motion.div
                                key={c.id}
                                layout
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                onClick={() => setActiveId(c.id)}
                                className={cn(
                                  "p-3 rounded-xl cursor-pointer border transition-all text-sm",
                                  activeId === c.id ? "bg-primary text-primary-foreground border-primary shadow-md" : "hover:bg-accent/50 bg-background"
                                )}
                              >
                                <div className="font-bold truncate">{c.contactName || 'Visitor'}</div>
                                <div className={cn("text-[10px] mt-1", activeId === c.id ? "text-primary-foreground/70" : "text-muted-foreground")}>
                                  {formatDistanceToNow(c.updatedAt, { addSuffix: true })}
                                </div>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                          {myChats.length === 0 && <p className="text-[10px] italic text-muted-foreground p-2 text-center">No active chats</p>}
                        </div>
                        <div className="space-y-2 pt-4 border-t">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Unassigned ({unassigned.length})</p>
                          <AnimatePresence mode="popLayout">
                            {unassigned.map(c => (
                              <motion.div
                                key={c.id}
                                layout
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="p-3 rounded-xl border bg-slate-50/50 space-y-2 border-dashed"
                              >
                                <div className="font-medium text-xs truncate">{c.contactName || 'Visitor'}</div>
                                <Button size="sm" variant="outline" className="w-full h-7 text-[10px] font-bold uppercase bg-white" onClick={() => claimConversation(c.id)}>Claim Session</Button>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                          {unassigned.length === 0 && <p className="text-[10px] italic text-muted-foreground p-2 text-center">Queues are clear</p>}
                        </div>
                      </div>
                    </ScrollArea>
                  </Card>
                </div>
                <Card className="col-span-6 flex flex-col overflow-hidden shadow-soft h-full relative">
                  {!activeId ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-12 text-center bg-slate-50/30">
                       <div className="w-20 h-20 bg-background rounded-3xl shadow-sm border flex items-center justify-center mb-6"><MessageCircle className="w-10 h-10 text-slate-200" /></div>
                       <h3 className="font-bold text-foreground text-lg">Select a Session</h3>
                       <p className="text-sm max-w-[240px] mx-auto mt-2">Claim a chat from the left panel to start a conversation with a visitor.</p>
                    </div>
                  ) : (
                    <>
                      <div className="p-4 border-b bg-background flex justify-between items-center shadow-sm z-10 shrink-0">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-xs font-bold">{activeConv?.contactName?.[0] || 'V'}</div>
                          <div className="flex flex-col">
                            <span className="font-bold text-foreground leading-tight">{activeConv?.contactName}</span>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">{activeConv?.status}</span>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => endConversation(activeId)} className="text-destructive hover:bg-destructive/10 hover:text-destructive font-bold text-xs"><Power className="w-3 h-3 mr-2" /> Close Chat</Button>
                      </div>
                      <ScrollArea className="flex-1 p-6 bg-slate-50/20">
                        <div className="space-y-6">
                          {messages.map(m => (
                            <motion.div
                              key={m.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={cn("flex flex-col max-w-[85%]", m.senderType === 'agent' ? "ml-auto items-end" : "mr-auto items-start")}
                            >
                              <div className={cn(
                                "px-4 py-2.5 rounded-2xl text-sm shadow-sm",
                                m.senderType === 'agent' ? "bg-primary text-primary-foreground rounded-br-none" : "bg-white border text-foreground rounded-bl-none"
                              )}>
                                {m.content}
                              </div>
                              <span className="text-[10px] text-muted-foreground mt-1.5 px-1 font-medium">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </motion.div>
                          ))}
                          <div ref={scrollRef} />
                        </div>
                      </ScrollArea>
                      <div className="p-4 border-t bg-white shrink-0">
                        <form onSubmit={handleSend} className="flex gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200 focus-within:ring-2 focus-within:ring-primary/20 focus-within:bg-white transition-all">
                          <Input placeholder="Type a message..." className="bg-transparent border-0 shadow-none focus-visible:ring-0 text-sm" value={msgInput} onChange={(e) => setMsgInput(e.target.value)} />
                          <Button type="submit" size="icon" className="shrink-0 h-10 w-10 rounded-lg shadow-lg" disabled={!msgInput.trim()}><Send className="w-4 h-4" /></Button>
                        </form>
                      </div>
                    </>
                  )}
                </Card>
                <div className="col-span-3 flex flex-col gap-4">
                  <Card className="flex flex-col overflow-hidden shadow-sm shrink-0">
                    <CardHeader className="p-4 border-b bg-muted/50">
                       <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Visitor Profile</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 text-center">
                      {activeConv ? (
                        <div className="space-y-6">
                          <div className="w-20 h-20 bg-slate-100 rounded-full mx-auto flex items-center justify-center border-4 border-white shadow-xl"><UserIcon className="w-10 h-10 text-slate-300" /></div>
                          <div>
                            <h4 className="font-bold text-lg text-foreground">{activeConv.contactName || 'Visitor'}</h4>
                            <p className="text-xs text-muted-foreground truncate px-2 font-mono">{activeConv.contactEmail || 'No email verified'}</p>
                          </div>
                          <div className="pt-6 border-t text-left space-y-4">
                            <div><label className="text-[10px] font-bold text-muted-foreground uppercase">Session Created</label><p className="text-sm font-medium">{formatDistanceToNow(activeConv.createdAt)} ago</p></div>
                          </div>
                        </div>
                      ) : (
                        <div className="py-12 opacity-30 text-center"><UserIcon className="w-12 h-12 mx-auto text-muted-foreground" /><p className="text-[10px] mt-2 uppercase font-bold tracking-widest">Inactive</p></div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="inbox" className="mt-0">
              <Card className="shadow-soft border-none ring-1 ring-slate-200">
                <CardHeader className="border-b">
                  <CardTitle>Offline Leads</CardTitle>
                  <CardDescription>Customer inquiries captured when the queue was unavailable.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-slate-50/50">
                      <TableRow>
                        <TableHead className="px-6">Visitor</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Received</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right px-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {offlineRequests.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-16 text-muted-foreground italic">No offline requests found</TableCell></TableRow>
                      ) : offlineRequests.map(r => (
                        <TableRow key={r.id}>
                          <TableCell className="px-6">
                            <div className="font-bold">{r.visitorName}</div>
                            <div className="text-xs text-muted-foreground font-mono">{r.visitorEmail}</div>
                          </TableCell>
                          <TableCell className="max-w-xs truncate">{r.subject}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant={r.status === 'pending' ? 'outline' : 'secondary'} className={cn(r.status === 'pending' ? "text-amber-600 bg-amber-50 border-amber-100" : "bg-emerald-50 text-emerald-600 border-emerald-100")}>
                              {r.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right px-6">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 rounded-lg font-bold text-xs"
                              onClick={() => dispatchMutation.mutate(r.id)}
                              disabled={r.status !== 'pending' || dispatchMutation.isPending}
                            >
                              {dispatchMutation.isPending && dispatchMutation.variables === r.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : r.status === 'pending' ? (
                                'Dispatch'
                              ) : (
                                <Check className="w-4 h-4" />
                              )}
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
                    { label: 'Avg Response', value: `${metrics?.avgResponseTime ?? 0}s`, icon: Clock, color: "text-cyan-600" },
                    { label: 'Success Rate', value: `${metrics?.resolutionRate ?? 0}%`, icon: MailCheck, color: "text-emerald-600" },
                    { label: 'Live Agents', value: metrics?.activeAgents ?? 0, icon: UserIcon, color: "text-primary" },
                    { label: 'Total Traffic', value: metrics?.totalConvs ?? 0, icon: MessageCircle, color: "text-slate-900" },
                  ].map(stat => (
                    <Card key={stat.label} className="shadow-sm border-none ring-1 ring-slate-200">
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start mb-2">
                           <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{stat.label}</p>
                           <stat.icon className={cn("w-4 h-4", stat.color)} />
                        </div>
                        <h3 className="text-3xl font-black text-foreground tracking-tight">{stat.value}</h3>
                      </CardContent>
                    </Card>
                  ))}
               </div>
               <Card className="shadow-soft border-none ring-1 ring-slate-200">
                  <CardHeader className="border-b"><CardTitle>Conversation Activity (24h)</CardTitle></CardHeader>
                  <CardContent className="pt-8">
                    <div className="h-[400px] w-full">
                      <ChartContainer config={{ value: { label: "Conversations", color: "hsl(var(--primary))" } }}>
                        <BarChart data={metrics?.hourlyMessageVolume || []}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="timestamp" axisLine={false} tickLine={false} fontSize={10} fontWeight="bold" tick={{ fill: '#94a3b8' }} />
                          <YAxis axisLine={false} tickLine={false} fontSize={10} fontWeight="bold" tick={{ fill: '#94a3b8' }} />
                          <Tooltip
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'bold' }}
                            cursor={{ fill: '#f8fafc' }}
                          />
                          <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ChartContainer>
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