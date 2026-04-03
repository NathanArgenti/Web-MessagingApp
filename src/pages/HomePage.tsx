import React from 'react'
import { MessageCircle, Globe, Zap, Database, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Toaster, toast } from 'sonner'
import { Link, useSearchParams } from 'react-router-dom'
import ChatWidget from '@/components/widget/ChatWidget';
export function HomePage() {
  const [searchParams] = useSearchParams();
  const isProdSetup = searchParams.get('prod') === '1';
  const seedDatabase = async () => {
    try {
      const url = isProdSetup ? '/api/seed?prod=true' : '/api/seed';
      const res = await fetch(url, { method: 'POST' });
      const json = await res.json();
      if (res.ok) {
        toast.success(json.data || 'Platform initialized');
      }
    } catch (e) {
      toast.error('Failed to initialize platform');
    }
  };
  return (
    <div className="min-h-screen bg-slate-50 overflow-x-hidden">
      <nav className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-cyan-600 rounded flex items-center justify-center text-white font-bold">M</div>
          <span className="text-xl font-bold text-slate-900">Mercury</span>
        </div>
        <div className="flex gap-4">
          <Button variant="ghost" onClick={seedDatabase} className="flex gap-2">
            {isProdSetup ? <ShieldCheck className="w-4 h-4 text-emerald-600" /> : <Database className="w-4 h-4" />}
            {isProdSetup ? 'Initialize Production' : 'Seed Demo'}
          </Button>
          <Link to={isProdSetup ? "/login?prod=1" : "/login"}>
            <Button variant="outline">Sign In</Button>
          </Link>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
        <div className="text-center max-w-3xl mx-auto space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-50 border border-cyan-100 text-cyan-600 text-xs font-bold uppercase tracking-widest">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
            Available for Multi-tenant SaaS
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 tracking-tight leading-[1.1]">
            Conversations that <span className="text-cyan-600">Convert</span>.
          </h1>
          <p className="text-xl text-slate-600 leading-relaxed">
            Enterprise-grade messaging for multi-tenant platforms. Logical isolation, event-driven workflows, and a developer-first API.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
            <Button size="lg" className="bg-slate-900 px-8 py-6 text-lg">Get Started</Button>
            <Button size="lg" variant="outline" className="px-8 py-6 text-lg">View Documentation</Button>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-10 mt-32">
          {[
            { title: 'Tenant Isolation', icon: Globe, desc: 'Every tenant is logically siloed. Data privacy and routing security are baked into the core engine.' },
            { title: 'Event-Driven Logic', icon: Zap, desc: 'Trigger complex workflows on chat start, end, or agent assignment via our robust outbox system.' },
            { title: 'High-Efficiency Console', icon: MessageCircle, desc: 'Equip your team with a 3-pane agent workspace designed for managing high-volume chat traffic.' }
          ].map(feature => (
            <div key={feature.title} className="group p-10 bg-white rounded-3xl shadow-soft border border-slate-200 transition-all hover:-translate-y-2 hover:shadow-xl">
              <div className="w-14 h-14 bg-cyan-50 rounded-2xl flex items-center justify-center text-cyan-600 mb-6 group-hover:bg-cyan-600 group-hover:text-white transition-colors">
                <feature.icon className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-slate-900">{feature.title}</h3>
              <p className="text-slate-600 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-40 rounded-4xl bg-slate-900 p-12 lg:p-20 text-white relative overflow-hidden">
          <div className="relative z-10 max-w-2xl space-y-6">
            <h2 className="text-4xl font-bold">One Line of Code.</h2>
            <p className="text-slate-400 text-lg">
              Embed our widget on any site using just a site key. We handle the routing,
              the persistence, and the real-time sync.
            </p>
            <div className="bg-slate-800 rounded-xl p-4 font-mono text-sm text-cyan-400 border border-slate-700">
              {`<MercuryWidget siteKey="acme-123" />`}
            </div>
          </div>
          <div className="absolute right-0 top-0 w-1/3 h-full bg-gradient-to-l from-cyan-600/20 to-transparent pointer-events-none" />
        </div>
      </main>
      <footer className="border-t bg-white py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-slate-900 rounded flex items-center justify-center text-white text-[10px] font-bold">M</div>
            <span className="font-bold text-slate-900 uppercase tracking-widest text-sm">Mercury Messaging</span>
          </div>
          <p className="text-slate-400 text-sm">© 2026 Mercury Systems. All rights reserved.</p>
        </div>
      </footer>
      {/* Real Demo Widget */}
      <ChatWidget siteKey="acme-123" />
    </div>
  )
}