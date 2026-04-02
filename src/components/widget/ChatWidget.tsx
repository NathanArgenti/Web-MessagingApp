import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ApiResponse, Message, PublicConfig, Conversation } from '@shared/types';
import { nanoid } from 'nanoid';
interface ChatWidgetProps {
  siteKey: string;
}
export function ChatWidget({ siteKey }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [session, setSession] = useState<{ convId: string, visitorId: string } | null>(() => {
    const saved = localStorage.getItem(`mercury_session_${siteKey}`);
    return saved ? JSON.parse(saved) : null;
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    fetch(`/api/public/config/${siteKey}`)
      .then(res => res.json())
      .then((json: ApiResponse<PublicConfig>) => {
        if (json.success) setConfig(json.data!);
      });
  }, [siteKey]);
  useEffect(() => {
    if (!session?.convId || !isOpen) return;
    const interval = setInterval(() => {
      fetch(`/api/conversations/${session.convId}/messages`)
        .then(res => res.json())
        .then((json: ApiResponse<Message[]>) => {
          if (json.success) setMessages(json.data!);
        });
    }, 3000);
    return () => clearInterval(interval);
  }, [session?.convId, isOpen]);
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  const startChat = async () => {
    if (!config || config.queues.length === 0) return;
    setIsStarting(true);
    try {
      const visitorId = nanoid();
      const res = await fetch('/api/public/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteKey,
          queueId: config.queues[0].id,
          name: 'Visitor ' + visitorId.slice(0, 4),
        })
      });
      const json = await res.json() as ApiResponse<Conversation>;
      if (json.success) {
        const newSession = { convId: json.data!.id, visitorId };
        setSession(newSession);
        localStorage.setItem(`mercury_session_${siteKey}`, JSON.stringify(newSession));
      }
    } finally {
      setIsStarting(false);
    }
  };
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !session) return;
    const content = input;
    setInput('');
    const res = await fetch('/api/public/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: session.convId,
        visitorId: session.visitorId,
        content
      })
    });
    const json = await res.json() as ApiResponse<Message>;
    if (json.success) {
      setMessages(prev => [...prev, json.data!]);
    }
  };
  if (!config) return null;
  const primaryColor = config.branding.primaryColor || '#06B6D4';
  return (
    <div className="fixed bottom-6 right-6 z-[100] font-sans">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="mb-4 w-[360px] h-[500px] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200"
          >
            {/* Header */}
            <div 
              className="p-4 flex justify-between items-center text-white"
              style={{ backgroundColor: primaryColor }}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">{config.name}</h3>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-[10px] opacity-80">Support Online</span>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => setIsOpen(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            {/* Content */}
            <div className="flex-1 overflow-hidden flex flex-col bg-slate-50">
              {!session ? (
                <div className="flex-1 p-8 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center">
                    <MessageCircle className="w-8 h-8" style={{ color: primaryColor }} />
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-800">Need help?</h4>
                    <p className="text-sm text-slate-500 leading-relaxed">{config.branding.welcomeMessage}</p>
                  </div>
                  <Button 
                    className="w-full mt-4" 
                    style={{ backgroundColor: primaryColor }}
                    onClick={startChat}
                    disabled={isStarting}
                  >
                    {isStarting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Start Chat'}
                  </Button>
                </div>
              ) : (
                <>
                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-3">
                      {messages.map((m) => (
                        <div key={m.id} className={`flex ${m.senderType === 'visitor' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                            m.senderType === 'visitor' 
                              ? 'bg-slate-900 text-white rounded-br-none' 
                              : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-sm'
                          }`}>
                            {m.content}
                          </div>
                        </div>
                      ))}
                      <div ref={scrollRef} />
                    </div>
                  </ScrollArea>
                  <form onSubmit={handleSend} className="p-3 bg-white border-t flex gap-2">
                    <Input 
                      placeholder="Ask us anything..." 
                      className="bg-slate-50 border-0 focus-visible:ring-1 focus-visible:ring-slate-200"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                    />
                    <Button size="icon" style={{ backgroundColor: primaryColor }} type="submit" disabled={!input.trim()}>
                      <Send className="w-4 h-4" />
                    </Button>
                  </form>
                </>
              )}
            </div>
            <div className="py-1.5 bg-white text-center border-t">
              <span className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Powered by Mercury</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="h-14 w-14 rounded-full shadow-2xl flex items-center justify-center text-white transition-colors"
        style={{ backgroundColor: primaryColor }}
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </motion.button>
    </div>
  );
}