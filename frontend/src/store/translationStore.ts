import { create } from 'zustand';

export interface TranslationStatus {
  visible: boolean;
  status: 'idle' | 'translating' | 'completed' | 'error';
  targetLang: string;
  batchCount: number;
  durationMs: number;
  message: string;
}

interface TranslationStoreState {
  status: TranslationStatus;
  setTranslating: (targetLang: string, batchCount: number) => void;
  setCompleted: (targetLang: string, batchCount: number, durationMs: number) => void;
  setError: (errorMsg: string) => void;
  hideToast: () => void;
}

const getLanguageName = (code: string) => {
  const c = (code || '').substring(0, 2).toLowerCase();
  if (c === 'hi') return 'हिन्दी (Hindi)';
  if (c === 'gu') return 'ગુજરાતી (Gujarati)';
  return 'English';
};

let hideTimer: any = null;

export const useTranslationStore = create<TranslationStoreState>((set) => ({
  status: {
    visible: false,
    status: 'idle',
    targetLang: 'en',
    batchCount: 0,
    durationMs: 0,
    message: ''
  },

  setTranslating: (targetLang, batchCount) => {
    if (hideTimer) clearTimeout(hideTimer);
    set({
      status: {
        visible: true,
        status: 'translating',
        targetLang,
        batchCount,
        durationMs: 0,
        message: `Translating ${batchCount} UI elements to ${getLanguageName(targetLang)}...`
      }
    });
  },

  setCompleted: (targetLang, batchCount, durationMs) => {
    if (hideTimer) clearTimeout(hideTimer);
    set({
      status: {
        visible: true,
        status: 'completed',
        targetLang,
        batchCount,
        durationMs,
        message: `Translated ${batchCount} elements to ${getLanguageName(targetLang)} (${durationMs}ms)`
      }
    });

    hideTimer = setTimeout(() => {
      set((s) => ({
        status: { ...s.status, visible: false }
      }));
    }, 2800);
  },

  setError: (errorMsg) => {
    if (hideTimer) clearTimeout(hideTimer);
    set({
      status: {
        visible: true,
        status: 'error',
        targetLang: 'en',
        batchCount: 0,
        durationMs: 0,
        message: errorMsg || 'Translation request failed'
      }
    });

    hideTimer = setTimeout(() => {
      set((s) => ({
        status: { ...s.status, visible: false }
      }));
    }, 3500);
  },

  hideToast: () => {
    if (hideTimer) clearTimeout(hideTimer);
    set((s) => ({
      status: { ...s.status, visible: false }
    }));
  }
}));

export default useTranslationStore;
