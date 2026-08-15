import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { startDOMAutoTranslator, scanAndTranslateDOM } from '../../lib/domTranslator';
import TranslationToast from './TranslationToast';

interface AutoTranslateProviderProps {
  children: React.ReactNode;
}

export const AutoTranslateProvider: React.FC<AutoTranslateProviderProps> = ({ children }) => {
  const { i18n } = useTranslation();

  useEffect(() => {
    // Start global DOM mutation observer & initial scan
    startDOMAutoTranslator();
  }, []);

  useEffect(() => {
    // Whenever language changes, trigger full DOM scan
    const currentLang = i18n.language || 'en';
    const timer = setTimeout(() => {
      scanAndTranslateDOM(document.body, currentLang);
    }, 50);

    return () => clearTimeout(timer);
  }, [i18n.language]);

  return (
    <>
      {children}
      <TranslationToast />
    </>
  );
};

export default AutoTranslateProvider;
