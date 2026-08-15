import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

// In-memory cache for ultra-low latency across re-renders
const memoryCache: Record<string, Record<string, string>> = {
  hi: {},
  gu: {}
};

function getCacheKey(text: string): string {
  // Simple fast hash for cache keys
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `t_${hash}_${text.length}`;
}

export function useDynamicTranslate(text: string | null | undefined): string {
  const { i18n } = useTranslation();
  const currentLang = i18n.language ? i18n.language.substring(0, 2) : 'en';
  const originalText = text || '';

  const [translatedText, setTranslatedText] = useState<string>(() => {
    if (currentLang === 'en' || !originalText.trim()) {
      return originalText;
    }
    const cacheKey = getCacheKey(originalText);
    if (memoryCache[currentLang]?.[cacheKey]) {
      return memoryCache[currentLang][cacheKey];
    }
    return originalText;
  });

  useEffect(() => {
    if (currentLang === 'en' || !originalText.trim()) {
      setTranslatedText(originalText);
      return;
    }

    const cacheKey = getCacheKey(originalText);
    if (memoryCache[currentLang]?.[cacheKey]) {
      setTranslatedText(memoryCache[currentLang][cacheKey]);
      return;
    }

    let isSubscribed = true;

    api
      .post('/api/translate/batch', {
        texts: [originalText],
        target_lang: currentLang
      })
      .then((res) => {
        if (isSubscribed && res.data?.translations?.[0]) {
          const trans = res.data.translations[0];
          if (!memoryCache[currentLang]) {
            memoryCache[currentLang] = {};
          }
          memoryCache[currentLang][cacheKey] = trans;
          setTranslatedText(trans);
        }
      })
      .catch((err) => {
        // Fallback gracefully to original text
        if (isSubscribed) {
          setTranslatedText(originalText);
        }
      });

    return () => {
      isSubscribed = false;
    };
  }, [originalText, currentLang]);

  return translatedText;
}

export default useDynamicTranslate;
