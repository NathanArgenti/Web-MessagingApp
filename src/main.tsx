import '@/lib/errorReporter';
import { enableMapSet } from "immer";
enableMapSet();
import React, { StrictMode } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import '@/index.css';
import { HomePage } from '@/pages/HomePage';
import { LoginPage } from '@/pages/LoginPage';
import { AgentDashboard } from '@/pages/AgentDashboard';
import { TenantAdmin } from '@/pages/TenantAdmin';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Toaster } from 'sonner';
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    }
  }
});
const router = createBrowserRouter([
  { path: "/", element: <HomePage />, errorElement: <RouteErrorBoundary /> },
  { path: "/login", element: <LoginPage />, errorElement: <RouteErrorBoundary /> },
  {
    path: "/agent",
    element: (
      <AuthGuard roles={['agent', 'tenant_admin', 'superadmin']}>
        <AgentDashboard />
      </AuthGuard>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/admin",
    element: (
      <AuthGuard roles={['tenant_admin', 'superadmin']}>
        <TenantAdmin />
      </AuthGuard>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/superadmin",
    element: (
      <AuthGuard roles={['superadmin']}>
        <AgentDashboard />
      </AuthGuard>
    ),
    errorElement: <RouteErrorBoundary />,
  },
]);
const container = document.getElementById('root');
if (container) {
  const global = window as any;
  let root: Root;
  if (global.__reactRoot) {
    root = global.__reactRoot;
  } else {
    root = createRoot(container);
    global.__reactRoot = root;
  }
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <RouterProvider router={router} />
          <Toaster richColors position="top-right" />
        </ErrorBoundary>
      </QueryClientProvider>
    </StrictMode>,
  );
}