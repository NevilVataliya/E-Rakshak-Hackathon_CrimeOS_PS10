import os
import threading
import re
import math
import ollama
from typing import List, Dict, Any
from qdrant_client import QdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchValue
from config import QDRANT_HOST, QDRANT_PORT, COLLECTION_NAME, ENABLE_DEMO_FALLBACKS, HF_TOKEN, MODEL_CACHE_DIR

ENABLE_OLLAMA_EMBEDDINGS = os.getenv("ENABLE_OLLAMA_EMBEDDINGS", "false").lower() == "true"

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
    if ENABLE_OLLAMA_EMBEDDINGS:
        try:
            if hasattr(ollama, 'embed'):
                embed_resp = ollama.embed(model="bge-m3:latest", input=query)
                if embed_resp and isinstance(embed_resp, dict) and 'embeddings' in embed_resp and embed_resp['embeddings']:
                    return embed_resp['embeddings'][0]
            elif hasattr(ollama, 'embeddings'):
                embed_resp = ollama.embeddings(model="bge-m3:latest", prompt=query)
                if embed_resp and isinstance(embed_resp, dict) and 'embedding' in embed_resp:
                    return embed_resp['embedding']
        except Exception as e:
            print(f"[*] Ollama embedding fallback triggered: {e}")

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
        print(f"[-] SentenceTransformer Exception: {e}")
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

def search_legal_sops(query: str, target_specialist: str = None, top_k: int = 30, use_hyde: bool = False):
    """
    Universal High-Precision Qdrant RAG Engine combining Dense Vector Similarity (bge-m3),
    BM25 Sparse Keyword Matching via Reciprocal Rank Fusion (RRF), and CrossEncoder Reranking.
    """
    client = get_qdrant_client()
    query_vector = get_query_embedding(query)
    query_tokens = tokenize_text(query)

    try:
        if not client.collection_exists(COLLECTION_NAME):
            err_msg = f"Qdrant Collection '{COLLECTION_NAME}' does not exist."
            print(f"[-] {err_msg}")
            if not ENABLE_DEMO_FALLBACKS:
                raise RuntimeError(err_msg)
            return []

        # 1. Fetch Candidate Pool via Dense Vector Search (High-Density Candidate Window)
        global_results = client.search(
            collection_name=COLLECTION_NAME,
            query_vector=query_vector,
            limit=200
        )

        candidate_map: Dict[str, Any] = {}
        for pt in global_results:
            pid = str(pt.id)
            if pid not in candidate_map:
                candidate_map[pid] = pt

        candidates = list(candidate_map.values())
        if not candidates:
            return []

        # 2. Dense Vector Rank Ordering
        dense_sorted = sorted(candidates, key=lambda pt: float(pt.score), reverse=True)
        dense_rank_map = {str(pt.id): r for r, pt in enumerate(dense_sorted, 1)}

        # 3. Sparse BM25 Rank Ordering
        sparse_scored = []
        for pt in candidates:
            payload = pt.payload or {}
            chunk_text = payload.get("text", "")
            source_doc = payload.get("source", "")
            doc_title = payload.get("document_title", "")
            
            full_chunk_str = f"{source_doc} {doc_title} {chunk_text}"
            c_tokens = tokenize_text(full_chunk_str)
            bm25_val = compute_bm25_score(query_tokens, c_tokens)
            sparse_scored.append((str(pt.id), bm25_val))

        sparse_sorted = sorted(sparse_scored, key=lambda x: x[1], reverse=True)
        sparse_rank_map = {item[0]: r for r, item in enumerate(sparse_sorted, 1)}

        # 4. Reciprocal Rank Fusion (RRF) Calculation
        rrf_scored = []
        for pt in candidates:
            pid = str(pt.id)
            r_dense = dense_rank_map.get(pid, 100)
            r_sparse = sparse_rank_map.get(pid, 100)
            
            # Standard RRF Formula: 1 / (60 + R_dense) + 1 / (60 + R_sparse)
            rrf_score = (1.0 / (60.0 + r_dense)) + (1.0 / (60.0 + r_sparse))
            payload = pt.payload or {}
            
            # Specialist Soft Boost
            pt_spec = payload.get("target_specialist", "")
            if target_specialist and pt_spec == target_specialist:
                rrf_score += 0.005

            # Step 2: Canonical Section Match Soft Boost (+0.025)
            from app.rag.query_optimizer import canonicalize_section_string
            q_sections = canonicalize_section_string(query)
            if q_sections:
                chunk_text = payload.get("text", "")
                c_sections = canonicalize_section_string(chunk_text)
                if any(qs in c_sections or qs in chunk_text.upper() for qs in q_sections):
                    rrf_score += 0.025

            rrf_scored.append({
                "id": pid,
                "score": rrf_score,
                "dense_rank": r_dense,
                "sparse_rank": r_sparse,
                "source": payload.get("source", "Unknown_Legal_Doc.pdf"),
                "document_title": payload.get("document_title", ""),
                "doc_type": payload.get("doc_type", "statute"),
                "page": payload.get("page", "1"),
                "text": payload.get("text", ""),
                "target_specialist": pt_spec
            })

        # Sort candidates by RRF score descending
        rrf_scored.sort(key=lambda x: x["score"], reverse=True)

        # 5. Fast Cross-Encoder Reranking with MinMax Linear Rank Blending (50% RRF, 50% CE)
        try:
            from app.rag.reranker import get_fast_reranker_model
            model = get_fast_reranker_model()
            if model != "FALLBACK" and model is not None:
                candidate_pool = rrf_scored[:40]
                pairs = [[query, f"{c['source']} {c['text']}"] for c in candidate_pool]
                ce_scores = model.predict(pairs)

                # MinMax Scaling
                rrf_vals = [c["score"] for c in candidate_pool]
                min_r, max_r = min(rrf_vals), max(rrf_vals)
                r_range = (max_r - min_r) if (max_r - min_r) > 1e-6 else 1.0

                min_ce, max_ce = min(ce_scores), max(ce_scores)
                ce_range = (max_ce - min_ce) if (max_ce - min_ce) > 1e-6 else 1.0

                alpha = 0.80
                for idx, c in enumerate(candidate_pool):
                    norm_rrf = (c["score"] - min_r) / r_range
                    norm_ce = (float(ce_scores[idx]) - min_ce) / ce_range
                    c["score"] = alpha * norm_rrf + (1.0 - alpha) * norm_ce

                candidate_pool.sort(key=lambda x: x["score"], reverse=True)
                results = candidate_pool[:top_k]
            else:
                results = rrf_scored[:top_k]
        except Exception as re_err:
            print(f"[-] Reranker Blending Warning: {re_err}")
            results = rrf_scored[:top_k]

        print(f"[+] Qdrant Universal RRF+Blended-Reranker Search ({target_specialist}): Found {len(results)} grounded chunks from '{COLLECTION_NAME}'.")
        return results
    except Exception as e:
        print(f"[-] Qdrant Search Exception: {e}")
        if not ENABLE_DEMO_FALLBACKS:
            raise e
        return []
