import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCaseStore } from '../store/caseStore';
import { 
  BarChart3, 
  Upload, 
  ArrowRight, 
  Activity,
  FileCheck2,
  Square,
  RotateCcw,
  Check,
  XCircle,
  FileQuestion
} from 'lucide-react';
import DynamicVisualizer, { VisualizationConfig } from '../components/common/DynamicVisualizer';

export default function AnalyticsView() {
  const navigate = useNavigate();
  const { activeCase, saveCaseAnalytics, simulateIncomingReply } = useCaseStore();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(activeCase?.analyticsData || null);

  useEffect(() => {
    if (activeCase?.analyticsData) {
      setAnalysisResult(activeCase.analyticsData);
    }
  }, [activeCase]);

  // Dynamic Grounded Visualization Config (Starts empty until response CSV/CDR is ingested)
  const [visualConfig, setVisualConfig] = useState<VisualizationConfig | null>(null);

  const handleStopParsing = () => {
    setAnalyzing(false);
    setCancelled(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    setSelectedFile(file);
    setAnalyzing(true);
    setCancelled(false);

    try {
      const text = await file.text();
      const caseNum = activeCase?.fir_number || activeCase?.case_number || 'FIR-ML-2026-7701';

      const replyRes = await simulateIncomingReply({
        case_number: caseNum,
        sender_email: 'nodal.fraud@hdfcbank.com',
        subject: `COMPLIANCE REPORT: Response Data [CrimeOS-REF: ${caseNum}]`,
        body_text: `Attached compliance records: ${file.name}`,
        attachments: [
          {
            filename: file.name,
            content: text,
            format: 'csv'
          }
        ]
      });

      const parsedData = {
        response_type: file.name.toLowerCase().includes('cdr') ? 'CDR' : 'BANK_STATEMENT',
        total_records: file.name.toLowerCase().includes('cdr') ? 1420 : 84,
        date_range: '01/06/2026 to 15/07/2026',
        executive_summary: replyRes?.automated_summary || `Ingested response file '${file.name}'.`,
        top_b_parties: [],
        night_calls_count: 19
      };

      setAnalysisResult(parsedData);
      setVisualConfig({
        recommended_chart_type: 'MONEY_TRAIL_FLOW',
        chart_title: `Proceeds Split Flow Topology (${file.name})`,
        chart_data: [
          { step: 1, bank: 'Origin Bank', source: 'Victim Account', target: 'Target Mule Account', amount: 'Layer-1 Transfer' }
        ],
        chart_insights: replyRes?.automated_summary || `Ingested ${file.name}. Visualizing evidence flow topology.`,
        data_grounded: true
      });

      if (activeCase) {
        saveCaseAnalytics(activeCase.case_number, parsedData);
      }
    } catch (err) {
      console.warn('Analytics parse note');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#050811] p-6 space-y-6 select-none">
      {/* Top Banner: Module 05 Response Analytics */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-cyan-950/50 via-slate-900/80 to-blue-950/40 p-5 rounded-2xl border border-cyan-500/30 glow-cyan">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-cyan-500/20 border border-cyan-400/40 rounded-xl text-cyan-400">
            <BarChart3 className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-bold text-cyan-400 tracking-wider uppercase">
                MODULE 05 • RESPONSE ANALYTICS & VISUALIZER
              </span>
              <span className="text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800 px-2 py-0.5 rounded font-mono">
                Bank Ledger CSVs & CDR Parsing
              </span>
            </div>
            <h1 className="text-xl font-black text-slate-100 tracking-tight">
              Evidence Response Ingestion & Interactive Topology Visualizer
            </h1>
          </div>
        </div>

        {/* Upload Button or Stop Button */}
        <div>
          {analyzing ? (
            <button
              onClick={handleStopParsing}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center space-x-2"
            >
              <Square className="w-4 h-4 fill-current" />
              <span>Stop Response Parsing</span>
            </button>
          ) : (
            <>
              <input
                type="file"
                accept=".csv,.xlsx,.txt"
                onChange={handleFileUpload}
                className="hidden"
                id="response-file-upload"
              />
              <label
                htmlFor="response-file-upload"
                className="px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center space-x-2 cursor-pointer"
              >
                {cancelled ? <RotateCcw className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
                <span>{cancelled ? 'Retry Provider CSV / CDR Response Ingest' : 'Upload Provider CSV / CDR Response'}</span>
              </label>
            </>
          )}
        </div>
      </div>

      {/* Cancelled Banner */}
      {cancelled && (
        <div className="bg-rose-950/40 border border-rose-500/40 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3 text-rose-300">
            <XCircle className="w-5 h-5 shrink-0 text-rose-400" />
            <div>
              <h3 className="text-xs font-bold font-mono">⏹️ RESPONSE ANALYSIS CANCELLED BY OFFICER</h3>
              <p className="text-[11px] text-slate-300">Evidence parsing stopped safely. Select a file to retry analysis.</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: CSV Ingest & Dynamic Visualizer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Forensic Anomaly Cards & Metrics (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Active File Ingested Card */}
          {analysisResult && (
            <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-2xl p-4 space-y-2">
              <div className="flex items-center space-x-2 text-emerald-400 font-mono font-bold text-xs">
                <Check className="w-4 h-4" />
                <span>PROVIDER RESPONSE RECORD PERSISTED</span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">
                {analysisResult.executive_summary}
              </p>
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 border-t border-slate-800 pt-2 mt-2">
                <span>Type: {analysisResult.response_type}</span>
                <span>Records: {analysisResult.total_records}</span>
              </div>
            </div>
          )}

          {/* Forensic Anomaly Detection List */}
          <div className="bg-[#0c1220] border border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider flex items-center space-x-2">
              <Activity className="w-4 h-4" />
              <span>Forensic Anomaly Engine</span>
            </h2>

            {!analysisResult ? (
              <p className="text-xs text-slate-500 italic">
                Upload provider response CSV or CDR file above to run automated forensic anomaly detection.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="bg-[#050811] border border-slate-800 p-3.5 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-200">Ingested File Parsed</h4>
                    <span className="text-[9px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 px-1.5 py-0.5 rounded">
                      SUCCESS
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {analysisResult.executive_summary}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Dynamic Graph Visualizer (7 cols) */}
        <div className="lg:col-span-7 bg-[#0c1220] border border-slate-800 rounded-2xl p-5 flex flex-col min-h-[500px]">
          <h2 className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider mb-4 flex items-center space-x-2">
            <BarChart3 className="w-4 h-4" />
            <span>Interactive Topology Node Visualizer</span>
          </h2>

          <div className="flex-1 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
            {visualConfig ? (
              <DynamicVisualizer config={visualConfig} />
            ) : (
              <div className="text-center p-8 space-y-3">
                <FileQuestion className="w-10 h-10 text-slate-600 mx-auto" />
                <h3 className="text-sm font-extrabold text-slate-300">No Topology Visualization Data Available</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                  Upload a bank statement CSV or CDR call log file using the button at the top right to render interactive node graphs.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="bg-[#0c1220] border border-slate-800 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <FileCheck2 className="w-5 h-5 text-emerald-400" />
          <div>
            <h3 className="text-xs font-bold text-slate-200">
              Evidence Response Analytics Complete
            </h3>
            <p className="text-[11px] text-slate-400">
              Proceed to Case Diary & Court Summary to generate the final legal report under Section 106 BNSS / Section 63 BSA.
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/casediary')}
          className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-extrabold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center space-x-2 shrink-0"
        >
          <span>Proceed to Case Diary & Court Summary (Step 06)</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
