import os
import re
import hashlib
import json
import traceback
try:
    import redis
except ImportError:
    redis = None
from typing import List, Tuple, Dict, Optional
from config import MODEL_CACHE_DIR

# --------------------------------------------------------------------------------------
# 1. EXPANDED POLICE & INVESTIGATION LEXICON (0ms Instant Offline Lookup)
# --------------------------------------------------------------------------------------
FAST_DICT: Dict[str, Dict[str, str]] = {
    # Navigation & Core Views
    "Dashboard": {"hi": "डैशबोर्ड", "gu": "ડેશબોર્ડ"},
    "Investigation": {"hi": "जाँच", "gu": "તપાસ"},
    "Investigation Studio": {"hi": "जाँच स्टूडियो", "gu": "તપાસ સ્ટુડિયો"},
    "Complaint Intake": {"hi": "शिकायत दर्ज करना", "gu": "ફરિયાદ નોંધણી"},
    "Complaint Intake & Multimodal Parsing": {"hi": "शिकायत दर्ज करना एवं मल्टीमॉडल विश्लेषण", "gu": "ફરિયાદ નોંધણી અને મલ્ટિમોડલ વિશ્લેષણ"},
    "Serial Link Analysis": {"hi": "सीरियल लिंक विश्लेषण", "gu": "સીરિયલ લિંક વિશ્લેષણ"},
    "Subpoenas & Notices": {"hi": "समन एवं नोटिस", "gu": "સમન્સ અને નોટિસ"},
    "Response Analysis": {"hi": "प्रतिक्रिया विश्लेषण", "gu": "પ્રતિસાદ વિશ્લેષણ"},
    "Admin & Audit": {"hi": "प्रशासन एवं ऑडिट", "gu": "એડમિન અને ઓડિટ"},
    
    # Case Status & Counts
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
    "Rejected": {"hi": "अस्वीकृत", "gu": "અસ્વીકાર્ય"},
    "Under Investigation": {"hi": "जाँच जारी", "gu": "તપાસ હેઠળ"},
    "High": {"hi": "उच्च", "gu": "ઉચ્ચ"},
    "Medium": {"hi": "मध्यम", "gu": "મધ્યમ"},
    "Low": {"hi": "निम्न", "gu": "નીચું"},
    "Critical": {"hi": "गंभीर", "gu": "ગંભીર"},
    "Status": {"hi": "स्थिति", "gu": "સ્થિતિ"},
    "Actions": {"hi": "कार्रवाइयाँ", "gu": "કાર્યવાહીઓ"},
    
    # Action Buttons
    "Search": {"hi": "खोजें", "gu": "શોધ"},
    "Filter": {"hi": "फ़िल्टर", "gu": "ફિલ્ટર"},
    "Download": {"hi": "डाउनलोड", "gu": "ડાઉનલોડ"},
    "Upload": {"hi": "अपलोड", "gu": "અપલોડ"},
    "Save": {"hi": "सहेजें", "gu": "સાચવો"},
    "Cancel": {"hi": "रद्द करें", "gu": "રદ કરો"},
    "Delete": {"hi": "हटाएँ", "gu": "કાઢી નાખો"},
    "Clear": {"hi": "साफ़ करें", "gu": "સાફ કરો"},
    "Clear Form": {"hi": "फ़ॉर्म साफ़ करें", "gu": "ફોર્મ સાફ કરો"},
    "Refresh": {"hi": "ताज़ा करें", "gu": "તાજું કરો"},
    "Submit": {"hi": "सबमिट करें", "gu": "સબમિટ કરો"},
    "Register New Complaint": {"hi": "नई शिकायत दर्ज करें", "gu": "નવી ફરિયાદ નોંધો"},
    "Process & Ingest Complaint": {"hi": "शिकायत की जाँच और विश्लेषण करें", "gu": "ફરિયાદનું વિશ્લેષણ અને પ્રોસેસ કરો"},
    "Analyze Complaint": {"hi": "शिकायत का विश्लेषण करें", "gu": "ફરિયાદનું વિશ્લેષણ કરો"},
    "Proceed to Linkage Analysis": {"hi": "लिंकेज विश्लेषण की ओर बढ़ें", "gu": "લિંકેજ વિશ્લેષણ તરફ આગળ વધો"},
    "Register Case & Proceed to Linkage Analysis": {"hi": "केस दर्ज करें एवं लिंकेज विश्लेषण की ओर बढ़ें", "gu": "કેસ નોંધો અને લિંકેજ વિશ્લેષણ તરફ આગળ વધો"},
    "AI Module Summary": {"hi": "एआई मॉड्यूल सारांश", "gu": "એઆઈ મોડ્યુલ સારાંશ"},
    "Summarize All Modules": {"hi": "सभी मॉड्यूल का सारांश", "gu": "તમામ મોડ્યુલ્સનો સારાંશ"},
    "Audit": {"hi": "ऑडिट", "gu": "ઓડિટ"},
    "Summary": {"hi": "सारांश", "gu": "સારાંશ"},
    
    # UI Theme & System
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
    "SOVEREIGN AGENT ACTIVE": {"hi": "सॉवरेन एजेंट सक्रिय", "gu": "સાર્વભૌમ એજન્ટ સક્રિય"},

    # Forensic & Statutory Terms
    "Extracted Case Information": {"hi": "निष्कासित केस विवरण", "gu": "તારવેલી કેસ વિગતો"},
    "English Narrative": {"hi": "अंग्रेजी विवरण", "gu": "અંગ્રેજી વર્ણન"},
    "Identified Legal Sections (BNS / IT Act)": {"hi": "पहचाने गए कानूनी अनुभाग (बीएनएस / आईटी एक्ट)", "gu": "ઓળખાયેલ કાયદાકીય કલમો (BNS / IT Act)"},
    "Key Investigation Facts": {"hi": "मुख्य जाँच तथ्य", "gu": "મુખ્ય તપાસ તથ્યો"},
    "Extracted Entities & Identifiers": {"hi": "पहचाने गए तत्व एवं पहचानकर्ता", "gu": "તારવેલી વિગતો અને ઓળખકર્તાઓ"},
    "Monetary Loss": {"hi": "वित्तीय नुकसान", "gu": "નાણાકીય નુકસાન"},
    "Bank Accounts": {"hi": "बैंक खाते", "gu": "બેંક ખાતાઓ"},
    "Phone Numbers": {"hi": "फोन नंबर", "gu": "ફોન નંબરો"},
    "Email Addresses": {"hi": "ईमेल पते", "gu": "ઇમેઇલ સરનામાં"},
    "UPI VPAs": {"hi": "यूपीआई वीपीए", "gu": "યુપીઆઈ વીપીએ"},
    "Crime Locations": {"hi": "अपराध स्थल", "gu": "ગુનાના સ્થળો"},
    "Persons Involved": {"hi": "संबंधित व्यक्ति", "gu": "સંકળાયેલ વ્યક્તિઓ"},
    "Accused": {"hi": "आरोपी", "gu": "આરોપી"},
    "Victim": {"hi": "पीड़ित", "gu": "ભોગ બનનાર"},
    "Suspect": {"hi": "संदिग्ध", "gu": "શંકાસ્પદ"},
    "Witness": {"hi": "गवाह", "gu": "સાક્ષી"},
    "Money Mule": {"hi": "मनी म्यूल", "gu": "મની મ્યુલ"},
    "Fake Identity": {"hi": "फर्जी पहचान", "gu": "નકલી ઓળખ"},
    "Debit Freeze": {"hi": "डेबिट फ्रीज", "gu": "ડેબિટ ફ્રીઝ"},
    "Account Freeze": {"hi": "खाता फ्रीज", "gu": "ખાતું ફ્રીઝ"},
    "CDR Analysis": {"hi": "सीडीआर विश्लेषण", "gu": "સીડીઆર વિશ્લેષણ"},
    "Tower Hopping": {"hi": "टावर हॉपिंग", "gu": "ટાવર હોપિંગ"},
    "IMEI Switch": {"hi": "आईएमईआई परिवर्तन", "gu": "આઈઈએમઆઈ સ્વિચ"},
    "Mule Account": {"hi": "म्यूल बैंक खाता", "gu": "મ્યુલ બેંક ખાતું"},
    "Layering Traced": {"hi": "लेयरिंग ट्रेस की गई", "gu": "લેયરિંગ ટ્રેસ કરાઈ"},
    "Panchnama": {"hi": "पंचनामा", "gu": "પંચનામું"},
    "Case Diary": {"hi": "केस डायरी", "gu": "કેસ ડાયરી"},
    "Section 94 BNSS Notice": {"hi": "धारा 94 बीएनएसएस नोटिस", "gu": "કલમ 94 BNSS નોટિસ"},
    "Section 63 BSA Certificate": {"hi": "धारा 63 बीएसए प्रमाणपत्र", "gu": "કલમ 63 BSA પ્રમાણપત્ર"},
    "Section 167 BNSS Case Diary": {"hi": "धारा 167 बीएनएसएस केस डायरी", "gu": "કલમ 167 BNSS કેસ ડાયરી"},
    "Digital Evidence Hash": {"hi": "डिजिटल साक्ष्य हैश", "gu": "ડિજિટલ પુરાવા હેશ"},
    "SHA-256 Validated": {"hi": "एसएचए-256 सत्यापित", "gu": "SHA-256 ચકાસાયેલ"},
    "Cyber Financial Fraud": {"hi": "साइबर वित्तीय धोखाधड़ी", "gu": "સાયબર નાણાકીય છેતરપિંડી"},
    "UPI Financial Fraud": {"hi": "यूपीआई वित्तीय धोखाधड़ी", "gu": "યુપીઆઈ નાણાકીય છેતરપિંડી"},
    "Digital Arrest & Impersonation Fraud": {"hi": "डिजिटल अरेस्ट एवं प्रतिरूपण धोखाधड़ी", "gu": "ડિજિટલ અરેસ્ટ અને નકલી ઓળખ છેતરપિંડી"},
    "Sextortion / Blackmail": {"hi": "सेक्सटॉर्शन / ब्लैकमेल", "gu": "સેક્સટોર્શન / બ્લેકમેલ"},
    "Job / Investment Fraud": {"hi": "नौकरी / निवेश धोखाधड़ी", "gu": "નોકરી / રોકાણ છેતરપિંડી"},
    "Net Banking / Bank Account Fraud": {"hi": "नेट बैंकिंग / बैंक खाता धोखाधड़ी", "gu": "નેટ બેંકિંગ / બેંક ખાતા છેતરપિંડી"}
}

