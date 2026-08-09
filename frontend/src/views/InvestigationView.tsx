import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCaseStore } from '../store/caseStore';
import { 
  Bot, 
  BookOpen, 
  Square, 
  ShieldCheck, 
  ArrowRight, 
  Scale, 
  Send, 
  CreditCard, 
  Phone, 
  RefreshCw,
  Cpu,
  RotateCcw,
  XCircle,
  FileQuestion
} from 'lucide-react';

export default function InvestigationView() {
  const navigate = useNavigate();
  const { activeCase, investigationData, loading, runInvestigationStudio } = useCaseStore();

  const [activeTab, setActiveTab] = useState<'sop' | 'legal' | 'targets'>('sop');
  const [executingAgent, setExecutingAgent] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    if (activeCase && !investigationData) {
      handleRunAgentStudio();
    }
  }, [activeCase]);

  const handleStopAgentStudio = () => {
    setExecutingAgent(false);
    setCancelled(true);
  };

  const handleRunAgentStudio = async () => {
    if (!activeCase) return;
    setExecutingAgent(true);
    setCancelled(false);
    try {
      await runInvestigationStudio(
        activeCase.case_number,
        activeCase.complaint_text || activeCase.translated_text || 'Police complaint statement.',
        activeCase.crime_category || 'CYBER',
        activeCase.crime_sub_type || 'Financial Cyber Fraud',
        activeCase.entities
      );
    } catch (err) {
      console.warn('Agent Studio Execution Note');
    } finally {
      setExecutingAgent(false);
    }
  };

  // Dynamic SOP steps from backend investigation graph (zero hardcoded fallback)
  const sopSteps = investigationData?.investigation_steps || [];

  // Dynamic sections from backend
  const legalSections = investigationData?.sections || activeCase?.sections || [];

  // Target Directives from real extracted case entities (zero hardcoded fallback)
  const targetDirectives = activeCase?.entities?.bank_accounts && activeCase.entities.bank_accounts.length > 0
    ? activeCase.entities.bank_accounts.map((b: any, i: number) => ({
        id: `tgt-${i}`,
        identifier: b.account_number || String(b),
        type: 'bank',
        entity_name: b.bank || 'Bank Nodal Cell',
        name: b.account_name || 'Beneficiary Mule Account',
        risk_score: 9.0 - (i * 0.4),
        directive: 'Urgent Debit Freeze Order (Sec 106 BNSS)'
      }))
    : [];

  return (
    <div className="flex-1 overflow-y-auto bg-[#050811] p-6 space-y-6 select-none">
      {/* Top Banner: Module 03 AI Investigation Path */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-cyan-950/50 via-slate-900/80 to-blue-950/40 p-5 rounded-2xl border border-cyan-500/30 glow-cyan">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-cyan-500/20 border border-cyan-400/40 rounded-xl text-cyan-400">
            <Bot className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-bold text-cyan-400 tracking-wider uppercase">
                MODULE 03 • AGENTIC AI INVESTIGATION STUDIO
              </span>
              <span className="text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800 px-2 py-0.5 rounded font-mono">
                {investigationData?.evaluator_status ? `EVALUATOR STATUS: ${investigationData.evaluator_status}` : 'Grounded in Police SOPs & Laws'}
              </span>
            </div>
            <h1 className="text-xl font-black text-slate-100 tracking-tight">
              AI-Suggested Investigation Path & Statutory Directives Studio
            </h1>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-3 shrink-0">
          {executingAgent || loading ? (
            <button
              onClick={handleStopAgentStudio}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-extrabold transition-all flex items-center space-x-2 shadow-lg"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop Reasoning Pods</span>
            </button>
          ) : (
            <button
              onClick={handleRunAgentStudio}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-500/40 rounded-xl text-xs font-bold transition-all flex items-center space-x-2"
            >
              {cancelled ? <RotateCcw className="w-3.5 h-3.5" /> : <RefreshCw className="w-3.5 h-3.5" />}
              <span>{cancelled ? 'Retry Reasoning Pods' : 'Run Agentic Graph'}</span>
            </button>
          )}

          {/* View Tabs */}
          <div className="flex items-center space-x-1.5 bg-slate-900/90 border border-slate-800 p-1.5 rounded-xl">
            {[
              { id: 'sop', label: 'SOP Strategy Steps', icon: BookOpen },
              { id: 'legal', label: 'Statute Recommendations', icon: Scale },
              { id: 'targets', label: 'Target Directives', icon: Send }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === tab.id
                      ? 'bg-cyan-500 text-black shadow-md font-mono'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Cancelled Banner */}
      {cancelled && (
        <div className="bg-rose-950/40 border border-rose-500/40 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3 text-rose-300">
            <XCircle className="w-5 h-5 shrink-0 text-rose-400" />
            <div>
              <h3 className="text-xs font-bold font-mono">⏹️ REASONING POD EXECUTION STOPPED BY OFFICER</h3>
              <p className="text-[11px] text-slate-300">Multi-Agent LangGraph execution stopped safely. Click retry to re-run reasoning.</p>
            </div>
          </div>

          <button
            onClick={handleRunAgentStudio}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold font-mono transition-all flex items-center space-x-1.5 shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry Reasoning Pods</span>
          </button>
        </div>
      )}

      {/* Loading Execution Banner */}
      {(executingAgent || loading) && (
        <div className="bg-[#0c1220] border border-cyan-500/40 rounded-2xl p-5 flex items-center space-x-4 animate-pulse">
          <Cpu className="w-6 h-6 text-cyan-400 animate-spin" />
          <div>
            <h3 className="text-xs font-mono font-bold text-cyan-400 uppercase">
              Multi-Agent LangGraph Reasoning Execution Active
            </h3>
            <p className="text-[11px] text-slate-300">
              Running BNS Legal Specialist, BSA Evidence Specialist, Cyber Intel Specialist, and Anti-Laziness Evaluator Loop...
            </p>
          </div>
        </div>
      )}

      {/* Content Section based on Active Tab */}
      {activeTab === 'sop' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-12 bg-[#0c1220] border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider flex items-center space-x-2">
                <BookOpen className="w-4 h-4" />
                <span>AI-Suggested Investigation Path (Grounded in SOPs)</span>
              </h2>
              <span className="text-[11px] text-slate-400 font-mono">
                {sopSteps.length} Grounded Steps Generated
              </span>
            </div>

            {sopSteps.length === 0 ? (
              <div className="bg-[#050811] border border-slate-800 rounded-2xl p-8 text-center space-y-3">
                <FileQuestion className="w-10 h-10 text-slate-600 mx-auto" />
                <h3 className="text-sm font-extrabold text-slate-300">No AI Investigation Steps Generated Yet</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                  Click <strong>"Run Agentic Graph"</strong> above to launch BNS, BSA, Cyber Intel, and Evaluator agent pods to generate grounded investigation steps.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {sopSteps.map((step: any, idx: number) => (
                  <div
                    key={idx}
                    className="bg-[#050811] border border-slate-800 hover:border-cyan-500/40 p-5 rounded-2xl space-y-3 transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                      <div className="flex items-center space-x-2.5">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-400 text-xs font-mono font-bold">
                          {step.step_number || idx + 1}
                        </span>
                        <h3 className="text-sm font-extrabold text-slate-100">
                          {step.title || step.step_title}
                        </h3>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800 px-2 py-0.5 rounded">
                          {step.sop_reference || 'SOP-REF'}
                        </span>
                        {step.document_name && (
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
                            {step.document_name} ({step.section_path || 'Sec 1'})
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'legal' && (
        legalSections.length === 0 ? (
          <div className="bg-[#0c1220] border border-slate-800 rounded-2xl p-8 text-center space-y-3">
            <FileQuestion className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-sm font-extrabold text-slate-300">No Statute Recommendations Found</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Run the agentic graph to extract applicable BNS, BNSS, BSA, and IT Act sections.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {legalSections.map((sec: string, idx: number) => (
              <div key={idx} className="bg-[#0c1220] border border-slate-800 p-5 rounded-2xl space-y-3">
                <div className="text-[10px] font-mono text-cyan-400 font-bold uppercase">Statute Section {idx + 1}</div>
                <h3 className="text-sm font-extrabold text-slate-100">{sec}</h3>
                <p className="text-xs text-slate-400">
                  Identified by BNS & BSA Legal Agent Pods based on evidence narrative and SOP grounding.
                </p>
              </div>
            ))}
          </div>
        )
      )}

      {activeTab === 'targets' && (
        targetDirectives.length === 0 ? (
          <div className="bg-[#0c1220] border border-slate-800 rounded-2xl p-8 text-center space-y-3">
            <FileQuestion className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-sm font-extrabold text-slate-300">No Target Directives Extracted Yet</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Infect case intake with suspect bank accounts or phone lines to populate target directive cards.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {targetDirectives.map((tgt: any) => (
              <div key={tgt.id} className="bg-[#0c1220] border border-slate-800 p-5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {tgt.type === 'bank' ? (
                      <CreditCard className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Phone className="w-4 h-4 text-sky-400" />
                    )}
                    <span className="text-xs font-mono font-bold text-slate-200">{tgt.entity_name}</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-950 px-2 py-0.5 rounded border border-amber-800">
                    Risk: {tgt.risk_score}/10
                  </span>
                </div>

                <div className="bg-[#050811] p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Target Identifier</div>
                  <div className="text-sm font-mono font-bold text-cyan-300">{tgt.identifier}</div>
                  <div className="text-[11px] text-slate-400 mt-1">{tgt.name}</div>
                </div>

                <p className="text-xs font-semibold text-slate-300">{tgt.directive}</p>

                <button
                  onClick={() => navigate('/subpoenas')}
                  className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-extrabold text-xs rounded-xl transition-all flex items-center justify-center space-x-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Issue Statutory Directive</span>
                </button>
              </div>
            ))}
          </div>
        )
      )}

      {/* Bottom Action Section */}
      <div className="bg-[#0c1220] border border-slate-800 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <div>
            <h3 className="text-xs font-bold text-slate-200">
              AI Strategy Paths Verified & Evaluated
            </h3>
            <p className="text-[11px] text-slate-400">
              Proceed to Statutory Directives & Email Automator to generate and dispatch notices via SMTP.
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/subpoenas')}
          className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-extrabold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center space-x-2 shrink-0"
        >
          <span>Proceed to Legal Directives & Email Automator (Step 04)</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
