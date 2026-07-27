import React from 'react';
import { X, Download, FileText, ShieldCheck } from 'lucide-react';

export default function PDFPreviewModal({ open, onClose, pdfUrl, title = 'Section 94 BNSS Legal Notice' }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md transition-all">
      
      <div className="glass-panel w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-5 border border-slate-800 relative animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-cyan-400" />
            <h2 className="text-sm font-bold text-white">{title}</h2>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="rounded-2xl border border-dashed border-cyan-500/40 bg-cyan-500/5 p-6 text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/20 text-cyan-400 shadow-glow-cyan">
            <ShieldCheck className="h-8 w-8" />
          </div>

          <div>
            <h3 className="text-sm font-bold text-white">
              Official Legal Requisition PDF Document Generated
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Formatted under Section 94 BNSS, 2023 with digital seal of Station House Officer.
            </p>
          </div>

          <a
            href={`http://localhost:4000${pdfUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-5 py-3 text-xs font-bold text-white shadow-glow-cyan transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Download className="h-4 w-4" />
            <span>Download Turnkey PDF Notice</span>
          </a>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            Close Preview
          </button>
        </div>

      </div>

    </div>
  );
}
