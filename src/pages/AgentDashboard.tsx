import React, { useState, useEffect, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store';
import { useChat } from '@/hooks/use-chat';
import { Conversation, ApiResponse, PresenceStatus, OfflineRequest, SystemMetrics } from '@shared/types';
import { MessageCircle, User as UserIcon, Send, Clock, Power, Inbox, BarChart3, Database, MailCheck, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { toast } from 'sonner';
export function AgentDashboard() {
  const token = useAuthStore(s => s.token);
  const userId = useAuthStore(s => s.user?.id);
  const userName = useAuthStore(s => s.user?.name);
  const userRole = useAuthStore(s => s.user?.role);
  const selectedTenantId = useAuthStore(s => s.selectedTenantId);
  const activeId = useAuthStore(s => s.activeConversationId);
  const setActiveId = useAuthStore(s => s.setActiveConversationId);
  const [msgInput, setMsgInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  // Queries
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
      return json.data!;
    },
    refetchInterval: 30000,
    enabled: !!token && !!selectedTenantId,
  });
  const { messages, sendMessage, claimConversation, endConversation } = useChat(activeId);
  const dispatchOffline = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/internal/offline/${id}/dispatch`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`, 
            'X-Tenant-ID': selectedTenantId || '' 
        },
        body: JSON.stringify({ agentName: userName })
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offline', selectedTenantId] });
      toast.success('Offline request marked as dispatched');
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
  const myChats = conversations.filter(c => c.ownerId === userId && c.status === 'owned');
  const unassigned = conversations.filter(c => c.status === 'unassigned');
  const activeConv = conversations.find(c => c.id === activeId);
  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-6 flex flex-col gap-6">
          <Tabs defaultValue="live" className="w-full">
            <div className="flex items-center justify-between mb-4">
              <TabsList className="bg-slate-100 border p-1">
                <TabsTrigger value="live" className="gap-2"><MessageCircle className="w-4 h-4" /> Live</TabsTrigger>
                <TabsTrigger value="inbox" className="gap-2"><Inbox className="w-4 h-4" /> Inbox</TabsTrigger>
                <TabsTrigger value="insights" className="gap-2"><BarChart3 className="w-4 h-4" /> Insights</TabsTrigger>
                {userRole === 'superadmin' && <TabsTrigger value="platform" className="gap-2"><Database className="w-4 h-4" /> Platform</TabsTrigger>}
              </TabsList>
            </div>
            <TabsContent value="live" className="mt-0">
              <div className="h-[calc(100vh-14rem)] grid grid-cols-12 gap-4">
                <Card className="col-span-3 flex flex-col overflow-hidden shadow-sm">
                   <CardHeader className="p-4 border-b">
                      <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <Clock className="w-4 h-4" /> Queues
                      </CardTitle>
                   </CardHeader>
                   <ScrollArea className="flex-1">
                      <div className="p-3 space-y-4">
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">My Chats</p>
                          {myChats.map(c => (
                            <div 
                              key={c.id} 
                              onClick={() => setActiveId(c.id)}
                              className={cn(
                                "p-3 rounded-lg cursor-pointer border transition-all text-sm",
                                activeId === c.id ? "bg-cyan-50 border-cyan-500 shadow-sm" : "hover:bg-slate-50 bg-white"
                              )}
                            >
                              <div className="font-bold truncate">{c.contactName}</div>
                              <div className="text-xs text-muted-foreground">{formatDistanceToNow(c.updatedAt, { addSuffix: true })}</div>
                            </div>
                          ))}
                          {myChats.length === 0 && <p className="text-xs italic text-muted-foreground text-center p-4">No active chats</p>}
                        </div>
                        <div className="space-y-2 pt-2 border-t">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Unassigned</p>
                          {unassigned.map(c => (
                            <div key={c.id} className="p-3 rounded-lg border bg-white space-y-2">
                              <div className="font-medium text-sm">{c.contactName}</div>
                              <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={() => claimConversation(c.id)}>Claim</Button>
                            </div>
                          ))}
                          {unassigned.length === 0 && <p className="text-xs italic text-muted-foreground text-center p-4">Queue empty</p>}
                        </div>
                      </div>
                   </ScrollArea>
                </Card>
                <Card className="col-span-6 flex flex-col overflow-hidden shadow-sm relative">
                  {!activeId ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-12 text-center">
                       <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4"><MessageCircle className="w-8 h-8 text-slate-300" /></div>
                       <h3 className="font-bold text-slate-700">Waiting for interaction</h3>
                       <p className="text-sm">Select a conversation from the queue to start responding.</p>
                    </div>
                  ) : (
                    <>
                      <div className="p-4 border-b bg-white flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center text-white text-xs font-bold">{activeConv?.contactName[0]}</div>
                          <span className="font-bold">{activeConv?.contactName}</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => endConversation(activeId)} className="text-destructive hover:bg-destructive/10"><Power className="w-4 h-4 mr-2" /> End</Button>
                      </div>
                      <ScrollArea className="flex-1 p-6">
                        <div className="space-y-4">
                          {messages.map(m => (
                            <div key={m.id} className={cn("flex flex-col max-w-[85%]", m.senderType === 'agent' ? "ml-auto items-end" : "mr-auto items-start")}>
                              <div className={cn("px-4 py-2 rounded-2xl text-sm", m.senderType === 'agent' ? "bg-cyan-600 text-white rounded-br-none" : "bg-slate-100 border text-slate-800 rounded-bl-none")}>
                                {m.content}
                              </div>
                              <span className="text-[10px] text-muted-foreground mt-1 px-1">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          ))}
                          <div ref={scrollRef} />
                        </div>
                      </ScrollArea>
                      <div className="p-4 border-t bg-slate-50">
                        <form onSubmit={handleSend} className="flex gap-2">
                          <Input placeholder="Type a message..." className="bg-white" value={msgInput} onChange={(e) => setMsgInput(e.target.value)} />
                          <Button type="submit" size="icon" className="bg-cyan-600 shrink-0" disabled={!msgInput.trim()}><Send className="w-4 h-4" /></Button>
                        </form>
                      </div>
                    </>
                  )}
                </Card>
                <Card className="col-span-3 flex flex-col overflow-hidden shadow-sm">
                   <CardHeader className="p-4 border-b">
                      <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Profile</CardTitle>
                   </CardHeader>
                   <CardContent className="p-6 text-center">
                      {activeConv ? (
                        <div className="space-y-6">
                          <div className="w-20 h-20 bg-slate-100 rounded-full mx-auto flex items-center justify-center"><UserIcon className="w-10 h-10 text-slate-400" /></div>
                          <div>
                            <h4 className="font-bold text-lg">{activeConv.contactName}</h4>
                            <p className="text-xs text-muted-foreground">{activeConv.contactEmail || 'visitor@anon.com'}</p>
                          </div>
                          <div className="pt-6 border-t text-left space-y-4">
                            <div><label className="text-[10px] font-bold text-slate-400 uppercase">Queue</label><p className="text-sm">General Support</p></div>
                            <div><label className="text-[10px] font-bold text-slate-400 uppercase">Wait Time</label><p className="text-sm">{formatDistanceToNow(activeConv.createdAt)}</p></div>
                          </div>
                        </div>
                      ) : (
                        <div className="py-12 opacity-50"><UserIcon className="w-10 h-10 mx-auto text-slate-300" /><p className="text-xs mt-2">No user selected</p></div>
                      )}
                   </CardContent>
                </Card>
              </div>
            </TabsContent>
            <TabsContent value="inbox" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>Offline Leads</CardTitle>
                  <CardDescription>Customer inquiries captured when no agents were available.</CardDescription>
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
                            <div className="font-medium">{r.visitorName}</div>
                            <div className="text-xs text-muted-foreground">{r.visitorEmail}</div>
                          </TableCell>
                          <TableCell className="max-w-xs truncate">{r.subject}</TableCell>
                          <TableCell className="text-xs">{new Date(r.createdAt).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant={r.status === 'pending' ? 'outline' : 'secondary'} className={r.status === 'pending' ? 'text-amber-600 bg-amber-50 border-amber-200' : ''}>
                              {r.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                             {r.status === 'pending' ? (
                               <Button size="sm" className="gap-2" onClick={() => dispatchOffline.mutate(r.id)} disabled={dispatchOffline.isPending}>
                                 <MailCheck className="w-4 h-4" /> Dispatch
                               </Button>
                             ) : (
                               <span className="text-xs text-muted-foreground">By {r.dispatchedBy}</span>
                             )}
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
                    { label: 'Avg Response', value: `${metrics?.avgResponseTime ?? 0}s`, desc: 'Across all channels', icon: Clock },
                    { label: 'Resolution Rate', value: `${metrics?.resolutionRate ?? 0}%`, desc: 'Closed in first 24h', icon: MailCheck },
                    { label: 'Active Agents', value: metrics?.activeAgents ?? 0, desc: 'Currently online', icon: UserIcon },
                    { label: 'Total Convs', value: metrics?.totalConvs ?? 0, desc: 'Lifetime volume', icon: MessageCircle },
                  ].map(stat => (
                    <Card key={stat.label}>
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start mb-2">
                           <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                           <stat.icon className="w-4 h-4 text-cyan-600" />
                        </div>
                        <h3 className="text-2xl font-bold">{stat.value}</h3>
                        <p className="text-xs text-slate-500 mt-1">{stat.desc}</p>
                      </CardContent>
                    </Card>
                  ))}
               </div>
               <Card>
                  <CardHeader><CardTitle>Conversation Volume (24h)</CardTitle></CardHeader>
                  <CardContent>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={metrics?.hourlyMessageVolume || []}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="timestamp" axisLine={false} tickLine={false} fontSize={12} tick={{ fill: '#94a3b8' }} />
                          <YAxis axisLine={false} tickLine={false} fontSize={12} tick={{ fill: '#94a3b8' }} />
                          <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            cursor={{ fill: '#f8fafc' }}
                          />
                          <Bar dataKey="value" fill="#06B6D4" radius={[4, 4, 0, 0]} />
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