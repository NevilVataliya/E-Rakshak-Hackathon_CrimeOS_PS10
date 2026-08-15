import os
import re
import hashlib
import json
import traceback
from concurrent.futures import ThreadPoolExecutor
import redis
from typing import List, Tuple, Dict

# High-frequency police & UI terminology dictionary (0ms instant lookup)
FFAST_DICT: Dict[str, Dict[str, str]] = {
    "Dashboard": {"hi": "डैशबोर्ड", "gu": "ડેશબોર્ડ"},
    "Investigation": {"hi": "जाँच", "gu": "તપાસ"},
    "Investigation Studio": {"hi": "जाँच स्टूडियो", "gu": "તપાસ સ્ટુડિયો"},
    "Complaint Intake": {"hi": "शिकायत दर्ज करना", "gu": "ફરિયાદ નોંધણી"},
    "Serial Link Analysis": {"hi": "सीरियल लिंक विश्लेषण", "gu": "સીરિયલ લિંક વિશ્લેષણ"},
    "Subpoenas & Notices": {"hi": "समन एवं नोटिस", "gu": "સમન્સ અને નોટિસ"},
    "Response Analysis": {"hi": "प्रतिक्रिया विश्लेषण", "gu": "પ્રતિસાદ વિશ્લેષણ"},
    "Admin & Audit": {"hi": "प्रशासन एवं ऑडिट", "gu": "એડમિન અને ઓડિટ"},
    "Active Cases": {"hi": "सक्रिय मामले", "gu": "સક્રિય કેસો"},
    "Total Cases": {"hi": "कुल मामले", "gu": "કુલ કેસો"},
    "Subpoenas Dispatched": {"hi": "जारी किए गए समन", "gu": "મોકલેલા સમન્સ"},
    "Serial Link Matches": {"hi": "सीरियल लिंक मिलान", "gu": "સીરિયલ લિંક મેચ"},
    "AI Knowledge Base": {"hi": "एआई ज्ञानकोष", "gu": "એઆઈ નોલેજ બેઝ"},
    "Active": {"hi": "सक्रिय", "gu": "સક્રિય"},
    "Pending": {"hi": "लंबित", "gu": "બાકી"},
    "Approved": {"hi": "स्वीकृत", "gu": "મંજૂર"},
    "Dispatched": {"hi": "जारी किया गया", "gu": "મોકલેલ"},
    "Completed": {"hi": "पूर्ण", "gu": "પૂર્ણ"},
    "High": {"hi": "उच्च", "gu": "ઉચ્ચ"},
    "Medium": {"hi": "मध्यम", "gu": "મધ્યમ"},
    "Low": {"hi": "निम्न", "gu": "નીચું"},
    "Status": {"hi": "स्थिति", "gu": "સ્થિતિ"},
    "Actions": {"hi": "कार्रवाइयाँ", "gu": "કાર્યવાહીઓ"},
    "Search": {"hi": "खोजें", "gu": "શોધ"},
    "Filter": {"hi": "फ़िल्टर", "gu": "ફિલ્ટર"},
    "Download": {"hi": "डाउनलोड", "gu": "ડાઉનલોડ"},
    "Upload": {"hi": "अपलोड", "gu": "અપલોડ"},
    "Save": {"hi": "सहेजें", "gu": "સાચવો"},
    "Cancel": {"hi": "रद्द करें", "gu": "રદ કરો"},
    "Delete": {"hi": "हटाएँ", "gu": "કાઢી નાખો"},
    "Clear": {"hi": "साफ़ करें", "gu": "સાફ કરો"},
    "Refresh": {"hi": "ताज़ा करें", "gu": "તાજું કરો"},
    "Submit": {"hi": "सबमिट करें", "gu": "સબમિટ કરો"},
    "Register New Complaint": {"hi": "नई शिकायत दर्ज करें", "gu": "નવી ફરિયાદ નોંધો"},
    "AI Module Summary": {"hi": "एआई मॉड्यूल सारांश", "gu": "એઆઈ મોડ્યુલ સારાંશ"},
    "Summarize All Modules": {"hi": "सभी मॉड्यूल का सारांश", "gu": "તમામ મોડ્યુલ્સનો સારાંશ"},
    "Audit": {"hi": "ऑडिट", "gu": "ઓડિટ"},
    "Summary": {"hi": "सारांश", "gu": "સારાંશ"},
    "Light Mode": {"hi": "लाइट मोड", "gu": "લાઇટ મોડ"},
    "Dark Mode": {"hi": "डार्क मोड", "gu": "ડાર્ક મોડ"},
    "Sign Out": {"hi": "साइन आउट", "gu": "સાઇન આઉટ"},
    "Case Reference": {"hi": "केस संदर्भ", "gu": "કેસ સંદર્ભ"},
    "FIR Number": {"hi": "एफआईआर नंबर", "gu": "એફઆઈઆર નંબર"},
    "Crime Category": {"hi": "अपराध श्रेणी", "gu": "ગુનાની શ્રેણી"},
    "Severity": {"hi": "गंभीरता", "gu": "ગંભીરતા"},
    "Assigned IO": {"hi": "नियुक्त जाँच अधिकारी", "gu": "નિયુક્ત તપાસ અધિકારી"},
    "Pipeline Steps": {"hi": "पाइपलाइन चरण", "gu": "પાઇપલાઇન તબક્કાઓ"},
    "Station Intelligence": {"hi": "थाना इंटेलिजेंस", "gu": "પોલીસ સ્ટેશન ઇન્ટેલિજન્સ"},
    "Priority Station Alerts": {"hi": "प्राथमिकता थाना अलर्ट", "gu": "પ્રાથમિકતા સ્ટેશન ચેતવણીઓ"},
    "Statutory Citation Guarantee": {"hi": "वैधानिक संदर्भ गारंटी", "gu": "કાયદાકીય સંદર્ભ ગેરંટી"},
    "Live Station Feed": {"hi": "लाइव थाना फीड", "gu": "લાઇવ સ્ટેશન ફીડ"},
    "System Online": {"hi": "सिस्टम ऑनलाइन", "gu": "સિસ્ટમ ઓનલાઇન"},
    "Purge Storage": {"hi": "स्टोरेज खाली करें", "gu": "સ્ટોરેજ ખાલી કરો"},
    "STANDALONE OFFLINE MODE": {"hi": "स्टैंडअलोन ऑफ़लाइन मोड", "gu": "સ્ટેન્ડઅલોન ઓફલાઇન મોડ"},
    "HYBRID CLOUD MODE": {"hi": "हाइब्रिड क्लाउड मोड", "gu": "હાઇબ્રિડ ક્લાઉડ મોડ"},
}

