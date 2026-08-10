import React, { useState } from 'react';
import { Shield, Search, Building2, ChevronDown, LogOut, Command } from 'lucide-react';
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
      <header className="h-10 w-full border-b border-white/10 bg-[#080d1a] px-3 flex items-center justify-between shrink-0 select-none text-slate-200">

        {/* Left: Police Emblem Brand & Station Name */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-600 text-white font-bold text-xs shadow-sm">
              <Shield className="h-3.5 w-3.5" />
            </div>
            <span className="text-xs font-extrabold tracking-wider text-white font-mono uppercase">
              CrimeOS
            </span>
          </div>

          <div className="h-3.5 w-px bg-white/10" />

          <div className="flex items-center gap-1.5 text-xs text-slate-300">
            <Building2 className="h-3.5 w-3.5 text-blue-400 shrink-0" />
            <span className="font-semibold text-slate-200">{user?.police_station || 'Gujarat Cyber Crime Station'}</span>
          </div>
        </div>

        {/* Center: Minimal Global Search Bar (CMDK Trigger) */}
        <button
          onClick={() => setCmdOpen(true)}
          className="flex h-7 w-80 items-center justify-between rounded-lg border border-white/10 bg-[#050811] px-2.5 text-xs text-slate-400 transition-colors hover:border-white/20 hover:text-slate-200"
        >
          <div className="flex items-center gap-2">
            <Search className="h-3 w-3 text-slate-400" />
            <span className="text-[11px] truncate">Search FIR, Phone, Bank A/c, or VPA...</span>
          </div>
          <kbd className="inline-flex items-center gap-0.5 rounded border border-white/10 bg-[#0d1322] px-1.5 py-0.2 text-[9px] font-mono text-slate-400">
            <Command className="h-2.5 w-2.5" /> K
          </kbd>
        </button>

        {/* Right: IO Officer Profile */}
        <div className="flex items-center gap-3">
          {activeCase && (
            <div className="flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-[#050811] px-2.5 py-1 text-xs font-mono">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Active:</span>
              <span className="font-bold text-cyan-300">{activeCase.case_number}</span>
            </div>
          )}

          <div className="h-3.5 w-px bg-white/10" />

          {/* Officer Profile Badge & Dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0d1322] px-2.5 py-1 text-xs text-slate-200 hover:border-white/20 transition-colors"
            >
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white font-mono">
                IO
              </div>
              <span className="text-xs font-bold">{user?.full_name || 'PSI V. K. Patel'}</span>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-52 rounded-lg border border-white/10 bg-[#0d1322] p-1.5 shadow-2xl z-50">
                <div className="px-2.5 py-2 border-b border-white/10 text-xs">
                  <p className="font-bold text-white">{user?.full_name || 'PSI V. K. Patel'}</p>
                  <p className="text-[10px] text-blue-400 font-mono mt-0.5">{user?.role || 'Investigating Officer (IO)'}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{user?.police_station || 'Gujarat Cyber Crime Station'}</p>
                </div>
                <button
                  onClick={() => {
                    logout();
                    setDropdownOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors mt-1"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign Out</span>
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
