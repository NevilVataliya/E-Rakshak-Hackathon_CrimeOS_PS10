import os
import sys
import json
import time
import numpy as np
from sentence_transformers import CrossEncoder

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.rag.qdrant_client import get_qdrant_client, get_query_embedding, tokenize_text, compute_bm25_score

def min_max_scale(arr):
    arr = np.array(arr, dtype=float)
    min_val = np.min(arr)
    max_val = np.max(arr)
    if max_val - min_val < 1e-6:
        return np.ones_like(arr) * 0.5
    return (arr - min_val) / (max_val - min_val)

def evaluate_model_on_benchmark(model_name: str, max_cases: int = 24):
    client = get_qdrant_client()
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    dataset_path = os.path.join(base_dir, "eval_dataset", "rag_benchmark_v2.json")
    
    with open(dataset_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    test_cases = [tc for tc in data['test_cases'] if tc['case_type'] == 'ATOMIC_SINGLE_CHUNK'][:max_cases]
    
    print(f"\n=========================================================================")
    print(f"[*] EMPIRICAL VERIFICATION FOR: '{model_name}'")
    print(f"=========================================================================", flush=True)

    t0_load = time.perf_counter()
    try:
        ce_model = CrossEncoder(model_name, max_length=256)
    except Exception as e:
        print(f"[-] Load Failed for {model_name}: {e}")
        return None
        
    load_time_ms = (time.perf_counter() - t0_load) * 1000.0
    print(f"[+] Loaded Model Weight in {load_time_ms:.1f} ms", flush=True)

    cached_eval_data = []
    latencies = []

    for tc in test_cases:
        gt = tc["ground_truth_binding"]
        synth = tc["synthetic_complaint"]
        spec_domain = tc["specialist_domain"]
        narrative = synth.get("translated_text") or synth.get("raw_text") or ""
        crime_sub = synth.get("crime_sub_type", "")
        
        rag_query = f"{narrative[:500]} {crime_sub}".strip()
        
        query_vector = get_query_embedding(rag_query)
        query_tokens = tokenize_text(rag_query)

        global_results = client.search(collection_name="police_sops_universal", query_vector=query_vector, limit=200)
        candidate_map = {str(pt.id): pt for pt in global_results}
        candidates = list(candidate_map.values())

        dense_sorted = sorted(candidates, key=lambda pt: float(pt.score), reverse=True)
        dense_rank_map = {str(pt.id): r for r, pt in enumerate(dense_sorted, 1)}

        sparse_scored = []
        for pt in candidates:
            payload = pt.payload or {}
            full_str = f"{payload.get('source','')} {payload.get('document_title','')} {payload.get('text','')}"
            bm25 = compute_bm25_score(query_tokens, tokenize_text(full_str))
            sparse_scored.append((str(pt.id), bm25))

        sparse_sorted = sorted(sparse_scored, key=lambda x: x[1], reverse=True)
        sparse_rank_map = {item[0]: r for r, item in enumerate(sparse_sorted, 1)}

        rrf_scored = []
        for pt in candidates:
            pid = str(pt.id)
            r_d = dense_rank_map.get(pid, 100)
            r_s = sparse_rank_map.get(pid, 100)
            score = (1.0 / (60.0 + r_d)) + (1.0 / (60.0 + r_s))
            payload = pt.payload or {}
            
            pt_spec = payload.get("target_specialist", "")
            if spec_domain and pt_spec == spec_domain:
                score += 0.005

            rrf_scored.append({
                'id': pid,
                'rrf_score': score,
                'source': payload.get('source',''),
                'page': payload.get('page','1'),
                'text': payload.get('text','')
            })

        rrf_scored.sort(key=lambda x: x['rrf_score'], reverse=True)
        candidate_pool = rrf_scored[:40]

        pairs = [[rag_query, f"{c['source']} {c['text']}"] for c in candidate_pool]
        
        t0_inf = time.perf_counter()
        ce_logits = ce_model.predict(pairs, batch_size=32)
        dur_ms = (time.perf_counter() - t0_inf) * 1000.0
        latencies.append(dur_ms)

        cached_eval_data.append({
            'gt': gt,
            'candidate_pool': candidate_pool,
            'ce_logits': ce_logits
        })

    avg_lat = float(np.mean(latencies))
    p95_lat = float(np.percentile(latencies, 95))
    print(f"[+] Verified Per-Query CPU Latency over 40 Candidates: Avg={avg_lat:.1f}ms | p95={p95_lat:.1f}ms\n", flush=True)

    # Blend alpha = 0.50
    hits_k3, hits_k5, hits_k10, hits_k15, mrr_sum, prec_k5 = 0, 0, 0, 0, 0.0, 0.0
    for item in cached_eval_data:
        gt = item['gt']
        pool = item['candidate_pool']
        logits = item['ce_logits']

        norm_rrf = min_max_scale([c['rrf_score'] for c in pool])
        norm_ce = min_max_scale(logits)

        b_pool = []
        for idx, c in enumerate(pool):
            b_score = 0.50 * norm_rrf[idx] + 0.50 * norm_ce[idx]
            b_pool.append(dict(c, blended_score=b_score))

        b_pool.sort(key=lambda x: x['blended_score'], reverse=True)
        results = b_pool[:15]

        target_doc = str(gt['source_document']).lower()
        target_window = gt['allowed_page_window']
        
        rank = None
        for r_idx, c in enumerate(results, 1):
            c_doc = str(c['source']).lower()
            c_pages = [int(p.strip()) for p in str(c['page']).split(',') if p.strip().isdigit()]
            if c_doc == target_doc and any(p in target_window for p in c_pages):
                rank = r_idx
                break

        if rank and rank <= 3: hits_k3 += 1
        if rank and rank <= 5: hits_k5 += 1
        if rank and rank <= 10: hits_k10 += 1
        if rank and rank <= 15: hits_k15 += 1
        if rank: mrr_sum += 1.0 / rank

        rel = sum(1 for c in results[:5] if str(c['source']).lower() == target_doc and any(int(p.strip()) in target_window for p in str(c['page']).split(',') if p.strip().isdigit()))
        prec_k5 += rel / 5.0

    n = len(test_cases)
    print(f"--- SCORECARD FOR {model_name} (α=0.50 Blend) ---")
    print(f"   • Hit Rate @ 3:             {hits_k3 / n * 100:.1f}%")
    print(f"   • Hit Rate @ 5:             {hits_k5 / n * 100:.1f}%")
    print(f"   • Context Precision @ 5:    {prec_k5 / n * 100:.1f}%")
    print(f"   • Mean Reciprocal Rank:     {mrr_sum / n:.3f}")
    print(f"   • CPU Latency (Avg / p95):  {avg_lat:.1f}ms / {p95_lat:.1f}ms")
    print(f"=========================================================================\n", flush=True)

if __name__ == "__main__":
    for m in [
        "cross-encoder/ms-marco-MiniLM-L-6-v2",
        "BAAI/bge-reranker-base",
        "BAAI/bge-reranker-v2-m3"
    ]:
        evaluate_model_on_benchmark(m)
