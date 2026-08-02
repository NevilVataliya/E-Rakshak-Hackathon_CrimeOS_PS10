import os
import threading
import re
import math
import torch
import ollama
from typing import List, Dict, Any
from qdrant_client import QdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchValue
from config import QDRANT_HOST, QDRANT_PORT, COLLECTION_NAME, ENABLE_DEMO_FALLBACKS, HF_TOKEN, MODEL_CACHE_DIR
from app.rag.reranker import rerank_chunks

torch.set_num_threads(max(1, os.cpu_count() or 4))
_st_model = None
_model_lock = threading.Lock()
_qdrant_client = None
_client_lock = threading.Lock()

STOPWORDS = {
    "a", "an", "the", "and", "or", "but", "if", "because", "as", "what", "which",
    "this", "that", "these", "those", "then", "just", "so", "than", "such", "both",
    "through", "about", "for", "is", "of", "to", "in", "on", "at", "by", "from",
    "with", "my", "me", "i", "we", "our", "you", "your", "he", "she", "it", "they",
    "them", "was", "were", "been", "being", "have", "has", "had", "do", "does",
    "did", "will", "would", "shall", "should", "may", "might", "must", "can",
    "could", "sir", "hello", "please", "help", "naam", "mera", "hai", "ko", "se"
}

DOMAIN_DOC_PATTERNS = {
    "bsa_specialist": ["bsa", "evidence", "bnss", "procedural"],
    "bns_specialist": ["bns", "penal", "it_act", "telecom"],
    "cyber_financial_intel_specialist": ["cfcfrms", "kyc", "crypto", "eow", "liability", "it_act", "faq", "cyber"],
    "conventional_field_specialist": ["gujarat", "police", "manual", "training", "bprd", "handbook", "sops", "sop", "procedural", "bnss"]
}

def get_qdrant_client():
    global _qdrant_client
    if _qdrant_client is None:
        with _client_lock:
            if _qdrant_client is None:
                _qdrant_client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT, timeout=60.0)
    return _qdrant_client

def get_query_embedding(query: str):
    global _st_model
    try:
        if _st_model is None:
            with _model_lock:
                if _st_model is None:
                    print(f"[*] Thread Safe Initialization: Loading SentenceTransformer ('BAAI/bge-m3') into cache '{MODEL_CACHE_DIR}'...")
                    from sentence_transformers import SentenceTransformer
                    st_kwargs = {'cache_folder': MODEL_CACHE_DIR}
                    if HF_TOKEN:
                        st_kwargs['token'] = HF_TOKEN
                    _st_model = SentenceTransformer("BAAI/bge-m3", **st_kwargs)
        vector = _st_model.encode(query).tolist()
        return vector
    except Exception as e:
        print(f"[-] SentenceTransformer Embedding Exception: {e}")
        if not ENABLE_DEMO_FALLBACKS:
            raise e
        return [0.001] * 1024

def tokenize_text(text: str) -> List[str]:
    words = re.findall(r'\w+', text.lower())
    return [w for w in words if len(w) >= 2 and w not in STOPWORDS]

HIGH_IMPACT_STATUTORY_TOKENS = {
    "bns", "bsa", "bnss", "it", "act", "sop", "1930", "cfcfrms", "pocso", "posh",
    "section", "sec", "panchnama", "certificate", "hash", "mule", "freeze", "debit",
    "seizure", "custody", "diary", "fir", "zerofir"
}

def compute_bm25_score(query_tokens: List[str], text_tokens: List[str], avg_len: float = 200.0) -> float:
    if not query_tokens or not text_tokens:
        return 0.0
    
    k1 = 1.2
    b = 0.75
    doc_len = len(text_tokens)
    text_token_counts = {}
    for t in text_tokens:
        text_token_counts[t] = text_token_counts.get(t, 0) + 1
        
    score = 0.0
    for qt in query_tokens:
        if qt in text_token_counts:
            tf = text_token_counts[qt]
            denom = tf + k1 * (1.0 - b + b * (doc_len / avg_len))
            # High-impact weight boost (3.0x) for section numbers, statutory acronyms & key legal markers
            is_statutory = qt.isdigit() or (len(qt) <= 5 and any(c.isdigit() for c in qt)) or (qt in HIGH_IMPACT_STATUTORY_TOKENS)
            term_weight = 3.0 if is_statutory else 1.0
            score += term_weight * ((tf * (k1 + 1.0)) / denom)
    return score

SPECIALIST_ALIAS_MAP = {
    "cyber_specialist": "cyber_financial_intel_specialist",
    "conventional_specialist": "conventional_field_specialist"
}

