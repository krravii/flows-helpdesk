import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { apiFetch } from '../../lib/api.js';
import { useAppStore } from '../../stores/useAppStore.js';
import { StatusBadge, PriorityBadge, SlaBadge } from '../../components/Badges.jsx';

export default function TicketsListPage() {
  const { user } = useAppStore();
  const navigate = useNavigate();
  const isCustomer = user?.userType === 'customer';

  const [filters, setFilters] = useState({
    search: '',
    status: '',
    priority: '',
    queue: '',
    page: 1
  });

  const queryParams = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v) queryParams.set(k, String(v));
  });

  const { data, isLoading } = useQuery({
    queryKey: ['tickets', filters],
    queryFn: () => apiFetch(`/tickets?${queryParams.toString()}`)
  });

  const tabs = isCustomer
    ? [
        { label: 'All Organisation Tickets', queue: '' },
        { label: 'My Submitted Tickets', queue: 'my' }
      ]
    : [
        { label: 'All Tickets', queue: '' },
        { label: 'My Assigned', queue: 'my' },
        { label: 'Unassigned Queue', queue: 'unassigned' },
        { label: 'Unknown Organisation', queue: 'unknown_org' }
      ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">
          {isCustomer ? 'Support Tickets' : 'Ticket Management'}
        </h1>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          {data?.pagination?.total ?? 0} total tickets in scope
        </p>
      </div>

      {/* Saved View Tabs */}
      <div className="flex items-center gap-1 border-b border-[var(--border-main)] overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.label}
            onClick={() => setFilters((f) => ({ ...f, queue: tab.queue, page: 1 }))}
            className={`px-3.5 py-2.5 text-xs font-medium border-b-2 transition whitespace-nowrap ${
              filters.queue === tab.queue
                ? 'border-[#F5C332] font-semibold text-[var(--text-main)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter Toolbar */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl overflow-hidden">
        <div className="p-3.5 border-b border-[var(--border-main)] flex flex-wrap items-center gap-2.5">
          <input
            type="text"
            placeholder="Search FLW-ID, subject, requester..."
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))}
            className="h-8 px-3 rounded-md bg-[var(--bg-workspace)] border border-[var(--border-main)] text-xs min-w-[230px]"
          />
          <select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}
            className="h-8 px-2.5 rounded-md bg-[var(--bg-workspace)] border border-[var(--border-main)] text-xs"
          >
            <option value="">All Statuses</option>
            {['New', 'Open', 'In Progress', 'Waiting for Customer', 'Waiting for Internal Team', 'Resolved', 'Closed'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={filters.priority}
            onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value, page: 1 }))}
            className="h-8 px-2.5 rounded-md bg-[var(--bg-workspace)] border border-[var(--border-main)] text-xs"
          >
            <option value="">All Priorities</option>
            {['Urgent', 'High', 'Normal', 'Low'].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--bg-subtle)] text-[var(--text-muted)] uppercase">
              <tr>
                <th className="px-4 py-3">Ticket ID</th>
                <th className="px-4 py-3">Subject</th>
                {!isCustomer && <th className="px-4 py-3">Organisation</th>}
                <th className="px-4 py-3">Requester</th>
                {!isCustomer && <th className="px-4 py-3">Assignee</th>}
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                {!isCustomer && <th className="px-4 py-3">SLA</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-main)]">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[var(--text-muted)]">
                    Loading tickets...
                  </td>
                </tr>
              ) : (data?.items || []).length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[var(--text-muted)]">
                    No tickets match your active filters.
                  </td>
                </tr>
              ) : (
                data.items.map((t) => (
                  <tr
                    key={t._id}
                    onClick={() => navigate(`/tickets/${t.ticketNumber}`)}
                    className="hover:bg-[var(--bg-subtle)] cursor-pointer"
                  >
                    <td className="px-4 py-3 font-mono font-semibold">{t.ticketNumber}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{t.subject}</div>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        {t.category} · {t.source}
                      </div>
                    </td>
                    {!isCustomer && (
                      <td className="px-4 py-3">
                        {t.orgId?.name || (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-medium">
                            Unknown Organisation
                          </span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="font-medium">{t.requesterName}</div>
                      <div className="text-[11px] text-[var(--text-muted)]">{t.requesterEmail}</div>
                    </td>
                    {!isCustomer && (
                      <td className="px-4 py-3">{t.assigneeId?.fullName || <span className="text-[var(--text-muted)]">Unassigned</span>}</td>
                    )}
                    <td className="px-4 py-3"><PriorityBadge priority={t.priority} /></td>
                    <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                    {!isCustomer && <td className="px-4 py-3"><SlaBadge status={t.sla?.status} /></td>}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
