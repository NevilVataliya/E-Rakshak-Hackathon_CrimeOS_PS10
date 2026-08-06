import React from 'react';
import { ShieldCheck, History, Key } from 'lucide-react';

export default function AdminView() {
  const roles = [
    { role: 'IO (Investigating Officer)', perm: 'Ingest complaints, Run Agent Studio, Generate Legal Requests', count: 18 },
    { role: 'SHO (Station House Officer)', perm: 'Approve & Dispatch Legal Requests, View Station Audit Logs', count: 4 },
    { role: 'Legal Advisor', perm: 'Review BNS/BSA grounding, Validate Section 94 notices', count: 2 },
    { role: 'System Admin', perm: 'Full RBAC, Vector store re-indexing, System Configuration', count: 1 }
  ];

  const auditLogs = [
    { time: '12:44:10', user: 'PSI V. K. Patel (IO)', action: 'EXECUTE_LANGGRAPH_STUDIO', case_no: 'CR-2026-9910' },
    { time: '12:45:02', user: 'PI R. S. Sharma (SHO)', action: 'APPROVE_SECTION_94_BNSS_NOTICE', case_no: 'CR-2026-9910' },
    { time: '12:46:18', user: 'PSI V. K. Patel (IO)', action: 'DISPATCH_LEGAL_NOTICE_EMAIL', case_no: 'CR-2026-9910' }
  ];

  return (
    <div className="flex-1 flex flex-col p-4 overflow-hidden gap-3 select-none">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
        <div>
          <h1 className="text-base font-extrabold tracking-wide text-white uppercase font-mono flex items-center gap-2">
            Module 7: RBAC Access Matrix & Immutable System Audit Ledger
          </h1>
          <p className="text-xs text-slate-400">
            Enforces strict role permissions for IO, SHO, and Legal Advisors with immutable audit logs.
          </p>
        </div>

        <span className="rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 text-xs font-bold font-mono">
          Immutable Audit Ledger
        </span>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-3 overflow-hidden">
        
        {/* Active Role Permission Matrix */}
        <div className="rounded border border-white/10 bg-[#0d1322] p-3 flex flex-col space-y-3 overflow-y-auto">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300 border-b border-white/10 pb-1.5 flex items-center gap-1.5 shrink-0">
            <Key className="h-4 w-4 text-blue-400" />
            Active Role Permission Matrix
          </span>

          <div className="space-y-2">
            {roles.map((r, i) => (
              <div 
                key={i} 
                className="rounded border border-white/10 bg-[#050811] p-2.5 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-white">{r.role}</h3>
                  <span className="rounded bg-blue-500/20 text-blue-300 px-2 py-0.5 text-[10px] font-mono font-bold">
                    {r.count} Active Users
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                  {r.perm}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Real-time System Audit Trail */}
        <div className="rounded border border-white/10 bg-[#0d1322] flex flex-col overflow-hidden">
          <div className="h-8 border-b border-white/10 px-3 flex items-center justify-between bg-[#080d1a] shrink-0">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <History className="h-4 w-4 text-emerald-400" />
              Real-time System Audit Ledger
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="border-b border-white/10 bg-[#050811] text-[10px] font-bold text-slate-400 uppercase tracking-wider sticky top-0">
                <tr>
                  <th className="py-2 px-2.5">Time</th>
                  <th className="py-2 px-2.5">Officer User</th>
                  <th className="py-2 px-2.5">Action</th>
                  <th className="py-2 px-2.5">Case ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {auditLogs.map((log, i) => (
                  <tr key={i} className="hover:bg-slate-900/60 transition-colors">
                    <td className="py-2 px-2.5 font-mono text-[11px] text-slate-400">{log.time}</td>
                    <td className="py-2 px-2.5 font-semibold text-white">{log.user}</td>
                    <td className="py-2 px-2.5">
                      <span className="rounded border border-white/10 bg-[#050811] px-1.5 py-0.5 text-[10px] font-mono text-slate-300">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2 px-2.5 font-mono font-bold text-blue-400">{log.case_no}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
}
