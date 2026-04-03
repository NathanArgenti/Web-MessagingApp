import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, LayoutDashboard, Lock, Globe, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
export function LoginPage() {
  const [email, setEmail] = useState('');
  const [showLocal, setShowLocal] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [searchParams] = useSearchParams();
  const isSetupMode = searchParams.get('setup') === '1' || searchParams.get('prod') === '1';
  const navigate = useNavigate();
  const setAuth = useAuthStore(s => s.setAuth);
  const handleLocalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/local/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (json.success) {
        setAuth(json.data.user, json.data.token, json.data.tenant);
        toast.success(`Welcome back, ${json.data.user.name}`);
        navigate(json.data.user.role === 'superadmin' ? '/superadmin' : '/agent');
      } else {
        toast.error(json.error || 'Login failed');
      }
    } catch (err) {
      toast.error('Network error');
    }
  };
  const handleEntraMock = async () => {
    try {
      const res = await fetch('/api/auth/entra/mock');
      const json = await res.json();
      if (json.success) {
        setAuth(json.data.user, json.data.token, json.data.tenant, json.data.availableTenants || []);
        toast.success(`SSO Simulated: Welcome ${json.data.user.name}`);
        navigate('/superadmin');
      } else {
        toast.error(json.error || 'Mock SSO Failed');
      }
    } catch (err) {
      toast.error('SSO Mock failed');
    }
  };
  const handleSafeInitialize = async () => {
    setIsInitializing(true);
    try {
      const res = await fetch('/api/seed?prod=true', { method: 'POST' });
      const json = await res.json();
      if (res.ok) {
        toast.success(json.data || 'Platform initialized');
      }
    } catch (e) {
      toast.error('Initialization failed');
    } finally {
      setIsInitializing(false);
    }
  };
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-center p-12 bg-slate-950 text-white">
        <div className="max-w-md space-y-6">
          <div className="w-12 h-12 bg-cyan-500 rounded-xl flex items-center justify-center">
            <Shield className="text-white" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Mercury Messaging</h1>
          <p className="text-slate-400 text-lg">
            The multi-tenant engine for secure, event-driven customer conversations.
          </p>
          <div className="grid gap-4 mt-8">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-cyan-500" />
              <span>Enterprise SSO Integration</span>
            </div>
            <div className="flex items-center gap-3">
              <LayoutDashboard className="w-5 h-5 text-cyan-500" />
              <span>Real-time Agent Orchestration</span>
            </div>
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-cyan-500" />
              <span>Tenant Isolation by Default</span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center p-8 bg-slate-50">
        <Card className="w-full max-w-sm shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Sign In</CardTitle>
            <CardDescription>Choose your authentication method</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              className="w-full bg-slate-900 hover:bg-slate-800"
              size="lg"
              onClick={handleEntraMock}
            >
              Continue with Entra ID
            </Button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>
            {!showLocal ? (
              <Button variant="ghost" className="w-full text-slate-500" onClick={() => setShowLocal(true)}>
                Use Local Developer Login
              </Button>
            ) : (
              <form onSubmit={handleLocalLogin} className="space-y-4">
                <Input
                  placeholder="admin@mercury.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-700">
                  Dev Login
                </Button>
                <Button variant="link" size="sm" className="w-full" onClick={() => setShowLocal(false)}>
                  Cancel
                </Button>
              </form>
            )}
            {isSetupMode && (
              <div className="pt-6 mt-6 border-t space-y-4">
                <p className="text-[10px] font-bold text-center text-muted-foreground uppercase tracking-widest">Administrator Setup</p>
                <Button 
                  variant="outline" 
                  className="w-full gap-2 border-emerald-200 text-emerald-700 bg-emerald-50/50 hover:bg-emerald-50"
                  onClick={handleSafeInitialize}
                  disabled={isInitializing}
                >
                  <ShieldCheck className="w-4 h-4" /> 
                  {isInitializing ? 'Working...' : 'Safe Initialize Platform'}
                </Button>
                <p className="text-[10px] text-center text-slate-400 italic px-4">
                  Use this if storage is empty or you are locked out. It creates default tenants and the SuperAdmin account without wipes.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}