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
  ShieldCheck
} from 'lucide-react';

const pipelineModules = [
  { id: 'dash', title: 'Command Dashboard', icon: LayoutDashboard, path: '/' },
  { id: 'mod1', title: 'Module 1: Multimodal Intake & ASR', icon: FileText, path: '/intake' },
  { id: 'mod2', title: 'Module 2: Serial Linkage Topology Graph', icon: Network, path: '/linkage' },
  { id: 'mod3', title: 'Module 3: Multi-Agent SOP Matrix', icon: Bot, path: '/investigation' },
  { id: 'mod4', title: 'Module 4: Subpoenas & Notices', icon: Send, path: '/subpoenas' },
  { id: 'mod5', title: 'Module 5: CDR & Bank Response Studio', icon: BarChart3, path: '/analytics' },
  { id: 'mod6', title: 'Module 6: Master Court Case Diary', icon: FileCheck2, path: '/case-diary' },
  { id: 'admin', title: 'Module 7: RBAC & Audit Trail', icon: ShieldCheck, path: '/admin' }
];

export default function PipelineNavRail() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <aside className="w-14 h-full border-r border-white/10 bg-[#080d1a] flex flex-col items-center py-2 shrink-0 select-none">
      
      <div className="flex flex-col items-center gap-1.5 w-full">
        {pipelineModules.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              title={item.title}
              className={`relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-sm'
                  : 'text-slate-400 hover:bg-[#0d1322] hover:text-slate-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              {isActive && (
                <span className="absolute -left-1 top-2 bottom-2 w-1 rounded-r-full bg-blue-500" />
              )}
            </button>
          );
        })}
      </div>

    </aside>
  );
}
