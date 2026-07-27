import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Bell, LogOut, ChevronDown, Activity, Sparkles, Building2, Cpu } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notificationCount] = useState(3);

  const handleLogout = () => {
    setDropdownOpen(false);
    logout();
    navigate('/login');
  };

  const getInitials = (name) => {
    if (!name) return 'IO';
    const parts = name.split(' ');
    return parts.length >= 2 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : name.slice(0, 2).toUpperCase();
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl transition-all">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Brand Logo & System Title */}
        <div 
          onClick={() => navigate('/')}
          className="group flex cursor-pointer items-center gap-3 transition-transform hover:scale-[1.01]"
        >
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-600 via-indigo-600 to-blue-500 shadow-glow-cyan">
            <Shield className="h-6 w-6 text-white transition-transform group-hover:rotate-6" />
            <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500"></span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-extrabold tracking-wide text-white">
                CRIME<span className="gradient-text-cyan">OS</span> AI
              </span>
              <span className="flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-400">
                <Sparkles className="h-3 w-3" /> v2.4 Universal RAG
              </span>
            </div>
            <p className="text-xs font-medium text-slate-400">
              High-Precision Law Enforcement AI Engine
            </p>
          </div>
        </div>

        {/* Status Indicators & User Profile */}
        <div className="flex items-center gap-3 sm:gap-4">
          
          {/* Station Badge */}
          <div className="hidden items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 sm:flex">
            <Building2 className="h-4 w-4 text-emerald-400" />
            <span>{user?.police_station || "Ahmedabad Cyber Crime HQ"}</span>
          </div>

          {/* Active Qdrant Universal RAG Indicator */}
          <div className="hidden items-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-300 md:flex">
            <Cpu className="h-4 w-4 text-indigo-400 animate-pulse" />
            <span>Qdrant Hybrid BM25+Vector</span>
          </div>

          {/* Notifications */}
          <button className="relative rounded-lg border border-slate-800 bg-slate-900/80 p-2 text-slate-300 transition-colors hover:border-slate-700 hover:text-white">
            <Bell className="h-5 w-5" />
            {notificationCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-glow-rose">
                {notificationCount}
              </span>
            )}
          </button>

          {/* User Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-1.5 pr-3 text-left transition-all hover:border-slate-700 hover:bg-slate-800/60"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-tr from-cyan-600 to-indigo-600 font-bold text-white shadow-md">
                {getInitials(user?.full_name)}
              </div>
              <div className="hidden text-xs sm:block">
                <p className="font-bold text-white">{user?.full_name || 'PSI V. K. Patel'}</p>
                <p className="font-medium text-cyan-400">
                  {user?.role === 'SHO' ? 'Station House Officer' : 'Investigating Officer'}
                </p>
              </div>
              <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-800 bg-slate-900/95 p-2 shadow-2xl backdrop-blur-xl">
                <div className="border-b border-slate-800 p-3 sm:hidden">
                  <p className="font-bold text-white">{user?.full_name || 'PSI V. K. Patel'}</p>
                  <p className="text-xs text-cyan-400">{user?.role || 'Investigating Officer'}</p>
                </div>

                <div className="px-3 py-2 text-xs font-semibold text-slate-400">
                  Operational Session Active
                </div>

                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-rose-400 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out Officer Session
                </button>
              </div>
            )}
          </div>

        </div>

      </div>
    </header>
  );
}