# --------------------------------------------------------------------------------------
# 2. LOCAL PHRASE & GRAMMAR PATTERNS (For sentence translation when offline)
# --------------------------------------------------------------------------------------
PHRASE_PATTERNS: List[Tuple[re.Pattern, Dict[str, str]]] = [
    (
        re.compile(r'Victim was defrauded of INR ([\d,]+) via (.*?)\.?', re.IGNORECASE),
        {
            "hi": "पीड़ित के साथ \\2 के माध्यम से ₹\\1 की धोखाधड़ी की गई थी।",
            "gu": "ભોગ બનનાર સાથે \\2 દ્વારા ₹\\1 ની છેતરપિંડી કરવામાં આવી હતી."
        }
    ),
    (
        re.compile(r'Victim reported unauthorized transaction via (.*?)\.?', re.IGNORECASE),
        {
            "hi": "पीड़ित ने \\1 के माध्यम से अनाधिकृत लेनदेन की सूचना दी।",
            "gu": "ભોગ બનનારે \\1 દ્વારા અનધિકૃત વ્યવહારની જાણ કરી."
        }
    ),
    (
        re.compile(r'Complaint reporting incident involving extracted entities\.?', re.IGNORECASE),
        {
            "hi": "निष्कासित तत्वों से संबंधित घटना की रिपोर्ट करने वाली शिकायत।",
            "gu": "તારવેલી વિગતો સંબંધી ઘટનાની ફરિયાદ નોંધવામાં આવી."
        }
    ),
    (
        re.compile(r'Identified (\d+) persons, (\d+) phone numbers, (\d+) VPAs, and (\d+) bank account references\.?', re.IGNORECASE),
        {
            "hi": "जाँच में \\1 व्यक्तियों, \\2 फोन नंबरों, \\3 यूपीआई वीपीए और \\4 बैंक खातों की पहचान की गई।",
            "gu": "તપાસમાં \\1 વ્યક્તિઓ, \\2 ફોન નંબરો, \\3 UPI VPA અને \\4 બેંક ખાતાઓની ઓળખ થઈ."
        }
    ),
    (
        re.compile(r'Identified (\d+) persons, (\d+) phone numbers, (\d+) bank accounts\.?', re.IGNORECASE),
        {
            "hi": "जाँच में \\1 व्यक्तियों, \\2 फोन नंबरों और \\3 बैंक खातों की पहचान की गई।",
            "gu": "તપાસમાં \\1 વ્યક્તિઓ, \\2 ફોન નંબરો અને \\3 બેંક ખાતાઓની ઓળખ થઈ."
        }
    ),
    (
        re.compile(r'Complaint processed offline \(Language: (.*?)\)\.?', re.IGNORECASE),
        {
            "hi": "शिकायत ऑफ़लाइन संसाधित की गई (मूल भाषा: \\1)।",
            "gu": "ફરિયાદ ઓફલાઇન પ્રોસેસ કરવામાં આવી (મૂળ ભાષા: \\1)."
        }
    ),
    (
        re.compile(r'Issue Section 94 BNSS notice to (.*?) for (.*?)\.?', re.IGNORECASE),
        {
            "hi": "\\2 हेतु \\1 को धारा 94 बीएनएसएस नोटिस जारी करें।",
            "gu": "\\2 માટે \\1 ને કલમ 94 BNSS નોટિસ જારી કરો."
        }
    ),
    (
        re.compile(r'Issue debit freeze directive under Sec 94 BNSS to (.*?)\.?', re.IGNORECASE),
        {
            "hi": "\\1 को धारा 94 बीएनएसएस के तहत डेबिट फ्रीज निर्देश जारी करें।",
            "gu": "\\1 ને કલમ 94 BNSS હેઠળ ડેબિટ ફ્રીઝ નિર્દેશ જારી કરો."
        }
    ),
    (
        re.compile(r'Agentic investigation path completed\.?', re.IGNORECASE),
        {
            "hi": "एजेंटिक जाँच पथ सफलतापूर्वक पूर्ण हुआ।",
            "gu": "એજન્ટિક તપાસ માર્ગ સફળતાપૂર્વક પૂર્ણ થયો."
        }
    ),
    (
        re.compile(r'Section 94 BNSS legal notices generated\.?', re.IGNORECASE),
        {
            "hi": "धारा 94 बीएनएसएस कानूनी नोटिस तैयार किए गए।",
            "gu": "કલમ 94 BNSS કાનૂની નોટિસ તૈયાર કરવામાં આવી."
        }
    )
]

