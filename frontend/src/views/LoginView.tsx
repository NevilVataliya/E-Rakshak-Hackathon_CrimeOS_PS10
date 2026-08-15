import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Shield, Lock, Building2, Award, Loader2, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import LanguageSelector from '../components/layout/LanguageSelector';

export default function LoginView() {
  const { t } = useTranslation();
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
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-100 dark:bg-[#050811] p-4 relative">
      
      {/* Top Floating Language Switcher */}
      <div className="absolute top-4 right-4 z-50">
        <LanguageSelector />
      </div>

      {/* Central Login Card */}
      <div className="w-full max-w-md rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#0d1322] shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100">
        
        {/* Tricolor Header Stripe */}
        <div className="h-1.5 w-full flex">
          <div className="h-full w-1/3 bg-[#FF9933]" />
          <div className="h-full w-1/3 bg-white" />
          <div className="h-full w-1/3 bg-[#138808]" />
        </div>

        {/* Navy Header Banner */}
        <div className="bg-[#0A2540] p-5 text-center text-white space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded bg-amber-500 text-slate-950 font-bold shadow-md">
            <Shield className="h-7 w-7" />
          </div>

          <div>
            <div className="text-[10px] font-bold tracking-widest text-amber-400 uppercase font-mono">
              {t('brand.govt', 'GOVERNMENT OF GUJARAT')} • {t('brand.department', 'POLICE DEPARTMENT')}
            </div>
            <h1 className="text-xl font-black tracking-wider text-white uppercase mt-0.5">
              CRIME<span className="text-amber-400">OS</span> PORTAL
            </h1>
            <p className="text-xs text-slate-300 font-medium">
              Cyber Crime Investigation & Law Enforcement Requisition Suite
            </p>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-6 space-y-4">

          {/* Info Banner */}
          <div className="rounded border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3 text-xs text-slate-800 dark:text-amber-200 leading-relaxed flex items-start gap-2">
            <Award className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-900 dark:text-white block">Authorized Access Only</span>
              Select your official police officer designation below to authenticate credentials into CrimeOS.
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            
            <div>
              <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Building2 className="h-3 w-3 text-slate-500 dark:text-slate-400" />
                <span>Officer Account Role</span>
              </label>
              <select
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-10 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#050811] px-3 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-[#080d1a] focus:border-amber-500 outline-none"
              >
                <option value="io_patel" className="bg-white dark:bg-[#0d1322]">PSI V. K. Patel (Investigating Officer)</option>
                <option value="sho_sharma" className="bg-white dark:bg-[#0d1322]">PI R. S. Sharma (Station House Officer)</option>
                <option value="legal_desai" className="bg-white dark:bg-[#0d1322]">Adv. A. M. Desai (State CID Legal Advisor)</option>
                <option value="admin_crimeos" className="bg-white dark:bg-[#0d1322]">System Administrator (Surat Cyber Command)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Lock className="h-3 w-3 text-slate-500 dark:text-slate-400" />
                <span>Officer Badge Passcode</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#050811] px-3 text-xs font-mono text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-[#080d1a] focus:border-amber-500 outline-none"
                placeholder="Enter passcode..."
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded bg-[#0A2540] dark:bg-amber-500 dark:text-slate-950 p-3 text-xs font-bold text-white hover:bg-slate-800 dark:hover:bg-amber-600 transition-colors disabled:opacity-50 shadow-md"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin text-amber-400 dark:text-slate-950" /> : <CheckCircle2 className="h-4 w-4 text-amber-400 dark:text-slate-950" />}
              <span>Authenticate Officer Credentials</span>
            </button>

          </form>

          <div className="text-center pt-2 border-t border-slate-100 dark:border-white/10">
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
              Official Police Portal • Secure Encrypted Audit Trail
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}
