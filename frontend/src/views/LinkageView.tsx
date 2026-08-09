import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCaseStore } from '../store/caseStore';
import { 
  Network, 
  Search, 
  ShieldAlert, 
  Database, 
  Building2, 
  Phone, 
  CreditCard, 
  ArrowRight,
  Square,
  RotateCcw,
  XCircle,
  FileQuestion
} from 'lucide-react';

export default function LinkageView() {
  const navigate = useNavigate();
  const { activeCase, linkageMatches, runLinkageSearch } = useCaseStore();

  const [searching, setSearching] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);

  useEffect(() => {
    if (activeCase && linkageMatches.length === 0) {
      handleSearchLinkage();
    }
  }, [activeCase]);

  const handleStopSearch = () => {
    setSearching(false);
    setCancelled(true);
  };

  const handleSearchLinkage = async () => {
    if (!activeCase) return;
    setSearching(true);
    setCancelled(false);
    try {
      await runLinkageSearch(activeCase.case_number, activeCase.entities);
    } catch (err) {
      console.warn('Backend linkage API note');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#050811] p-6 space-y-6 select-none">
      {/* Top Banner: Module 02 Linkage */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-amber-950/40 via-slate-900/80 to-blue-950/40 p-5 rounded-2xl border border-amber-500/30 glow-amber">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-amber-500/20 border border-amber-400/40 rounded-xl text-amber-400">
            <Network className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-bold text-amber-400 tracking-wider uppercase">
                MODULE 02 • SERIAL CRIME INTELLIGENCE & LINKAGE
              </span>
              <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded font-mono">
                Cross-Case VPA & Phone Network
              </span>
            </div>
            <h1 className="text-xl font-black text-slate-100 tracking-tight">
              Cross-FIR Suspect Recurrence & Mule Network Match Matrix
            </h1>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-3 shrink-0">
          {searching ? (
            <button
              onClick={handleStopSearch}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-extrabold transition-all flex items-center space-x-2 shadow-lg"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop Search</span>
            </button>
          ) : (
            <button
              onClick={handleSearchLinkage}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition-all flex items-center space-x-2"
            >
              {cancelled ? <RotateCcw className="w-3.5 h-3.5" /> : <Search className="w-3.5 h-3.5" />}
              <span>{cancelled ? 'Retry Linkage Search' : 'Run Linkage Graph'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Cancelled Banner */}
      {cancelled && (
        <div className="bg-rose-950/40 border border-rose-500/40 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3 text-rose-300">
            <XCircle className="w-5 h-5 shrink-0 text-rose-400" />
            <div>
              <h3 className="text-xs font-bold font-mono">⏹️ LINKAGE SEARCH CANCELLED BY OFFICER</h3>
              <p className="text-[11px] text-slate-300">Cross-case graph search stopped. Click retry to run intelligence matching.</p>
            </div>
          </div>

          <button
            onClick={handleSearchLinkage}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold font-mono transition-all flex items-center space-x-1.5 shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry Linkage Search</span>
          </button>
        </div>
      )}

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Linkage Matches Cards (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h2 className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider flex items-center space-x-2">
              <Database className="w-4 h-4" />
              <span>Cross-Case Intelligence Matches ({linkageMatches.length})</span>
            </h2>
            <span className="text-[11px] text-slate-400 font-mono">
              FIR Reference: {activeCase?.fir_number || 'No FIR Loaded'}
            </span>
          </div>

          {linkageMatches.length === 0 ? (
            <div className="bg-[#0c1220] border border-slate-800 rounded-2xl p-8 text-center space-y-3">
              <FileQuestion className="w-10 h-10 text-slate-600 mx-auto" />
              <h3 className="text-sm font-extrabold text-slate-300">No Cross-Case Matches Identified Yet</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Click <strong>"Run Linkage Graph"</strong> above to search cross-case databases for recurring suspect phone lines, UPI IDs, or mule bank accounts.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {linkageMatches.map((m: any, idx: number) => (
                <div
                  key={idx}
                  onClick={() => setSelectedMatch(m)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-3 ${
                    selectedMatch?.entity_value === m.entity_value
                      ? 'bg-amber-950/30 border-amber-500/60 shadow-lg glow-amber'
                      : 'bg-[#0c1220] border-slate-800 hover:border-amber-500/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      {m.entity_type === 'bank_account' ? (
                        <CreditCard className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Phone className="w-4 h-4 text-sky-400" />
                      )}
                      <span className="font-mono font-bold text-cyan-300 text-sm">{m.entity_value}</span>
                      <span className="text-[10px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded">
                        {m.match_type}
                      </span>
                    </div>

                    <span className="text-xs font-mono font-extrabold text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded">
                      {m.confidence}% Match
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    {m.description}
                  </p>

                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 border-t border-slate-800/80 pt-2.5">
                    <span className="flex items-center space-x-1">
                      <Building2 className="w-3.5 h-3.5 text-slate-500" />
                      <span>Station: {m.police_station}</span>
                    </span>
                    <span className="text-amber-400 font-semibold">{m.matched_fir}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Recommended Action & Case Strategy (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-[#0c1220] border border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4" />
              <span>Linkage Analysis & Action Recommendation</span>
            </h2>

            {selectedMatch ? (
              <div className="bg-[#050811] p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="text-xs font-mono font-bold text-cyan-300">
                  Target: {selectedMatch.entity_value}
                </div>
                <div className="text-xs text-slate-300">
                  <strong>Recommended Directive:</strong> {selectedMatch.recommended_action}
                </div>
                <button
                  onClick={() => navigate('/investigation')}
                  className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-black font-extrabold text-xs rounded-xl transition-all flex items-center justify-center space-x-2"
                >
                  <span>Proceed to Investigation Studio (Step 03)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-400 leading-relaxed">
                Select any cross-case match card on the left to inspect target details and launch recommended legal directives.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