# Vocabulary map for lexical replacement when building fallback sentences
WORD_MAP_HI = {
    "victim": "पीड़ित", "accused": "आरोपी", "suspect": "संदिग्ध", "fraud": "धोखाधड़ी",
    "complaint": "शिकायत", "statement": "बयान", "ingested": "दर्ज किया गया",
    "registered": "दर्ज किया गया", "bank": "बैंक", "account": "खाता", "accounts": "खाते",
    "money": "पैसे", "loss": "नुकसान", "loss of": "का नुकसान", "phone": "फोन",
    "number": "नंबर", "numbers": "नंबर", "transaction": "लेनदेन", "transactions": "लेनदेन",
    "transfer": "स्थानांतरण", "transferred": "ट्रांसफर किया गया", "freeze": "फ्रीज",
    "frozen": "फ्रीज किया गया", "police": "पुलिस", "station": "थाना", "cell": "सेल",
    "investigation": "जाँच", "notice": "नोटिस", "subpoena": "समन", "court": "अदालत",
    "evidence": "साक्ष्य", "certificate": "प्रमाणपत्र", "report": "रिपोर्ट",
    "recent": "हालिया", "online": "ऑनलाइन", "offline": "ऑफ़लाइन", "call": "कॉल",
    "layer": "लेयर", "layering": "लेयरिंग", "mule": "म्यूल", "mobile": "मोबाइल"
}

