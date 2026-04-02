import '@/lib/errorReporter';
import { enableMapSet } from "immer";
enableMapSet();
import React, { StrictMode } from 'react';
import { createRoot, Root } from 'react-dom/client';
import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import '@/index.css';
import { HomePage } from '@/pages/HomePage';
import { LoginPage } from '@/pages/LoginPage';
import { AgentConsole } from '@/pages/AgentConsole';
import { TenantAdmin } from '@/pages/TenantAdmin';
import { AuthGuard } from '@/components/auth/AuthGuard';
const queryClient = new QueryClient();
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
// Singleton pattern for React root to prevent double-initialization errors
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
        </ErrorBoundary>
      </QueryClientProvider>
    </StrictMode>,
  );
}