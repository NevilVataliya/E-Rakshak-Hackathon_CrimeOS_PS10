import React, { useState } from 'react';
import { Sparkles, FileText, CheckCircle2, AlertCircle, RefreshCw, X, Shield } from 'lucide-react';
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
  const caseNo = activeCase?.case_number || 'CR-2026-9914';
  const currentSummary = moduleSummariesByCase[caseNo]?.[moduleId];

  const handleGenerate = () => {
    generateModuleSummary(caseNo, moduleId);
  };

  React.useEffect(() => {
    if (isOpen && !currentSummary) {
      handleGenerate();
    }
  }, [isOpen, caseNo, moduleId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl rounded-2xl border border-blue-500/30 bg-[#0b1222] shadow-2xl overflow-hidden flex flex-col text-slate-100 max-h-[85vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-[#080d1a] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Sparkles className="h-5 w-5 text-cyan-400 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>{moduleTitle}</span>
                <span className="rounded bg-blue-500/10 px-2 py-0.5 text-xs font-mono text-cyan-300 border border-blue-500/20">
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
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          {summarizerLoading && !currentSummary ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <RefreshCw className="h-8 w-8 text-blue-400 animate-spin" />
              <p className="text-sm font-semibold text-slate-300">Synthesizing Module Intelligence Brief...</p>
              <p className="text-xs text-slate-500 font-mono">Dense multi-agent extraction in progress</p>
            </div>
          ) : currentSummary ? (
            <>
              {/* Executive Paragraph Brief */}
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400 font-mono">
                  <Shield className="h-4 w-4" />
                  <span>Executive Module Briefing</span>
                </div>
                <p className="text-slate-200 leading-relaxed font-medium">
                  {currentSummary.concise_brief || currentSummary.summary}
                </p>
              </div>

              {/* Key Facts Discovered */}
              {currentSummary.key_facts && currentSummary.key_facts.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Key Extracted Facts
                  </h4>
                  <ul className="space-y-1.5 bg-[#050811] p-3.5 rounded-xl border border-white/5">
                    {currentSummary.key_facts.map((fact: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2 text-slate-300 text-xs">
                        <span className="text-blue-400 font-bold">•</span>
                        <span>{fact}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Operational Actions Executed */}
              {currentSummary.actions_taken && currentSummary.actions_taken.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-2">
                    <FileText className="h-4 w-4 text-cyan-400" /> Actions & Directives Issued
                  </h4>
                  <ul className="space-y-1.5 bg-[#050811] p-3.5 rounded-xl border border-white/5">
                    {currentSummary.actions_taken.map((action: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2 text-slate-300 text-xs">
                        <span className="text-cyan-400 font-bold">✓</span>
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Unresolved Gaps / Next Step */}
              {currentSummary.unresolved_gaps && currentSummary.unresolved_gaps.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-400 font-mono flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-400" /> Pending Action & Gaps
                  </h4>
                  <div className="bg-amber-500/5 p-3.5 rounded-xl border border-amber-500/20 text-xs text-amber-200">
                    {currentSummary.unresolved_gaps.join(' • ')}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-slate-400">
              Click regenerate to create a new module summary.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/10 bg-[#080d1a] px-6 py-3.5">
          <span className="text-[11px] text-slate-400 font-mono">
            Zero-Token Loss Architecture • CrimeOS Summarizer Engine
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerate}
              disabled={summarizerLoading}
              className="flex items-center gap-2 rounded-lg bg-blue-600/20 border border-blue-500/40 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-blue-600/30 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${summarizerLoading ? 'animate-spin' : ''}`} />
              <span>Regenerate Summary</span>
            </button>
            <button
              onClick={onClose}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
