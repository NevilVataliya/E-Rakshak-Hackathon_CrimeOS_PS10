import React, { useState, useEffect } from 'react';
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
  Layers,
  ArrowRight,
  BookmarkCheck
} from 'lucide-react';
import AgentFlowGraph from '../components/AgentFlowGraph';
import LinkAnalysisGraph from '../components/LinkAnalysisGraph';
import PDFPreviewModal from '../components/PDFPreviewModal';
import { useCaseStore } from '../store/caseStore';

export default function InvestigationPage() {
  const { cases, activeCase, setActiveCase, runInvestigationStudio, investigationData, loading } = useCaseStore();
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [expandedStep, setExpandedStep] = useState(0);

  useEffect(() => {
    if (activeCase && !investigationData) {
      runInvestigationStudio(activeCase.case_number, activeCase.complaint_text, activeCase.crime_category, activeCase.crime_sub_type, activeCase.entities);
    }
  }, [activeCase]);

  const handleCaseSelect = (caseNo) => {
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
    <div className="space-y-6">
      
      {/* Case Header & Selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Active Case Selection
            </label>
            <select
              value={activeCase?.case_number || ''}
              onChange={(e) => handleCaseSelect(e.target.value)}
              className="glass-input rounded-xl px-3 py-2 text-xs font-bold text-cyan-300 min-w-[220px]"
            >
              {cases.map((c) => (
                <option key={c.case_number} value={c.case_number}>
                  {c.case_number} ({c.crime_category})
                </option>
              ))}
            </select>
          </div>

          <div className="border-l border-slate-800 pl-4">
            <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
              Agentic Investigation Studio
            </h1>
            <p className="text-xs text-slate-400">
              FIR: <span className="font-mono text-cyan-300 font-bold">{activeCase?.fir_number || 'FIR-9910/2026'}</span> | Assigned IO: <span className="text-slate-200 font-semibold">PSI V. K. Patel</span>
            </p>
          </div>
        </div>

        <button
          onClick={handleRunAgentStudio}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-glow-cyan transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Executing Parallel Agent Pods...</span>
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              <span>Re-Execute LangGraph Agent Studio</span>
            </>
          )}
        </button>
      </div>

      {/* Visual LangGraph Execution Graph */}
      <AgentFlowGraph activeStep={investigationData ? 6 : 4} status="APPROVED" />

      {/* Visual Link Analysis Graph */}
      <LinkAnalysisGraph matches={investigationData?.cross_case_matches} />

      {/* Main Grid: SOP Directives & Statutory Grounding */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        
        {/* Left Column: Step-by-Step SOP Directives */}
        <div className="glass-panel rounded-2xl p-6 lg:col-span-7 space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-4">
            <ShieldCheck className="h-5 w-5 text-cyan-400" />
            SOP-Grounded Investigation Directives
          </h2>

          {investigationData ? (
            <div className="space-y-3">
              {investigationData.investigation_steps?.map((step, idx) => {
                const isOpen = expandedStep === idx;
                return (
                  <div 
                    key={idx} 
                    className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden transition-colors hover:border-slate-700"
                  >
                    <button
                      onClick={() => setExpandedStep(isOpen ? -1 : idx)}
                      className="w-full flex items-center justify-between p-4 text-left"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/20 text-xs font-extrabold text-cyan-300 border border-cyan-500/30">
                          {step.step_number}
                        </span>
                        <h3 className="text-xs font-bold text-white">{step.title}</h3>
                      </div>
                      {isOpen ? (
                        <ChevronUp className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      )}
                    </button>

                    {isOpen && (
                      <div className="px-4 pb-4 pt-1 border-t border-slate-800/80 space-y-3">
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {step.description}
                        </p>
                        <div className="inline-flex items-center gap-1.5 rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-semibold text-indigo-300">
                          <BookmarkCheck className="h-3.5 w-3.5 text-indigo-400" />
                          <span>Ref: {step.sop_reference || 'BNS / BNSS SOP'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-300 mt-4">
                <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>
                  HITL Approved by Investigating Officer V. K. Patel. Master FIR summary compiled against Qdrant vector store.
                </span>
              </div>
            </div>
          ) : (
            <div className="my-16 text-center text-slate-500 space-y-3">
              <Bot className="h-16 w-16 mx-auto opacity-30 text-cyan-400" />
              <p className="text-xs max-w-sm mx-auto text-slate-400">
                Click 'Re-Execute LangGraph Agent Studio' to run multi-agent legal reasoning across BNS, BNSS and BSA statutes.
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Statutory Penal Grounding & PDF Directives */}
        <div className="space-y-6 lg:col-span-5">
          
          {/* Statutory Penal Grounding */}
          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-4">
              <Gavel className="h-5 w-5 text-amber-400" />
              Statutory Penal Grounding
            </h2>

            <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4 space-y-1">
              <h3 className="text-xs font-bold text-cyan-300">
                {activeCase?.sections || 'BNS Section 318(4) & IT Act Section 66D'}
              </h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Punishment for cheating by personation using computer resource. Cognizable & Non-Bailable.
              </p>
            </div>

            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-1">
              <h3 className="text-xs font-bold text-emerald-300">
                Section 63 Bharatiya Sakshya Adhiniyam (BSA), 2023
              </h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Mandatory electronic evidence certificate required for digital transaction logs and server records.
              </p>
            </div>
          </div>

          {/* Turnkey Legal Requisition PDF Box */}
          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-4">
              <FileText className="h-5 w-5 text-emerald-400" />
              Turnkey Legal Requisition PDF
            </h2>
            <p className="text-xs text-slate-400">
              Section 94 BNSS Legal Notice automatically rendered and ready for dispatch.
            </p>

            <button
              onClick={() => setPdfModalOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 p-3.5 text-xs font-bold text-white shadow-glow-emerald transition-all hover:scale-[1.01] active:scale-[0.99]"
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
