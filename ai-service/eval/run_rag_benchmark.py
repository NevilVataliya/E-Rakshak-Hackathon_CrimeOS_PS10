"""
CrimeOS AI — Layer 2: Enhanced RAG Retrieval Benchmark Harness
===============================================================
Dense+BM25 RRF Hybrid Search evaluation with:
  - Hit@K (3, 5, 10, 15)
  - NDCG@K
  - MRR
  - Precision@K
  - Per-specialist-domain breakdown
  - Latency tracking
"""

import os
import sys
import json
import re
import time
import math
from typing import List, Dict, Any

# Ensure ai-service root directory is in sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.rag.qdrant_client import search_legal_sops


def parse_page_nums(val: Any) -> set:
    if isinstance(val, int):
        return {val}
    val_str = str(val or "1")
    nums = re.findall(r'\d+', val_str)
    return set(int(n) for n in nums) if nums else {1}

def normalize_doc_name(name: str) -> str:
    if not name:
        return ""
    n = str(name).strip().lower()
    if n.endswith('.pdf'):
        n = n[:-4]
    return n.replace('_', ' ').replace('-', ' ').strip()

def is_chunk_hit(retrieved_chunk: Dict[str, Any], ground_truth: Dict[str, Any]) -> bool:
    """
    Checks if a retrieved chunk matches ground truth via:
    1. Exact Qdrant Point ID match, OR
    2. Normalized Source Document + Page Number within allowed page window (±1 page).
    """
    # 1. Check Point ID match
    retrieved_id = str(retrieved_chunk.get("id") or "").strip().lower()
    target_id = str(ground_truth.get("target_point_id") or ground_truth.get("point_id") or "").strip().lower()
    if retrieved_id and target_id and retrieved_id == target_id:
        return True

    # 2. Check Document Name & Page Window Match
    ret_doc = normalize_doc_name(retrieved_chunk.get("source") or retrieved_chunk.get("document_title"))
    target_doc = normalize_doc_name(ground_truth.get("source_document") or ground_truth.get("document_title"))

    if ret_doc and target_doc and (ret_doc in target_doc or target_doc in ret_doc):
        ret_pages = parse_page_nums(retrieved_chunk.get("page"))
        target_window = ground_truth.get("allowed_page_window") or [ground_truth.get("page_number")]
        if any(p in target_window for p in ret_pages):
            return True

    return False


def compute_ndcg(retrieved: List[Dict], ground_truth: Dict, k: int) -> float:
    """
    Compute NDCG@K for single-target benchmark.
    Finds rank of first matching chunk within top-K.
    NDCG@K = 1.0 / log2(rank + 1) if rank <= K else 0.0
    """
    for i, chunk in enumerate(retrieved[:k], 1):
        if is_chunk_hit(chunk, ground_truth):
            return 1.0 / math.log2(i + 1)
    return 0.0


