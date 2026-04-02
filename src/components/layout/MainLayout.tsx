import React from "react";
import {
  LayoutDashboard,
  Settings,
  Users,
  LogOut,
  ChevronDown,
  Activity,
  Code2,
  ShieldCheck
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
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/store";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
export function MainLayout({ children }: { children: React.ReactNode }) {
  const userRole = useAuthStore(s => s.user?.role);
  const userName = useAuthStore(s => s.user?.name);
  const tenantName = useAuthStore(s => s.tenant?.name);
  const availableTenants = useAuthStore(s => s.availableTenants);
  const selectedTenantId = useAuthStore(s => s.selectedTenantId);
  const setSelectedTenantId = useAuthStore(s => s.setSelectedTenantId);
  const clearAuth = useAuthStore(s => s.clearAuth);
  const setActiveConversationId = useAuthStore(s => s.setActiveConversationId);

  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const handleLogout = () => {
    clearAuth();
    setActiveConversationId(null);
    navigate('/login');
  };
  const handleTenantSwitch = (id: string) => {
    // Clear state before switching to ensure isolation
    setActiveConversationId(null);
    setSelectedTenantId(id);
    // Invalidate and remove queries to ensure no cross-tenant data leaks in UI
    queryClient.removeQueries();
    queryClient.invalidateQueries();
  };
  const currentTenantName = availableTenants?.find(t => t.id === selectedTenantId)?.name || tenantName || 'Mercury Platform';
  const navItems = [
    { label: 'Agent Console', icon: LayoutDashboard, path: '/agent', roles: ['agent', 'tenant_admin'] },
    { label: 'Platform Oversight', icon: ShieldCheck, path: '/superadmin', roles: ['superadmin'] },
    { label: 'Tenant Admin', icon: Settings, path: '/admin', roles: ['tenant_admin', 'superadmin'] },
    { label: 'WP Integration', icon: Code2, path: '/admin/integration', roles: ['tenant_admin', 'superadmin'] },
  ];
  const filteredNav = navItems.filter(item => userRole && item.roles.includes(userRole));
  const canSwitchTenants = userRole === 'superadmin' || availableTenants.length > 1;
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" className="border-r border-slate-200">
        <SidebarHeader className="p-4 flex flex-row items-center gap-3">
          <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white font-bold shrink-0 shadow-lg ring-1 ring-white/20">M</div>
          <div className="flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-bold tracking-tight">Mercury Platform</span>
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Enterprise Messaging</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu className="px-2 py-2">
            {filteredNav.map((item) => (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton
                  asChild
                  tooltip={item.label}
                  isActive={location.pathname === item.path}
                  className={cn(
                    "transition-all duration-200",
                    location.pathname === item.path ? "bg-slate-900 text-white hover:bg-slate-800" : "hover:bg-slate-100"
                  )}
                >
                  <Link to={item.path}>
                    <item.icon className="w-4 h-4" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-4 border-t border-slate-100">
          <SidebarMenu>
             <SidebarMenuItem>
                <div className="px-2 py-2 text-[10px] text-muted-foreground font-bold flex items-center gap-2 group-data-[collapsible=icon]:hidden bg-slate-50 rounded-md border border-slate-100">
                    <Activity className="w-3 h-3 text-emerald-500 animate-pulse" />
                    <span>Region: US-East-1 (Active)</span>
                </div>
             </SidebarMenuItem>
            <SidebarMenuItem className="mt-2">
              <SidebarMenuButton
                onClick={handleLogout}
                className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="font-medium">Sign Out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="bg-slate-50/40">
        <header className="h-14 border-b border-slate-200 flex items-center px-6 gap-4 bg-white/80 backdrop-blur-md z-20 sticky top-0">
          <SidebarTrigger />
          <div className="h-4 w-px bg-slate-200 mx-1" />
          {canSwitchTenants ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                 <Button variant="ghost" className="h-9 px-3 gap-2 text-sm font-bold hover:bg-slate-100 transition-colors rounded-full border border-transparent hover:border-slate-200">
                   <div className="w-2 h-2 rounded-full bg-cyan-500" />
                   {currentTenantName}
                   <ChevronDown className="w-3 h-3 opacity-50" />
                 </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64 p-1 shadow-2xl rounded-xl">
                <DropdownMenuLabel className="text-xs text-muted-foreground px-3 py-2">Select Active Tenant</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {availableTenants.map(t => (
                  <DropdownMenuItem
                    key={t.id}
                    onClick={() => handleTenantSwitch(t.id)}
                    className={cn(
                      "rounded-lg px-3 py-2 cursor-pointer transition-colors",
                      selectedTenantId === t.id ? "bg-slate-100 font-bold text-slate-900" : "hover:bg-slate-50"
                    )}
                  >
                    {t.name}
                    {selectedTenantId === t.id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-500" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="text-sm font-bold text-slate-600 px-3">{currentTenantName}</div>
          )}
          <div className="flex-1" />
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold leading-none text-slate-900">{userName}</p>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-1">{userRole?.replace('_', ' ')}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shadow-sm">
              <Users className="w-4 h-4 text-slate-600" />
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