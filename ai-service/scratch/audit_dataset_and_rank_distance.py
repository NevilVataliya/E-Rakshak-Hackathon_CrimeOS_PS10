import os
import sys
import json
import numpy as np

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.rag.qdrant_client import get_qdrant_client
from app.rag.query_optimizer import decompose_query_for_specialist
from sentence_transformers import SentenceTransformer

def is_chunk_hit(retrieved_chunk: dict, ground_truth: dict) -> bool:
    c_doc = str(retrieved_chunk.get("source", "")).lower().strip()
    gt_doc = str(ground_truth.get("source_document", "")).lower().strip()
    if c_doc != gt_doc:
        return False
    
    c_pages = [int(p.strip()) for p in str(retrieved_chunk.get("page", "1")).split(",") if p.strip().isdigit()]
    gt_window = ground_truth.get("allowed_page_window", [ground_truth.get("page_number", 1)])
    return any(p in gt_window for p in c_pages)

def run_diagnostic_tasks():
    client = get_qdrant_client()
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    dataset_path = os.path.join(base_dir, "eval_dataset", "rag_benchmark_v2.json")
    
    with open(dataset_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    composite_cases = [tc for tc in data['test_cases'] if tc['case_type'] == 'COMPOSITE_MULTI_DOCUMENT']

    print(f"=========================================================================")
    print(f"[*] TASK 1: SPOT-AUDITING NON-CONVENTIONAL TARGETS (BNS, BSA, CYBER)")
    print(f"=========================================================================\n", flush=True)

    # Scroll all points once
    scroll_resp, _ = client.scroll(
        collection_name="police_sops_universal",
        limit=10000,
        with_payload=True,
        with_vectors=True
    )

    all_points = scroll_resp

    sample_targets_to_audit = [
        ("BENCH-COMPOSITE-001", "cyber_financial_intel_specialist"),
        ("BENCH-COMPOSITE-002", "bns_specialist"),
        ("BENCH-COMPOSITE-003", "bsa_specialist"),
        ("BENCH-COMPOSITE-004", "cyber_financial_intel_specialist"),
        ("BENCH-COMPOSITE-005", "bsa_specialist"),
        ("BENCH-COMPOSITE-006", "bns_specialist")
    ]

    for tc_id, spec_name in sample_targets_to_audit:
        tc = [x for x in composite_cases if x["test_case_id"] == tc_id][0]
        synth = tc["synthetic_complaint"]
        narrative = synth.get("translated_text") or synth.get("raw_text") or ""
        crime_sub = synth.get("crime_sub_type", "")
        tgt = [t for t in tc["ground_truth_targets"] if t["target_specialist"] == spec_name][0]

        doc_target = str(tgt["source_document"]).lower().strip()
        page_window = tgt.get("allowed_page_window", [tgt["page_number"]])

        matching_text = ""
        for pt in all_points:
            p = pt.payload or {}
            c_doc = str(p.get("source", "")).lower().strip()
            c_pages = [int(x.strip()) for x in str(p.get("page", "")).split(",") if x.strip().isdigit()]
            if c_doc == doc_target and any(pg in page_window for pg in c_pages):
                matching_text = p.get("text", "")
                break

        print(f"--- CASE {tc_id} | Specialist: '{spec_name}' ---")
        print(f"  Target Document: '{tgt['source_document']}' (Page {tgt['page_number']})")
        print(f"  Narrative Snippet: \"{narrative[:150]}...\"")
        print(f"  Stored Chunk Snippet: \"{matching_text[:200] if matching_text else 'NOT FOUND'}...\"\n")

    print(f"=========================================================================")
    print(f"[*] TASK 2: EXACT RANK-DISTANCE DIAGNOSTIC FOR MISSED GPM TARGETS")
    print(f"=========================================================================\n", flush=True)

    model = SentenceTransformer('BAAI/bge-m3')

    # Prepare vector matrix of all 10,000 points
    point_vectors = []
    point_payloads = []
    for pt in all_points:
        point_vectors.append(pt.vector)
        point_payloads.append(pt.payload or {})

    point_matrix = np.array(point_vectors, dtype=np.float32)

    near_misses = 0
    far_misses = 0

    for tc in composite_cases:
        tc_id = tc["test_case_id"]
        synth = tc["synthetic_complaint"]
        narrative = synth.get("translated_text") or synth.get("raw_text") or ""
        crime_sub = synth.get("crime_sub_type", "")
        tgt = [t for t in tc["ground_truth_targets"] if t["target_specialist"] == "conventional_field_specialist"][0]

        if "gujarat" in str(tgt["source_document"]).lower():
            query = decompose_query_for_specialist(narrative, "conventional_field_specialist", crime_sub)
            q_emb = model.encode([query], normalize_embeddings=True)[0]

            # Compute similarities across all points
            sims = np.dot(point_matrix, q_emb)
            sorted_indices = np.argsort(-sims)

            doc_target = str(tgt["source_document"]).lower().strip()
            page_window = tgt.get("allowed_page_window", [tgt["page_number"]])

            # Find exact rank of target chunk
            exact_rank = -1
            for rank_idx, pt_idx in enumerate(sorted_indices, 1):
                p = point_payloads[pt_idx]
                c_doc = str(p.get("source", "")).lower().strip()
                c_pages = [int(x.strip()) for x in str(p.get("page", "")).split(",") if x.strip().isdigit()]
                if c_doc == doc_target and any(pg in page_window for pg in c_pages):
                    exact_rank = rank_idx
                    break

            if exact_rank <= 50:
                near_misses += 1
                status_str = "🎯 NEAR MISS (Rank 16–50)" if exact_rank > 15 else "✅ HIT (Rank <= 15)"
            else:
                far_misses += 1
                status_str = "⚠️ FAR MISS (Rank > 50)"

            print(f"  • {tc_id} (Page {tgt['page_number']:3d}): Exact Rank = {exact_rank:4d} | {status_str}")

    print("\n=========================================================================")
    print(f" SUMMARY OF RANK-DISTANCE DIAGNOSTIC (GPM TARGETS):")
    print(f"   • Near Misses (Rank 16–50): {near_misses}")
    print(f"   • Far Misses (Rank > 50):   {far_misses}")
    print("=========================================================================\n")

if __name__ == "__main__":
    run_diagnostic_tasks()
