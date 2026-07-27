import os
import sys
import json
import re
from typing import List, Dict, Any

# Ensure ai-service root directory is in sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.rag.qdrant_client import search_legal_sops

def parse_page_num(val: Any) -> int:
    if isinstance(val, int):
        return val
    val_str = str(val or "1")
    nums = re.findall(r'\d+', val_str)
    return int(nums[0]) if nums else 1

def is_chunk_hit(retrieved_chunk: Dict[str, Any], ground_truth: Dict[str, Any]) -> bool:
    """
    Checks if a retrieved chunk matches ground truth via:
    1. Exact Qdrant Point ID match, OR
    2. Exact Source Document + Page Number within allowed page window (±1 page).
    """
    # 1. Check Point ID match
    retrieved_id = str(retrieved_chunk.get("id") or "").strip().lower()
    target_id = str(ground_truth.get("target_point_id") or ground_truth.get("point_id") or "").strip().lower()
    if retrieved_id and target_id and retrieved_id == target_id:
        return True

    # 2. Check Document Name & Page Window Match
    ret_doc = str(retrieved_chunk.get("source") or "").strip().lower()
    target_doc = str(ground_truth.get("source_document") or "").strip().lower()
    
    if ret_doc and target_doc and ret_doc == target_doc:
        ret_page = parse_page_num(retrieved_chunk.get("page"))
        target_window = ground_truth.get("allowed_page_window") or [ground_truth.get("page_number")]
        if ret_page in target_window:
            return True
            
    return False

def run_benchmark_evaluation():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    dataset_path = os.path.join(base_dir, "eval_dataset", "rag_benchmark_v2.json")
    if not os.path.exists(dataset_path):
        dataset_path = os.path.join(base_dir, "eval_dataset", "rag_benchmark_v1.json")

    with open(dataset_path, "r", encoding="utf-8") as f:
        benchmark_data = json.load(f)

    test_cases = benchmark_data.get("test_cases", [])
    print(f"\n=========================================================================")
    print(f"       CRIME OS AI — HIGH-PRECISION FACTUAL RAG BENCHMARK HARNESS")
    print(f"=========================================================================")
    print(f"[+] Loaded Benchmark Version: {benchmark_data['benchmark_metadata']['version']}")
    print(f"[+] Total Test Cases to Evaluate: {len(test_cases)}\n")

    atomic_hits_k3 = 0
    atomic_hits_k5 = 0
    atomic_hits_k10 = 0
    atomic_hits_k15 = 0
    atomic_mrr_sum = 0.0
    atomic_precision_sum = 0.0
    atomic_count = 0

    composite_target_recall_sum = 0.0
    composite_full_coverage_hits = 0
    composite_count = 0

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
            
            # Pure factual legal query with HyDE query expansion
            rag_query = f"{narrative[:500]} {crime_sub}".strip()
            retrieved = search_legal_sops(rag_query, target_specialist=spec_domain, top_k=15, use_hyde=True)
            
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

            if hit_k3: atomic_hits_k3 += 1
            if hit_k5: atomic_hits_k5 += 1
            if hit_k10: atomic_hits_k10 += 1
            if hit_k15: atomic_hits_k15 += 1
            atomic_mrr_sum += mrr
            atomic_precision_sum += precision_k5
            atomic_count += 1

            status_symbol = "✓" if hit_k5 else ("△" if hit_k15 else "✗")
            rank_str = f"Rank {rank}" if rank else "MISSED"
            print(f"[{status_symbol}] {tc_id} ({spec_domain[:15]}) -> {rank_str} (Doc: {gt['source_document']} p.{gt['page_number']})")

            results_details.append({
                "test_case_id": tc_id,
                "case_type": c_type,
                "domain": spec_domain,
                "rank": rank,
                "hit_k5": hit_k5,
                "hit_k15": hit_k15,
                "mrr": mrr,
                "precision_k5": precision_k5
            })

        elif c_type == "COMPOSITE_MULTI_DOCUMENT":
            targets = tc["ground_truth_targets"]
            
            retrieved_all = []
            for tgt in targets:
                spec = tgt["target_specialist"]
                query_str = f"{narrative[:400]} {crime_sub}".strip()
                res = search_legal_sops(query_str, target_specialist=spec, top_k=15, use_hyde=False)
                retrieved_all.extend(res)

            targets_hit = 0
            for tgt in targets:
                target_hit_found = any(is_chunk_hit(r_chunk, tgt) for r_chunk in retrieved_all)
                if target_hit_found:
                    targets_hit += 1
                    
            target_recall = targets_hit / len(targets) if targets else 0.0
            full_coverage = (targets_hit == len(targets))

            composite_target_recall_sum += target_recall
            if full_coverage: composite_full_coverage_hits += 1
            composite_count += 1

            status_symbol = "✓" if full_coverage else "▲"
            print(f"[{status_symbol}] {tc_id} (COMPOSITE) -> Retrieved {targets_hit}/{len(targets)} Targets (Recall: {target_recall*100:.1f}%)")

    # Summary Metrics Calculation
    avg_hit_k3 = (atomic_hits_k3 / atomic_count * 100) if atomic_count else 0
    avg_hit_k5 = (atomic_hits_k5 / atomic_count * 100) if atomic_count else 0
    avg_hit_k10 = (atomic_hits_k10 / atomic_count * 100) if atomic_count else 0
    avg_hit_k15 = (atomic_hits_k15 / atomic_count * 100) if atomic_count else 0
    avg_mrr = (atomic_mrr_sum / atomic_count) if atomic_count else 0
    avg_precision_k5 = (atomic_precision_sum / atomic_count * 100) if atomic_count else 0

    avg_comp_recall = (composite_target_recall_sum / composite_count * 100) if composite_count else 0
    comp_full_coverage_rate = (composite_full_coverage_hits / composite_count * 100) if composite_count else 0

    print(f"\n=========================================================================")
    print(f"            HIGH-PRECISION QDRANT RAG BENCHMARK SCORECARD")
    print(f"=========================================================================")
    print(f" ATOMIC SINGLE-CHUNK EVALUATION ({atomic_count} Test Cases):")
    print(f"   • Hit Rate @ 3:             {avg_hit_k3:.1f}%")
    print(f"   • Hit Rate @ 5:             {avg_hit_k5:.1f}%  (Target: ≥ 95.0%)")
    print(f"   • Hit Rate @ 10:            {avg_hit_k10:.1f}%")
    print(f"   • Hit Rate @ 15:            {avg_hit_k15:.1f}%")
    print(f"   • Context Precision @ 5:    {avg_precision_k5:.1f}%  (Target: ≥ 85.0%)")
    print(f"   • Mean Reciprocal Rank:     {avg_mrr:.3f}   (Target: ≥ 0.850)")
    print(f"-------------------------------------------------------------------------")
    print(f" COMPOSITE MULTI-DOCUMENT EVALUATION ({composite_count} Test Cases):")
    print(f"   • Multi-Target Recall @ 15: {avg_comp_recall:.1f}%  (Target: ≥ 90.0%)")
    print(f"   • Full Compound Coverage:   {comp_full_coverage_rate:.1f}%")
    print(f"=========================================================================\n")

if __name__ == "__main__":
    run_benchmark_evaluation()
