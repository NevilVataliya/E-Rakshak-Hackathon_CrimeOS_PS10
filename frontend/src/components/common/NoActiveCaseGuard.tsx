import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Plus, FolderSearch, ArrowRight } from 'lucide-react';
import { useCaseStore } from '../../store/caseStore';

interface Props {
  moduleName: string;
  description: string;
}

export default function NoActiveCaseGuard({ moduleName, description }: Props) {
  const navigate = useNavigate();
  const { cases, setActiveCase } = useCaseStore();

  return (
    <div className="h-full w-full flex flex-col items-center justify-center p-6 bg-[#050811] text-center select-none">
      <div className="max-w-md rounded-xl border border-amber-500/30 bg-[#0d1322] p-6 shadow-2xl space-y-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 mx-auto border border-amber-500/40">
          <ShieldAlert className="h-6 w-6" />
        </div>

        <div className="space-y-1">
          <h3 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono">
            Active Case Required for {moduleName}
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            {description}
          </p>
        </div>

        {/* Active Case Selector directly inside the guard */}
        {cases.length > 0 && (
          <div className="pt-2 border-t border-white/10 space-y-1.5 text-left">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Select an Existing Active Case:
            </label>
            <select
              onChange={(e) => {
                const found = cases.find((c: any) => c.case_number === e.target.value);
                if (found) setActiveCase(found);
              }}
              className="w-full h-8 rounded border border-blue-500/40 bg-[#050811] px-2.5 text-xs font-mono text-cyan-300 font-bold outline-none"
            >
              <option value="">-- Choose Case from Database --</option>
              {cases.map((c: any) => (
                <option key={c.case_number} value={c.case_number}>
                  {c.case_number} — {c.crime_sub_type || c.crime_category}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="pt-2 flex items-center justify-center gap-2">
          <button
            onClick={() => navigate('/intake')}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Ingest New Complaint (Module 1)</span>
          </button>

          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#050811] px-3.5 py-2 text-xs font-bold text-slate-300 hover:text-white hover:border-white/20 transition-colors"
          >
            <FolderSearch className="h-4 w-4 text-amber-400" />
            <span>Dashboard</span>
          </button>
        </div>
      </div>
    </div>
  );
}
