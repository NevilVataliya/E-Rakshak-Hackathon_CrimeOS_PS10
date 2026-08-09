import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FileText,
  Network,
  Bot,
  Send,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  LayoutDashboard,
  Lock
} from 'lucide-react';
import { useCaseStore } from '../../store/caseStore';

export default function TacticalStepperHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeCase, linkageMatches, investigationData, legalRequests } = useCaseStore();

  const guidedSteps = [
    { step: 1, id: 'intake', title: '01. Complaint Intake', path: '/intake', icon: FileText, subtitle: 'Multimodal Ingestion' },
    { step: 2, id: 'linkage', title: '02. Crime Linkage', path: '/linkage', icon: Network, subtitle: 'Cross-FIR Matching' },
    { step: 3, id: 'investigation', title: '03. AI SOP Path', path: '/investigation', icon: Bot, subtitle: 'BNSS Legal Strategy' },
    { step: 4, id: 'subpoenas', title: '04. Legal Directives', path: '/subpoenas', icon: Send, subtitle: 'SMTP/HITL Automator' },
    { step: 5, id: 'analytics', title: '05. Response Analytics', path: '/analytics', icon: BarChart3, subtitle: 'CSV/CDR Visualizer' },
    { step: 6, id: 'case-diary', title: '06. Case Diary & Summary', path: '/case-diary', icon: BookOpen, subtitle: 'Audit Log & Court Export' },
  ];

  if (!activeCase) {
    return null;
  }

  const currentPath = location.pathname;

  // Dynamically check completion status strictly based on case data
  const isStepCompleted = (stepIndex: number) => {
    const stepNum = stepIndex + 1;
    if (activeCase?.completedSteps?.includes(stepNum)) return true;
    if (stepIndex === 0 && activeCase) return true;
    if (stepIndex === 1 && (linkageMatches.length > 0 || activeCase?.completedSteps?.includes(2))) return true;
    if (stepIndex === 2 && ((investigationData?.investigation_steps?.length || 0) > 0 || activeCase?.completedSteps?.includes(3))) return true;
    if (stepIndex === 3 && (legalRequests.length > 0 || activeCase?.completedSteps?.includes(4))) return true;
    if (stepIndex === 4 && activeCase?.completedSteps?.includes(5)) return true;
    if (stepIndex === 5 && activeCase?.completedSteps?.includes(6)) return true;
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
    <div className="w-full bg-[#080d1a] border-b border-slate-800 px-4 py-2 flex items-center justify-between shrink-0 select-none overflow-x-auto">

      {/* Dashboard Shortcut Button */}
      <button
        onClick={() => navigate('/')}
        className={`flex items-center space-x-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all shrink-0 ${
          currentPath === '/'
            ? 'border-cyan-400 bg-cyan-500/15 text-cyan-300 font-bold shadow-md shadow-cyan-500/10'
            : 'border-slate-800 bg-[#0d1322] text-slate-400 hover:text-slate-100 hover:border-slate-700'
        }`}
        title="Command Dashboard"
      >
        <LayoutDashboard className="h-3.5 w-3.5 text-cyan-400" />
        <span className="hidden sm:inline text-[11px] font-mono">DASHBOARD</span>
      </button>

      <div className="h-4 w-px bg-slate-800 mx-2 shrink-0" />

      {/* Guided Horizontal Stepper Pipeline */}
      <div className="flex-1 flex items-center justify-between gap-1.5 max-w-6xl mx-auto min-w-max">
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
                className={`group relative flex items-center space-x-2.5 rounded-xl border px-3 py-1.5 text-xs transition-all ${
                  isActive
                    ? 'border-cyan-400 bg-cyan-950/60 text-white ring-1 ring-cyan-400/40 shadow-lg shadow-cyan-500/10 scale-[1.02]'
                    : completed
                    ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-200 hover:bg-emerald-950/70'
                    : unlocked
                    ? 'border-slate-800 bg-[#050811] text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    : 'border-slate-900 bg-[#050811]/40 text-slate-600 opacity-50 cursor-not-allowed'
                }`}
                title={!unlocked ? `Complete Step ${item.step - 1} first to unlock` : item.title}
              >
                {/* Step Circle Badge / Icon */}
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-extrabold font-mono transition-colors ${
                    isActive
                      ? 'bg-cyan-400 text-black shadow-sm'
                      : completed
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : unlocked
                      ? 'bg-slate-800 text-slate-400 border border-slate-700 group-hover:bg-slate-700'
                      : 'bg-slate-900 text-slate-600 border border-slate-900'
                  }`}
                >
                  {completed && !isActive ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : !unlocked ? (
                    <Lock className="h-3 w-3" />
                  ) : (
                    item.step
                  )}
                </span>

                {/* Step Label */}
                <div className="flex flex-col items-start text-left">
                  <span className={`text-[11px] font-bold leading-tight ${
                    isActive ? 'text-cyan-200' : completed ? 'text-emerald-200' : unlocked ? 'text-slate-300' : 'text-slate-600'
                  }`}>
                    {item.title}
                  </span>
                  <span className={`text-[9px] font-mono leading-tight ${
                    isActive ? 'text-cyan-300 font-semibold' : completed ? 'text-emerald-400/90' : unlocked ? 'text-slate-500' : 'text-slate-700'
                  }`}>
                    {item.subtitle}
                  </span>
                </div>

                {/* Active Pulse Indicator */}
                {isActive && (
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400" />
                  </span>
                )}
              </button>

              {/* Connector Arrow */}
              {idx < guidedSteps.length - 1 && (
                <div className="flex items-center text-slate-700 px-0.5 shrink-0">
                  <ChevronRight className={`h-3.5 w-3.5 transition-colors ${
                    isStepCompleted(idx) ? 'text-emerald-500 font-bold' : 'text-slate-800'
                  }`} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
