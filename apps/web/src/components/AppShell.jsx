import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import {
  LayoutDashboard,
  Ticket,
  Building2,
  Users,
  Headphones,
  BarChart3,
  ShieldCheck,
  MailCheck,
  FileCode2,
  ClockAlert,
  ScrollText,
  Settings,
  Sun,
  Moon,
  Bell,
  Plus,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { useAppStore } from '../stores/useAppStore.js';
import { apiFetch } from '../lib/api.js';
import CreateTicketModal from '../features/tickets/CreateTicketModal.jsx';

export default function AppShell() {
  const { user, clearUser, theme, toggleTheme, sidebarCollapsed, toggleSidebar, hasPermission, toasts, addToast } = useAppStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const navigate = useNavigate();

  const isCustomer = user?.userType === 'customer';

  const navSections = isCustomer
    ? [
        {
          title: 'Customer Portal',
          items: [
            { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, perm: 'dashboard.view' },
            { to: '/tickets', label: 'Support Tickets', icon: Ticket, perm: 'tickets.view' }
          ]
        }
      ]
    : [
        {
          title: 'Workspace',
          items: [
            { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, perm: 'dashboard.view' },
            { to: '/tickets', label: 'All Tickets', icon: Ticket, perm: 'tickets.view' }
          ]
        },
        {
          title: 'Customers & Team',
          items: [
            { to: '/organisations', label: 'Organisations', icon: Building2, perm: 'orgs.view' },
            { to: '/users', label: 'Users Directory', icon: Users, perm: 'users.view' },
            { to: '/engineers', label: 'Support Engineers', icon: Headphones, perm: 'engineers.view' },
            { to: '/reports', label: 'Reports & Analytics', icon: BarChart3, perm: 'reports.view' }
          ]
        },
        {
          title: 'Administration',
          items: [
            { to: '/roles', label: 'Roles & Permissions', icon: ShieldCheck, perm: 'roles.view' },
            { to: '/email-config', label: 'Email & Routing', icon: MailCheck, perm: 'email.view' },
            { to: '/email-templates', label: 'Email Templates', icon: FileCode2, perm: 'templates.view' },
            { to: '/sla', label: 'SLA Policies', icon: ClockAlert, perm: 'settings.view' },
            { to: '/audit-logs', label: 'Audit Logs', icon: ScrollText, perm: 'audit.view' },
            { to: '/settings', label: 'System Settings', icon: Settings, perm: 'settings.view' }
          ]
        }
      ];

  async function handleLogout() {
    await apiFetch('/auth/logout', { method: 'POST' });
    clearUser();
    addToast('Signed out of Flows Helpdesk', 'info');
    navigate('/login');
  }

  const initials = (user?.fullName || 'U')
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join('');

  return (
    <div className="min-h-screen flex bg-[var(--bg-workspace)] text-[var(--text-main)]">
      {/* Sinch Flows Obsidian Black Sidebar */}
      <aside
        className={`${
          sidebarCollapsed ? 'w-[68px]' : 'w-[256px]'
        } bg-black text-gray-200 flex flex-col fixed inset-y-0 left-0 z-30 border-r border-neutral-800 transition-all duration-150 select-none`}
      >
        <div className="h-[60px] px-4 flex items-center justify-between border-b border-neutral-800">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#171717] border border-neutral-700 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M4 6H20L16 12H8L4 6Z" fill="#F5C332" />
                  <path d="M8 14H18L14 20H6L8 14Z" fill="#FFFFFF" />
                </svg>
              </div>
              <div className="leading-tight">
                <div className="font-bold text-sm text-white">Flows Helpdesk</div>
                <div className="text-[11px] font-medium text-[#F5C332]">by Sinch Flows</div>
              </div>
            </div>
          )}
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-neutral-800"
            title="Toggle sidebar"
          >
            {sidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2.5 py-4 space-y-5">
          {navSections.map((sec) => {
            const visible = sec.items.filter((i) => !i.perm || hasPermission(i.perm));
            if (!visible.length) return null;
            return (
              <div key={sec.title}>
                {!sidebarCollapsed && (
                  <div className="px-2.5 mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-gray-500">
                    {sec.title}
                  </div>
                )}
                <div className="space-y-0.5">
                  {visible.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        title={item.label}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-colors relative ${
                            isActive
                              ? 'bg-[#242424] text-white font-semibold before:content-[""] before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:bg-[#F5C332] before:rounded-r'
                              : 'text-gray-300 hover:bg-[#171717] hover:text-white'
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#F5C332]' : 'text-gray-400'}`} />
                            {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                          </>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {!sidebarCollapsed && (
          <div className="p-3 border-t border-neutral-800">
            <div className="bg-[#171717] border border-neutral-800 rounded-lg p-2.5 text-xs">
              <div className="flex items-center gap-2 font-medium text-gray-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>MERN + RabbitMQ Live</span>
              </div>
              <div className="text-[11px] text-gray-400 mt-1">
                {user?.role?.name} · {user?.organisation?.name || 'Internal'}
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content Wrapper */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-150 ${sidebarCollapsed ? 'ml-[68px]' : 'ml-[256px]'}`}>
        <header className="h-[60px] bg-[var(--bg-card)] border-b border-[var(--border-main)] px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[var(--text-muted)]">Sinch Flows</span>
            <span className="text-[var(--text-muted)]">/</span>
            <span className="font-semibold">Flows Helpdesk</span>
          </div>

          <div className="flex items-center gap-2.5">
            {hasPermission('tickets.create') && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-[#F5C332] hover:bg-[#E6B52C] text-[#111827] font-semibold text-xs border border-[#E6B52C] transition"
              >
                <Plus className="w-4 h-4" />
                <span>Create Ticket</span>
              </button>
            )}

            <button
              onClick={toggleTheme}
              className="p-2 rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-main)]"
              title="Toggle Dark/Light Theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              onClick={() => navigate('/notifications')}
              className="p-2 rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-main)]"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 pl-2 border-l border-[var(--border-main)]">
              <div className="w-7 h-7 rounded-full bg-[#171717] text-[#F5C332] text-xs font-semibold flex items-center justify-center border border-[#F5C332]/40">
                {initials}
              </div>
              <div className="hidden sm:block leading-tight">
                <div className="text-xs font-semibold">{user?.fullName}</div>
                <div className="text-[11px] text-[var(--text-muted)]">{user?.role?.name}</div>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 max-w-[1560px] w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {showCreateModal && <CreateTicketModal onClose={() => setShowCreateModal(false)} />}

      {/* Toast Stack */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="bg-[#171717] text-white text-xs px-4 py-3 rounded-lg shadow-lg border border-neutral-700 border-l-4 border-l-[#F5C332]"
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
