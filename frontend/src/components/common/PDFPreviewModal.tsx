import React from 'react';
import { X, Download, FileText, ShieldCheck } from 'lucide-react';
import api from '../../services/api';

interface PDFPreviewModalProps {
  open: boolean;
  onClose: () => void;
  pdfUrl: string;
  title?: string;
}

export default function PDFPreviewModal({ open, onClose, pdfUrl, title = 'Section 94 BNSS Legal Notice' }: PDFPreviewModalProps) {
  if (!open) return null;

  const downloadUrl = pdfUrl.startsWith('http') ? pdfUrl : `${api.defaults.baseURL || ''}${pdfUrl}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-md transition-all">
      
      <div className="w-full max-w-lg rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#0d1322] p-6 shadow-2xl space-y-4 relative animate-in fade-in zoom-in duration-150 text-slate-900 dark:text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#0A2540] dark:text-blue-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">{title}</h2>
          </div>

          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="rounded border border-dashed border-blue-400 dark:border-blue-500/30 bg-slate-50 dark:bg-[#050811] p-6 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded bg-blue-100 dark:bg-blue-600/20 text-blue-700 dark:text-blue-400">
            <ShieldCheck className="h-6 w-6" />
          </div>

          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Official Statutory Legal Notice PDF (BNSS Grounded)
            </h3>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
              Formatted under Section 94 BNSS, 2023 with digital seal of Station House Officer.
            </p>
          </div>

          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition-colors shadow-sm"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download Turnkey PDF Notice</span>
          </a>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end pt-1">
          <button
            onClick={onClose}
            className="rounded border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-[#050811] px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            Close Preview
          </button>
        </div>

      </div>

    </div>
  );
}
