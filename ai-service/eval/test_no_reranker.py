"""
Test benchmark score without reranker (pure Qdrant Multi-Query RRF)
"""
import os, sys, json
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.rag.query_optimizer import optimize_and_search
from eval.run_rag_benchmark import is_chunk_hit

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
data = json.load(open(os.path.join(base_dir, "eval_dataset", "rag_benchmark_v2.json"), "r", encoding="utf-8"))
test_cases = data["test_cases"]

hits_k5 = 0
hits_k15 = 0
total_atomic = 0

print("=== BENCHMARK WITHOUT RERANKER (PURE RRF) ===")

for tc in test_cases:
    if tc["case_type"] != "ATOMIC_SINGLE_CHUNK":
        continue
    
    total_atomic += 1
    gt = tc["ground_truth_binding"]
    synth = tc["synthetic_complaint"]
    narrative = synth.get("translated_text") or synth.get("raw_text") or ""
    crime_sub = synth.get("crime_sub_type", "")
    crime_cat = synth.get("crime_category", "")
    
    # Run WITHOUT reranker (pure RRF)
    results = optimize_and_search(
        complaint_text=narrative,
        crime_sub_type=crime_sub,
        crime_category=crime_cat,
        top_k=15,
        enable_reranker=False
    )
    
    # Check hit in top 5 and top 15
    hit_5 = any(is_chunk_hit(r, gt) for r in results[:5])
    hit_15 = any(is_chunk_hit(r, gt) for r in results[:15])
    
    if hit_5: hits_k5 += 1
    if hit_15: hits_k15 += 1
    
    status = "HIT@5" if hit_5 else ("HIT@15" if hit_15 else "MISS")
    print(f"[{status:6s}] {tc['test_case_id']}: target={gt['source_document']} p.{gt['page_number']} | crime={crime_sub}")

print(f"\nHit Rate @ 5:  {hits_k5}/{total_atomic} = {hits_k5/total_atomic*100:.1f}%")
print(f"Hit Rate @ 15: {hits_k15}/{total_atomic} = {hits_k15/total_atomic*100:.1f}%")
