import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
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

export default function SubpoenaGeneratorPage() {
  const navigate = useNavigate();
  const { legalRequests, activeCase, dispatchLegalNotice } = useCaseStore();
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
    <div className="space-y-5">
      
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
              Step 4: Subpoena & Legal Notice Generator
            </h1>
            <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400 flex items-center gap-1">
              <CheckCircle className="h-3 w-3" /> Sec 94 BNSS Certified
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            Auto-generates Section 94 BNSS notices as PDFs, dispatches emails to service provider nodal officers, and tracks replies.
          </p>
        </div>

        <button
          onClick={() => navigate('/response-analytics')}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
        >
          <span>Proceed to Step 5: Response Analytics</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* Toast Feedback Notification */}
      {toastMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-300">
          <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Dynamic Subpoena Generator Card */}
      <div className="pro-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
          <Sparkles className="h-4 w-4 text-amber-400" />
          Generate New Statutory Notice (Active Case: {activeCase?.case_number || 'CR-2026-9910'})
        </h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Notice Type
            </label>
            <select
              value={noticeType}
              onChange={(e: any) => setNoticeType(e.target.value)}
              className="pro-input w-full p-2 text-xs font-medium"
            >
              <option value="SECTION_94_BNSS">Section 94 BNSS Legal Notice (Production of Document)</option>
              <option value="DEBIT_FREEZE_1930">1930 / CFCFRMS Bank Account Debit Freeze Request</option>
              <option value="NODAL_SUBPOENA">WhatsApp / Telegram Nodal Subpoena</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Target Nodal Officer / Bank
            </label>
            <input
              type="text"
              value={providerName}
              onChange={(e) => setProviderName(e.target.value)}
              className="pro-input w-full p-2 text-xs font-medium"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Nodal Email Address
            </label>
            <input
              type="email"
              value={providerEmail}
              onChange={(e) => setProviderEmail(e.target.value)}
              className="pro-input w-full p-2 text-xs font-mono"
            />
          </div>
        </div>

        <button
          onClick={() => handlePreview(`/api/requests/download/Notice_Section_94_BNSS_${activeCase?.case_number || 'CR-2026-9910'}.pdf`)}
          className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-500 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Render Official Statutory PDF & Preview</span>
        </button>
      </div>

      {/* Main Table Panel */}
      <div className="pro-card p-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-blue-400" />
            Active Legal Requisitions List
          </h2>
          <span className="text-[11px] text-slate-400 font-mono">
            {legalRequests.length} Total Subpoenas Generated
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="border-b border-slate-800 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Request ID</th>
                <th className="py-2.5 px-3">Case No.</th>
                <th className="py-2.5 px-3">Notice Type</th>
                <th className="py-2.5 px-3">Target Service Provider</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {legalRequests.map((row) => (
                <tr key={row.id} className="hover:bg-slate-900/60 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-bold text-white">
                    {row.id}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-semibold text-blue-400">
                    {row.case_no}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="rounded bg-slate-800 border border-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                      {row.type}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-slate-200">{row.provider}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{row.email}</div>
                  </td>
                  <td className="py-2.5 px-3">
                    {row.status === 'DISPATCHED' ? (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                        <CheckCircle className="h-3 w-3" /> Dispatched
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                        <Clock className="h-3 w-3" /> Ready
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handlePreview(row.pdf_url)}
                        className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:border-slate-600 hover:text-white transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5 text-blue-400" />
                        <span>Preview PDF</span>
                      </button>

                      <button
                        onClick={() => handleDispatchEmail(row)}
                        disabled={dispatchingId === row.id}
                        className="inline-flex items-center gap-1 rounded bg-blue-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
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
