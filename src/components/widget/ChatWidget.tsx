import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Loader2, RotateCcw, Power } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ApiResponse, Message, PublicConfig, Conversation } from '@shared/types';
import { nanoid } from 'nanoid';
import { cn } from '@/lib/utils';
interface ChatWidgetProps {
  siteKey: string;
}
export default function ChatWidget({ siteKey }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [session, setSession] = useState<{ convId: string, visitorId: string } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isEnded, setIsEnded] = useState(false);
  const [input, setInput] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef(session);
  useEffect(() => {
    const saved = localStorage.getItem(`mercury_session_${siteKey}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSession(parsed);
        sessionRef.current = parsed;
      } catch (e) {
        console.error("Session parse error", e);
      }
    }
  }, [siteKey]);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  useEffect(() => {
    if (!siteKey) return;
    fetch(`/api/public/config/${siteKey}`)
      .then(res => res.json())
      .then((json: ApiResponse<PublicConfig>) => {
        if (json.success) setConfig(json.data!);
      })
      .catch(err => console.error("Config fetch error", err));
  }, [siteKey]);
  useEffect(() => {
    if (!sessionRef.current?.convId || !isOpen || isEnded) return;
    const interval = setInterval(() => {
      if (!sessionRef.current) return;
      fetch(`/api/conversations/${sessionRef.current.convId}/messages`)
        .then(res => res.json())
        .then((json: ApiResponse<Message[]>) => {
          if (json.success) setMessages(json.data ?? []);
        })
        .catch(err => console.error("Poll messages error", err));
    }, 4000);
    return () => clearInterval(interval);
  }, [isOpen, isEnded]);
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  const startChat = async () => {
    if (!config) return;
    setIsStarting(true);
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlQueueId = urlParams.get('queueId');
      const visitorId = nanoid();
      const res = await fetch('/api/public/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteKey,
          queueId: urlQueueId || (config.queues?.[0]?.id),
          name: 'Visitor ' + visitorId.slice(0, 4),
        })
      });
      const json = await res.json() as ApiResponse<Conversation>;
      if (json.success) {
        const newSession = { convId: json.data!.id, visitorId };
        setSession(newSession);
        setIsEnded(false);
        setMessages([]);
        localStorage.setItem(`mercury_session_${siteKey}`, JSON.stringify(newSession));
      } else {
        alert(json.error || "Chat failed to start");
      }
    } finally {
      setIsStarting(false);
    }
  };
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !session || isEnded) return;
    const content = input;
    setInput('');
    try {
      const res = await fetch(`/api/conversations/${session.convId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      const json = await res.json() as ApiResponse<Message>;
      if (json.success) {
        setMessages(prev => [...prev, json.data!]);
      }
    } catch (err) {
      console.error("Send error", err);
    }
  };
  if (!config) return null;
  const branding = config.branding;
  const primaryColor = branding?.primaryColor || '#06B6D4';
  const positionClass = branding?.widgetPosition === 'bottom-left' ? 'left-6' : 'right-6';
  return (
    <div className={cn("fixed bottom-6 z-[100] font-sans", positionClass)}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="mb-4 w-[360px] h-[520px] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200"
          >
            <div className="p-4 flex justify-between items-center text-white" style={{ backgroundColor: primaryColor }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"><MessageCircle className="w-5 h-5" /></div>
                <h3 className="text-sm font-bold">{config.name}</h3>
              </div>
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => setIsOpen(false)}><X className="w-5 h-5" /></Button>
            </div>
            <div className="flex-1 flex flex-col bg-slate-50 relative overflow-hidden">
              {!session ? (
                <div className="flex-1 p-8 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-white shadow-md flex items-center justify-center">
                    <MessageCircle className="w-8 h-8" style={{ color: primaryColor }} />
                  </div>
                  <h4 className="font-bold text-slate-800">Hi there!</h4>
                  <p className="text-sm text-slate-500 leading-relaxed">{branding?.welcomeMessage}</p>
                  <Button className="w-full mt-6" style={{ backgroundColor: primaryColor }} onClick={startChat} disabled={isStarting}>
                    {isStarting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Start Chat'}
                  </Button>
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
                    <Input placeholder="Message..." className="bg-slate-50 border-0" value={input} onChange={e => setInput(e.target.value)} />
                    <Button size="icon" style={{ backgroundColor: primaryColor }} type="submit" disabled={!input.trim()}><Send className="w-4 h-4" /></Button>
                  </form>
                </>
              )}
            </div>
            <div className="py-2 bg-white text-center border-t">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Powered by Mercury</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.button 
        whileHover={{ scale: 1.05 }} 
        whileTap={{ scale: 0.95 }}
        className="h-14 w-14 rounded-full shadow-2xl flex items-center justify-center text-white" 
        style={{ backgroundColor: primaryColor }} 
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </motion.button>
    </div>
  );
}