"""
Crime OS AI — LLM-Powered Multi-Query Decomposition + HyDE Engine

Phase 1: Decomposes a single victim complaint into 3-5 precise legal search queries
         using formal statutory terminology to bridge the semantic gap between informal
         Hinglish narratives and formal legal document text.

Phase 2: For each decomposed query, generates a short hypothetical legal text passage
         (~80-120 words) that WOULD appear in the target legal document. This hypothetical
         passage is embedded instead of the raw query, placing the search vector in the
         same semantic region as the actual legal chunks.

Combined, these two techniques attack:
  - Root Cause #1: Semantic gap between victim language and legal language
  - Root Cause #2: Single-query bottleneck (one embedding can only match one semantic cluster)
"""

import json
import threading
from typing import List, Dict, Any, Optional
from config import get_agent_llm, ENABLE_DEMO_FALLBACKS

_decomposer_llm = None
_decomposer_lock = threading.Lock()

def _get_decomposer_llm():
    """Thread-safe singleton LLM for query decomposition. Uses low temperature for deterministic output."""
    global _decomposer_llm
    if _decomposer_llm is None:
        with _decomposer_lock:
            if _decomposer_llm is None:
                _decomposer_llm = get_agent_llm("auto", temperature=0.1)
    return _decomposer_llm


def decompose_complaint_to_legal_queries(
    complaint_text: str,
    crime_sub_type: str = "",
    crime_category: str = "",
    entities: Optional[Dict[str, Any]] = None,
    specialist_domain: str = "",
    max_queries: int = 4
) -> List[Dict[str, str]]:
    """
    Decomposes a victim complaint narrative into multiple precise legal search queries.
    Each query targets a different statutory/procedural aspect of the case.

    Returns a list of dicts, each containing:
      - "query": The formal legal search query (for BM25 sparse matching)
      - "hyde_passage": A hypothetical document passage (for dense vector embedding)
      - "intent": Brief description of what this sub-query targets

    If the LLM call fails, falls back to a rule-based decomposition.
    """
    if not complaint_text or len(complaint_text.strip()) < 10:
        return _fallback_decomposition(complaint_text, crime_sub_type, crime_category)

    entities_str = ""
    if entities:
        entity_parts = []
        if entities.get('vpas_upis'):
            entity_parts.append(f"UPI/VPAs: {', '.join(entities['vpas_upis'])}")
        if entities.get('phone_numbers'):
            entity_parts.append(f"Phone Numbers: {', '.join(entities['phone_numbers'])}")
        if entities.get('bank_accounts'):
            entity_parts.append(f"Bank Accounts: {json.dumps(entities['bank_accounts'])}")
        entities_str = "; ".join(entity_parts) if entity_parts else "None extracted"

    prompt = f"""You are an expert Indian Legal Research Query Analyst for Law Enforcement RAG systems.

TASK: Decompose the following police complaint into {max_queries} precise legal search queries that will retrieve the EXACT relevant legal document chunks from a vector database containing:
- Bharatiya Nyaya Sanhita (BNS), 2023 — Penal Code
- Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023 — Criminal Procedure
- Bharatiya Sakshya Adhiniyam (BSA), 2023 — Evidence Act
- Information Technology Act, 2000
- CFCFRMS Financial Fraud SOP (1930 Portal)
- BPRD Cryptocurrency Investigation SOP
- Gujarat Police Manual & Act
- RBI KYC / Customer Liability Circulars
- POCSO / Missing Child SOP
- Telecommunications Act, 2023
- SOP for Investigation of Rape Cases
- DPDP Act, 2023

COMPLAINT NARRATIVE:
{complaint_text[:1500]}

CRIME SUB-TYPE: {crime_sub_type or 'Unknown'}
CRIME CATEGORY: {crime_category or 'Unknown'}
EXTRACTED ENTITIES: {entities_str or 'None'}
SPECIALIST DOMAIN HINT: {specialist_domain or 'General'}

CRITICAL INSTRUCTIONS:
1. Each query MUST use FORMAL LEGAL TERMINOLOGY as it appears in Indian statutes (e.g., "Section 318 BNS cheating by personation" NOT "someone tricked me").
2. Each query should target a DIFFERENT legal aspect (e.g., one for penal sections, one for procedural requirements, one for investigation SOP steps).
3. For each query, write a "hyde_passage" — a SHORT hypothetical paragraph (80-120 words) that would ACTUALLY APPEAR in the target legal document. Write it in the style of Indian legal text with section numbers, definitions, and provisions.
4. Generate exactly {max_queries} queries.

Respond ONLY in valid JSON:
{{
  "queries": [
    {{
      "query": "<FORMAL_LEGAL_SEARCH_QUERY_WITH_SECTION_NUMBERS_AND_STATUTORY_TERMS>",
      "hyde_passage": "<HYPOTHETICAL_80_120_WORD_PASSAGE_IN_STYLE_OF_TARGET_LEGAL_DOCUMENT>",
      "intent": "<BRIEF_DESCRIPTION_OF_WHAT_THIS_QUERY_TARGETS>"
    }}
  ]
}}"""

    try:
        llm = _get_decomposer_llm()
        resp = llm.invoke(prompt)
        text = resp.content if hasattr(resp, 'content') else str(resp)

        # Parse JSON response — handle markdown code fences
        text = text.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1]) if lines[-1].strip() == "```" else "\n".join(lines[1:])
        if text.startswith("```json"):
            text = text[7:]
        if text.endswith("```"):
            text = text[:-3]

        try:
            data = json.loads(text.strip())
        except json.JSONDecodeError:
            # Try json-repair as fallback
            try:
                from json_repair import repair_json
                repaired = repair_json(text.strip(), return_objects=True)
                data = repaired if isinstance(repaired, dict) else {"queries": repaired}
            except Exception:
                return _fallback_decomposition(complaint_text, crime_sub_type, crime_category)

        queries = data.get("queries", [])
        if not queries or not isinstance(queries, list):
            return _fallback_decomposition(complaint_text, crime_sub_type, crime_category)

        # Validate and normalize each query
        validated = []
        for q in queries[:max_queries]:
            if isinstance(q, dict) and q.get("query"):
                validated.append({
                    "query": str(q.get("query", "")),
                    "hyde_passage": str(q.get("hyde_passage", q.get("query", ""))),
                    "intent": str(q.get("intent", "legal_retrieval"))
                })

        if not validated:
            return _fallback_decomposition(complaint_text, crime_sub_type, crime_category)

        print(f"[+] Query Decomposer: Generated {len(validated)} legal sub-queries from complaint.")
        for i, q in enumerate(validated, 1):
            print(f"    [{i}] {q['intent']}: {q['query'][:80]}...")

        return validated

    except Exception as e:
        print(f"[-] Query Decomposer LLM Exception: {e}")
        return _fallback_decomposition(complaint_text, crime_sub_type, crime_category)


