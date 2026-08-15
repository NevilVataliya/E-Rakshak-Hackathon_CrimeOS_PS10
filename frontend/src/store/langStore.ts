import { create } from 'zustand';
import i18n from '../lib/i18n';

interface LangState {
  lang: string;
  setLang: (lang: string) => void;
  t: (key: string, fallback?: string) => string;
}

export const useLangStore = create<LangState>((set) => ({
  lang: i18n.language || 'en',
  setLang: (lang) => {
    i18n.changeLanguage(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('crimeos_language', lang);
    }
    set({ lang });
  },
  t: (key, fallback) => {
    return i18n.t(key, fallback || key);
  }
}));

export default useLangStore;
