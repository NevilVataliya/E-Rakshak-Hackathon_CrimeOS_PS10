import React, { useState, useEffect } from 'react';
import { useCaseStore } from '../../store/caseStore';
import { useAuthStore } from '../../store/authStore';
import { 
  ShieldAlert, 
  Cpu, 
  Database, 
  Mail, 
  Search, 
  UserCheck, 
  ChevronDown,
  FolderOpen
} from 'lucide-react';
import CommandPaletteDialog from './CommandPaletteDialog';
import TacticalStepperModal from './TacticalStepperModal';
import api from '../../services/api';

export default function CommandHeader() {
  const { cases, activeCase, setActiveCase } = useCaseStore();
  const { user, switchRole } = useAuthStore();

  const [systemStatus, setSystemStatus] = useState<any>({
    offline_mode: false,
    cloud_keys_configured: true,
    qdrant_online: true,
    mail_configured: true,
    cctns_synced: true
  });
  const [isCaseMenuOpen, setIsCaseMenuOpen] = useState(false);
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isStepperModalOpen, setIsStepperModalOpen] = useState(false);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await api.get('/api/system/status');
        if (res.data) {
          setSystemStatus((prev: any) => ({ ...prev, ...res.data }));
        }
      } catch (err) {
        console.warn('Backend telemetry check fallback');
      }
    };
    fetchStatus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <header className="h-16 bg-[#090d18] border-b border-slate-800/80 px-4 flex items-center justify-between z-40 select-none backdrop-blur-md">
        {/* Left: Brand Identity & Active Case Switcher */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-500/40 flex items-center justify-center glow-cyan">
              <ShieldAlert className="w-5 h-5 text-cyan-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-base font-extrabold tracking-wider bg-gradient-to-r from-cyan-400 via-sky-200 to-blue-400 bg-clip-text text-transparent">
                  CRIME OS AI
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 font-mono font-semibold">
                  v2.0 HACKATHON
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium tracking-tight">
                Intelligence-Led Police Command Center
              </p>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-800" />

          {/* Active Case Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsCaseMenuOpen(!isCaseMenuOpen)}
              className="flex items-center space-x-2.5 px-3 py-1.5 rounded-md bg-slate-900/90 hover:bg-slate-800/90 border border-slate-700/70 transition-all text-xs text-slate-200"
            >
              <FolderOpen className="w-4 h-4 text-cyan-400" />
              {activeCase ? (
                <div className="text-left">
                  <div className="font-mono font-bold text-slate-100 flex items-center space-x-1.5">
                    <span>{activeCase.fir_number || activeCase.case_number}</span>
                    <span className="text-[10px] text-cyan-400 bg-cyan-950 px-1 rounded border border-cyan-800">
                      {activeCase.crime_category}
                    </span>
                  </div>
                </div>
              ) : (
                <span className="text-slate-400 italic">No Active Case Selected</span>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
            </button>

            {isCaseMenuOpen && (
              <div className="absolute left-0 mt-2 w-72 bg-[#0c1220] border border-slate-700/80 rounded-lg shadow-2xl z-50 py-1.5 overflow-hidden">
                <div className="px-3 py-1.5 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex justify-between items-center">
                  <span>Select Active Case</span>
                  <span className="text-cyan-400 font-mono text-[10px]">{cases.length} Loaded</span>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {cases.map((c) => (
                    <button
                      key={c.case_number}
                      onClick={() => {
                        setActiveCase(c);
                        setIsCaseMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-800/80 flex items-center justify-between border-b border-slate-800/40 transition-colors ${
                        activeCase?.case_number === c.case_number ? 'bg-cyan-950/60 border-l-2 border-l-cyan-400' : ''
                      }`}
                    >
                      <div>
                        <div className="font-mono font-bold text-slate-200">{c.fir_number || c.case_number}</div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[180px]">{c.crime_sub_type}</div>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                        {c.crime_category}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center: Stepper Modal Trigger & Global Search Bar Trigger */}
        <div className="hidden md:flex items-center space-x-3">
          <button
            onClick={() => setIsStepperModalOpen(true)}
            className="flex items-center space-x-2 px-3 py-1.5 bg-gradient-to-r from-blue-900/60 to-indigo-900/60 hover:from-blue-800/80 hover:to-indigo-800/80 border border-blue-500/40 rounded-lg text-xs font-mono font-bold text-blue-300 transition-all shadow-sm glow-blue"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-blue-400" />
            <span>🚀 Pipeline Steps (Step {activeCase?.currentStep || 1}/6)</span>
          </button>

          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            className="flex items-center space-x-3 px-4 py-1.5 bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 rounded-lg text-xs text-slate-400 transition-all w-64 justify-between group"
          >
            <div className="flex items-center space-x-2 truncate">
              <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-400 transition-colors shrink-0" />
              <span className="truncate">Search cases, SOPs, laws...</span>
            </div>
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-950 border border-slate-800 text-slate-400 rounded shrink-0">
              Ctrl K
            </kbd>
          </button>
        </div>

        {/* Right: Operational Telemetry & Role Selector */}
        <div className="flex items-center space-x-3">
          {/* Telemetry Status Badges */}
          <div className="hidden xl:flex items-center space-x-2 bg-slate-900/60 border border-slate-800/80 rounded-md px-2.5 py-1 text-[11px]">
            {/* AI Engine Status */}
            <div className="flex items-center space-x-1.5" title={systemStatus.offline_mode ? "Standalone Offline Mode Active" : "Cloud Polyglot LLM Engine Online"}>
              <Cpu className={`w-3.5 h-3.5 ${systemStatus.offline_mode ? 'text-amber-400' : 'text-cyan-400'}`} />
              <span className="font-mono text-slate-300">
                {systemStatus.offline_mode ? 'OFFLINE AI' : 'CLOUD LLM'}
              </span>
            </div>

            <span className="text-slate-700">|</span>

            {/* Vector DB (Qdrant) */}
            <div className="flex items-center space-x-1.5" title="Qdrant SOP Vector Store Online">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-mono text-slate-300">QDRANT RAG</span>
            </div>

            <span className="text-slate-700">|</span>

            {/* Mail Gateway */}
            <div className="flex items-center space-x-1.5" title="SMTP & IMAP Mail Poller Operational">
              <Mail className="w-3.5 h-3.5 text-sky-400" />
              <span className="font-mono text-slate-300">SMTP/IMAP</span>
            </div>
          </div>

          {/* Role-Based Access Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsRoleMenuOpen(!isRoleMenuOpen)}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-md bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700/80 hover:border-cyan-500/50 text-xs text-slate-200 transition-all"
            >
              <UserCheck className="w-4 h-4 text-cyan-400" />
              <div className="text-left">
                <span className="font-bold text-slate-200 block text-[11px] leading-tight">
                  {user?.role === 'IO' ? 'Investigating Officer (IO)' : user?.role === 'SHO' ? 'Station House Officer (SHO)' : 'Legal Advisor'}
                </span>
                <span className="text-[10px] text-slate-400 block leading-tight">{user?.full_name}</span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {isRoleMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-[#0c1220] border border-slate-700/80 rounded-lg shadow-2xl z-50 py-1 overflow-hidden">
                <div className="px-3 py-1.5 border-b border-slate-800 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Switch Active Role
                </div>
                {[
                  { role: 'IO', label: 'Investigating Officer (IO)', desc: 'Full case intake, SOP path & notice dispatch' },
                  { role: 'SHO', label: 'Station House Officer (SHO)', desc: 'HITL Notice approvals & station logs' },
                  { role: 'LEGAL_ADVISOR', label: 'Legal Advisor', desc: 'BNSS / BNS / BSA statute verification' }
                ].map((r) => (
                  <button
                    key={r.role}
                    onClick={() => {
                      switchRole(r.role as any);
                      setIsRoleMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-800/80 border-b border-slate-800/40 ${
                      user?.role === r.role ? 'bg-cyan-950/60 text-cyan-300 font-semibold' : 'text-slate-300'
                    }`}
                  >
                    <div>{r.label}</div>
                    <div className="text-[10px] text-slate-400">{r.desc}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Global Command Palette Modal & Tactical Stepper Modal */}
      {isCommandPaletteOpen && (
        <CommandPaletteDialog open={isCommandPaletteOpen} onOpenChange={setIsCommandPaletteOpen} />
      )}
      {isStepperModalOpen && (
        <TacticalStepperModal isOpen={isStepperModalOpen} onClose={() => setIsStepperModalOpen(false)} />
      )}
    </>
  );
}
