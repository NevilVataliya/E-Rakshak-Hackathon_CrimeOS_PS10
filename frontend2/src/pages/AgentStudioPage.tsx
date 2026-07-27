import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bot, 
  Sparkles, 
  CheckCircle, 
  FileText, 
  Gavel, 
  ShieldCheck, 
  Download, 
  ChevronDown, 
  ChevronUp, 
  Loader2, 
  ArrowRight,
  BookmarkCheck,
  BookOpen
} from 'lucide-react';
import AgentFlowGraph from '../components/graphs/AgentFlowGraph';
import LinkAnalysisGraph from '../components/graphs/LinkAnalysisGraph';
import PDFPreviewModal from '../components/common/PDFPreviewModal';
import { useCaseStore } from '../store/caseStore';
import { GroundedSOPStep } from '../types';

export default function AgentStudioPage() {
  const navigate = useNavigate();
  const { cases, activeCase, setActiveCase, runInvestigationStudio, investigationData, loading } = useCaseStore();
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [expandedStep, setExpandedStep] = useState<number | null>(0);

  useEffect(() => {
    if (activeCase && !investigationData) {
      runInvestigationStudio(activeCase.case_number, activeCase.complaint_text, activeCase.crime_category, activeCase.crime_sub_type, activeCase.entities);
    }
  }, [activeCase]);

  const handleCaseSelect = (caseNo: string) => {
    const found = cases.find((c) => c.case_number === caseNo);
    if (found) {
      setActiveCase(found);
      runInvestigationStudio(found.case_number, found.complaint_text, found.crime_category, found.crime_sub_type, found.entities);
    }
  };

  const handleRunAgentStudio = () => {
    if (activeCase) {
      runInvestigationStudio(activeCase.case_number, activeCase.complaint_text, activeCase.crime_category, activeCase.crime_sub_type, activeCase.entities);
    }
  };

  return (
    <div className="space-y-5">
      
      {/* Case Header & Selector Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
              Select Active Case
            </label>
            <select
              value={activeCase?.case_number || ''}
              onChange={(e) => handleCaseSelect(e.target.value)}
              className="pro-input rounded-lg px-2.5 py-1.5 text-xs font-semibold text-blue-400 min-w-[200px]"
            >
              {cases.map((c) => (
                <option key={c.case_number} value={c.case_number}>
                  {c.case_number} ({c.crime_category})
                </option>
              ))}
            </select>
          </div>

          <div className="border-l border-slate-800 pl-3">
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              Step 3: Multi-Agent Legal Investigation Studio
            </h1>
            <p className="text-xs text-slate-400">
              FIR: <span className="font-mono text-slate-200 font-semibold">{activeCase?.fir_number || 'FIR-042/2026'}</span> | Assigned IO: <span className="text-slate-200 font-medium">{activeCase?.assigned_io || 'PSI V. K. Patel'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRunAgentStudio}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Executing Agents...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                <span>Re-Run LangGraph Agents</span>
              </>
            )}
          </button>

          <button
            onClick={() => navigate('/subpoenas')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
          >
            <span>Proceed to Step 4</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* LangGraph Pipeline Execution Graph */}
      <AgentFlowGraph activeStep={investigationData ? 6 : 4} status="APPROVED" />

      {/* Serial Link Analysis */}
      <LinkAnalysisGraph matches={investigationData?.cross_case_matches} />

      {/* Main Grid: SOP Directives & Statutory Grounding */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        
        {/* Left Column: Step-by-Step SOP Directives */}
        <div className="pro-card p-5 lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-400" />
              SOP-Grounded Investigation Directives (police_sops_universal)
            </h2>
            <span className="text-[11px] font-mono text-slate-400">
              BM25 + Dense RRF Hybrid Search
            </span>
          </div>

          {investigationData ? (
            <div className="space-y-2.5">
              {investigationData.investigation_steps?.map((step: GroundedSOPStep, idx: number) => {
                const isOpen = expandedStep === idx;
                return (
                  <div 
                    key={idx} 
                    className="rounded-lg border border-slate-800 bg-slate-900/60 overflow-hidden transition-colors hover:border-slate-700"
                  >
                    <button
                      onClick={() => setExpandedStep(isOpen ? null : idx)}
                      className="w-full flex items-center justify-between p-3 text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-6 w-6 items-center justify-center rounded bg-blue-600/20 text-xs font-bold text-blue-400 font-mono">
                          {step.step_number}
                        </span>
                        <h3 className="text-xs font-semibold text-white">{step.title}</h3>
                      </div>
                      {isOpen ? (
                        <ChevronUp className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      )}
                    </button>

                    {isOpen && (
                      <div className="px-3 pb-3 pt-1 border-t border-slate-800 space-y-2.5">
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {step.description}
                        </p>

                        <div className="rounded-md border border-slate-800 bg-slate-950 p-2.5 space-y-1 text-xs">
                          <div className="flex items-center justify-between font-semibold text-blue-400 text-[11px]">
                            <span className="flex items-center gap-1">
                              <BookOpen className="h-3 w-3" /> {step.document_name}
                            </span>
                            <span>Page {step.page_number}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 font-mono">
                            Path: {step.section_path}
                          </p>
                          <p className="text-[11px] text-slate-300 italic pt-1 border-t border-slate-900 font-serif">
                            "{step.raw_citation_text}"
                          </p>
                        </div>

                        <div className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-300">
                          <BookmarkCheck className="h-3 w-3 text-slate-400" />
                          <span>Ref: {step.sop_reference || 'BNS / BNSS SOP'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 mt-3">
                <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>
                  HITL Approved by Investigating Officer V. K. Patel. Master FIR summary compiled against Qdrant vector store.
                </span>
              </div>
            </div>
          ) : (
            <div className="my-12 text-center text-slate-500 space-y-2">
              <Bot className="h-10 w-10 mx-auto text-slate-600" />
              <p className="text-xs text-slate-400">
                Click 'Re-Run LangGraph Agents' to run multi-agent legal reasoning across BNS, BNSS and BSA statutes.
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Statutory Penal Grounding & PDF Directives */}
        <div className="space-y-5 lg:col-span-5">
          
          {/* Statutory Penal Grounding */}
          <div className="pro-card p-5 space-y-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Gavel className="h-4 w-4 text-amber-400" />
              Statutory Penal Grounding
            </h2>

            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 space-y-1">
              <h3 className="text-xs font-semibold text-blue-400">
                {activeCase?.sections?.join(' & ') || 'BNS Section 318(4) & IT Act Section 66D'}
              </h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Punishment for cheating by personation using computer resource. Cognizable & Non-Bailable.
              </p>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 space-y-1">
              <h3 className="text-xs font-semibold text-emerald-400">
                Section 63 Bharatiya Sakshya Adhiniyam (BSA), 2023
              </h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Mandatory electronic evidence certificate required for digital transaction logs and server records.
              </p>
            </div>
          </div>

          {/* Turnkey Legal Requisition PDF Box */}
          <div className="pro-card p-5 space-y-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <FileText className="h-4 w-4 text-emerald-400" />
              Turnkey Legal Requisition PDF
            </h2>
            <p className="text-xs text-slate-400">
              Section 94 BNSS Legal Notice automatically rendered and ready for dispatch.
            </p>

            <button
              onClick={() => setPdfModalOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 p-2.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
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

    </div>
  );
}
