import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  FileText,
  Network,
  Bot,
  Send,
  BarChart3,
  FileCheck2,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  MapPin,
  User,
  Lock
} from 'lucide-react';
import { PoliceCase } from '../../types';
import { useCaseStore } from '../../store/caseStore';

interface CasePipelineModalProps {
  open: boolean;
  onClose: () => void;
  policeCase: PoliceCase | null;
}

const pipelineSteps = [
  { step: 1, id: 'intake', title: 'Complaint Intake', path: '/intake', icon: FileText, subtitle: 'Multimodal Parsing & Entity Extraction', desc: 'Ingest raw complaints in Gujarati, Hindi, or English. Process PDFs, Word docs, images & voice recordings.' },
  { step: 2, id: 'linkage', title: 'Serial Offender Linkage Analysis', path: '/linkage', icon: Network, subtitle: 'Entity Cross-Match Graph', desc: 'Cross-match phone numbers, VPAs, and bank accounts across historical police station records.' },
  { step: 3, id: 'investigation', title: 'AI Investigation Studio', path: '/investigation', icon: Bot, subtitle: 'Multi-Agent Legal SOP Directives', desc: 'AI agent reasoning across BNS, BSA 2023, and I4C Cyber SOP manuals with verified citations.' },
  { step: 4, id: 'subpoenas', title: 'Subpoenas & Notices Generator', path: '/subpoenas', icon: Send, subtitle: 'Section 94 BNSS Legal Requisitions', desc: 'Generate and dispatch Section 94 BNSS notices & 1930 bank account freeze requisitions.' },
  { step: 5, id: 'analytics', title: 'Response Analysis & Parsing', path: '/analytics', icon: BarChart3, subtitle: 'Telecom CDR & Bank Statement Parsing', desc: 'Upload ISP/Telecom tower logs and bank statements for automated timeline alignment.' }
];

export default function CasePipelineModal({ open, onClose, policeCase }: CasePipelineModalProps) {
  const navigate = useNavigate();
  const { setActiveCase, completedStepByCase } = useCaseStore();

  if (!open || !policeCase) return null;

  const caseNo = policeCase.case_number;
  const storeState = useCaseStore.getState();
  const invMap = storeState.investigationsByCase || {};
  const dirMap = storeState.dispatchedDirectivesByCase || {};
  const anaMap = storeState.responseAnalyticsByCase || {};

  const hasInv = Boolean(invMap[caseNo] || policeCase.investigation_data);
  const hasDir = (dirMap[caseNo] || policeCase.dispatched_directives || []).length > 0;
  const hasAna = Boolean(anaMap[caseNo] || policeCase.response_analytics);

  const maxCompletedStep = Math.max(
    completedStepByCase[caseNo] ?? 0,
    policeCase.completed_step ?? 1,
    hasInv ? 3 : 1,
    hasDir ? 4 : 1,
    hasAna ? 5 : 1
  );

  const handleNavigateToStep = (path: string) => {
    setActiveCase(policeCase);
    onClose();
    navigate(path);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 dark:bg-black/80 backdrop-blur-sm p-4 overflow-y-auto select-none">
      <div className="relative w-full max-w-3xl rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#0d1322] text-slate-900 dark:text-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 p-4 bg-[#0A2540] dark:bg-[#080d1a] text-white shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-amber-300 bg-amber-500/20 border border-amber-400/40 px-2 py-0.5 rounded">
                {policeCase.case_number}
              </span>
              <span className="text-xs font-mono text-slate-300">
                {policeCase.fir_number}
              </span>
              <span className="rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold font-mono">
                {policeCase.crime_category}
              </span>
            </div>
            <h2 className="text-sm font-bold text-white uppercase font-mono">
              Investigation Pipeline Steps
            </h2>
            <div className="flex items-center gap-4 text-[11px] text-slate-300 font-sans">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3 text-slate-500" /> {policeCase.assigned_io}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3 text-slate-500" /> {policeCase.police_station}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Content - Pipeline Steps List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <p className="text-xs text-slate-400 mb-2">
            Select an investigation pipeline step below for case <code className="text-blue-300 font-mono">{policeCase.case_number}</code>. Steps must be completed sequentially:
          </p>

          <div className="space-y-2.5">
            {pipelineSteps.map((item) => {
              const Icon = item.icon;
              const stepNum = item.step;
              const isCompleted = stepNum <= maxCompletedStep;
              const isUnlocked = stepNum <= (maxCompletedStep + 1);
              const isLocked = !isUnlocked;

              return (
                <div
                  key={item.id}
                  className={`rounded-xl border p-3 flex items-center justify-between transition-all ${
                    isCompleted
                      ? 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50'
                      : isUnlocked
                      ? 'border-blue-500/40 bg-blue-500/10 hover:border-blue-400'
                      : 'border-white/5 bg-[#050811] opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0 pr-3">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold font-mono shrink-0 ${
                        isCompleted
                          ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40'
                          : isUnlocked
                          ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40'
                          : 'bg-slate-800/80 text-slate-500 border border-white/10'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : isLocked ? (
                        <Lock className="h-3.5 w-3.5 text-slate-500" />
                      ) : (
                        item.step
                      )}
                    </span>

                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 shrink-0 ${isLocked ? 'text-slate-500' : 'text-blue-400'}`} />
                        <h3 className={`text-xs font-bold truncate ${isLocked ? 'text-slate-400' : 'text-white'}`}>
                          {item.title}
                        </h3>

                        {isCompleted ? (
                          <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.2 rounded shrink-0">
                            Completed
                          </span>
                        ) : isUnlocked ? (
                          <span className="text-[9px] font-mono font-bold text-blue-400 bg-blue-500/10 border border-blue-500/30 px-1.5 py-0.2 rounded shrink-0">
                            Unlocked & Ready
                          </span>
                        ) : (
                          <span className="text-[9px] font-mono font-bold text-slate-400 bg-slate-800/80 border border-white/10 px-1.5 py-0.2 rounded shrink-0 flex items-center gap-1">
                            <Lock className="h-2.5 w-2.5 text-slate-500" /> Locked (Complete Step {stepNum - 1} First)
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-300 font-mono truncate">
                        {item.subtitle}
                      </p>
                      <p className="text-[10px] text-slate-400 leading-normal">
                        {item.desc}
                      </p>
                    </div>
                  </div>

                  {isLocked ? (
                    <button
                      disabled
                      className="flex items-center gap-1.5 rounded-lg bg-slate-800/80 border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-500 cursor-not-allowed opacity-60 shrink-0"
                    >
                      <Lock className="h-3.5 w-3.5 text-slate-500" />
                      <span>Locked</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleNavigateToStep(item.path)}
                      className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-500 transition-colors shadow-sm shrink-0"
                    >
                      <span>{isCompleted ? `Open Step ${item.step}` : `Launch Step ${item.step}`}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="border-t border-slate-200 dark:border-white/10 p-3 bg-slate-100 dark:bg-[#080d1a] flex items-center justify-between shrink-0 text-xs text-slate-600 dark:text-slate-400">
          <span className="flex items-center gap-1.5 text-[11px]">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            All steps automatically record evidence into judicial Form 50 register.
          </span>
          <button
            onClick={onClose}
            className="rounded border border-slate-300 dark:border-white/10 bg-white dark:bg-[#0d1322] px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors shadow-sm"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}

