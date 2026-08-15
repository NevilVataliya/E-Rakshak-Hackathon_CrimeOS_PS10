import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, FileCheck2, AlertTriangle, Cpu, FileUp, ShieldCheck, ListTree, Activity, Zap, CheckCircle2, RotateCcw, Loader2 } from 'lucide-react';
import { useCaseStore } from '../store/caseStore';
import { PoliceCase } from '../types';
import CasePipelineModal from '../components/common/CasePipelineModal';

export default function DashboardView() {
  const navigate = useNavigate();
  const { cases, activeCase, setActiveCase, fetchCases, startNewComplaint, clearAllCasesAndData, dispatchedDirectivesByCase, linkageMatches } = useCaseStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCaseForModal, setSelectedCaseForModal] = useState<PoliceCase | null>(null);
  const [isPurging, setIsPurging] = useState(false);

  useEffect(() => {
    fetchCases();
  }, []);

  const handleOpenPipelineModal = (c: PoliceCase) => {
    setActiveCase(c);
    setSelectedCaseForModal(c);
    setModalOpen(true);
  };

  const handleRegisterNewComplaint = () => {
    startNewComplaint();
    navigate('/intake');
  };

  const handlePurge = async () => {
    if (window.confirm('Are you sure you want to delete all past cases and reset storage?')) {
      setIsPurging(true);
      try {
        await clearAllCasesAndData();
      } finally {
        setTimeout(() => setIsPurging(false), 500);
      }
    }
  };

  // Compute dynamic KPI metrics from active store cases and dispatched directives
  const totalCasesCount = cases.length;
  const cyberCasesCount = cases.filter(c => (c.crime_category || '').toLowerCase().includes('cyber')).length;
  const financialCasesCount = cases.filter(c => (c.crime_category || '').toLowerCase().includes('financial') || (c.crime_category || '').toLowerCase().includes('fraud')).length;

  const totalDispatchedSubpoenas = Object.values(dispatchedDirectivesByCase || {}).reduce((acc, list) => {
    return acc + (Array.isArray(list) ? list.length : 0);
  }, 0);

  const totalSerialMatches = linkageMatches?.length || 0;

  return (
    <div className="flex-1 flex flex-col p-4 overflow-hidden gap-4 select-none bg-[#F8FAFC] dark:bg-[#050811]">

      {/* Top Banner */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3 shrink-0">
        <div>
          <h1 className="text-base font-black tracking-wide text-slate-900 dark:text-white uppercase font-mono flex items-center gap-2">
            Investigation Command Register
            <span className="rounded bg-emerald-100 dark:bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-800 dark:text-emerald-300 font-sans font-bold border border-emerald-300 dark:border-emerald-500/30">
              Live Station Feed
            </span>
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Official law enforcement pipeline — manage FIR cases, serial offender linkage, and legal requisitions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePurge}
            disabled={isPurging}
            className="flex items-center gap-1.5 rounded border border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors shadow-sm disabled:opacity-50"
            title="Purge all cases and clear storage"
          >
            {isPurging ? <Loader2 className="h-3.5 w-3.5 animate-spin text-rose-600 dark:text-rose-400" /> : <RotateCcw className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />}
            <span>{isPurging ? 'Purging...' : 'Purge Storage'}</span>
          </button>

          <button
            onClick={handleRegisterNewComplaint}
            className="flex items-center gap-1.5 rounded bg-[#0A2540] dark:bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors shadow-sm"
          >
            <FileUp className="h-3.5 w-3.5 text-amber-400" />
            <span>Register New Complaint</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-4 gap-3 shrink-0">
        <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1322] p-3 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">
            <span>Active Cases</span>
            <Layers className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-xl font-extrabold text-slate-900 dark:text-white font-mono">{totalCasesCount}</p>
          <p className="text-[10px] text-blue-700 dark:text-blue-400 font-semibold font-mono">{cyberCasesCount} Cyber / {financialCasesCount} Financial</p>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1322] p-3 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">
            <span>Subpoenas Dispatched</span>
            <FileCheck2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-xl font-extrabold text-slate-900 dark:text-white font-mono">{totalDispatchedSubpoenas}</p>
          <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold font-mono">Sec 94 Statutory Validated</p>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1322] p-3 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">
            <span>Serial Link Matches</span>
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-xl font-extrabold text-slate-900 dark:text-white font-mono">{totalSerialMatches}</p>
          <p className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold font-mono">Cross-Case Entity Matches</p>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1322] p-3 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">
            <span>AI Knowledge Base</span>
            <Cpu className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <p className="text-xl font-extrabold text-slate-900 dark:text-white font-mono">Active</p>
          <p className="text-[10px] text-indigo-700 dark:text-indigo-400 font-semibold font-mono">Legal Acts & SOPs Loaded</p>
        </div>
      </div>

      {/* Main Grid Layout: Active Cases Table & Station Intelligence */}
      <div className="flex-1 grid grid-cols-3 gap-3 overflow-hidden">

        {/* Left: Active Cases Table */}
        <div className="col-span-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1322] flex flex-col overflow-hidden shadow-sm">
          <div className="h-9 border-b border-slate-200 dark:border-white/10 px-3 flex items-center justify-between bg-[#0A2540] dark:bg-[#080d1a] shrink-0 text-white">
            <span className="text-xs font-bold uppercase tracking-wider text-white">
              Active Police Case Register
            </span>
            <span className="text-[10px] text-amber-300 font-mono">
              Click 'Pipeline Steps' on any case to open guided workflow
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs text-slate-800 dark:text-slate-200">
              <thead className="border-b border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-[#050811] text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">Case / FIR No.</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Sub-Type</th>
                  <th className="py-2.5 px-3">Assigned IO</th>
                  <th className="py-2.5 px-3 text-right">Investigation Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {cases.map((c: PoliceCase) => {
                  const isActive = activeCase?.case_number === c.case_number;

                  return (
                    <tr 
                      key={c.case_number} 
                      className={`transition-colors ${isActive ? 'bg-amber-50/80 dark:bg-blue-500/10 hover:bg-amber-100/80 dark:hover:bg-blue-500/15' : 'hover:bg-slate-50 dark:hover:bg-slate-900/60'}`}
                    >
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-1.5">
                          <span>{c.case_number}</span>
                          {isActive && (
                            <span className="text-[9px] font-mono text-amber-900 dark:text-emerald-300 bg-amber-400 dark:bg-emerald-500/20 px-1.5 py-0.2 rounded font-bold border dark:border-emerald-500/30">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">{c.fir_number}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="rounded border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 text-[10px] font-mono text-blue-900 dark:text-blue-300 font-bold">
                          {c.crime_category}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-medium">{c.crime_sub_type}</td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{c.assigned_io}</td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => handleOpenPipelineModal(c)}
                          className="inline-flex items-center gap-1.5 rounded border border-[#0A2540] dark:border-blue-500/40 bg-[#0A2540] dark:bg-blue-500/10 px-2.5 py-1 text-[11px] font-mono text-white dark:text-blue-300 font-bold hover:bg-slate-800 dark:hover:bg-blue-500/20 transition-all shadow-sm"
                        >
                          <ListTree className="h-3.5 w-3.5 text-amber-400 dark:text-blue-400" />
                          <span>Pipeline Steps</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Station Intelligence & Rapid Actions */}
        <div className="col-span-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1322] flex flex-col p-3 gap-3 overflow-y-auto shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-[#0A2540] dark:text-blue-400" />
              Station Intelligence
            </span>
            <span className="text-[9px] font-mono text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-50 dark:bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-500/30">System Online</span>
          </div>

          <div className="space-y-2.5 flex-1">
            {/* Quick Action Button for Registering New Complaint */}
            <button
              onClick={handleRegisterNewComplaint}
              className="flex w-full items-center justify-between rounded-lg border border-amber-400 dark:border-amber-500/40 bg-amber-500 dark:bg-amber-500/20 p-3 text-left hover:bg-amber-600 dark:hover:bg-amber-500/30 transition-all group shadow"
            >
              <div className="space-y-0.5">
                <span className="text-xs font-black text-slate-950 dark:text-amber-300 flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-slate-950 dark:text-amber-400" />
                  Register New Complaint
                </span>
                <p className="text-[10px] text-slate-900 dark:text-slate-200 leading-normal font-medium">
                  Ingest raw statements, attached PDFs, evidence images, or audio recordings.
                </p>
              </div>
              <ListTree className="h-4 w-4 text-slate-950 dark:text-amber-300 group-hover:scale-110 transition-transform" />
            </button>

            {/* High-Severity Alerts List */}
            <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#050811] p-2.5 space-y-2">
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block border-b border-slate-200 dark:border-white/10 pb-1">
                Priority Station Alerts
              </span>
              
              <div className="space-y-2 text-xs font-mono">
                <div className="flex items-start gap-2 text-slate-900 dark:text-slate-100">
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-rose-700 dark:text-rose-400">CR-2026-9910:</span> UPI Fraud & Rs. 2 Lakh Loss. Accused A/C 30910293101 flagged.
                  </div>
                </div>

                <div className="flex items-start gap-2 text-slate-900 dark:text-slate-100 pt-1.5 border-t border-slate-200 dark:border-white/10">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-amber-800 dark:text-amber-300">Serial Link Match:</span> Suspect Line +91 98765 43210 matched across 3 Surat Cyber cases.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded border border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 p-2.5 space-y-1">
            <span className="text-xs font-bold text-emerald-950 dark:text-emerald-300 flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
              Statutory Citation Guarantee
            </span>
            <p className="text-[10px] text-slate-700 dark:text-slate-300 leading-relaxed">
              All legal steps cite exact page & section numbers from original legal acts & manuals.
            </p>
          </div>
        </div>

      </div>

      {/* Case Pipeline Popup Modal */}
      <CasePipelineModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        policeCase={selectedCaseForModal}
      />

    </div>
  );
}

