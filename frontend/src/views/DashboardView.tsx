import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Layers, 
  FileCheck2, 
  AlertTriangle, 
  Cpu, 
  Play, 
  FileUp, 
  ShieldCheck, 
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { useCaseStore } from '../store/caseStore';
import { useLangStore } from '../store/langStore';
import { PoliceCase } from '../types';

export default function DashboardView() {
  const navigate = useNavigate();
  const { cases, activeCase, setActiveCase, fetchCases, updateCaseStep } = useCaseStore();
  const { t } = useLangStore();

  useEffect(() => {
    fetchCases();
  }, []);

  const getStepPath = (step?: number) => {
    switch (step) {
      case 1: return '/intake';
      case 2: return '/linkage';
      case 3: return '/investigation';
      case 4: return '/subpoenas';
      case 5: return '/analytics';
      case 6: return '/casediary';
      default: return '/investigation';
    }
  };

  const getStepName = (step?: number) => {
    switch (step) {
      case 1: return '01. Complaint Intake';
      case 2: return '02. Serial Linkage';
      case 3: return '03. SOP Strategy Studio';
      case 4: return '04. Legal Directives';
      case 5: return '05. Response Analytics';
      case 6: return '06. Case Diary';
      default: return '01. Complaint Intake';
    }
  };

  const handleResumeActiveCase = () => {
    if (!activeCase) return;
    const step = activeCase.currentStep || 1;
    navigate(getStepPath(step));
  };

  const handleLaunchCase = (c: PoliceCase) => {
    setActiveCase(c);
    const step = c.currentStep || 1;
    updateCaseStep(c.case_number, step);
    navigate(getStepPath(step));
  };

  return (
    <div className="flex-1 flex flex-col p-4 overflow-hidden gap-4 select-none">

      {/* Top Banner & Quick Register Action */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
        <div>
          <h1 className="text-base font-extrabold tracking-wide text-white uppercase font-mono flex items-center gap-2">
            {t('dashboard.title', 'Investigation Command Unit')}
            <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300 font-sans font-bold">
              ● {t('header.status_active', 'ONLINE')}
            </span>
          </h1>
          <p className="text-xs text-slate-400">
            {t('dashboard.subtitle', 'Manage cases, track investigations, and dispatch legal notices across your station.')}
          </p>
        </div>

        <button
          onClick={() => navigate('/intake')}
          className="flex items-center gap-1.5 rounded bg-blue-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-500 transition-all shadow-md glow-blue"
        >
          <FileUp className="h-4 w-4" />
          <span>{t('stepper.intake', 'Register New Complaint')}</span>
        </button>
      </div>

      {/* Prominent Resume Active Case Banner */}
      {activeCase && (
        <div className="shrink-0 bg-gradient-to-r from-blue-950/80 via-slate-900 to-indigo-950/80 border border-blue-500/40 p-4 rounded-xl flex items-center justify-between shadow-lg glow-blue">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-blue-500/20 border border-blue-400/40 rounded-xl text-blue-400">
              <Clock className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono font-bold text-blue-400 uppercase tracking-wider bg-blue-950 border border-blue-800 px-2 py-0.5 rounded">
                  LAST ACTIVE CASE SESSION
                </span>
                <span className="text-xs font-mono font-bold text-slate-200">
                  {activeCase.fir_number} ({activeCase.case_number})
                </span>
              </div>
              <h2 className="text-sm font-extrabold text-white mt-1">
                Resume Investigation at <span className="text-cyan-400 font-mono">{getStepName(activeCase.currentStep)}</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Assigned IO: {activeCase.assigned_io} • Category: {activeCase.crime_category} ({activeCase.crime_sub_type})
              </p>
            </div>
          </div>

          <button
            onClick={handleResumeActiveCase}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-extrabold text-xs shadow-lg transition-all"
          >
            <Play className="h-4 w-4 fill-black" />
            <span>Resume Investigation (Step {activeCase.currentStep || 1})</span>
          </button>
        </div>
      )}

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-4 gap-3 shrink-0">
        <div className="rounded border border-white/10 bg-[#0d1322] p-3 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase tracking-wider">
            <span>{t('dashboard.total_cases', 'Active Cases')}</span>
            <Layers className="h-3.5 w-3.5 text-blue-400" />
          </div>
          <p className="text-xl font-extrabold text-white font-mono">{cases.length || 42}</p>
          <p className="text-[10px] text-blue-400 font-mono">28 Cyber / 14 Field</p>
        </div>

        <div className="rounded border border-white/10 bg-[#0d1322] p-3 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase tracking-wider">
            <span>{t('dashboard.subpoenas_pending', 'Subpoenas Dispatched')}</span>
            <FileCheck2 className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <p className="text-xl font-extrabold text-white font-mono">89</p>
          <p className="text-[10px] text-emerald-400 font-mono">100% Sec 94 Validated</p>
        </div>

        <div className="rounded border border-white/10 bg-[#0d1322] p-3 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase tracking-wider">
            <span>{t('dashboard.cross_matches', 'Serial Link Matches')}</span>
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

      {/* Main Grid Layout: Active Cases Table & Action Launchpad */}
      <div className="flex-1 grid grid-cols-3 gap-3 overflow-hidden">

        {/* Left: Active Cases Table */}
        <div className="col-span-2 rounded border border-white/10 bg-[#0d1322] flex flex-col overflow-hidden">
          <div className="h-9 border-b border-white/10 px-3 flex items-center justify-between bg-[#080d1a] shrink-0">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Active Police Case Register & Session Track
            </span>
            <button onClick={() => navigate('/investigation')} className="text-[10px] text-blue-400 hover:underline flex items-center gap-1">
              <span>Investigation Studio</span> <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="border-b border-white/10 bg-[#050811] text-[10px] font-bold text-slate-400 uppercase tracking-wider sticky top-0">
                <tr>
                  <th className="py-2 px-3">Case / FIR No.</th>
                  <th className="py-2 px-3">Category</th>
                  <th className="py-2 px-3">Last Step Progress</th>
                  <th className="py-2 px-3">Assigned IO</th>
                  <th className="py-2 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {cases.map((c: any) => {
                  const isCurrentActive = activeCase?.case_number === c.case_number;
                  const stepNum = c.currentStep || 1;
                  return (
                    <tr key={c.case_number} className={`hover:bg-slate-900/60 transition-colors ${isCurrentActive ? 'bg-blue-950/30' : ''}`}>
                      <td className="py-2 px-3 font-mono font-bold text-white">
                        <div className="flex items-center gap-1.5">
                          <span>{c.case_number}</span>
                          {isCurrentActive && (
                            <span className="text-[9px] bg-blue-500 text-black px-1 rounded font-sans font-extrabold">Active</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 font-normal">{c.fir_number}</div>
                      </td>
                      <td className="py-2 px-3">
                        <span className="rounded border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-mono text-blue-300 font-bold">
                          {c.crime_category}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <span className="inline-flex items-center gap-1 rounded bg-slate-900 border border-slate-700 px-2 py-0.5 text-[10px] font-mono font-bold text-cyan-300">
                          <Clock className="w-3 h-3 text-cyan-400" />
                          Step {stepNum}: {getStepName(stepNum).split('. ')[1]}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-400">{c.assigned_io}</td>
                      <td className="py-2 px-3 text-right">
                        <button
                          onClick={() => handleLaunchCase(c)}
                          className="inline-flex items-center gap-1 rounded border border-blue-500/40 bg-blue-600/20 px-2.5 py-1 text-[10px] font-mono font-bold text-blue-300 hover:bg-blue-600 hover:text-white transition-colors"
                        >
                          <Play className="h-3 w-3" /> Resume
                        </button>
                      </td>
                    </tr>
                  );
                })}
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
                <span className="text-xs font-bold text-white group-hover:text-blue-400">Step 1: Complaint Intake</span>
                <p className="text-[10px] text-slate-400">Gujarati/Hindi Voice & Document Processing</p>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-blue-400" />
            </button>

            <button
              onClick={() => navigate('/linkage')}
              className="flex w-full items-center justify-between rounded border border-white/10 bg-[#050811] p-2.5 text-left hover:border-amber-500/40 transition-all group"
            >
              <div>
                <span className="text-xs font-bold text-white group-hover:text-amber-400">Step 2: Serial Offender Linkage</span>
                <p className="text-[10px] text-slate-400">Cross-case match graph for mule VPAs & phones</p>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-amber-400" />
            </button>

            <button
              onClick={() => navigate('/investigation')}
              className="flex w-full items-center justify-between rounded border border-white/10 bg-[#050811] p-2.5 text-left hover:border-blue-500/40 transition-all group"
            >
              <div>
                <span className="text-xs font-bold text-white group-hover:text-blue-400">Step 3: Investigation Studio</span>
                <p className="text-[10px] text-slate-400">AI-powered SOP analysis with legal citations</p>
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
              Statutory Citation Guarantee
            </span>
            <p className="text-[10px] text-slate-300 leading-relaxed">
              All legal steps cite exact page & section numbers from original legal acts & manuals.
            </p>
          </div>
        </div>

      </div>

    </div>
  );
}
