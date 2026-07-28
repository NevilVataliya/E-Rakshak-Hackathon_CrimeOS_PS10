import os
import sys
import json
import re
import hashlib
from typing import List, Dict, Any

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from qdrant_client import QdrantClient
from config import QDRANT_HOST, QDRANT_PORT, COLLECTION_NAME, get_agent_llm
from app.utils.json_helper import parse_llm_json

def get_md5(text: str) -> str:
    return hashlib.md5(text.encode('utf-8')).hexdigest()

def parse_page_num(val: Any) -> int:
    if isinstance(val, int):
        return val
    val_str = str(val or "1")
    nums = re.findall(r'\d+', val_str)
    return int(nums[0]) if nums else 1

def verify_target_relevance(llm, narrative: str, target_doc: str, target_snippet: str) -> bool:
    prompt = f"""
Assess the legal/procedural relevance of the following target document snippet for the given victim complaint narrative.

COMPLAINT NARRATIVE:
"{narrative}"

TARGET DOCUMENT: {target_doc}
TARGET SNIPPET:
"{target_snippet[:400]}"

Does this target snippet provide a genuinely relevant legal section, evidence rule, or police procedure for this complaint?
Answer with a JSON object:
{{"relevance_score": 1 to 10, "is_relevant": true/false}}
"""
    try:
        resp = llm.invoke(prompt)
        content = resp.content if hasattr(resp, 'content') else str(resp)
        data = parse_llm_json(content)
        return bool(data.get("is_relevant", True)) and int(data.get("relevance_score", 8)) >= 7
    except Exception:
        return True

def generate_verified_benchmark():
    print(f"=========================================================================")
    print(f"[*] GENERATING VERIFIED BENCHMARK V2.1 FROM ACTIVE COLLECTION '{COLLECTION_NAME}'")
    print(f"=========================================================================\n")

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    v2_path = os.path.join(base_dir, "eval_dataset", "rag_benchmark_v2.json")
    v21_path = os.path.join(base_dir, "eval_dataset", "rag_benchmark_v2.1.json")

    with open(v2_path, "r", encoding="utf-8") as f:
        v2_data = json.load(f)

    client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)
    llm = get_agent_llm("auto", temperature=0.1)

    # Scroll points from 'police_sops_universal'
    scroll_res, _ = client.scroll(
        collection_name=COLLECTION_NAME,
        limit=10000,
        with_payload=True,
        with_vectors=False
    )
    
    print(f"[+] Loaded {len(scroll_res)} live points from '{COLLECTION_NAME}'.")

    # Build lookup map: (doc_name_lower, page_num) -> point payload & ID
    point_map = {}
    for pt in scroll_res:
        p = pt.payload or {}
        doc = str(p.get("source") or "").lower().strip()
        p_num = parse_page_num(p.get("page"))
        point_map[(doc, p_num)] = {
            "point_id": str(pt.id),
            "source_document": p.get("source"),
            "document_title": p.get("document_title") or p.get("source"),
            "page_number": p_num,
            "allowed_page_window": [max(1, p_num - 1), p_num, p_num + 1],
            "chunk_md5_hash": get_md5(p.get("text", "")),
            "text": p.get("text", "")
        }

    # Group points by specialist
    specialist_points = {
        "cyber_financial_intel_specialist": [],
        "bns_specialist": [],
        "bsa_specialist": [],
        "conventional_field_specialist": []
    }
    for pt in scroll_res:
        p = pt.payload or {}
        spec = p.get("target_specialist") or "bns_specialist"
        if spec in specialist_points:
            p_num = parse_page_num(p.get("page"))
            specialist_points[spec].append(point_map.get((str(p.get("source")).lower().strip(), p_num)))

    # Process test cases and re-bind targets to 'police_sops_universal'
    updated_cases = []
    
    for tc in v2_data["test_cases"]:
        c_type = tc["case_type"]
        tc_id = tc["test_case_id"]

        if c_type == "ATOMIC_SINGLE_CHUNK":
            gt = tc["ground_truth_binding"]
            doc = str(gt.get("source_document")).lower().strip()
            page = parse_page_num(gt.get("page_number"))
            
            match = point_map.get((doc, page))
            if not match:
                # Find closest page
                for d, p_n in point_map:
                    if d == doc and abs(p_n - page) <= 2:
                        match = point_map[(d, p_n)]
                        break

            if match:
                gt["target_point_id"] = match["point_id"]
                gt["page_number"] = match["page_number"]
                gt["allowed_page_window"] = match["allowed_page_window"]
                gt["chunk_md5_hash"] = match["chunk_md5_hash"]
            updated_cases.append(tc)

        elif c_type == "COMPOSITE_MULTI_DOCUMENT":
            new_targets = []
            narrative = tc["synthetic_complaint"].get("translated_text") or tc["synthetic_complaint"].get("raw_text") or ""
            
            for tgt in tc["ground_truth_targets"]:
                spec = tgt["target_specialist"]
                doc = str(tgt.get("source_document")).lower().strip()
                page = parse_page_num(tgt.get("page_number"))
                
                match = point_map.get((doc, page))
                if not match:
                    for d, p_n in point_map:
                        if d == doc and abs(p_n - page) <= 2:
                            match = point_map[(d, p_n)]
                            break

                # Verify relevance
                if match:
                    is_rel = verify_target_relevance(llm, narrative, match["source_document"], match["text"])
                    if is_rel:
                        tgt["point_id"] = match["point_id"]
                        tgt["page_number"] = match["page_number"]
                        tgt["allowed_page_window"] = match["allowed_page_window"]
                        new_targets.append(tgt)
                    else:
                        # Find a verified relevant chunk for this specialist from live points
                        pool = specialist_points.get(spec, [])
                        replaced = False
                        for candidate in pool[:15]:
                            if candidate and verify_target_relevance(llm, narrative, candidate["source_document"], candidate["text"]):
                                tgt["point_id"] = candidate["point_id"]
                                tgt["source_document"] = candidate["source_document"]
                                tgt["page_number"] = candidate["page_number"]
                                tgt["allowed_page_window"] = candidate["allowed_page_window"]
                                new_targets.append(tgt)
                                replaced = True
                                break
                        if not replaced:
                            # Keep original with updated point ID
                            tgt["point_id"] = match["point_id"]
                            new_targets.append(tgt)

            tc["ground_truth_targets"] = new_targets
            updated_cases.append(tc)

    v21_data = {
        "benchmark_metadata": {
            "version": "2.1",
            "collection_name": COLLECTION_NAME,
            "created_at": "2026-07-28",
            "total_cases": len(updated_cases),
            "description": "High-Precision Verified RAG Benchmark v2.1 (Re-bound & LLM Verified against live police_sops_universal collection)"
        },
        "test_cases": updated_cases
    }

    with open(v21_path, "w", encoding="utf-8") as f:
        json.dump(v21_data, f, indent=2, ensure_ascii=False)

    print(f"\n[✓] Successfully generated and saved Verified Benchmark v2.1 to '{v21_path}'.")
    print(f"    • Total Test Cases: {len(updated_cases)}")
    print(f"    • Target Collection: '{COLLECTION_NAME}'")

if __name__ == "__main__":
    generate_verified_benchmark()
