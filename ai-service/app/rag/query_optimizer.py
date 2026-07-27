import os
import re
from typing import List, Dict, Any

# Domain Trigger Dictionary mapping crime categories to statutory terms & SOP keywords
DOMAIN_TRIGGER_MAP = {
    "cyber": ["IT Act", "Section 66D", "Section 66C", "Computer Fraud", "Domain Blocking", "IP Address", "Telegram", "WhatsApp", "Phishing"],
    "crypto": ["Cryptocurrency", "Tron Wallet", "Binance", "USDT", "Blockchain", "TxID", "Crypto SOP"],
    "financial": ["CFCFRMS", "1930 Portal", "Debit Freeze", "Mule Account", "RBI Master Direction", "Customer Liability", "KYC"],
    "cheating": ["BNS Section 318", "Cheating by Impersonation", "Fraudulent Inducement", "Offence Against Property"],
    "extortion": ["BNS Section 308", "Extortion", "Digital Arrest", "Sextortion", "Coercion"],
    "procedure": ["BNSS Section 105", "BNSS Section 94", "Panchnama", "Search and Seizure", "Case Diary"],
    "evidence": ["BSA Section 63", "Electronic Evidence Certificate", "Hash Value", "Chain of Custody", "Digital Forensics"],
    "women_child": ["POCSO", "TrackChild", "Missing Child SOP", "Section 183 BNSS", "Fast Track Investigation"]
}

def extract_universal_legal_terms(complaint_text: str) -> List[str]:
    """
    Scans complaint narrative for domain triggers and returns enriched legal keywords.
    """
    text_lower = complaint_text.lower()
    extracted_terms = set()

    for category, terms in DOMAIN_TRIGGER_MAP.items():
        for term in terms:
            if term.lower() in text_lower:
                extracted_terms.add(term)

    # Also extract any explicit Section references (e.g., 'Section 318', 'u/s 66D')
    sec_matches = re.findall(r'\b(?:Section|Sec|u/s)\s*\d+[A-Z]?(?:\(\d+\))?', complaint_text, re.IGNORECASE)
    for sm in sec_matches:
        extracted_terms.add(sm)

    return sorted(list(extracted_terms))

def enrich_query_for_universal_rag(query_text: str) -> str:
    """
    Enriches user query or complaint narrative with universal legal keywords
    to maximize dense + sparse RRF vector retrieval precision across all domains.
    """
    legal_terms = extract_universal_legal_terms(query_text)
    if not legal_terms:
        return query_text

    terms_str = " ".join(legal_terms)
    return f"{terms_str} {query_text}".strip()
