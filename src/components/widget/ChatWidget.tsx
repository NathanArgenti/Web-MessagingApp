import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, X, Send, Loader2, Mail, CheckCircle2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ApiResponse, Message, PublicConfig, Conversation, QueueStatus } from '@shared/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
interface ChatWidgetProps {
  siteKey: string;
}
export default function ChatWidget({ siteKey }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [status, setStatus] = useState<QueueStatus | null>(null);
  const [session, setSession] = useState<{ convId: string, visitorId: string } | null>(null);
  const [isEnded, setIsEnded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [showOfflineForm, setShowOfflineForm] = useState(false);
  const [offlineSubmitted, setOfflineSubmitted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const clearChat = useCallback(() => {
    localStorage.removeItem(`mercury_session_${siteKey}`);
    setSession(null);
    setIsEnded(false);
    setMessages([]);
    setShowOfflineForm(false);
    setOfflineSubmitted(false);
  }, [siteKey]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const forceNew = params.get('newSession') === 'true';
    if (forceNew) {
      localStorage.removeItem(`mercury_session_${siteKey}`);
      return;
    }
    const saved = localStorage.getItem(`mercury_session_${siteKey}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSession(parsed);
      } catch (e) {
        console.error("Session parse error", e);
        localStorage.removeItem(`mercury_session_${siteKey}`);
      }
    }
  }, [siteKey]);
  useEffect(() => {
    if (!siteKey) return;
    fetch(`/api/public/config/${siteKey}`)
      .then(res => res.json())
      .then((json: ApiResponse<PublicConfig>) => {
        if (json.success) {
          setConfig(json.data!);
          if (json.data?.initialQueueStatus) setStatus(json.data.initialQueueStatus);
        }
      })
      .catch(err => console.error("Config fetch error", err));
  }, [siteKey]);
  useEffect(() => {
    if (!config?.tenantId || !isOpen || session) return;
    const pollStatus = () => {
      const qId = config?.defaultQueueId || config?.queues?.[0]?.id || '';
      if (!qId) {
        console.warn('No queue ID for status poll');
        return;
      }
      fetch(`/api/public/queue/${qId}/status`)
        .then(res => res.json())
        .then((json: ApiResponse<QueueStatus>) => {
          if (json.success) setStatus(json.data!);
        });
    };
    const interval = setInterval(pollStatus, 10000);
    pollStatus();
    return () => clearInterval(interval);
  }, [config, isOpen, session]);
  useEffect(() => {
    if (!session?.convId || !isOpen || isEnded) return;
    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/public/conversations/${session.convId}/status`);
        const json = await res.json() as ApiResponse<{ ended: boolean }>;
        if (json.success && json.data?.ended) {
          setIsEnded(true);
        }
      } catch (e) {
        console.error("Status check failed", e);
      }
    };
    const interval = setInterval(checkStatus, 4000);
    checkStatus();
    return () => {
      clearInterval(interval);
    };
  }, [session?.convId, isOpen, isEnded]);
  useEffect(() => {
    if (!session?.convId || !isOpen) return;
    const controller = new AbortController();
    const poll = async () => {
      try {
        const res = await fetch(`/api/conversations/${session.convId}/messages`, {
          signal: controller.signal
        });
        if (res.status === 404 || res.status === 403) {
          console.warn("Session invalid or conversation ended, clearing local state");
          clearChat();
          return;
        }
        const json = await res.json() as ApiResponse<Message[]>;
        if (json.success) {
          setMessages(json.data ?? []);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') console.error("Poll messages error", err);
      }
    };
    const interval = setInterval(poll, 4000);
    poll();
    return () => {
      clearInterval(interval);
      controller.abort();
    };
  }, [session?.convId, isOpen, clearChat]);
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  const startChat = useCallback(async () => {
    if (!config) return;
    const queueId = config?.defaultQueueId || config?.queues?.[0]?.id || '';
    if (!queueId) {
      toast.error('No queue configured');
      return;
    }
    setIsStarting(true);
    try {
      const visitorId = crypto.randomUUID?.() || Math.random().toString(36).substring(2);
      const res = await fetch('/api/public/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteKey,
          queueId,
          name: 'Visitor ' + visitorId.slice(0, 4),
        })
      });
      const json = await res.json() as ApiResponse<Conversation>;
      if (json.success) {
        const newSession = { convId: json.data!.id, visitorId };
        setSession(newSession);
        setMessages([]);
        localStorage.setItem(`mercury_session_${siteKey}`, JSON.stringify(newSession));
      } else {
        toast.error(json.error || "Could not start chat");
      }
    } catch (e) {
      toast.error("Connection failed");
    } finally {
      setIsStarting(false);
    }
  }, [config, siteKey]);
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !session) return;
    const content = input.trim();
    const tempId = `optimistic-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      conversationId: session.convId,
      senderId: session.visitorId,
      senderType: 'visitor',
      content,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setInput('');
    try {
      const res = await fetch(`/api/conversations/${session.convId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      const json = await res.json() as ApiResponse<Message>;
      if (!json.success) {
        throw new Error(json.error || "Failed to send");
      }
    } catch (err: any) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setInput(content);
      toast.error(err.message || "Message failed to send. Please try again.");
    }
  };
  const handleOfflineSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      tenantId: config?.tenantId,
      queueId: config?.defaultQueueId || config?.queues?.[0]?.id || '',
      visitorName: fd.get('name'),
      visitorEmail: fd.get('email'),
      subject: 'Offline Message',
      message: fd.get('message'),
    };
    try {
      const res = await fetch('/api/public/offline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setOfflineSubmitted(true);
        setTimeout(() => { setIsOpen(false); setOfflineSubmitted(false); setShowOfflineForm(false); }, 3000);
      }
    } catch (e) {
      toast.error("Failed to send message");
    }
  };
  if (!config) return null;
  const primaryColor = config.branding?.primaryColor ?? '#06B6D4';
  const positionClass = config.branding?.widgetPosition === 'bottom-left' ? 'left-6' : 'right-6';
  const isAvailable = status?.available ?? true;
  return (
    <div className={cn("fixed bottom-6 z-[100] font-sans", positionClass)}>
      {isOpen && (
        <div className="mb-4 w-[360px] h-[520px] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
            <div className="p-4 flex justify-between items-center text-white" style={{ backgroundColor: primaryColor }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold">{config.name}</h3>
              </div>
              <div className="flex items-center">
                {session && (
                    <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 mr-1" onClick={clearChat} title="Reset session">
                        <RotateCcw className="w-4 h-4" />
                    </Button>
                )}
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => setIsOpen(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>
            <div className="flex-1 flex flex-col bg-slate-50 relative overflow-hidden">
              {isEnded && (
                <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-6 h-6 text-slate-400" />
                  </div>
                  <h4 className="font-bold text-slate-800">Session Ended</h4>
                  <p className="text-sm text-slate-500 mb-6">The agent has closed this conversation. Thank you for reaching out!</p>
                  <Button variant="outline" size="sm" onClick={clearChat} className="rounded-xl">Start New Chat</Button>
                </div>
              )}
              {offlineSubmitted ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center animate-pulse scale-100">
                    <CheckCircle2 className="w-10 h-10 text-green-500" />
                  </div>
                  <h4 className="font-bold text-slate-800">Message Sent</h4>
                  <p className="text-sm text-slate-500">We've received your request and will get back to you soon.</p>
                </div>
              ) : showOfflineForm ? (
                <ScrollArea className="flex-1 p-6">
                  <form onSubmit={handleOfflineSubmit} className="space-y-4">
                    <div className="space-y-1">
                      <h4 className="font-bold text-slate-800">Leave a Message</h4>
                      <p className="text-xs text-slate-500">All agents are currently offline. Leave your details and we'll reply via email.</p>
                    </div>
                    <Input name="name" placeholder="Your Name" required className="bg-white" />
                    <Input name="email" type="email" placeholder="Email Address" required className="bg-white" />
                    <Textarea name="message" placeholder="How can we help?" required className="bg-white min-h-[100px]" />
                    <Button type="submit" className="w-full text-white" style={{ backgroundColor: primaryColor }}>Send Message</Button>
                    <Button type="button" variant="ghost" className="w-full text-xs" onClick={() => setShowOfflineForm(false)}>Back</Button>
                  </form>
                </ScrollArea>
              ) : !session ? (
                <div className="flex-1 p-8 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-white shadow-md flex items-center justify-center mb-2">
                    <MessageCircle className="w-8 h-8" style={{ color: primaryColor }} />
                  </div>
                  <h4 className="font-bold text-slate-800">Hi there!</h4>
                  <p className="text-sm text-slate-500 leading-relaxed px-4">{config.branding?.welcomeMessage}</p>
                  {isAvailable ? (
                    <Button className="w-full mt-6 text-white" style={{ backgroundColor: primaryColor }} onClick={startChat} disabled={isStarting}>
                      {isStarting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Start Chat'}
                    </Button>
                  ) : (
                    <div className="w-full space-y-3 mt-6">
                      <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 bg-slate-100 py-1 rounded">No Agents Online</div>
                      <Button variant="outline" className="w-full gap-2 border-dashed" onClick={() => setShowOfflineForm(true)}>
                        <Mail className="w-4 h-4" /> Email Us Instead
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                      {messages.map((m) => (
                        <div key={m.id} className={cn("flex", m.senderType === 'visitor' ? 'justify-end' : 'justify-start')}>
                          <div className={cn(
                            "max-w-[85%] px-4 py-2.5 rounded-2xl text-sm shadow-sm",
                            m.senderType === 'visitor' ? 'bg-slate-900 text-white rounded-br-none' : 'bg-white border text-slate-800 rounded-bl-none'
                          )}>
                            {m.content}
                          </div>
                        </div>
                      ))}
                      <div ref={scrollRef} />
                    </div>
                  </ScrollArea>
                  <form onSubmit={handleSend} className="p-4 bg-white border-t flex gap-2">
                    <Input placeholder="Message..." className="bg-slate-50 border-0" value={input} onChange={e => setInput(e.target.value)} disabled={isEnded} />
                    <Button size="icon" style={{ backgroundColor: primaryColor }} className="text-white" type="submit" disabled={!input.trim() || isEnded}><Send className="w-4 h-4" /></Button>
                  </form>
                </>
              )}
            </div>
            <div className="py-2 bg-white text-center border-t">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Powered by Mercury</span>
            </div>
          </div>
        )}
      <button
        className="h-14 w-14 rounded-full shadow-2xl flex items-center justify-center text-white relative hover:scale-105 active:scale-95 transition-transform duration-200"
        style={{ backgroundColor: primaryColor }}
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
        {!isAvailable && !isOpen && !session && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full border-2 border-white" />
        )}
      </button>
    </div>
  );
}