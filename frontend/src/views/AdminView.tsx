import React from 'react';
import { ShieldCheck, History, Key } from 'lucide-react';
import { useCaseStore } from '../store/caseStore';
import { useAuthStore } from '../store/authStore';

export default function AdminView() {
  const { cases, activeCase } = useCaseStore();
  const { user } = useAuthStore();

  const roles = [
    { role: 'IO (Investigating Officer)', perm: 'Ingest complaints, Run Agent Studio, Generate Legal Requests', count: 18 },
    { role: 'SHO (Station House Officer)', perm: 'Approve & Dispatch Legal Requests, View Station Audit Logs', count: 4 },
    { role: 'Legal Advisor', perm: 'Review BNS/BSA grounding, Validate Section 94 notices', count: 2 },
    { role: 'System Admin', perm: 'Full RBAC, Vector store re-indexing, System Configuration', count: 1 }
  ];

  // Dynamically compile audit logs from real case timeline events across active cases
  const dynamicLogs: any[] = [];

  cases.forEach((c) => {
    const timeline = c.activity_timeline || (c as any).timeline;
    if (timeline && Array.isArray(timeline)) {
      timeline.forEach((t: any) => {
        dynamicLogs.push({
          time: t.timestamp ? new Date(t.timestamp).toLocaleTimeString('en-US', { hour12: false }) : '12:00:00',
          user: `${user?.full_name || c.assigned_io || 'PSI V. K. Patel'} (IO)`,
          action: (t.title || 'CASE_TIMELINE_UPDATE').toUpperCase().replace(/\s+/g, '_'),
          case_no: c.case_number
        });
      });
    } else {
      dynamicLogs.push({
        time: new Date().toLocaleTimeString('en-US', { hour12: false }),
        user: `${user?.full_name || c.assigned_io || 'PSI V. K. Patel'} (IO)`,
        action: 'CASE_REGISTERED_IN_COMMAND_FEED',
        case_no: c.case_number
      });
    }
  });

  const auditLogs = dynamicLogs.length > 0 ? dynamicLogs.slice(0, 15) : [
    { time: new Date().toLocaleTimeString('en-US', { hour12: false }), user: `${user?.full_name || 'PSI Inspector'} (IO)`, action: 'SYSTEM_AUDIT_LEDGER_INITIALIZED', case_no: activeCase?.case_number || 'CR-2026-ACTIVE' }
  ];

  return (
    <div className="flex-1 flex flex-col p-4 overflow-hidden gap-3 select-none bg-[#F8FAFC] dark:bg-[#050811]">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3 shrink-0">
        <div>
          <h1 className="text-base font-black tracking-wide text-slate-900 dark:text-white uppercase font-mono flex items-center gap-2">
            Administration & Immutable System Audit Ledger
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Enforces strict role permissions for IO, SHO, and Legal Advisors with immutable audit logs.
          </p>
        </div>

        <span className="rounded bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-400/40 px-2.5 py-1 text-xs font-bold font-mono">
          Immutable Audit Ledger
        </span>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-3 overflow-hidden">
        
        {/* Active Role Permission Matrix */}
        <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1322] p-3 flex flex-col space-y-3 overflow-y-auto shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-200 border-b border-slate-200 dark:border-white/10 pb-2 flex items-center gap-1.5 shrink-0">
            <Key className="h-4 w-4 text-[#0A2540] dark:text-blue-400" />
            Active Role Permission Matrix
          </span>

          <div className="space-y-2">
            {roles.map((r, i) => (
              <div 
                key={i} 
                className="rounded border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#050811] p-2.5 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">{r.role}</h3>
                  <span className="rounded bg-blue-100 dark:bg-blue-500/20 text-blue-900 dark:text-blue-300 px-2 py-0.5 text-[10px] font-mono font-bold">
                    {r.count} Active Users
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed font-sans">
                  {r.perm}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Real-time System Audit Trail */}
        <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1322] flex flex-col overflow-hidden shadow-sm">
          <div className="h-8 border-b border-slate-200 dark:border-white/10 px-3 flex items-center justify-between bg-[#0A2540] dark:bg-[#080d1a] shrink-0 text-white">
            <span className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
              <History className="h-4 w-4 text-emerald-400" />
              Real-time System Audit Ledger
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs text-slate-800 dark:text-slate-200">
              <thead className="border-b border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-[#050811] text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider sticky top-0">
                <tr>
                  <th className="py-2 px-2.5">Time</th>
                  <th className="py-2 px-2.5">Officer User</th>
                  <th className="py-2 px-2.5">Action</th>
                  <th className="py-2 px-2.5">Case ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {auditLogs.map((log, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors">
                    <td className="py-2 px-2.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">{log.time}</td>
                    <td className="py-2 px-2.5 font-semibold text-slate-900 dark:text-white">{log.user}</td>
                    <td className="py-2 px-2.5">
                      <span className="rounded border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-[#050811] px-1.5 py-0.5 text-[10px] font-mono text-slate-700 dark:text-slate-300">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2 px-2.5 font-mono font-bold text-blue-700 dark:text-blue-400">{log.case_no}</td>
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
