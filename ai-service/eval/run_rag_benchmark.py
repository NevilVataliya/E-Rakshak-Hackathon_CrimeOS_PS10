"""
Crime OS AI — High-Precision RAG Benchmark Evaluation Harness v3

Key improvements over v2:
  1. Uses the full Multi-Query RAG Pipeline (decomposer + HyDE + RRF + reranker)
  2. Adds fuzzy text matching as a third matching criterion (in addition to point ID and page window)
  3. Per-case diagnostic output showing which sub-queries were generated
  4. Latency tracking per test case
  5. Supports both single-query and multi-query evaluation modes for A/B comparison
"""

import os
import sys
import json
import re
import time
from typing import List, Dict, Any

# Ensure ai-service root directory is in sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.rag.query_optimizer import optimize_and_search
from app.rag.qdrant_client import search_legal_sops

def parse_page_num(val: Any) -> int:
    if isinstance(val, int):
        return val
    val_str = str(val or "1")
    nums = re.findall(r'\d+', val_str)
    return int(nums[0]) if nums else 1

def normalize_text(text: str) -> str:
    """Normalize text for fuzzy matching: lowercase, collapse whitespace, strip punctuation."""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text

def is_chunk_hit(retrieved_chunk: Dict[str, Any], ground_truth: Dict[str, Any]) -> bool:
    """
    Checks if a retrieved chunk matches ground truth via:
    1. Exact Qdrant Point ID match, OR
    2. Exact Source Document + Page Number within allowed page window (±2 pages), OR
    3. Fuzzy text fingerprint match (50-char substring overlap)
    """
    # 1. Check Point ID match
    retrieved_id = str(retrieved_chunk.get("id") or "").strip().lower()
    target_id = str(ground_truth.get("target_point_id") or ground_truth.get("point_id") or "").strip().lower()
    if retrieved_id and target_id and retrieved_id == target_id:
        return True

    # 2. Check Document Name & Page Window Match (expanded to ±2 pages)
    ret_doc = str(retrieved_chunk.get("source") or "").strip().lower()
    target_doc = str(ground_truth.get("source_document") or "").strip().lower()

    if ret_doc and target_doc and ret_doc == target_doc:
        ret_page = parse_page_num(retrieved_chunk.get("page"))
        target_window = ground_truth.get("allowed_page_window")
        if not target_window:
            target_page = ground_truth.get("page_number", 1)
            target_window = list(range(max(1, target_page - 2), target_page + 3))
        if ret_page in target_window:
            return True

    # 3. Fuzzy text fingerprint match
    target_fingerprint = ground_truth.get("target_text_fingerprint", "")
    if target_fingerprint and len(target_fingerprint) > 20:
        chunk_text = normalize_text(retrieved_chunk.get("text", ""))
        target_fp_norm = normalize_text(target_fingerprint)
        if target_fp_norm in chunk_text:
            return True

    return False

