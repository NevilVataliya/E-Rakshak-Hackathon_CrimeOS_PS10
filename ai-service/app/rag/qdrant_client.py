"""
Crime OS AI — Universal High-Precision Qdrant RAG Engine v3

Implements Multi-Query Reciprocal Rank Fusion (RRF) with HyDE support:
1. Accepts multiple sub-queries from the Query Decomposer
2. For each sub-query: runs Dense Vector Search (bge-m3 1024D) + BM25 Sparse Keyword Matching
3. Merges per-query results via intra-query RRF
4. Merges cross-query results via cross-query RRF with deduplication
5. Returns top-K candidates for reranking

Key changes from v2:
- Accepts HyDE passages for dense embedding (bridges semantic gap)
- Multi-query fan-out with cross-query fusion
- Reduced candidate pool per query (50 vs 200) for precision
- Single-query fallback for backward compatibility
"""

import os
import threading
import re
import math
import ollama
from typing import List, Dict, Any, Optional
from qdrant_client import QdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchValue
from config import (
    QDRANT_HOST, QDRANT_PORT, COLLECTION_NAME, ENABLE_DEMO_FALLBACKS,
    HF_TOKEN, MODEL_CACHE_DIR, RAG_CANDIDATES_PER_QUERY, RAG_ENABLE_HYDE
)

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

def get_qdrant_client():
    global _qdrant_client
    if _qdrant_client is None:
        with _client_lock:
            if _qdrant_client is None:
                _qdrant_client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)
    return _qdrant_client

def get_query_embedding(query: str):
    global _st_model
    # 1. Primary: Load local SentenceTransformer ('BAAI/bge-m3') from MODEL_CACHE_DIR
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
        print(f"[-] SentenceTransformer Load Exception: {e}. Trying Ollama fallback...")

    # 2. Secondary Fallback: Try Ollama API if SentenceTransformer fails
    try:
        if hasattr(ollama, 'embed'):
            embed_resp = ollama.embed(model="bge-m3:latest", input=query)
            if embed_resp and isinstance(embed_resp, dict) and 'embeddings' in embed_resp and embed_resp['embeddings']:
                return embed_resp['embeddings'][0]
        elif hasattr(ollama, 'embeddings'):
            embed_resp = ollama.embeddings(model="bge-m3:latest", prompt=query)
            if embed_resp and isinstance(embed_resp, dict) and 'embedding' in embed_resp:
                return embed_resp['embedding']
    except (AttributeError, Exception) as e:
        print(f"[-] Ollama embedding fallback Exception: {e}")
        if not ENABLE_DEMO_FALLBACKS:
            raise e

    return [0.001] * 1024

def tokenize_text(text: str) -> List[str]:
    words = re.findall(r'\w+', text.lower())
    return [w for w in words if len(w) > 2 and w not in STOPWORDS]

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
            score += (tf * (k1 + 1.0)) / denom
    return score


def _batch_embed(texts: List[str]) -> List[List[float]]:
    """
    Batch-embed multiple texts in a single forward pass.
    2-3x faster than sequential get_query_embedding() calls on CPU.
    """
    global _st_model
    if not texts:
        return []

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
        vectors = _st_model.encode(texts, show_progress_bar=False).tolist()
        return vectors
    except Exception as e:
        print(f"[-] Batch Embedding Exception: {e}. Falling back to sequential embedding.")
        return [get_query_embedding(t) for t in texts]


