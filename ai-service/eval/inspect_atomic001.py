"""Inspect retrieved chunks vs ground truth for BENCH-ATOMIC-001"""
import os, sys, json
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.rag.query_optimizer import optimize_and_search
from eval.run_rag_benchmark import is_chunk_hit, get_page_numbers_set

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
data = json.load(open(os.path.join(base_dir, "eval_dataset", "rag_benchmark_v2.json"), "r", encoding="utf-8"))
tc = data["test_cases"][0] # BENCH-ATOMIC-001

gt = tc["ground_truth_binding"]
synth = tc["synthetic_complaint"]
narrative = synth.get("translated_text") or synth.get("raw_text") or ""
crime_sub = synth.get("crime_sub_type", "")
crime_cat = synth.get("crime_category", "")

print(f"=== BENCH-ATOMIC-001 GROUND TRUTH ===")
print(f"Target Doc: {gt['source_document']}")
print(f"Target Page: {gt['page_number']}")
print(f"Allowed Window: {gt.get('allowed_page_window')}")
print(f"Target Snippet:\n{tc.get('target_chunk_snippet', '')[:200]}\n")

results = optimize_and_search(
    complaint_text=narrative,
    crime_sub_type=crime_sub,
    crime_category=crime_cat,
    target_specialist=tc.get("specialist_domain"),
    top_k=20,
    enable_reranker=False
)

print(f"=== RETRIEVED TOP 20 CHUNKS ===")
for i, r in enumerate(results, 1):
    doc = r["source"]
    page = r["page"]
    pages_set = get_page_numbers_set(page)
    hit = is_chunk_hit(r, gt)
    hit_str = "✓ MATCH" if hit else " "
    print(f"[{i:2d}] [{hit_str}] Doc: {doc} | Page: {page} (parsed: {pages_set}) | Score: {r['score']:.4f}")
    print(f"     Snippet: {r['text'][:120]}...\n")
