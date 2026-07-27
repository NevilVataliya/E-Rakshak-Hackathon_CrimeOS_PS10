import React from 'react';
import { ShieldCheck, History, Key } from 'lucide-react';

export default function AdminPage() {
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
    <div className="space-y-5">
      
      {/* Header */}
      <div className="border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            Role-Based Access Control (RBAC) & Audit Trail
          </h1>
          <span className="rounded border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-400 flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" /> Immutable Audit Ledger
          </span>
        </div>
        <p className="mt-0.5 text-xs text-slate-400">
          Enforces strict role permissions for IO, SHO, and Legal Advisors with immutable audit logs.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        
        {/* Active Role Permission Matrix */}
        <div className="pro-card p-5 space-y-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Key className="h-4 w-4 text-blue-400" />
            Active Role Permission Matrix
          </h2>

          <div className="space-y-2.5">
            {roles.map((r, i) => (
              <div 
                key={i} 
                className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"
              >
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-xs font-semibold text-white">{r.role}</h3>
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono font-semibold text-blue-300">
                    {r.count} Active Users
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {r.perm}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Real-time System Audit Trail */}
        <div className="pro-card p-5 space-y-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <History className="h-4 w-4 text-emerald-400" />
            Real-time System Audit Trail
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="border-b border-slate-800 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-2">Time</th>
                  <th className="py-2.5 px-2">Officer User</th>
                  <th className="py-2.5 px-2">Action</th>
                  <th className="py-2.5 px-2">Case ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {auditLogs.map((log, i) => (
                  <tr key={i} className="hover:bg-slate-900/60 transition-colors">
                    <td className="py-2.5 px-2 font-mono text-[11px] text-slate-400">{log.time}</td>
                    <td className="py-2.5 px-2 font-semibold text-white">{log.user}</td>
                    <td className="py-2.5 px-2">
                      <span className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-300 font-mono">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 font-mono font-semibold text-blue-400">{log.case_no}</td>
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
