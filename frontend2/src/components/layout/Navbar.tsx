import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Bell, LogOut, ChevronDown, Building2, Cpu, User } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleLogout = () => {
    setDropdownOpen(false);
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-950/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">

        {/* Brand & System Title */}
        <div
          onClick={() => navigate('/')}
          className="flex cursor-pointer items-center gap-3"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
            <Shield className="h-5 w-5" />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-base font-bold tracking-tight text-white">
              CRIME<span className="text-blue-500">OS</span>
            </span>
            <span className="rounded border border-slate-700 bg-slate-800/80 px-2 py-0.5 text-[10px] font-mono font-semibold text-slate-300">
              v2.4 SOP Grounded
            </span>
          </div>
        </div>

        {/* Station Metadata & Officer Profile */}
        <div className="flex items-center gap-3">

          {/* Station Badge */}
          <div className="hidden items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-slate-300 sm:flex">
            <Building2 className="h-3.5 w-3.5 text-blue-400" />
            <span className="font-medium">{user?.police_station || "Ahmedabad Cyber HQ"}</span>
          </div>

          {/* Active Vector Index */}
          <div className="hidden items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-slate-300 md:flex">
            <Cpu className="h-3.5 w-3.5 text-emerald-400" />
            <span className="font-mono text-[11px] text-slate-300">police_sops_v2</span>
          </div>

          {/* User Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-left text-xs transition-colors hover:border-slate-700 hover:bg-slate-800/80"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-800 text-blue-400">
                <User className="h-4 w-4" />
              </div>
              <div className="hidden text-xs sm:block">
                <p className="font-semibold text-white leading-none">{user?.full_name || 'PSI V. K. Patel'}</p>
                <p className="text-[10px] text-slate-400 mt-0.5 font-medium">{user?.role || 'Investigating Officer'}</p>
              </div>
              <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-48 rounded-xl border border-slate-800 bg-slate-900 p-1.5 shadow-xl">
                <div className="px-3 py-2 border-b border-slate-800">
                  <p className="font-semibold text-xs text-white">{user?.full_name}</p>
                  <p className="text-[10px] text-slate-400">{user?.police_station}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out Session
                </button>
              </div>
            )}
          </div>

        </div>

      </div>
    </header>
  );
}