def run_rag_benchmark_evaluation(dataset_path: str = None, output_dir: str = None) -> Dict[str, Any]:
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if not dataset_path:
        v3_path = os.path.join(base_dir, "eval_dataset", "rag_benchmark_v3.json")
        v2_path = os.path.join(base_dir, "eval_dataset", "rag_benchmark_v2.json")
        v1_path = os.path.join(base_dir, "eval_dataset", "rag_benchmark_v1.json")
        if os.path.exists(v3_path):
            dataset_path = v3_path
        elif os.path.exists(v2_path):
            dataset_path = v2_path
        else:
            dataset_path = v1_path
    if not output_dir:
        output_dir = os.path.join(base_dir, "eval_results")
    os.makedirs(output_dir, exist_ok=True)

    with open(dataset_path, "r", encoding="utf-8") as f:
        benchmark_data = json.load(f)

    test_cases = benchmark_data.get("test_cases", [])
    print(f"\n{'='*75}")
    print(f"    CRIME OS AI — LAYER 2: RAG RETRIEVAL BENCHMARK HARNESS")
    print(f"{'='*75}")
    print(f"[+] Loaded Benchmark Version: {benchmark_data['benchmark_metadata']['version']}")
    print(f"[+] Total Test Cases to Evaluate: {len(test_cases)}\n")

    # Aggregate accumulators
    atomic = {
        "hits_k3": 0, "hits_k5": 0, "hits_k10": 0, "hits_k15": 0,
        "mrr_sum": 0.0, "precision_k5_sum": 0.0,
        "ndcg_k5_sum": 0.0, "ndcg_k10_sum": 0.0,
        "latency_sum": 0.0, "count": 0
    }
    composite = {
        "target_recall_sum": 0.0, "full_coverage_hits": 0,
        "latency_sum": 0.0, "count": 0
    }

    # Per-domain breakdown
    domain_stats: Dict[str, Dict] = {}

    results_details = []

    for tc in test_cases:
        tc_id = tc["test_case_id"]
        c_type = tc["case_type"]
        synth = tc["synthetic_complaint"]
        narrative = synth.get("translated_text") or synth.get("raw_text") or ""
        crime_sub = synth.get("crime_sub_type", "")

        if c_type == "ATOMIC_SINGLE_CHUNK":
            gt = tc["ground_truth_binding"]
            spec_domain = tc["specialist_domain"]

            # Initialize domain stats
            if spec_domain not in domain_stats:
                domain_stats[spec_domain] = {"hits_k5": 0, "hits_k15": 0, "mrr_sum": 0.0, "count": 0}

            rag_query = f"{narrative[:1500]} {crime_sub}".strip()

            start_t = time.time()
            retrieved = search_legal_sops(rag_query, target_specialist=spec_domain, top_k=15, use_hyde=True)
            latency = time.time() - start_t

            # Calculate Rank & Hit@K
            rank = None
            for idx, r_chunk in enumerate(retrieved, 1):
                if is_chunk_hit(r_chunk, gt):
                    rank = idx
                    break

            hit_k3 = (rank is not None and rank <= 3)
            hit_k5 = (rank is not None and rank <= 5)
            hit_k10 = (rank is not None and rank <= 10)
            hit_k15 = (rank is not None and rank <= 15)
            mrr = (1.0 / rank) if rank else 0.0

            # Precision@5
            relevant_in_top5 = sum(1 for r_chunk in retrieved[:5] if is_chunk_hit(r_chunk, gt))
            precision_k5 = relevant_in_top5 / 5.0

            # NDCG@K
            ndcg_5 = compute_ndcg(retrieved, gt, 5)
            ndcg_10 = compute_ndcg(retrieved, gt, 10)

            # Accumulate
            if hit_k3: atomic["hits_k3"] += 1
            if hit_k5: atomic["hits_k5"] += 1
            if hit_k10: atomic["hits_k10"] += 1
            if hit_k15: atomic["hits_k15"] += 1
            atomic["mrr_sum"] += mrr
            atomic["precision_k5_sum"] += precision_k5
            atomic["ndcg_k5_sum"] += ndcg_5
            atomic["ndcg_k10_sum"] += ndcg_10
            atomic["latency_sum"] += latency
            atomic["count"] += 1

            # Domain stats
            ds = domain_stats[spec_domain]
            ds["count"] += 1
            ds["mrr_sum"] += mrr
            if hit_k5: ds["hits_k5"] += 1
            if hit_k15: ds["hits_k15"] += 1

            status_symbol = "✓" if hit_k5 else ("△" if hit_k15 else "✗")
            rank_str = f"Rank {rank}" if rank else "MISSED"
            print(f"[{status_symbol}] {tc_id} ({spec_domain[:20]}) -> {rank_str} "
                  f"(Doc: {gt['source_document']} p.{gt['page_number']}) [{latency*1000:.0f}ms]")

            results_details.append({
                "test_case_id": tc_id, "case_type": c_type, "domain": spec_domain,
                "rank": rank, "hit_k5": hit_k5, "hit_k15": hit_k15,
                "mrr": round(mrr, 4), "precision_k5": round(precision_k5, 4),
                "ndcg_5": round(ndcg_5, 4), "ndcg_10": round(ndcg_10, 4),
                "latency_ms": round(latency * 1000, 1)
            })

        elif c_type == "COMPOSITE_MULTI_DOCUMENT":
            targets = tc["ground_truth_targets"]

            start_t = time.time()
            query_str = f"{narrative[:1500]} {crime_sub}".strip()
            retrieved_all = search_legal_sops(query_str, target_specialist="multi_specialist", top_k=20, use_hyde=True)
            latency = time.time() - start_t

            targets_hit = 0
            for tgt in targets:
                target_hit_found = any(is_chunk_hit(r_chunk, tgt) for r_chunk in retrieved_all)
                if target_hit_found:
                    targets_hit += 1

            target_recall = targets_hit / len(targets) if targets else 0.0
            full_coverage = (targets_hit == len(targets))

            composite["target_recall_sum"] += target_recall
            if full_coverage: composite["full_coverage_hits"] += 1
            composite["latency_sum"] += latency
            composite["count"] += 1

            status_symbol = "✓" if full_coverage else "▲"
            print(f"[{status_symbol}] {tc_id} (COMPOSITE) -> Retrieved {targets_hit}/{len(targets)} "
                  f"Targets (Recall: {target_recall*100:.1f}%) [{latency*1000:.0f}ms]")

            results_details.append({
                "test_case_id": tc_id, "case_type": c_type,
                "targets_hit": targets_hit, "total_targets": len(targets),
                "target_recall": round(target_recall, 4),
                "full_coverage": full_coverage,
                "latency_ms": round(latency * 1000, 1)
            })

    # ─── Scorecard ────────────────────────────────────────────────────────
    ac = atomic["count"] or 1
    cc = composite["count"] or 1

    scorecard = {
        "atomic": {
            "count": atomic["count"],
            "hit_rate_k3": round(atomic["hits_k3"] / ac * 100, 1),
            "hit_rate_k5": round(atomic["hits_k5"] / ac * 100, 1),
            "hit_rate_k10": round(atomic["hits_k10"] / ac * 100, 1),
            "hit_rate_k15": round(atomic["hits_k15"] / ac * 100, 1),
            "mrr": round(atomic["mrr_sum"] / ac, 3),
            "precision_k5": round(atomic["precision_k5_sum"] / ac * 100, 1),
            "ndcg_k5": round(atomic["ndcg_k5_sum"] / ac, 3),
            "ndcg_k10": round(atomic["ndcg_k10_sum"] / ac, 3),
            "avg_latency_ms": round(atomic["latency_sum"] / ac * 1000, 1),
        },
        "composite": {
            "count": composite["count"],
            "target_recall": round(composite["target_recall_sum"] / cc * 100, 1),
            "full_coverage_rate": round(composite["full_coverage_hits"] / cc * 100, 1),
            "avg_latency_ms": round(composite["latency_sum"] / cc * 1000, 1),
        },
        "per_domain": {}
    }

    for domain, ds in domain_stats.items():
        dc = ds["count"] or 1
        scorecard["per_domain"][domain] = {
            "count": ds["count"],
            "hit_rate_k5": round(ds["hits_k5"] / dc * 100, 1),
            "hit_rate_k15": round(ds["hits_k15"] / dc * 100, 1),
            "mrr": round(ds["mrr_sum"] / dc, 3),
        }

    sa = scorecard["atomic"]
    sc = scorecard["composite"]

    print(f"\n{'='*75}")
    print(f"           LAYER 2: RAG RETRIEVAL BENCHMARK SCORECARD")
    print(f"{'='*75}")
    print(f" ATOMIC SINGLE-CHUNK EVALUATION ({sa['count']} Test Cases):")
    print(f"   • Hit Rate @ 3:             {sa['hit_rate_k3']}%")
    print(f"   • Hit Rate @ 5:             {sa['hit_rate_k5']}%   (Target: ≥ 95.0%)")
    print(f"   • Hit Rate @ 10:            {sa['hit_rate_k10']}%")
    print(f"   • Hit Rate @ 15:            {sa['hit_rate_k15']}%")
    print(f"   • Context Precision @ 5:    {sa['precision_k5']}%   (Target: ≥ 85.0%)")
    print(f"   • NDCG @ 5:                 {sa['ndcg_k5']}    (Target: ≥ 0.800)")
    print(f"   • NDCG @ 10:                {sa['ndcg_k10']}")
    print(f"   • Mean Reciprocal Rank:     {sa['mrr']}    (Target: ≥ 0.850)")
    print(f"   • Avg Latency:              {sa['avg_latency_ms']}ms  (Target: < 1500ms)")
    print(f"{'─'*75}")
    print(f" COMPOSITE MULTI-DOCUMENT EVALUATION ({sc['count']} Test Cases):")
    print(f"   • Multi-Target Recall @ 15: {sc['target_recall']}%   (Target: ≥ 90.0%)")
    print(f"   • Full Compound Coverage:   {sc['full_coverage_rate']}%")
    print(f"   • Avg Latency:              {sc['avg_latency_ms']}ms")
    print(f"{'─'*75}")
    print(f" PER-DOMAIN BREAKDOWN:")
    for domain, ds in scorecard["per_domain"].items():
        print(f"   [{domain[:30]}] Hit@5={ds['hit_rate_k5']}% Hit@15={ds['hit_rate_k15']}% MRR={ds['mrr']} (n={ds['count']})")
    print(f"{'='*75}\n")

    # Save results
    results_payload = {
        "layer": "rag_retrieval",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "scorecard": scorecard,
        "per_case_results": results_details
    }
    out_file = os.path.join(output_dir, f"rag_eval_{time.strftime('%Y%m%d_%H%M%S')}.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(results_payload, f, indent=2, ensure_ascii=False)
    print(f"[+] Results saved to: {out_file}")

    return results_payload


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="CrimeOS AI RAG Retrieval Benchmark Runner")
    parser.add_argument("--dataset", type=str, default=None, help="Path to specific benchmark JSON file (e.g. eval_dataset/rag_benchmark_v3.json)")
    args = parser.parse_args()
    
    run_rag_benchmark_evaluation(dataset_path=args.dataset)
