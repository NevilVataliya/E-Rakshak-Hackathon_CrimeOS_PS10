import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Network, ArrowRight, ShieldCheck, Database } from 'lucide-react';
import LinkAnalysisGraph from '../components/graphs/LinkAnalysisGraph';
import { useCaseStore } from '../store/caseStore';

export default function SerialLinkagePage() {
  const navigate = useNavigate();
  const { activeCase } = useCaseStore();

  return (
    <div className="space-y-5">
      
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
              Step 2: Qdrant Memory & Serial Offender Linkage
            </h1>
            <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400 flex items-center gap-1">
              <Network className="h-3 w-3" /> Vector Memory Search
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            Automatically queries Qdrant vector store to match suspect VPAs, phone numbers, and bank accounts across historical Gujarat FIRs.
          </p>
        </div>

        <button
          onClick={() => navigate('/investigation')}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
        >
          <span>Proceed to Step 3: Agent Studio</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* Case Context Summary Card */}
      <div className="pro-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600/20 text-blue-400">
              <Database className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Analyzing Active Case Context</h2>
              <p className="text-xs font-bold text-white font-mono">
                {activeCase?.case_number || 'CR-2026-9910'} ({activeCase?.fir_number || 'FIR-042/2026'})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="rounded border border-slate-800 bg-slate-900 px-2.5 py-1 text-slate-300">
              Category: <b className="text-white">{activeCase?.crime_category}</b>
            </span>
            <span className="rounded border border-slate-800 bg-slate-900 px-2.5 py-1 text-slate-300">
              Loss: <b className="text-rose-400">₹{activeCase?.entities?.monetary_loss || 200000}</b>
            </span>
          </div>
        </div>
      </div>

      {/* Cross-Case Memory Link Graph */}
      <LinkAnalysisGraph />

      {/* Deep Link Insights Table */}
      <div className="pro-card p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-xs font-bold text-white flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            Modus Operandi & Target Entity Overlap Summary
          </h3>
          <span className="text-xs font-mono text-blue-400">
            Vector Distance Match: 0.94
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
            <span className="text-[10px] font-semibold uppercase text-slate-400">Target VPA Match</span>
            <p className="mt-1 text-xs font-mono font-semibold text-amber-300">scammer@paytm</p>
            <p className="mt-1 text-[11px] text-slate-400">Linked to 3 previous complaints in Surat & Rajkot.</p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
            <span className="text-[10px] font-semibold uppercase text-slate-400">Phone CDR Recurrence</span>
            <p className="mt-1 text-xs font-mono font-semibold text-blue-300">+91 98765 43210</p>
            <p className="mt-1 text-[11px] text-slate-400">Matched active suspect line in Rajkot Rural Station.</p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
            <span className="text-[10px] font-semibold uppercase text-slate-400">Beneficiary Bank Account</span>
            <p className="mt-1 text-xs font-mono font-semibold text-emerald-300">SBI 30910293101</p>
            <p className="mt-1 text-[11px] text-slate-400">Section 94 BNSS Notice issued for instant freeze.</p>
          </div>
        </div>
      </div>

    </div>
  );
}
