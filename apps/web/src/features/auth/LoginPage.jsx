import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { apiFetch } from '../../lib/api.js';
import { useAppStore } from '../../stores/useAppStore.js';

const DEMO_ACCOUNTS = [
  { label: 'Super Admin (Ravi Kumar)', email: 'ravi.kumar@sinchflows.io' },
  { label: 'System Admin (Mohammed Obaid)', email: 'm.obaid@sinchflows.io' },
  { label: 'Support Engineer (Aisha Al-Zahrani)', email: 'aisha.z@sinchflows.io' },
  { label: 'Customer — Al-Dawaa (Tariq)', email: 'tariq.mansoor@al-dawaa.com' }
];

export default function LoginPage() {
  const [email, setEmail] = useState('ravi.kumar@sinchflows.io');
  const [password, setPassword] = useState('Flows@2026!');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setUser, addToast } = useAppStore();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: { email, password }
      });
      setUser(data.user);
      addToast(`Welcome back, ${data.user.fullName}`, 'success');
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#000000] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#171717] border border-neutral-800 rounded-2xl p-8 text-white shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#242424] border border-neutral-700 flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M4 6H20L16 12H8L4 6Z" fill="#F5C332" />
              <path d="M8 14H18L14 20H6L8 14Z" fill="#FFFFFF" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Flows Helpdesk</h1>
            <p className="text-xs text-[#F5C332] font-medium">Enterprise Support Ticketing · Sinch Flows</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/60 border border-red-800 text-red-200 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">Work Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-[#242424] border border-neutral-700 text-sm text-white focus:outline-none focus:border-[#F5C332]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-[#242424] border border-neutral-700 text-sm text-white focus:outline-none focus:border-[#F5C332]"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-lg bg-[#F5C332] hover:bg-[#E6B52C] text-black font-semibold text-sm transition disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign in to Flows Helpdesk'}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-neutral-800">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
            Quick Fill Seeded Persona (Password: Flows@2026!)
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => {
                  setEmail(acc.email);
                  setPassword('Flows@2026!');
                }}
                className="text-left px-3 py-2 rounded-lg bg-[#242424] hover:bg-neutral-800 border border-neutral-800 text-xs flex items-center justify-between"
              >
                <span className="font-medium text-gray-200">{acc.label}</span>
                <span className="text-[11px] text-gray-400 font-mono">{acc.email}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
