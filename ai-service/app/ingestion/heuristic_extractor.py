import re
import time
from typing import Dict, Any, List

# Common email TLDs to exclude from VPA detection
_EMAIL_TLDS = re.compile(
    r'@(?:gmail|yahoo|hotmail|outlook|rediffmail|ymail|icloud|protonmail|'
    r'gov|nic|police|cbi|mha|edu|ac|org|net|co|in|com)\b',
    re.IGNORECASE
)

# Gujarati/Hindi/Devanagari digits to ASCII mapping
_INDIC_DIGIT_MAP = {
    '૦': '0', '૧': '1', '૨': '2', '૩': '3', '૪': '4',
    '૫': '5', '૬': '6', '૭': '7', '૮': '8', '૯': '9',  # Gujarati
    '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
    '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',  # Devanagari/Hindi
}

# Regex matching sequences of ASCII + Indic digits with commas/dots
_INDIC_NUM_RE = re.compile(
    r'[\d\u0A80-\u0AFF\u0900-\u097F][\d,\u0A80-\u0AFF\u0900-\u097F]*'
)


def _normalize_indic_digits(num_str: str) -> str:
    """Convert Gujarati/Hindi (Indic) digits in a string to ASCII digits."""
    return ''.join(_INDIC_DIGIT_MAP.get(ch, ch) for ch in num_str)


# Comprehensive pattern for prefix, suffix, and Gujarati/Hindi digits + decimals
MONEY_REGEX = re.compile(
    r'(?:'
    # Pattern 1: Currency prefix followed by amount (e.g., ₹ 500.00, Rs. 1,000, રૂ. ૯,૦૦,૦૦૦)
    r'(?:(?:\b(?:rs\.?|inr|rupees|રુપયે|रुपये)\b|રૂ\.?|रू\.?|₹)[.\s]*)'
    r'([\d,\u0966-\u096F\u0AE6-\u0AEF]+(?:\.\d{1,2})?)'
    r'|'
    # Pattern 2: Amount followed by currency suffix or /- (e.g., 500/- , 1000 રૂપિયા, ૯,૦૦,૦૦૦/-)
    r'([\d,\u0966-\u096F\u0AE6-\u0AEF]+(?:\.\d{1,2})?)'
    r'(?:[.\s]*(?:(?:/-|\b(?:rs\.?|inr|rupees|રૂપિયા|રૂ|રુપયે|रुपये|रू)\b|₹)))'
    r')',
    re.IGNORECASE
)


def extract_monetary_amounts(text: str) -> List[float]:
    """Extract all valid monetary amounts from text supporting Indic digits and /- suffixes."""
    matches = MONEY_REGEX.findall(text)
    raw_amount_strings = [g1 or g2 for g1, g2 in matches if (g1 or g2)]
    amounts = []
    for raw_str in raw_amount_strings:
        num_ascii = _normalize_indic_digits(raw_str)
        if '.' in num_ascii:
            int_part, dec_part = num_ascii.split('.', 1)
            clean_int = re.sub(r'[^\d]', '', int_part)
            clean_dec = re.sub(r'[^\d]', '', dec_part)[:2]
            if clean_int.isdigit():
                val = float(f"{clean_int}.{clean_dec}")
                if val > 0:
                    amounts.append(val)
        else:
            clean_int = re.sub(r'[^\d]', '', num_ascii)
            if clean_int.isdigit() and int(clean_int) > 0:
                amounts.append(float(int(clean_int)))
    return amounts


def _parse_indic_amount(raw: str) -> float:
    """
    Parse maximum monetary amount from text that may contain Gujarati/Hindi digits.
    Handles Indian number format (lakhs/crores) correctly: ૯,૦૦,૦૦૦ = 9,00,000.
    Returns 0.0 if no valid amount found.
    """
    amounts = extract_monetary_amounts(raw)
    return max(amounts) if amounts else 0.0

# Indian city names for location extraction heuristic
_INDIAN_CITIES = [
    "surat", "ahmedabad", "vadodara", "rajkot", "mumbai", "delhi", "bangalore",
    "hyderabad", "chennai", "kolkata", "pune", "jaipur", "lucknow", "kanpur",
    "nagpur", "indore", "bhopal", "patna", "chandigarh", "haryana", "gujarat",
    "maharashtra", "rajasthan", "andhra", "kerala", "karnataka", "thailand",
    "navabwada", "raopura", "andheri", "karelibagh"
]

