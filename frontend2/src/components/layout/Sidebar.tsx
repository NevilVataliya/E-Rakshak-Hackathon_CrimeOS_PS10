import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  Network, 
  Bot, 
  Send, 
  BarChart3, 
  FileCheck2,
  ShieldCheck, 
  LogOut,
  Database
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

const pipelineSteps = [
  { text: 'Command Dashboard', icon: LayoutDashboard, path: '/' },
  { text: 'Step 1: Intake & NLP', icon: FileText, path: '/complaints', badge: 'Auto-NLP' },
  { text: 'Step 2: Memory & Linkage', icon: Network, path: '/linkage', badge: 'Qdrant' },
  { text: 'Step 3: Agent Studio', icon: Bot, path: '/investigation', badge: 'LangGraph' },
  { text: 'Step 4: Subpoenas & Notices', icon: Send, path: '/subpoenas' },
  { text: 'Step 5: CDR & Bank Response', icon: BarChart3, path: '/response-analytics' },
  { text: 'Step 6: Master Court Diary', icon: FileCheck2, path: '/case-diary', badge: 'BSA 63' },
  { text: 'RBAC & Audit Trail', icon: ShieldCheck, path: '/admin' }
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuthStore();

  return (
    <aside className="w-60 border-r border-slate-800 bg-slate-950 p-3 flex flex-col justify-between">
      <div>
        <div className="px-2 py-1.5 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
          Investigation Pipeline
        </div>

        <nav className="mt-1 space-y-1">
          {pipelineSteps.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <button
                key={item.text}
                onClick={() => navigate(item.path)}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`h-4 w-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                  <span className="truncate">{item.text}</span>
                </div>

                {item.badge && (
                  <span className={`rounded px-1.5 py-0.2 text-[9px] font-mono font-semibold ${
                    isActive 
                      ? 'bg-blue-500/20 text-blue-300' 
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Operational Vector Store Badge & Session Logout */}
      <div className="space-y-2 pt-3 border-t border-slate-800">
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-300">
            <Database className="h-3.5 w-3.5 text-blue-400" />
            <span>Qdrant SOP Database</span>
          </div>
          <p className="mt-0.5 text-[10px] text-slate-400 font-mono">
            7,337 Grounded SOP Chunks
          </p>
        </div>

        <button
          onClick={() => {
            logout();
            navigate('/login');
          }}
          className="flex w-full items-center gap-2 rounded-lg border border-slate-800 px-2.5 py-2 text-xs font-medium text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/30 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign Out Session</span>
        </button>
      </div>
    </aside>
  );
}
