import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { apiFetch } from '../../lib/api.js';
import { useAppStore } from '../../stores/useAppStore.js';

export default function CreateTicketModal({ onClose }) {
  const { user, addToast } = useAppStore();
  const isCustomer = user?.userType === 'customer';
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    subject: '',
    description: '',
    orgId: '',
    assigneeId: '',
    priority: 'Normal',
    category: 'WhatsApp',
    tags: ''
  });

  const { data: orgsData } = useQuery({
    queryKey: ['organisations'],
    queryFn: () => apiFetch('/organisations'),
    enabled: !isCustomer
  });

  const { data: engData } = useQuery({
    queryKey: ['engineers'],
    queryFn: () => apiFetch('/users/engineers/workload'),
    enabled: !isCustomer
  });

  const createMutation = useMutation({
    mutationFn: (payload) => apiFetch('/tickets', { method: 'POST', body: payload }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      addToast(`Ticket ${res.ticket.ticketNumber} created`, 'success');
      onClose();
      navigate(`/tickets/${res.ticket.ticketNumber}`);
    },
    onError: (err) => addToast(err.message, 'danger')
  });

  function handleSubmit(e) {
    e.preventDefault();
    createMutation.mutate({
      subject: form.subject,
      description: form.description,
      orgId: isCustomer ? undefined : form.orgId || null,
      assigneeId: isCustomer ? undefined : form.assigneeId || null,
      priority: form.priority,
      category: form.category,
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-[var(--border-main)] flex items-center justify-between">
          <h3 className="font-bold text-base">Create Support Ticket</h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-main)] text-lg">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block font-semibold mb-1">Subject *</label>
            <input
              required
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="e.g. WhatsApp webhook timeout on interactive list reply"
              className="w-full h-9 px-3 rounded-md bg-[var(--bg-workspace)] border border-[var(--border-main)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full h-9 px-2.5 rounded-md bg-[var(--bg-workspace)] border border-[var(--border-main)]"
              >
                <option value="Normal">Normal</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
                <option value="Low">Low</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full h-9 px-2.5 rounded-md bg-[var(--bg-workspace)] border border-[var(--border-main)]"
              >
                {['WhatsApp', 'Flow Deployment', 'Integration', 'Node-RED', 'Email', 'Technical Issue'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {!isCustomer && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">Organisation</label>
                <select
                  value={form.orgId}
                  onChange={(e) => setForm({ ...form, orgId: e.target.value })}
                  className="w-full h-9 px-2.5 rounded-md bg-[var(--bg-workspace)] border border-[var(--border-main)]"
                >
                  <option value="">Unknown Organisation</option>
                  {(orgsData?.items || []).map((o) => (
                    <option key={o._id} value={o._id}>{o.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Assign Engineer</label>
                <select
                  value={form.assigneeId}
                  onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
                  className="w-full h-9 px-2.5 rounded-md bg-[var(--bg-workspace)] border border-[var(--border-main)]"
                >
                  <option value="">Unassigned Queue</option>
                  {(engData?.items || []).map((eng) => (
                    <option key={eng._id} value={eng._id}>{eng.fullName}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="block font-semibold mb-1">Description *</label>
            <textarea
              required
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Provide flow IDs, error logs, or reproduction steps..."
              className="w-full p-3 rounded-md bg-[var(--bg-workspace)] border border-[var(--border-main)]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="h-9 px-4 rounded-md border border-[var(--border-main)]">
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="h-9 px-4 rounded-md bg-[#F5C332] hover:bg-[#E6B52C] text-black font-semibold"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
