import os
import sys
import json
import re

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.rag.qdrant_client import get_qdrant_client

def parse_page_num(val) -> int:
    if isinstance(val, int):
        return val
    val_str = str(val or "1")
    nums = re.findall(r'\d+', val_str)
    return int(nums[0]) if nums else 1

def audit_v2_vs_universal():
    client = get_qdrant_client()
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    dataset_path = os.path.join(base_dir, "eval_dataset", "rag_benchmark_v2.json")
    
    with open(dataset_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    composite_cases = [tc for tc in data['test_cases'] if tc['case_type'] == 'COMPOSITE_MULTI_DOCUMENT']

    flagged_cases = ["BENCH-COMPOSITE-001", "BENCH-COMPOSITE-009", "BENCH-COMPOSITE-011", "BENCH-COMPOSITE-013"]

    print("=========================================================================")
    print("[*] AUDITING FLAGGED CASES IN ORIGINAL 'police_sops_v2' COLLECTION")
    print("=========================================================================\n")

    v2_scroll, _ = client.scroll(
        collection_name="police_sops_v2",
        limit=10000,
        with_payload=True,
        with_vectors=False
    )

    for tc_id in flagged_cases:
        tc = [x for x in composite_cases if x["test_case_id"] == tc_id][0]
        synth = tc["synthetic_complaint"]
        narrative = synth.get("translated_text") or synth.get("raw_text") or ""
        crime_sub = synth.get("crime_sub_type", "")
        tgt = [t for t in tc["ground_truth_targets"] if t["target_specialist"] == "conventional_field_specialist"][0]

        target_pid = tgt.get("point_id") or tgt.get("target_point_id") or ""
        target_doc = str(tgt.get("source_document", "")).lower().strip()
        target_page = tgt.get("page_number", 1)

        # 1. Find by point ID in v2
        pid_match_v2 = [pt.payload for pt in v2_scroll if str(pt.id).lower() == str(target_pid).lower()]
        
        # 2. Find by doc + page in v2
        doc_page_v2 = []
        for pt in v2_scroll:
            p = pt.payload or {}
            c_doc = str(p.get("source") or "").lower().strip()
            c_pages = [parse_page_num(x) for x in str(p.get("page", "1")).split(",")]
            if c_doc == target_doc and target_page in c_pages:
                doc_page_v2.append(p)

        print(f"--- CASE ID: {tc_id} (Crime: '{crime_sub}') ---")
        print(f"  Target Document: '{tgt['source_document']}' (Page {tgt['page_number']}) | Point ID: {target_pid}")
        print(f"  Narrative Snippet: \"{narrative[:150]}...\"")
        
        if pid_match_v2:
            print(f"  [+] Found Point ID in v2! Text: \"{pid_match_v2[0].get('text','')[:250]}...\"")
        elif doc_page_v2:
            print(f"  [+] Found Doc+Page in v2! Text: \"{doc_page_v2[0].get('text','')[:250]}...\"")
        else:
            print(f"  ❌ NOT FOUND in police_sops_v2 collection!")
        print("")

if __name__ == "__main__":
    audit_v2_vs_universal()
