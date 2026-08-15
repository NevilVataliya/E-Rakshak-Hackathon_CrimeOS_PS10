import api from '../services/api';
import i18n from './i18n';
import useTranslationStore from '../store/translationStore';

// In-memory cache for ultra-fast lookup
const transCache: Record<string, Record<string, string>> = {
  hi: {},
  gu: {}
};

// Built-in offline common law-enforcement & UI dictionary for 0ms instant translation
const COMMON_DICTIONARY: Record<string, { hi: string; gu: string }> = {
  "Dashboard": { hi: "डैशबोर्ड", gu: "ડેશબોર્ડ" },
  "Investigation": { hi: "जांच", gu: "તપાસ" },
  "Investigation Studio": { hi: "जांच स्टूडियो", gu: "તપાસ સ્ટુડિયો" },
  "Complaint Intake": { hi: "शिकायत अंतर्ग्रहण", gu: "ફરિયાદ ઇન્ટેક" },
  "Serial Link Analysis": { hi: "श्रृंखला संबंध विश्लेषण", gu: "શ્રેણીબદ્ધ લિંક વિશ્લેષણ" },
  "Subpoenas & Notices": { hi: "समन एवं नोटिस", gu: "સમન્સ અને નોટિસ" },
  "Response Analysis": { hi: "प्रतिक्रिया विश्लेषण", gu: "પ્રતિસાદ વિશ્લેષણ" },
  "Admin & Audit": { hi: "प्रशासन एवं ऑडिट", gu: "એડમિન અને ઓડિટ" },
  "Active Cases": { hi: "सक्रिय मामले", gu: "સક્રિય કેસ" },
  "Total Cases": { hi: "कुल मामले", gu: "કુલ કેસ" },
  "Subpoenas Dispatched": { hi: "भेजे गए समन", gu: "મોકલેલ સમન્સ" },
  "Serial Link Matches": { hi: "श्रृंखला संबंध मिलान", gu: "શ્રેણીબદ્ધ લિંક મેચ" },
  "AI Knowledge Base": { hi: "एआई ज्ञानकोष", gu: "એઆઈ નોલેજ બેઝ" },
  "Active": { hi: "सक्रिय", gu: "સક્રિય" },
  "Pending": { hi: "लंबित", gu: "બાકી" },
  "Approved": { hi: "स्वीकृत", gu: "મંજૂર" },
  "Dispatched": { hi: "भेजा गया", gu: "મોકલેલ" },
  "Completed": { hi: "पूर्ण", gu: "પૂર્ણ" },
  "High": { hi: "उच्च", gu: "ઉચ્ચ" },
  "Medium": { hi: "मध्यम", gu: "મધ્યમ" },
  "Low": { hi: "निम्न", gu: "ઓછું" },
  "Status": { hi: "स्थिति", gu: "સ્થિતિ" },
  "Actions": { hi: "कार्रवाई", gu: "ક્રિયાઓ" },
  "Search": { hi: "खोजें", gu: "શોધો" },
  "Filter": { hi: "फ़िल्टर", gu: "ફિલ્ટર" },
  "Download": { hi: "डाउनलोड", gu: "ડાઉનલોડ" },
  "Upload": { hi: "अपलोड", gu: "અપલોડ" },
  "Save": { hi: "सहेजें", gu: "સાચવો" },
  "Cancel": { hi: "रद्द करें", gu: "રદ કરો" },
  "Delete": { hi: "हटाएं", gu: "કાઢી નાખો" },
  "Clear": { hi: "साफ़ करें", gu: "સાફ કરો" },
  "Refresh": { hi: "ताज़ा करें", gu: "તાજું કરો" },
  "Submit": { hi: "जमा करें", gu: "સબમિટ કરો" },
  "Register New Complaint": { hi: "नई शिकायत दर्ज करें", gu: "નવી ફરિયાદ નોંધો" },
  "AI Module Summary": { hi: "एआई मॉड्यूल सारांश", gu: "એઆઈ મોડ્યુલ સારાંશ" },
  "Summarize All Modules": { hi: "सभी मॉड्यूल का सारांश", gu: "તમામ મોડ્યુલ્સનો સારાંશ" },
  "Audit": { hi: "ऑडिट", gu: "ઓડિટ" },
  "Summary": { hi: "सारांश", gu: "સારાંશ" },
  "Light Mode": { hi: "लाइट मोड", gu: "લાઇટ મોડ" },
  "Dark Mode": { hi: "डार्क मोड", gu: "ડાર્ક મોડ" },
  "Sign Out": { hi: "लॉग आउट", gu: "સાઇન આઉટ" },
  "Case Reference": { hi: "केस संदर्भ", gu: "કેસ સંદર્ભ" },
  "FIR Number": { hi: "एफआईआर संख्या", gu: "એફઆઈઆર નંબર" },
  "Crime Category": { hi: "अपराध श्रेणी", gu: "ગુનાની શ્રેણી" },
  "Severity": { hi: "गंभीरता", gu: "ગંભીરતા" },
  "Assigned IO": { hi: "नियुक्त जांच अधिकारी", gu: "નિયુક્ત તપાસ અધિકારી" },
  "Pipeline Steps": { hi: "पाइपलाइन चरण", gu: "પાઇપલાઇન પગલાં" },
  "Station Intelligence": { hi: "थाना इंटेलिजेंस", gu: "સ્ટેશન ઇન્ટેલિજન્સ" },
  "Priority Station Alerts": { hi: "प्राथमिकता स्टेशन अलर्ट", gu: "પ્રાથમિકતા સ્ટેશન ચેતવણીઓ" },
  "Statutory Citation Guarantee": { hi: "वैधानिक संदर्भ गारंटी", gu: "કાયદાકીય સંદર્ભ ગેરંટી" },
  "Live Station Feed": { hi: "लाइव स्टेशन फीड", gu: "લાઇવ સ્ટેશન ફીડ" },
  "System Online": { hi: "सिस्टम ऑनलाइन", gu: "સિસ્ટમ ઓનલાઇન" },
  "Purge Storage": { hi: "स्टोरेज साफ़ करें", gu: "સ્ટોરેજ સાફ કરો" },
  "STANDALONE OFFLINE MODE": { hi: "स्टैंडअलोन ऑफ़लाइन मोड", gu: "સ્ટેન્ડઅલોન ઓફલાઇન મોડ" },
  "HYBRID CLOUD MODE": { hi: "हाइब्रिड क्लाउड मोड", gu: "હાઇબ્રિડ ક્લાઉડ મોડ" }
};

