import React from "react";
import {
  LayoutDashboard,
  Settings,
  Users,
  MessageSquare,
  ShieldCheck,
  LogOut,
  ChevronDown,
  Activity
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/lib/store";
import { useNavigate, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
export function MainLayout({ children }: { children: React.ReactNode }) {
  const userRole = useAuthStore(s => s.user?.role);
  const userName = useAuthStore(s => s.user?.name);
  const tenantName = useAuthStore(s => s.tenant?.name);
  const availableTenants = useAuthStore(s => s.availableTenants);
  const selectedTenantId = useAuthStore(s => s.selectedTenantId);
  const setSelectedTenantId = useAuthStore(s => s.setSelectedTenantId);
  const clearAuth = useAuthStore(s => s.clearAuth);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };
  const handleTenantSwitch = (id: string) => {
    setSelectedTenantId(id);
    queryClient.invalidateQueries();
  };
  const currentTenantName = availableTenants.find(t => t.id === selectedTenantId)?.name || tenantName || 'Mercury';
  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/agent', roles: ['agent', 'tenant_admin', 'superadmin'] },
    { label: 'Tenant Settings', icon: Settings, path: '/admin', roles: ['tenant_admin', 'superadmin'] },
  ];
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="p-4 flex flex-row items-center gap-3">
          <div className="w-8 h-8 bg-cyan-600 rounded flex items-center justify-center text-white font-bold shrink-0">M</div>
          <div className="flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-bold truncate max-w-[150px]">Mercury</span>
            <span className="text-[10px] text-muted-foreground uppercase font-bold">Messaging Engine</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navItems.filter(item => userRole && item.roles.includes(userRole)).map((item) => (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton asChild tooltip={item.label}>
                  <Link to={item.path} className="hover:bg-cyan-50 hover:text-cyan-600 transition-colors">
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
                <div className="px-2 py-1 text-[10px] text-muted-foreground font-bold flex items-center gap-2 group-data-[collapsible=icon]:hidden">
                    <Activity className="w-3 h-3 text-green-500" /> System Healthy
                </div>
             </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={handleLogout} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="bg-slate-50/30">
        <header className="h-14 border-b flex items-center px-6 gap-4 bg-white shadow-sm z-20 sticky top-0">
          <SidebarTrigger />
          <div className="h-4 w-px bg-slate-200 mx-1" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
               <Button variant="ghost" className="h-9 px-3 gap-2 text-sm font-bold hover:bg-slate-50">
                 {currentTenantName}
                 <ChevronDown className="w-3 h-3 opacity-50" />
               </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Switch Context</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {availableTenants.map(t => (
                <DropdownMenuItem key={t.id} onClick={() => handleTenantSwitch(t.id)} className={cn(selectedTenantId === t.id && "bg-slate-100 font-bold")}>
                  {t.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold leading-none">{userName}</p>
              <p className="text-[10px] text-muted-foreground capitalize mt-1">{userRole?.replace('_', ' ')}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-100 border flex items-center justify-center">
              <Users className="w-4 h-4 text-slate-500" />
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}