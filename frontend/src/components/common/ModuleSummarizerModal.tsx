import React, { useState } from 'react';
import { Sparkles, FileText, CheckCircle2, AlertCircle, RefreshCw, X, Shield, Check } from 'lucide-react';
import { useCaseStore } from '../../store/caseStore';

interface ModuleSummarizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  moduleId: string;
  moduleTitle: string;
}

export default function ModuleSummarizerModal({
  isOpen,
  onClose,
  moduleId,
  moduleTitle
}: ModuleSummarizerModalProps) {
  const { activeCase, moduleSummariesByCase, generateModuleSummary, summarizerLoading } = useCaseStore();
  const caseNo = activeCase?.case_number || '';
  const currentSummary = caseNo ? moduleSummariesByCase[caseNo]?.[moduleId] : null;

  const handleGenerate = () => {
    if (caseNo) {
      generateModuleSummary(caseNo, moduleId);
    }
  };

  React.useEffect(() => {
    if (isOpen && !currentSummary) {
      handleGenerate();
    }
  }, [isOpen, caseNo, moduleId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 dark:bg-black/75 p-4 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-300 dark:border-blue-500/30 bg-white dark:bg-[#0b1222] shadow-2xl overflow-hidden flex flex-col text-slate-900 dark:text-slate-100 max-h-[85vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 bg-[#0A2540] px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-slate-950 font-bold">
              <Sparkles className="h-5 w-5 text-slate-950" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>{moduleTitle}</span>
                <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-mono text-amber-300 border border-amber-400/30">
                  {moduleId}
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-mono">Case: {caseNo} • Executive AI Summary</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm bg-white dark:bg-[#0b1222]">
          {summarizerLoading && !currentSummary ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <RefreshCw className="h-8 w-8 text-blue-600 dark:text-blue-400 animate-spin" />
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-300">Synthesizing Module Intelligence Brief...</p>
              <p className="text-xs text-slate-500 font-mono">Dense multi-agent extraction in progress</p>
            </div>
          ) : currentSummary ? (
            <>
              {/* Executive Paragraph Brief */}
              <div className="rounded-xl border border-blue-200 dark:border-blue-500/20 bg-blue-50 dark:bg-blue-500/5 p-4 space-y-2 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-800 dark:text-cyan-400 font-mono">
                  <Shield className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                  <span>Executive Module Briefing</span>
                </div>
                <p className="text-slate-900 dark:text-slate-200 leading-relaxed font-medium">
                  {currentSummary.concise_brief || currentSummary.summary}
                </p>
              </div>

              {/* Key Facts Discovered */}
              {currentSummary.key_facts && currentSummary.key_facts.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-400 font-mono flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Key Extracted Facts
                  </h4>
                  <ul className="space-y-1.5 bg-slate-50 dark:bg-[#050811] p-3.5 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm">
                    {currentSummary.key_facts.map((fact: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2 text-slate-800 dark:text-slate-300 text-xs">
                        <span className="text-blue-600 dark:text-blue-400 font-bold">•</span>
                        <span>{fact}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Operational Actions Executed */}
              {currentSummary.actions_taken && currentSummary.actions_taken.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-400 font-mono flex items-center gap-2">
                    <FileText className="h-4 w-4 text-cyan-600 dark:text-cyan-400" /> Actions & Directives Issued
                  </h4>
                  <ul className="space-y-1.5 bg-slate-50 dark:bg-[#050811] p-3.5 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm">
                    {currentSummary.actions_taken.map((action: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2 text-slate-800 dark:text-slate-300 text-xs">
                        <Check className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Unresolved Gaps / Next Step */}
              {currentSummary.unresolved_gaps && currentSummary.unresolved_gaps.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-400 font-mono flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" /> Pending Action & Gaps
                  </h4>
                  <div className="bg-amber-50 dark:bg-amber-500/5 p-3.5 rounded-xl border border-amber-300 dark:border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 shadow-sm">
                    {currentSummary.unresolved_gaps.join(' • ')}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-slate-600 dark:text-slate-400">
              Click regenerate to create a new module summary.
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-[#080d1a] px-6 py-3.5">
          <span className="text-[11px] text-slate-600 dark:text-slate-400 font-mono flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-amber-500" />
            <span>AI Synthesized via Groq llama-3.1-8b-instant • Rate-Limited Engine</span>
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerate}
              disabled={summarizerLoading}
              className="flex items-center gap-2 rounded-lg bg-blue-50 dark:bg-blue-600/20 border border-blue-300 dark:border-blue-500/40 px-3 py-1.5 text-xs font-semibold text-blue-900 dark:text-cyan-300 hover:bg-blue-100 dark:hover:bg-blue-600/30 transition-colors disabled:opacity-50 shadow-sm"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${summarizerLoading ? 'animate-spin' : ''}`} />
              <span>Regenerate Summary</span>
            </button>
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors shadow-sm"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