def _single_query_rrf_search(
    client,
    query_text: str,
    hyde_passage: Optional[str],
    target_specialist: Optional[str],
    candidate_limit: int,
    precomputed_vector: Optional[List[float]] = None
) -> List[Dict[str, Any]]:
    """
    Executes a single Dense + BM25 RRF search for one sub-query.
    If precomputed_vector is provided, uses it directly (skips embedding).
    Otherwise embeds hyde_passage (if HyDE enabled) or query_text.
    """
    # Use precomputed vector if available, otherwise compute
    if precomputed_vector is not None:
        query_vector = precomputed_vector
    else:
        dense_text = hyde_passage if (hyde_passage and RAG_ENABLE_HYDE) else query_text
        query_vector = get_query_embedding(dense_text)
    query_tokens = tokenize_text(query_text)  # Always use original query for BM25

    try:
        if not client.collection_exists(COLLECTION_NAME):
            print(f"[-] Qdrant Collection '{COLLECTION_NAME}' does not exist.")
            return []

        # Search across all legal documents (soft-boost applied in RRF scoring)
        query_filter = None

        # Dense Vector Search
        global_results = client.search(
            collection_name=COLLECTION_NAME,
            query_vector=query_vector,
            query_filter=query_filter,
            limit=candidate_limit
        )

        candidate_map: Dict[str, Any] = {}
        for pt in global_results:
            pid = str(pt.id)
            if pid not in candidate_map:
                candidate_map[pid] = pt

        candidates = list(candidate_map.values())
        if not candidates:
            return []

        # Dense Rank Ordering
        dense_sorted = sorted(candidates, key=lambda pt: float(pt.score), reverse=True)
        dense_rank_map = {str(pt.id): r for r, pt in enumerate(dense_sorted, 1)}

        # Sparse BM25 Rank Ordering
        sparse_scored = []
        for pt in candidates:
            payload = pt.payload or {}
            chunk_text = payload.get("text", "")
            source_doc = payload.get("source", "")
            doc_title = payload.get("document_title", "")
            section_path = payload.get("section_path", "")

            full_chunk_str = f"{source_doc} {doc_title} {section_path} {chunk_text}"
            c_tokens = tokenize_text(full_chunk_str)
            bm25_val = compute_bm25_score(query_tokens, c_tokens)
            sparse_scored.append((str(pt.id), bm25_val))

        sparse_sorted = sorted(sparse_scored, key=lambda x: x[1], reverse=True)
        sparse_rank_map = {item[0]: r for r, item in enumerate(sparse_sorted, 1)}

        # Intra-Query RRF Calculation
        rrf_results = []
        for pt in candidates:
            pid = str(pt.id)
            r_dense = dense_rank_map.get(pid, candidate_limit + 1)
            r_sparse = sparse_rank_map.get(pid, candidate_limit + 1)

            # Standard RRF: 1/(60 + R_dense) + 1/(60 + R_sparse)
            rrf_score = (1.0 / (60.0 + r_dense)) + (1.0 / (60.0 + r_sparse))
            payload = pt.payload or {}

            # Specialist Soft Boost
            pt_spec = payload.get("target_specialist", "")
            if target_specialist and pt_spec == target_specialist:
                rrf_score += 0.005

            rrf_results.append({
                "id": pid,
                "score": rrf_score,
                "dense_rank": r_dense,
                "sparse_rank": r_sparse,
                "source": payload.get("source", "Unknown_Legal_Doc.pdf"),
                "document_title": payload.get("document_title", ""),
                "doc_type": payload.get("doc_type", "statute"),
                "page": payload.get("page", "1"),
                "text": payload.get("text", ""),
                "target_specialist": pt_spec,
                "section_path": payload.get("section_path", "")
            })

        return rrf_results

    except Exception as e:
        print(f"[-] Single Query RRF Exception: {e}")
        if not ENABLE_DEMO_FALLBACKS:
            raise e
        return []