# Alias keywords across languages
_ALIAS_KEYWORDS = re.compile(
    r'(?:urfé|urfe|alias|urf|ઉર્ફ|उर्फ)\s+([A-Za-z\u0A80-\u0AFF\u0900-\u097F]+)',
    re.IGNORECASE
)


def _extract_vpa_heuristic(raw: str) -> List[str]:
    """
    Extracts UPI VPAs from text, filtering out standard email addresses.
    VPAs follow the pattern: handle@upihandle (e.g. name@paytm, name@ybl)
    """
    candidates = re.findall(r'[a-zA-Z0-9.\-_]{3,}@[a-zA-Z0-9.]{2,}', raw)
    vpas = []
    for c in candidates:
        # Skip if it looks like a standard email domain
        if _EMAIL_TLDS.search(c):
            continue
        # VPA handles are typically short and don't have multiple dots after @
        after_at = c.split('@', 1)[1]
        if '.' not in after_at or len(after_at.split('.')[-1]) <= 3:
            vpas.append(c)
    return list(set(vpas))


def _extract_persons_heuristic(raw: str) -> List[Dict[str, Any]]:
    """
    Basic person extraction for offline/fallback mode.
    Looks for S/O patterns, alias patterns, and names near role keywords.
    """
    persons = []
    seen = set()

    # Pattern 1: "Name S/O Father_Name" — standard Indian legal format
    so_pattern = re.findall(
        r'([A-Z][a-z]+(?: [A-Z][a-z]+){1,3})\s+[Ss][/\\][Oo]\.?\s+([A-Z][a-z]+(?: [A-Z][a-z]+){0,2})',
        raw
    )
    for match in so_pattern:
        name = match[0].strip()
        father = match[1].strip()
        if name.lower() not in seen:
            seen.add(name.lower())
            persons.append({
                "name": name,
                "alias": None,
                "role": "accused",
                "father_name": father,
                "age": None,
                "address": None,
                "status": None
            })

    # Pattern 2: alias detection — "Name urfé AliasName"
    for m in _ALIAS_KEYWORDS.finditer(raw):
        alias_val = m.group(1).strip()
        # Try to find the real name before the alias keyword
        start = max(0, m.start() - 60)
        context = raw[start:m.start()]
        name_match = re.search(r'([A-Z][a-z]+(?: [A-Z][a-z]+){0,2})\s*$', context)
        if name_match:
            real_name = name_match.group(1).strip()
            if real_name.lower() not in seen:
                seen.add(real_name.lower())
                persons.append({
                    "name": real_name,
                    "alias": alias_val,
                    "role": "accused",
                    "father_name": None,
                    "age": None,
                    "address": None,
                    "status": None
                })

    # Pattern 3: "absconding" / "untraceable" near a name
    for keyword in ["absconding", "untraceable", "not found", "not traced"]:
        for m in re.finditer(re.escape(keyword), raw, re.IGNORECASE):
            start = max(0, m.start() - 80)
            context = raw[start:m.start()]
            name_match = re.search(r'([A-Z][a-z]+(?: [A-Z][a-z]+){1,2})\s*$', context)
            if name_match:
                name = name_match.group(1).strip()
                if name.lower() not in seen:
                    seen.add(name.lower())
                    persons.append({
                        "name": name,
                        "alias": None,
                        "role": "accused",
                        "father_name": None,
                        "age": None,
                        "address": None,
                        "status": keyword.replace(" ", "_")
                    })

    return persons


# Statute prefixes that may appear in FIRs / complaint documents
_STATUTE_PREFIXES = [
    "bharaitya nyaya sanhita",
    "bharatiya nyaya sanhita",
    "bns",
    "indian penal code",
    "ipc",
    "information technology act",
    "it act",
    "it",
    "crpc",
    "bnss",
    "dowry prohibition act",
    "protection of children from sexual offences act",
    "posco",
]


