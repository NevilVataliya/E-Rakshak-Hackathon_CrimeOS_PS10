import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { translations, Language } from '../i18n/translations';

interface LangState {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (path: string, defaultText?: string) => string;
}

export const useLangStore = create<LangState>()(
  persist(
    (set, get) => ({
      language: 'en',
      setLanguage: (lang: Language) => set({ language: lang }),
      t: (path: string, defaultText?: string): string => {
        const lang = get().language || 'en';
        const keys = path.split('.');
        let val: any = translations[lang];

        for (const k of keys) {
          if (val && typeof val === 'object' && k in val) {
            val = val[k];
          } else {
            val = undefined;
            break;
          }
        }

        if (typeof val === 'string') return val;

        // Fallback to English if translation missing in target language
        let fallbackVal: any = translations['en'];
        for (const k of keys) {
          if (fallbackVal && typeof fallbackVal === 'object' && k in fallbackVal) {
            fallbackVal = fallbackVal[k];
          } else {
            fallbackVal = undefined;
            break;
          }
        }

        if (typeof fallbackVal === 'string') return fallbackVal;
        return defaultText || path;
      }
    }),
    {
      name: 'crime-os-language-preference'
    }
  )
);
