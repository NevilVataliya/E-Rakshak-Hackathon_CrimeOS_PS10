import os
import threading
from typing import List, Dict, Any
from config import MODEL_CACHE_DIR, HF_TOKEN, ENABLE_DEMO_FALLBACKS

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
        # Prepare sentence pairs for CrossEncoder prediction: (query, source + text)
        pairs = [[query, f"{c.get('source', '')} {c.get('text', '')}"] for c in candidates]
        
        # Fast cross-attention scoring
        scores = model.predict(pairs)

        for idx, candidate in enumerate(candidates):
            candidate["rerank_score"] = float(scores[idx])

        # Sort by CrossEncoder score descending
        sorted_candidates = sorted(candidates, key=lambda x: x["rerank_score"], reverse=True)
        return sorted_candidates[:top_k]
    except Exception as e:
        print(f"[-] Reranker Prediction Exception: {e}")
        return sorted(candidates, key=lambda x: x.get("score", 0.0), reverse=True)[:top_k]
