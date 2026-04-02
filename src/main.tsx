import '@/lib/errorReporter';
import { enableMapSet } from "immer";
enableMapSet();
import React, { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  useLocation
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import '@/index.css'
import { HomePage } from '@/pages/HomePage'
import { LoginPage } from '@/pages/LoginPage'
import { AgentConsole } from '@/pages/AgentConsole'
import { TenantAdmin } from '@/pages/TenantAdmin'
import { useAuthStore } from '@/lib/store'
const queryClient = new QueryClient();
function AuthGuard({ children, roles }: { children: React.ReactNode, roles?: string[] }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const user = useAuthStore(s => s.user);
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
const router = createBrowserRouter([
  {
    path: "/",
    element: <HomePage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/login",
    element: <LoginPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/agent",
    element: (
      <AuthGuard roles={['agent', 'tenant_admin']}>
        <AgentConsole />
      </AuthGuard>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/admin",
    element: (
      <AuthGuard roles={['tenant_admin']}>
        <TenantAdmin title="Tenant Administration" />
      </AuthGuard>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/superadmin",
    element: (
      <AuthGuard roles={['superadmin']}>
        <TenantAdmin title="Platform Oversight" />
      </AuthGuard>
    ),
    errorElement: <RouteErrorBoundary />,
  },
]);
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <RouterProvider router={router} />
      </ErrorBoundary>
    </QueryClientProvider>
  </StrictMode>,
)