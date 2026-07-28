import os
import sys
import json
import re

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.rag.qdrant_client import search_legal_sops
from app.rag.query_optimizer import decompose_query_for_specialist
from config import get_agent_llm, GEMINI_API_KEY

def is_chunk_hit(retrieved_chunk: dict, ground_truth: dict) -> bool:
    c_doc = str(retrieved_chunk.get("source", "")).lower().strip()
    gt_doc = str(ground_truth.get("source_document", "")).lower().strip()
    if c_doc != gt_doc:
        return False
    
    c_pages = [int(p.strip()) for p in str(retrieved_chunk.get("page", "1")).split(",") if p.strip().isdigit()]
    gt_window = ground_truth.get("allowed_page_window", [ground_truth.get("page_number", 1)])
    return any(p in gt_window for p in c_pages)

def generate_conventional_hyde_query(narrative: str, crime_sub_type: str) -> str:
    """
    Generates a formal police manual procedural rewriting (HyDE) grounded in the case details.
    """
    if not GEMINI_API_KEY:
        return f"{crime_sub_type} police SOP procedure investigation diary entry panchnama scene inspection {narrative[:250]}".strip()
        
    llm = get_agent_llm("auto", temperature=0.1)
    prompt = f"""
You are an experienced Indian Police Officer.
Read the following complaint narrative and generate a 2-sentence formal Police SOP / Procedural Manual snippet (in formal English legal register) describing the exact administrative, field, or investigative procedure required for this case.

COMPLAINT NARRATIVE:
{narrative[:400]}

CRIME SUB-TYPE: {crime_sub_type}

Output ONLY the 2-sentence formal procedural snippet.
"""
    try:
        resp = llm.invoke(prompt)
        formal_snippet = resp.content if hasattr(resp, 'content') else str(resp)
        return f"{crime_sub_type} {formal_snippet.strip()} {narrative[:250]}".strip()
    except Exception as e:
        return f"{crime_sub_type} police SOP procedure investigation {narrative[:300]}".strip()

def run_conventional_experiment():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    dataset_path = os.path.join(base_dir, "eval_dataset", "rag_benchmark_v2.json")
    
    with open(dataset_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    composite_cases = [tc for tc in data['test_cases'] if tc['case_type'] == 'COMPOSITE_MULTI_DOCUMENT']

    print(f"=========================================================================")
    print(f"[*] TESTING VARIANT 1: STATIC PHRASE INJECTION FOR CONVENTIONAL QUERY")
    print(f"=========================================================================", flush=True)

    v1_conv_hits = 0
    v1_full_coverage = 0
    
    for idx, tc in enumerate(composite_cases, 1):
        targets = tc["ground_truth_targets"]
        synth = tc["synthetic_complaint"]
        narrative = synth.get("translated_text") or synth.get("raw_text") or ""
        crime_sub = synth.get("crime_sub_type", "")
        
        retrieved_all = []
        for tgt in targets:
            spec = tgt["target_specialist"]
            if spec == "conventional_field_specialist":
                q = f"scene of crime inspection panchnama map police SOP procedure {crime_sub} {narrative[:250]}".strip()
            else:
                q = decompose_query_for_specialist(narrative, target_specialist=spec, crime_sub_type=crime_sub)
            res = search_legal_sops(q, target_specialist=spec, top_k=15)
            retrieved_all.extend(res)

        case_hits = sum(1 for tgt in targets if any(is_chunk_hit(r, tgt) for r in retrieved_all))
        conv_tgt = [tgt for tgt in targets if tgt["target_specialist"] == "conventional_field_specialist"][0]
        hit_conv = any(is_chunk_hit(r, conv_tgt) for r in retrieved_all)
        if hit_conv:
            v1_conv_hits += 1
        if case_hits == len(targets):
            v1_full_coverage += 1

        print(f"  [Variant 1] Case {idx:2d}/16 ({tc['test_case_id']}): Conventional Hit={hit_conv} | Case Coverage={case_hits}/4", flush=True)

    print(f"\n  [+] Variant 1 (Static Injection): Conventional Hits = {v1_conv_hits}/16 | Full 4/4 Coverage = {v1_full_coverage}/16\n", flush=True)

    print(f"=========================================================================")
    print(f"[*] TESTING VARIANT 2: DYNAMIC CASE-SPECIFIC HYDE REWRITING FOR CONVENTIONAL QUERY")
    print(f"=========================================================================", flush=True)

    v2_conv_hits = 0
    v2_full_coverage = 0

    for idx, tc in enumerate(composite_cases, 1):
        targets = tc["ground_truth_targets"]
        synth = tc["synthetic_complaint"]
        narrative = synth.get("translated_text") or synth.get("raw_text") or ""
        crime_sub = synth.get("crime_sub_type", "")
        
        retrieved_all = []
        for tgt in targets:
            spec = tgt["target_specialist"]
            if spec == "conventional_field_specialist":
                q = generate_conventional_hyde_query(narrative, crime_sub)
            else:
                q = decompose_query_for_specialist(narrative, target_specialist=spec, crime_sub_type=crime_sub)
            res = search_legal_sops(q, target_specialist=spec, top_k=15)
            retrieved_all.extend(res)

        case_hits = sum(1 for tgt in targets if any(is_chunk_hit(r, tgt) for r in retrieved_all))
        conv_tgt = [tgt for tgt in targets if tgt["target_specialist"] == "conventional_field_specialist"][0]
        hit_conv = any(is_chunk_hit(r, conv_tgt) for r in retrieved_all)
        if hit_conv:
            v2_conv_hits += 1
        if case_hits == len(targets):
            v2_full_coverage += 1

        print(f"  [Variant 2] Case {idx:2d}/16 ({tc['test_case_id']}): Conventional Hit={hit_conv} | Case Coverage={case_hits}/4", flush=True)

    print("\n=========================================================================")
    print(" SUMMARY COMPARISON ON CONVENTIONAL TARGETS & FULL COMPOUND COVERAGE")
    print("=========================================================================")
    print(f" • Variant 1 (Static Phrase Injection): Conventional Hits: {v1_conv_hits:2d}/16 | Full Coverage: {v1_full_coverage:2d}/16")
    print(f" • Variant 2 (Case-Specific HyDE):      Conventional Hits: {v2_conv_hits:2d}/16 | Full Coverage: {v2_full_coverage:2d}/16")
    print("=========================================================================\n", flush=True)

if __name__ == "__main__":
    run_conventional_experiment()
