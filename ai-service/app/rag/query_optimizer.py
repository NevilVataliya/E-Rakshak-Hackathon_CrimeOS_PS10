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

SPECIALIST_DOMAIN_KEYWORDS = {
    "bns_specialist": ["Bharatiya Nyaya Sanhita", "BNS", "Penal Code", "IPC", "Offence", "Cheating", "Punishment", "Fraud", "Extortion", "Forgery", "Impersonation", "Theft", "Criminal Breach of Trust"],
    "bsa_specialist": ["Bharatiya Sakshya Adhiniyam", "BSA", "Evidence", "Section 63", "Certificate 63", "Hash Value", "Digital Forensics", "Chain of Custody", "Electronic Record", "Proof", "Admissibility", "Witness Statement"],
    "cyber_specialist": ["Information Technology Act", "IT Act", "Section 66D", "Section 66C", "Cyber Crime", "Telegram", "WhatsApp", "UPI Fraud", "VPA", "Bank Account Freeze", "1930 Portal", "Mule Account", "Phishing", "IP Address", "CFCFRMS"],
    "conventional_specialist": ["BNSS", "Bharatiya Nagarik Suraksha Sanhita", "Procedure", "Search and Seizure", "Panchnama", "CCTV Camera", "Spot Inspection", "FIR Registration", "Arrest Memo", "Case Diary", "Police Manual", "BPRD SOP"]
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

def decompose_query_for_specialist(complaint_text: str, target_specialist: str, crime_sub_type: str = "", entities: dict = None) -> str:
    """
    Extracts dynamic narrative sentences, domain-specific triggers, and entities
    tailored to the requesting specialist domain WITHOUT hardcoding static act names.
    Searches across the full legal corpus without vector bias.
    """
    spec = str(target_specialist).lower().strip()
    entities = entities or {}
    
    # Domain specific intent triggers from narrative
    if "cyber" in spec:
        spec_triggers = ["vpa", "upi", "bank", "account", "phone", "telegram", "whatsapp", "online", "fraud", "ip", "url", "portal", "1930", "digital", "message"]
    elif "bsa" in spec or "evidence" in spec:
        spec_triggers = ["evidence", "certificate", "record", "statement", "hash", "proof", "seizure", "admissibility", "witness", "notice", "electronic"]
    elif "conventional" in spec or "procedural" in spec:
        spec_triggers = ["procedure", "investigation", "panchnama", "cctv", "spot", "fir", "diary", "warrant", "summon", "court", "hearing", "application", "police"]
    else: # bns / penal
        spec_triggers = ["cheating", "fraud", "extortion", "impersonation", "theft", "loss", "deception", "threat", "money", "rupees", "husband", "wife", "marriage", "property"]

    # Extract matching sentences from narrative
    sentences = [s.strip() for s in re.split(r'[.!?\n]', complaint_text) if s.strip()]
    relevant_sentences = []
    
    for sentence in sentences:
        s_lower = sentence.lower()
        if any(trig in s_lower for trig in spec_triggers):
            relevant_sentences.append(sentence)

    extracted_context = " ".join(relevant_sentences[:3]) if relevant_sentences else complaint_text[:300]
    
    # Collect extracted entities relevant to domain
    entity_terms = []
    if "cyber" in spec:
        if entities.get('vpas_upis'): entity_terms.extend(entities['vpas_upis'])
        if entities.get('phone_numbers'): entity_terms.extend(entities['phone_numbers'])
        if entities.get('bank_accounts'):
            for b in entities['bank_accounts']:
                if isinstance(b, dict) and b.get('account_number'):
                    entity_terms.append(b['account_number'])
    elif "bsa" in spec:
        entity_terms = ["electronic evidence", "hash certificate", "chain of custody"]

    entity_str = " ".join(entity_terms)

    # Extract any explicit section references mentioned in text
    sec_matches = re.findall(r'\b(?:Section|Sec|u/s)\s*\d+[A-Z]?(?:\(\d+\))?', complaint_text, re.IGNORECASE)
    sec_str = " ".join(sec_matches)

    full_subquery = f"{sec_str} {entity_str} {crime_sub_type} {extracted_context}".strip()
    return full_subquery

def canonicalize_section_string(text: str) -> List[str]:
    """
    Extracts and canonicalizes statutory section references from query or chunk text.
    Examples: 'Section 66D' -> '66D', 'u/s 66(D)' -> '66D', 'Sec 318-4' -> '318(4)'
    """
    raw_matches = re.findall(r'\b(?:Section|Sec|u/s|sec\.)\s*(\d+[A-Z]?(?:\(\d+\))?)', text, re.IGNORECASE)
    canonical_sections = []
    for m in raw_matches:
        clean = re.sub(r'[\s\-\(\)]', '', m).upper()
        if clean:
            canonical_sections.append(clean)
    return list(set(canonical_sections))

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

