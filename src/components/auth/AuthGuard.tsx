import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
interface AuthGuardProps {
  children: React.ReactNode;
  roles?: string[];
  preventSuperAdmin?: boolean;
}
export function AuthGuard({ children, roles, preventSuperAdmin }: AuthGuardProps) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const userRole = useAuthStore(s => s.user?.role);
  const selectedTenantId = useAuthStore(s => s.selectedTenantId);
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  // Superadmins should not access regular agent dashboards to prevent state confusion
  if (preventSuperAdmin && userRole === 'superadmin') {
    return <Navigate to="/superadmin" replace />;
  }
  // Role validation
  if (roles && userRole && !roles.includes(userRole)) {
    // If they have access to some admin dashboard, send them there
    if (userRole === 'superadmin') return <Navigate to="/superadmin" replace />;
    if (userRole === 'tenant_admin') return <Navigate to="/admin" replace />;
    return <Navigate to="/" replace />;
  }
  // Ensure tenant context exists for tenant-scoped roles
  if (userRole !== 'superadmin' && !selectedTenantId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center space-y-4 border">
          <h2 className="text-xl font-bold text-slate-900">No Tenant Assigned</h2>
          <p className="text-slate-500">Your account is not currently assigned to an active tenant. Please contact your system administrator.</p>
          <Navigate to="/login" replace />
        </div>
      </div>
    );
  }
  return <>{children}</>;
}