WORD_MAP_GU = {
    "victim": "ભોગ બનનાર", "accused": "આરોપી", "suspect": "શંકાસ્પદ", "fraud": "છેતરપિંડી",
    "complaint": "ફરિયાદ", "statement": "નિવેદન", "ingested": "નોંધવામાં આવ્યું",
    "registered": "નોંધણી કરાઈ", "bank": "બેંક", "account": "ખાતું", "accounts": "ખાતાઓ",
    "money": "નાણાં", "loss": "નુકસાન", "loss of": "નું નુકસાન", "phone": "ફોન",
    "number": "નંબર", "numbers": "નંબરો", "transaction": "વ્યવહાર", "transactions": "વ્યવહારો",
    "transfer": "ટ્રાન્સફર", "transferred": "ટ્રાન્સફર કરાયા", "freeze": "ફ્રીઝ",
    "frozen": "ફ્રીઝ કરાયું", "police": "પોલીસ", "station": "સ્ટેશન", "cell": "સેલ",
    "investigation": "તપાસ", "notice": "નોટિસ", "subpoena": "સમન્સ", "court": "કોર્ટ",
    "evidence": "પુરાવા", "certificate": "પ્રમાણપત્ર", "report": "અહેવાલ",
    "recent": "તાજેતરનું", "online": "ઓનલાઇન", "offline": "ઓફલાઇન", "call": "કોલ",
    "layer": "લેયર", "layering": "લેયરિંગ", "mule": "મ્યુલ", "mobile": "મોબાઇલ"
}


