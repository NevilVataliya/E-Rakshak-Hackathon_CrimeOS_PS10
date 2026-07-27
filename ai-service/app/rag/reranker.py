"""
Crime OS AI — Upgraded Cross-Encoder Reranker v3

Replaces the lightweight ms-marco-MiniLM-L-6-v2 (80MB, general English) with
BAAI/bge-reranker-base (278MB) which has significantly better understanding of
legal and multilingual text.

Performance profile:
  - Model size: 278MB (vs 80MB for MiniLM)
  - CPU latency: ~200-500ms for 15 candidates (vs <45ms for MiniLM)
  - Accuracy: Substantially better on legal terminology and cross-lingual queries
  - Trade-off: 5-10x slower but still well under 1s for production use

The reranker receives the TOP candidates from multi-query RRF fusion and applies
deep cross-attention scoring between the original complaint text and each chunk.
"""

import os
import threading
from typing import List, Dict, Any
from config import MODEL_CACHE_DIR, HF_TOKEN, ENABLE_DEMO_FALLBACKS, RAG_RERANKER_MODEL, RAG_RERANKER_TOP_K

_reranker_model = None
_reranker_lock = threading.Lock()

def get_reranker_model():
    """
    Thread-safe singleton loader for cross-encoder reranker model.
    Default: BAAI/bge-reranker-base (278MB, ~200-500ms CPU latency for 15 pairs).
    Configurable via RAG_RERANKER_MODEL environment variable.
    """
    global _reranker_model
    if _reranker_model is None:
        with _reranker_lock:
            if _reranker_model is None:
                try:
                    model_name = RAG_RERANKER_MODEL
                    print(f"[*] Thread Safe Initialization: Loading CrossEncoder ('{model_name}') into cache '{MODEL_CACHE_DIR}'...")
                    from sentence_transformers import CrossEncoder
                    ce_kwargs = {}
                    if HF_TOKEN:
                        ce_kwargs['token'] = HF_TOKEN

                    # Set cache directory via environment variable for cross-encoder
                    os.environ.setdefault("SENTENCE_TRANSFORMERS_HOME", MODEL_CACHE_DIR)

                    _reranker_model = CrossEncoder(model_name, **ce_kwargs)
                    print(f"[+] CrossEncoder '{model_name}' loaded successfully!")
                except Exception as e:
                    print(f"[-] CrossEncoder Load Exception: {e}")
                    # Fallback to lightweight model if bge-reranker-base fails
                    try:
                        print(f"[*] Attempting fallback to 'cross-encoder/ms-marco-MiniLM-L-6-v2'...")
                        from sentence_transformers import CrossEncoder
                        _reranker_model = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
                        print(f"[+] Fallback CrossEncoder loaded successfully!")
                    except Exception as e2:
                        print(f"[-] Fallback CrossEncoder also failed: {e2}")
                        if not ENABLE_DEMO_FALLBACKS:
                            raise e
                        _reranker_model = "FALLBACK"
    return _reranker_model


def rerank_chunks(query: str, candidates: List[Dict[str, Any]], top_k: int = None) -> List[Dict[str, Any]]:
    """
    Cross-Encoder Reranker for high-precision legal chunk selection.

    Evaluates deep cross-attention between the full query/complaint text and each
    candidate chunk's text content. This captures fine-grained semantic relationships
    that bi-encoder similarity misses.

    Args:
        query: The original complaint text or enriched query (used as the 'question' side)
        candidates: List of chunk dicts from Qdrant multi-query RRF fusion
        top_k: Number of top results to return (defaults to RAG_RERANKER_TOP_K)

    Returns:
        Reranked list of chunk dicts, sorted by cross-encoder score descending
    """
    if top_k is None:
        top_k = RAG_RERANKER_TOP_K

    if not candidates:
        return []

    model = get_reranker_model()

    if model == "FALLBACK" or model is None:
        return sorted(candidates, key=lambda x: x.get("score", 0.0), reverse=True)[:top_k]

    try:
        # Prepare sentence pairs for CrossEncoder prediction
        # Use source document context + section path + chunk text for richer cross-attention
        pairs = []
        for c in candidates:
            chunk_context = f"{c.get('source', '')} {c.get('section_path', '')} {c.get('text', '')}"
            pairs.append([query, chunk_context])

        # Batch cross-attention scoring
        scores = model.predict(pairs)

        for idx, candidate in enumerate(candidates):
            candidate["rerank_score"] = float(scores[idx])

        # Sort by CrossEncoder score descending
        sorted_candidates = sorted(candidates, key=lambda x: x["rerank_score"], reverse=True)
        return sorted_candidates[:top_k]

    except Exception as e:
        print(f"[-] Reranker Prediction Exception: {e}")
        return sorted(candidates, key=lambda x: x.get("score", 0.0), reverse=True)[:top_k]
