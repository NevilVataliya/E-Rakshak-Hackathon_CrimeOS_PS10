import React, { useState } from 'react';
import { Shield, Search, Building2, ChevronDown, LogOut, Command, Sun, Moon } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useCaseStore } from '../../store/caseStore';
import { useUIStore } from '../../store/uiStore';
import CommandPaletteDialog from './CommandPaletteDialog';
import GlobalSummarizerModal from '../common/GlobalSummarizerModal';

export default function CommandHeader() {
  const { user, logout } = useAuthStore();
  const { cases, activeCase, setActiveCase } = useCaseStore();
  const { theme, toggleTheme } = useUIStore();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [globalSumOpen, setGlobalSumOpen] = useState(false);

  return (
    <>
      {/* Official Indian Tricolor Top Band */}
      <div className="h-1 w-full flex shrink-0">
        <div className="h-full w-1/3 bg-[#FF9933]" />
        <div className="h-full w-1/3 bg-white" />
        <div className="h-full w-1/3 bg-[#138808]" />
      </div>

      <header className="h-11 w-full border-b border-slate-700/60 bg-[#0A2540] px-4 flex items-center justify-between shrink-0 select-none text-white shadow-md">

        {/* Left: Police Emblem Brand & Official Government Header */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-amber-500 text-slate-950 font-bold shadow">
              <Shield className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold tracking-widest text-amber-400 uppercase font-mono">
                  GOVERNMENT OF GUJARAT
                </span>
                <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-400/30">
                  OFFICIAL
                </span>
              </div>
              <span className="text-xs font-black tracking-wider text-white uppercase">
                POLICE DEPARTMENT • CYBER CRIME CELL
              </span>
            </div>
          </div>

          <div className="h-4 w-px bg-slate-600/60" />

          <div className="flex items-center gap-1.5 text-xs text-slate-300">
            <Building2 className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span className="font-semibold text-slate-200">{user?.police_station || 'State Cyber Crime Command HQ'}</span>
          </div>
        </div>

        {/* Center: Search Bar (CMDK Trigger) */}
        <button
          onClick={() => setCmdOpen(true)}
          className="flex h-7 w-80 items-center justify-between rounded border border-slate-600/80 bg-slate-800/80 px-2.5 text-xs text-slate-300 transition-colors hover:border-amber-400/50 hover:bg-slate-800 hover:text-white"
        >
          <div className="flex items-center gap-2">
            <Search className="h-3 w-3 text-amber-400" />
            <span className="text-[11px] truncate">Search Case FIR, Phone, Account, or VPA...</span>
          </div>
          <kbd className="inline-flex items-center gap-0.5 rounded border border-slate-600 bg-slate-900 px-1.5 py-0.2 text-[9px] font-mono text-slate-300">
            <Command className="h-2.5 w-2.5" /> K
          </kbd>
        </button>

        {/* Right: Active Case, Theme Toggle & Officer Profile Badge */}
        <div className="flex items-center gap-3">
          {activeCase && (
            <div className="flex items-center gap-1.5 rounded border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-xs font-mono">
              <span className="text-[10px] font-bold text-amber-300 uppercase">ACTIVE FIR:</span>
              <span className="font-bold text-white">{activeCase.case_number}</span>
            </div>
          )}

          {/* Light / Dark Mode Toggle Button */}
          <button
            onClick={toggleTheme}
            className="flex items-center gap-1.5 rounded border border-slate-600 bg-slate-800/80 px-2.5 py-1 text-xs font-semibold text-amber-300 hover:bg-slate-700 hover:text-white transition-colors"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? (
              <>
                <Sun className="h-3.5 w-3.5 text-amber-400" />
                <span className="hidden md:inline text-[11px] font-mono">Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="h-3.5 w-3.5 text-amber-300" />
                <span className="hidden md:inline text-[11px] font-mono">Dark Mode</span>
              </>
            )}
          </button>

          <div className="h-4 w-px bg-slate-600/60" />

          {/* Officer Profile Badge & Dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 rounded border border-slate-600 bg-slate-800 px-2.5 py-1 text-xs text-white hover:border-amber-400/50 transition-colors"
            >
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-slate-950 font-mono">
                IO
              </div>
              <span className="text-xs font-bold">{user?.full_name || 'PSI Inspector V. K. Patel'}</span>
              <ChevronDown className="h-3 w-3 text-slate-300" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-56 rounded border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1322] p-2 shadow-xl text-slate-900 dark:text-slate-100 z-50">
                <div className="px-2 py-1.5 border-b border-slate-100 dark:border-white/10 text-xs">
                  <p className="font-bold text-slate-900 dark:text-white">{user?.full_name || 'PSI Inspector V. K. Patel'}</p>
                  <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 font-mono mt-0.5">{user?.role || 'Investigating Officer (IO)'}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{user?.police_station || 'Surat Cyber Crime Station'}</p>
                </div>
                <button
                  onClick={() => {
                    logout();
                    setDropdownOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors mt-1"
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

      {/* Global Executive AI Summarizer Modal */}
      <GlobalSummarizerModal isOpen={globalSumOpen} onClose={() => setGlobalSumOpen(false)} />
    </>
  );
}
