import React, { useState } from 'react';
import { Shield, Search, Cpu, Building2, User, Bell, Command, ChevronDown, LogOut } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useCaseStore } from '../../store/caseStore';
import CommandPaletteDialog from './CommandPaletteDialog';

export default function CommandHeader() {
  const { user, logout } = useAuthStore();
  const { cases, activeCase, setActiveCase } = useCaseStore();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <>
      <header className="h-11 w-full border-b border-white/10 bg-[#080d1a] px-3 flex items-center justify-between shrink-0 select-none">

        {/* Brand Badge & Station Selector */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-600 text-white font-bold text-xs shadow-sm">
              <Shield className="h-3.5 w-3.5" />
            </div>
            <span className="text-xs font-extrabold tracking-wider text-white font-mono">
              CRIME<span className="text-blue-500">OS</span> / TACTICAL
            </span>
          </div>

          <div className="h-3.5 w-px bg-white/10" />

          {/* Active Station */}
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
            <Building2 className="h-3.5 w-3.5 text-blue-400" />
            <span>{user?.police_station || 'Ahmedabad Cyber Crime HQ'}</span>
          </div>
        </div>

        {/* Center: Global Search Bar (CMDK Trigger) */}
        <button
          onClick={() => setCmdOpen(true)}
          className="flex h-7 w-72 items-center justify-between rounded-md border border-white/10 bg-[#050811] px-2.5 text-xs text-slate-400 transition-colors hover:border-white/20 hover:text-slate-200"
        >
          <div className="flex items-center gap-2">
            <Search className="h-3 w-3 text-slate-500" />
            <span className="text-[11px] font-medium truncate">Search FIR, VPA, Phone or Statute...</span>
          </div>
          <kbd className="inline-flex items-center gap-0.5 rounded border border-white/10 bg-[#0d1322] px-1.5 py-0.5 text-[9px] font-mono text-slate-400">
            <Command className="h-2.5 w-2.5" /> K
          </kbd>
        </button>

        {/* Right: Vector Index Status & Officer Profile */}
        <div className="flex items-center gap-3">

          {/* Active Qdrant Store Status */}
          <div className="flex items-center gap-1.5 rounded border border-white/10 bg-[#0d1322] px-2 py-0.5 text-[11px] font-mono text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
            <Cpu className="h-3 w-3 text-emerald-400" />
            <span>police_sops_v2: 7,337 Chunks</span>
          </div>

          <div className="h-3.5 w-px bg-white/10" />

          {/* Active Case Selector Pill */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-slate-400 uppercase">Active Case:</span>
            <select
              value={activeCase?.case_number || ''}
              onChange={(e) => {
                const found = cases.find((c: any) => c.case_number === e.target.value);
                if (found) setActiveCase(found);
              }}
              className="h-7 rounded border border-white/10 bg-[#050811] px-2 text-[11px] font-mono font-bold text-cyan-400 outline-none"
            >
              {cases.map((c: any) => (
                <option key={c.case_number} value={c.case_number}>
                  {c.case_number} ({c.crime_category})
                </option>
              ))}
            </select>
          </div>

          {/* User Profile */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-1.5 rounded border border-white/10 bg-[#0d1322] px-2 py-1 text-xs text-slate-200 hover:border-white/20 transition-colors"
            >
              <div className="flex h-5 w-5 items-center justify-center rounded bg-blue-600 text-[10px] font-bold text-white">
                IO
              </div>
              <span className="text-[11px] font-semibold">{user?.full_name || 'PSI V. K. Patel'}</span>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-1 w-48 rounded border border-white/10 bg-[#0d1322] p-1 shadow-2xl z-50">
                <div className="px-2 py-1.5 border-b border-white/10 text-[11px]">
                  <p className="font-bold text-white">{user?.full_name}</p>
                  <p className="text-[10px] text-slate-400">{user?.police_station}</p>
                </div>
                <button
                  onClick={() => {
                    logout();
                    setDropdownOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-rose-400 hover:bg-rose-500/10 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out Session
                </button>
              </div>
            )}
          </div>

        </div>

      </header>

      {/* Global Command Palette */}
      <CommandPaletteDialog open={cmdOpen} onOpenChange={setCmdOpen} />
    </>
  );
}
