import React from 'react'
import { MessageCircle, Globe, Zap, Database } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Toaster, toast } from 'sonner'
import { Link } from 'react-router-dom'
export function HomePage() {
  const seedDatabase = async () => {
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      if (res.ok) toast.success('Database seeded with demo tenants and users');
    } catch (e) {
      toast.error('Failed to seed');
    }
  };
  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="border-b bg-white px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-cyan-600 rounded flex items-center justify-center text-white font-bold">M</div>
          <span className="text-xl font-bold text-slate-900">Mercury</span>
        </div>
        <div className="flex gap-4">
          <Button variant="ghost" onClick={seedDatabase} className="hidden sm:flex gap-2">
            <Database className="w-4 h-4" />
            Seed Demo
          </Button>
          <Link to="/login">
            <Button variant="outline">Sign In</Button>
          </Link>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center max-w-3xl mx-auto space-y-6">
          <h1 className="text-5xl font-extrabold text-slate-900 tracking-tight">
            Conversations that <span className="text-cyan-600">Convert</span>.
          </h1>
          <p className="text-xl text-slate-600">
            Enterprise-grade messaging for multi-tenant platforms. Scalable, secure, and developer-first.
          </p>
          <div className="flex justify-center gap-4 pt-4">
            <Button size="lg" className="bg-slate-900">Get Started</Button>
            <Button size="lg" variant="outline">View Documentation</Button>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-8 mt-24">
          {[
            { title: 'Tenant Isolation', icon: Globe, desc: 'Logical separation of all data and traffic at the routing layer.' },
            { title: 'Event-Driven', icon: Zap, desc: 'Hook into conversation lifecycles with robust webhook outboxing.' },
            { title: 'Agent Console', icon: MessageCircle, desc: 'Beautiful, high-efficiency workspace for support teams.' }
          ].map(feature => (
            <div key={feature.title} className="p-8 bg-white rounded-2xl shadow-sm border border-slate-200">
              <feature.icon className="w-10 h-10 text-cyan-600 mb-4" />
              <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
              <p className="text-slate-600">{feature.desc}</p>
            </div>
          ))}
        </div>
      </main>
      {/* Mock Widget Floating Button */}
      <div className="fixed bottom-6 right-6">
        <Button className="h-14 w-14 rounded-full shadow-2xl bg-cyan-600 hover:bg-cyan-700 animate-bounce">
          <MessageCircle className="w-6 h-6 text-white" />
        </Button>
      </div>
      <Toaster richColors />
    </div>
  )
}