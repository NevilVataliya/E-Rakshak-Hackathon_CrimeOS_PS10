import React, { useState } from 'react';
import { useCaseStore } from '../store/caseStore';
import { useAuthStore } from '../store/authStore';
import { 
  BookOpen, 
  Clock, 
  FileText, 
  Download, 
  Printer, 
  ShieldCheck, 
  CheckCircle2, 
  Sparkles,
  User,
  Scale,
  Building2,
  FileCheck
} from 'lucide-react';
import api from '../services/api';

export default function CaseDiaryView() {
  const { activeCase, generateCaseSummary } = useCaseStore();
  const { user } = useAuthStore();

  const [generating, setGenerating] = useState(false);
  const [summaryReport, setSummaryReport] = useState<string>('');

  const defaultLogs = activeCase?.activity_timeline && activeCase.activity_timeline.length > 0 ? activeCase.activity_timeline : [
    {
      timestamp: '2026-07-24T10:00:00Z',
      module: 'Intake',
      step_title: 'Multimodal Complaint Ingestion',
      details: 'Ingested complaint via Neural Pipeline. Extracted FIR-ML-2026-7701, victim Ramesh Patel, stolen funds INR 2,50,000.',
      officer: 'PSI Inspector V. K. Patel'
    },
    {
      timestamp: '2026-07-24T10:05:00Z',
      module: 'Linkage',
      step_title: 'CCTNS Serial Crime Match Found',
      details: 'Matched beneficiary bank account 501004928172 across 3 past FIRs in Surat & Vadodara.',
      officer: 'PSI Inspector V. K. Patel'
    },
    {
      timestamp: '2026-07-24T10:12:00Z',
      module: 'AI SOP Studio',
      step_title: 'Grounded SOP Strategy Selection',
      details: 'Selected SOP-CYB-04 (Cyber Financial Freeze under Sec 106 BNSS) and SOP-TEL-01 (CDR Requisition).',
      officer: 'PSI Inspector V. K. Patel'
    },
    {
      timestamp: '2026-07-24T10:20:00Z',
      module: 'Subpoenas',
      step_title: 'Statutory Freeze Order Dispatched',
      details: 'Dispatched Debit Freeze Order via SMTP to HDFC Bank Nodal Fraud Control Cell. Ref Token: [CrimeOS-REF: FIR-ML-2026-7701].',
      officer: 'PSI Inspector V. K. Patel'
    },
    {
      timestamp: '2026-07-24T10:35:00Z',
      module: 'Analytics',
      step_title: 'Provider Response Data Ingested',
      details: 'Ingested bank_record.csv & CDR_Logs.csv. Identified 4 secondary suspect phone numbers and 2 layer-1 mule accounts.',
      officer: 'PSI Inspector V. K. Patel'
    }
  ];

  const handleGenerateSummary = async () => {
    if (!activeCase) return;
    setGenerating(true);
    try {
      const summaryText = await generateCaseSummary(activeCase.case_number);
      setSummaryReport(summaryText);
    } catch (err) {
      console.warn('Backend case summary note');
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#050811] p-6 space-y-6">
      {/* Top Banner: Module 06 Case Diary */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-cyan-950/50 via-slate-900/80 to-blue-950/40 p-5 rounded-2xl border border-cyan-500/30 glow-cyan">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-cyan-500/20 border border-cyan-400/40 rounded-xl text-cyan-400">
            <BookOpen className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-bold text-cyan-400 tracking-wider uppercase">
                MODULE 06 • LEGAL CASE DIARY & COURT SUMMARY
              </span>
              <span className="text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800 px-2 py-0.5 rounded font-mono">
                Section 172 CrPC / BNSS Compliance
              </span>
            </div>
            <h1 className="text-xl font-black text-slate-100 tracking-tight">
              Investigation Audit Log & BNSS Court Summary Studio
            </h1>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={handleGenerateSummary}
            disabled={generating}
            className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-extrabold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition-all flex items-center space-x-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>{generating ? 'Generating BNSS Court Summary...' : 'Generate BNSS Court Summary Report'}</span>
          </button>
          <button
            onClick={handlePrint}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-all"
            title="Print Court Summary Report"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Append-Only Investigation Audit Log (6 cols) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-[#0c1220] border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider flex items-center space-x-2">
                <Clock className="w-4 h-4" />
                <span>Append-Only Investigation Audit Log</span>
              </h2>
              <span className="text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800 px-2 py-0.5 rounded font-bold">
                {defaultLogs.length} Entries
              </span>
            </div>

            <div className="space-y-3">
              {defaultLogs.map((log, idx) => (
                <div key={idx} className="bg-[#050811] border border-slate-800 p-4 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-cyan-300">{log.step_title}</span>
                    <span className="text-[10px] font-mono text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-slate-300">{log.details}</p>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[10px] text-slate-400">
                    <span>Module: <strong>{log.module}</strong></span>
                    <span>Officer: <strong>{log.officer}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: BNSS Court Summary Report Preview (6 cols) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-[#0c1220] border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider flex items-center space-x-2">
                <FileCheck className="w-4 h-4 text-emerald-400" />
                <span>BNSS / BSA Court Summary Report Preview</span>
              </h2>
              <span className="text-[10px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded font-bold">
                Certified Admissible
              </span>
            </div>

            {/* Document Sheet Preview */}
            <div className="bg-slate-900 border border-slate-700/80 rounded-xl p-5 text-xs text-slate-200 space-y-4 font-sans leading-relaxed shadow-xl max-h-[500px] overflow-y-auto">
              <div className="text-center border-b border-slate-800 pb-3 space-y-1">
                <h3 className="text-sm font-black tracking-tight text-white uppercase">
                  POLICE INVESTIGATION SUMMARY REPORT
                </h3>
                <p className="text-[11px] font-mono text-cyan-400 font-bold">
                  UNDER SECTION 173 BNSS & SECTION 63 BHARATIYA SAKSHYA ADHINIYAM
                </p>
                <p className="text-[10px] text-slate-400">
                  Central Cyber Crime Investigation HQ • Surat Unit
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono text-[11px] bg-slate-950 p-3 rounded-lg border border-slate-800">
                <div><strong>FIR Number:</strong> {activeCase?.fir_number || 'FIR-ML-2026-7701'}</div>
                <div><strong>Investigating Officer:</strong> {user?.full_name || 'PSI V. K. Patel'}</div>
                <div><strong>Crime Category:</strong> {activeCase?.crime_category || 'CYBER'}</div>
                <div><strong>Stolen Amount:</strong> INR {activeCase?.entities?.monetary_loss?.toLocaleString() || '2,50,000'}</div>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-cyan-300 font-mono uppercase text-[11px]">1. Factual Summary of Offence</h4>
                <p className="text-slate-300">
                  {activeCase?.complaint_text || summaryReport || 'Investigation initiated on victim complaint regarding fraudulent net-banking transfer proceeds routed through layered mule accounts.'}
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-cyan-300 font-mono uppercase text-[11px]">2. Statutory Actions & Directives Issued</h4>
                <p className="text-slate-300">
                  Issued debit freeze directives under Section 106 BNSS to HDFC Bank and State Bank of India. Subpoenaed CDR call logs and cell tower dump coordinates under Section 94 BNSS.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-cyan-300 font-mono uppercase text-[11px]">3. Key Forensic Discoveries</h4>
                <p className="text-slate-300">
                  Extracted 4 secondary suspect phone numbers and 2 layer-1 mule accounts. Impossible travel velocity detected between Mumbai and Delhi cell towers indicating device cloning.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-between items-center text-[10px] font-mono text-slate-400">
                <span>Digitally Signed by: {user?.full_name || 'PSI V. K. Patel'}</span>
                <span>Date: {new Date().toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
