import os
import sys
import json
import time
import numpy as np

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.rag.qdrant_client import search_legal_sops
from app.rag.query_optimizer import decompose_query_for_specialist
from app.rag.reranker import get_fast_reranker_model

def is_chunk_hit(retrieved_chunk: dict, ground_truth: dict) -> bool:
    c_doc = str(retrieved_chunk.get("source", "")).lower().strip()
    gt_doc = str(ground_truth.get("source_document", "")).lower().strip()
    if c_doc != gt_doc:
        return False
    
    c_pages = [int(p.strip()) for p in str(retrieved_chunk.get("page", "1")).split(",") if p.strip().isdigit()]
    gt_window = ground_truth.get("allowed_page_window", [ground_truth.get("page_number", 1)])
    return any(p in gt_window for p in c_pages)

def evaluate_alpha(alpha: float, test_cases: list, ce_model):
    atomic_hits_k5 = 0
    atomic_hits_k15 = 0
    atomic_mrr_sum = 0.0
    atomic_prec_sum = 0.0
    atomic_count = 0

    composite_target_recall_sum = 0.0
    composite_full_coverage = 0
    composite_count = 0

    latencies = []

    for tc in test_cases:
        c_type = tc["case_type"]
        synth = tc["synthetic_complaint"]
        narrative = synth.get("translated_text") or synth.get("raw_text") or ""
        crime_sub = synth.get("crime_sub_type", "")

        if c_type == "ATOMIC_SINGLE_CHUNK":
            gt = tc["ground_truth_binding"]
            spec_domain = tc.get("specialist_domain", "bns_specialist")
            
            t0 = time.time()
            # Retrieve RRF candidates
            q = f"{narrative[:500]} {crime_sub}".strip()
            retrieved = search_legal_sops(q, target_specialist=spec_domain, top_k=30)
            latencies.append((time.time() - t0) * 1000.0)

            # Apply custom alpha blending
            if ce_model != "FALLBACK" and ce_model is not None and len(retrieved) > 0:
                candidate_pool = retrieved[:40]
                pairs = [[q, f"{c['source']} {c['text']}"] for c in candidate_pool]
                ce_scores = ce_model.predict(pairs)

                rrf_vals = [c["score"] for c in candidate_pool]
                min_r, max_r = min(rrf_vals), max(rrf_vals)
                r_range = (max_r - min_r) if (max_r - min_r) > 1e-6 else 1.0

                min_ce, max_ce = min(ce_scores), max(ce_scores)
                ce_range = (max_ce - min_ce) if (max_ce - min_ce) > 1e-6 else 1.0

                for idx, c in enumerate(candidate_pool):
                    norm_rrf = (c["score"] - min_r) / r_range
                    norm_ce = (float(ce_scores[idx]) - min_ce) / ce_range
                    c["blended_score"] = alpha * norm_rrf + (1.0 - alpha) * norm_ce

                candidate_pool.sort(key=lambda x: x["blended_score"], reverse=True)
                retrieved = candidate_pool[:30]

            rank = None
            for r_idx, r_chunk in enumerate(retrieved, 1):
                if is_chunk_hit(r_chunk, gt):
                    rank = r_idx
                    break

            hit_k5 = (rank is not None and rank <= 5)
            hit_k15 = (rank is not None and rank <= 15)
            mrr = (1.0 / rank) if rank else 0.0

            rel_top5 = sum(1 for r_chunk in retrieved[:5] if is_chunk_hit(r_chunk, gt))
            prec_k5 = rel_top5 / 5.0

            if hit_k5: atomic_hits_k5 += 1
            if hit_k15: atomic_hits_k15 += 1
            atomic_mrr_sum += mrr
            atomic_prec_sum += prec_k5
            atomic_count += 1

        elif c_type == "COMPOSITE_MULTI_DOCUMENT":
            targets = tc["ground_truth_targets"]
            retrieved_all = []
            
            for tgt in targets:
                spec = tgt["target_specialist"]
                q = decompose_query_for_specialist(narrative, target_specialist=spec, crime_sub_type=crime_sub)
                res = search_legal_sops(q, target_specialist=spec, top_k=30)
                
                if ce_model != "FALLBACK" and ce_model is not None and len(res) > 0:
                    candidate_pool = res[:40]
                    pairs = [[q, f"{c['source']} {c['text']}"] for c in candidate_pool]
                    ce_scores = ce_model.predict(pairs)

                    rrf_vals = [c["score"] for c in candidate_pool]
                    min_r, max_r = min(rrf_vals), max(rrf_vals)
                    r_range = (max_r - min_r) if (max_r - min_r) > 1e-6 else 1.0

                    min_ce, max_ce = min(ce_scores), max(ce_scores)
                    ce_range = (max_ce - min_ce) if (max_ce - min_ce) > 1e-6 else 1.0

                    for idx, c in enumerate(candidate_pool):
                        norm_rrf = (c["score"] - min_r) / r_range
                        norm_ce = (float(ce_scores[idx]) - min_ce) / ce_range
                        c["blended_score"] = alpha * norm_rrf + (1.0 - alpha) * norm_ce

                    candidate_pool.sort(key=lambda x: x["blended_score"], reverse=True)
                    res = candidate_pool[:30]

                retrieved_all.extend(res)

            targets_hit = sum(1 for tgt in targets if any(is_chunk_hit(r, tgt) for r in retrieved_all))
            recall = targets_hit / float(len(targets))
            composite_target_recall_sum += recall
            if targets_hit == len(targets):
                composite_full_coverage += 1
            composite_count += 1

    atomic_hit_k5_pct = (atomic_hits_k5 / atomic_count) * 100.0 if atomic_count else 0.0
    atomic_hit_k15_pct = (atomic_hits_k15 / atomic_count) * 100.0 if atomic_count else 0.0
    mrr_avg = atomic_mrr_sum / atomic_count if atomic_count else 0.0
    prec_avg = (atomic_prec_sum / atomic_count) * 100.0 if atomic_count else 0.0

    comp_recall_pct = (composite_target_recall_sum / composite_count) * 100.0 if composite_count else 0.0
    comp_full_pct = (composite_full_coverage / composite_count) * 100.0 if composite_count else 0.0
    avg_latency = float(np.mean(latencies)) if latencies else 0.0

    return {
        "alpha": alpha,
        "atomic_hit_k5": atomic_hit_k5_pct,
        "atomic_hit_k15": atomic_hit_k15_pct,
        "mrr": mrr_avg,
        "precision_k5": prec_avg,
        "composite_recall": comp_recall_pct,
        "full_coverage": comp_full_pct,
        "latency_ms": avg_latency
    }

