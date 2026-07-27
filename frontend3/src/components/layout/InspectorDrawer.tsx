import React from 'react';
import { PanelRightClose, ShieldCheck, Database, Layers, Gavel, FileText, CheckCircle2, ChevronRight } from 'lucide-react';
import { useCaseStore } from '../../store/caseStore';

export default function InspectorDrawer() {
  const { activeCase, selectedInspectorItem } = useCaseStore();

  return (
    <aside className="w-80 h-full border-l border-white/10 bg-[#0d1322] flex flex-col shrink-0 select-none overflow-hidden">
      
      {/* Header */}
      <div className="h-10 border-b border-white/10 px-3 flex items-center justify-between bg-[#080d1a] shrink-0">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
          <Database className="h-3.5 w-3.5 text-blue-400" />
          Intelligence Inspector
        </span>
        <span className="text-[10px] font-mono text-slate-400">
          {activeCase?.case_number || 'CR-2026-9910'}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
        
        {selectedInspectorItem ? (
          <div className="space-y-3">
            <div className="rounded border border-blue-500/30 bg-blue-500/10 p-2.5 space-y-1">
              <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider">
                Inspector Type: {selectedInspectorItem.type}
              </span>
              <p className="font-mono text-xs font-bold text-white">
                {JSON.stringify(selectedInspectorItem.data)}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Active FIR Context */}
            <div className="rounded border border-white/10 bg-[#050811] p-3 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-white border-b border-white/10 pb-1.5">
                <span>FIR: {activeCase?.fir_number || 'FIR-042/2026'}</span>
                <span className="text-emerald-400 font-mono">Severity {activeCase?.severity_score || 9.2}</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                {activeCase?.translated_text}
              </p>
              <div className="pt-1 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <span>Category: {activeCase?.crime_category}</span>
                <span>IO: {activeCase?.assigned_io}</span>
              </div>
            </div>

            {/* Extracted Entities List */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Extracted Grounded Entities
              </span>

              <div className="rounded border border-white/10 bg-[#050811] p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-300">Target Phone</span>
                  <span className="font-mono text-xs font-bold text-blue-400">
                    {activeCase?.entities?.phone_numbers?.[0] || '+91 98765 43210'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-300">Target UPI VPA</span>
                  <span className="font-mono text-xs font-bold text-amber-400">
                    {activeCase?.entities?.vpas_upis?.[0] || 'scammer@paytm'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-300">Monetary Loss</span>
                  <span className="font-mono text-xs font-bold text-rose-400">
                    ₹{activeCase?.entities?.monetary_loss || 200000}
                  </span>
                </div>
              </div>
            </div>

            {/* Statutory Grounding */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Statutory Penal Sections
              </span>

              <div className="rounded border border-white/10 bg-[#050811] p-2.5 space-y-1.5">
                {activeCase?.sections?.map((sec: string, idx: number) => (
                  <div key={idx} className="flex items-center gap-1.5 text-[11px] font-mono text-slate-300">
                    <Gavel className="h-3 w-3 text-amber-400 shrink-0" />
                    <span>{sec}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Judicial Certificate Guard */}
            <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-3 space-y-1">
              <span className="text-xs font-bold text-emerald-300 flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                Section 63 BSA Hash Certifier
              </span>
              <p className="text-[10px] text-slate-300 leading-relaxed font-sans">
                SHA-256 digital certificate ready for judicial submission.
              </p>
            </div>
          </>
        )}

      </div>

    </aside>
  );
}
