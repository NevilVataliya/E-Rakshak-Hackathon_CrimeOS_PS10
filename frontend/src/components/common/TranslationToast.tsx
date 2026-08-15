import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Languages, Loader2, CheckCircle2, AlertCircle, X, Sparkles } from 'lucide-react';
import useTranslationStore from '../../store/translationStore';

export const TranslationToast: React.FC = () => {
  const { status, hideToast } = useTranslationStore();

  const isTranslating = status.status === 'translating';
  const isCompleted = status.status === 'completed';
  const isError = status.status === 'error';

  return (
    <div
      translate="no"
      data-no-translate="true"
      className="notranslate pointer-events-none fixed bottom-6 right-6 z-[99999] select-none"
    >
      <AnimatePresence>
        {status.visible && (
          <motion.div
            key="translation-toast"
            initial={{ opacity: 0, y: 24, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 450, damping: 30 }}
            className={`pointer-events-auto notranslate relative flex w-80 items-center gap-3 overflow-hidden rounded-xl border p-3.5 shadow-2xl backdrop-blur-xl transition-colors ${
              isTranslating
                ? 'border-cyan-500/40 bg-slate-950/90 text-slate-100 shadow-cyan-950/40'
                : isCompleted
                ? 'border-emerald-500/40 bg-slate-950/90 text-slate-100 shadow-emerald-950/40'
                : 'border-amber-500/40 bg-slate-950/90 text-slate-100 shadow-amber-950/40'
            }`}
            translate="no"
          >
            {/* Top Glowing Accent Line */}
            <div
              className={`absolute top-0 left-0 h-0.5 w-full ${
                isTranslating
                  ? 'bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 animate-pulse'
                  : isCompleted
                  ? 'bg-gradient-to-r from-emerald-400 to-teal-500'
                  : 'bg-gradient-to-r from-amber-400 to-rose-500'
              }`}
            />

            {/* Left Status Icon */}
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                isTranslating
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : isCompleted
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-amber-500/20 text-amber-400'
              }`}
            >
              {isTranslating && <Loader2 className="h-5 w-5 animate-spin" />}
              {isCompleted && <CheckCircle2 className="h-5 w-5" />}
              {isError && <AlertCircle className="h-5 w-5" />}
            </div>

            {/* Middle Message Text */}
            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-mono font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Languages className="h-3 w-3 text-cyan-400" />
                  <span>AI Language Layer</span>
                </span>
                {isTranslating && (
                  <span className="inline-flex items-center rounded-full bg-cyan-500/20 px-1.5 py-0.2 text-[9px] font-mono font-bold text-cyan-300">
                    BATCH ACTIVE
                  </span>
                )}
                {isCompleted && (
                  <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-1.5 py-0.2 text-[9px] font-mono font-bold text-emerald-300">
                    SYNCED
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold text-slate-100 truncate mt-0.5 leading-snug">
                {status.message}
              </p>
            </div>

            {/* Right Close Button */}
            <button
              onClick={hideToast}
              className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
              title="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TranslationToast;
