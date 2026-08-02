import os
import sys
import json

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.rag.qdrant_client import search_legal_sops, get_qdrant_client, get_query_embedding, COLLECTION_NAME
from app.rag.query_optimizer import decompose_multi_aspect_query
from eval.run_rag_benchmark import is_chunk_hit

v3_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "eval_dataset", "rag_benchmark_v3.json")
with open(v3_path, "r", encoding="utf-8") as f:
    data = json.load(f)

client = get_qdrant_client()
composite_cases = [tc for tc in data["test_cases"] if tc["case_type"] == "COMPOSITE_MULTI_DOCUMENT"]

print("=========================================================================")
print("  DEEP POINT-LEVEL DIAGNOSTIC OF MISSED COMPOSITE GROUND TRUTH TARGETS")
print("=========================================================================")

for tc_idx, tc in enumerate(composite_cases[:5], 1):
    tc_id = tc["test_case_id"]
    targets = tc["ground_truth_targets"]
    synth = tc["synthetic_complaint"]
    narrative = synth.get("translated_text") or synth.get("raw_text") or ""
    crime_sub = synth.get("crime_sub_type", "")
    query_str = f"{narrative[:1500]} {crime_sub}".strip()

    sub_queries = decompose_multi_aspect_query(query_str)
    retrieved = search_legal_sops(query_str, target_specialist="multi_specialist", top_k=20)

    print(f"\n--- [{tc_id}] ---")
    for tgt_idx, tgt in enumerate(targets, 1):
        dom = tgt["target_specialist"]
        pt_id = tgt["point_id"]
        sub_q = sub_queries.get(dom, query_str)
        sub_vec = get_query_embedding(sub_q)

        # Check if point exists in Qdrant
        q_res = client.retrieve(collection_name=COLLECTION_NAME, ids=[pt_id])
        if not q_res:
            print(f"Target #{tgt_idx} ({dom}): Point ID '{pt_id}' DOES NOT EXIST IN QDRANT!")
            continue

        gt_point = q_res[0]
        gt_payload = gt_point.payload or {}
        gt_text = gt_payload.get("text", "")
        gt_doc = gt_payload.get("source", "")
        gt_page = gt_payload.get("page", 1)

        hit_rank = None
        for r_rank, r_chunk in enumerate(retrieved, 1):
            if is_chunk_hit(r_chunk, tgt):
                hit_rank = r_rank
                break

        status = f"✓ HIT at Rank {hit_rank}" if hit_rank else "✗ MISSED"
        print(f"  Target #{tgt_idx} [{dom[:15]}] -> {status}")
        print(f"    Doc: {gt_doc} p.{gt_page} | Point ID: {pt_id}")
        print(f"    Payload Specialist Tag: '{gt_payload.get('target_specialist')}'")
        print(f"    GT Text Snippet: {gt_text[:120]}...")
        print(f"    Sub-Query Used: '{sub_q[:120]}...'")
