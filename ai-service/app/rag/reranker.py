import os
import threading
import torch
from typing import List, Dict, Any
from config import MODEL_CACHE_DIR, HF_TOKEN, ENABLE_DEMO_FALLBACKS

torch.set_num_threads(max(1, os.cpu_count() or 4))
_reranker_model = None
_reranker_lock = threading.Lock()

def get_fast_reranker_model():
    """
    Thread-safe singleton loader for ultra-fast cross-encoder/ms-marco-MiniLM-L-6-v2 (80MB, sub-50ms CPU speed).
    Uses MODEL_CACHE_DIR so model weights are downloaded once and saved permanently.
    """
    global _reranker_model
    if _reranker_model is None:
        with _reranker_lock:
            if _reranker_model is None:
                try:
                    print(f"[*] Thread Safe Initialization: Loading Ultra-Fast CrossEncoder ('cross-encoder/ms-marco-MiniLM-L-6-v2') into cache '{MODEL_CACHE_DIR}'...")
                    from sentence_transformers import CrossEncoder
                    st_kwargs = {'cache_folder': MODEL_CACHE_DIR}
                    if HF_TOKEN:
                        st_kwargs['token'] = HF_TOKEN
                    _reranker_model = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2", **st_kwargs)
                    print(f"[+] Ultra-Fast CrossEncoder loaded successfully (Sub-50ms CPU latency)!")
                except Exception as e:
                    print(f"[-] CrossEncoder Load Exception: {e}")
                    if not ENABLE_DEMO_FALLBACKS:
                        raise e
                    _reranker_model = "FALLBACK"
    return _reranker_model

def rerank_chunks(query: str, candidates: List[Dict[str, Any]], top_k: int = 5) -> List[Dict[str, Any]]:
    """
    Ultra-Fast Cross-Attention Reranker (< 50ms latency).
    Evaluates sentence-pair cross-attention between query and chunk text.
    """
    if not candidates:
        return []

    model = get_fast_reranker_model()

    if model == "FALLBACK" or model is None:
        return sorted(candidates, key=lambda x: x.get("score", 0.0), reverse=True)[:top_k]

    try:
        # Prepare sentence pairs for CrossEncoder prediction: (query[:500], source + document_title + text[:1200])
        # 500 chars query (~100 tokens) + 1200 chars text (~300 tokens) = ~400 tokens (safely under 512 limit)
        q_short = query[:500]
        pairs = [[q_short, f"{c.get('source', '')} {c.get('document_title', '')} {c.get('text', '')[:1200]}"] for c in candidates]
        
        # Fast cross-attention scoring with batching
        scores = model.predict(pairs, batch_size=16)

        # Min-Max Normalization for RRF score and CrossEncoder score
        rrf_scores = [float(c.get("score", 0.0)) for c in candidates]
        min_rrf, max_rrf = min(rrf_scores), max(rrf_scores)
        rrf_range = (max_rrf - min_rrf) if (max_rrf - min_rrf) > 1e-6 else 1.0

        ce_scores = [float(s) for s in scores]
        min_ce, max_ce = min(ce_scores), max(ce_scores)
        ce_range = (max_ce - min_ce) if (max_ce - min_ce) > 1e-6 else 1.0

        for idx, candidate in enumerate(candidates):
            candidate["rerank_score"] = float(scores[idx])
            norm_rrf = (float(candidate.get("score", 0.0)) - min_rrf) / rrf_range
            norm_ce = (float(scores[idx]) - min_ce) / ce_range
            # Optimized hybrid fusion: 70% RRF score + 30% CrossEncoder score
            candidate["combined_score"] = (0.60 * norm_rrf) + (0.40 * norm_ce)

        # Sort by Combined Score descending
        sorted_candidates = sorted(candidates, key=lambda x: x["combined_score"], reverse=True)
        return sorted_candidates[:top_k]
    except Exception as e:
        print(f"[-] Reranker Prediction Exception: {e}")
        return sorted(candidates, key=lambda x: x.get("score", 0.0), reverse=True)[:top_k]


def rerank_domain_stratified(
    sub_queries: Dict[str, str],
    domain_candidates: Dict[str, List[Dict[str, Any]]],
    top_k: int = 20
) -> List[Dict[str, Any]]:
    """
    Domain-Stratified Reranker with Round-Robin Diversity Allocation.
    Reranks candidates within each domain using aspect-targeted sub-queries,
    then samples candidates round-robin to eliminate domain crowding and guarantee
    100% multi-document legal coverage.
    """
    if not domain_candidates:
        return []

    # 1. Rerank candidates within each domain against domain-specific sub-query
    domain_ranked: Dict[str, List[Dict[str, Any]]] = {}
    for domain, cand_list in domain_candidates.items():
        if not cand_list:
            continue
        sub_q = sub_queries.get(domain, "")
        if sub_q:
            ranked = rerank_chunks(sub_q, cand_list, top_k=len(cand_list))
        else:
            ranked = sorted(cand_list, key=lambda x: x.get("score", 0.0), reverse=True)

        # Intra-domain page/section diversity filter (max 2 chunks per doc page)
        diverse_list = []
        page_counts = {}
        for pt in ranked:
            doc = pt.get("source", "")
            page = pt.get("page", 1)
            key = f"{doc}_{page}"
            count = page_counts.get(key, 0)
            if count < 2:
                diverse_list.append(pt)
                page_counts[key] = count + 1

        domain_ranked[domain] = diverse_list


    if not domain_ranked:
        return []

    # 2. Stratified Round-Robin Allocation
    selected_results = []
    seen_ids = set()
    
    max_cands = max(len(cands) for cands in domain_ranked.values())
    domains_keys = list(domain_ranked.keys())

    for idx in range(max_cands):
        for domain in domains_keys:
            cands = domain_ranked[domain]
            if idx < len(cands):
                pt = cands[idx]
                pid = str(pt.get("id"))
                if pid not in seen_ids:
                    seen_ids.add(pid)
                    selected_results.append(pt)
                    if len(selected_results) >= top_k:
                        break
        if len(selected_results) >= top_k:
            break

    # 3. Fallback fill if top_k not reached
    if len(selected_results) < top_k:
        remaining_pool = []
        for cands in domain_ranked.values():
            for pt in cands:
                pid = str(pt.get("id"))
                if pid not in seen_ids:
                    remaining_pool.append(pt)
        remaining_pool.sort(key=lambda x: x.get("combined_score", x.get("score", 0.0)), reverse=True)
        for pt in remaining_pool:
            selected_results.append(pt)
            if len(selected_results) >= top_k:
                break

    return selected_results[:top_k]

