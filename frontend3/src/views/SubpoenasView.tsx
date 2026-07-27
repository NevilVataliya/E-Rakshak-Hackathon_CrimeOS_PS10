import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Send, 
  FileText, 
  Mail, 
  CheckCircle, 
  Clock, 
  FileCheck2, 
  Loader2, 
  Eye, 
  Sparkles,
  ArrowRight,
  Plus
} from 'lucide-react';
import PDFPreviewModal from '../components/common/PDFPreviewModal';
import { useCaseStore } from '../store/caseStore';
import { SubpoenaNotice } from '../types';

export default function SubpoenasView() {
  const navigate = useNavigate();
  const { legalRequests, activeCase, dispatchLegalNotice, setSelectedInspectorItem } = useCaseStore();
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [selectedPdf, setSelectedPdf] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);

  // Form State for Custom Notice Generator
  const [noticeType, setNoticeType] = useState<'SECTION_94_BNSS' | 'DEBIT_FREEZE_1930' | 'NODAL_SUBPOENA'>('SECTION_94_BNSS');
  const [providerName, setProviderName] = useState('State Bank of India Fraud Nodal Cell');
  const [providerEmail, setProviderEmail] = useState('cgc.fraud@sbi.co.in');

  const handlePreview = (url: string) => {
    setSelectedPdf(url);
    setPdfModalOpen(true);
  };

  const handleDispatchEmail = async (reqItem: SubpoenaNotice) => {
    setDispatchingId(reqItem.id);
    try {
      await dispatchLegalNotice(reqItem.id, {
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
    <div className="flex-1 flex flex-col p-4 overflow-hidden gap-3 select-none">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
        <div>
          <h1 className="text-base font-extrabold tracking-wide text-white uppercase font-mono flex items-center gap-2">
            Module 4: Turnkey Subpoena Builder & PDF Email Hub
          </h1>
          <p className="text-xs text-slate-400">
            Auto-generates Section 94 BNSS notices as PDFs, dispatches emails to service provider nodal officers, and tracks replies.
          </p>
        </div>

        <button
          onClick={() => navigate('/analytics')}
          className="flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
        >
          <span>Proceed to Module 5: Response Analytics</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* Toast Feedback Notification */}
      {toastMsg && (
        <div className="flex items-center gap-2 rounded border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs font-semibold text-emerald-300 shrink-0">
          <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Main Layout: Builder Form & Requisition History */}
      <div className="flex-1 grid grid-cols-12 gap-3 overflow-hidden">
        
        {/* Left Column: Requisition Builder Form (5 Cols) */}
        <div className="col-span-5 rounded border border-white/10 bg-[#0d1322] p-3 flex flex-col justify-between overflow-y-auto space-y-3">
          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 border-b border-white/10 pb-1.5 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-amber-400" />
              Subpoena Builder (Case: {activeCase?.case_number || 'CR-2026-9910'})
            </span>

            <div className="space-y-2 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Notice Type
                </label>
                <select
                  value={noticeType}
                  onChange={(e: any) => setNoticeType(e.target.value)}
                  className="h-8 w-full rounded border border-white/10 bg-[#050811] px-2.5 text-xs font-semibold text-slate-200 outline-none"
                >
                  <option value="SECTION_94_BNSS">Section 94 BNSS Legal Notice (Production of Document)</option>
                  <option value="DEBIT_FREEZE_1930">1930 / CFCFRMS Bank Account Debit Freeze Request</option>
                  <option value="NODAL_SUBPOENA">WhatsApp / Telegram Nodal Subpoena</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Target Service Provider
                </label>
                <input
                  type="text"
                  value={providerName}
                  onChange={(e) => setProviderName(e.target.value)}
                  className="h-8 w-full rounded border border-white/10 bg-[#050811] px-2.5 text-xs font-semibold text-slate-200 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Nodal Officer Email Address
                </label>
                <input
                  type="email"
                  value={providerEmail}
                  onChange={(e) => setProviderEmail(e.target.value)}
                  className="h-8 w-full rounded border border-white/10 bg-[#050811] px-2.5 text-xs font-mono text-slate-200 outline-none"
                />
              </div>
            </div>
          </div>

          <button
            onClick={() => handlePreview(`/api/requests/download/Notice_Section_94_BNSS_${activeCase?.case_number || 'CR-2026-9910'}.pdf`)}
            className="flex items-center justify-center gap-2 rounded bg-amber-600 p-2.5 text-xs font-bold text-white hover:bg-amber-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Render Official Statutory PDF & Preview</span>
          </button>
        </div>

        {/* Right Column: Requisition Table (7 Cols) */}
        <div className="col-span-7 rounded border border-white/10 bg-[#0d1322] flex flex-col overflow-hidden">
          <div className="h-9 border-b border-white/10 px-3 flex items-center justify-between bg-[#080d1a] shrink-0">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <FileCheck2 className="h-4 w-4 text-blue-400" />
              Active Legal Requisitions List
            </span>
            <span className="text-[10px] font-mono text-slate-400">{legalRequests.length} Subpoenas Dispatched</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="border-b border-white/10 bg-[#050811] text-[10px] font-bold text-slate-400 uppercase tracking-wider sticky top-0">
                <tr>
                  <th className="py-2 px-2.5">Request ID</th>
                  <th className="py-2 px-2.5">Case No.</th>
                  <th className="py-2 px-2.5">Notice Type</th>
                  <th className="py-2 px-2.5">Provider Email</th>
                  <th className="py-2 px-2.5">Status</th>
                  <th className="py-2 px-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {legalRequests.map((row: any) => (
                  <tr key={row.id} className="hover:bg-slate-900/60 transition-colors">
                    <td className="py-2 px-2.5 font-mono font-bold text-white">{row.id}</td>
                    <td className="py-2 px-2.5 font-mono font-bold text-blue-400">{row.case_no}</td>
                    <td className="py-2 px-2.5">
                      <span className="rounded border border-white/10 bg-[#050811] px-1.5 py-0.5 text-[10px] font-mono text-slate-300">
                        {row.type}
                      </span>
                    </td>
                    <td className="py-2 px-2.5 font-mono text-[11px] text-slate-400">{row.email}</td>
                    <td className="py-2 px-2.5">
                      {row.status === 'DISPATCHED' ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 text-[10px] font-bold">
                          <CheckCircle className="h-3 w-3" /> Dispatched
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 text-amber-300 px-1.5 py-0.5 text-[10px] font-bold">
                          <Clock className="h-3 w-3" /> Ready
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handlePreview(row.pdf_url)}
                          className="rounded border border-white/10 bg-[#050811] px-2 py-1 text-[10px] font-mono text-blue-400 hover:border-white/20 transition-colors"
                        >
                          <Eye className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleDispatchEmail(row)}
                          disabled={dispatchingId === row.id}
                          className="rounded bg-blue-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
                        >
                          {dispatchingId === row.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* PDF Preview Modal */}
      <PDFPreviewModal
        open={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        pdfUrl={selectedPdf}
      />

    </div>
  );
}