// Seed initial dictionary
Object.entries(COMMON_DICTIONARY).forEach(([enText, trans]) => {
  transCache.hi[enText] = trans.hi;
  transCache.gu[enText] = trans.gu;
});

// Load persistent local storage cache
if (typeof window !== 'undefined') {
  try {
    const cachedHi = localStorage.getItem('crimeos_dom_trans_hi');
    if (cachedHi) Object.assign(transCache.hi, JSON.parse(cachedHi));
    const cachedGu = localStorage.getItem('crimeos_dom_trans_gu');
    if (cachedGu) Object.assign(transCache.gu, JSON.parse(cachedGu));
  } catch (e) {
    console.warn('Failed to load local DOM cache:', e);
  }
}

function saveCacheToStorage(lang: string) {
  if (typeof window === 'undefined') return;
  try {
    const data = transCache[lang] || {};
    const keys = Object.keys(data);
    if (keys.length > 2500) {
      const trimmed: Record<string, string> = {};
      keys.slice(-2000).forEach(k => { trimmed[k] = data[k]; });
      transCache[lang] = trimmed;
    }
    localStorage.setItem(`crimeos_dom_trans_${lang}`, JSON.stringify(transCache[lang]));
  } catch (e) {
    // Ignore quota limits
  }
}

const IGNORE_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'CODE',
  'PRE',
  'KBD',
  'SVG',
  'PATH',
  'INPUT',
  'TEXTAREA',
  'SELECT',
  'OPTION'
]);

const originalTextMap = new WeakMap<Node, string>();
const nodeAppliedLangMap = new WeakMap<Node, string>();

// Request tracking to prevent infinite loops
const inFlightTexts = new Set<string>();
const failedOrProcessedTexts = new Set<string>();
let pendingBatch = new Set<string>();
let batchDebounceTimer: any = null;
let isUpdatingDOM = false;

function shouldTranslateText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/^[\d\s.,\-–—_/\\:;()#@!%&*+=<>?[\]{}|'"]+$/.test(trimmed)) return false;
  if (trimmed.length < 2) return false;
  return true;
}

function isInsideIgnoredElement(node: Node): boolean {
  let parent = node.parentElement;
  while (parent) {
    if (IGNORE_TAGS.has(parent.tagName)) return true;
    if (
      parent.getAttribute('translate') === 'no' ||
      parent.getAttribute('data-no-translate') === 'true' ||
      parent.classList?.contains('notranslate') ||
      parent.classList?.contains('language-selector')
    ) {
      return true;
    }
    parent = parent.parentElement;
  }
  return false;
}

