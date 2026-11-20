import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api.js';
import { useAppStore } from '../../stores/useAppStore.js';
import { PriorityBadge } from '../../components/Badges.jsx';

export function OrganisationsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['organisations'],
    queryFn: () => apiFetch('/organisations')
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Organisations</h1>
        <p className="text-xs text-[var(--text-muted)] mt-1">Client tenants and email routing domains</p>
      </div>
      <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-[var(--bg-subtle)] text-[var(--text-muted)] uppercase">
            <tr>
              <th className="px-4 py-3">Organisation</th>
              <th className="px-4 py-3">Primary Domain</th>
              <th className="px-4 py-3">Users</th>
              <th className="px-4 py-3">Open / Total Tickets</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-main)]">
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center">Loading...</td></tr>
            ) : (
              (data?.items || []).map((org) => (
                <tr key={org._id}>
                  <td className="px-4 py-3 font-semibold">{org.name} ({org.code})</td>
                  <td className="px-4 py-3 font-mono">{org.primaryDomain}</td>
                  <td className="px-4 py-3">{org.userCount}</td>
                  <td className="px-4 py-3">{org.openTickets} open / {org.totalTickets} total</td>
                  <td className="px-4 py-3">{org.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function UsersPage({ engineersOnly = false }) {
  const { data, isLoading } = useQuery({
    queryKey: [engineersOnly ? 'engineers' : 'users'],
    queryFn: () => apiFetch(engineersOnly ? '/users/engineers/workload' : '/users')
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">
          {engineersOnly ? 'Support Engineers & Workload' : 'Users Directory'}
        </h1>
      </div>
      <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-[var(--bg-subtle)] text-[var(--text-muted)] uppercase">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role / Team</th>
              {engineersOnly && <th className="px-4 py-3">Queue (Open / Resolved)</th>}
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-main)]">
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center">Loading...</td></tr>
            ) : (
              (data?.items || []).map((u) => (
                <tr key={u._id}>
                  <td className="px-4 py-3 font-semibold">{u.fullName}</td>
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">{u.roleId?.name} · {u.team || u.orgId?.name}</td>
                  {engineersOnly && (
                    <td className="px-4 py-3 font-semibold">{u.openCount} open / {u.resolvedCount} resolved</td>
                  )}
                  <td className="px-4 py-3">{u.availability || u.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RolesRbacPage() {
  const queryClient = useQueryClient();
  const { addToast } = useAppStore();
  const [selectedRoleId, setSelectedRoleId] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => apiFetch('/roles')
  });

  const roles = data?.items || [];
  const activeRole = roles.find((r) => r._id === selectedRoleId) || roles[0];
  const allPerms = data?.allPermissionKeys || [];

  const updatePermsMutation = useMutation({
    mutationFn: ({ id, permissions }) =>
      apiFetch(`/roles/${id}`, { method: 'PATCH', body: { permissions } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      addToast('RBAC permissions saved & Redis cache invalidated', 'success');
    },
    onError: (err) => addToast(err.message, 'danger')
  });

  function togglePerm(permKey) {
    if (!activeRole) return;
    const set = new Set(activeRole.permissions);
    if (set.has(permKey)) set.delete(permKey);
    else set.add(permKey);
    updatePermsMutation.mutate({ id: activeRole._id, permissions: [...set] });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Roles & Granular RBAC Matrix</h1>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Changes persist to MongoDB and immediately invalidate Redis role caches
        </p>
      </div>

      {isLoading ? (
        <div className="text-xs">Loading roles...</div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {roles.map((r) => (
              <button
                key={r._id}
                onClick={() => setSelectedRoleId(r._id)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition ${
                  activeRole?._id === r._id
                    ? 'bg-[#171717] text-[#F5C332] border-[#171717]'
                    : 'bg-[var(--bg-card)] border-[var(--border-main)]'
                }`}
              >
                {r.name} ({r.permissions.length}/{allPerms.length})
              </button>
            ))}
          </div>

          {activeRole && (
            <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl p-5">
              <div className="mb-4">
                <h3 className="font-bold text-sm">{activeRole.name}</h3>
                <p className="text-xs text-[var(--text-muted)]">{activeRole.description}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {allPerms.map((p) => {
                  const checked = activeRole.permissions.includes(p);
                  return (
                    <label
                      key={p}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs cursor-pointer ${
                        checked
                          ? 'bg-[#FFF7D6] border-[#F5C332] text-[#111827] font-medium'
                          : 'bg-[var(--bg-workspace)] border-[var(--border-main)]'
                      }`}
                    >
                      <input type="checkbox" checked={checked} onChange={() => togglePerm(p)} />
                      <span className="font-mono text-[11.5px]">{p}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function SlaPoliciesPage() {
  const { data } = useQuery({ queryKey: ['sla'], queryFn: () => apiFetch('/admin/sla') });
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold tracking-tight">SLA Policies</h1>
      <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-[var(--bg-subtle)] text-[var(--text-muted)] uppercase">
            <tr>
              <th className="px-4 py-3">Policy</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">First Response</th>
              <th className="px-4 py-3">Resolution</th>
              <th className="px-4 py-3">Calendar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-main)]">
            {(data?.items || []).map((s) => (
              <tr key={s._id}>
                <td className="px-4 py-3 font-semibold">{s.name}</td>
                <td className="px-4 py-3"><PriorityBadge priority={s.priority} /></td>
                <td className="px-4 py-3">{s.firstResponseMins} mins</td>
                <td className="px-4 py-3">{s.resolutionHours} hours</td>
                <td className="px-4 py-3">{s.businessHours}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function EmailConfigPage() {
  const { data } = useQuery({ queryKey: ['email-config'], queryFn: () => apiFetch('/admin/email-config') });
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold tracking-tight">Email Gateway & Routing Rules</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl p-5 space-y-2">
          <h3 className="font-bold text-sm">Inbound IMAP Poller</h3>
          <div>Host: <code className="font-mono">{data?.settings?.imap?.host}:{data?.settings?.imap?.port}</code></div>
          <div>Mailbox: <code className="font-mono">{data?.settings?.imap?.email}</code></div>
          <div>Poll Interval: {data?.settings?.imap?.pollingIntervalSec}s</div>
        </div>
        <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl p-5 space-y-2">
          <h3 className="font-bold text-sm">Outbound SMTP Relay</h3>
          <div>Host: <code className="font-mono">{data?.settings?.smtp?.host}:{data?.settings?.smtp?.port}</code></div>
          <div>Sender: <code className="font-mono">{data?.settings?.smtp?.senderEmail}</code></div>
        </div>
      </div>
      <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border-main)] font-semibold text-xs">Routing Rules</div>
        <table className="w-full text-left text-xs">
          <thead className="bg-[var(--bg-subtle)] text-[var(--text-muted)] uppercase">
            <tr>
              <th className="px-4 py-3">Rule</th>
              <th className="px-4 py-3">Match Type</th>
              <th className="px-4 py-3">Match Value</th>
              <th className="px-4 py-3">Organisation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-main)]">
            {(data?.rules || []).map((r) => (
              <tr key={r._id}>
                <td className="px-4 py-3 font-semibold">{r.name}</td>
                <td className="px-4 py-3">{r.matchType}</td>
                <td className="px-4 py-3 font-mono">{r.matchValue}</td>
                <td className="px-4 py-3">{r.orgId?.name || 'Unknown Organisation'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AuditLogsPage() {
  const { data } = useQuery({ queryKey: ['audit-logs'], queryFn: () => apiFetch('/admin/audit-logs') });
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold tracking-tight">Security & System Audit Logs</h1>
      <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-[var(--bg-subtle)] text-[var(--text-muted)] uppercase">
            <tr>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Module</th>
              <th className="px-4 py-3">Target</th>
              <th className="px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-main)]">
            {(data?.items || []).map((a) => (
              <tr key={a._id}>
                <td className="px-4 py-3 font-mono text-[11px]">{new Date(a.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3 font-semibold">{a.userName}</td>
                <td className="px-4 py-3">{a.action}</td>
                <td className="px-4 py-3">{a.module}</td>
                <td className="px-4 py-3 font-mono">{a.target}</td>
                <td className="px-4 py-3 text-[var(--text-muted)]">{a.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