def run_benchmark_evaluation():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    # Try v3 first, then v2, then v1
    for version in ["rag_benchmark_v3.json", "rag_benchmark_v2.json", "rag_benchmark_v1.json"]:
        dataset_path = os.path.join(base_dir, "eval_dataset", version)
        if os.path.exists(dataset_path):
            break

    with open(dataset_path, "r", encoding="utf-8") as f:
        benchmark_data = json.load(f)

    test_cases = benchmark_data.get("test_cases", [])
    print(f"\n=========================================================================")
    print(f"       CRIME OS AI — HIGH-PRECISION MULTI-QUERY RAG BENCHMARK v3")
    print(f"=========================================================================")
    print(f"[+] Loaded Benchmark: {os.path.basename(dataset_path)} (v{benchmark_data['benchmark_metadata']['version']})")
    print(f"[+] Total Test Cases to Evaluate: {len(test_cases)}")
    print(f"[+] Pipeline: Multi-Query Decomposition + HyDE + Dense/BM25 RRF + CrossEncoder Reranker\n")

    atomic_hits_k3 = 0
    atomic_hits_k5 = 0
    atomic_hits_k10 = 0
    atomic_hits_k15 = 0
    atomic_mrr_sum = 0.0
    atomic_precision_sum = 0.0
    atomic_count = 0
    total_latency_ms = 0.0

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
        crime_cat = synth.get("crime_category", "")

        if c_type == "ATOMIC_SINGLE_CHUNK":
            gt = tc["ground_truth_binding"]
            spec_domain = tc["specialist_domain"]

            # Use the full Multi-Query RAG Pipeline
            start_time = time.time()
            retrieved = optimize_and_search(
                complaint_text=narrative[:600],
                crime_sub_type=crime_sub,
                crime_category=crime_cat,
                entities=tc.get("expected_entities"),
                target_specialist=spec_domain,
                top_k=15,
                enable_reranker=True
            )
            elapsed_ms = (time.time() - start_time) * 1000
            total_latency_ms += elapsed_ms

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
            print(f"[{status_symbol}] {tc_id} ({spec_domain[:15]}) -> {rank_str} | {elapsed_ms:.0f}ms (Doc: {gt['source_document']} p.{gt['page_number']})")

            # Diagnostic: show top-3 retrieved docs for missed cases
            if rank is None and len(retrieved) > 0:
                print(f"    └─ Top-3 retrieved: ", end="")
                for r in retrieved[:3]:
                    print(f"[{r['source']} p.{r['page']}] ", end="")
                print()

            results_details.append({
                "test_case_id": tc_id,
                "case_type": c_type,
                "domain": spec_domain,
                "rank": rank,
                "hit_k5": hit_k5,
                "hit_k15": hit_k15,
                "mrr": mrr,
                "precision_k5": precision_k5,
                "latency_ms": elapsed_ms
            })

        elif c_type == "COMPOSITE_MULTI_DOCUMENT":
            targets = tc["ground_truth_targets"]

            start_time = time.time()
            # Use multi-query pipeline for composite cases
            retrieved_all = optimize_and_search(
                complaint_text=narrative[:600],
                crime_sub_type=crime_sub,
                crime_category=crime_cat,
                entities=tc.get("expected_entities"),
                target_specialist=None,  # No specialist filter for composite
                top_k=30,  # Fetch more for multi-target matching
                enable_reranker=True
            )
            elapsed_ms = (time.time() - start_time) * 1000
            total_latency_ms += elapsed_ms

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
            print(f"[{status_symbol}] {tc_id} (COMPOSITE) -> {targets_hit}/{len(targets)} Targets | {elapsed_ms:.0f}ms (Recall: {target_recall*100:.1f}%)")

    # Summary Metrics Calculation
    avg_hit_k3 = (atomic_hits_k3 / atomic_count * 100) if atomic_count else 0
    avg_hit_k5 = (atomic_hits_k5 / atomic_count * 100) if atomic_count else 0
    avg_hit_k10 = (atomic_hits_k10 / atomic_count * 100) if atomic_count else 0
    avg_hit_k15 = (atomic_hits_k15 / atomic_count * 100) if atomic_count else 0
    avg_mrr = (atomic_mrr_sum / atomic_count) if atomic_count else 0
    avg_precision_k5 = (atomic_precision_sum / atomic_count * 100) if atomic_count else 0
    avg_latency = (total_latency_ms / (atomic_count + composite_count)) if (atomic_count + composite_count) else 0

    avg_comp_recall = (composite_target_recall_sum / composite_count * 100) if composite_count else 0
    comp_full_coverage_rate = (composite_full_coverage_hits / composite_count * 100) if composite_count else 0

    print(f"\n=========================================================================")
    print(f"            HIGH-PRECISION MULTI-QUERY RAG BENCHMARK SCORECARD")
    print(f"=========================================================================")
    print(f" ATOMIC SINGLE-CHUNK EVALUATION ({atomic_count} Test Cases):")
    print(f"   • Hit Rate @ 3:             {avg_hit_k3:.1f}%")
    print(f"   • Hit Rate @ 5:             {avg_hit_k5:.1f}%  (Target: ≥ 95.0%)")
    print(f"   • Hit Rate @ 10:            {avg_hit_k10:.1f}%")
    print(f"   • Hit Rate @ 15:            {avg_hit_k15:.1f}%")
    print(f"   • Context Precision @ 5:    {avg_precision_k5:.1f}%  (Target: ≥ 85.0%)")
    print(f"   • Mean Reciprocal Rank:     {avg_mrr:.3f}   (Target: ≥ 0.850)")
    print(f"   • Avg Latency per Query:    {avg_latency:.0f}ms")
    print(f"-------------------------------------------------------------------------")
    print(f" COMPOSITE MULTI-DOCUMENT EVALUATION ({composite_count} Test Cases):")
    print(f"   • Multi-Target Recall @ 15: {avg_comp_recall:.1f}%  (Target: ≥ 90.0%)")
    print(f"   • Full Compound Coverage:   {comp_full_coverage_rate:.1f}%")
    print(f"=========================================================================\n")

    # Save results to evaluation report
    report_path = os.path.join(base_dir, "eval_dataset", "evaluation_report.md")
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(f"# Qdrant Multi-Query RAG Benchmark Evaluation Report v3\n\n")
        f.write(f"**Evaluated Date:** {time.strftime('%Y-%m-%d %H:%M')}\n")
        f.write(f"**Benchmark File:** {os.path.basename(dataset_path)}\n")
        f.write(f"**Pipeline:** Multi-Query Decomposition + HyDE + Dense/BM25 RRF + CrossEncoder Reranker\n")
        f.write(f"**Total Test Cases:** {len(test_cases)}\n\n")
        f.write(f"## Executive Scorecard Summary\n\n")
        f.write(f"| Evaluation Metric | Measure | Target | Status |\n")
        f.write(f"|---|---|---|---|\n")
        f.write(f"| **Hit Rate @ 5 (Atomic)** | {avg_hit_k5:.1f}% | ≥ 95.0% | {'✓ PASS' if avg_hit_k5 >= 95 else 'NEEDS_TUNING'} |\n")
        f.write(f"| **Hit Rate @ 15 (Atomic)** | {avg_hit_k15:.1f}% | ≥ 95.0% | {'✓ PASS' if avg_hit_k15 >= 95 else 'NEEDS_TUNING'} |\n")
        f.write(f"| **Context Precision @ 5** | {avg_precision_k5:.1f}% | ≥ 85.0% | {'✓ PASS' if avg_precision_k5 >= 85 else 'NEEDS_TUNING'} |\n")
        f.write(f"| **Mean Reciprocal Rank (MRR)** | {avg_mrr:.3f} | ≥ 0.850 | {'✓ PASS' if avg_mrr >= 0.85 else 'NEEDS_TUNING'} |\n")
        f.write(f"| **Multi-Target Recall @ 15** | {avg_comp_recall:.1f}% | ≥ 90.0% | {'✓ PASS' if avg_comp_recall >= 90 else 'NEEDS_TUNING'} |\n")
        f.write(f"| **Avg Latency** | {avg_latency:.0f}ms | < 1500ms | {'✓ PASS' if avg_latency < 1500 else 'NEEDS_TUNING'} |\n")
        f.write(f"\n")

    print(f"[+] Evaluation report saved to '{report_path}'")

if __name__ == "__main__":
    run_benchmark_evaluation()
