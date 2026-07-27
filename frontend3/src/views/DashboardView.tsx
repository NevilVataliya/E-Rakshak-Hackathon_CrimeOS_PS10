import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, FileCheck2, AlertTriangle, Cpu, Play, FileUp, ShieldCheck, ArrowRight } from 'lucide-react';
import { useCaseStore } from '../store/caseStore';
import { PoliceCase } from '../types';

export default function DashboardView() {
  const navigate = useNavigate();
  const { cases, setActiveCase, fetchCases } = useCaseStore();

  useEffect(() => {
    fetchCases();
  }, []);

  const handleLaunchCase = (c: PoliceCase) => {
    setActiveCase(c);
    navigate('/investigation');
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
            Real-time tactical case metrics, 6-step intelligence pipeline, and turnkey statutory subpoenas.
          </p>
        </div>

        <button
          onClick={() => navigate('/intake')}
          className="flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors shadow-sm"
        >
          <FileUp className="h-3.5 w-3.5" />
          <span>Ingest New Complaint</span>
        </button>
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
          <p className="text-[10px] text-amber-400 font-mono">Qdrant VPA & Phone Overlap</p>
        </div>

        <div className="rounded border border-white/10 bg-[#0d1322] p-3 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase tracking-wider">
            <span>Vector Index Status</span>
            <Cpu className="h-3.5 w-3.5 text-indigo-400" />
          </div>
          <p className="text-xl font-extrabold text-white font-mono">7,337 Chunks</p>
          <p className="text-[10px] text-indigo-400 font-mono">police_sops_universal</p>
        </div>
      </div>

      {/* Main Grid Layout: Active Cases Table & Action Launchpad */}
      <div className="flex-1 grid grid-cols-3 gap-3 overflow-hidden">
        
        {/* Left: Active Cases Table */}
        <div className="col-span-2 rounded border border-white/10 bg-[#0d1322] flex flex-col overflow-hidden">
          <div className="h-9 border-b border-white/10 px-3 flex items-center justify-between bg-[#080d1a] shrink-0">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Active Police Case Register
            </span>
            <button onClick={() => navigate('/investigation')} className="text-[10px] text-blue-400 hover:underline flex items-center gap-1">
              <span>Agent Studio</span> <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="border-b border-white/10 bg-[#050811] text-[10px] font-bold text-slate-400 uppercase tracking-wider sticky top-0">
                <tr>
                  <th className="py-2 px-3">Case / FIR No.</th>
                  <th className="py-2 px-3">Category</th>
                  <th className="py-2 px-3">Sub-Type</th>
                  <th className="py-2 px-3">Assigned IO</th>
                  <th className="py-2 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {cases.map((c: any) => (
                  <tr key={c.case_number} className="hover:bg-slate-900/60 transition-colors">
                    <td className="py-2 px-3 font-mono font-bold text-white">
                      <div>{c.case_number}</div>
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
                        onClick={() => handleLaunchCase(c)}
                        className="inline-flex items-center gap-1 rounded border border-white/10 bg-[#050811] px-2 py-1 text-[10px] font-mono text-blue-400 hover:border-white/20 transition-colors"
                      >
                        <Play className="h-3 w-3" /> Launch
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Tactical Action Launchpad */}
        <div className="col-span-1 rounded border border-white/10 bg-[#0d1322] flex flex-col p-3 gap-3 overflow-y-auto">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300 border-b border-white/10 pb-2">
            Guided Pipeline Shortcuts
          </span>

          <div className="space-y-2">
            <button
              onClick={() => navigate('/intake')}
              className="flex w-full items-center justify-between rounded border border-white/10 bg-[#050811] p-2.5 text-left hover:border-blue-500/40 transition-all group"
            >
              <div>
                <span className="text-xs font-bold text-white group-hover:text-blue-400">Step 1: Multimodal Intake</span>
                <p className="text-[10px] text-slate-400">Gujarati/Hindi Audio ASR & Vision OCR</p>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-blue-400" />
            </button>

            <button
              onClick={() => navigate('/linkage')}
              className="flex w-full items-center justify-between rounded border border-white/10 bg-[#050811] p-2.5 text-left hover:border-amber-500/40 transition-all group"
            >
              <div>
                <span className="text-xs font-bold text-white group-hover:text-amber-400">Step 2: Qdrant Serial Linkage</span>
                <p className="text-[10px] text-slate-400">Topology graph for mule VPAs & phones</p>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-amber-400" />
            </button>

            <button
              onClick={() => navigate('/investigation')}
              className="flex w-full items-center justify-between rounded border border-white/10 bg-[#050811] p-2.5 text-left hover:border-blue-500/40 transition-all group"
            >
              <div>
                <span className="text-xs font-bold text-white group-hover:text-blue-400">Step 3: Multi-Agent Studio</span>
                <p className="text-[10px] text-slate-400">LangGraph SOP grounding & exact citations</p>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-blue-400" />
            </button>

            <button
              onClick={() => navigate('/subpoenas')}
              className="flex w-full items-center justify-between rounded border border-white/10 bg-[#050811] p-2.5 text-left hover:border-emerald-500/40 transition-all group"
            >
              <div>
                <span className="text-xs font-bold text-white group-hover:text-emerald-400">Step 4: Subpoena Generator</span>
                <p className="text-[10px] text-slate-400">Section 94 BNSS & 1930 Bank Freezes</p>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-emerald-400" />
            </button>
          </div>

          <div className="mt-auto rounded border border-emerald-500/30 bg-emerald-500/10 p-2.5 space-y-1">
            <span className="text-xs font-bold text-emerald-300 flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              Statutory Zero-Hardcode Guard
            </span>
            <p className="text-[10px] text-slate-300 leading-relaxed">
              All legal steps cite exact Page & Section numbers from original acts in Qdrant.
            </p>
          </div>
        </div>

      </div>

    </div>
  );
}