def _extract_legal_sections_heuristic(raw: str) -> List[str]:
    """
    Deterministic extraction of legal sections EXACTLY as stated in the document,
    preserving the original statute prefix (IPC, IT Act, BNS, etc.).

    This is a pure rule-based parser (NO LLM) — it reads the raw text and returns
    sections verbatim, e.g.:
      - "IPC sections 388, 170, 465, 467, 468, 471, 120(B), 34" ->
          ["IPC 388", "IPC 170", "IPC 465", "IPC 467", "IPC 468", "IPC 471", "IPC 120(B)", "IPC 34"]
      - "IT Act sections 66(C), 66(D)" -> ["IT Act 66(C)", "IT Act 66(D)"]
      - "under BNS 318 and BNS 351" -> ["BNS 318", "BNS 351"]

    It deliberately does NOT attempt to map IPC -> BNS or renumber anything.
    """
    if not raw:
        return []

    # Normalize whitespace / line breaks to single spaces for easier matching
    text = re.sub(r'\s+', ' ', raw)

    # Build a combined regex for statute prefixes (longest first to avoid partial matches)
    prefix_pattern = '|'.join(
        re.escape(p) for p in sorted(_STATUTE_PREFIXES, key=len, reverse=True)
    )

    # Match a statute prefix, optionally followed by "section(s)" / "sec" / "s.",
    # then capture a list of section tokens separated by commas, "&", or "and".
    # The list naturally stops at the next statute prefix or non-section content.
    section_list_re = re.compile(
        rf'(?P<prefix>{prefix_pattern})\s+(?:sec(?:tions?|s)?\.?|sections?|s\.?)?\s*'
        rf'(?P<sections>(?:\d{{1,4}}(?:\([A-Za-z0-9]+\))?[A-Za-z]?'
        rf'(?:\s*[,;&]\s*|\s+and\s+|\s*-\s*)?)+)',
        re.IGNORECASE
    )

    # Also match standalone "IPC 388" / "BNS 318" / "IT Act 66D" style mentions
    standalone_re = re.compile(
        rf'(?P<prefix>{prefix_pattern})\s+'
        rf'(?P<sec>\d{{1,4}}(?:\([A-Za-z0-9]+\))?[A-Za-z]?)\b',
        re.IGNORECASE
    )

    found = []
    seen = set()

    def _canonical_prefix(prefix: str) -> str:
        p = prefix.strip().lower()
        if p in ("bharatiya nyaya sanhita", "bharaitya nyaya sanhita", "bns"):
            return "BNS"
        if p in ("indian penal code", "ipc"):
            return "IPC"
        if p in ("information technology act", "it act", "it"):
            return "IT Act"
        if p in ("crpc",):
            return "CrPC"
        if p in ("bnss",):
            return "BNSS"
        if p in ("dowry prohibition act",):
            return "Dowry Prohibition Act"
        if p in ("protection of children from sexual offences act", "posco"):
            return "POCSO"
        return prefix.strip().title()

    def _add(prefix: str, section: str) -> None:
        # Clean the section token: remove stray commas/spaces but keep internal parens/letters
        section = section.strip().rstrip(',').strip()
        section = re.sub(r'\s+', '', section)
        if not section:
            return
        # Only accept valid section shapes: digits (1-4), optional trailing letter, optional (X) suffix
        if not re.match(r'^\d{1,4}(?:\([A-Za-z0-9]+\))?[A-Za-z]?$', section):
            return
        label = f"{_canonical_prefix(prefix)} {section}"
        if label not in seen:
            seen.add(label)
            found.append(label)

    # First pass: match statute prefix + section list, then split the list into tokens
    for m in section_list_re.finditer(text):
        prefix = m.group('prefix')
        sections_str = m.group('sections')
        # Split on commas / semicolons / "and" / "&"
        tokens = re.split(r'\s*[,;&]\s*|\s+and\s+', sections_str)
        for tok in tokens:
            tok = tok.strip().rstrip(',').strip()
            if not tok:
                continue
            # Each token may be "388", "120(B)", "66(C)", "66D", "34", etc.
            _add(prefix, tok)

    # Second pass: standalone mentions not already captured (e.g. "under BNS 318")
    for m in standalone_re.finditer(text):
        prefix = m.group('prefix')
        sec = m.group('sec')
        _add(prefix, sec)

    return found


