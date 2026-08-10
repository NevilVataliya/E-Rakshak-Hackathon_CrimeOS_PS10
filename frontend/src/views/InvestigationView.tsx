import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  FileText,
  Gavel,
  ShieldCheck,
  Download,
  ChevronDown,
  ChevronUp,
  Loader2,
  ArrowRight,
  BookOpen,
  AlertTriangle,
  MapPin,
  Play
} from 'lucide-react';
import PDFPreviewModal from '../components/common/PDFPreviewModal';
import ModuleSummarizerModal from '../components/common/ModuleSummarizerModal';
import { useCaseStore } from '../store/caseStore';
import { GroundedSOPStep } from '../types';

export default function InvestigationView() {
  const navigate = useNavigate();
  const { activeCase, runInvestigationStudio, investigationData, loading, error, setSelectedInspectorItem } = useCaseStore();
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [expandedStep, setExpandedStep] = useState<number | null>(0);
  const [summarizerOpen, setSummarizerOpen] = useState(false);

  const handleRunAgentStudio = () => {
    if (activeCase) {
      runInvestigationStudio(
        activeCase.case_number,
        activeCase.complaint_text,
        activeCase.crime_category,
        activeCase.crime_sub_type,
        activeCase.entities
      );
    }
  };

  const steps = investigationData?.investigation_steps || [];

  return (
    <div className="flex-1 flex flex-col p-4 overflow-hidden gap-3 select-none">

      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
        <div>
          <h1 className="text-base font-extrabold tracking-wide text-white uppercase font-mono flex items-center gap-2">
            AI Investigation & SOP Analysis
          </h1>
          <p className="text-xs text-slate-400">
            AI-powered analysis across legal frameworks with verified citations from official manuals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSummarizerOpen(true)}
            className="flex items-center gap-1.5 rounded border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-xs font-bold text-cyan-300 hover:bg-blue-500/20 transition-colors shadow-sm"
          >
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            <span>AI Module Summary</span>
          </button>

          <button
            onClick={handleRunAgentStudio}
            disabled={loading}
            className="flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors disabled:opacity-50 shadow-sm"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            <span>{steps.length > 0 ? 'Re-Generate Investigation Path' : 'Generate Investigation Path'}</span>
          </button>

          <button
            onClick={() => navigate('/subpoenas')}
            className="flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
          >
            <span>Proceed to Subpoenas & Notices</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Error Alert Banner */}
      {error && (
        <div className="rounded border border-rose-500/50 bg-rose-500/10 p-3 flex items-start gap-3 shrink-0">
          <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-xs font-bold text-rose-300 uppercase tracking-wider">Investigation Analysis Failed</h3>
            <p className="text-xs text-rose-200 font-mono mt-1 leading-relaxed">{error}</p>
            <p className="text-[11px] text-slate-400 mt-1.5">
              Please check your connection and try again. Contact the system administrator if the issue persists.
            </p>
          </div>
        </div>
      )}

      {/* Main Grid: Directives Matrix & Penal Grounding */}
      <div className="flex-1 grid grid-cols-12 gap-3 overflow-hidden">

        {/* Left Column: SOP Directives Execution Matrix (7 Cols) */}
        <div className="col-span-7 rounded border border-white/10 bg-[#0d1322] p-3 flex flex-col overflow-hidden space-y-2.5">
          <div className="flex items-center justify-between border-b border-white/10 pb-2 shrink-0">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-blue-400" />
              SOP Investigation Directives
            </span>
            <span className="text-[10px] font-mono text-emerald-400 font-bold">
              {steps.length > 0 ? `${steps.length} Steps Compiled` : 'Ready to Run'}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full space-y-3 py-12">
                <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
                <p className="text-xs text-slate-300 font-semibold">Running Multi-Agent Legal & SOP Analysis...</p>
                <p className="text-[11px] text-slate-500">Cross-referencing BNS, BSA 2023, and I4C Cyber SOP manuals</p>
              </div>
            ) : steps.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full space-y-3 py-12 text-center px-4">
                <Play className="h-10 w-10 text-blue-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Ready to Generate Investigation Path</h3>
                <p className="text-[11px] text-slate-400 max-w-md leading-relaxed">
                  Click "Generate Investigation Path" above to trigger multi-agent analysis for case <code className="text-cyan-300">{activeCase?.case_number}</code>.
                </p>
                <button
                  onClick={handleRunAgentStudio}
                  className="flex items-center gap-1.5 rounded bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500 transition-colors shadow-md mt-2"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Start Generating Investigation Path</span>
                </button>
              </div>
            ) : (
              steps.map((step: GroundedSOPStep, idx: number) => {
                const isOpen = expandedStep === idx;
                const citationText = step.section_path || step.sop_reference || step.document_name || 'BNS / SOP Grounded';

                return (
                  <div
                    key={idx}
                    className="rounded border border-white/10 bg-[#050811] overflow-hidden transition-all hover:border-white/20"
                  >
                    <button
                      onClick={() => {
                        setExpandedStep(isOpen ? null : idx);
                        setSelectedInspectorItem({ type: 'SOP_CITATION_INSPECTOR', data: step });
                      }}
                      className="w-full flex items-center justify-between p-2.5 text-left hover:bg-slate-900/60 transition-colors gap-2"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="flex h-5 w-5 items-center justify-center rounded bg-blue-600/20 text-xs font-bold text-blue-400 font-mono shrink-0">
                          {step.step_number}
                        </span>
                        <h3 className="text-xs font-semibold text-white truncate">{step.title}</h3>
                      </div>

                      {/* Always Visible Citation Badge on Left Panel Step Header */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-300">
                          <BookOpen className="h-2.5 w-2.5 text-emerald-400" />
                          <span className="max-w-[140px] truncate">{citationText}</span>
                        </span>
                        {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-3 pb-3 pt-1 border-t border-white/10 space-y-2.5 text-xs">
                        <p className="text-slate-300 leading-relaxed font-sans">{step.description}</p>

                        <div className="rounded border border-white/10 bg-[#0d1322] p-2.5 space-y-1.5">
                          <div className="flex items-center justify-between font-mono font-bold text-blue-400 text-[11px]">
                            <span className="flex items-center gap-1.5">
                              <BookOpen className="h-3.5 w-3.5 text-blue-400" />
                              {step.document_name || 'I4C / BNS Legal Manual'}
                            </span>
                            {step.page_number && <span className="bg-white/5 px-1.5 py-0.5 rounded text-[10px] text-slate-300">Page {step.page_number}</span>}
                          </div>

                          <div className="flex items-start gap-1.5 pt-1">
                            <MapPin className="h-3 w-3 text-indigo-400 shrink-0 mt-0.5" />
                            <p className="text-[10px] text-indigo-300 font-mono">
                              Section Path: {step.section_path || step.sop_reference || 'BNS & BNSS Grounded Procedure'}
                            </p>
                          </div>

                          {step.raw_citation_text && (
                            <p className="text-[11px] text-slate-200 italic pt-1 border-t border-white/5 font-serif">
                              "{step.raw_citation_text}"
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Statutory Penal Grounding & Turnkey PDF (5 Cols) */}
        <div className="col-span-5 flex flex-col gap-3 overflow-hidden">

          {/* Statutory Penal Grounding */}
          <div className="rounded border border-white/10 bg-[#0d1322] p-3 space-y-2 shrink-0">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 border-b border-white/10 pb-1.5 flex items-center gap-1.5">
              <Gavel className="h-4 w-4 text-amber-400" />
              Statutory Penal Grounding
            </span>

            <div className="rounded border border-white/10 bg-[#050811] p-2.5 space-y-1">
              <h3 className="text-xs font-bold text-blue-400 font-mono">
                {activeCase?.sections?.join(' & ') || 'BNS Section 318(4) & IT Act Section 66D'}
              </h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Punishment for cheating by personation using computer resource. Cognizable & Non-Bailable.
              </p>
            </div>

            <div className="rounded border border-white/10 bg-[#050811] p-2.5 space-y-1">
              <h3 className="text-xs font-bold text-emerald-400 font-mono">
                Section 63 Bharatiya Sakshya Adhiniyam (BSA), 2023
              </h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Mandatory electronic evidence certificate required for digital transaction logs and server records.
              </p>
            </div>
          </div>

          {/* Turnkey Notice Box */}
          <div className="rounded border border-white/10 bg-[#0d1322] p-3 flex flex-col justify-between flex-1 space-y-2">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 border-b border-white/10 pb-1.5 flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-emerald-400" />
                Turnkey Statutory Requisition PDF
              </span>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Section 94 BNSS Legal Notice automatically rendered and ready for dispatch.
              </p>
            </div>

            <button
              onClick={() => setPdfModalOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded bg-emerald-600 p-2.5 text-xs font-bold text-white hover:bg-emerald-500 transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>Preview Section 94 BNSS Notice PDF</span>
            </button>
          </div>

        </div>

      </div>

      {/* PDF Preview Modal */}
      <PDFPreviewModal
        open={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        pdfUrl={`/api/requests/download/Notice_Section_94_BNSS_${activeCase?.case_number || 'CR-2026-9910'}.pdf`}
      />

      <ModuleSummarizerModal
        isOpen={summarizerOpen}
        onClose={() => setSummarizerOpen(false)}
        moduleId="MODULE_3"
        moduleTitle="AI Investigation Studio & Multi-Agent Planning"
      />
    </div>
  );
}
