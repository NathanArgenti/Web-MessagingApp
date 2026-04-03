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
import { Conversation, ApiResponse, PresenceStatus, OfflineRequest, SystemMetrics, Queue, SystemEvent } from '@shared/types';
import { MessageCircle, User as UserIcon, Send, Clock, Power, Inbox, BarChart3, MailCheck, Check, Loader2, Zap, History } from 'lucide-react';
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
  const selectedTenantId = useAuthStore(s => s.selectedTenantId);
  const activeId = useAuthStore(s => s.activeConversationId);
  const setActiveId = useAuthStore(s => s.setActiveConversationId);
  const userId = user?.id;
  const presenceStatus = user?.presenceStatus;
  const isOnline = user?.isOnline;
  const effectiveTenantId = selectedTenantId || user?.tenantId || '';
  const [msgInput, setMsgInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations', effectiveTenantId],
    queryFn: async () => {
      if (!token || !effectiveTenantId) return [];
      const res = await fetch('/api/conversations', {
        headers: { 'Authorization': `Bearer ${token}`, 'X-Tenant-ID': effectiveTenantId }
      });
      const json = await res.json() as ApiResponse<Conversation[]>;
      return json.data ?? [];
    },
    refetchInterval: 5000,
    enabled: !!token && !!effectiveTenantId,
  });
  const { data: eventLog = [] } = useQuery({
    queryKey: ['admin', 'events', effectiveTenantId],
    queryFn: async () => {
      const res = await fetch('/api/admin/events', {
        headers: { 'Authorization': `Bearer ${token}`, 'X-Tenant-ID': effectiveTenantId }
      });
      const json = await res.json() as ApiResponse<SystemEvent[]>;
      return json.data ?? [];
    },
    refetchInterval: 10000,
    enabled: !!token && !!effectiveTenantId,
  });

  const { data: queuesResponse = {data: [] as Queue[]}, refetch: refetchQueues } = useQuery({
    queryKey: ['queues', effectiveTenantId],
    queryFn: async () => {
      if (!token || !effectiveTenantId) throw new Error('Missing auth');
      const res = await fetch('/api/queues', {
        headers: { 'Authorization': `Bearer ${token}`, 'X-Tenant-ID': effectiveTenantId }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to fetch queues');
      }
      return res.json() as Promise<ApiResponse<Queue[]>>;
    },
    enabled: !!token && !!effectiveTenantId,
    refetchInterval: 10000
  });
  const queues: Queue[] = queuesResponse.data ?? [];

  const toggleQueueMutation = useMutation({
    mutationFn: async (queueId: string) => {
      const queuesData = queryClient.getQueryData<ApiResponse<Queue[]>>(['queues', effectiveTenantId]);
      const queue = (queuesData?.data ?? []).find(q => q.id === queueId);
      if (!queue || !userId) throw new Error('Invalid queue or user');
      const isJoined = queue.assignedAgentIds?.includes(userId) ?? false;
      const endpoint = `/api/queues/${queueId}/${isJoined ? 'leave' : 'join'}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'X-Tenant-ID': effectiveTenantId! }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Toggle failed');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queues', effectiveTenantId] });
      toast.success('Queue availability updated');
    },
    onError: (error: any) => toast.error(error.message),
  });
  // Cleanup stale active conversation focus
  useEffect(() => {
    if (activeId && conversations.length > 0) {
      const stillActive = conversations.find(c => c.id === activeId && c.status !== 'ended');
      if (!stillActive) {
        setActiveId(null);
      }
    }
  }, [conversations, activeId, setActiveId]);
  const { messages, sendMessage, claimConversation, endConversation, isEnding } = useChat(activeId);
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
                <p className="text-sm text-muted-foreground">Manage presence and active sessions.</p>
              </div>
              <TabsList className="bg-secondary p-1">
                <TabsTrigger value="live" className="gap-2"><MessageCircle className="w-4 h-4" /> Live</TabsTrigger>
                <TabsTrigger value="history" className="gap-2"><History className="w-4 h-4" /> Event Log</TabsTrigger>
                <TabsTrigger value="inbox" className="gap-2"><Inbox className="w-4 h-4" /> Offline</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="live" className="mt-0 h-[calc(100vh-16rem)] min-h-[600px]">
              <div className="h-full grid grid-cols-12 gap-6">
                <div className="col-span-3 flex flex-col gap-4 overflow-hidden">
                  <Card className="shadow-sm shrink-0">
                    <CardHeader className="p-4 border-b bg-muted/50"><CardTitle className="text-xs font-bold uppercase text-muted-foreground">Status</CardTitle></CardHeader>
                    <CardContent className="p-4 flex items-center justify-between">
                      <span className="text-sm font-bold capitalize">{presenceStatus}</span>
                      <Switch checked={isOnline} onCheckedChange={(c) => toast.info('Updating presence...')} />
                    </CardContent>
                  </Card>
                  <Card className="flex flex-col flex-1 overflow-hidden shadow-soft">
                    <CardHeader className="p-4 border-b bg-muted/50 shrink-0"><CardTitle className="text-xs font-bold uppercase text-muted-foreground">Sessions</CardTitle></CardHeader>
                    <ScrollArea className="flex-1">
                      <div className="p-4 space-y-6">
                         <div className="space-y-2">
                           <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Active ({myChats.length})</p>
                           {myChats.map(c => (
                             <div key={c.id} onClick={() => setActiveId(c.id)} className={cn("p-3 rounded-xl border cursor-pointer transition-all", activeId === c.id ? "bg-primary text-primary-foreground border-primary" : "bg-white hover:bg-slate-50")}>
                               <p className="font-bold truncate">{c.contactName}</p>
                               <p className="text-[10px] opacity-70">Updated {formatDistanceToNow(c.updatedAt)} ago</p>
                             </div>
                           ))}
                         </div>
                         <div className="space-y-2 border-t pt-4">
                           <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Claimable ({unassigned.length})</p>
                           {unassigned.map(c => (
                             <div key={c.id} className="p-3 rounded-xl border bg-slate-50/50 border-dashed space-y-2">
                               <p className="text-xs font-bold truncate">{c.contactName}</p>
                               <Button size="sm" variant="outline" className="w-full h-7 text-[10px] uppercase font-bold" onClick={() => claimConversation(c.id)}>Claim</Button>
                             </div>
                           ))}
                         </div>
                      </div>
                    </ScrollArea>
                  </Card>
                  <Card className="flex-1 shadow-sm overflow-hidden">
                    <CardHeader className="p-4 border-b bg-muted/50"><CardTitle className="text-xs font-bold uppercase text-muted-foreground">Queues</CardTitle></CardHeader>
                    <CardContent className="p-4 space-y-3 max-h-80 overflow-y-auto">
                      {queues.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-12 italic">No queues configured</p>
                      ) : (
                        queues.map((q) => {
                          const isJoined = (q.assignedAgentIds || []).includes(userId || '');
                          return (
                            <div key={q.id} className="flex items-center justify-between p-3 rounded-lg border bg-card/50 hover:bg-card transition-all">
                              <div className="space-y-1 flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{q.name}</p>
                                <p className="text-xs text-muted-foreground">Priority {q.priority} • Capacity {q.assignedAgentIds?.length || 0}/{q.capacityMax}</p>
                              </div>
                              <Switch 
                                checked={isJoined} 
                                onCheckedChange={() => toggleQueueMutation.mutate(q.id)} 
                                disabled={!userId || toggleQueueMutation.isPending} 
                              />
                            </div>
                          );
                        })
                      )}
                    </CardContent>
                  </Card>
                </div>
                <Card className="col-span-9 flex flex-col overflow-hidden shadow-soft h-full">
                  {!activeId ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50/30">
                       <MessageCircle className="w-12 h-12 text-slate-200 mb-4" />
                       <h3 className="font-bold text-foreground">Select a session</h3>
                       <p className="text-sm text-muted-foreground">Select a conversation to start messaging visitors.</p>
                    </div>
                  ) : (
                    <>
                      <div className="p-4 border-b bg-background flex justify-between items-center shadow-sm z-10">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">{activeConv?.contactName?.[0]}</div>
                          <div><p className="font-bold">{activeConv?.contactName}</p><p className="text-[10px] uppercase text-muted-foreground">{activeConv?.status}</p></div>
                        </div>
                        <Button variant="ghost" size="sm" disabled={isEnding} onClick={() => endConversation(activeId)} className="text-destructive font-bold h-8">
                          {isEnding ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Power className="w-3 h-3 mr-2" />}
                          Close Chat
                        </Button>
                      </div>
                      <ScrollArea className="flex-1 p-6">
                        <div className="space-y-4">
                          {messages.map(m => (
                            <div key={m.id} className={cn("flex flex-col max-w-[80%]", m.senderType === 'agent' ? "ml-auto items-end" : "items-start")}>
                              <div className={cn("px-4 py-2 rounded-2xl text-sm shadow-sm", m.senderType === 'agent' ? "bg-primary text-primary-foreground" : "bg-white border")}>{m.content}</div>
                              <span className="text-[10px] text-muted-foreground mt-1">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          ))}
                          <div ref={scrollRef} />
                        </div>
                      </ScrollArea>
                      <div className="p-4 border-t bg-white">
                        <form onSubmit={handleSend} className="flex gap-2 p-1 rounded-xl border bg-slate-50">
                          <Input value={msgInput} onChange={e => setMsgInput(e.target.value)} placeholder="Type a message..." className="bg-transparent border-0 shadow-none focus-visible:ring-0" />
                          <Button size="icon" disabled={!msgInput.trim()} type="submit"><Send className="w-4 h-4" /></Button>
                        </form>
                      </div>
                    </>
                  )}
                </Card>
              </div>
            </TabsContent>
            <TabsContent value="history">
              <Card className="border-none ring-1 ring-slate-200">
                <CardHeader className="border-b">
                  <CardTitle>Tenant Activity Stream</CardTitle>
                  <CardDescription>Auditing event-driven automation logs and lifecycle history.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="px-6">Timestamp</TableHead>
                        <TableHead>Event</TableHead>
                        <TableHead>Action Log</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {eventLog.map(ev => (
                        <TableRow key={ev.id}>
                          <TableCell className="px-6 py-4 text-xs font-mono">{new Date(ev.timestamp).toLocaleString()}</TableCell>
                          <TableCell><Badge variant="outline" className="capitalize">{ev.type.replace('.', ' ')}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{JSON.stringify(ev.payload)}</TableCell>
                          <TableCell><div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> <span className="text-xs">Executed</span></div></TableCell>
                        </TableRow>
                      ))}
                      {eventLog.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-10 italic text-muted-foreground">No events recorded</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </MainLayout>
  );
}