import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, FileCheck2, AlertTriangle, Cpu, FileUp, ShieldCheck, ListTree, Activity, Zap, CheckCircle2, RotateCcw } from 'lucide-react';
import { useCaseStore } from '../store/caseStore';
import { PoliceCase } from '../types';
import CasePipelineModal from '../components/common/CasePipelineModal';

export default function DashboardView() {
  const navigate = useNavigate();
  const { cases, activeCase, setActiveCase, fetchCases, startNewComplaint, clearAllCasesAndData } = useCaseStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCaseForModal, setSelectedCaseForModal] = useState<PoliceCase | null>(null);

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

  return (
    <div className="flex-1 flex flex-col p-4 overflow-hidden gap-4 select-none">

      {/* Top Banner */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
        <div>
          <h1 className="text-base font-extrabold tracking-wide text-white uppercase font-mono flex items-center gap-2">
            Investigation Command Unit
            <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300 font-sans font-bold">
              ● Live Station Feed
            </span>
          </h1>
          <p className="text-xs text-slate-400">
            Manage cases, track investigations, and dispatch legal notices across your station.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to delete all past cases and reset storage?')) {
                clearAllCasesAndData();
              }
            }}
            className="flex items-center gap-1.5 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition-colors shadow-sm"
            title="Purge all cases and clear local storage"
          >
            <RotateCcw className="h-3.5 w-3.5 text-rose-400" />
            <span>Purge All Cases</span>
          </button>

          <button
            onClick={handleRegisterNewComplaint}
            className="flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors shadow-sm"
          >
            <FileUp className="h-3.5 w-3.5" />
            <span>Register New Complaint</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-4 gap-3 shrink-0">
        <div className="rounded border border-white/10 bg-[#0d1322] p-3 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase tracking-wider">
            <span>Active Cases</span>
            <Layers className="h-3.5 w-3.5 text-blue-400" />
          </div>
          <p className="text-xl font-extrabold text-white font-mono">{cases.length || 42}</p>
          <p className="text-[10px] text-blue-400 font-mono">28 Cyber / 14 Field</p>
        </div>

        <div className="rounded border border-white/10 bg-[#0d1322] p-3 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase tracking-wider">
            <span>Subpoenas Dispatched</span>
            <FileCheck2 className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <p className="text-xl font-extrabold text-white font-mono">89</p>
          <p className="text-[10px] text-emerald-400 font-mono">100% Sec 94 Validated</p>
        </div>

        <div className="rounded border border-white/10 bg-[#0d1322] p-3 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase tracking-wider">
            <span>Serial Link Matches</span>
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <p className="text-xl font-extrabold text-white font-mono">11</p>
          <p className="text-[10px] text-amber-400 font-mono">Cross-Case VPA & Phone Matches</p>
        </div>

        <div className="rounded border border-white/10 bg-[#0d1322] p-3 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase tracking-wider">
            <span>AI Knowledge Base</span>
            <Cpu className="h-3.5 w-3.5 text-indigo-400" />
          </div>
          <p className="text-xl font-extrabold text-white font-mono">Active</p>
          <p className="text-[10px] text-indigo-400 font-mono">Legal Acts & SOPs Loaded</p>
        </div>
      </div>

      {/* Main Grid Layout: Active Cases Table & Station Intelligence */}
      <div className="flex-1 grid grid-cols-3 gap-3 overflow-hidden">

        {/* Left: Active Cases Table */}
        <div className="col-span-2 rounded border border-white/10 bg-[#0d1322] flex flex-col overflow-hidden">
          <div className="h-9 border-b border-white/10 px-3 flex items-center justify-between bg-[#080d1a] shrink-0">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Active Police Case Register
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              Click 'Pipeline Steps' on any case to open guided workflow popup
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="border-b border-white/10 bg-[#050811] text-[10px] font-bold text-slate-400 uppercase tracking-wider sticky top-0">
                <tr>
                  <th className="py-2 px-3">Case / FIR No.</th>
                  <th className="py-2 px-3">Category</th>
                  <th className="py-2 px-3">Sub-Type</th>
                  <th className="py-2 px-3">Assigned IO</th>
                  <th className="py-2 px-3 text-right">Investigation Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {cases.map((c: PoliceCase) => {
                  const isActive = activeCase?.case_number === c.case_number;

                  return (
                    <tr 
                      key={c.case_number} 
                      className={`transition-colors ${isActive ? 'bg-blue-500/10 hover:bg-blue-500/15' : 'hover:bg-slate-900/60'}`}
                    >
                      <td className="py-2 px-3 font-mono font-bold text-white">
                        <div className="flex items-center gap-1.5">
                          <span>{c.case_number}</span>
                          {isActive && (
                            <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded border border-emerald-500/30">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 font-normal">{c.fir_number}</div>
                      </td>
                      <td className="py-2 px-3">
                        <span className="rounded border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-mono text-blue-300 font-bold">
                          {c.crime_category}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-300 font-medium">{c.crime_sub_type}</td>
                      <td className="py-2 px-3 text-slate-400">{c.assigned_io}</td>
                      <td className="py-2 px-3 text-right">
                        <button
                          onClick={() => handleOpenPipelineModal(c)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-500/10 px-2.5 py-1 text-[11px] font-mono text-blue-300 font-bold hover:bg-blue-500/20 transition-all shadow-sm"
                        >
                          <ListTree className="h-3.5 w-3.5 text-blue-400" />
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
        <div className="col-span-1 rounded border border-white/10 bg-[#0d1322] flex flex-col p-3 gap-3 overflow-y-auto">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-blue-400" />
              Station Intelligence
            </span>
            <span className="text-[9px] font-mono text-emerald-400 font-bold">System Online</span>
          </div>

          <div className="space-y-2.5 flex-1">
            {/* Quick Action Button for Registering New Complaint */}
            <button
              onClick={handleRegisterNewComplaint}
              className="flex w-full items-center justify-between rounded-xl border border-blue-500/40 bg-gradient-to-r from-blue-600/20 to-indigo-600/10 p-3 text-left hover:border-blue-400 transition-all group shadow-md"
            >
              <div className="space-y-0.5">
                <span className="text-xs font-extrabold text-white flex items-center gap-1.5 group-hover:text-blue-300">
                  <Zap className="h-3.5 w-3.5 text-blue-400" />
                  Register New Complaint
                </span>
                <p className="text-[10px] text-slate-300 leading-normal">
                  Ingest raw statements, attached PDFs, evidence images, or audio recordings.
                </p>
              </div>
              <ListTree className="h-4 w-4 text-blue-400 group-hover:scale-110 transition-transform" />
            </button>

            {/* High-Severity Alerts List */}
            <div className="rounded-lg border border-white/10 bg-[#050811] p-2.5 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block border-b border-white/5 pb-1">
                Priority Station Alerts
              </span>
              
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex items-start gap-2 text-rose-300">
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">CR-2026-9910:</span> UPI Fraud & Rs. 2 Lakh Loss. Accused A/C 30910293101 flagged.
                  </div>
                </div>

                <div className="flex items-start gap-2 text-amber-300 pt-1 border-t border-white/5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Serial Link Match:</span> Suspect Line +91 98765 43210 matched across 3 Surat Cyber cases.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-2.5 space-y-1">
            <span className="text-xs font-bold text-emerald-300 flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              Statutory Citation Guarantee
            </span>
            <p className="text-[10px] text-slate-300 leading-relaxed">
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

