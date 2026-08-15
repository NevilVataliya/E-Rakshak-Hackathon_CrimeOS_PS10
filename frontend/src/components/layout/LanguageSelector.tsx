import React from 'react';
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';

interface LanguageOption {
  code: string;
  label: string;
  short: string;
  native: string;
}

const LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', short: 'EN', native: 'English' },
  { code: 'hi', label: 'Hindi', short: 'HI', native: 'हिन्दी' },
  { code: 'gu', label: 'Gujarati', short: 'GU', native: 'ગુજરાતી' }
];

export const LanguageSelector: React.FC = () => {
  const { i18n } = useTranslation();
  const currentLang = i18n.language ? i18n.language.substring(0, 2) : 'en';

  const handleLanguageChange = (langCode: string) => {
    i18n.changeLanguage(langCode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('crimeos_language', langCode);
    }
  };

  return (
    <div
      translate="no"
      data-no-translate="true"
      className="notranslate language-selector flex items-center rounded border border-slate-600/80 bg-slate-900/90 p-0.5 shadow-inner"
    >
      <div className="flex items-center pl-1.5 pr-1 text-amber-400 notranslate" translate="no">
        <Languages className="h-3.5 w-3.5" />
      </div>
      <div className="flex items-center gap-0.5 notranslate" translate="no">
        {LANGUAGES.map((lang) => {
          const isSelected = currentLang === lang.code;
          return (
            <button
              key={lang.code}
              translate="no"
              data-no-translate="true"
              onClick={() => handleLanguageChange(lang.code)}
              className={`notranslate rounded px-1.5 py-0.5 text-[11px] font-bold transition-all ${
                isSelected
                  ? 'bg-amber-500 text-slate-950 font-black shadow-sm scale-[1.03]'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              title={`Switch UI to ${lang.label} (${lang.native})`}
            >
              <span className="font-mono notranslate" translate="no">{lang.short}</span>
              <span className="hidden xl:inline ml-1 text-[10px] opacity-90 font-sans notranslate" translate="no">
                {lang.native}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default LanguageSelector;
