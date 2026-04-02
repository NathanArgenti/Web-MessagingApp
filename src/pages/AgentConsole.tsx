import React, { useState, useEffect, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store';
import { useChat } from '@/hooks/use-chat';
import { Conversation, ApiResponse, PresenceStatus } from '@shared/types';
import { MessageCircle, User as UserIcon, Send, Clock, Power } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
export function AgentConsole() {
  const token = useAuthStore(s => s.token);
  const userId = useAuthStore(s => s.user?.id);
  const activeId = useAuthStore(s => s.activeConversationId);
  const setActiveId = useAuthStore(s => s.setActiveConversationId);
  const presence = useAuthStore(s => s.presenceStatus);
  const setPresence = useAuthStore(s => s.setPresenceStatus);
  const [msgInput, setMsgInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      if (!token) return [];
      const res = await fetch('/api/conversations', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json() as ApiResponse<Conversation[]>;
      return json.data ?? [];
    },
    refetchInterval: 5000,
    enabled: !!token,
  });
  const { messages, sendMessage, claimConversation, endConversation } = useChat(activeId);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgInput.trim()) return;
    sendMessage(msgInput);
    setMsgInput('');
  };
  const handlePresenceToggle = async (checked: boolean) => {
    const status: PresenceStatus = checked ? 'online' : 'away';
    setPresence(status);
    await fetch('/api/presence', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status })
    });
  };
  const myChats = (conversations ?? []).filter(c => c.ownerId === userId && c.status === 'owned');
  const unassigned = (conversations ?? []).filter(c => c.status === 'unassigned');
  const activeConv = (conversations ?? []).find(c => c.id === activeId);
  return (
    <MainLayout>
      <div className="h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden">
        <div className="border-b bg-white px-6 py-3 flex justify-between items-center shadow-sm z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-slate-800">Agent Workspace</h2>
            <Badge variant="outline" className="text-cyan-600 bg-cyan-50 border-cyan-200">
              {myChats.length} Active
            </Badge>
          </div>
          <div className="flex items-center space-x-3 bg-slate-50 px-3 py-1.5 rounded-full border">
            <Label htmlFor="presence" className="text-xs font-semibold text-slate-600">
              {presence === 'online' ? 'Available' : 'Away'}
            </Label>
            <Switch
              id="presence"
              checked={presence === 'online'}
              onCheckedChange={handlePresenceToggle}
              className="data-[state=checked]:bg-cyan-500"
            />
          </div>
        </div>
        <div className="flex-1 grid grid-cols-12 overflow-hidden">
          <div className="col-span-3 border-r bg-slate-50/50 flex flex-col">
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-6">
                <div>
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Clock className="w-3 h-3" /> My Conversations
                  </h3>
                  <div className="space-y-2">
                    {myChats.map(c => (
                      <Card
                        key={c.id}
                        onClick={() => setActiveId(c.id)}
                        className={cn(
                          "p-3 cursor-pointer transition-all hover:shadow-md border-transparent",
                          activeId === c.id ? "bg-white border-cyan-500 shadow-md ring-1 ring-cyan-500" : "bg-white/50"
                        )}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <p className="text-sm font-bold text-slate-700 truncate">{c.contactName}</p>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(c.updatedAt, { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate italic">Active session...</p>
                      </Card>
                    ))}
                    {myChats.length === 0 && <p className="text-xs text-muted-foreground italic p-2 text-center">No owned chats</p>}
                  </div>
                </div>
                <div>
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <MessageCircle className="w-3 h-3" /> Unassigned Queues
                  </h3>
                  <div className="space-y-2">
                    {unassigned.map(c => (
                      <Card key={c.id} className="p-3 bg-white/80 border-dashed">
                        <div className="flex justify-between items-start mb-2">
                          <p className="text-sm font-medium text-slate-700">{c.contactName}</p>
                          <Badge className="text-[10px] bg-amber-100 text-amber-700 hover:bg-amber-100">Waiting</Badge>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full text-xs h-7 border-cyan-200 text-cyan-700 hover:bg-cyan-50"
                          onClick={() => claimConversation(c.id)}
                        >
                          Claim Chat
                        </Button>
                      </Card>
                    ))}
                    {unassigned.length === 0 && <p className="text-xs text-muted-foreground italic p-2 text-center">Queues are empty</p>}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
          <div className="col-span-6 flex flex-col bg-white">
            {!activeId ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                  <MessageCircle className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-sm font-medium">Select a conversation to start chatting</p>
              </div>
            ) : (
              <>
                <ScrollArea className="flex-1 p-6">
                  <div className="space-y-4">
                    <AnimatePresence initial={false}>
                      {(messages ?? []).map((m) => (
                        <motion.div
                          key={m.id}
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          className={cn(
                            "flex flex-col max-w-[80%]",
                            m.senderType === 'agent' ? "ml-auto items-end" : "mr-auto items-start"
                          )}
                        >
                          <div className={cn(
                            "px-4 py-2.5 rounded-2xl text-sm shadow-sm",
                            m.senderType === 'agent'
                              ? "bg-cyan-600 text-white rounded-br-none"
                              : "bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200"
                          )}>
                            {m.content}
                          </div>
                          <span className="text-[10px] text-muted-foreground mt-1 px-1">
                            {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    <div ref={scrollRef} />
                  </div>
                </ScrollArea>
                <div className="p-4 border-t bg-slate-50/80 backdrop-blur-sm">
                  <form onSubmit={handleSend} className="flex gap-2 bg-white p-1 rounded-lg border shadow-sm focus-within:ring-2 focus-within:ring-cyan-500/20 transition-all">
                    <Input
                      placeholder="Type your response..."
                      className="border-0 focus-visible:ring-0 shadow-none h-10"
                      value={msgInput}
                      onChange={(e) => setMsgInput(e.target.value)}
                    />
                    <Button
                      type="submit"
                      size="icon"
                      className="bg-cyan-600 hover:bg-cyan-700 h-10 w-10 shrink-0"
                      disabled={!msgInput.trim()}
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </form>
                </div>
              </>
            )}
          </div>
          <div className="col-span-3 border-l bg-slate-50/50">
             <ScrollArea className="h-full p-6">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Contact Profile</h3>
                {activeConv ? (
                  <div className="space-y-6">
                    <div className="text-center">
                      <div className="w-20 h-20 bg-gradient-to-br from-cyan-500 to-indigo-500 rounded-full mx-auto mb-4 flex items-center justify-center text-white shadow-lg">
                        <UserIcon className="w-10 h-10" />
                      </div>
                      <h4 className="font-bold text-lg text-slate-800">{activeConv.contactName}</h4>
                      <p className="text-xs text-muted-foreground">{activeConv.contactEmail || 'No email provided'}</p>
                    </div>
                    <div className="space-y-4 pt-4 border-t">
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        className="w-full gap-2"
                        onClick={() => endConversation(activeConv.id)}
                      >
                        <Power className="w-4 h-4" /> End Conversation
                      </Button>
                      <div>
                        <Label className="text-[10px] uppercase text-slate-400 font-bold">Status</Label>
                        <div className="mt-1">
                          <Badge variant="outline" className="capitalize text-cyan-600 bg-cyan-50 border-cyan-100">
                            {activeConv.status}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase text-slate-400 font-bold">Created</Label>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {new Date(activeConv.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase text-slate-400 font-bold">Conversation ID</Label>
                        <p className="text-[10px] font-mono text-slate-400 mt-0.5 break-all">
                          {activeConv.id}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-12 h-12 bg-slate-200 rounded-full mx-auto mb-4 flex items-center justify-center opacity-50">
                      <UserIcon className="w-6 h-6 text-slate-400" />
                    </div>
                    <p className="text-xs text-muted-foreground italic">No participant data</p>
                  </div>
                )}
             </ScrollArea>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}