from app.rag.query_optimizer import enrich_query_for_universal_rag, detect_dynamic_specialist_weights, decompose_multi_aspect_query
from app.rag.reranker import rerank_chunks, rerank_domain_stratified

def search_legal_sops(
    query: str = None,
    target_specialist: str = None,
    top_k: int = 15,
    use_hyde: bool = False,
    semantic_query: str = None,
    keyword_query: str = None
):
    """
    Native Dense + BM25 Sparse Hybrid Search Engine with Aspect-Targeted Sub-Query Decomposition,
    Parallel Multi-Domain Vector Retrieval, Reciprocal Rank Fusion (RRF), and Stratified Round-Robin Reranking.
    """
    if not query:
        query = f"{semantic_query or ''} {keyword_query or ''}".strip()

    if target_specialist in SPECIALIST_ALIAS_MAP:
        target_specialist = SPECIALIST_ALIAS_MAP[target_specialist]

    client = get_qdrant_client()
    if not client.collection_exists(COLLECTION_NAME):
        err_msg = f"Qdrant Collection '{COLLECTION_NAME}' does not exist."
        print(f"[-] {err_msg}")
        if not ENABLE_DEMO_FALLBACKS:
            raise RuntimeError(err_msg)
        return []

    # ─── MULTI-SPECIALIST COMPOSITE MULTI-DOCUMENT RETRIEVAL ──────────────────
    if target_specialist in ["multi_specialist", "multi_domain"] or (not target_specialist):
        try:
            sub_queries = decompose_multi_aspect_query(query)
            from qdrant_client.http import models as qmodels

            domain_candidates: Dict[str, List[Dict[str, Any]]] = {}

            def fetch_domain_candidates(domain: str, sub_q: str):
                try:
                    sub_vector = get_query_embedding(sub_q)
                    sub_tokens = tokenize_text(sub_q)

                    # Global dense vector search for aspect sub-query
                    q_results = client.search(
                        collection_name=COLLECTION_NAME,
                        query_vector=sub_vector,
                        limit=60
                    )

                    if not q_results:
                        return domain, []

                    # RRF + BM25 scoring against domain sub-query

                    dense_sorted = sorted(q_results, key=lambda pt: float(pt.score), reverse=True)
                    dense_rank_map = {str(pt.id): r for r, pt in enumerate(dense_sorted, 1)}

                    sparse_scored = []
                    for pt in q_results:
                        payload = pt.payload or {}
                        chunk_text = payload.get("text", "")
                        parent_text = payload.get("parent_text", "")
                        effective_text = parent_text if len(parent_text) > len(chunk_text) else chunk_text
                        source_doc = payload.get("source", "")
                        doc_title = payload.get("document_title", "")

                        full_chunk_str = f"{source_doc} {doc_title} {effective_text}"
                        c_tokens = tokenize_text(full_chunk_str)
                        bm25_val = compute_bm25_score(sub_tokens, c_tokens)
                        sparse_scored.append((str(pt.id), bm25_val))

                    sparse_sorted = sorted(sparse_scored, key=lambda x: x[1], reverse=True)
                    sparse_rank_map = {item[0]: r for r, item in enumerate(sparse_sorted, 1)}

                    rrf_list = []
                    for pt in q_results:
                        pid = str(pt.id)
                        r_dense = dense_rank_map.get(pid, 100)
                        r_sparse = sparse_rank_map.get(pid, 100)
                        rrf_score = (1.0 / (60.0 + r_dense)) + (1.0 / (60.0 + r_sparse))

                        payload = pt.payload or {}
                        chunk_text = payload.get("text", "")
                        parent_text = payload.get("parent_text", "")
                        effective_text = parent_text if len(parent_text) > len(chunk_text) else chunk_text

                        rrf_list.append({
                            "id": pid,
                            "score": rrf_score,
                            "source": payload.get("source", "Unknown_Legal_Doc.pdf"),
                            "document_title": payload.get("document_title", ""),
                            "doc_type": payload.get("doc_type", "statute"),
                            "page": payload.get("page", "1"),
                            "text": effective_text,
                            "target_specialist": payload.get("target_specialist", domain)
                        })

                    rrf_list.sort(key=lambda x: x["score"], reverse=True)
                    return domain, rrf_list[:25]
                except Exception as de:
                    print(f"[!] Error fetching domain cands for {domain}: {de}")
                    return domain, []

            # Execute Parallel Sub-Query Domain Retrieval across CPU Threads
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor(max_workers=len(sub_queries)) as executor:
                futures = [executor.submit(fetch_domain_candidates, d, sq) for d, sq in sub_queries.items()]
                for future in concurrent.futures.as_completed(futures):
                    dom, cands = future.result()
                    if cands:
                        domain_candidates[dom] = cands

            # Domain-Stratified Round-Robin Allocation & Diversity Reranking
            results = rerank_domain_stratified(sub_queries, domain_candidates, top_k=top_k)
            print(f"[+] Qdrant Aspect-Targeted Multi-Domain Parallel RAG Search: Found {len(results)} stratified chunks across {len(domain_candidates)} domains.")
            return results
        except Exception as me:
            print(f"[-] Multi-Domain Sub-Query Search Exception: {me}")
            if not ENABLE_DEMO_FALLBACKS:
                raise me

    # ─── SINGLE SPECIALIST DOMAIN RETRIEVAL ──────────────────────────────────
    search_q = enrich_query_for_universal_rag(query, target_specialist=target_specialist) if use_hyde else query
    query_vector = get_query_embedding(search_q)
    query_tokens = tokenize_text(search_q)

    try:
        from qdrant_client.http import models as qmodels
        domain_filter = qmodels.Filter(
            should=[
                qmodels.FieldCondition(key="target_specialist", match=qmodels.MatchValue(value=target_specialist)),
                qmodels.FieldCondition(key="target_specialist", match=qmodels.MatchValue(value="conventional_field_specialist"))
            ]
        )

        candidates_raw = client.search(
            collection_name=COLLECTION_NAME,
            query_vector=query_vector,
            query_filter=domain_filter,
            limit=100
        )

        if not candidates_raw:
            candidates_raw = client.search(
                collection_name=COLLECTION_NAME,
                query_vector=query_vector,
                limit=100
            )

        if not candidates_raw:
            return []

        dense_sorted = sorted(candidates_raw, key=lambda pt: float(pt.score), reverse=True)
        dense_rank_map = {str(pt.id): r for r, pt in enumerate(dense_sorted, 1)}

        sparse_scored = []
        for pt in candidates_raw:
            payload = pt.payload or {}
            chunk_text = payload.get("text", "")
            parent_text = payload.get("parent_text", "")
            effective_text = parent_text if len(parent_text) > len(chunk_text) else chunk_text
            source_doc = payload.get("source", "")
            doc_title = payload.get("document_title", "")

            full_chunk_str = f"{source_doc} {doc_title} {effective_text}"
            c_tokens = tokenize_text(full_chunk_str)
            bm25_val = compute_bm25_score(query_tokens, c_tokens)
            sparse_scored.append((str(pt.id), bm25_val))

        sparse_sorted = sorted(sparse_scored, key=lambda x: x[1], reverse=True)
        sparse_rank_map = {item[0]: r for r, item in enumerate(sparse_sorted, 1)}

        rrf_scored = []
        target_patterns = DOMAIN_DOC_PATTERNS.get(target_specialist, []) if target_specialist else []

        for pt in candidates_raw:
            pid = str(pt.id)
            r_dense = dense_rank_map.get(pid, 200)
            r_sparse = sparse_rank_map.get(pid, 200)

            rrf_score = (1.0 / (60.0 + r_dense)) + (1.0 / (60.0 + r_sparse))
            payload = pt.payload or {}
            pt_spec = payload.get("target_specialist", "")
            source_doc = payload.get("source", "").lower()
            chunk_text = payload.get("text", "")
            parent_text = payload.get("parent_text", "")
            effective_text = parent_text if len(parent_text) > len(chunk_text) else chunk_text

            if target_specialist:
                if pt_spec == target_specialist:
                    rrf_score += 0.06
                elif any(pat in source_doc for pat in target_patterns):
                    rrf_score += 0.04

            rrf_scored.append({
                "id": pid,
                "score": rrf_score,
                "dense_rank": r_dense,
                "sparse_rank": r_sparse,
                "source": payload.get("source", "Unknown_Legal_Doc.pdf"),
                "document_title": payload.get("document_title", ""),
                "doc_type": payload.get("doc_type", "statute"),
                "page": payload.get("page", "1"),
                "text": effective_text,
                "target_specialist": pt_spec
            })

        rrf_scored.sort(key=lambda x: x["score"], reverse=True)
        top_candidates = rrf_scored[:50]
        results = rerank_chunks(search_q, top_candidates, top_k=top_k)

        print(f"[+] Qdrant Single Domain RRF Search ({target_specialist}): Found {len(results)} grounded chunks.")
        return results
    except Exception as e:
        print(f"[-] Qdrant Search Exception ({target_specialist}): {e}")
        if not ENABLE_DEMO_FALLBACKS:
            raise e
        return []


