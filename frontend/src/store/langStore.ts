import { create } from 'zustand';

interface LangState {
  lang: string;
  setLang: (lang: string) => void;
  t: (key: string, fallback: string) => string;
}

export const useLangStore = create<LangState>((set) => ({
  lang: 'en',
  setLang: (lang) => set({ lang }),
  t: (_key, fallback) => fallback
}));
