import React from 'react';
import { Shield, Sparkles, CheckCircle2, Award, ArrowRight, RefreshCw, X, FileText } from 'lucide-react';
import { useCaseStore } from '../../store/caseStore';

interface GlobalSummarizerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GlobalSummarizerModal({ isOpen, onClose }: GlobalSummarizerModalProps) {
  const { activeCase, globalSummaryByCase, generateGlobalSummary, summarizerLoading } = useCaseStore();
  const caseNo = activeCase?.case_number || '';
  const masterSummary = caseNo ? globalSummaryByCase[caseNo] : null;

  const handleGenerateGlobal = () => {
    if (caseNo) {
      generateGlobalSummary(caseNo);
    }
  };

  React.useEffect(() => {
    if (isOpen && !masterSummary) {
      handleGenerateGlobal();
    }
  }, [isOpen, caseNo]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 dark:bg-black/80 p-4 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl rounded-2xl border border-amber-500/40 bg-white dark:bg-[#080d1a] shadow-2xl overflow-hidden flex flex-col text-slate-900 dark:text-slate-100 max-h-[90vh]">
        
        {/* Top Command Banner */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 bg-[#0A2540] px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-slate-950 font-bold shadow-lg">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold tracking-wide text-white flex items-center gap-2">
                <span>Master Case Investigation Briefing</span>
                <span className="rounded-full bg-amber-500/20 border border-amber-400/40 px-3 py-0.5 text-xs font-mono font-bold text-amber-300">
                  GLOBAL SYNTHESIS
                </span>
              </h2>
              <p className="text-xs text-slate-300 font-mono">Case Reference: {caseNo} • Multi-Module Intelligence Aggregation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Main Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm bg-white dark:bg-[#080d1a]">
          {summarizerLoading && !masterSummary ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <RefreshCw className="h-10 w-10 text-cyan-600 dark:text-cyan-400 animate-spin" />
              <p className="text-base font-bold text-slate-900 dark:text-slate-200">Synthesizing Master Investigation Briefing...</p>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-mono">Aggregating summaries from Module 1 through Module 5 via llama-3.1-8b-instant</p>
            </div>
          ) : masterSummary ? (
            <>
              {/* Executive Summary Card */}
              <div className="rounded-2xl border border-cyan-300 dark:border-cyan-500/30 bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-[#0b162c] dark:to-[#070e1c] p-5 shadow-xl space-y-3">
                <div className="flex items-center justify-between border-b border-cyan-200 dark:border-white/10 pb-3">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-cyan-800 dark:text-cyan-400 font-mono flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-cyan-600 dark:text-cyan-400" /> Chief Investigation Briefing
                  </span>
                  <span className="text-xs font-mono text-emerald-800 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-300 dark:border-emerald-500/20 font-bold">
                    Status: {masterSummary.status || 'VERIFIED'}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{masterSummary.master_title}</h3>
                <p className="text-slate-800 dark:text-slate-200 text-sm leading-relaxed font-medium">
                  {masterSummary.executive_brief}
                </p>
              </div>

              {/* Grid Section: Critical Evidence Highlights & Timeline Milestones */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* Critical Evidence Highlights */}
                <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#050811] p-4 space-y-3">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-400 font-mono flex items-center gap-2">
                    <Award className="h-4 w-4 text-amber-600 dark:text-amber-400" /> Key Evidence Findings
                  </h4>
                  <ul className="space-y-2">
                    {(masterSummary.critical_evidence_highlights || []).map((highlight: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2 text-slate-800 dark:text-slate-300 text-xs bg-white dark:bg-white/5 p-2.5 rounded-lg border border-slate-200 dark:border-white/5 shadow-sm">
                        <span className="text-amber-600 dark:text-amber-400 font-bold">•</span>
                        <span>{highlight}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Timeline & Pipeline Milestones */}
                <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#050811] p-4 space-y-3">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-400 font-mono flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Pipeline Milestones Reached
                  </h4>
                  <ul className="space-y-2">
                    {(masterSummary.timeline_milestones || []).map((ms: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2 text-slate-800 dark:text-slate-300 text-xs bg-white dark:bg-white/5 p-2.5 rounded-lg border border-slate-200 dark:border-white/5 shadow-sm">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <span>{ms}</span>
                      </li>
                    ))}
                  </ul>
                </div>

              </div>

              {/* Recommended Next Action */}
              {masterSummary.recommended_next_step && (
                <div className="rounded-xl border border-blue-300 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 p-4 flex items-center justify-between gap-4 shadow-sm">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-cyan-800 dark:text-cyan-400 font-mono uppercase">Recommended Next Directive</span>
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-200">{masterSummary.recommended_next_step}</p>
                  </div>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-slate-600 dark:text-slate-400">
              Click regenerate to synthesize a full multi-module case briefing.
            </div>
          )}
        </div>

        {/* Modal Action Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-[#050811] px-6 py-4">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-600 dark:text-slate-400">
            <FileText className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            <span>Modules Aggregated: {masterSummary?.total_completed_modules || 5} / 5</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerateGlobal}
              disabled={summarizerLoading}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-blue-500/20 hover:brightness-110 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${summarizerLoading ? 'animate-spin' : ''}`} />
              <span>Regenerate Master Briefing</span>
            </button>
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-white/5 px-5 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors shadow-sm"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
