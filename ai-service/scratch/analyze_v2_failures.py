import os
import sys
import json

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.rag.qdrant_client import search_legal_sops, get_qdrant_client, COLLECTION_NAME
from eval.run_rag_benchmark import is_chunk_hit

v2_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "eval_dataset", "rag_benchmark_v2.json")
with open(v2_path, "r", encoding="utf-8") as f:
    data = json.load(f)

client = get_qdrant_client()

print("=========================================================================")
print("  DIAGNOSING MISSED TARGETS IN BENCHMARK V2 (ATOMIC & COMPOSITE)")
print("=========================================================================")

atomic_cases = [tc for tc in data["test_cases"] if tc["case_type"] == "ATOMIC_SINGLE_DOCUMENT"]
composite_cases = [tc for tc in data["test_cases"] if tc["case_type"] == "COMPOSITE_MULTI_DOCUMENT"]

print("\n--- ATOMIC V2 MISSED CASES ---")
for tc in atomic_cases:
    tc_id = tc["test_case_id"]
    spec_domain = tc.get("target_specialist", "conventional_field_specialist")
    tgt = tc["ground_truth_targets"][0]
    prompt_text = tc.get("query_text") or tc.get("complaint_text") or tc["synthetic_complaint"]["translated_text"]

    retrieved = search_legal_sops(prompt_text, target_specialist=spec_domain, top_k=15, use_hyde=True)

    hit_rank = None
    for r_rank, r_chunk in enumerate(retrieved, 1):
        if is_chunk_hit(r_chunk, tgt):
            hit_rank = r_rank
            break

    if not hit_rank:
        gt_doc = tgt.get("source_document") or tgt.get("document_title") or "Unknown"
        gt_page = tgt.get("page_number", 1)
        pt_id = tgt.get("point_id")
        print(f"[{tc_id}] MISSED -> Spec: {spec_domain} | Target Doc: {gt_doc} p.{gt_page} (Point: {pt_id})")
        print(f"  Prompt: {prompt_text[:120]}...\n")

print("\n--- COMPOSITE V2 RECALL SUMMARY ---")
for tc in composite_cases[:5]:
    tc_id = tc["test_case_id"]
    targets = tc["ground_truth_targets"]
    synth = tc["synthetic_complaint"]
    narrative = synth.get("translated_text") or synth.get("raw_text") or ""
    crime_sub = synth.get("crime_sub_type", "")
    query_str = f"{narrative[:1500]} {crime_sub}".strip()

    retrieved = search_legal_sops(query_str, target_specialist="multi_specialist", top_k=20, use_hyde=True)

    hits = sum(1 for tgt in targets if any(is_chunk_hit(r_chunk, tgt) for r_chunk in retrieved))
    print(f"[{tc_id}] Retrieved {hits}/{len(targets)} Targets (Recall: {(hits/len(targets))*100:.1f}%)")
    for tgt in targets:
        hit = any(is_chunk_hit(r_chunk, tgt) for r_chunk in retrieved)
        if not hit:
            print(f"   - Missed Target [{tgt.get('target_specialist')}]: Doc {tgt.get('source_document')} p.{tgt.get('page_number')} Point ID: {tgt.get('point_id')}")
