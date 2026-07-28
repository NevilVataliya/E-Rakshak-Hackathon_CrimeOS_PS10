import os
import sys
import json
import re

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.rag.qdrant_client import get_qdrant_client

def audit_conventional_misses_and_section_citations():
    client = get_qdrant_client()
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    dataset_path = os.path.join(base_dir, "eval_dataset", "rag_benchmark_v2.json")
    
    with open(dataset_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    composite_cases = [tc for tc in data['test_cases'] if tc['case_type'] == 'COMPOSITE_MULTI_DOCUMENT']

    print(f"=========================================================================")
    print(f"[*] DIAGNOSTIC CHECK #1: AUDITING 14 CONVENTIONAL SPECIALIST TARGETS IN QDRANT")
    print(f"=========================================================================\n", flush=True)

    conventional_targets = []
    for tc in composite_cases:
        tc_id = tc["test_case_id"]
        for tgt in tc["ground_truth_targets"]:
            if tgt["target_specialist"] == "conventional_field_specialist":
                conventional_targets.append({
                    "case_id": tc_id,
                    "source_doc": tgt["source_document"],
                    "page": tgt["page_number"],
                    "page_window": tgt.get("allowed_page_window", [tgt["page_number"]])
                })

    # Search Qdrant collection for each conventional target document + page
    # Scroll points from 'police_sops_universal'
    scroll_resp, _ = client.scroll(
        collection_name="police_sops_universal",
        limit=10000,
        with_payload=True,
        with_vectors=False
    )
    
    all_points = scroll_resp

    missing_count = 0
    garbled_count = 0
    clean_count = 0

    for idx, tgt in enumerate(conventional_targets, 1):
        doc = str(tgt["source_doc"]).lower().strip()
        target_pages = tgt["page_window"]
        
        # Find points matching this document and page window
        matching_chunks = []
        for pt in all_points:
            payload = pt.payload or {}
            c_doc = str(payload.get("source", "")).lower().strip()
            c_pages = [int(p.strip()) for p in str(payload.get("page", "1")).split(",") if p.strip().isdigit()]
            if c_doc == doc and any(p in target_pages for p in c_pages):
                matching_chunks.append(payload)

        print(f"[{idx:2d}/16] Case {tgt['case_id']}: Doc='{tgt['source_doc']}' Page={tgt['page']}")
        if not matching_chunks:
            print(f"      Status: ❌ MISSING ENTIRELY FROM QDRANT COLLECTION!")
            missing_count += 1
        else:
            text = matching_chunks[0].get("text", "")
            # Quality checks
            alpha_ratio = sum(c.isalnum() or c.isspace() for c in text) / max(len(text), 1)
            is_garbled = alpha_ratio < 0.65 or "..." in text[:20] or len(text.strip()) < 40
            
            if is_garbled:
                print(f"      Status: ⚠️ PRESENT BUT GARBLED/LOW-QUALITY! (Length: {len(text)}, AlphaRatio: {alpha_ratio:.2f})")
                print(f"      Snippet: \"{text[:120]}...\"")
                garbled_count += 1
            else:
                print(f"      Status: ✅ PRESENT AND CLEAN! (Length: {len(text)}, AlphaRatio: {alpha_ratio:.2f})")
                print(f"      Snippet: \"{text[:120]}...\"")
                clean_count += 1

    print("\n=========================================================================")
    print(f" SUMMARY OF CONVENTIONAL TARGET CHUNKS IN QDRANT:")
    print(f"   • Pages Missing Entirely from Qdrant:  {missing_count:2d} / 16 ({missing_count/16*100:.1f}%)")
    print(f"   • Pages Present but Garbled (OCR):     {garbled_count:2d} / 16 ({garbled_count/16*100:.1f}%)")
    print(f"   • Pages Present and Clean:             {clean_count:2d} / 16 ({clean_count/16*100:.1f}%)")
    print("=========================================================================\n")

    print(f"=========================================================================")
    print(f"[*] DIAGNOSTIC CHECK #2: SPOT-CHECKING COMPOSITE COMPLAINT NARRATIVES FOR SECTION CITATIONS")
    print(f"=========================================================================\n", flush=True)

    cases_with_sections = 0
    total_sec_citations = 0

    for tc in composite_cases:
        synth = tc["synthetic_complaint"]
        narrative = synth.get("translated_text") or synth.get("raw_text") or ""
        sec_matches = re.findall(r'\b(?:Section|Sec|u/s)\s*\d+[A-Z]?(?:\(\d+\))?', narrative, re.IGNORECASE)
        
        has_sec = bool(sec_matches)
        if has_sec:
            cases_with_sections += 1
            total_sec_citations += len(sec_matches)
            
        print(f"  • {tc['test_case_id']}: Section Citations = {sec_matches if has_sec else 'NONE (Informal Narrative)'}")

    print("\n=========================================================================")
    print(f" SUMMARY OF SECTION CITATIONS IN COMPOSITE INPUT NARRATIVES:")
    print(f"   • Complaints WITH explicit section citations: {cases_with_sections:2d} / 16 ({cases_with_sections/16*100:.1f}%)")
    print(f"   • Complaints WITHOUT section citations (Informal): {16-cases_with_sections:2d} / 16 ({(16-cases_with_sections)/16*100:.1f}%)")
    print("=========================================================================\n")

if __name__ == "__main__":
    audit_conventional_misses_and_section_citations()