export function scanAndTranslateDOM(root: HTMLElement = document.body, targetLang: string) {
  if (!root || typeof window === 'undefined' || isUpdatingDOM) return;

  const currentLang = targetLang ? targetLang.substring(0, 2).toLowerCase() : 'en';

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (isInsideIgnoredElement(node)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const textNodes: Text[] = [];
  let currentNode: Node | null;
  while ((currentNode = walker.nextNode())) {
    textNodes.push(currentNode as Text);
  }

  isUpdatingDOM = true;

  try {
    // 1. If English, restore original text immediately
    if (currentLang === 'en') {
      textNodes.forEach((node) => {
        const orig = originalTextMap.get(node);
        if (orig !== undefined && node.nodeValue !== orig) {
          node.nodeValue = orig;
          nodeAppliedLangMap.delete(node);
        }
      });
      return;
    }

    // 2. If Hindi or Gujarati
    textNodes.forEach((node) => {
      let currentVal = node.nodeValue || '';
      if (!shouldTranslateText(currentVal)) return;

      let originalEnglish = originalTextMap.get(node);
      if (!originalEnglish) {
        originalEnglish = currentVal;
        originalTextMap.set(node, originalEnglish);
      }

      const trimmed = originalEnglish.trim();
      if (!trimmed) return;

      const appliedLang = nodeAppliedLangMap.get(node);
      if (appliedLang === currentLang) {
        return; // Already has translated text
      }

      // Check Cache
      const cached = transCache[currentLang]?.[trimmed];
      if (cached) {
        const matchLeading = originalEnglish.match(/^\s*/)?.[0] || '';
        const matchTrailing = originalEnglish.match(/\s*$/)?.[0] || '';
        node.nodeValue = matchLeading + cached + matchTrailing;
        nodeAppliedLangMap.set(node, currentLang);
      } else {
        // Only queue if not already in-flight or failed
        const trackingKey = `${currentLang}:${trimmed}`;
        if (!inFlightTexts.has(trackingKey) && !failedOrProcessedTexts.has(trackingKey)) {
          pendingBatch.add(trimmed);
        }
      }
    });

    if (pendingBatch.size > 0 && !batchDebounceTimer) {
      batchDebounceTimer = setTimeout(() => {
        dispatchBatch(currentLang);
      }, 250);
    }
  } finally {
    isUpdatingDOM = false;
  }
}

async function dispatchBatch(targetLang: string) {
  if (batchDebounceTimer) {
    clearTimeout(batchDebounceTimer);
    batchDebounceTimer = null;
  }

  if (targetLang === 'en' || pendingBatch.size === 0) return;

  const toFetch = Array.from(pendingBatch).slice(0, 80);
  toFetch.forEach(t => {
    pendingBatch.delete(t);
    inFlightTexts.add(`${targetLang}:${t}`);
  });

  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  
  try {
    useTranslationStore.getState().setTranslating(targetLang, toFetch.length);

    const res = await api.post('/api/translate/batch', {
      texts: toFetch,
      target_lang: targetLang
    });

    const translations: string[] = res.data?.translations || [];

    if (!transCache[targetLang]) {
      transCache[targetLang] = {};
    }

    let translatedCount = 0;
    toFetch.forEach((origText, idx) => {
      const translated = translations[idx];
      if (translated && translated !== origText) {
        transCache[targetLang][origText] = translated;
        translatedCount++;
      }
      failedOrProcessedTexts.add(`${targetLang}:${origText}`);
    });

    saveCacheToStorage(targetLang);

    const duration = Math.round(
      (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0
    );
    useTranslationStore.getState().setCompleted(targetLang, toFetch.length, duration);

    // Apply translations to DOM
    scanAndTranslateDOM(document.body, targetLang);
  } catch (err) {
    console.warn('[-] Auto-translate batch error:', err);
    toFetch.forEach(t => failedOrProcessedTexts.add(`${targetLang}:${t}`));
    useTranslationStore.getState().setError('Batch translation encountered an error');
  } finally {
    toFetch.forEach(t => inFlightTexts.delete(`${targetLang}:${t}`));

    // If more pending items remain, process next chunk
    if (pendingBatch.size > 0) {
      batchDebounceTimer = setTimeout(() => dispatchBatch(targetLang), 100);
    }
  }
}

let activeObserver: MutationObserver | null = null;

export function startDOMAutoTranslator() {
  if (typeof window === 'undefined') return;

  const handleLanguageUpdate = (lang: string) => {
    scanAndTranslateDOM(document.body, lang);
  };

  const initialLang = i18n.language || localStorage.getItem('crimeos_language') || 'en';
  handleLanguageUpdate(initialLang);

  i18n.on('languageChanged', (newLang) => {
    handleLanguageUpdate(newLang);
  });

  if (!activeObserver) {
    activeObserver = new MutationObserver((mutations) => {
      if (isUpdatingDOM) return;

      const currentLang = i18n.language || 'en';
      if (currentLang === 'en') return;

      let shouldScan = false;
      for (const m of mutations) {
        if (m.type === 'childList' && m.addedNodes.length > 0) {
          shouldScan = true;
          break;
        }
      }

      if (shouldScan) {
        scanAndTranslateDOM(document.body, currentLang);
      }
    });

    activeObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: false
    });
  }
}
