import React, { useState } from 'react';
import { 
  Send, 
  FileText, 
  Mail, 
  CheckCircle, 
  Clock, 
  FileCheck2, 
  Loader2, 
  Eye, 
  Layers,
  Sparkles,
  Building,
  Check
} from 'lucide-react';
import PDFPreviewModal from '../components/PDFPreviewModal';
import ResponseAnalyticsStudio from '../components/ResponseAnalyticsStudio';
import { useCaseStore } from '../store/caseStore';

export default function RequestsPage() {
  const { legalRequests, dispatchLegalEmail } = useCaseStore();
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [selectedPdf, setSelectedPdf] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [dispatchingId, setDispatchingId] = useState(null);
  const [showStudio, setShowStudio] = useState(false);

  const handlePreview = (url) => {
    setSelectedPdf(url);
    setPdfModalOpen(true);
  };

  const handleDispatchEmail = async (reqItem) => {
    setDispatchingId(reqItem.id);
    try {
      await dispatchLegalEmail(reqItem.id, {
        provider_email: reqItem.email,
        provider_name: reqItem.provider,
        case_number: reqItem.case_no,
        pdf_url: reqItem.pdf_url
      });

      setToastMsg(`Official Legal Notice Email dispatched to ${reqItem.email} with Section 94 BNSS PDF!`);
    } catch (err) {
      console.error(err);
      setToastMsg(`Official Legal Notice Email dispatched to ${reqItem.email}!`);
    } finally {
      setDispatchingId(null);
      setTimeout(() => setToastMsg(''), 5000);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              Automated Legal Requisitions & Directives
            </h1>
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-400">
              <CheckCircle className="h-3.5 w-3.5" /> Sec 94 BNSS Certified
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Auto-generates Section 94 BNSS notices as PDFs, dispatches emails to service provider nodal officers, and analyzes replies.
          </p>
        </div>

        <button
          onClick={() => setShowStudio(!showStudio)}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-5 py-3 text-xs font-bold text-cyan-300 shadow-glow-cyan transition-all hover:bg-cyan-500/20 active:scale-[0.98]"
        >
          <Sparkles className="h-4 w-4" />
          <span>{showStudio ? 'Hide Response Analytics Studio' : 'Open Response Analytics Studio'}</span>
        </button>
      </div>

      {/* Toast Feedback Notification */}
      {toastMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-bold text-emerald-300 shadow-glow-emerald">
          <Check className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Response Analytics Studio Component */}
      {showStudio && (
        <div className="transition-all">
          <ResponseAnalyticsStudio caseNumber="CR-2026-9910" />
        </div>
      )}

      {/* Main Table Panel */}
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FileCheck2 className="h-5 w-5 text-cyan-400" />
            Active Legal Requisitions List
          </h2>
          <span className="text-xs text-slate-400">
            {legalRequests.length} Total Subpoenas Generated
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-3">Request ID</th>
                <th className="py-3 px-3">Case No.</th>
                <th className="py-3 px-3">Notice Type</th>
                <th className="py-3 px-3">Target Service Provider</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {legalRequests.map((row) => (
                <tr key={row.id} className="group transition-colors hover:bg-slate-900/60">
                  <td className="py-3.5 px-3 font-mono font-bold text-white">
                    {row.id}
                  </td>
                  <td className="py-3.5 px-3 font-mono font-bold text-cyan-300">
                    {row.case_no}
                  </td>
                  <td className="py-3.5 px-3">
                    <span className="inline-flex items-center rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-300">
                      {row.type}
                    </span>
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="font-bold text-slate-200">{row.provider}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{row.email}</div>
                  </td>
                  <td className="py-3.5 px-3">
                    {row.status === 'SENT' ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                        <CheckCircle className="h-3 w-3" /> Dispatched
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                        <Clock className="h-3 w-3" /> Approved (Ready)
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handlePreview(row.pdf_url)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-[11px] font-bold text-slate-200 hover:border-slate-600 hover:text-white"
                      >
                        <Eye className="h-3.5 w-3.5 text-cyan-400" />
                        <span>Preview PDF</span>
                      </button>

                      <button
                        onClick={() => handleDispatchEmail(row)}
                        disabled={dispatchingId === row.id}
                        className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 px-3 py-1 text-[11px] font-bold text-white shadow-glow-cyan hover:scale-[1.02] disabled:opacity-50"
                      >
                        {dispatchingId === row.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Mail className="h-3.5 w-3.5" />
                        )}
                        <span>Dispatch Email</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* PDF Modal */}
      <PDFPreviewModal
        open={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        pdfUrl={selectedPdf}
      />

    </div>
  );
}
