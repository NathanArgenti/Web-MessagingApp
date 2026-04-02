import React from "react";
import { 
  LayoutDashboard, 
  Settings, 
  Users, 
  MessageSquare, 
  ShieldCheck, 
  LogOut 
} from "lucide-react";
import { 
  SidebarProvider, 
  SidebarInset, 
  SidebarTrigger, 
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter
} from "@/components/ui/sidebar";
import { useAuthStore } from "@/lib/store";
import { useNavigate, Link } from "react-router-dom";
export function MainLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore(s => s.user);
  const tenant = useAuthStore(s => s.tenant);
  const clearAuth = useAuthStore(s => s.clearAuth);
  const navigate = useNavigate();
  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };
  const navItems = [
    { label: 'Agent Console', icon: MessageSquare, path: '/agent', roles: ['agent', 'tenant_admin'] },
    { label: 'Tenant Settings', icon: Settings, path: '/admin', roles: ['tenant_admin'] },
    { label: 'Platform Admin', icon: ShieldCheck, path: '/superadmin', roles: ['superadmin'] },
  ];
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="p-4 flex flex-row items-center gap-3">
          <div className="w-8 h-8 bg-cyan-600 rounded flex items-center justify-center text-white font-bold">M</div>
          <div className="flex flex-col">
            <span className="text-sm font-bold truncate max-w-[150px]">
              {tenant?.name || 'Mercury'}
            </span>
            <span className="text-xs text-muted-foreground capitalize">{user?.role.replace('_', ' ')}</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navItems.filter(item => user && item.roles.includes(user.role)).map((item) => (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton asChild>
                  <Link to={item.path}>
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-4 border-t">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={handleLogout} className="text-destructive hover:text-destructive">
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="h-14 border-b flex items-center px-4 gap-4 bg-background">
          <SidebarTrigger />
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">{user?.name}</span>
            <div className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300" />
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}