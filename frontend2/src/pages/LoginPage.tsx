import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Sparkles, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [username, setUsername] = useState('io_patel');
  const [password, setPassword] = useState('police123');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      login(username);
      setLoading(false);
      navigate('/');
    }, 400);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 p-4">
      
      <div className="pro-card w-full max-w-md p-6 shadow-xl space-y-5 border border-slate-800">
        
        {/* Header Logo */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md">
            <Shield className="h-7 w-7" />
          </div>

          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              CRIME<span className="text-blue-500">OS</span> AI
            </h1>
            <p className="text-xs font-medium text-slate-400 mt-0.5">
              State Law Enforcement Portal Access
            </p>
          </div>
        </div>

        {/* Info Banner */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3 text-xs text-slate-300 leading-relaxed">
          <span className="font-semibold text-white flex items-center gap-1.5 mb-0.5">
            <Sparkles className="h-3.5 w-3.5 text-blue-400" />
            Officer Role Authentication
          </span>
          Select an officer role account below to authenticate into the investigation portal.
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Officer Account Role
            </label>
            <select
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="pro-input w-full p-2.5 text-xs font-semibold"
            >
              <option value="io_patel">PSI Inspector V. K. Patel (Investigating Officer)</option>
              <option value="sho_sharma">PI Senior Inspector R. S. Sharma (Station House Officer)</option>
              <option value="legal_desai">Adv. A. M. Desai (State Legal Advisor)</option>
              <option value="admin_crimeos">System Administrator</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Officer Badge Passcode
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pro-input w-full p-2.5 text-xs font-mono"
              placeholder="Enter passcode..."
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 p-3 text-xs font-semibold text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
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

        <div className="text-center pt-1">
          <p className="text-[10px] text-slate-500 font-mono">
            Crime OS AI Engine • Universal Vector Search • 7,337 Grounded SOPs
          </p>
        </div>

      </div>

    </div>
  );
}
