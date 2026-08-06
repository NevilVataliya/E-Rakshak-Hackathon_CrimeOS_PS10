import React from 'react';
import { X, Download, FileText, ShieldCheck } from 'lucide-react';

interface PDFPreviewModalProps {
  open: boolean;
  onClose: () => void;
  pdfUrl: string;
  title?: string;
}

export default function PDFPreviewModal({ open, onClose, pdfUrl, title = 'Section 94 BNSS Legal Notice' }: PDFPreviewModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md transition-all">
      
      <div className="w-full max-w-lg rounded-xl border border-white/10 bg-[#0d1322] p-6 shadow-2xl space-y-4 relative animate-in fade-in zoom-in duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-400" />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">{title}</h2>
          </div>

          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="rounded border border-dashed border-blue-500/30 bg-[#050811] p-6 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded bg-blue-600/20 text-blue-400">
            <ShieldCheck className="h-6 w-6" />
          </div>

          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Official ReportLab Statutory PDF Rendered
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">
              Formatted under Section 94 BNSS, 2023 with digital seal of Station House Officer.
            </p>
          </div>

          <a
            href={`http://localhost:4000${pdfUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download Turnkey PDF Notice</span>
          </a>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end pt-1">
          <button
            onClick={onClose}
            className="rounded border border-white/10 bg-[#050811] px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white transition-colors"
          >
            Close Preview
          </button>
        </div>

      </div>

    </div>
  );
}
