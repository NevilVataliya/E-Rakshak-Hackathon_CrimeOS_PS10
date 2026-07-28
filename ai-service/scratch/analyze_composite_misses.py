import os
import sys
import json
import re
from collections import Counter

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.rag.qdrant_client import search_legal_sops
from app.rag.query_optimizer import decompose_query_for_specialist

def is_chunk_hit(retrieved_chunk: dict, ground_truth: dict) -> bool:
    c_doc = str(retrieved_chunk.get("source", "")).lower().strip()
    gt_doc = str(ground_truth.get("source_document", "")).lower().strip()
    if c_doc != gt_doc:
        return False
    
    c_pages = [int(p.strip()) for p in str(retrieved_chunk.get("page", "1")).split(",") if p.strip().isdigit()]
    gt_window = ground_truth.get("allowed_page_window", [ground_truth.get("page_number", 1)])
    return any(p in gt_window for p in c_pages)

def analyze_composite_benchmark():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    dataset_path = os.path.join(base_dir, "eval_dataset", "rag_benchmark_v2.json")
    
    with open(dataset_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    composite_cases = [tc for tc in data['test_cases'] if tc['case_type'] == 'COMPOSITE_MULTI_DOCUMENT']

    histogram = {0: 0, 1: 0, 2: 0, 3: 0, 4: 0}
    miss_by_specialist = Counter()
    total_by_specialist = Counter()
    miss_details = []

    print(f"=========================================================================")
    print(f"[*] DIAGNOSTIC ANALYSIS OF 16 COMPOSITE CASES (64 TARGETS TOTAL)")
    print(f"=========================================================================\n", flush=True)

    for idx, tc in enumerate(composite_cases, 1):
        tc_id = tc["test_case_id"]
        targets = tc["ground_truth_targets"]
        synth = tc["synthetic_complaint"]
        narrative = synth.get("translated_text") or synth.get("raw_text") or ""
        crime_sub = synth.get("crime_sub_type", "")
        entities = tc.get("expected_entities", {})

        retrieved_all = []
        for tgt in targets:
            spec = tgt["target_specialist"]
            total_by_specialist[spec] += 1
            query_str = decompose_query_for_specialist(narrative, target_specialist=spec, crime_sub_type=crime_sub, entities=entities)
            res = search_legal_sops(query_str, target_specialist=spec, top_k=15)
            retrieved_all.extend(res)

        targets_hit = 0
        for tgt in targets:
            spec = tgt["target_specialist"]
            hit = any(is_chunk_hit(r, tgt) for r in retrieved_all)
            if hit:
                targets_hit += 1
            else:
                miss_by_specialist[spec] += 1
                miss_details.append({
                    "case_id": tc_id,
                    "specialist": spec,
                    "target_doc": tgt["source_document"],
                    "target_page": tgt["page_number"]
                })

        histogram[targets_hit] += 1
        print(f"  [+] {tc_id}: {targets_hit}/4 targets hit", flush=True)

    print("\n=========================================================================")
    print(" 1. PER-CASE COVERAGE HISTOGRAM (16 COMPOSITE CASES)")
    print("=========================================================================")
    for score in range(5):
        cnt = histogram[score]
        pct = (cnt / len(composite_cases)) * 100.0
        print(f"   • {score}/4 Targets Hit: {cnt:2d} cases ({pct:5.1f}%)")
    print("=========================================================================\n")

    print("=========================================================================")
    print(" 2. TARGET MISS BREAKDOWN BY SPECIALIST TYPE")
    print("=========================================================================")
    for spec, total in total_by_specialist.items():
        misses = miss_by_specialist[spec]
        hits = total - misses
        hit_pct = (hits / total) * 100.0
        print(f"   • {spec:35s}: Hits={hits:2d}/{total:2d} ({hit_pct:5.1f}%) | Misses={misses:2d}/{total:2d}")
    print("=========================================================================\n")

if __name__ == "__main__":
    analyze_composite_benchmark()