def run_grid_search():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    dataset_path = os.path.join(base_dir, "eval_dataset", "rag_benchmark_v2.1.json")
    
    with open(dataset_path, "r", encoding="utf-8") as f:
        benchmark_data = json.load(f)

    test_cases = benchmark_data["test_cases"]
    ce_model = get_fast_reranker_model()

    print(f"=========================================================================")
    print(f"[*] STAGE B: CROSS-ENCODER BLENDING GRID SEARCH (ALPHA GRID)")
    print(f"=========================================================================\n", flush=True)

    alphas = [1.0, 0.8, 0.6, 0.5, 0.4, 0.2, 0.0]
    results = []

    for a in alphas:
        print(f"  [+] Evaluating Alpha = {a:.2f} ({(1-a)*100:.0f}% CrossEncoder, {a*100:.0f}% RRF)...", flush=True)
        res = evaluate_alpha(a, test_cases, ce_model)
        results.append(res)
        print(f"      -> Hit@5: {res['atomic_hit_k5']:5.1f}% | Prec@5: {res['precision_k5']:5.1f}% | MRR: {res['mrr']:.3f} | Comp Recall: {res['composite_recall']:5.1f}%\n", flush=True)

    print("=========================================================================")
    print(" STAGE B SCORECARD: RERANKER ALPHA BLENDING GRID SEARCH")
    print("=========================================================================")
    print(f"{'Alpha':<7s} | {'RRF/CE Blend':<15s} | {'Atomic Hit@5':<12s} | {'Prec@5':<8s} | {'MRR':<6s} | {'Comp Recall':<12s} | {'Full Coverage':<13s}")
    print("-" * 85)
    for r in results:
        blend_str = f"{r['alpha']*100:.0f}% RRF / {(1-r['alpha'])*100:.0f}% CE"
        print(f"{r['alpha']:<7.2f} | {blend_str:<15s} | {r['atomic_hit_k5']:<11.1f}% | {r['precision_k5']:<7.1f}% | {r['mrr']:<6.3f} | {r['composite_recall']:<11.1f}% | {r['full_coverage']:<12.1f}%")
    print("=========================================================================\n", flush=True)

if __name__ == "__main__":
    run_grid_search()
