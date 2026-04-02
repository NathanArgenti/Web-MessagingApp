import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, LayoutDashboard, Lock, Globe } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
export function LoginPage() {
  const [email, setEmail] = useState('');
  const [showLocal, setShowLocal] = useState(false);
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
        setAuth(json.data.user, json.data.token, json.data.tenant);
        navigate('/superadmin');
      }
    } catch (err) {
      toast.error('SSO Mock failed');
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}