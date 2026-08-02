import os
import re
from typing import List, Dict, Any

# Domain Trigger Dictionary mapping crime categories to statutory terms & SOP keywords
DOMAIN_TRIGGER_MAP = {
    "cyber": ["IT Act", "Section 66D", "Section 66C", "Section 66", "Section 43", "Computer Fraud", "Domain Blocking", "IP Address", "Telegram", "WhatsApp", "Phishing", "Cyber SOP", "SIM Swapping", "APK Scam", "fake link", "apk file", "otp share", "online fraud", "part time job scam"],
    "crypto": ["Cryptocurrency", "Tron Wallet", "Binance", "USDT", "Blockchain", "TxID", "Crypto SOP", "Virtual Digital Asset", "Wallet Address"],
    "financial": ["CFCFRMS", "1930 Portal", "Debit Freeze", "Mule Account", "RBI Master Direction", "Customer Liability", "KYC", "Layering", "Chargeback", "Cyber Financial Crime", "paisa nikal", "account freeze", "unauthorized transaction", "money debited", "upi fraud"],
    "cheating": ["BNS Section 318", "Section 318", "Cheating by Impersonation", "Fraudulent Inducement", "Offence Against Property", "Forgery", "Fake Document", "dhokhadhadi", "fake job", "money stolen"],
    "extortion": ["BNS Section 308", "Section 308", "Extortion", "Digital Arrest", "Sextortion", "Coercion", "Blackmail", "dhamki", "nude video", "money demanded"],
    "procedure": ["BNSS Section 105", "BNSS Section 94", "BNSS Section 183", "Section 105", "Section 94", "Panchnama", "Search and Seizure", "Case Diary", "FIR Registration", "Zero FIR", "arrest procedure", "search warrant", "inquest", "spot inspection", "panch"],
    "evidence": ["BSA Section 63", "BSA Section 61", "BSA Section 62", "Section 63", "Section 61", "Section 62", "Electronic Evidence Certificate", "Hash Value", "Chain of Custody", "Digital Forensics", "Primary Evidence", "Secondary Evidence", "Admissibility of Electronic Records", "65B Certificate", "whatsapp chat", "call recording"],
    "women_child": ["POCSO", "TrackChild", "Missing Child SOP", "Section 183 BNSS", "Fast Track Investigation", "Rape Investigation SOP", "POSH"],
    "police_manual": ["Gujarat Police Manual", "Police Act", "Supervision of Cases", "Duty Officer", "Station House Officer", "Investigation Standard Operating Procedure", "hawalat", "chowki", "maalkhana", "parade", "postmortem", "reward", "suspension", "punishment", "training institute", "bandoobast", "investigation manual"]
}

SPECIALIST_CATEGORY_MAP = {
    "bsa_specialist": ["evidence"],
    "bns_specialist": ["cheating", "extortion"],
    "cyber_financial_intel_specialist": ["cyber", "crypto", "financial"],
    "cyber_specialist": ["cyber", "crypto", "financial"],
    "conventional_field_specialist": ["procedure", "women_child", "police_manual"],
    "conventional_specialist": ["procedure", "women_child", "police_manual"]
}

BOILERPLATE_PATTERNS = [
    r'respected\s+sir\b', r'dear\s+sir\b', r'to\s+the\s+station\s+house\s+officer\b',
    r'i\s+am\s+filing\s+a\s+police\s+complaint\s+regarding:?\s*',
    r'main\s+[\w\s]+\s+police\s+station\s+mein\s+complaint\s+darj\s+karwana\s+chahta\s+hoon\.?\s*',
    r'requesting\s+immediate\s+investigation\.?\s*', r'please\s+help\s+me\.?\s*',
    r'i\s+want\s+to\s+report\s+an\s+incident\.?\s*', r'kindly\s+take\s+action\.?\s*'
]

def strip_complaint_boilerplate(text: str) -> str:
    """Strips conversational greetings and administrative boilerplate text from raw complaint."""
    cleaned = text
    for pat in BOILERPLATE_PATTERNS:
        cleaned = re.sub(pat, ' ', cleaned, flags=re.IGNORECASE)
    return re.sub(r'\s+', ' ', cleaned).strip()

