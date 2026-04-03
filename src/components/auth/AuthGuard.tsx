import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';

interface AuthGuardProps {
  children: React.ReactNode;
  roles?: string[];
  preventSuperAdmin?: boolean;
}
export function AuthGuard({ children, roles, preventSuperAdmin }: AuthGuardProps) {
  const location = useLocation();
  const [authState, setAuthState] = useState<'loading' | 'authenticated' | 'redirect'>('loading');
  const [redirectTo, setRedirectTo] = useState<string>('/login');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const checkAuth = () => {
      const store = useAuthStore.getState();
      const isAuthenticated = store.isAuthenticated;
      const userRole = store.user?.role;
      const selectedTenantId = store.selectedTenantId;

      if (!isAuthenticated) {
        setRedirectTo('/login');
        setAuthState('redirect');
        return;
      }

      // Superadmins should not access regular agent dashboards to prevent state confusion
      if (preventSuperAdmin && userRole === 'superadmin') {
        setRedirectTo('/superadmin');
        setAuthState('redirect');
        return;
      }

      // Role validation
      if (roles && userRole && !roles.includes(userRole)) {
        // If they have access to some admin dashboard, send them there
        if (userRole === 'superadmin') {
          setRedirectTo('/superadmin');
        } else if (userRole === 'tenant_admin') {
          setRedirectTo('/admin');
        } else {
          setRedirectTo('/');
        }
        setAuthState('redirect');
        return;
      }

      // Ensure tenant context exists for tenant-scoped roles
      if (userRole !== 'superadmin' && !selectedTenantId) {
        setErrorMessage('Your account is not currently assigned to an active tenant. Please contact your system administrator.');
        setRedirectTo('/login');
        setAuthState('redirect');
        return;
      }

      setAuthState('authenticated');
    };

    checkAuth();

    // Subscribe to store changes for reactivity
    const unsubscribe = useAuthStore.subscribe(checkAuth);

    return () => unsubscribe();
  }, [roles, preventSuperAdmin]);

  if (authState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center space-y-4 border">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto"></div>
          <h2 className="text-xl font-bold text-slate-900">Authenticating...</h2>
          <p className="text-slate-500">Please wait while we verify your session.</p>
        </div>
      </div>
    );
  }

  if (authState === 'redirect') {
    if (errorMessage) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center space-y-4 border">
            <h2 className="text-xl font-bold text-slate-900">No Tenant Assigned</h2>
            <p className="text-slate-500">{errorMessage}</p>
            <Navigate to={redirectTo} replace />
          </div>
        </div>
      );
    }
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  return <>{children}</>;
}