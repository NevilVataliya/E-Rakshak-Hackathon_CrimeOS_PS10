import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  FileText, 
  Network, 
  Bot, 
  Send, 
  BarChart3, 
  FileCheck2, 
  CheckCircle2, 
  ChevronRight,
  LayoutDashboard,
  ShieldCheck,
  Lock,
  Sparkles
} from 'lucide-react';
import { useCaseStore } from '../../store/caseStore';
import GlobalSummarizerModal from '../common/GlobalSummarizerModal';

const guidedSteps = [
  { step: 1, id: 'intake', title: 'Complaint Intake', path: '/intake', icon: FileText, subtitle: 'Multimodal Parsing' },
  { step: 2, id: 'linkage', title: 'Serial Link Analysis', path: '/linkage', icon: Network, subtitle: 'Entity Cross-Match' },
  { step: 3, id: 'investigation', title: 'Investigation Studio', path: '/investigation', icon: Bot, subtitle: 'Multi-Agent SOP' },
  { step: 4, id: 'subpoenas', title: 'Subpoenas & Notices', path: '/subpoenas', icon: Send, subtitle: 'Section 94 BNSS' },
  { step: 5, id: 'analytics', title: 'Response Analysis', path: '/analytics', icon: BarChart3, subtitle: 'CDR & Bank Logs' },
];

export default function TacticalStepperHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeCase, completedStepByCase } = useCaseStore();
  const [globalSumOpen, setGlobalSumOpen] = useState(false);

  const currentPath = location.pathname;
  const currentStepIndex = guidedSteps.findIndex(s => s.path === currentPath);

  const caseNo = activeCase?.case_number;
  const completedStep = caseNo ? (completedStepByCase[caseNo] ?? activeCase?.completed_step ?? 0) : 0;

  return (
    <div className="w-full bg-white dark:bg-[#080d1a] border-b border-slate-200 dark:border-white/10 px-3 py-1.5 flex items-center justify-between shrink-0 select-none overflow-x-auto shadow-sm">
      
      {/* Dashboard Shortcut Button */}
      <button
        onClick={() => navigate('/')}
        className={`flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-semibold transition-colors shrink-0 ${
          currentPath === '/'
            ? 'border-[#0A2540] dark:border-blue-500 bg-[#0A2540] dark:bg-blue-600/30 text-white font-bold'
            : 'border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-[#0d1322] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
        }`}
        title="Command Dashboard"
      >
        <LayoutDashboard className="h-3.5 w-3.5" />
        <span className="hidden sm:inline text-[11px]">Dashboard</span>
      </button>

      <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-2 shrink-0" />

      {/* Guided Horizontal Stepper Pipeline */}
      <div className="flex-1 flex items-center justify-between gap-1 max-w-5xl mx-auto min-w-max">
        {guidedSteps.map((item, idx) => {
          const isActive = currentPath === item.path;
          const stepNum = item.step;
          const completed = stepNum <= completedStep;
          const unlocked = stepNum <= (completedStep + 1);
          const isLocked = !unlocked;

          return (
            <React.Fragment key={item.id}>
              {/* Step Pill */}
              <button
                disabled={isLocked}
                onClick={() => !isLocked && navigate(item.path)}
                className={`group relative flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition-all ${
                  isActive
                    ? 'border-[#0A2540] dark:border-blue-500 bg-[#0A2540] dark:bg-blue-600/20 text-white ring-2 ring-amber-500/50 shadow-md scale-[1.02]'
                    : completed
                    ? 'border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-500/20'
                    : unlocked
                    ? 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0d1322] text-slate-700 dark:text-slate-300 hover:border-amber-500 hover:text-slate-900'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-[#050811] text-slate-400 dark:text-slate-600 opacity-60 cursor-not-allowed'
                }`}
                title={isLocked ? `Complete Step ${stepNum - 1} first` : item.title}
              >
                {/* Step Badge / Number */}
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold font-mono transition-colors ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 font-black'
                      : completed
                      ? 'bg-emerald-600 text-white'
                      : unlocked
                      ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600'
                  }`}
                >
                  {completed && !isActive ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : isLocked ? (
                    <Lock className="h-3 w-3 text-slate-400" />
                  ) : (
                    item.step
                  )}
                </span>

                {/* Step Label */}
                <div className="flex flex-col items-start text-left">
                  <span className={`text-[11px] font-bold leading-tight ${isActive ? 'text-white' : completed ? 'text-emerald-950 dark:text-emerald-300' : unlocked ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 dark:text-slate-600'}`}>
                    {item.title}
                  </span>
                  <span className={`text-[9px] font-mono leading-tight ${isActive ? 'text-amber-300' : completed ? 'text-emerald-700 dark:text-emerald-400' : unlocked ? 'text-slate-500 dark:text-slate-400' : 'text-slate-400 dark:text-slate-600'}`}>
                    {item.subtitle}
                  </span>
                </div>
              </button>

              {/* Connecting Connector Arrow between steps */}
              {idx < guidedSteps.length - 1 && (
                <div className="flex items-center text-slate-400 dark:text-slate-600 px-0.5 shrink-0">
                  <ChevronRight className={`h-4 w-4 ${idx < currentStepIndex ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-300 dark:text-slate-700'}`} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-2 shrink-0" />

      {/* Admin & Global Summarizer Shortcut Buttons */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => setGlobalSumOpen(true)}
          className="flex items-center gap-1.5 rounded border border-amber-600 bg-amber-500 px-2.5 py-1 text-xs font-bold text-slate-950 hover:bg-amber-600 hover:text-white transition-all shadow-sm"
          title="Synthesize Master AI Executive Briefing across all completed modules"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span className="hidden md:inline font-mono">Summarize All Modules</span>
          <span className="md:hidden font-mono">Summary</span>
        </button>

        <button
          onClick={() => navigate('/admin')}
          className={`flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-semibold transition-colors ${
            currentPath === '/admin'
              ? 'border-indigo-600 bg-indigo-600 text-white font-bold'
              : 'border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-[#0d1322] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
          title="Admin & Audit Trail"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          <span className="hidden sm:inline text-[11px]">Audit</span>
        </button>
      </div>

      <GlobalSummarizerModal isOpen={globalSumOpen} onClose={() => setGlobalSumOpen(false)} />
    </div>
  );
}

