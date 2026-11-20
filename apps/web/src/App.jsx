import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { apiFetch } from './lib/api.js';
import { useAppStore } from './stores/useAppStore.js';
import AppShell from './components/AppShell.jsx';
import LoginPage from './features/auth/LoginPage.jsx';
import DashboardPage from './features/dashboard/DashboardPage.jsx';
import TicketsListPage from './features/tickets/TicketsListPage.jsx';
import TicketDetailPage from './features/tickets/TicketDetailPage.jsx';
import {
  OrganisationsPage,
  UsersPage,
  RolesRbacPage,
  SlaPoliciesPage,
  EmailConfigPage,
  AuditLogsPage
} from './features/admin/AdminPages.jsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
});

function ProtectedRoute({ children }) {
  const { user, authLoading } = useAppStore();
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">
        Verifying Sinch Flows session...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const { setUser, clearUser, theme } = useAppStore();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    apiFetch('/auth/me')
      .then((res) => setUser(res.user))
      .catch(() => clearUser());
  }, [setUser, clearUser]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="tickets" element={<TicketsListPage />} />
        <Route path="tickets/:ticketNumber" element={<TicketDetailPage />} />
        <Route path="organisations" element={<OrganisationsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="engineers" element={<UsersPage engineersOnly />} />
        <Route path="roles" element={<RolesRbacPage />} />
        <Route path="sla" element={<SlaPoliciesPage />} />
        <Route path="email-config" element={<EmailConfigPage />} />
        <Route path="email-templates" element={<EmailConfigPage />} />
        <Route path="reports" element={<DashboardPage />} />
        <Route path="audit-logs" element={<AuditLogsPage />} />
        <Route path="notifications" element={<AuditLogsPage />} />
        <Route path="settings" element={<SlaPoliciesPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
