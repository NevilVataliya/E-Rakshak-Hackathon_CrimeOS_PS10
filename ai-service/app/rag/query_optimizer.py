import os
import re
from typing import List, Dict, Any

# Domain Trigger Dictionary mapping crime categories to statutory terms & SOP keywords
DOMAIN_TRIGGER_MAP = {
    "cyber": ["IT Act", "Section 66D", "Section 66C", "Section 66", "Section 43", "Computer Fraud", "Domain Blocking", "IP Address", "Telegram", "WhatsApp", "Phishing", "Cyber SOP", "SIM Swapping", "APK Scam"],
    "crypto": ["Cryptocurrency", "Tron Wallet", "Binance", "USDT", "Blockchain", "TxID", "Crypto SOP", "Virtual Digital Asset", "Wallet Address"],
    "financial": ["CFCFRMS", "1930 Portal", "Debit Freeze", "Mule Account", "RBI Master Direction", "Customer Liability", "KYC", "Layering", "Chargeback", "Cyber Financial Crime"],
    "cheating": ["BNS Section 318", "Section 318", "Cheating by Impersonation", "Fraudulent Inducement", "Offence Against Property", "Forgery", "Fake Document"],
    "extortion": ["BNS Section 308", "Section 308", "Extortion", "Digital Arrest", "Sextortion", "Coercion", "Blackmail"],
    "procedure": ["BNSS Section 105", "BNSS Section 94", "BNSS Section 183", "Section 105", "Section 94", "Panchnama", "Search and Seizure", "Case Diary", "FIR Registration", "Zero FIR"],
    "evidence": ["BSA Section 63", "BSA Section 61", "BSA Section 62", "Section 63", "Section 61", "Section 62", "Electronic Evidence Certificate", "Hash Value", "Chain of Custody", "Digital Forensics", "Primary Evidence", "Secondary Evidence", "Admissibility of Electronic Records", "65B Certificate"],
    "women_child": ["POCSO", "TrackChild", "Missing Child SOP", "Section 183 BNSS", "Fast Track Investigation", "Rape Investigation SOP", "POSH"],
    "police_manual": ["Gujarat Police Manual", "Police Act", "Supervision of Cases", "Duty Officer", "Station House Officer", "Investigation Standard Operating Procedure"]
}

SPECIALIST_CATEGORY_MAP = {
    "bsa_specialist": ["evidence"],
    "bns_specialist": ["cheating", "extortion"],
    "cyber_financial_intel_specialist": ["cyber", "crypto", "financial"],
    "cyber_specialist": ["cyber", "crypto", "financial"],
    "conventional_field_specialist": ["procedure", "women_child", "police_manual"],
    "conventional_specialist": ["procedure", "women_child", "police_manual"]
}

def extract_universal_legal_terms(complaint_text: str, target_specialist: str = None) -> List[str]:
    """
    Scans complaint narrative for domain triggers and returns enriched legal keywords.
    Combines domain-specific specialist triggers with high-impact universal statutory markers.
    """
    text_lower = complaint_text.lower()
    extracted_terms = set()

    allowed_categories = SPECIALIST_CATEGORY_MAP.get(target_specialist) if target_specialist else list(DOMAIN_TRIGGER_MAP.keys())

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
    to maximize dense + sparse RRF vector retrieval precision without query pollution.
    """
    legal_terms = extract_universal_legal_terms(query_text, target_specialist=target_specialist)
    if not legal_terms:
        return query_text

    terms_str = " ".join(legal_terms)
    return f"{terms_str} {query_text}".strip()