def extract_entities_heuristic(text: str, fallback_reason: str = None) -> Dict[str, Any]:
    """
    Rule-based & Regex Heuristic Entity Extractor for CrimeOS.
    Executes 100% locally and offline without cloud API calls.
    Extracts actual phone numbers, VPAs/UPIs, monetary loss, bank accounts,
    handles, persons with aliases, and language.
    Does NOT inject hardcoded fake mock data.
    """
    raw = text or ""

    # 1. Language Detection (Gujarati, Hindi, English)
    lang = "en"
    if re.search(r'[\u0A80-\u0AFF]', raw):
        lang = "gu"
    elif re.search(r'[\u0900-\u097F]', raw):
        lang = "hi"

    # 2. Extract Phone Numbers (+91 9876543210, 9876543210, international etc.)
    phones = list(set(re.findall(r'\+?[\d]{1,3}[-.\s]?\d{5}[-.\s]?\d{5}|\+?\d{10,13}', raw)))

    # 3. Extract UPI VPAs — filter out standard email addresses (Bug #4 fix)
    vpas = _extract_vpa_heuristic(raw)

    # 4. Extract Social Handles / Telegram IDs (e.g. @CCMB_B4, @CyberCrime)
    handles = list(set(re.findall(r'@[a-zA-Z0-9_]{3,}', raw)))

    # 5. Extract Monetary Loss (Rs. 85,000 / ₹85000 / 85000 INR / Gujarati/Hindi variants)
    # Supports Indic (Gujarati/Hindi) digits: રૂ.૯,૦૦,૦૦૦ = 9,00,000 (nine lakhs)
    loss = int(_parse_indic_amount(raw))

    # 6. Extract Bank Account Numbers (9–18 digit sequences)
    all_num_str = re.findall(r'\b\d{9,18}\b', raw)
    accounts = []
    seen_accts = set()
    phone_digits = {re.sub(r'\D', '', p) for p in phones}
    for num in all_num_str:
        clean_num = num.replace(" ", "").replace("-", "")
        if (clean_num not in phone_digits
                and not clean_num.startswith("91")
                and len(clean_num) >= 9
                and clean_num not in seen_accts):
            seen_accts.add(clean_num)
            accounts.append({
                "account_number": clean_num,
                "ifsc": "UNKNOWN",
                "bank": "Bank Account",
                "account_name": "Accused / Suspect",
                "account_role": "accused",
                "is_victim_account": False
            })

    # 7. Extract persons heuristically (Bug #6 fix)
    persons = _extract_persons_heuristic(raw)

    # 8. Extract crime locations from known Indian city/state list
    raw_lower = raw.lower()
    locations = [city.title() for city in _INDIAN_CITIES if city in raw_lower]
    if not locations:
        locations = ["India"]

    # 9. Crime sub-type determination
    sub_type = "Cyber Financial Fraud"
    if any(k in raw_lower for k in ["custom", "customs", "mdma", "parcel", "telegram", "cbi", "digital arrest"]):
        sub_type = "Digital Arrest & Impersonation Fraud"
    elif any(k in raw_lower for k in ["sextortion", "blackmail", "obscene", "video", "nude"]):
        sub_type = "Sextortion / Blackmail"
    elif any(k in raw_lower for k in ["job", "employment", "work from home"]):
        sub_type = "Job / Investment Fraud"
    elif vpas:
        sub_type = "UPI Financial Fraud"
    elif "bank" in raw_lower or accounts:
        sub_type = "Net Banking / Bank Account Fraud"

    translated = raw if lang == "en" else (
        f"[Offline Translation ({lang.upper()})]: Complaint reporting incident involving extracted entities. "
        f"Identified {len(persons)} persons, {len(phones)} phone numbers, {len(accounts)} bank accounts."
    )

    complaint_num = f"CMP-{int(time.time())}"

    # Deterministic legal-section extraction (preserves statute prefix exactly as stated)
    legal_sections = _extract_legal_sections_heuristic(raw)

    return {
        "complaint_number": complaint_num,
        "original_language": lang,
        "translated_text": translated,
        "crime_category": (
            "CYBER" if (vpas or "upi" in raw_lower or "fraud" in raw_lower or "cyber" in raw_lower)
            else "CONVENTIONAL"
        ),
        "crime_sub_type": sub_type,
        "severity_score": 8.5 if loss >= 50000 or "arrest" in raw_lower else 6.0,
        "bns_sections_identified": legal_sections,
        "entities": {
            "persons": persons,
            "phone_numbers": phones,
            "email_addresses": [],
            "online_handles": handles,
            "bank_accounts": accounts,
            "vpas_upis": vpas,
            "monetary_loss": loss,
            "money_trail": [],
            "crime_locations": list(dict.fromkeys(locations)),  # preserve order, deduplicate
            "date_time_of_incident": "Recent"
        },
        "key_facts": [
            f"Complaint processed offline (Language: {lang.upper()}).",
            f"Identified {len(persons)} persons, {len(phones)} phone numbers, "
            f"{len(vpas)} VPAs, and {len(accounts)} bank account references."
        ],
        "raw_text": raw,
        "fallback_used": True,
        "fallback_reason": fallback_reason or "Executed via local heuristic extraction engine (Offline Mode)."
    }