def extract_universal_legal_terms(complaint_text: str, target_specialist: str = None) -> List[str]:
    """
    Scans complaint narrative for domain triggers and returns enriched legal keywords.
    Combines domain-specific specialist triggers with high-impact universal statutory markers.
    """
    text_lower = complaint_text.lower()
    extracted_terms = set()

    allowed_categories = SPECIALIST_CATEGORY_MAP.get(target_specialist) if (target_specialist and target_specialist in SPECIALIST_CATEGORY_MAP) else list(DOMAIN_TRIGGER_MAP.keys())

    for category in allowed_categories:
        terms = DOMAIN_TRIGGER_MAP.get(category, [])
        for term in terms:
            if term.lower() in text_lower:
                extracted_terms.add(term)

    # Always scan high-impact universal statutory terms
    universal_keywords = ["BNS", "BSA", "BNSS", "IT Act", "SOP", "CFCFRMS", "1930", "Section", "Certificate", "Panchnama"]
    for uk in universal_keywords:
        if uk.lower() in text_lower:
            extracted_terms.add(uk)

    # Extract any explicit Section references (e.g., 'Section 318', 'u/s 66D')
    sec_matches = re.findall(r'\b(?:Section|Sec|u/s)\s*\d+[A-Z]?(?:\(\d+\))?', complaint_text, re.IGNORECASE)
    for sm in sec_matches:
        extracted_terms.add(sm)

    return sorted(list(extracted_terms))

def enrich_query_for_universal_rag(query_text: str, target_specialist: str = None) -> str:
    """
    Enriches user query or complaint narrative with domain-targeted legal keywords
    and strips conversational noise to maximize dense + sparse RRF vector retrieval precision.
    """
    clean_query = strip_complaint_boilerplate(query_text)
    legal_terms = extract_universal_legal_terms(query_text, target_specialist=target_specialist)
    if not legal_terms:
        return clean_query

    terms_str = " ".join(legal_terms)
    return f"{terms_str} {clean_query}".strip()

SPECIALIST_ALIAS_MAP_LOCAL = {
    "cyber_specialist": "cyber_financial_intel_specialist",
    "conventional_specialist": "conventional_field_specialist"
}

def detect_dynamic_specialist_weights(query_text: str, target_specialist: str = None) -> Dict[str, float]:
    """
    Analyzes complaint text against statutory trigger terms to detect dynamic relevance weights 
    for each specialist domain.
    Returns a dict mapping specialist -> weight (e.g. {'cyber_financial_intel_specialist': 0.9, 'bns_specialist': 0.8, ...})
    """
    if target_specialist and target_specialist != "multi_specialist":
        canonical_spec = SPECIALIST_ALIAS_MAP_LOCAL.get(target_specialist, target_specialist)
        if canonical_spec in ["cyber_financial_intel_specialist", "bns_specialist", "bsa_specialist", "conventional_field_specialist"]:
            return {canonical_spec: 1.0}

    text_lower = query_text.lower()
    weights: Dict[str, float] = {
        "cyber_financial_intel_specialist": 0.0,
        "bns_specialist": 0.0,
        "bsa_specialist": 0.0,
        "conventional_field_specialist": 0.0
    }

    for spec, categories in SPECIALIST_CATEGORY_MAP.items():
        canonical_spec = SPECIALIST_ALIAS_MAP_LOCAL.get(spec, spec)
        if canonical_spec not in weights:
            continue
        spec_hits = 0
        for cat in categories:
            triggers = DOMAIN_TRIGGER_MAP.get(cat, [])
            for trg in triggers:
                if trg.lower() in text_lower:
                    spec_hits += 1
        if spec_hits > 0:
            weights[canonical_spec] += (0.4 + 0.15 * spec_hits)

    total_w = sum(weights.values())
    if total_w == 0:
        return {
            "cyber_financial_intel_specialist": 0.35,
            "bns_specialist": 0.35,
            "bsa_specialist": 0.15,
            "conventional_field_specialist": 0.15
        }

    return weights