def _fallback_decomposition(
    complaint_text: str,
    crime_sub_type: str = "",
    crime_category: str = ""
) -> List[Dict[str, str]]:
    """
    Rule-based fallback decomposition when LLM is unavailable.
    Generates 3 queries targeting different legal aspects using domain keyword mapping.
    """
    crime_sub_lower = (crime_sub_type or "").lower()
    complaint_lower = (complaint_text or "").lower()

    queries = []

    # Query 1: Penal Code / Substantive Law
    penal_terms = ""
    if any(kw in crime_sub_lower or kw in complaint_lower for kw in ["cheat", "fraud", "impersonat", "deceiv"]):
        penal_terms = "BNS Section 318 319 cheating dishonestly inducing delivery property impersonation"
    elif any(kw in crime_sub_lower or kw in complaint_lower for kw in ["extort", "threat", "blackmail", "sextort"]):
        penal_terms = "BNS Section 308 extortion criminal intimidation coercion threat"
    elif any(kw in crime_sub_lower or kw in complaint_lower for kw in ["theft", "robbery", "stolen", "snatch"]):
        penal_terms = "BNS Section 303 304 theft robbery criminal misappropriation"
    elif any(kw in crime_sub_lower or kw in complaint_lower for kw in ["forgery", "counterfeit", "fake document"]):
        penal_terms = "BNS Section 336 forgery making false document"
    else:
        penal_terms = f"BNS penal section punishment offence {crime_sub_type}"

    queries.append({
        "query": f"{penal_terms} {crime_sub_type}".strip(),
        "hyde_passage": f"Section — {penal_terms}. Whoever commits the offence described herein shall be punished with imprisonment for a term which may extend to years, or with fine, or with both. This section applies to cases involving {crime_sub_type}.",
        "intent": "penal_code_sections"
    })

    # Query 2: Procedural / Investigation SOP
    if any(kw in crime_sub_lower or kw in complaint_lower for kw in ["cyber", "online", "upi", "digital", "internet", "telegram", "whatsapp"]):
        queries.append({
            "query": f"CFCFRMS 1930 portal cyber fraud SOP debit freeze mule account CDR IPDR {crime_sub_type}",
            "hyde_passage": "The Citizen Financial Cyber Fraud Reporting and Management System (CFCFRMS) operates through the 1930 helpline portal. Upon receiving a complaint of financial cyber fraud, the investigating officer shall immediately initiate a debit freeze request on the suspected mule accounts through the 1930 portal interface.",
            "intent": "cyber_investigation_sop"
        })
    else:
        queries.append({
            "query": f"BNSS investigation procedure panchnama search seizure Section 105 spot evidence {crime_sub_type}",
            "hyde_passage": "Under Section 105 of the Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023, the investigating officer shall conduct a search and seizure at the place of occurrence in the presence of two independent witnesses and prepare a panchnama documenting all material evidence recovered.",
            "intent": "procedural_investigation"
        })

    # Query 3: Evidence / BSA
    queries.append({
        "query": "BSA Section 63 electronic evidence certificate hash value chain custody admissibility digital forensics",
        "hyde_passage": "Section 63 of the Bharatiya Sakshya Adhiniyam (BSA), 2023, provides that any information contained in an electronic record shall be deemed to be a document and shall be admissible in evidence, provided it is accompanied by a certificate identifying the electronic record and describing the manner in which it was produced.",
        "intent": "evidence_admissibility"
    })

    print(f"[+] Query Decomposer (Fallback): Generated {len(queries)} rule-based sub-queries.")
    return queries
