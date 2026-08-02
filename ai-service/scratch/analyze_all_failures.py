import os
import sys
import json

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.rag.qdrant_client import search_legal_sops, get_qdrant_client, COLLECTION_NAME
from eval.run_rag_benchmark import is_chunk_hit

v3_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "eval_dataset", "rag_benchmark_v3.json")
with open(v3_path, "r", encoding="utf-8") as f:
    data = json.load(f)

print("=========================================================================")
print("  DEEP RETRIEVAL FAILURE ANALYSIS ACROSS ALL BENCHMARK TEST CASES")
print("=========================================================================")

client = get_qdrant_client()

# Check atomic missed test cases
atomic_cases = [tc for tc in data["test_cases"] if tc["case_type"] == "ATOMIC_SINGLE_CHUNK"]
atomic_misses = []

for tc in atomic_cases:
    tc_id = tc["test_case_id"]
    spec = tc["specialist_domain"]
    gt = tc["ground_truth_binding"]
    synth = tc["synthetic_complaint"]
    narrative = synth.get("translated_text") or synth.get("raw_text") or ""
    crime_sub = synth.get("crime_sub_type", "")
    rag_query = f"{narrative[:1500]} {crime_sub}".strip()

    retrieved = search_legal_sops(rag_query, target_specialist=spec, top_k=15, use_hyde=True)
    rank = None
    for idx, r_chunk in enumerate(retrieved, 1):
        if is_chunk_hit(r_chunk, gt):
            rank = idx
            break
    if not rank or rank > 5:
        atomic_misses.append({
            "test_case_id": tc_id,
            "domain": spec,
            "rank": rank,
            "target_doc": gt["source_document"],
            "page": gt["page_number"],
            "target_point_id": gt["target_point_id"],
            "query": rag_query[:200]
        })

print(f"\n[!] Total Atomic Misses / Rank > 5: {len(atomic_misses)} / {len(atomic_cases)}")
for am in atomic_misses[:8]:
    print(f"  • {am['test_case_id']} ({am['domain'][:20]}): Rank={am['rank']} | Target: {am['target_doc']} p.{am['page']}")

# Check composite missed targets
composite_cases = [tc for tc in data["test_cases"] if tc["case_type"] == "COMPOSITE_MULTI_DOCUMENT"]
composite_target_misses = []

for tc in composite_cases:
    tc_id = tc["test_case_id"]
    targets = tc["ground_truth_targets"]
    synth = tc["synthetic_complaint"]
    narrative = synth.get("translated_text") or synth.get("raw_text") or ""
    crime_sub = synth.get("crime_sub_type", "")
    query_str = f"{narrative[:1500]} {crime_sub}".strip()

    retrieved = search_legal_sops(query_str, target_specialist="multi_specialist", top_k=20, use_hyde=True)
    for tgt in targets:
        hit = any(is_chunk_hit(r_chunk, tgt) for r_chunk in retrieved)
        if not hit:
            composite_target_misses.append({
                "test_case_id": tc_id,
                "target_domain": tgt["target_specialist"],
                "target_doc": tgt["source_document"],
                "page": tgt["page_number"],
                "target_point_id": tgt["point_id"]
            })

print(f"\n[!] Total Composite Missed Targets: {len(composite_target_misses)} / {len(composite_cases)*4}")
domain_miss_count = {}
for cm in composite_target_misses:
    dom = cm["target_domain"]
    domain_miss_count[dom] = domain_miss_count.get(dom, 0) + 1

for dom, cnt in domain_miss_count.items():
    print(f"  • Domain '{dom}' missed targets: {cnt} / 20")
