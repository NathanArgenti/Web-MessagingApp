import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
interface AuthGuardProps {
  children: React.ReactNode;
  roles?: string[];
}
export function AuthGuard({ children, roles }: AuthGuardProps) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const userRole = useAuthStore(s => s.user?.role);
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (roles && userRole && !roles.includes(userRole)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}