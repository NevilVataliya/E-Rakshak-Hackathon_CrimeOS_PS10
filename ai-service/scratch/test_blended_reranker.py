import os
import sys
import json
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

def test_blended_reranker_fast():
    client = get_qdrant_client()
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    dataset_path = os.path.join(base_dir, "eval_dataset", "rag_benchmark_v2.json")
    
    with open(dataset_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    test_cases = [tc for tc in data['test_cases'] if tc['case_type'] == 'ATOMIC_SINGLE_CHUNK']
    
    print(f"[*] Pre-computing RRF Candidates & CE Logits for {len(test_cases)} Atomic Test Cases...", flush=True)

    ce_model = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")

    cached_eval_data = []

    for idx, tc in enumerate(test_cases, 1):
        gt = tc["ground_truth_binding"]
        synth = tc["synthetic_complaint"]
        
        # Route to English translation if available, fallback to raw text
        query_for_search = synth.get("translated_text") or synth.get("raw_text") or ""
        
        query_vector = get_query_embedding(query_for_search)
        query_tokens = tokenize_text(query_for_search)

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
            rrf_scored.append({
                'id': pid,
                'rrf_score': score,
                'source': payload.get('source',''),
                'page': payload.get('page','1'),
                'text': payload.get('text','')
            })

        rrf_scored.sort(key=lambda x: x['rrf_score'], reverse=True)
        candidate_pool = rrf_scored[:40]

        # Compute CrossEncoder logits on candidate pool
        pairs = [[query_for_search, f"{c['source']} {c['text']}"] for c in candidate_pool]
        ce_logits = ce_model.predict(pairs)

        cached_eval_data.append({
            'gt': gt,
            'candidate_pool': candidate_pool,
            'ce_logits': ce_logits
        })
        print(f"  [+] Processed {idx}/{len(test_cases)}: {tc['test_case_id']}", flush=True)

    print("\n[+] Pre-computation Complete! Evaluating Alpha Blending Grid Search...\n", flush=True)

    for alpha in [1.0, 0.95, 0.90, 0.85, 0.70, 0.50, 0.0]:
        hits_k3 = 0
        hits_k5 = 0
        hits_k10 = 0
        hits_k15 = 0
        mrr_sum = 0.0
        precision_k5_sum = 0.0

        for item in cached_eval_data:
            gt = item['gt']
            candidate_pool = item['candidate_pool']
            ce_logits = item['ce_logits']

            if alpha == 1.0:
                final_results = candidate_pool[:15]
            else:
                norm_rrf = min_max_scale([c['rrf_score'] for c in candidate_pool])
                norm_ce = min_max_scale(ce_logits)

                blended_pool = []
                for idx, c in enumerate(candidate_pool):
                    b_score = float(alpha * norm_rrf[idx] + (1.0 - alpha) * norm_ce[idx])
                    c_copy = dict(c, blended_score=b_score)
                    blended_pool.append(c_copy)

                blended_pool.sort(key=lambda x: x['blended_score'], reverse=True)
                final_results = blended_pool[:15]

            target_doc = str(gt['source_document']).lower()
            target_window = gt['allowed_page_window']
            
            rank = None
            for r_idx, c in enumerate(final_results, 1):
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

            rel_in_top5 = 0
            for c in final_results[:5]:
                c_doc = str(c['source']).lower()
                c_pages = [int(p.strip()) for p in str(c['page']).split(',') if p.strip().isdigit()]
                if c_doc == target_doc and any(p in target_window for p in c_pages):
                    rel_in_top5 += 1
            precision_k5_sum += rel_in_top5 / 5.0

        n = len(cached_eval_data)
        print(f"=========================================================================")
        print(f" RESULTS FOR ALPHA = {alpha:.2f} (RRF: {alpha*100:.0f}%, CE: {(1-alpha)*100:.0f}%)")
        print(f"   • Hit Rate @ 3:             {hits_k3 / n * 100:.1f}%")
        print(f"   • Hit Rate @ 5:             {hits_k5 / n * 100:.1f}%")
        print(f"   • Hit Rate @ 10:            {hits_k10 / n * 100:.1f}%")
        print(f"   • Hit Rate @ 15:            {hits_k15 / n * 100:.1f}%")
        print(f"   • Context Precision @ 5:    {precision_k5_sum / n * 100:.1f}%")
        print(f"   • Mean Reciprocal Rank:     {mrr_sum / n:.3f}")
        print(f"=========================================================================\n", flush=True)

if __name__ == "__main__":
    test_blended_reranker_fast()