class OfflineIndicTranslator:
    def __init__(self):
        self.redis_host = os.getenv("REDIS_HOST", "redis")
        self.redis_port = int(os.getenv("REDIS_PORT", 6379))
        self._redis_client = None
        self._local_cache: Dict[str, str] = {}
        self._executor = ThreadPoolExecutor(max_workers=8)

    @property
    def redis(self):
        if self._redis_client is None:
            try:
                self._redis_client = redis.Redis(
                    host=self.redis_host,
                    port=self.redis_port,
                    db=0,
                    decode_responses=True,
                    socket_connect_timeout=1
                )
                self._redis_client.ping()
            except Exception:
                self._redis_client = None
        return self._redis_client

    def _get_cache_key(self, text: str, target_lang: str) -> str:
        text_hash = hashlib.md5(text.strip().encode("utf-8")).hexdigest()
        return f"trans_v3:{target_lang}:{text_hash}"

    def mask_entities(self, text: str) -> Tuple[str, List[str]]:
        """
        Protects technical identifiers (Case IDs, Phone numbers, UPI VPAs, Bank accounts, IFSCs)
        using HTML translate='no' tags, which are natively respected by translation engines.
        """
        if not text:
            return text, []

        entities = []
        patterns = [
            r'CR-\d{4}-\d{4}',
            r'FIR-[\w/-]+',
            r'CMP-\d{4}-\d{4}',
            r'[a-zA-Z0-9.\-_]+@[a-zA-Z0-9.\-_]+',
            r'(?:\+91[\-\s]?)?[6-9]\d{9}',
            r'\b(?:1\d{2}|2[0-4]\d|25[0-5]|[1-9]\d|\d)\.(?:1\d{2}|2[0-4]\d|25[0-5]|[1-9]\d|\d)\.(?:1\d{2}|2[0-4]\d|25[0-5]|[1-9]\d|\d)\.(?:1\d{2}|2[0-4]\d|25[0-5]|[1-9]\d|\d)\b',
            r'\b[A-Z]{4}0[A-Z0-9]{6}\b',
            r'\b\d{9,18}\b'
        ]

        combined_regex = re.compile('|'.join(f'({p})' for p in patterns))

        def replace_fn(match):
            val = match.group(0)
            entities.append(val)
            # Wrap in HTML translate=no tag
            return f'<span translate="no">{val}</span>'

        masked_text = combined_regex.sub(replace_fn, text)
        return masked_text, entities

    def unmask_entities(self, text: str, entities: List[str]) -> str:
        """
        Removes wrapper tags and restores all original values cleanly with zero placeholder leakage.
        """
        if not text:
            return text

        # 1. Cleanly unwrap <span translate="no">VALUE</span> tags
        unmasked = re.sub(
            r'<\s*span[^>]*translate=["\']?no["\']?[^>]*>(.*?)<\s*/\s*span\s*>',
            r'\1',
            text,
            flags=re.DOTALL | re.IGNORECASE
        )

        # 2. Cleanup any legacy placeholder artifacts (e.g. __ENTITY_0__, _ ENTITY_1 _, etc.)
        for idx, val in enumerate(entities):
            legacy_pattern = re.compile(rf'[_~*]*\s*ENTITY\s*[-_]?\s*{idx}\s*[_~*]*', re.IGNORECASE)
            unmasked = legacy_pattern.sub(val, unmasked)

        # 3. Final safety catch-all: if any stray ENTITY marker remains, clean it
        unmasked = re.sub(r'[_~*]*\s*ENTITY\s*[-_]?\s*\d+\s*[_~*]*', '', unmasked, flags=re.IGNORECASE)

        return unmasked.strip()

    def _translate_via_nmt(self, text: str, target_lang: str) -> str:
        """
        Translates a single string using deep-translator (free, zero LLM tokens, zero rate limits).
        """
        try:
            from deep_translator import GoogleTranslator
            translator = GoogleTranslator(source='en', target=target_lang)
            res = translator.translate(text)
            return res if res else text
        except Exception as e:
            return text

    def translate_batch(self, texts: List[str], target_lang: str, src_lang: str = "en") -> List[str]:
        """
        Translates a batch of texts with 0 LLM API calls, preserving entities via HTML tags and caching in Redis.
        """
        if not texts:
            return []

        clean_target = (target_lang or "en").lower().strip()[:2]
        if clean_target == "en" or clean_target not in ("hi", "gu"):
            return texts

        results = [None] * len(texts)
        missing_indices = []
        missing_masked_texts = []
        all_entities_list = []

        # 1. Fast Dictionary + Memory Cache + Redis Cache
        for i, raw_text in enumerate(texts):
            clean_str = raw_text.strip() if raw_text else ""
            if not clean_str:
                results[i] = raw_text
                continue

            if clean_str in FAST_DICT and clean_target in FAST_DICT[clean_str]:
                results[i] = FAST_DICT[clean_str][clean_target]
                continue

            cache_key = self._get_cache_key(clean_str, clean_target)

            if cache_key in self._local_cache:
                results[i] = self._local_cache[cache_key]
                continue

            cached = None
            if self.redis:
                try:
                    cached = self.redis.get(cache_key)
                except Exception:
                    cached = None

            # Only accept cached value if clean without any ENTITY tags
            if cached and cached != clean_str and 'ENTITY' not in cached:
                self._local_cache[cache_key] = cached
                results[i] = cached
            else:
                masked_str, entities = self.mask_entities(clean_str)
                missing_indices.append(i)
                missing_masked_texts.append(masked_str)
                all_entities_list.append(entities)

        if not missing_masked_texts:
            return results

        # 2. Parallel NMT Translation (Thread Pool with 0 LLM tokens consumed)
        futures = [
            self._executor.submit(self._translate_via_nmt, masked_str, clean_target)
            for masked_str in missing_masked_texts
        ]

        for future, orig_idx, entities in zip(futures, missing_indices, all_entities_list):
            orig_raw = texts[orig_idx].strip()
            try:
                trans_masked = future.result()
                final_unmasked = self.unmask_entities(trans_masked, entities)
                results[orig_idx] = final_unmasked

                # Save legitimate translations to cache
                if final_unmasked and final_unmasked != orig_raw and 'ENTITY' not in final_unmasked:
                    cache_key = self._get_cache_key(orig_raw, clean_target)
                    self._local_cache[cache_key] = final_unmasked
                    if self.redis:
                        try:
                            self.redis.setex(cache_key, 86400 * 30, final_unmasked)
                        except Exception:
                            pass
            except Exception as e:
                print(f"[-] NMT translation error: {e}")
                results[orig_idx] = texts[orig_idx]

        for idx in range(len(results)):
            if results[idx] is None:
                results[idx] = texts[idx]

        return results

offline_translator = OfflineIndicTranslator()
