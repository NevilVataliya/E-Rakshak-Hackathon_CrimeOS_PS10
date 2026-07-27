"""
Crime OS AI — Query Optimizer v3

Integrates with the LLM-powered Query Decomposer for multi-query generation,
while retaining the rule-based domain trigger dictionary as an enrichment layer.

This module serves as the bridge between specialist agents and the RAG pipeline:
  1. Specialist agents call optimize_and_search() with complaint + context
  2. Query Decomposer generates multi-query sub-queries with HyDE passages
  3. Domain triggers enrich each sub-query with statutory keywords
  4. Enriched sub-queries are passed to the Qdrant multi-query RRF engine
  5. Results are reranked and returned to the specialist agent
"""

import os
import re
from typing import List, Dict, Any, Optional

from config import RAG_ENABLE_MULTI_QUERY, RAG_ENABLE_HYDE, RAG_MAX_SUB_QUERIES
from app.rag.query_decomposer import decompose_complaint_to_legal_queries
from app.rag.qdrant_client import search_legal_sops
from app.rag.reranker import rerank_chunks

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


def optimize_and_search(
    complaint_text: str,
    crime_sub_type: str = "",
    crime_category: str = "",
    entities: Optional[Dict[str, Any]] = None,
    target_specialist: str = None,
    top_k: int = 5,
    enable_reranker: bool = True
) -> List[Dict[str, Any]]:
    """
    End-to-end optimized RAG search pipeline:
      1. Decomposes complaint into legal sub-queries (with HyDE)
      2. Enriches sub-queries with domain trigger terms
      3. Executes multi-query RRF fusion in Qdrant
      4. Reranks results via cross-encoder
      5. Returns top-K grounded legal chunks

    This is the primary entry point for all specialist agents.

    Args:
        complaint_text: The victim complaint narrative (Hinglish/English)
        crime_sub_type: Classified crime sub-type (e.g., "Online Fraud", "Extortion")
        crime_category: Crime category ("CYBER", "CONVENTIONAL", "HYBRID")
        entities: Extracted entities dict (persons, phones, VPAs, bank accounts)
        target_specialist: Specialist domain hint for soft-boost scoring
        top_k: Number of final chunks to return to the specialist agent
        enable_reranker: Whether to apply cross-encoder reranking (default: True)

    Returns:
        List of chunk dicts, each with: id, score, source, page, text, document_title, etc.
    """
    sub_queries = None

    if RAG_ENABLE_MULTI_QUERY:
        # Phase 1 & 2: Concept-based decomposition with HyDE
        concept_queries = decompose_complaint_to_legal_queries(
            complaint_text=complaint_text,
            crime_sub_type=crime_sub_type,
            crime_category=crime_category,
            entities=entities,
            specialist_domain=target_specialist or "",
            max_queries=max(1, RAG_MAX_SUB_QUERIES - 1)  # Reserve slot 1 for raw complaint
        )

        # HYBRID: Always inject the raw complaint narrative as query #1
        # The raw text carries the strongest semantic signal for dense matching.
        # Concept queries are SUPPLEMENTARY — they add breadth, not replace depth.
        raw_complaint_query = {
            "query": f"{complaint_text[:600]} {crime_sub_type}".strip(),
            "hyde_passage": complaint_text[:600],  # Use raw text as its own HyDE
            "intent": "raw_complaint_narrative"
        }
        sub_queries = [raw_complaint_query] + (concept_queries or [])

    # Phase 3: Multi-query RRF Qdrant search (or single-query fallback)
    retrieval_top_k = max(top_k * 3, 20) if enable_reranker else top_k  # Fetch more for reranker
    qdrant_results = search_legal_sops(
        query=f"{complaint_text[:500]} {crime_sub_type}".strip(),  # Fallback query
        target_specialist=target_specialist,
        top_k=retrieval_top_k,
        sub_queries=sub_queries
    )

    if not qdrant_results:
        return []

    # Phase 4: Cross-encoder reranking
    if enable_reranker and len(qdrant_results) > 1:
        legal_terms = extract_universal_legal_terms(complaint_text)
        terms_str = " ".join(legal_terms) if legal_terms else ""
        rerank_query = f"{crime_sub_type} {terms_str} {complaint_text[:200]}".strip()
        reranked = rerank_chunks(rerank_query, qdrant_results, top_k=top_k)
        return reranked

    return qdrant_results[:top_k]


def enrich_query_for_universal_rag(query_text: str) -> str:
    """
    Legacy enrichment function — retained for backward compatibility.
    Enriches user query or complaint narrative with universal legal keywords
    to maximize dense + sparse RRF vector retrieval precision across all domains.
    """
    legal_terms = extract_universal_legal_terms(query_text)
    if not legal_terms:
        return query_text

    terms_str = " ".join(legal_terms)
    return f"{terms_str} {query_text}".strip()
