import React from 'react';
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
  ShieldCheck
} from 'lucide-react';
import { useCaseStore } from '../../store/caseStore';
import { useLangStore } from '../../store/langStore';

export default function TacticalStepperHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeCase, linkageMatches, investigationData, legalRequests } = useCaseStore();
  const { t } = useLangStore();

  const guidedSteps = [
    { step: 1, id: 'intake', title: 'Multimodal Intake', path: '/intake', icon: FileText, subtitle: 'Parsing & Grounding' },
    { step: 2, id: 'linkage', title: 'Serial Crime Linkage', path: '/linkage', icon: Network, subtitle: 'Topology Graph' },
    { step: 3, id: 'investigation', title: 'Agentic Studio', path: '/investigation', icon: Bot, subtitle: 'Master FIR & BNS' },
    { step: 4, id: 'subpoenas', title: 'Workflow Automator', path: '/subpoenas', icon: Send, subtitle: '🔄 HITL Reply Loop', isLoop: true },
  ];

  if (!activeCase) {
    return null;
  }

  const currentPath = location.pathname;

  // Determine current active step index (0-indexed)
  const currentStepIndex = guidedSteps.findIndex(s => s.path === currentPath);

  // Dynamically check completion status strictly based on case data
  const isStepCompleted = (stepIndex: number) => {
    const stepNum = stepIndex + 1;
    if (activeCase?.completedSteps?.includes(stepNum)) return true;
    if (stepIndex === 0 && activeCase) return true;
    if (stepIndex === 1 && linkageMatches.length > 0) return true;
    if (stepIndex === 2 && (investigationData?.investigation_steps?.length || 0) > 0) return true;
    if (stepIndex === 3 && legalRequests.length > 0) return true;
    return false;
  };

  // Enforce sequential progression lock: step N requires step N-1 to be completed
  const isStepUnlocked = (stepIndex: number) => {
    if (stepIndex === 0) return true;
    const prevCompleted = isStepCompleted(stepIndex - 1);
    const thisCompleted = isStepCompleted(stepIndex);
    return prevCompleted || thisCompleted;
  };

  return (
    <div className="w-full bg-[#080d1a] border-b border-white/10 px-3 py-1.5 flex items-center justify-between shrink-0 select-none overflow-x-auto">

      {/* Dashboard Shortcut Button */}
      <button
        onClick={() => navigate('/')}
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors shrink-0 ${
          currentPath === '/'
            ? 'border-cyan-400 bg-cyan-500/15 text-cyan-300 font-bold shadow-sm'
            : 'border-white/10 bg-[#0d1322] text-slate-400 hover:text-white hover:border-white/20'
        }`}
        title="Command Dashboard"
      >
        <LayoutDashboard className="h-3.5 w-3.5 text-cyan-400" />
        <span className="hidden sm:inline text-[11px]">Command Dashboard</span>
      </button>

      <div className="h-4 w-px bg-white/10 mx-2 shrink-0" />

      {/* Guided Horizontal Stepper Pipeline */}
      <div className="flex-1 flex items-center justify-between gap-1 max-w-5xl mx-auto min-w-max">
        {guidedSteps.map((item, idx) => {
          const isActive = currentPath === item.path;
          const completed = isStepCompleted(idx);
          const unlocked = isStepUnlocked(idx);

          return (
            <React.Fragment key={item.id}>
              {/* Step Pill */}
              <button
                disabled={!unlocked}
                onClick={() => unlocked && navigate(item.path)}
                className={`group relative flex items-center gap-2.5 rounded-xl border px-3 py-1.5 text-xs transition-all ${
                  isActive
                    ? 'border-cyan-400 bg-cyan-500/15 text-white ring-1 ring-cyan-400/40 shadow-lg shadow-cyan-500/10 scale-[1.02]'
                    : completed
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20'
                    : unlocked
                    ? 'border-white/10 bg-[#050811] text-slate-400 hover:border-white/20 hover:text-slate-200'
                    : 'border-white/5 bg-[#050811]/40 text-slate-600 opacity-50 cursor-not-allowed'
                }`}
                title={!unlocked ? `Complete Step ${item.step - 1} first to unlock` : item.title}
              >
                {/* Step Circle Badge / Number */}
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-extrabold font-mono transition-colors ${
                    isActive
                      ? 'bg-cyan-400 text-black shadow-sm'
                      : completed
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : unlocked
                      ? 'bg-slate-800 text-slate-400 border border-white/5 group-hover:bg-slate-700'
                      : 'bg-slate-900 text-slate-600 border border-white/5'
                  }`}
                >
                  {completed && !isActive ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    item.step
                  )}
                </span>

                {/* Step Label */}
                <div className="flex flex-col items-start text-left">
                  <span className={`text-[11px] font-extrabold leading-tight ${
                    isActive ? 'text-white' : completed ? 'text-emerald-200' : unlocked ? 'text-slate-300' : 'text-slate-600'
                  }`}>
                    {item.title}
                  </span>
                  <span className={`text-[9px] font-mono leading-tight ${
                    isActive ? 'text-cyan-300 font-semibold' : completed ? 'text-emerald-400/90' : unlocked ? 'text-slate-500' : 'text-slate-700'
                  }`}>
                    {item.subtitle}
                  </span>
                </div>

                {/* Active Indicator Pulse */}
                {isActive && (
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400" />
                  </span>
                )}
              </button>

              {/* Connecting Connector Arrow between steps */}
              {idx < guidedSteps.length - 1 && (
                <div className="flex items-center text-slate-600 px-0.5 shrink-0">
                  <ChevronRight className={`h-4 w-4 transition-colors ${
                    isStepCompleted(idx) ? 'text-emerald-400 font-bold' : 'text-slate-700'
                  }`} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      <div className="h-4 w-px bg-white/10 mx-2 shrink-0" />

      {/* Admin / Audit Trail Shortcut Button */}
      {/* <button
        onClick={() => navigate('/admin')}
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors shrink-0 ${
          currentPath === '/admin'
            ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-300 font-bold'
            : 'border-white/10 bg-[#0d1322] text-slate-400 hover:text-white hover:border-white/20'
        }`}
        title="Admin & Audit Trail"
      >
        <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
        <span className="hidden sm:inline text-[11px]">{t('stepper.admin', '7. Admin & Audit Logs')}</span>
      </button> */}

    </div>
  );
}
