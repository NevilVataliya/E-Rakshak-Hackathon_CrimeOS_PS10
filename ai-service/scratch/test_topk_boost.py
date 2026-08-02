import os
import sys
import json
import time

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.rag.qdrant_client import search_legal_sops
from eval.run_rag_benchmark import is_chunk_hit

v3_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "eval_dataset", "rag_benchmark_v3.json")
with open(v3_path, "r", encoding="utf-8") as f:
    data = json.load(f)

composite_cases = [tc for tc in data["test_cases"] if tc["case_type"] == "COMPOSITE_MULTI_DOCUMENT"]

print("=========================================================================")
print("  EVALUATING MULTI-TARGET RECALL WITH TOP_K=28 STRATIFIED ALLOCATION")
print("=========================================================================")

for top_k in [20, 24, 28, 32]:
    total_targets_hit = 0
    total_targets = 0
    full_coverage_cases = 0

    for tc in composite_cases:
        targets = tc["ground_truth_targets"]
        synth = tc["synthetic_complaint"]
        narrative = synth.get("translated_text") or synth.get("raw_text") or ""
        crime_sub = synth.get("crime_sub_type", "")
        query_str = f"{narrative[:1500]} {crime_sub}".strip()

        retrieved = search_legal_sops(query_str, target_specialist="multi_specialist", top_k=top_k, use_hyde=True)

        case_hits = 0
        for tgt in targets:
            hit = any(is_chunk_hit(r_chunk, tgt) for r_chunk in retrieved)
            if hit:
                case_hits += 1

        total_targets_hit += case_hits
        total_targets += len(targets)
        if case_hits == len(targets):
            full_coverage_cases += 1

    recall = (total_targets_hit / total_targets) * 100
    cov_rate = (full_coverage_cases / len(composite_cases)) * 100
    print(f"Top-K={top_k:02d} -> Composite Target Recall: {recall:.1f}% | Full Coverage: {cov_rate:.1f}% ({full_coverage_cases}/{len(composite_cases)} cases)")
