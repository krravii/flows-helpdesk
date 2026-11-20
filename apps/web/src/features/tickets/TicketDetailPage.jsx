import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Lock, Send, Mail } from 'lucide-react';
import { apiFetch } from '../../lib/api.js';
import { socket } from '../../lib/socket.js';
import { useAppStore } from '../../stores/useAppStore.js';
import { StatusBadge, PriorityBadge, SlaBadge } from '../../components/Badges.jsx';

export default function TicketDetailPage() {
  const { ticketNumber } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, hasPermission, addToast } = useAppStore();
  const isCustomer = user?.userType === 'customer';

  const [mode, setMode] = useState('public');
  const [bodyText, setBodyText] = useState('');
  const [cc, setCc] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['ticket', ticketNumber],
    queryFn: () => apiFetch(`/tickets/${ticketNumber}`)
  });

  const { data: orgsData } = useQuery({
    queryKey: ['organisations'],
    queryFn: () => apiFetch('/organisations'),
    enabled: !isCustomer && !data?.ticket?.orgId
  });

  const { data: engineersData } = useQuery({
    queryKey: ['engineers'],
    queryFn: () => apiFetch('/users/engineers/workload'),
    enabled: !isCustomer
  });

  useEffect(() => {
    socket.emit('ticket:join', ticketNumber);
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketNumber] });
    };
    socket.on('ticket:message', handler);
    return () => {
      socket.emit('ticket:leave', ticketNumber);
      socket.off('ticket:message', handler);
    };
  }, [ticketNumber, queryClient]);

  const replyMutation = useMutation({
    mutationFn: (payload) =>
      apiFetch(`/tickets/${ticketNumber}/messages`, {
        method: 'POST',
        body: payload
      }),
    onSuccess: () => {
      setBodyText('');
      setCc('');
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketNumber] });
      addToast(mode === 'internal_note' ? 'Internal note added' : 'Reply sent & queued for SMTP delivery', 'success');
    },
    onError: (err) => addToast(err.message, 'danger')
  });

  const patchMutation = useMutation({
    mutationFn: (patch) =>
      apiFetch(`/tickets/${ticketNumber}`, {
        method: 'PATCH',
        body: patch
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketNumber] });
      addToast('Ticket properties updated', 'success');
    },
    onError: (err) => addToast(err.message, 'danger')
  });

  const mapOrgMutation = useMutation({
    mutationFn: (orgId) =>
      apiFetch(`/tickets/${ticketNumber}/map-organisation`, {
        method: 'POST',
        body: { orgId, registerCustomerUser: true }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketNumber] });
      addToast('Ticket mapped to organisation', 'success');
    },
    onError: (err) => addToast(err.message, 'danger')
  });

  if (isLoading) return <div className="text-sm text-[var(--text-muted)]">Loading conversation...</div>;
  if (!data?.ticket) return <div className="text-sm text-red-500">Ticket not found.</div>;

  const { ticket, messages } = data;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <button
            onClick={() => navigate('/tickets')}
            className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Tickets</span>
          </button>
          <span className="px-2 py-0.5 rounded bg-[#171717] text-white font-mono text-xs font-semibold">
            {ticket.ticketNumber}
          </span>
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
          {!isCustomer && <SlaBadge status={ticket.sla?.status} />}
        </div>
        <h1 className="text-xl font-bold tracking-tight">{ticket.subject}</h1>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Requester: <strong>{ticket.requesterName}</strong> ({ticket.requesterEmail}) · Source: {ticket.source}
        </p>
      </div>

      {/* Unknown Organisation Triage Banner */}
      {!isCustomer && !ticket.orgId && (
        <div className="p-4 rounded-xl bg-[#FFF7D6] border border-[#F5C332] text-[#111827] flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-bold text-xs uppercase tracking-wide">Unknown Organisation Triage Required</div>
            <div className="text-xs mt-0.5">
              Sender <code>{ticket.requesterEmail}</code> did not match any registered client domain. Map to an organisation:
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              className="h-8 px-2.5 rounded-md bg-white border border-amber-300 text-xs"
            >
              <option value="">Select Organisation...</option>
              {(orgsData?.items || []).map((o) => (
                <option key={o._id} value={o._id}>{o.name} ({o.primaryDomain})</option>
              ))}
            </select>
            <button
              disabled={!selectedOrgId || mapOrgMutation.isPending}
              onClick={() => mapOrgMutation.mutate(selectedOrgId)}
              className="h-8 px-3 rounded-md bg-[#171717] text-white text-xs font-semibold disabled:opacity-50"
            >
              Map Organisation
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">
        {/* Conversation Thread + Composer */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--border-main)] flex items-center justify-between text-xs">
            <strong>Conversation Timeline ({messages.length})</strong>
            <span className="font-mono text-[11px] text-[var(--text-muted)]">{ticket.emailThreadRootId}</span>
          </div>

          <div className="p-5 space-y-4 bg-[var(--bg-workspace)]">
            {messages.map((m) => {
              if (m.type === 'system') {
                return (
                  <div key={m._id} className="text-center text-[11.5px] text-[var(--text-muted)] py-1">
                    {m.bodyText} · {new Date(m.createdAt).toLocaleString()}
                  </div>
                );
              }
              const isNote = m.type === 'internal_note';
              const isEng = m.type === 'engineer';
              return (
                <div
                  key={m._id}
                  className={`p-4 rounded-xl border ${
                    isNote
                      ? 'bg-[#FFF7D6] border-[#FDE68A] border-l-4 border-l-[#F5C332] text-[#111827]'
                      : isEng
                      ? 'bg-[var(--bg-card)] border-[var(--border-main)] border-l-4 border-l-[#171717] dark:border-l-[#F5C332]'
                      : 'bg-[var(--bg-card)] border-[var(--border-main)]'
                  }`}
                >
                  {isNote && (
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#F5C332]/30 text-[#92400E] text-[10.5px] font-bold mb-2">
                      <Lock className="w-3 h-3" />
                      <span>INTERNAL NOTE — NOT VISIBLE TO CUSTOMER</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <strong className="text-xs">{m.authorName}</strong>
                      <span className="text-[11px] text-[var(--text-muted)] ml-2">{m.authorEmail}</span>
                    </div>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {new Date(m.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs leading-relaxed whitespace-pre-line">{m.bodyText}</div>
                  {m.emailMeta && !isCustomer && (
                    <div className="mt-3 pt-2 border-t border-[var(--border-main)]/60 font-mono text-[10.5px] text-[var(--text-muted)] flex items-center gap-1.5">
                      <Mail className="w-3 h-3" />
                      <span>Message-ID: {m.emailMeta.messageId}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Reply Composer */}
          <div className={`p-5 border-t border-[var(--border-main)] ${mode === 'internal_note' ? 'bg-[#FFF7D6]/40' : ''}`}>
            <div className="flex items-center gap-2 mb-3">
              <button
                type="button"
                onClick={() => setMode('public')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
                  mode === 'public'
                    ? 'bg-[#171717] text-white'
                    : 'bg-[var(--bg-subtle)] text-[var(--text-muted)]'
                }`}
              >
                Public Reply (SMTP)
              </button>
              {!isCustomer && hasPermission('tickets.note_add') && (
                <button
                  type="button"
                  onClick={() => setMode('internal_note')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
                    mode === 'internal_note'
                      ? 'bg-[#F5C332] text-black'
                      : 'bg-[var(--bg-subtle)] text-[var(--text-muted)]'
                  }`}
                >
                  Internal Note
                </button>
              )}
            </div>

            {mode === 'public' && !isCustomer && (
              <div className="mb-2.5 flex items-center gap-2 text-xs">
                <span className="text-[var(--text-muted)]">To: {ticket.requesterEmail}</span>
                <input
                  type="text"
                  placeholder="Optional CC..."
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  className="h-7 px-2.5 rounded bg-[var(--bg-workspace)] border border-[var(--border-main)] text-xs w-56"
                />
              </div>
            )}

            <textarea
              rows={4}
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              placeholder={
                mode === 'internal_note'
                  ? 'Add an internal engineering note...'
                  : 'Write your reply to send via SMTP and append to the email thread...'
              }
              className="w-full p-3 rounded-lg bg-[var(--bg-workspace)] border border-[var(--border-main)] text-xs focus:outline-none focus:border-[#F5C332]"
            />

            <div className="mt-3 flex justify-end">
              <button
                disabled={!bodyText.trim() || replyMutation.isPending}
                onClick={() => replyMutation.mutate({ type: mode, bodyText, cc })}
                className={`inline-flex items-center gap-1.5 h-9 px-4 rounded-md text-xs font-semibold transition disabled:opacity-50 ${
                  mode === 'internal_note'
                    ? 'bg-[#171717] text-white'
                    : 'bg-[#F5C332] hover:bg-[#E6B52C] text-black'
                }`}
              >
                {mode === 'internal_note' ? <Lock className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                <span>{mode === 'internal_note' ? 'Add Internal Note' : 'Send Public Reply'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Properties Sidebar */}
        <aside className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl p-4 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Ticket Properties</h3>

          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">Status</label>
            {!isCustomer ? (
              <select
                value={ticket.status}
                onChange={(e) => patchMutation.mutate({ status: e.target.value })}
                className="w-full h-8 px-2.5 rounded-md bg-[var(--bg-workspace)] border border-[var(--border-main)] text-xs"
              >
                {['New', 'Open', 'In Progress', 'Waiting for Customer', 'Waiting for Internal Team', 'Resolved', 'Closed'].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            ) : (
              <StatusBadge status={ticket.status} />
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">Priority</label>
            {!isCustomer ? (
              <select
                value={ticket.priority}
                onChange={(e) => patchMutation.mutate({ priority: e.target.value })}
                className="w-full h-8 px-2.5 rounded-md bg-[var(--bg-workspace)] border border-[var(--border-main)] text-xs"
              >
                {['Urgent', 'High', 'Normal', 'Low'].map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            ) : (
              <PriorityBadge priority={ticket.priority} />
            )}
          </div>

          {!isCustomer && (
            <div>
              <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">Assigned Engineer</label>
              <select
                value={ticket.assigneeId?._id || ''}
                onChange={(e) => patchMutation.mutate({ assigneeId: e.target.value || null })}
                className="w-full h-8 px-2.5 rounded-md bg-[var(--bg-workspace)] border border-[var(--border-main)] text-xs"
              >
                <option value="">Unassigned</option>
                {(engineersData?.items || []).map((eng) => (
                  <option key={eng._id} value={eng._id}>
                    {eng.fullName} ({eng.availability})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">Organisation</label>
            <div className="text-xs font-medium">{ticket.orgId?.name || 'Unknown Organisation'}</div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">Category</label>
            <div className="text-xs">{ticket.category}</div>
          </div>
        </aside>
      </div>
    </div>
  );
}
