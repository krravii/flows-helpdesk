import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import { Layers, FolderOpen, Cpu, CheckCircle2, AlertTriangle, Inbox } from 'lucide-react';
import { apiFetch } from '../../lib/api.js';
import { useAppStore } from '../../stores/useAppStore.js';
import { StatusBadge, PriorityBadge } from '../../components/Badges.jsx';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

export default function DashboardPage() {
  const { user } = useAppStore();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiFetch('/admin/dashboard')
  });

  if (isLoading) {
    return <div className="text-sm text-[var(--text-muted)]">Loading live telemetry...</div>;
  }

  const kpis = data?.kpis || {};
  const isCustomer = user?.userType === 'customer';

  const cards = isCustomer
    ? [
        { label: 'Organisation Tickets', value: kpis.total || 0, icon: Layers, accent: true },
        { label: 'My Submitted Tickets', value: kpis.myAssignedCount || 0, icon: Inbox },
        { label: 'Open & In Progress', value: (kpis.openCount || 0) + (kpis.inProgressCount || 0), icon: Cpu },
        { label: 'Waiting for Your Reply', value: kpis.waitingCustCount || 0, icon: FolderOpen },
        { label: 'Resolved & Closed', value: (kpis.resolvedCount || 0) + (kpis.closedCount || 0), icon: CheckCircle2 }
      ]
    : [
        { label: 'Total Tickets', value: kpis.total || 0, icon: Layers, accent: true },
        { label: 'Unassigned Queue', value: kpis.unassignedCount || 0, icon: Inbox },
        { label: 'Open / New', value: (kpis.openCount || 0) + (kpis.newCount || 0), icon: FolderOpen },
        { label: 'In Progress', value: kpis.inProgressCount || 0, icon: Cpu },
        { label: 'Resolved & Closed', value: (kpis.resolvedCount || 0) + (kpis.closedCount || 0), icon: CheckCircle2 },
        { label: 'SLA Breaches', value: kpis.slaBreaches || 0, icon: AlertTriangle }
      ];

  const statusChartData = {
    labels: ['New', 'Open', 'In Progress', 'Waiting Customer', 'Resolved', 'Closed'],
    datasets: [
      {
        data: [
          kpis.newCount || 0,
          kpis.openCount || 0,
          kpis.inProgressCount || 0,
          kpis.waitingCustCount || 0,
          kpis.resolvedCount || 0,
          kpis.closedCount || 0
        ],
        backgroundColor: ['#F5C332', '#3B82F6', '#8B5CF6', '#F59E0B', '#10B981', '#6B7280'],
        borderWidth: 0
      }
    ]
  };

  const orgChartData = {
    labels: (data?.byOrg || []).map((o) => o.name),
    datasets: [
      {
        label: 'Tickets',
        data: (data?.byOrg || []).map((o) => o.count),
        backgroundColor: '#F5C332',
        borderRadius: 6
      }
    ]
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">
          {isCustomer ? `${user?.organisation?.name} Support Portal` : `${user?.role?.name} Command Center`}
        </h1>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Real-time support queue metrics, SLA status, and multi-tenant operations
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.label}
              className={`rounded-xl p-4 border ${
                c.accent
                  ? 'bg-[#171717] text-white border-neutral-800'
                  : 'bg-[var(--bg-card)] border-[var(--border-main)]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-medium ${c.accent ? 'text-gray-400' : 'text-[var(--text-muted)]'}`}>
                  {c.label}
                </span>
                <Icon className={`w-4 h-4 ${c.accent ? 'text-[#F5C332]' : 'text-[var(--text-muted)]'}`} />
              </div>
              <div className={`text-2xl font-bold ${c.accent ? 'text-[#F5C332]' : ''}`}>{c.value}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4">Ticket Status Distribution</h3>
          <div className="h-[240px] flex items-center justify-center">
            <Doughnut data={statusChartData} options={{ maintainAspectRatio: false, cutout: '65%' }} />
          </div>
        </div>

        {!isCustomer && (
          <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl p-5">
            <h3 className="text-sm font-semibold mb-4">Tickets by Client Organisation</h3>
            <div className="h-[240px]">
              <Bar
                data={orgChartData}
                options={{
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
                }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[var(--border-main)] flex items-center justify-between">
          <h3 className="text-sm font-semibold">Recent Ticket Activity</h3>
          <button
            onClick={() => navigate('/tickets')}
            className="text-xs font-semibold px-3 py-1.5 rounded-md border border-[var(--border-main)] hover:bg-[var(--bg-subtle)]"
          >
            View All Tickets
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--bg-subtle)] text-[var(--text-muted)] uppercase">
              <tr>
                <th className="px-4 py-3">Ticket</th>
                <th className="px-4 py-3">Subject</th>
                {!isCustomer && <th className="px-4 py-3">Organisation</th>}
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-main)]">
              {(data?.recentTickets || []).map((t) => (
                <tr
                  key={t._id}
                  onClick={() => navigate(`/tickets/${t.ticketNumber}`)}
                  className="hover:bg-[var(--bg-subtle)] cursor-pointer"
                >
                  <td className="px-4 py-3 font-mono font-semibold">{t.ticketNumber}</td>
                  <td className="px-4 py-3 font-medium">{t.subject}</td>
                  {!isCustomer && (
                    <td className="px-4 py-3">
                      {t.orgId?.name || (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-medium">
                          Unknown Org
                        </span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <PriorityBadge priority={t.priority} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={t.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
