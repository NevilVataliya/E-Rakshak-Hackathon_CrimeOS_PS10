"""
Test content-level deduplication on pure RRF search
"""
import os, sys, json
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.rag.qdrant_client import search_legal_sops
from eval.run_rag_benchmark import is_chunk_hit
from app.rag.query_decomposer import decompose_complaint_to_legal_queries

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
data = json.load(open(os.path.join(base_dir, "eval_dataset", "rag_benchmark_v2.json"), "r", encoding="utf-8"))
test_cases = data["test_cases"]

def search_with_content_dedup(complaint_text, crime_sub_type, crime_category, top_k=15):
    concept_queries = decompose_complaint_to_legal_queries(
        complaint_text=complaint_text,
        crime_sub_type=crime_sub_type,
        crime_category=crime_category,
        max_queries=2
    )
    raw_query = {
        "query": f"{complaint_text[:600]} {crime_sub_type}".strip(),
        "hyde_passage": complaint_text[:600],
        "intent": "raw_complaint"
    }
    sub_queries = [raw_query] + (concept_queries or [])
    
    # Get raw candidates from Qdrant
    raw_results = search_legal_sops(
        query=f"{complaint_text[:500]} {crime_sub_type}".strip(),
        target_specialist=None,
        top_k=50, # Get 50 candidates first
        sub_queries=sub_queries
    )
    
    # Deduplicate by (source, page) content key
    deduped = []
    seen_keys = set()
    for r in raw_results:
        key = (r["source"].lower(), str(r.get("page", "1")).strip())
        if key not in seen_keys:
            seen_keys.add(key)
            deduped.append(r)
            if len(deduped) >= top_k:
                break
    return deduped

hits_k5 = 0
hits_k15 = 0
total_atomic = 0

print("=== BENCHMARK WITH CONTENT DEDUPLICATION (PURE RRF) ===")

for tc in test_cases:
    if tc["case_type"] != "ATOMIC_SINGLE_CHUNK":
        continue
    
    total_atomic += 1
    gt = tc["ground_truth_binding"]
    synth = tc["synthetic_complaint"]
    narrative = synth.get("translated_text") or synth.get("raw_text") or ""
    crime_sub = synth.get("crime_sub_type", "")
    crime_cat = synth.get("crime_category", "")
    
    results = search_with_content_dedup(narrative, crime_sub, crime_cat, top_k=15)
    
    hit_5 = any(is_chunk_hit(r, gt) for r in results[:5])
    hit_15 = any(is_chunk_hit(r, gt) for r in results[:15])
    
    if hit_5: hits_k5 += 1
    if hit_15: hits_k15 += 1
    
    status = "HIT@5" if hit_5 else ("HIT@15" if hit_15 else "MISS")
    print(f"[{status:6s}] {tc['test_case_id']}: target={gt['source_document']} p.{gt['page_number']} | crime={crime_sub}")

print(f"\nHit Rate @ 5:  {hits_k5}/{total_atomic} = {hits_k5/total_atomic*100:.1f}%")
print(f"Hit Rate @ 15: {hits_k15}/{total_atomic} = {hits_k15/total_atomic*100:.1f}%")
