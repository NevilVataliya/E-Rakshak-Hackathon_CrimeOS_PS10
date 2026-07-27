import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  Bot, 
  Send, 
  BarChart3, 
  ShieldCheck, 
  LogOut,
  Zap,
  BookOpen
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const menuItems = [
  { text: 'Command Dashboard', icon: LayoutDashboard, path: '/', badge: 'Live' },
  { text: 'Victim Complaint Studio', icon: FileText, path: '/complaints', badge: 'AI HIN' },
  { text: 'Agentic Investigation', icon: Bot, path: '/investigation', badge: 'RAG 95%' },
  { text: 'Subpoena & Freeze Directives', icon: Send, path: '/requests' },
  { text: 'Crime Link Analytics', icon: BarChart3, path: '/analytics' },
  { text: 'Vector Audit & System Settings', icon: ShieldCheck, path: '/admin' }
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="w-64 border-r border-slate-800/80 bg-slate-950/60 p-4 backdrop-blur-xl transition-all">
      <div className="flex flex-col justify-between h-[calc(100vh-5rem)]">
        
        <div>
          <div className="px-3 py-2 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
            Navigation Menu
          </div>

          <nav className="mt-2 space-y-1.5">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <button
                  key={item.text}
                  onClick={() => navigate(item.path)}
                  className={`group relative flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-500/15 to-indigo-500/15 text-white border border-cyan-500/30 shadow-glow-cyan'
                      : 'text-slate-400 hover:bg-slate-900/80 hover:text-white hover:border-slate-800 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`h-4 w-4 transition-transform group-hover:scale-110 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                    <span className="truncate">{item.text}</span>
                  </div>

                  {item.badge && (
                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-extrabold ${
                      isActive 
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' 
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {item.badge}
                    </span>
                  )}

                  {isActive && (
                    <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-cyan-400 shadow-glow-cyan" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Operational Status Footer & Logout */}
        <div className="space-y-3 pt-4 border-t border-slate-800/80">
          
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
              <Zap className="h-4 w-4 text-emerald-400 animate-bounce" />
              <span>Qdrant Universal Vector Store</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              7,337 Pristine Legal SOP Chunks Active
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl border border-rose-500/20 bg-rose-500/5 px-3.5 py-2.5 text-xs font-bold text-rose-400 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out Session</span>
          </button>

        </div>

      </div>
    </aside>
  );
}
