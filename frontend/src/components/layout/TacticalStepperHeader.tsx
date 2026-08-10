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
  { step: 6, id: 'diary', title: 'Court Case Diary', path: '/case-diary', icon: FileCheck2, subtitle: 'Judicial Register' },
];

export default function TacticalStepperHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeCase, completedStepByCase } = useCaseStore();
  const [globalSumOpen, setGlobalSumOpen] = useState(false);

  const currentPath = location.pathname;
  const currentStepIndex = guidedSteps.findIndex(s => s.path === currentPath);

  const caseNo = activeCase?.case_number;
  const completedStep = caseNo ? (completedStepByCase[caseNo] ?? activeCase?.completed_step ?? 1) : 1;

  return (
    <div className="w-full bg-[#080d1a] border-b border-white/10 px-3 py-1.5 flex items-center justify-between shrink-0 select-none overflow-x-auto">
      
      {/* Dashboard Shortcut Button */}
      <button
        onClick={() => navigate('/')}
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors shrink-0 ${
          currentPath === '/'
            ? 'border-blue-500/50 bg-blue-500/10 text-blue-400 font-bold'
            : 'border-white/10 bg-[#0d1322] text-slate-400 hover:text-white hover:border-white/20'
        }`}
        title="Command Dashboard"
      >
        <LayoutDashboard className="h-3.5 w-3.5 text-blue-400" />
        <span className="hidden sm:inline text-[11px]">Dashboard</span>
      </button>

      <div className="h-4 w-px bg-white/10 mx-2 shrink-0" />

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
                className={`group relative flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs transition-all ${
                  isActive
                    ? 'border-blue-500 bg-blue-500/15 text-white ring-1 ring-blue-500/40 shadow-md scale-[1.02]'
                    : completed
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20'
                    : unlocked
                    ? 'border-blue-500/30 bg-blue-500/10 text-blue-300 hover:border-blue-400'
                    : 'border-white/5 bg-[#050811] text-slate-500 opacity-50 cursor-not-allowed'
                }`}
                title={isLocked ? `Complete Step ${stepNum - 1} first` : item.title}
              >
                {/* Step Badge / Number */}
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold font-mono transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : completed
                      ? 'bg-emerald-600 text-white'
                      : unlocked
                      ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                      : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {completed && !isActive ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : isLocked ? (
                    <Lock className="h-3 w-3 text-slate-500" />
                  ) : (
                    item.step
                  )}
                </span>

                {/* Step Label */}
                <div className="flex flex-col items-start text-left">
                  <span className={`text-[11px] font-bold leading-tight ${isActive ? 'text-white' : completed ? 'text-emerald-300' : unlocked ? 'text-slate-200' : 'text-slate-500'}`}>
                    {item.title}
                  </span>
                  <span className={`text-[9px] font-mono leading-tight ${isActive ? 'text-blue-300' : completed ? 'text-emerald-400/80' : unlocked ? 'text-blue-400/80' : 'text-slate-600'}`}>
                    {item.subtitle}
                  </span>
                </div>

                {/* Active Indicator Pulse */}
                {isActive && (
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
                  </span>
                )}
              </button>

              {/* Connecting Connector Arrow between steps */}
              {idx < guidedSteps.length - 1 && (
                <div className="flex items-center text-slate-600 px-0.5 shrink-0">
                  <ChevronRight className={`h-4 w-4 ${idx < currentStepIndex ? 'text-emerald-500/60' : 'text-slate-700'}`} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      <div className="h-4 w-px bg-white/10 mx-2 shrink-0" />

      {/* Admin & Global Summarizer Shortcut Buttons */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => setGlobalSumOpen(true)}
          className="flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-gradient-to-r from-blue-600/30 to-cyan-600/30 px-2.5 py-1 text-xs font-extrabold text-cyan-200 hover:brightness-125 transition-all shadow-md shadow-cyan-500/20"
          title="Synthesize Master AI Executive Briefing across all completed modules"
        >
          <Sparkles className="h-3.5 w-3.5 text-cyan-300 animate-pulse" />
          <span className="hidden md:inline font-mono">Summarize All Modules</span>
          <span className="md:hidden font-mono">Summary</span>
        </button>

        <button
          onClick={() => navigate('/admin')}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
            currentPath === '/admin'
              ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-300 font-bold'
              : 'border-white/10 bg-[#0d1322] text-slate-400 hover:text-white hover:border-white/20'
          }`}
          title="Admin & Audit Trail"
        >
          <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
          <span className="hidden sm:inline text-[11px]">Audit</span>
        </button>
      </div>

      <GlobalSummarizerModal isOpen={globalSumOpen} onClose={() => setGlobalSumOpen(false)} />
    </div>
  );
}

