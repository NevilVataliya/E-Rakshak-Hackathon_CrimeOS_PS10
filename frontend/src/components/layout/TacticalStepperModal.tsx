import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCaseStore } from '../../store/caseStore';
import { useLangStore } from '../../store/langStore';
import { 
  X, 
  CheckCircle2, 
  Lock, 
  Play, 
  ArrowRight, 
  FileUp, 
  Share2, 
  Cpu, 
  FileCheck2, 
  BarChart3, 
  BookOpen,
  ShieldCheck
} from 'lucide-react';

interface TacticalStepperModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TacticalStepperModal({ isOpen, onClose }: TacticalStepperModalProps) {
  const navigate = useNavigate();
  const { activeCase, updateCaseStep } = useCaseStore();
  const { t } = useLangStore();

  if (!isOpen) return null;

  const completedSteps = activeCase?.completedSteps || [1];
  const currentStepNumber = activeCase?.currentStep || completedSteps[completedSteps.length - 1] || 1;

  const steps = [
    {
      step: 1,
      id: 'intake',
      path: '/intake',
      title: t('stepper.intake', '01. Complaint Intake & Ingestion'),
      desc: 'Multimodal drag & drop ingestion (Audio/PDF/OCR) in Gujarati, Hindi & English with interactive entity extraction.',
      icon: FileUp
    },
    {
      step: 2,
      id: 'linkage',
      path: '/linkage',
      title: t('stepper.linkage', '02. Cross-Case Linkage Matrix'),
      desc: 'Automated cross-referencing for recurring suspect VPAs, phone numbers, mule accounts, and serial MO matching.',
      icon: Share2
    },
    {
      step: 3,
      id: 'investigation',
      path: '/investigation',
      title: t('stepper.investigation', '03. Agentic AI Strategy Studio'),
      desc: 'Multi-agent LangGraph reasoning with grounded police SOPs, BNS/BNSS/BSA legal section recommendations, and checklist.',
      icon: Cpu
    },
    {
      step: 4,
      id: 'subpoenas',
      path: '/subpoenas',
      title: t('stepper.subpoenas', '04. Statutory Legal Directives'),
      desc: 'Dynamic notice generator for 5 crime domains with auto Nodal directory lookup, HITL approvals, and SMTP tracking.',
      icon: FileCheck2
    },
    {
      step: 5,
      id: 'analytics',
      path: '/analytics',
      title: t('stepper.analytics', '05. Response Analytics & Visualizer'),
      desc: 'Ingest bank ledgers & CDR CSVs with anomaly metric detection (mule splits, nocturnal spikes) and node visualizer graph.',
      icon: BarChart3
    },
    {
      step: 6,
      id: 'casediary',
      path: '/casediary',
      title: t('stepper.casediary', '06. Case Diary & Court Summary'),
      desc: 'Append-only officer audit log, one-click BNSS/BSA legal summary generator, and court report export controls.',
      icon: BookOpen
    }
  ];

  const handleStepClick = (stepObj: typeof steps[0]) => {
    if (!activeCase) {
      if (stepObj.step === 1) {
        navigate('/intake');
        onClose();
      }
      return;
    }

    const isUnlocked = completedSteps.includes(stepObj.step) || 
                      completedSteps.includes(stepObj.step - 1) || 
                      stepObj.step === 1;

    if (isUnlocked) {
      updateCaseStep(activeCase.case_number, stepObj.step);
      navigate(stepObj.path);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="relative w-full max-w-3xl rounded-2xl border border-white/10 bg-[#080d1a] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-[#050811]">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-500/20 border border-blue-400/30 rounded-xl text-blue-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold font-mono text-white tracking-wide uppercase flex items-center gap-2">
                Tactical Investigation Pipeline
                <span className="rounded bg-blue-500/20 border border-blue-400/30 px-2 py-0.5 text-[10px] text-blue-300 font-sans font-bold">
                  Step {currentStepNumber} of 6
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {activeCase 
                  ? `Active Case: ${activeCase.fir_number} (${activeCase.case_number})`
                  : 'Select an active case or register a new complaint to launch pipeline.'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Steps List */}
        <div className="p-6 overflow-y-auto space-y-3.5 flex-1">
          {steps.map((s) => {
            const Icon = s.icon;
            const isCompleted = completedSteps.includes(s.step);
            const isActive = currentStepNumber === s.step;
            const isUnlocked = !activeCase ? s.step === 1 : (isCompleted || completedSteps.includes(s.step - 1) || s.step === 1);

            return (
              <div
                key={s.step}
                onClick={() => handleStepClick(s)}
                className={`p-4 rounded-xl border transition-all flex items-center justify-between gap-4 cursor-pointer ${
                  isActive
                    ? 'bg-blue-950/40 border-blue-500/60 shadow-lg glow-blue'
                    : isCompleted
                    ? 'bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-500/50'
                    : isUnlocked
                    ? 'bg-[#0d1322] border-white/10 hover:border-blue-500/40'
                    : 'bg-[#050811]/60 border-white/5 opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="flex items-start space-x-3.5">
                  <div className={`mt-0.5 p-2.5 rounded-xl border shrink-0 ${
                    isActive
                      ? 'bg-blue-500 text-black border-blue-400'
                      : isCompleted
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : isUnlocked
                      ? 'bg-slate-800 text-slate-300 border-slate-700'
                      : 'bg-slate-900 text-slate-600 border-slate-800'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>

                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className={`text-sm font-bold ${isActive ? 'text-blue-300 font-mono' : isCompleted ? 'text-emerald-300 font-mono' : 'text-slate-200'}`}>
                        {s.title}
                      </h3>

                      {isCompleted && (
                        <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded">
                          <CheckCircle2 className="w-3 h-3" /> Completed
                        </span>
                      )}

                      {isActive && (
                        <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-blue-300 bg-blue-950/60 border border-blue-800 px-2 py-0.5 rounded animate-pulse">
                          Active Step
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {s.desc}
                    </p>
                  </div>
                </div>

                <div className="shrink-0">
                  {isUnlocked ? (
                    <button className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                      isActive
                        ? 'bg-blue-500 text-black hover:bg-blue-400'
                        : isCompleted
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                        : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                    }`}>
                      <span>Navigate</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <div className="p-2 text-slate-600">
                      <Lock className="w-4 h-4" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 p-4 bg-[#050811] flex items-center justify-between">
          <span className="text-xs text-slate-400 font-mono">
            {activeCase ? `FIR: ${activeCase.fir_number}` : 'No active case selected'}
          </span>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-white/10 bg-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-colors"
          >
            Close Window
          </button>
        </div>

      </div>
    </div>
  );
}
