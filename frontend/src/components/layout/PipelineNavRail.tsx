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
import { useCaseStore } from '../../store/caseStore';

const pipelineModules = [
  { id: 'dash', title: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { id: 'mod1', title: 'Complaint Intake', icon: FileText, path: '/intake' },
  { id: 'mod2', title: 'Serial Offender Linkage', icon: Network, path: '/linkage' },
  { id: 'mod3', title: 'Investigation Studio', icon: Bot, path: '/investigation' },
  { id: 'mod4', title: 'Subpoenas & Notices', icon: Send, path: '/subpoenas' },
  { id: 'mod5', title: 'CDR & Bank Response Analysis', icon: BarChart3, path: '/analytics' },
  { id: 'admin', title: 'Administration & Audit', icon: ShieldCheck, path: '/admin' }
];

export default function PipelineNavRail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeCase, completedStepByCase } = useCaseStore();

  const caseNo = activeCase?.case_number;
  const completedStep = caseNo ? (completedStepByCase[caseNo] ?? activeCase?.completed_step ?? 0) : 0;

  const stepMapping: Record<string, number> = {
    mod1: 1,
    mod2: 2,
    mod3: 3,
    mod4: 4,
    mod5: 5
  };

  return (
    <aside className="w-14 h-full border-r border-slate-700/60 bg-[#0A2540] flex flex-col items-center py-2 shrink-0 select-none shadow-md">
      <div className="flex flex-col items-center gap-2 w-full">
        {pipelineModules.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          const stepNum = stepMapping[item.id];
          const isLocked = Boolean(stepNum && stepNum > (completedStep + 1));

          return (
            <button
              key={item.id}
              disabled={isLocked}
              onClick={() => !isLocked && navigate(item.path)}
              title={isLocked ? `${item.title} (Complete previous step first)` : item.title}
              className={`relative flex h-10 w-10 items-center justify-center rounded transition-colors ${
                isLocked
                  ? 'text-slate-600 opacity-40 cursor-not-allowed'
                  : isActive
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
              {isActive && (
                <span className="absolute -left-1 top-2 bottom-2 w-1 rounded-r-full bg-amber-400" />
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
