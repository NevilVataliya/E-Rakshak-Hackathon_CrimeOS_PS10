import React from 'react';
import { Network, AlertTriangle, ShieldAlert, Layers } from 'lucide-react';

export default function LinkAnalysisGraph({ matches = [] }) {
  const defaultMatches = [
    { match_type: 'VPA_RECURRENCE', matched_value: 'scammer@paytm', previous_case_no: 'CR-2026-0812', police_station: 'Surat Cyber Cell', confidence: 0.94 },
    { match_type: 'PHONE_CDR_RECURRENCE', matched_value: '+91 98765 43210', previous_case_no: 'CR-2026-0441', police_station: 'Rajkot Rural Station', confidence: 0.88 }
  ];

  const displayMatches = matches.length > 0 ? matches : defaultMatches;

  return (
    <div className="glass-panel rounded-2xl p-5 mb-6">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <Network className="h-4 w-4 text-amber-400" />
          Qdrant Cross-Case Memory Link Analysis
        </h2>

        <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-300">
          <AlertTriangle className="h-3 w-3" />
          {displayMatches.length} Serial Offender Linkages Found
        </span>
      </div>

      {/* Grid Matches */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {displayMatches.map((m, i) => (
          <div 
            key={i} 
            className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2 relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-300">
                <ShieldAlert className="h-4 w-4 text-amber-400" />
                {m.match_type}
              </span>
              <span className="rounded-md bg-amber-400 px-2 py-0.5 text-[10px] font-extrabold text-slate-950 font-mono">
                {(m.confidence * 100).toFixed(0)}% Confidence
              </span>
            </div>

            <p className="text-xs font-mono font-bold text-white bg-slate-950/60 p-2 rounded-lg border border-slate-800">
              Value: {m.matched_value}
            </p>

            <p className="text-[11px] text-slate-400">
              Linked Serial Case: <span className="font-bold text-cyan-300 font-mono">{m.previous_case_no}</span> ({m.police_station})
            </p>
          </div>
        ))}
      </div>

    </div>
  );
}