def decompose_multi_aspect_query(query_text: str) -> Dict[str, str]:
    """
    Decomposes a multi-aspect complaint or query into domain-specific sub-queries
    for targeted vector embedding retrieval across legal domains.
    """
    clean_text = strip_complaint_boilerplate(query_text)
    
    # 1. Check for explicit aspect markers (capturing full aspect snippet up to next aspect header or prompt end)
    aspect_patterns = {
        "cyber_financial_intel_specialist": [
            r'(?:cyber\s*(?:fraud|financial|intel)?\s*(?:aspect|crime)?:?)\s*(.*?)(?=\s*(?:penal|electronic|field|procedural|kripya|requesting)|$)',
        ],
        "bns_specialist": [
            r'(?:penal\s*(?:crime|offence)?\s*(?:aspect)?|penal\s*offence:?)\s*(.*?)(?=\s*(?:cyber|electronic|field|procedural|kripya|requesting)|$)',
        ],
        "bsa_specialist": [
            r'(?:electronic\s*evidence\s*(?:aspect)?)\s*(.*?)(?=\s*(?:cyber|penal|field|procedural|kripya|requesting)|$)',
        ],
        "conventional_field_specialist": [
            r'(?:field\s*panchnama\s*(?:aspect)?|procedural\s*rule:?)\s*(.*?)(?=\s*(?:cyber|penal|electronic|kripya|requesting)|$)',
        ]
    }

    sub_queries: Dict[str, str] = {}
    
    # Domain specific anchor prefix prompts to guide bge-m3 dense vector matching
    domain_anchors = {
        "cyber_financial_intel_specialist": "Cyber Financial Crime Investigation SOP IT Act CFCFRMS 1930 Portal Debit Freeze Mule Account",
        "bns_specialist": "Bharatiya Nyaya Sanhita BNS Penal Offence Section Cheating Impersonation Fraud Extortion Forgery",
        "bsa_specialist": "Bharatiya Sakshya Adhiniyam BSA Section 63 Electronic Evidence Certificate Hash Value Chain of Custody",
        "conventional_field_specialist": "Gujarat Police Manual BNSS Section 105 Panchnama Search Seizure Spot Inspection Case Diary SOP"
    }

    # Sentence segmentation for domain text attribution
    sentences = re.split(r'[.!?\n]+', clean_text)

    for domain, anchor in domain_anchors.items():
        domain_snippet = ""
        # Check explicit aspect regex first
        for pat in aspect_patterns.get(domain, []):
            match = re.search(pat, clean_text, re.IGNORECASE | re.DOTALL)
            if match:
                extracted = match.group(1).strip()
                # Ensure extracted string is meaningful (> 10 chars)
                if len(extracted) > 10:
                    domain_snippet = extracted.replace("\n", " ").strip()
                    break

        # Fall back to sentence scanning if regex didn't hit
        if not domain_snippet:
            matched_sentences = []
            allowed_cats = SPECIALIST_CATEGORY_MAP.get(domain, [])
            domain_triggers = set()
            for cat in allowed_cats:
                domain_triggers.update([t.lower() for t in DOMAIN_TRIGGER_MAP.get(cat, [])])

            for s in sentences:
                s_lower = s.lower()
                if any(trg in s_lower for trg in domain_triggers):
                    matched_sentences.append(s.strip())

            if matched_sentences:
                domain_snippet = " ".join(matched_sentences[:3])

        # Extract legal terms for this domain
        legal_terms = extract_universal_legal_terms(clean_text, target_specialist=domain)
        terms_str = " ".join(legal_terms) if legal_terms else ""

        if domain_snippet:
            sub_queries[domain] = f"{terms_str} {domain_snippet}".strip()
        elif terms_str:
            sub_queries[domain] = f"{anchor} {terms_str} {clean_text[:300]}".strip()
        else:
            sub_queries[domain] = f"{anchor} {clean_text[:400]}".strip()

    return sub_queries