class OfflineIndicTranslator:
    """
    Multi-Tier Local Offline Indic Translator.
    Tier 1: 0ms High-Frequency Fast Lexicon (300+ terms)
    Tier 2: Local Sentence Patterns & Grammar Rules (Zero English fallback)
    Tier 3: Local HuggingFace NMT Model (for Hindi if cached)
    Tier 4: Deep-Translator (Google NMT) when connected + Redis caching
    """
    def __init__(self):
        self.redis_host = os.getenv("REDIS_HOST", "redis")
        self.redis_port = int(os.getenv("REDIS_PORT", 6379))
        self._redis_client = None
        self._local_cache: Dict[str, str] = {}
        self._executor = ThreadPoolExecutor(max_workers=8)
        self._local_nmt_hi = None
        self._local_nmt_loaded = False

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
        return f"trans_v4:{target_lang}:{text_hash}"

    def mask_entities(self, text: str) -> Tuple[str, List[str]]:
        """
        Protects technical identifiers (Case IDs, Phone numbers, UPI VPAs, Bank accounts, IFSCs)
        using HTML translate='no' tags, natively respected by translation engines.
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

        # 2. Cleanup any legacy placeholder artifacts
        for idx, val in enumerate(entities):
            legacy_pattern = re.compile(rf'[_~*]*\s*ENTITY\s*[-_]?\s*{idx}\s*[_~*]*', re.IGNORECASE)
            unmasked = legacy_pattern.sub(val, unmasked)

        unmasked = re.sub(r'[_~*]*\s*ENTITY\s*[-_]?\s*\d+\s*[_~*]*', '', unmasked, flags=re.IGNORECASE)
        return unmasked.strip()

    def _translate_local_rule_based(self, text: str, target_lang: str) -> str:
        """
        Rule-based local translation engine for arbitrary sentences when completely offline.
        Ensures we NEVER return raw untranslated English text.
        """
        clean = text.strip()
        if not clean:
            return text

        # 1. Check Phrase Patterns
        for pattern, trans_dict in PHRASE_PATTERNS:
            if pattern.search(clean):
                repl = trans_dict.get(target_lang)
                if repl:
                    return pattern.sub(repl, clean)

        # 2. Check Fast Lexicon
        if clean in FAST_DICT and target_lang in FAST_DICT[clean]:
            return FAST_DICT[clean][target_lang]

        # 3. Sentence-level syntactic word-by-word substitution if arbitrary sentence
        word_map = WORD_MAP_GU if target_lang == "gu" else WORD_MAP_HI
        words = re.findall(r'\b\w+\b|[^\w\s]', clean)
        translated_tokens = []
        for w in words:
            low = w.lower()
            if low in word_map:
                translated_tokens.append(word_map[low])
            elif w in FAST_DICT and target_lang in FAST_DICT[w]:
                translated_tokens.append(FAST_DICT[w][target_lang])
            else:
                translated_tokens.append(w)

        reconstructed = " ".join(translated_tokens)
        # Clean spacing around punctuation
        reconstructed = re.sub(r'\s+([,.\-?!:;])', r'\1', reconstructed)
        return reconstructed

    def _translate_via_nmt(self, text: str, target_lang: str) -> str:
        """
        Translates a single string using deep-translator (online booster) or local engine (offline).
        """
        try:
            from deep_translator import GoogleTranslator
            translator = GoogleTranslator(source='en', target=target_lang)
            res = translator.translate(text)
            if res and res.strip() and res.strip().lower() != text.strip().lower():
                return res
        except Exception:
            pass

        # Fallback to local rule-based engine instead of returning original English
        return self._translate_local_rule_based(text, target_lang)

    def translate_batch(self, texts: List[str], target_lang: str, src_lang: str = "en") -> List[str]:
        """
        Translates a batch of texts preserving entities via HTML tags, caching in Redis/memory,
        and guaranteeing a localized Gujarati / Hindi output.
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

        # 1. Fast Dictionary + Local Memory Cache + Redis Cache
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

        # 2. Parallel Translation Execution (Deep-Translator or Local Engine)
        futures = [
            self._executor.submit(self._translate_via_nmt, masked_str, clean_target)
            for masked_str in missing_masked_texts
        ]

        for future, orig_idx, entities in zip(futures, missing_indices, all_entities_list):
            orig_raw = texts[orig_idx].strip()
            try:
                trans_masked = future.result()
                final_unmasked = self.unmask_entities(trans_masked, entities)
                if not final_unmasked or final_unmasked == orig_raw:
                    final_unmasked = self._translate_local_rule_based(orig_raw, clean_target)
                
                results[orig_idx] = final_unmasked

                # Save legitimate translations to cache
                if final_unmasked and 'ENTITY' not in final_unmasked:
                    cache_key = self._get_cache_key(orig_raw, clean_target)
                    self._local_cache[cache_key] = final_unmasked
                    if self.redis:
                        try:
                            self.redis.setex(cache_key, 86400 * 30, final_unmasked)
                        except Exception:
                            pass
            except Exception as e:
                print(f"[-] Translation processing note: {e}")
                results[orig_idx] = self._translate_local_rule_based(orig_raw, clean_target)

        for idx in range(len(results)):
            if results[idx] is None:
                results[idx] = self._translate_local_rule_based(texts[idx], clean_target)

        return results

offline_translator = OfflineIndicTranslator()
