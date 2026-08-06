import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Sparkles, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export default function LoginView() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [username, setUsername] = useState('io_patel');
  const [password, setPassword] = useState('police123');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await login(username, password);
    setLoading(false);
    navigate('/');
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#050811] p-4 select-none">
      
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0d1322] p-6 shadow-2xl space-y-4">
        
        {/* Header Logo */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded bg-blue-600 text-white font-bold text-lg shadow-sm">
            <Shield className="h-6 w-6" />
          </div>

          <div>
            <h1 className="text-lg font-extrabold tracking-wider text-white font-mono">
              CRIME<span className="text-blue-500">OS</span> / TACTICAL
            </h1>
            <p className="text-xs font-medium text-slate-400 mt-0.5">
              State Law Enforcement Tactical Portal
            </p>
          </div>
        </div>

        {/* Info Banner */}
        <div className="rounded border border-blue-500/30 bg-blue-500/10 p-2.5 text-xs text-slate-300 leading-relaxed">
          <span className="font-bold text-white flex items-center gap-1.5 mb-0.5">
            <Sparkles className="h-3.5 w-3.5 text-blue-400" />
            Officer Role Authentication
          </span>
          Select an officer role account below to authenticate into the investigation portal.
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Officer Account Role
            </label>
            <select
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-9 w-full rounded border border-white/10 bg-[#050811] px-2.5 text-xs font-semibold text-slate-200 outline-none"
            >
              <option value="io_patel">PSI Inspector V. K. Patel (Investigating Officer)</option>
              <option value="sho_sharma">PI Senior Inspector R. S. Sharma (Station House Officer)</option>
              <option value="legal_desai">Adv. A. M. Desai (State Legal Advisor)</option>
              <option value="admin_crimeos">System Administrator</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Officer Badge Passcode
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-9 w-full rounded border border-white/10 bg-[#050811] px-2.5 text-xs font-mono text-slate-200 outline-none"
              placeholder="Enter passcode..."
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded bg-blue-600 p-2.5 text-xs font-bold text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            <span>Authenticate Officer Credentials</span>
          </button>

        </form>

        <div className="text-center pt-1">
          <p className="text-[10px] text-slate-500 font-mono">
            Crime OS AI Engine • Universal Vector Search • 7,337 Grounded SOPs
          </p>
        </div>

      </div>

    </div>
  );
}
