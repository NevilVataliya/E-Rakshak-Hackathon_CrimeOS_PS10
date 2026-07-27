import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Sparkles, Building2, Key, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, loading } = useAuthStore();
  const [username, setUsername] = useState('io_patel');
  const [password, setPassword] = useState('police123');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = await login(username, password);
    if (success) {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
      
      {/* Glow Effects */}
      <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />

      <div className="glass-panel w-full max-w-md rounded-3xl p-8 shadow-2xl relative z-10 space-y-6">
        
        {/* Header Logo */}
        <div className="text-center space-y-3">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-600 via-indigo-600 to-blue-500 shadow-glow-cyan">
            <Shield className="h-9 w-9 text-white" />
          </div>

          <div>
            <h1 className="text-2xl font-extrabold tracking-wide text-white">
              CRIME<span className="gradient-text-cyan">OS</span> AI
            </h1>
            <p className="text-xs font-medium text-slate-400 mt-1">
              State Law Enforcement Portal Access
            </p>
          </div>
        </div>

        {/* Info Banner */}
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3.5 text-xs text-cyan-300 leading-relaxed">
          <span className="font-bold text-white flex items-center gap-1.5 mb-0.5">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            Officer Role Authentication
          </span>
          Select an officer role account below to authenticate into the investigation portal.
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Officer Account Role
            </label>
            <select
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="glass-input w-full rounded-xl p-3.5 text-xs font-semibold"
            >
              <option value="io_patel">PSI Inspector V. K. Patel (Investigating Officer)</option>
              <option value="sho_sharma">PI Senior Inspector R. S. Sharma (Station House Officer)</option>
              <option value="legal_desai">Adv. A. M. Desai (State Legal Advisor)</option>
              <option value="admin_crimeos">System Administrator</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Officer Badge Passcode
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="glass-input w-full rounded-xl p-3.5 text-xs font-mono"
              placeholder="Enter passcode..."
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 p-4 text-xs font-bold text-white shadow-glow-cyan transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Authenticating Credentials...</span>
              </>
            ) : (
              <>
                <Lock className="h-4 w-4" />
                <span>Authenticate & Access Portal</span>
              </>
            )}
          </button>

        </form>

        <div className="text-center pt-2">
          <p className="text-[11px] text-slate-500">
            Crime OS AI Engine • Universal Vector Search • 7,337 Grounded SOPs
          </p>
        </div>

      </div>

    </div>
  );
}