def search_legal_sops(
    query: str,
    target_specialist: str = None,
    top_k: int = 15,
    use_hyde: bool = False,
    sub_queries: Optional[List[Dict[str, str]]] = None
) -> List[Dict[str, Any]]:
    """
    Universal High-Precision Qdrant RAG Engine v3.

    If sub_queries is provided (from the Query Decomposer), performs Multi-Query RRF Fusion:
      - Runs Dense + BM25 RRF per sub-query
      - Merges results across all sub-queries using Cross-Query RRF
      - Deduplicates by chunk ID

    If sub_queries is None, falls back to single-query search (backward compatible).

    Args:
        query: The raw query text (used as fallback and for single-query mode)
        target_specialist: Optional specialist domain for soft-boost scoring
        top_k: Number of final results to return
        use_hyde: Legacy flag (HyDE is now controlled per sub-query via hyde_passage)
        sub_queries: List of dicts from query_decomposer, each with "query", "hyde_passage", "intent"
    """
    client = get_qdrant_client()
    candidate_limit = RAG_CANDIDATES_PER_QUERY

    if sub_queries and len(sub_queries) > 0:
        # ========== MULTI-QUERY RRF FUSION ==========
        # Batch-embed ALL sub-query HyDE passages in a single forward pass
        # This is 2-3x faster than sequential embedding on CPU
        dense_texts = []
        for sq in sub_queries:
            hyde = sq.get("hyde_passage", None)
            if hyde and RAG_ENABLE_HYDE:
                dense_texts.append(hyde)
            else:
                dense_texts.append(sq.get("query", query))

        precomputed_vectors = _batch_embed(dense_texts)

        all_per_query_results: List[List[Dict[str, Any]]] = []
        for i, sq in enumerate(sub_queries):
            sq_text = sq.get("query", query)
            sq_results = _single_query_rrf_search(
                client, sq_text, None, target_specialist, candidate_limit,
                precomputed_vector=precomputed_vectors[i]
            )
            all_per_query_results.append(sq_results)

        # Cross-Query RRF Fusion
        # For each chunk that appears across multiple sub-queries, sum its RRF contributions
        cross_query_scores: Dict[str, Dict[str, Any]] = {}

        # Content-Level Deduplication Key to prevent duplicate Qdrant points of the same page
        # from filling up multiple candidate slots
        for q_idx, q_results in enumerate(all_per_query_results):
            sorted_results = sorted(q_results, key=lambda x: x["score"], reverse=True)

            for rank, result in enumerate(sorted_results, 1):
                # Content key uniquely identifies a specific document chunk page
                content_key = f"{result['source'].lower()}:::{str(result.get('page', '')).strip()}:::{result.get('text', '')[:100]}"
                cross_rrf_contribution = 1.0 / (60.0 + rank)

                if content_key not in cross_query_scores:
                    cross_query_scores[content_key] = {
                        **result,
                        "cross_rrf_score": 0.0,
                        "appeared_in_queries": 0
                    }

                cross_query_scores[content_key]["cross_rrf_score"] += cross_rrf_contribution
                cross_query_scores[content_key]["appeared_in_queries"] += 1

                # Boost chunks that appear in multiple sub-queries (cross-query evidence)
                if cross_query_scores[content_key]["appeared_in_queries"] > 1:
                    cross_query_scores[content_key]["cross_rrf_score"] += 0.002

        # Sort by cross-query RRF score
        final_candidates = sorted(
            cross_query_scores.values(),
            key=lambda x: x["cross_rrf_score"],
            reverse=True
        )

        # Normalize: use cross_rrf_score as the main score
        results = []
        for c in final_candidates[:top_k]:
            c["score"] = c["cross_rrf_score"]
            results.append(c)

        print(f"[+] Multi-Query RRF Search ({len(sub_queries)} sub-queries, {target_specialist}): "
              f"Found {len(results)} grounded chunks from '{COLLECTION_NAME}'. "
              f"(Unique candidates across queries: {len(cross_query_scores)})")
        return results

    else:
        # ========== SINGLE-QUERY FALLBACK (Backward Compatible) ==========
        single_results = _single_query_rrf_search(client, query, None, target_specialist, candidate_limit)

        if not single_results:
            return []

        # Sort and return top-K
        single_results.sort(key=lambda x: x["score"], reverse=True)
        results = single_results[:top_k]

        print(f"[+] Qdrant Single-Query RRF Search ({target_specialist}): Found {len(results)} grounded chunks from '{COLLECTION_NAME}'.")
        return results
