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
    { step: 1, id: 'intake', title: t('stepper.intake', '1. Multimodal Complaint Intake'), path: '/intake', icon: FileText, subtitle: 'Multimodal Parsing' },
    { step: 2, id: 'linkage', title: t('stepper.linkage', '2. Serial Crime Linkage Graph'), path: '/linkage', icon: Network, subtitle: 'Entity Cross-Match' },
    { step: 3, id: 'investigation', title: t('stepper.investigation', '3. Agentic Studio & Master FIR'), path: '/investigation', icon: Bot, subtitle: 'Multi-Agent SOP' },
    { step: 4, id: 'subpoenas', title: t('stepper.subpoenas', '4. Workflow Automator & Subpoenas'), path: '/subpoenas', icon: Send, subtitle: 'Section 94 BNSS' },
    { step: 5, id: 'analytics', title: t('stepper.analytics', '5. CDR / Provider Response Analytics'), path: '/analytics', icon: BarChart3, subtitle: 'CDR & Bank Logs' },
    { step: 6, id: 'diary', title: t('stepper.casediary', '6. Digital Case Diary'), path: '/case-diary', icon: FileCheck2, subtitle: 'Judicial Register' },
  ];

  const currentPath = location.pathname;

  // Determine current active step index (0-indexed)
  const currentStepIndex = guidedSteps.findIndex(s => s.path === currentPath);

  // Dynamically check completion status based on case data
  const isStepCompleted = (stepIndex: number) => {
    if (currentStepIndex > stepIndex) return true;
    if (stepIndex === 0 && activeCase) return true;
    if (stepIndex === 1 && linkageMatches.length > 0) return true;
    if (stepIndex === 2 && (investigationData?.investigation_steps?.length || 0) > 0) return true;
    if (stepIndex === 3 && legalRequests.length > 0) return true;
    return false;
  };

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
        <span className="hidden sm:inline text-[11px]">{t('stepper.dashboard', '0. Intelligence Dashboard')}</span>
      </button>

      <div className="h-4 w-px bg-white/10 mx-2 shrink-0" />

      {/* Guided Horizontal Stepper Pipeline */}
      <div className="flex-1 flex items-center justify-between gap-1 max-w-5xl mx-auto min-w-max">
        {guidedSteps.map((item, idx) => {
          const isActive = currentPath === item.path;
          const completed = isStepCompleted(idx);
          const Icon = item.icon;

          return (
            <React.Fragment key={item.id}>
              {/* Step Pill */}
              <button
                onClick={() => navigate(item.path)}
                className={`group relative flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs transition-all ${
                  isActive
                    ? 'border-blue-500 bg-blue-500/15 text-white ring-1 ring-blue-500/40 shadow-md scale-[1.02]'
                    : completed
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20'
                    : 'border-white/10 bg-[#0d1322] text-slate-400 hover:border-white/20 hover:text-slate-200'
                }`}
              >
                {/* Step Badge / Number */}
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold font-mono transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : completed
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700'
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
                  <span className={`text-[11px] font-bold leading-tight ${isActive ? 'text-white' : completed ? 'text-emerald-300' : 'text-slate-300'}`}>
                    {item.title}
                  </span>
                  <span className={`text-[9px] font-mono leading-tight ${isActive ? 'text-blue-300' : completed ? 'text-emerald-400/80' : 'text-slate-500'}`}>
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

      {/* Admin / Audit Trail Shortcut Button */}
      <button
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
      </button>

    </div>
  );
}
